const express = require("express");
const prisma = require("../../db");
const config = require("../../config");

const router = express.Router();

router.get("/dashboard", async (req, res, next) => {
  try {
    const [accountCount, cardCount, totalBalance, todayTx, todayDeclines] = await Promise.all([
      prisma.account.count(),
      prisma.card.count(),
      prisma.account.aggregate({ _sum: { balance: true } }),
      prisma.bankTransaction.count({
        where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
      prisma.bankTransaction.count({
        where: {
          status: "declined",
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ]);

    res.render("dashboard", {
      bankName: config.bankName,
      bankCode: config.bankCode,
      currency: config.currency,
      accountCount,
      cardCount,
      totalBalance: (totalBalance._sum.balance || 0).toString(),
      todayTx,
      todayDeclines,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
