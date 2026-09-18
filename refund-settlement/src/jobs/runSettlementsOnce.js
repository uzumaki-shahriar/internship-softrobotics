const prisma = require("../lib/prisma");
const processSettlements = require("./processSettlements");

processSettlements()
  .then((transactionsSettled) => {
    console.log(`Settlement check complete. Transactions settled: ${transactionsSettled}`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
