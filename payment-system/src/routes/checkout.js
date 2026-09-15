const express = require("express");
const { paySchema } = require("../validators/pay.schema");
const {
  findTransaction,
  expireIfNeeded,
  prepareAttempt,
  cancelSession,
  payForSession,
} = require("../services/checkoutService");
const bankClient = require("../clients/bankClient");
const config = require("../config");

const router = express.Router();

async function loadTestCards() {
  if (!config.showTestCardHelper) return [];
  return bankClient.getTestCards();
}

function attemptsRemainingFor(transaction) {
  return config.maxPaymentAttempts - transaction.attemptCount;
}

router.get("/:invoiceId", async (req, res, next) => {
  try {
    let transaction = await findTransaction(req.params.invoiceId);
    transaction = await expireIfNeeded(transaction);

    if (transaction.status !== "pending") {
      return res.render("checkout/closed", { transaction });
    }

    transaction = await prepareAttempt(transaction);
    res.render("checkout/pay", {
      transaction,
      error: null,
      values: {},
      attemptsRemaining: attemptsRemainingFor(transaction),
      testCards: await loadTestCards(),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:invoiceId/pay", async (req, res, next) => {
  try {
    let transaction = await findTransaction(req.params.invoiceId);

    if (transaction.status !== "pending") {
      return res.render("checkout/closed", { transaction: await expireIfNeeded(transaction) });
    }

    const parsed = paySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).render("checkout/pay", {
        transaction,
        error: parsed.error.issues[0].message,
        values: req.body,
        attemptsRemaining: attemptsRemainingFor(transaction),
        testCards: await loadTestCards(),
      });
    }

    const result = await payForSession(req.params.invoiceId, parsed.data, parsed.data.attempt_token);

    if (!result.terminal) {
      // Declined but retries remain (or a stale form was resubmitted) - stay
      // on the same checkout page with a fresh attempt token instead of
      // bouncing the customer back to the merchant to restart the order.
      res.locals.logLevel = "warn";
      res.locals.logMessage = `[${result.declineReason || "STALE_FORM"}] retry (${result.attemptsRemaining ?? attemptsRemainingFor(result.transaction)} left)`;
      return res.status(422).render("checkout/pay", {
        transaction: result.transaction,
        error: result.formError || `Payment declined: ${result.declineReason}. You can try a different card.`,
        values: {},
        attemptsRemaining: attemptsRemainingFor(result.transaction),
        testCards: await loadTestCards(),
      });
    }

    if (result.declineReason) {
      res.locals.logLevel = "warn";
      res.locals.logMessage = `[${result.declineReason}] ${result.status}`;
    }
    res.redirect(result.redirectUrl);
  } catch (err) {
    next(err);
  }
});

router.post("/:invoiceId/cancel", async (req, res, next) => {
  try {
    const result = await cancelSession(req.params.invoiceId);
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
