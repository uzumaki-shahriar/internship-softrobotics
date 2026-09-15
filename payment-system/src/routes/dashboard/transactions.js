const express = require("express");
const { listTransactions, getTransactionDetail } = require("../../services/walletService");
const { refundTransaction } = require("../../services/refundService");
const { getMerchantProfile } = require("../../services/merchantService");

const router = express.Router();

const STATUSES = ["pending", "completed", "failed", "expired", "refunded", "partial_refunded"];

router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const statusFilter = STATUSES.includes(req.query.status) ? req.query.status : "";
    const result = await listTransactions(req.session.merchantId, {
      page,
      pageSize: 20,
      status: statusFilter || undefined,
    });
    res.render("merchant/transactions/index", {
      transactions: result.items,
      page: result.page,
      pages: result.pages,
      statusFilter,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:invoiceId", async (req, res, next) => {
  try {
    const transaction = await getTransactionDetail(req.session.merchantId, req.params.invoiceId);
    res.render("merchant/transactions/show", { transaction, error: null, values: {} });
  } catch (err) {
    next(err);
  }
});

router.post("/:invoiceId/refund", async (req, res, next) => {
  try {
    const merchant = await getMerchantProfile(req.session.merchantId);
    const amount = Number(req.body.amount);

    if (!amount || amount <= 0) {
      const transaction = await getTransactionDetail(req.session.merchantId, req.params.invoiceId);
      return res.status(422).render("merchant/transactions/show", {
        transaction,
        error: "Enter a refund amount greater than zero.",
        values: req.body,
      });
    }

    const result = await refundTransaction(merchant, { invoice_id: req.params.invoiceId, amount });
    if (result.status === "declined") {
      req.flash("error", `Refund declined: ${result.decline_reason}`);
    } else {
      req.flash("success", `Refunded ${amount}.`);
    }
    res.redirect(`/dashboard/transactions/${req.params.invoiceId}`);
  } catch (err) {
    if (err.statusCode === 422) {
      const transaction = await getTransactionDetail(req.session.merchantId, req.params.invoiceId);
      return res.status(422).render("merchant/transactions/show", {
        transaction,
        error: err.message,
        values: req.body,
      });
    }
    next(err);
  }
});

module.exports = router;
