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

  const feeRatio = gross > 0 ? Number(transaction.feeAmount) / gross : 0;
  const walletDebit = amount - amount * feeRatio;

  // A merchant can withdraw money out of the wallet between the original
  // sale and a later refund - if they've already cashed out more than this
  // refund's net portion, the wallet genuinely doesn't hold enough to cover
  // it. Reject before ever touching the bank, rather than silently zeroing
  // the wallet's buckets and approving a refund the platform can't actually
  // afford (that money already left to the merchant's real bank account).
  const wallet = await prisma.wallet.findUniqueOrThrow({
    where: { merchantId_currencyId: { merchantId: merchant.id, currencyId: transaction.currencyId } },
  });
  const walletTotal = Number(wallet.blockedAmount) + Number(wallet.balance) + Number(wallet.rollingAmount);
  if (walletDebit > walletTotal) {
    throw new ValidationError(
      `Refund needs ${walletDebit.toFixed(2)} from the merchant's wallet, but only ${walletTotal.toFixed(2)} is held - the merchant has likely already withdrawn it to their bank account.`
    );
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

  const [refund, updatedTransaction] = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUniqueOrThrow({
      where: { merchantId_currencyId: { merchantId: merchant.id, currencyId: transaction.currencyId } },
    });

    // Deducted blocked first, then available, then rolling - a refund can
    // land on money that hasn't settled yet, so it never has to wait on a
    // bucket that happens to be empty. See refund-settlement's
    // transactionController.refund() for the same priority order.
    let remaining = walletDebit;
    let blockedAmount = Number(wallet.blockedAmount);
    let balance = Number(wallet.balance);
    let rollingAmount = Number(wallet.rollingAmount);

    const fromBlocked = Math.min(remaining, blockedAmount);
    blockedAmount -= fromBlocked;
    remaining -= fromBlocked;

    const fromBalance = Math.min(remaining, balance);
    balance -= fromBalance;
    remaining -= fromBalance;

    const fromRolling = Math.min(remaining, rollingAmount);
    rollingAmount -= fromRolling;
    remaining -= fromRolling;

    return Promise.all([
      tx.refund.create({
        data: {
          transactionId: transaction.id,
          invoiceId: transaction.invoiceId,
          amount,
          status: "approved",
          bankRefundReference: bankResult.bank_reference,
          idempotencyKey,
        },
      }),
      tx.transaction.update({
        where: { id: transaction.id },
        data: {
          refundedAmount: newRefundedAmount,
          status: isFullyRefunded ? "refunded" : "partial_refunded",
        },
      }),
      tx.wallet.update({
        where: { id: wallet.id },
        data: { blockedAmount, balance, rollingAmount },
      }),
    ]);
  });

  return {
    status: "approved",
    refund_id: refund.id,
    bank_reference: bankResult.bank_reference,
    transaction_status: updatedTransaction.status,
  };
}

module.exports = { refundTransaction };
