const prisma = require("../lib/prisma");
const { isSettlementDue } = require("../lib/dateMath");

// At each merchant's configured settlement cycle, the entire blocked balance
// (the non-rolling portion of completed transactions) becomes available.
// The rolling portion is untouched here — it is released separately once its
// own rolling period elapses (see processRollingReleases).
async function processSettlements() {
  const configs = await prisma.merchantSettlementConfig.findMany();
  const now = new Date();

  let settledMerchants = 0;

  for (const config of configs) {
    if (!isSettlementDue(config, now)) continue;

    const wallets = await prisma.wallet.findMany({
      where: { merchantId: config.merchantId },
    });

    for (const wallet of wallets) {
      const eligible = Number(wallet.blockedBalance);
      if (eligible <= 0) continue;

      await prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          blockedBalance: { decrement: eligible },
          availableBalance: { increment: eligible },
        },
      });
    }

    await prisma.merchantSettlementConfig.update({
      where: { id: config.id },
      data: { lastSettledAt: now },
    });

    settledMerchants += 1;
  }

  return settledMerchants;
}

module.exports = processSettlements;
