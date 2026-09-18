const prisma = require("../lib/prisma");

// Settles each transaction's blocked (non-rolling) amount back into the
// wallet once its own settlement_date has passed — mirrors how
// processRollingReleases works, just for the settled_amount/settlement_date/
// settled_at trio instead of rolling_amount/rolling_release_at/
// rolling_released_at. Each settled transaction also gets its own row in
// the settlements ledger.
async function processSettlements() {
  const now = new Date();

  const due = await prisma.transaction.findMany({
    where: {
      settledAmount: { gt: 0 },
      settledAt: null,
      settlementDate: { lte: now },
    },
  });

  let settled = 0;

  for (const transaction of due) {
    const amount = Number(transaction.settledAmount);

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
          blockedBalance: { decrement: amount },
          availableBalance: { increment: amount },
        },
      });

      await tx.transaction.update({
        where: { id: transaction.id },
        data: { settledAt: now },
      });

      await tx.settlement.create({
        data: {
          merchantId: transaction.merchantId,
          walletId: wallet.id,
          amount,
          status: "Completed",
          completedAt: now,
        },
      });
    });

    settled += 1;
  }

  return settled;
}

module.exports = processSettlements;
