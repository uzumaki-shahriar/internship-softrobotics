const prisma = require("../lib/prisma");

// Releases each transaction's rolling reserve back into the wallet once its
// own rolling period has elapsed, independent of the settlement cycle.
async function processRollingReleases() {
  const now = new Date();

  const matured = await prisma.transaction.findMany({
    where: {
      rollingAmount: { gt: 0 },
      rollingReleasedAt: null,
      rollingReleaseAt: { lte: now },
    },
  });

  let released = 0;

  for (const transaction of matured) {
    const amount = Number(transaction.rollingAmount);

    await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: {
          merchantId_currencyId: {
            merchantId: transaction.merchantId,
            currencyId: transaction.currencyId,
          },
        },
      });

      if (!wallet) return;

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          rollingBalance: { decrement: amount },
          availableBalance: { increment: amount },
        },
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

module.exports = processRollingReleases;
