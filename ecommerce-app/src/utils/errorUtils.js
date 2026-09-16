const path = require("path");

const SRC_ROOT = path.join(__dirname, "..");

/**
 * One-line summary: error type, message, and the src/ file:line it came
 * from - mirrors bank-system/payment-system's errorUtils.js exactly.
 */
function getRootError(err) {
  if (!err || !err.stack) return String(err);

  const lines = err.stack.split("\n").slice(1);
  for (const line of lines) {
    const match = line.match(/\((.*):(\d+):(\d+)\)$/) || line.match(/at (.*):(\d+):(\d+)$/);
    if (!match) continue;
    const [, file, lineNo] = match;
    if (file.startsWith(SRC_ROOT) && !file.includes("node_modules")) {
      const relative = "src" + file.slice(SRC_ROOT.length);
      return `${err.name}: ${err.message} (${relative}:${lineNo})`;
    }
  }
  return `${err.name}: ${err.message}`;
}

module.exports = { getRootError };
