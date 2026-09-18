const processSettlements = require("./processSettlements");
const processRollingReleases = require("./processRollingReleases");

async function runAll() {
  const transactionsSettled = await processSettlements();
  const rollingReleased = await processRollingReleases();

  return { transactionsSettled, rollingReleased };
}

module.exports = { runAll, processSettlements, processRollingReleases };
