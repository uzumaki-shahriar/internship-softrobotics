const express = require("express");
const prisma = require("../../db");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const statusFilter = ["approved", "declined"].includes(req.query.status)
      ? req.query.status
      : undefined;
    const transactions = await prisma.bankTransaction.findMany({
      where: statusFilter ? { status: statusFilter } : undefined,
      include: { account: true, card: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.render("transactions/index", { transactions, statusFilter: statusFilter || "" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
