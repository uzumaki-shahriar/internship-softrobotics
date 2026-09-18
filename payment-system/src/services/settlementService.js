const prisma = require("../db");

/**
 * Moves each transaction's blockedAmount into the wallet's available balance
 * once its own settlementDate has arrived - mirrors refund-settlement's
 * processSettlements.js. This does NOT pay out to the bank; it only makes
 * the money available. Actually sending it to the merchant's bank account
 * is a separate, merchant-initiated action - see walletService.withdraw.
 */
async function runSettlement(now = new Date()) {
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);

  const due = await prisma.transaction.findMany({
    where: { blockedAmount: { gt: 0 }, settledAt: null, settlementDate: { lte: today } },
  });

  let settled = 0;

  for (const transaction of due) {
    const amount = Number(transaction.blockedAmount);

    await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUniqueOrThrow({
        where: { merchantId_currencyId: { merchantId: transaction.merchantId, currencyId: transaction.currencyId } },
      });

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { blockedAmount: { decrement: amount }, balance: { increment: amount } },
      });
      await tx.transaction.update({
        where: { id: transaction.id },
        data: { settledAt: now },
      });
    });

    settled += 1;
  }

  return settled;
}

/**
 * Releases each transaction's rolling reserve into the wallet's available
 * balance once its own rollingReleaseAt has passed - independent of the
 * settlement cycle. Mirrors refund-settlement's processRollingReleases.js.
 * Also does not pay out to the bank - see walletService.withdraw.
 */
async function runRollingRelease(now = new Date()) {
  const due = await prisma.transaction.findMany({
    where: { rollingAmount: { gt: 0 }, rollingReleasedAt: null, rollingReleaseAt: { lte: now } },
  });

  let released = 0;

  for (const transaction of due) {
    const amount = Number(transaction.rollingAmount);

    await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUniqueOrThrow({
        where: { merchantId_currencyId: { merchantId: transaction.merchantId, currencyId: transaction.currencyId } },
      });

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { rollingAmount: { decrement: amount }, balance: { increment: amount } },
      });
      await tx.transaction.update({
        where: { id: transaction.id },
        data: { rollingReleasedAt: now },
      });
    });

    released += 1;
  }

  return released;
}

module.exports = { runSettlement, runRollingRelease };
