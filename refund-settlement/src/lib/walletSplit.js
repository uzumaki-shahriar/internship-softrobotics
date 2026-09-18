const { addRollingPeriod, addSettlementCycle } = require("./dateMath");

// Splits a completed transaction's net amount into its rolling reserve and
// settled (non-rolling) amount, and computes each one's own release/
// settlement date from the merchant's configuration.
function computeCompletionFields(net, merchant, now) {
  const rollingPercentage = Number(merchant.rollingPercentage);
  const rollingAmount = Number(((net * rollingPercentage) / 100).toFixed(2));
  const settledAmount = Number((net - rollingAmount).toFixed(2));

  return {
    rollingAmount,
    settledAmount,
    rollingReleaseAt:
      rollingAmount > 0 ? addRollingPeriod(now, merchant.rollingPeriod) : null,
    settlementDate:
      settledAmount > 0
        ? addSettlementCycle(now, merchant.settlementCycle)
        : null,
  };
}

module.exports = { computeCompletionFields };
