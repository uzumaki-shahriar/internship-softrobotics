const express = require("express");
const apiKeyAuth = require("../../middleware/apiKeyAuth");
const { findTransaction, expireIfNeeded } = require("../../services/checkoutService");
const { NotFoundError } = require("../../errors");

const router = express.Router();

// The merchant's server calls this to confirm what actually happened -
// never trust the customer's browser redirect alone (a URL like
// /success?invoice_id=... can be hit manually without ever paying).
router.get("/:invoiceId/verify", apiKeyAuth, async (req, res, next) => {
  try {
    let transaction = await findTransaction(req.params.invoiceId);
    if (transaction.merchantId !== req.merchant.id) {
      // Same response as "doesn't exist" - never confirm to one merchant
      // that another merchant's invoice_id exists.
      throw new NotFoundError("Checkout session not found");
    }
    transaction = await expireIfNeeded(transaction);

    res.json({
      invoice_id: transaction.invoiceId,
      order_id: transaction.orderId,
      status: transaction.status,
      gross_amount: transaction.grossAmount,
      fee_amount: transaction.feeAmount,
      net_amount: transaction.netAmount,
      currency: transaction.currency.code,
      decline_reason: transaction.declineReason,
      bank_reference: transaction.bankReference,
      created_at: transaction.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
