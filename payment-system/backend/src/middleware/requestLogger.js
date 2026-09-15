const crypto = require("crypto");
const logger = require("../logger");

// One concise line per request: METHOD path -> status (Xms). Matches
// bank-system's src/middleware/requestLogger.js exactly.
function requestLogger(req, res, next) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const start = process.hrtime.bigint();
  res.setHeader("X-Request-ID", requestId);

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs.toFixed(1)}ms)`);
  });

  next();
}

module.exports = requestLogger;
