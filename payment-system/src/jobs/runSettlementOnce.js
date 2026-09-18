const prisma = require("../db");
const { runSettlement } = require("../services/settlementService");

runSettlement()
  .then((settled) => {
    console.log(`Settlement check complete. Transactions settled: ${settled}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
