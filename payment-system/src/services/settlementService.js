const prisma = require("../db");
const bankClient = require("../clients/bankClient");

/**
 * Pays out each transaction's blockedAmount once its own settlementDate has
 * arrived - mirrors refund-settlement's processSettlements.js. Runs
 * per-transaction (not a wallet-level lump sum) so each one has its own
 * settledAt audit trail, same as rolling release below.
 */
async function runSettlement(now = new Date()) {
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);

  const due = await prisma.transaction.findMany({
    where: { blockedAmount: { gt: 0 }, settledAt: null, settlementDate: { lte: today } },
    include: { merchant: true, currency: true },
  });

  let settled = 0;

  for (const transaction of due) {
    const amount = Number(transaction.blockedAmount);

    const paidOut = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUniqueOrThrow({
        where: { merchantId_currencyId: { merchantId: transaction.merchantId, currencyId: transaction.currencyId } },
      });

      if (!transaction.merchant.bankAccountNumber) {
        // No account on file - leave it blocked rather than losing track
        // of it; a later run picks it up once one is registered.
        return false;
      }

      const result = await bankClient.payout({
        account_number: transaction.merchant.bankAccountNumber,
        amount,
        currency: transaction.currency.code,
        idempotency_key: `${transaction.invoiceId}:settlement`,
        reference: transaction.invoiceId,
      });

      if (result.status !== "approved") return false;

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { blockedAmount: { decrement: amount } },
      });
      await tx.transaction.update({
        where: { id: transaction.id },
        data: { settledAt: now },
      });
      return true;
    });

    if (paidOut) settled += 1;
  }

  return settled;
}

/**
 * Releases each transaction's rolling reserve once its own rollingReleaseAt
 * has passed - independent of the settlement cycle. Mirrors
 * refund-settlement's processRollingReleases.js, but pays out to the real
 * bank account instead of just moving the amount to an internal balance,
 * since settlement in this app already means "paid out."
 */
async function runRollingRelease(now = new Date()) {
  const due = await prisma.transaction.findMany({
    where: { rollingAmount: { gt: 0 }, rollingReleasedAt: null, rollingReleaseAt: { lte: now } },
    include: { merchant: true, currency: true },
  });

  let released = 0;

  for (const transaction of due) {
    const amount = Number(transaction.rollingAmount);

    const paidOut = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUniqueOrThrow({
        where: { merchantId_currencyId: { merchantId: transaction.merchantId, currencyId: transaction.currencyId } },
      });

      if (!transaction.merchant.bankAccountNumber) return false;

      const result = await bankClient.payout({
        account_number: transaction.merchant.bankAccountNumber,
        amount,
        currency: transaction.currency.code,
        idempotency_key: `${transaction.invoiceId}:rolling-release`,
        reference: transaction.invoiceId,
      });

      if (result.status !== "approved") return false;

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { rollingAmount: { decrement: amount } },
      });
      await tx.transaction.update({
        where: { id: transaction.id },
        data: { rollingReleasedAt: now },
      });
      return true;
    });

    if (paidOut) released += 1;
  }

  return released;
}

module.exports = { runSettlement, runRollingRelease };
