const prisma = require("../lib/prisma");

// GET /dashboard
async function pspDashboard(req, res) {
  const merchantCount = await prisma.merchant.count();
  const transactionCount = await prisma.transaction.count();

  const merchants = await prisma.merchant.findMany({
    include: {
      wallets: { include: { currency: true } },
      _count: { select: { transactions: true } },
    },
    orderBy: { id: "asc" },
  });

  const recentTransactions = await prisma.transaction.findMany({
    include: { merchant: true, currency: true },
    orderBy: { id: "desc" },
    take: 5,
  });

  const totalsByCurrency = {};
  merchants.forEach((merchant) => {
    merchant.wallets.forEach((wallet) => {
      const code = wallet.currency.code;
      if (!totalsByCurrency[code]) totalsByCurrency[code] = 0;
      totalsByCurrency[code] += Number(wallet.totalBalance);
    });
  });

  res.render("dashboard", {
    merchantCount,
    transactionCount,
    merchants,
    recentTransactions,
    totalsByCurrency,
  });
}

module.exports = { pspDashboard };
