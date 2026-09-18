const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const currency = await prisma.currency.upsert({
    where: { code: "BDT" },
    update: {},
    create: { code: "BDT", name: "Bangladeshi Taka" },
  });

  const pos = await prisma.pos.create({
    data: { name: "Default POS" },
  });

  const merchantOne = await prisma.merchant.create({
    data: { name: "ABC Store" },
  });

  const merchantTwo = await prisma.merchant.create({
    data: { name: "XYZ Traders" },
  });

  // 10% of every completed transaction is held back as a rolling reserve and
  // released a month later; the rest becomes available at the next daily
  // settlement cycle. lastSettledAt is set to "now" so the first real
  // settlement waits a full cycle instead of firing on the very next cron
  // tick (a never-settled config is treated as immediately due).
  const now = new Date();
  const rollingPercentage = 10;
  const twoMonthsAgo = new Date(now);
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
  const oneMonthAgo = new Date(now);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  await prisma.merchantSettlementConfig.create({
    data: {
      merchantId: merchantOne.id,
      settlementCycle: "Daily",
      settlementTime: "02:00",
      rollingPercentage,
      rollingPeriod: "Monthly",
      lastSettledAt: now,
    },
  });

  // Historical transactions below completed 2 months ago and their rolling
  // reserve was released a month ago — fully through the rolling/settlement
  // lifecycle already, which is why the wallet below shows them as available.

  // Historical transaction 1: fully completed, no refund, already settled
  await prisma.transaction.create({
    data: {
      merchantId: merchantOne.id,
      currencyId: currency.id,
      posId: pos.id,
      orderId: "ORDER-1001",
      invoiceId: "INV-1001",
      gross: 1000,
      fee: 20,
      net: 980,
      refundedAmount: 0,
      transactionState: "Completed",
      completedAt: twoMonthsAgo,
      rollingAmount: 98,
      rollingReleaseAt: oneMonthAgo,
      rollingReleasedAt: oneMonthAgo,
    },
  });

  // Historical transaction 2: completed, then partially refunded
  await prisma.transaction.create({
    data: {
      merchantId: merchantOne.id,
      currencyId: currency.id,
      posId: pos.id,
      orderId: "ORDER-1002",
      invoiceId: "INV-1002",
      gross: 500,
      fee: 10,
      net: 490,
      refundedAmount: 200,
      transactionState: "PartialRefunded",
      completedAt: twoMonthsAgo,
      rollingAmount: 49,
      rollingReleaseAt: oneMonthAgo,
      rollingReleasedAt: oneMonthAgo,
      refunds: {
        create: {
          amount: 200,
          status: "Completed",
          completedAt: now,
        },
      },
    },
  });

  // Historical transaction 3: completed, then fully refunded
  await prisma.transaction.create({
    data: {
      merchantId: merchantOne.id,
      currencyId: currency.id,
      posId: pos.id,
      orderId: "ORDER-1003",
      invoiceId: "INV-1003",
      gross: 300,
      fee: 6,
      net: 294,
      refundedAmount: 300,
      transactionState: "Refunded",
      completedAt: twoMonthsAgo,
      rollingAmount: 29.4,
      rollingReleaseAt: oneMonthAgo,
      rollingReleasedAt: oneMonthAgo,
      refunds: {
        create: {
          amount: 300,
          status: "Completed",
          completedAt: now,
        },
      },
    },
  });

  // Transaction 4: still Pending — left for the payment cron to pick up, so
  // running `npm run jobs:run` demonstrates the rolling/settlement split live
  // (net 100, 10% rolling => 10 held back, 90 blocked until next settlement).
  await prisma.transaction.create({
    data: {
      merchantId: merchantOne.id,
      currencyId: currency.id,
      posId: pos.id,
      orderId: "ORDER-1004",
      invoiceId: "INV-1004",
      gross: 100,
      fee: 0,
      net: 100,
      transactionState: "Pending",
    },
  });

  // Merchant 1 wallet: the 3 historical transactions above are treated as
  // already fully settled and released (net 980+490+294=1764, refunds
  // 200+300=500 => 1264 sitting entirely in available balance).
  await prisma.wallet.create({
    data: {
      merchantId: merchantOne.id,
      currencyId: currency.id,
      totalBalance: 1264,
      availableBalance: 1264,
      blockedBalance: 0,
      rollingBalance: 0,
    },
  });

  // Merchant 2 has no transactions yet — empty wallet, no settlement config
  await prisma.wallet.create({
    data: {
      merchantId: merchantTwo.id,
      currencyId: currency.id,
    },
  });

  console.log("Seed complete:", {
    merchants: [merchantOne.name, merchantTwo.name],
    currency: currency.code,
    pos: pos.name,
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
