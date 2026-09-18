const prisma = require("../db");
const { runSettlement, runRollingRelease } = require("../services/settlementService");

async function main() {
  const settled = await runSettlement();
  const released = await runRollingRelease();
  console.log("Settlement run complete:", { settled, released });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
