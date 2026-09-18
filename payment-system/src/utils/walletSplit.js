/**
 * Splits a completed transaction's net amount into its rolling reserve and
 * blocked (settlement-eligible) amount, and computes each one's own
 * release date from the merchant's pricing plan - see PricingPlan.
 */
function computeCompletionFields(net, pricingPlan, now = new Date()) {
  const rollingPercentage = Number(pricingPlan.rollingPercentage);
  const rollingAmount = Number(((net * rollingPercentage) / 100).toFixed(2));
  const blockedAmount = Number((net - rollingAmount).toFixed(2));

  const settlementDate = new Date(now);
  settlementDate.setUTCHours(0, 0, 0, 0);
  settlementDate.setUTCDate(settlementDate.getUTCDate() + pricingPlan.settlementDay);

  let rollingReleaseAt = null;
  if (rollingAmount > 0) {
    rollingReleaseAt = new Date(now);
    if (pricingPlan.rollingPeriod === "weekly") {
      rollingReleaseAt.setUTCDate(rollingReleaseAt.getUTCDate() + 7);
    } else {
      rollingReleaseAt.setUTCMonth(rollingReleaseAt.getUTCMonth() + 1);
    }
  }

  return { rollingAmount, blockedAmount, rollingReleaseAt, settlementDate };
}

module.exports = { computeCompletionFields };
