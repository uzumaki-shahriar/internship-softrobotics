/**
 * Charge/refund/payout results are always HTTP 200 (a decline is a normal,
 * expected outcome, not an exception) - so the single request log line
 * requestLogger produces needs this to know a decline happened and why,
 * since there's no thrown AppError for errorHandler to annotate it with.
 */
function annotateOutcome(res, result) {
  if (result.status === "declined") {
    res.locals.logLevel = "warn";
    res.locals.logMessage = `[${result.decline_reason}] declined`;
  }
}

module.exports = { annotateOutcome };
