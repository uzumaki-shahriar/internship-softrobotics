const express = require("express");
const prisma = require("../../db");
const { resolvePendingRefund } = require("../../services/refundService");

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

router.post("/:id/resolve", async (req, res, next) => {
  try {
    const result = await resolvePendingRefund(Number(req.params.id));
    if (result.resolved) {
      req.flash("success", `Refund #${req.params.id} settled against the merchant's wallet.`);
    } else {
      req.flash(
        "error",
        `Still not enough in the merchant's wallet (has ${Number(result.walletTotal).toFixed(2)}) - try again later.`
      );
    }
    res.redirect("/admin/refunds");
  } catch (err) {
    next(err);
  }
});

module.exports = router;
