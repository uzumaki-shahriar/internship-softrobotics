const prisma = require("../db");
const { generateBankReference } = require("../utils/generators");

function toRefundResult(row) {
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
 * Refunds (credits) the account behind a previous approved charge. Always
 * ties back to the original transaction - a real bank won't credit an
 * account for a charge it never made.
 */
async function refundCard(payload) {
  const { bank_reference, amount, idempotency_key } = payload;

  const existing = await prisma.bankTransaction.findUnique({
    where: { idempotencyKey: idempotency_key },
  });
  if (existing) {
    return toRefundResult(existing);
  }

  return prisma.$transaction(async (tx) => {
    const decline = async (reason, accountId = null, cardId = null, relatedTransactionId = null) => {
      const row = await tx.bankTransaction.create({
        data: {
          bankReference: generateBankReference(),
          idempotencyKey: idempotency_key,
          gatewayReference: bank_reference,
          accountId,
          cardId,
          relatedTransactionId,
          type: "credit",
          amount,
          currency: "N/A",
          status: "declined",
          declineReason: reason,
        },
      });
      return toRefundResult(row);
    };

    const original = await tx.bankTransaction.findUnique({
      where: { bankReference: bank_reference },
      include: { reversals: { where: { status: "approved" } } },
    });
    if (!original) return decline("REFERENCE_NOT_FOUND");
    if (original.type !== "debit" || original.status !== "approved") {
      return decline("ORIGINAL_NOT_APPROVED", original.accountId, original.cardId, original.id);
    }

    const alreadyRefunded = original.reversals.reduce(
      (sum, r) => sum + r.amount.toNumber(),
      0
    );
    if (amount > original.amount.toNumber() - alreadyRefunded) {
      return decline("REFUND_EXCEEDS_CHARGE", original.accountId, original.cardId, original.id);
    }

    const account = await tx.account.findUniqueOrThrow({ where: { id: original.accountId } });
    const newBalance = account.balance.plus(amount);
    await tx.account.update({ where: { id: account.id }, data: { balance: newBalance } });

    const row = await tx.bankTransaction.create({
      data: {
        bankReference: generateBankReference(),
        idempotencyKey: idempotency_key,
        gatewayReference: bank_reference,
        accountId: account.id,
        cardId: original.cardId,
        relatedTransactionId: original.id,
        type: "credit",
        amount,
        currency: original.currency,
        balanceAfter: newBalance,
        status: "approved",
      },
    });
    return toRefundResult(row);
  });
}

module.exports = { refundCard };
