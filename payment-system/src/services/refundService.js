const prisma = require("../db");
const bankClient = require("../clients/bankClient");
const { ValidationError, NotFoundError } = require("../errors");

const REFUNDABLE_STATUSES = ["completed", "partial_refunded"];

/**
 * Refunds part or all of a completed sale. Ties back to the Bank System's
 * own charge via bank_reference - a real bank won't credit money for a
 * charge it never made, so neither does the simulation here.
 *
 * The merchant's wallet is only debited the *net* portion of the refund,
 * not the full amount - a processor's commission is not refunded when a
 * sale is reversed (this is standard real-world practice, e.g. Stripe does
 * not return its processing fee on a refund), so the fee portion of the
 * original sale stays "spent" even though the sale itself was undone.
 */
async function refundTransaction(merchant, { invoice_id, amount }) {
  const transaction = await prisma.transaction.findUnique({
    where: { invoiceId: invoice_id },
    include: { currency: true },
  });
  if (!transaction || transaction.merchantId !== merchant.id) {
    throw new NotFoundError("Transaction not found");
  }
  if (!REFUNDABLE_STATUSES.includes(transaction.status)) {
    throw new ValidationError(`Cannot refund a transaction with status "${transaction.status}"`);
  }

  const gross = Number(transaction.grossAmount);
  const alreadyRefunded = Number(transaction.refundedAmount);
  const remaining = gross - alreadyRefunded;
  if (amount > remaining) {
    throw new ValidationError(`Refund amount exceeds the refundable balance (${remaining})`);
  }

  const refundCount = await prisma.refund.count({ where: { transactionId: transaction.id } });
  const idempotencyKey = `${transaction.invoiceId}:refund:${refundCount + 1}`;

  const bankResult = await bankClient.refund({
    bank_reference: transaction.bankReference,
    amount,
    idempotency_key: idempotencyKey,
  });

  if (bankResult.status !== "approved") {
    await prisma.refund.create({
      data: {
        transactionId: transaction.id,
        invoiceId: transaction.invoiceId,
        amount,
        status: "declined",
        declineReason: bankResult.decline_reason,
        idempotencyKey,
      },
    });
    return { status: "declined", decline_reason: bankResult.decline_reason };
  }

  const feeRatio = gross > 0 ? Number(transaction.feeAmount) / gross : 0;
  const walletDebit = amount - amount * feeRatio;
  const newRefundedAmount = alreadyRefunded + amount;
  const isFullyRefunded = newRefundedAmount >= gross;

  const [refund, updatedTransaction] = await prisma.$transaction([
    prisma.refund.create({
      data: {
        transactionId: transaction.id,
        invoiceId: transaction.invoiceId,
        amount,
        status: "approved",
        bankRefundReference: bankResult.bank_reference,
        idempotencyKey,
      },
    }),
    prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        refundedAmount: newRefundedAmount,
        status: isFullyRefunded ? "refunded" : "partial_refunded",
      },
    }),
    prisma.wallet.update({
      where: { merchantId_currencyId: { merchantId: merchant.id, currencyId: transaction.currencyId } },
      data: { balance: { decrement: walletDebit } },
    }),
  ]);

  return {
    status: "approved",
    refund_id: refund.id,
    bank_reference: bankResult.bank_reference,
    transaction_status: updatedTransaction.status,
  };
}

module.exports = { refundTransaction };
