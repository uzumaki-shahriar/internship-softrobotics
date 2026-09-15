const prisma = require("../db");
const logger = require("../logger");
const config = require("../config");
const { generateBankReference } = require("../utils/generators");

function toPayoutResult(row) {
  if (row.status === "approved") {
    return {
      status: "approved",
      bank_reference: row.bankReference,
      balance_after: row.balanceAfter.toNumber(),
    };
  }
  return { status: "declined", decline_reason: row.declineReason };
}

/**
 * Deposits money into an account with no card and no link to a prior
 * charge - this is how a merchant's payout account actually receives
 * settlement money from the Payment Gateway. Distinct from refundCard,
 * which always reverses a specific previous charge.
 */
async function payoutToAccount(payload) {
  const { account_number, amount, currency, idempotency_key, reference } = payload;

  const existing = await prisma.bankTransaction.findUnique({
    where: { idempotencyKey: idempotency_key },
  });
  if (existing) {
    logger.info({ idempotency_key, reference }, "Idempotent replay of payout request");
    return toPayoutResult(existing);
  }

  return prisma.$transaction(async (tx) => {
    const decline = async (reason, accountId = null) => {
      const row = await tx.bankTransaction.create({
        data: {
          bankReference: generateBankReference(),
          idempotencyKey: idempotency_key,
          gatewayReference: reference,
          accountId,
          type: "credit",
          amount,
          currency,
          status: "declined",
          declineReason: reason,
        },
      });
      logger.warn({ reason, reference }, "Payout declined");
      return toPayoutResult(row);
    };

    if (currency !== config.currency) {
      return decline("CURRENCY_NOT_SUPPORTED");
    }

    const account = await tx.account.findUnique({ where: { accountNumber: account_number } });
    if (!account) return decline("ACCOUNT_NOT_FOUND");
    if (account.status === "frozen") return decline("ACCOUNT_FROZEN", account.id);
    if (account.status === "closed") return decline("ACCOUNT_CLOSED", account.id);

    const newBalance = account.balance.plus(amount);
    await tx.account.update({ where: { id: account.id }, data: { balance: newBalance } });

    const row = await tx.bankTransaction.create({
      data: {
        bankReference: generateBankReference(),
        idempotencyKey: idempotency_key,
        gatewayReference: reference,
        accountId: account.id,
        type: "credit",
        amount,
        currency,
        balanceAfter: newBalance,
        status: "approved",
      },
    });
    logger.info({ reference, accountId: account.id }, "Payout approved");
    return toPayoutResult(row);
  });
}

module.exports = { payoutToAccount };
