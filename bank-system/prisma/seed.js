require("dotenv").config();
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const { generateCardNumber, generateCvv, generateAccountNumber } = require("../src/utils/generators");

const prisma = new PrismaClient();

async function upsertAdmin() {
  const email = process.env.ADMIN_EMAIL || "admin@bank.local";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await prisma.admin.upsert({
    where: { email },
    update: {},
    create: { name: "Bank Admin", email, passwordHash },
  });
  console.log(`Admin ready: ${email} / ${password}`);
  return admin;
}

async function ensureAccountWithCard(holderName, { balance, dailyLimit, accountStatus, cardStatus, expired }) {
  const existing = await prisma.account.findFirst({ where: { holderName } });
  if (existing) {
    console.log(`Account for ${holderName} already exists (${existing.accountNumber})`);
    return existing;
  }

  const account = await prisma.account.create({
    data: {
      accountNumber: generateAccountNumber(),
      holderName,
      balance,
      dailyLimit,
      status: accountStatus,
    },
  });

  const now = new Date();
  const expiry = expired
    ? { expiryMonth: 1, expiryYear: now.getFullYear() - 1 }
    : { expiryMonth: 12, expiryYear: now.getFullYear() + 3 };

  const card = await prisma.card.create({
    data: {
      accountId: account.id,
      cardNumber: generateCardNumber(),
      cardHolderName: holderName,
      cvv: generateCvv(),
      status: cardStatus,
      ...expiry,
    },
  });

  console.log(
    `Account ${account.accountNumber} (${holderName}) + card ${card.cardNumber} ` +
      `(cvv ${card.cvv}) - balance ${balance}, limit ${dailyLimit}, account=${accountStatus}, card=${cardStatus}, expired=${!!expired}`
  );
  return account;
}

// A merchant payout account - no card, ever. In real life this is what an
// acquiring bank's admin sets up when a business opens a merchant account:
// just an account that receives settlement deposits, nothing a customer
// pays "from". The Payment Gateway would store this account_number against
// the merchant record and pay into it (see payoutService.js).
async function ensureBusinessAccount(holderName, { balance = 0, dailyLimit = 1000000 } = {}) {
  const existing = await prisma.account.findFirst({ where: { holderName } });
  if (existing) {
    console.log(`Business account for ${holderName} already exists (${existing.accountNumber})`);
    return existing;
  }

  const account = await prisma.account.create({
    data: {
      accountNumber: generateAccountNumber(),
      holderName,
      type: "business",
      balance,
      dailyLimit,
    },
  });

  console.log(`Business account ${account.accountNumber} (${holderName}) - opening balance ${balance}`);
  return account;
}

async function seed() {
  await upsertAdmin();

  // Happy path
  await ensureAccountWithCard("John Doe", {
    balance: 10000,
    dailyLimit: 50000,
    accountStatus: "active",
    cardStatus: "active",
  });

  // Insufficient funds test case
  await ensureAccountWithCard("Jane Smith", {
    balance: 100,
    dailyLimit: 50000,
    accountStatus: "active",
    cardStatus: "active",
  });

  // Limit exceeded test case
  await ensureAccountWithCard("Low Limit Larry", {
    balance: 10000,
    dailyLimit: 200,
    accountStatus: "active",
    cardStatus: "active",
  });

  // Frozen account test case
  await ensureAccountWithCard("Frozen Fred", {
    balance: 10000,
    dailyLimit: 50000,
    accountStatus: "frozen",
    cardStatus: "active",
  });

  // Blocked card test case
  await ensureAccountWithCard("Blocked Bob", {
    balance: 10000,
    dailyLimit: 50000,
    accountStatus: "active",
    cardStatus: "blocked",
  });

  // Expired card test case
  await ensureAccountWithCard("Expired Eve", {
    balance: 10000,
    dailyLimit: 50000,
    accountStatus: "active",
    cardStatus: "active",
    expired: true,
  });

  // Merchant payout account - matches "Merchant One" seeded in the
  // Payment Gateway (payment-system/backend/app/seed.py, store STORE1001).
  await ensureBusinessAccount("Merchant One", { balance: 0, dailyLimit: 1000000 });

  console.log("Seeding complete.");
}

seed()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
