const prisma = require("../db");
const bankClient = require("../clients/bankClient");
const { ValidationError, NotFoundError } = require("../errors");

const REFUNDABLE_STATUSES = ["completed", "partial_refunded"];

// Deducted blocked first, then available, then rolling - a refund can land
// on money that hasn't settled yet, so it never has to wait on a bucket
// that happens to be empty. Caller must already have confirmed
// blockedAmount + balance + rollingAmount >= debit before calling this.
function applyWalletDebit(wallet, debit) {
  let remaining = debit;
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

  return { blockedAmount, balance, rollingAmount };
}

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
 *
 * The bank-side reversal happens regardless of the merchant's current
 * wallet balance (a merchant can withdraw funds between the original sale
 * and a later refund). If the wallet doesn't currently hold enough to
 * cover the net portion, the refund is still recorded - customer-facing,
 * it's already done - but as "pending" rather than "approved", with
 * nothing deducted yet. See resolvePendingRefund for how that gets
 * settled once the merchant's wallet has enough again.
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

  const newRefundedAmount = alreadyRefunded + amount;
  const isFullyRefunded = newRefundedAmount >= gross;
  const now = new Date();

  const [refund, updatedTransaction] = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUniqueOrThrow({
      where: { merchantId_currencyId: { merchantId: merchant.id, currencyId: transaction.currencyId } },
    });
    const walletTotal = Number(wallet.blockedAmount) + Number(wallet.balance) + Number(wallet.rollingAmount);
    const canSettleNow = walletDebit <= walletTotal;

    const writes = [
      tx.refund.create({
        data: {
          transactionId: transaction.id,
          invoiceId: transaction.invoiceId,
          amount,
          status: canSettleNow ? "approved" : "pending",
          bankRefundReference: bankResult.bank_reference,
          idempotencyKey,
          walletDebit,
          walletSettledAt: canSettleNow ? now : null,
        },
      }),
      tx.transaction.update({
        where: { id: transaction.id },
        data: {
          refundedAmount: newRefundedAmount,
          status: isFullyRefunded ? "refunded" : "partial_refunded",
        },
      }),
    ];

    if (canSettleNow) {
      writes.push(
        tx.wallet.update({
          where: { id: wallet.id },
          data: applyWalletDebit(wallet, walletDebit),
        })
      );
    }

    const [refund, updatedTransaction] = await Promise.all(writes);
    return [refund, updatedTransaction];
  });

  return {
    status: refund.status === "pending" ? "pending" : "approved",
    refund_id: refund.id,
    bank_reference: bankResult.bank_reference,
    transaction_status: updatedTransaction.status,
  };
}

/**
 * Applies a "pending" refund's wallet_debit now that the merchant's wallet
 * may hold enough to cover it (e.g. a later sale settled more funds in).
 * Admin-triggered - see admin/refunds.js. Leaves it pending (no change) if
 * the wallet still doesn't have enough.
 */
async function resolvePendingRefund(refundId) {
  const refund = await prisma.refund.findUnique({
    where: { id: refundId },
    include: { transaction: true },
  });
  if (!refund) throw new NotFoundError("Refund not found");
  if (refund.status !== "pending") {
    throw new ValidationError(`Refund is not pending (status: ${refund.status})`);
  }

  const walletDebit = Number(refund.walletDebit);

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUniqueOrThrow({
      where: {
        merchantId_currencyId: { merchantId: refund.transaction.merchantId, currencyId: refund.transaction.currencyId },
      },
    });
    const walletTotal = Number(wallet.blockedAmount) + Number(wallet.balance) + Number(wallet.rollingAmount);
    if (walletDebit > walletTotal) {
      return { resolved: false, walletTotal };
    }

    const now = new Date();
    await tx.wallet.update({ where: { id: wallet.id }, data: applyWalletDebit(wallet, walletDebit) });
    await tx.refund.update({ where: { id: refund.id }, data: { status: "approved", walletSettledAt: now } });
    return { resolved: true };
  });
}

module.exports = { refundTransaction, resolvePendingRefund };
