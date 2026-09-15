const express = require("express");
const prisma = require("../../db");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const refunds = await prisma.refund.findMany({
      where: { transaction: { merchantId: req.session.merchantId } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { transaction: { include: { currency: true } } },
    });
    res.render("merchant/refunds/index", { refunds });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
