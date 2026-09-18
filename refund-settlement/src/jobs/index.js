const processPayments = require("./processPayments");
const processSettlements = require("./processSettlements");
const processRollingReleases = require("./processRollingReleases");

async function runAll() {
  const paymentsProcessed = await processPayments();
  const transactionsSettled = await processSettlements();
  const rollingReleased = await processRollingReleases();

  return { paymentsProcessed, transactionsSettled, rollingReleased };
}

module.exports = { runAll, processPayments, processSettlements, processRollingReleases };
