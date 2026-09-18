const prisma = require("../db");
const { runAll } = require("./index");

runAll()
  .then((result) => {
    console.log("Jobs run complete:", result);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
