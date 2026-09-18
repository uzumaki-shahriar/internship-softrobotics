const prisma = require("../lib/prisma");
const { runAll } = require("./index");

runAll()
  .then((result) => {
    console.log("Jobs run complete:", result);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
