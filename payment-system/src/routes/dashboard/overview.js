const express = require("express");
const prisma = require("../../db");
const { getMerchantProfile } = require("../../services/merchantService");
const { getWallets } = require("../../services/walletService");

const router = express.Router();

router.get("/overview", async (req, res, next) => {
  try {
    const merchantId = req.session.merchantId;
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

    res.render("merchant/overview", { merchant, wallets, todayCount, recentTransactions });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
