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

// GET /merchants/:id/edit
async function showEditForm(req, res) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: Number(req.params.id) },
  });

  if (!merchant) return res.status(404).send("Merchant not found");

  res.render("merchants/edit", { merchant });
}

// POST /merchants/:id/edit
async function update(req, res) {
  const merchantId = Number(req.params.id);
  const { name } = req.body;

  await prisma.merchant.update({
    where: { id: merchantId },
    data: { name },
  });

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

  const config = await prisma.merchantSettlementConfig.findUnique({
    where: { merchantId },
  });

  res.render("merchants/dashboard", {
    merchant,
    wallets,
    recentTransactions,
    transactionCount,
    config,
  });
}

// GET /merchants/:id/wallet
async function showWallet(req, res) {
  const merchantId = Number(req.params.id);

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
  });
  const wallets = await prisma.wallet.findMany({
    where: { merchantId },
    include: { currency: true },
  });

  res.render("wallet", { merchant, wallets });
}

// GET /merchants/:id/settlement-config
async function showSettlementConfig(req, res) {
  const merchantId = Number(req.params.id);

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
  });
  const config = await prisma.merchantSettlementConfig.findUnique({
    where: { merchantId },
  });
  const settlements = await prisma.settlement.findMany({
    where: { merchantId },
    orderBy: { id: "desc" },
  });

  res.render("settlement-config", { merchant, config, settlements });
}

// POST /merchants/:id/settlement-config
async function updateSettlementConfig(req, res) {
  const merchantId = Number(req.params.id);
  const {
    settlement_cycle,
    settlement_time,
    rolling_percentage,
    rolling_period,
  } = req.body;

  await prisma.merchantSettlementConfig.upsert({
    where: { merchantId },
    update: {
      settlementCycle: settlement_cycle,
      settlementTime: settlement_time,
      rollingPercentage: Number(rolling_percentage),
      rollingPeriod: rolling_period,
    },
    create: {
      merchantId,
      settlementCycle: settlement_cycle,
      settlementTime: settlement_time,
      rollingPercentage: Number(rolling_percentage),
      rollingPeriod: rolling_period,
      // Baseline so the first real settlement waits a full cycle instead of
      // firing on the very next cron tick (isSettlementDue treats "never
      // settled" as immediately due).
      lastSettledAt: new Date(),
    },
  });

  res.redirect(`/merchants/${merchantId}/settlement-config`);
}

// POST /merchants/:id/settlements
async function createSettlement(req, res) {
  const merchantId = Number(req.params.id);
  const amount = Number(req.body.amount);

  const wallet = await prisma.wallet.findFirst({ where: { merchantId } });

  if (!wallet) return res.status(404).send("Wallet not found");

  if (amount <= 0 || amount > Number(wallet.availableBalance)) {
    return res.status(400).send("Invalid settlement amount");
  }

  await prisma.settlement.create({
    data: {
      merchantId,
      walletId: wallet.id,
      amount,
      status: "Pending",
    },
  });

  res.redirect(`/merchants/${merchantId}/settlement-config`);
}

module.exports = {
  list,
  showNewForm,
  create,
  showEditForm,
  update,
  dashboard,
  showWallet,
  showSettlementConfig,
  updateSettlementConfig,
  createSettlement,
};
