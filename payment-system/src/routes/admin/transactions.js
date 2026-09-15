const express = require("express");
const prisma = require("../../db");

const router = express.Router();

const STATUSES = ["pending", "completed", "failed", "expired", "refunded", "partial_refunded"];

router.get("/", async (req, res, next) => {
  try {
    const statusFilter = STATUSES.includes(req.query.status) ? req.query.status : undefined;
    const transactions = await prisma.transaction.findMany({
      where: statusFilter ? { status: statusFilter } : undefined,
      include: { currency: true, merchant: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.render("transactions/index", { transactions, statusFilter: statusFilter || "" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
