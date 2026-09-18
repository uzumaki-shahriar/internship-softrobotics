const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Clears all transactional data (refunds, settlements, transactions) and
// zeroes every wallet, without touching merchants/currencies/pos/settlement
// config — lets you get back to a clean slate for testing without a full
// docker volume wipe + reseed.
async function main() {
  const refunds = await prisma.refund.deleteMany();
  const settlements = await prisma.settlement.deleteMany();
  const transactions = await prisma.transaction.deleteMany();

  await prisma.wallet.updateMany({
    data: {
      totalBalance: 0,
      availableBalance: 0,
      blockedBalance: 0,
      rollingBalance: 0,
    },
  });

  console.log("Reset complete:", {
    refundsDeleted: refunds.count,
    settlementsDeleted: settlements.count,
    transactionsDeleted: transactions.count,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
