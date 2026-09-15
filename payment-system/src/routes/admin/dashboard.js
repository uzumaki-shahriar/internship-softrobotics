const express = require("express");
const prisma = require("../../db");

const router = express.Router();

router.get("/dashboard", async (req, res, next) => {
  try {
    const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));

    const [merchantCount, pendingCount, todayTx, todayDeclines, wallets] = await Promise.all([
      prisma.merchant.count(),
      prisma.merchant.count({ where: { status: "pending" } }),
      prisma.transaction.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.transaction.count({
        where: { status: "failed", createdAt: { gte: startOfToday } },
      }),
      prisma.wallet.findMany({ include: { currency: true } }),
    ]);

    const balanceByCurrency = {};
    for (const w of wallets) {
      const code = w.currency.code;
      balanceByCurrency[code] = (balanceByCurrency[code] || 0) + Number(w.balance);
    }

    res.render("dashboard", {
      merchantCount,
      pendingCount,
      todayTx,
      todayDeclines,
      balanceByCurrency,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
