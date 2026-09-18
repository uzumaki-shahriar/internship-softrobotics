function addRollingPeriod(date, period) {
  const result = new Date(date);
  if (period === "Weekly") {
    result.setDate(result.getDate() + 7);
  } else {
    result.setMonth(result.getMonth() + 1);
  }
  return result;
}

const SETTLEMENT_CYCLE_MS = {
  Daily: 24 * 60 * 60 * 1000,
  Weekly: 7 * 24 * 60 * 60 * 1000,
  Monthly: 30 * 24 * 60 * 60 * 1000,
};

function isSettlementDue(config, now) {
  if (!config.lastSettledAt) return true;
  const elapsed = now.getTime() - new Date(config.lastSettledAt).getTime();
  return elapsed >= SETTLEMENT_CYCLE_MS[config.settlementCycle];
}

module.exports = { addRollingPeriod, isSettlementDue };
