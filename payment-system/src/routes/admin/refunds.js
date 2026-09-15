const express = require("express");
const prisma = require("../../db");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const refunds = await prisma.refund.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { transaction: { include: { merchant: true, currency: true } } },
    });
    res.render("refunds/index", { refunds });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
