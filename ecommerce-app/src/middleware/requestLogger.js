const crypto = require("crypto");
const logger = require("../logger");

// Exactly one log line per request - mirrors bank-system/payment-system's
// requestLogger.js exactly. errorHandler annotates res.locals instead of
// logging directly, so nothing double-logs.
function requestLogger(req, res, next) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const start = process.hrtime.bigint();
  res.setHeader("X-Request-ID", requestId);

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const base = `${req.method} ${req.originalUrl} -> ${res.statusCode}`;
    const line = res.locals.logMessage
      ? `${base} ${res.locals.logMessage} (${durationMs.toFixed(1)}ms)`
      : `${base} (${durationMs.toFixed(1)}ms)`;
    logger[res.locals.logLevel || "info"](line);
  });

  next();
}

module.exports = requestLogger;
