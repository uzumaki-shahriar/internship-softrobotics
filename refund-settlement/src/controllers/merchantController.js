const prisma = require("../lib/prisma");

// GET /merchants
async function list(req, res) {
  const merchants = await prisma.merchant.findMany({
    include: {
      wallets: { include: { currency: true } },
      _count: { select: { transactions: true } },
    },
    orderBy: { id: "asc" },
  });

  res.render("merchants/index", { merchants });
}

// GET /merchants/new
async function showNewForm(req, res) {
  res.render("merchants/new");
}

// POST /merchants
async function create(req, res) {
  const { name } = req.body;

  const merchant = await prisma.merchant.create({ data: { name } });

  const currency = await prisma.currency.findFirst();
  if (currency) {
    await prisma.wallet.create({
      data: { merchantId: merchant.id, currencyId: currency.id },
    });
  }

  res.redirect("/merchants");
}

// GET /merchants/:id/dashboard
async function dashboard(req, res) {
  const merchantId = Number(req.params.id);

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
  });

  if (!merchant) return res.status(404).send("Merchant not found");

  const wallets = await prisma.wallet.findMany({
    where: { merchantId },
    include: { currency: true },
  });

  const recentTransactions = await prisma.transaction.findMany({
    where: { merchantId },
    include: { currency: true },
    orderBy: { id: "desc" },
    take: 5,
  });

  const transactionCount = await prisma.transaction.count({
    where: { merchantId },
  });

  res.render("merchants/dashboard", {
    merchant,
    wallets,
    recentTransactions,
    transactionCount,
  });
}

// GET /merchants/:id/settlement-config
async function showSettlementConfig(req, res) {
  const merchantId = Number(req.params.id);

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
  });

  if (!merchant) return res.status(404).send("Merchant not found");

  const settlements = await prisma.settlement.findMany({
    where: { merchantId },
    orderBy: { id: "desc" },
  });

  res.render("settlement-config", { merchant, settlements });
}

// POST /merchants/:id/settlement-config
async function updateSettlementConfig(req, res) {
  const merchantId = Number(req.params.id);
  const { name, settlement_cycle, rolling_percentage, rolling_period } =
    req.body;

  await prisma.merchant.update({
    where: { id: merchantId },
    data: {
      name,
      settlementCycle: settlement_cycle,
      rollingPercentage: Number(rolling_percentage),
      rollingPeriod: rolling_period,
    },
  });

  res.redirect(`/merchants/${merchantId}/settlement-config`);
}

// POST /merchants/:id/settlements
// Direct payout request: submitting immediately debits the wallet and marks
// the settlement Completed — no pending/approval step (real bank payout is
// out of scope for this demo; this just represents the money leaving the
// platform).
async function createSettlement(req, res) {
  const merchantId = Number(req.params.id);
  const amount = Number(req.body.amount);

  const wallet = await prisma.wallet.findFirst({ where: { merchantId } });

  if (!wallet) return res.status(404).send("Wallet not found");

  if (amount <= 0 || amount > Number(wallet.availableBalance)) {
    return res.status(400).send("Invalid settlement amount");
  }

  await prisma.$transaction([
    prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        availableBalance: { decrement: amount },
        totalBalance: { decrement: amount },
      },
    }),
    prisma.settlement.create({
      data: {
        merchantId,
        walletId: wallet.id,
        amount,
        status: "Completed",
        completedAt: new Date(),
      },
    }),
  ]);

  res.redirect(`/merchants/${merchantId}/settlement-config`);
}

module.exports = {
  list,
  showNewForm,
  create,
  dashboard,
  showSettlementConfig,
  updateSettlementConfig,
  createSettlement,
};
