const processPayments = require("./processPayments");
const processSettlements = require("./processSettlements");
const processRollingReleases = require("./processRollingReleases");

async function runAll() {
  const paymentsProcessed = await processPayments();
  const merchantsSettled = await processSettlements();
  const rollingReleased = await processRollingReleases();

  return { paymentsProcessed, merchantsSettled, rollingReleased };
}

module.exports = { runAll, processPayments, processSettlements, processRollingReleases };
