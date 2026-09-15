const crypto = require("crypto");
const logger = require("../logger");

// Exactly one log line per request, no matter how it ends: level, method,
// endpoint, status, message (only present if errorHandler set one),
// duration - timestamp comes from the logger itself. errorHandler
// annotates res.locals.logLevel/logMessage instead of logging directly, so
// there's a single source of truth for "did this request get logged yet."
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
