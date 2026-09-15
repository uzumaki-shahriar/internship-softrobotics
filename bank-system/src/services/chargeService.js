const prisma = require("../db");
const config = require("../config");
const { generateBankReference } = require("../utils/generators");

function toChargeResult(row) {
  if (row.status === "approved") {
    return {
      status: "approved",
      bank_reference: row.bankReference,
      balance_after: row.balanceAfter.toNumber(),
    };
  }
  return { status: "declined", decline_reason: row.declineReason };
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Charges a card. Mirrors what a real bank actually checks before moving
 * money - see README.md / TEAM_PLAN.md §Module 1 for the agreed contract.
 */
async function chargeCard(payload) {
  const {
    card_number,
    expiry_month,
    expiry_year,
    cvv,
    amount,
    currency,
    idempotency_key,
    reference,
  } = payload;

  // Idempotency comes first, before any other check: a retried request must
  // get back the exact original outcome, never be re-evaluated.
  const existing = await prisma.bankTransaction.findUnique({
    where: { idempotencyKey: idempotency_key },
  });
  if (existing) {
    return toChargeResult(existing);
  }

  return prisma.$transaction(async (tx) => {
    const decline = async (reason, accountId = null, cardId = null) => {
      const row = await tx.bankTransaction.create({
        data: {
          bankReference: generateBankReference(),
          idempotencyKey: idempotency_key,
          gatewayReference: reference,
          accountId,
          cardId,
          type: "debit",
          amount,
          currency,
          status: "declined",
          declineReason: reason,
        },
      });
      return toChargeResult(row);
    };

    if (currency !== config.currency) {
      return decline("CURRENCY_NOT_SUPPORTED");
    }

    const card = await tx.card.findUnique({
      where: { cardNumber: card_number },
      include: { account: true },
    });
    if (!card) return decline("INVALID_CARD");

    const now = new Date();
    const isExpired =
      card.expiryYear < now.getFullYear() ||
      (card.expiryYear === now.getFullYear() && card.expiryMonth < now.getMonth() + 1);
    if (isExpired) return decline("EXPIRED_CARD", card.accountId, card.id);

    if (card.cvv !== cvv) return decline("CVV_MISMATCH", card.accountId, card.id);
    if (card.status !== "active") return decline("CARD_BLOCKED", card.accountId, card.id);

    const account = card.account;
    if (account.status === "frozen") return decline("ACCOUNT_FROZEN", account.id, card.id);
    if (account.status === "closed") return decline("ACCOUNT_CLOSED", account.id, card.id);

    if (account.balance.lessThan(amount)) {
      return decline("INSUFFICIENT_FUNDS", account.id, card.id);
    }

    const spentToday = await tx.bankTransaction.aggregate({
      where: {
        accountId: account.id,
        type: "debit",
        status: "approved",
        createdAt: { gte: startOfToday() },
      },
      _sum: { amount: true },
    });
    const alreadySpent = spentToday._sum.amount ?? 0;
    if (account.dailyLimit.lessThan(Number(alreadySpent) + amount)) {
      return decline("LIMIT_EXCEEDED", account.id, card.id);
    }

    const newBalance = account.balance.minus(amount);
    await tx.account.update({ where: { id: account.id }, data: { balance: newBalance } });

    const row = await tx.bankTransaction.create({
      data: {
        bankReference: generateBankReference(),
        idempotencyKey: idempotency_key,
        gatewayReference: reference,
        accountId: account.id,
        cardId: card.id,
        type: "debit",
        amount,
        currency,
        balanceAfter: newBalance,
        status: "approved",
      },
    });
    return toChargeResult(row);
  });
}

module.exports = { chargeCard };
