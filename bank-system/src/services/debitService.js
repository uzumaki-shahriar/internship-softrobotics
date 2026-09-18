const prisma = require("../db");
const config = require("../config");
const { generateBankReference } = require("../utils/generators");

function toDebitResult(row) {
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
 * Pulls money OUT of an account with no card involved - the opposite of
 * payoutService.payoutToAccount. This is how a merchant deposits from their
 * own linked bank account into the Payment Gateway's wallet: the Gateway
 * calls this directly on the account_number it already verified, same
 * trust level as payout (server-to-server, no OTP - there's no card/
 * customer step-up to do here, same reasoning as payout skipping it).
 * Checks balance and the account's daily limit same as a real card charge.
 */
async function debitAccount(payload) {
  const { account_number, amount, currency, idempotency_key, reference } = payload;

  const existing = await prisma.bankTransaction.findUnique({
    where: { idempotencyKey: idempotency_key },
  });
  if (existing) {
    return toDebitResult(existing);
  }

  return prisma.$transaction(async (tx) => {
    const decline = async (reason, accountId = null) => {
      const row = await tx.bankTransaction.create({
        data: {
          bankReference: generateBankReference(),
          idempotencyKey: idempotency_key,
          gatewayReference: reference,
          accountId,
          type: "debit",
          amount,
          currency,
          status: "declined",
          declineReason: reason,
        },
      });
      return toDebitResult(row);
    };

    if (currency !== config.currency) {
      return decline("CURRENCY_NOT_SUPPORTED");
    }

    const account = await tx.account.findUnique({ where: { accountNumber: account_number } });
    if (!account) return decline("ACCOUNT_NOT_FOUND");
    if (account.status === "frozen") return decline("ACCOUNT_FROZEN", account.id);
    if (account.status === "closed") return decline("ACCOUNT_CLOSED", account.id);
    if (account.balance.lessThan(amount)) return decline("INSUFFICIENT_FUNDS", account.id);

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
      return decline("LIMIT_EXCEEDED", account.id);
    }

    const newBalance = account.balance.minus(amount);
    await tx.account.update({ where: { id: account.id }, data: { balance: newBalance } });

    const row = await tx.bankTransaction.create({
      data: {
        bankReference: generateBankReference(),
        idempotencyKey: idempotency_key,
        gatewayReference: reference,
        accountId: account.id,
        type: "debit",
        amount,
        currency,
        balanceAfter: newBalance,
        status: "approved",
      },
    });
    return toDebitResult(row);
  });
}

module.exports = { debitAccount };
