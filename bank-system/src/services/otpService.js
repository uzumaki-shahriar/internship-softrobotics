const prisma = require("../db");
const config = require("../config");
const logger = require("../logger");
const { NotFoundError } = require("../errors");
const { generateOtpCode } = require("../utils/generators");

async function loadChallenge(reference) {
  const transaction = await prisma.bankTransaction.findUnique({
    where: { bankReference: reference },
    include: { otpChallenge: true, card: true },
  });
  if (!transaction || !transaction.otpChallenge) {
    throw new NotFoundError("No OTP challenge found for this reference");
  }
  return transaction;
}

function maskedCardNumber(card) {
  return `**** **** **** ${card.cardNumber.slice(-4)}`;
}

/**
 * Read-only view for the customer-facing challenge page - GET /otp/:reference.
 */
async function getChallengeForDisplay(reference) {
  const transaction = await loadChallenge(reference);
  return {
    reference: transaction.bankReference,
    amount: transaction.amount.toNumber(),
    currency: transaction.currency,
    maskedCard: maskedCardNumber(transaction.card),
    status: transaction.status,
    expiresAt: transaction.otpChallenge.expiresAt,
  };
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Verifies the code the customer typed on the Bank's own OTP page and, on
 * a match, finalizes the money movement. Mirrors chargeCard()'s
 * validation style, but finalizes the existing "pending" BankTransaction
 * in place rather than creating a new ledger row per call - that pending
 * row (created back in chargeCard) already *is* the ledger entry; this
 * just resolves it to approved or declined.
 */
async function verifyOtp(reference, submittedCode) {
  const transaction = await loadChallenge(reference);
  const challenge = transaction.otpChallenge;

  // Already resolved - a resubmit or a page reload after the fact. Report
  // the same outcome again instead of re-evaluating anything.
  if (transaction.status !== "pending") {
    return { resolved: true, approved: transaction.status === "approved", returnUrl: challenge.returnUrl };
  }

  const declineTerminal = async (reason) => {
    await prisma.$transaction([
      prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { status: reason === "OTP_EXPIRED" ? "expired" : "failed" },
      }),
      prisma.bankTransaction.update({
        where: { id: transaction.id },
        data: { status: "declined", declineReason: reason },
      }),
    ]);
    return { resolved: true, approved: false, returnUrl: challenge.returnUrl };
  };

  if (Date.now() > challenge.expiresAt.getTime()) {
    return declineTerminal("OTP_EXPIRED");
  }

  if (submittedCode !== challenge.code) {
    const attemptCount = challenge.attemptCount + 1;
    if (attemptCount >= config.otpMaxAttempts) {
      return declineTerminal("OTP_FAILED");
    }
    await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { attemptCount } });
    return { resolved: false, error: "Incorrect code", attemptsRemaining: config.otpMaxAttempts - attemptCount };
  }

  return prisma.$transaction(async (tx) => {
    // Re-check balance/limit right before actually moving money - time has
    // passed since chargeCard's first check, funds could have moved.
    const account = await tx.account.findUniqueOrThrow({ where: { id: transaction.accountId } });
    const amount = transaction.amount.toNumber();

    const fail = async (reason) => {
      await tx.otpChallenge.update({ where: { id: challenge.id }, data: { status: "failed" } });
      await tx.bankTransaction.update({
        where: { id: transaction.id },
        data: { status: "declined", declineReason: reason },
      });
      return { resolved: true, approved: false, returnUrl: challenge.returnUrl };
    };

    if (account.balance.lessThan(amount)) {
      return fail("INSUFFICIENT_FUNDS");
    }

    const spentToday = await tx.bankTransaction.aggregate({
      where: { accountId: account.id, type: "debit", status: "approved", createdAt: { gte: startOfToday() } },
      _sum: { amount: true },
    });
    const alreadySpent = spentToday._sum.amount ?? 0;
    if (account.dailyLimit.lessThan(Number(alreadySpent) + amount)) {
      return fail("LIMIT_EXCEEDED");
    }

    const newBalance = account.balance.minus(amount);
    await tx.account.update({ where: { id: account.id }, data: { balance: newBalance } });
    await tx.otpChallenge.update({ where: { id: challenge.id }, data: { status: "verified" } });
    await tx.bankTransaction.update({
      where: { id: transaction.id },
      data: { status: "approved", balanceAfter: newBalance },
    });

    return { resolved: true, approved: true, returnUrl: challenge.returnUrl };
  });
}

/**
 * Sends a fresh code for a still-pending challenge - the SMS-delayed /
 * code-expired-while-reading-it escape hatch every real OTP page has.
 * Deliberately doesn't reset attemptCount: a resend gets you a new code,
 * not a new guess budget, so it can't be used to bypass config.otpMaxAttempts.
 */
async function resendOtp(reference) {
  const transaction = await loadChallenge(reference);
  const challenge = transaction.otpChallenge;

  if (transaction.status !== "pending") {
    return { resolved: true, approved: transaction.status === "approved", returnUrl: challenge.returnUrl };
  }

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + config.otpExpiryMinutes * 60 * 1000);
  await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { code, expiresAt } });

  logger.info(
    `[OTP] resend ${reference} account=${transaction.accountId} code=${code} expires_in=${config.otpExpiryMinutes}m`
  );

  return { resolved: false };
}

module.exports = { getChallengeForDisplay, verifyOtp, resendOtp };
