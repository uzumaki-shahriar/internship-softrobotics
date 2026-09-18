const express = require("express");
const prisma = require("../../db");
const { getMerchantProfile } = require("../../services/merchantService");
const { getWallets, withdraw } = require("../../services/walletService");

const router = express.Router();

async function loadOverview(merchantId) {
  const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));

  const [merchant, wallets, todayCount, recentTransactions] = await Promise.all([
    getMerchantProfile(merchantId),
    getWallets(merchantId),
    prisma.transaction.count({ where: { merchantId, createdAt: { gte: startOfToday } } }),
    prisma.transaction.findMany({
      where: { merchantId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { currency: true },
    }),
  ]);

  return { merchant, wallets, todayCount, recentTransactions };
}

router.get("/overview", async (req, res, next) => {
  try {
    const data = await loadOverview(req.session.merchantId);
    res.render("merchant/overview", { ...data, withdrawError: null });
  } catch (err) {
    next(err);
  }
});

router.post("/overview/withdraw", async (req, res, next) => {
  try {
    const currency = req.body.currency;
    const amount = Number(req.body.amount);

    const result = await withdraw(req.session.merchantId, currency, amount);
    if (result.status === "declined") {
      req.flash("error", `Withdrawal declined: ${result.decline_reason}`);
    } else {
      req.flash("success", `Withdrew ${amount} ${currency}.`);
    }
    res.redirect("/dashboard/overview");
  } catch (err) {
    if (err.statusCode === 422) {
      const data = await loadOverview(req.session.merchantId);
      return res.status(422).render("merchant/overview", { ...data, withdrawError: err.message });
    }
    next(err);
  }
});

module.exports = router;
