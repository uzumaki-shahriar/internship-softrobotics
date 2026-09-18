function addRollingPeriod(date, period) {
  const result = new Date(date);
  if (period === "Weekly") {
    result.setDate(result.getDate() + 7);
  } else {
    result.setMonth(result.getMonth() + 1);
  }
  return result;
}

// Settlement runs on calendar date, not time-of-day: a transaction's
// settlement_date (set at completion) is the first day after that date
// completing a full cycle, regardless of what time it actually completed.
// Day boundaries are computed in UTC (not the host's local timezone) so the
// result is the same whether this runs on a developer's machine or inside
// the (UTC) Docker container.
function addSettlementCycle(date, cycle) {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  if (cycle === "Daily") {
    result.setUTCDate(result.getUTCDate() + 1);
  } else if (cycle === "Weekly") {
    result.setUTCDate(result.getUTCDate() + 7);
  } else {
    result.setUTCMonth(result.getUTCMonth() + 1);
  }
  return result;
}

module.exports = { addRollingPeriod, addSettlementCycle };
