const express = require("express");
const prisma = require("../../db");
const { NotFoundError } = require("../../errors");
const { refundTransaction } = require("../../services/refundService");

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

async function loadTransaction(invoiceId) {
  const transaction = await prisma.transaction.findUnique({
    where: { invoiceId },
    include: { currency: true, merchant: true, refunds: { orderBy: { createdAt: "desc" } } },
  });
  if (!transaction) throw new NotFoundError("Transaction not found");
  return transaction;
}

router.get("/:invoiceId", async (req, res, next) => {
  try {
    const transaction = await loadTransaction(req.params.invoiceId);
    res.render("transactions/show", { transaction, error: null, values: {} });
  } catch (err) {
    next(err);
  }
});

// Same refund path merchants use (refundService.refundTransaction) - lets
// an admin issue a refund on a merchant's behalf, same as they can already
// suspend/approve on their behalf elsewhere in this panel.
router.post("/:invoiceId/refund", async (req, res, next) => {
  try {
    const transaction = await loadTransaction(req.params.invoiceId);
    const amount = Number(req.body.amount);

    if (!amount || amount <= 0) {
      return res.status(422).render("transactions/show", {
        transaction,
        error: "Enter a refund amount greater than zero.",
        values: req.body,
      });
    }

    const result = await refundTransaction(transaction.merchant, { invoice_id: transaction.invoiceId, amount });
    if (result.status === "declined") {
      req.flash("error", `Refund declined: ${result.decline_reason}`);
    } else {
      req.flash("success", `Refunded ${amount}.`);
    }
    res.redirect(`/admin/transactions/${transaction.invoiceId}`);
  } catch (err) {
    if (err.statusCode === 422) {
      const transaction = await loadTransaction(req.params.invoiceId);
      return res.status(422).render("transactions/show", { transaction, error: err.message, values: req.body });
    }
    next(err);
  }
});

module.exports = router;
