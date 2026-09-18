const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Clears all transactional data (refunds, transactions) and zeroes every
// wallet, without touching merchants/currencies/banks/pricing plans - lets
// you get back to a clean slate for testing without a full docker volume
// wipe + reseed.
async function main() {
  const refunds = await prisma.refund.deleteMany();
  const transactions = await prisma.transaction.deleteMany();

  await prisma.wallet.updateMany({
    data: {
      balance: 0,
      blockedAmount: 0,
      rollingAmount: 0,
    },
  });

  console.log("Reset complete:", {
    refundsDeleted: refunds.count,
    transactionsDeleted: transactions.count,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
