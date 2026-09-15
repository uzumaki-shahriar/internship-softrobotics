const express = require("express");
const { paySchema } = require("../validators/pay.schema");
const { findTransaction, expireIfNeeded, payForSession } = require("../services/checkoutService");

const router = express.Router();

router.get("/:invoiceId", async (req, res, next) => {
  try {
    let transaction = await findTransaction(req.params.invoiceId);
    transaction = await expireIfNeeded(transaction);

    if (transaction.status !== "pending") {
      return res.render("checkout/closed", { transaction });
    }

    res.render("checkout/pay", {
      transaction,
      error: null,
      values: {},
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:invoiceId/pay", async (req, res, next) => {
  try {
    const transaction = await findTransaction(req.params.invoiceId);

    if (transaction.status !== "pending") {
      return res.render("checkout/closed", { transaction: await expireIfNeeded(transaction) });
    }

    const parsed = paySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).render("checkout/pay", {
        transaction,
        error: parsed.error.issues[0].message,
        values: req.body,
      });
    }

    const result = await payForSession(req.params.invoiceId, parsed.data);
    if (result.declineReason) {
      res.locals.logLevel = "warn";
      res.locals.logMessage = `[${result.declineReason}] ${result.status}`;
    }
    res.redirect(result.redirectUrl);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
