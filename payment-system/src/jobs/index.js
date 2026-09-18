const { runSettlement, runRollingRelease } = require("../services/settlementService");

async function runAll() {
  const settled = await runSettlement();
  const released = await runRollingRelease();
  return { settled, released };
}

module.exports = { runAll, runSettlement, runRollingRelease };
