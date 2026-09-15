require("dotenv").config();
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function upsertCurrency(code, name, symbol) {
  const currency = await prisma.currency.upsert({
    where: { code },
    update: {},
    create: { code, name, symbol },
  });
  console.log(`Currency ${code} ready (id=${currency.id})`);
  return currency;
}

async function upsertBank(code, name) {
  const bank = await prisma.bank.upsert({
    where: { code },
    update: {},
    create: { code, name },
  });
  console.log(`Bank ${name} ready (display-only, id=${bank.id})`);
  return bank;
}

async function upsertAdmin() {
  const email = process.env.ADMIN_EMAIL || "admin@gateway.local";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name: "Gateway Admin", email, passwordHash, userType: "admin" },
  });
  console.log(`Admin ready: ${email} / ${password}`);
  return admin;
}

async function seed() {
  await upsertCurrency("BDT", "Taka", "৳");
  await upsertCurrency("USD", "US Dollar", "$");

  // Matches the Bank System instance this Gateway talks to
  // (bank-system/.env's BANK_NAME/BANK_CODE) - display-only reference row.
  await upsertBank("DEMO001", "Demo Bank");

  await upsertAdmin();

  console.log("Seeding complete.");
}

seed()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
