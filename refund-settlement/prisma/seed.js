const { PrismaClient } = require("@prisma/client");
const { addRollingPeriod, addSettlementCycle } = require("../src/lib/dateMath");
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

  // 10% of every completed transaction is held back as a rolling reserve and
  // released a month later; the rest (settledAmount) becomes available at
  // the merchant's next daily settlement cycle.
  const now = new Date();
  const twoMonthsAgo = new Date(now);
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
  const oneMonthAgo = new Date(now);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const dayAfterTwoMonthsAgo = new Date(twoMonthsAgo);
  dayAfterTwoMonthsAgo.setDate(dayAfterTwoMonthsAgo.getDate() + 1);

  const merchantOne = await prisma.merchant.create({
    data: {
      name: "ABC Store",
      settlementCycle: "Daily",
      rollingPercentage: 10,
      rollingPeriod: "Monthly",
    },
  });

  // No custom settlement/rolling config — keeps the schema defaults
  // (Daily cycle, 0% rolling), shown as the "just onboarded" state.
  const merchantTwo = await prisma.merchant.create({
    data: { name: "XYZ Traders" },
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
      settledAmount: 882,
      settlementDate: dayAfterTwoMonthsAgo,
      settledAt: dayAfterTwoMonthsAgo,
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
      settledAmount: 441,
      settlementDate: dayAfterTwoMonthsAgo,
      settledAt: dayAfterTwoMonthsAgo,
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
      settledAmount: 264.6,
      settlementDate: dayAfterTwoMonthsAgo,
      settledAt: dayAfterTwoMonthsAgo,
      refunds: {
        create: {
          amount: 300,
          status: "Completed",
          completedAt: now,
        },
      },
    },
  });

  // Transaction 4: just completed (net 100, 10% rolling), so its blocked
  // and rolling amounts are still fresh — shows the "just happened" state
  // next to the 3 already-settled historical ones above.
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
      transactionState: "Completed",
      completedAt: now,
      rollingAmount: 10,
      rollingReleaseAt: addRollingPeriod(now, "Monthly"),
      settledAmount: 90,
      settlementDate: addSettlementCycle(now, "Daily"),
    },
  });

  // Merchant 1 wallet: the 3 historical transactions are fully settled and
  // released (net 980+490+294=1764, refunds 200+300=500 => 1264 available),
  // plus transaction 4 just above, still blocked (90) and rolling (10).
  await prisma.wallet.create({
    data: {
      merchantId: merchantOne.id,
      currencyId: currency.id,
      totalBalance: 1364,
      availableBalance: 1264,
      blockedBalance: 90,
      rollingBalance: 10,
    },
  });

  // Merchant 2 has no transactions yet — empty wallet, default settings
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
