const prisma = require("../lib/prisma");
const { addRollingPeriod } = require("../lib/dateMath");

// Pending -> Completed. Splits the net amount between the rolling reserve
// (held per-transaction until its rolling period elapses) and the blocked
// balance (held until the merchant's next settlement cycle).
async function processPayments() {
  const pending = await prisma.transaction.findMany({
    where: { transactionState: "Pending" },
  });

  let processed = 0;

  for (const transaction of pending) {
    const config = await prisma.merchantSettlementConfig.findUnique({
      where: { merchantId: transaction.merchantId },
    });

    const rollingPercentage = config ? Number(config.rollingPercentage) : 0;
    const net = Number(transaction.net);
    const rollingAmount = Number(((net * rollingPercentage) / 100).toFixed(2));
    const blockedAmount = Number((net - rollingAmount).toFixed(2));
    const now = new Date();

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
          totalBalance: { increment: net },
          blockedBalance: { increment: blockedAmount },
          rollingBalance: { increment: rollingAmount },
        },
      });

      await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          transactionState: "Completed",
          completedAt: now,
          rollingAmount,
          rollingReleaseAt:
            rollingAmount > 0
              ? addRollingPeriod(now, config.rollingPeriod)
              : null,
        },
      });
    });

    processed += 1;
  }

  return processed;
}

module.exports = processPayments;
