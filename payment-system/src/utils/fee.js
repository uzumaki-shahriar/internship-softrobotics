/**
 * A merchant's flat commission "deal" for a currency - see PricingPlan.
 * Real aggregators quote one rate per merchant regardless of which bank
 * issued the card (see CLAUDE.md's "per-merchant deal" decision).
 */
function calculateFee(gross, pricingPlan) {
  const commission = (gross * Number(pricingPlan.commissionPercentage)) / 100;
  const fee = commission + Number(pricingPlan.commissionFixed);
  const net = gross - fee;
  return { fee, net };
}

module.exports = { calculateFee };
