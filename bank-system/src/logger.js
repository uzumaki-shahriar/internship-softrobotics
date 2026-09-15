const pino = require("pino");
const config = require("./config");

// Same simple one-line format everywhere (dev and in Docker) - this is a
// teaching project's logs read by a developer, not JSON piped into a log
// aggregator. Every log call composes its own concise message (label,
// endpoint, file:line where relevant - see errorUtils.getRootError) rather
// than relying on structured fields.
const logger = pino({
  level: config.logLevel,
  transport: {
    target: "pino-pretty",
    options: { colorize: true, translateTime: "HH:MM:ss" },
  },
});

module.exports = logger;
