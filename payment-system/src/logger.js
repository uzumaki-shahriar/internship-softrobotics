const pino = require("pino");
const config = require("./config");

// Same simple one-line format everywhere (dev and in Docker) - matches
// bank-system's logger.js exactly. Every log call composes its own concise
// message (label, endpoint, file:line where relevant - see
// utils/errorUtils.js) rather than relying on structured JSON fields.
const logger = pino({
  level: config.logLevel,
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "HH:MM:ss",
      levelFirst: true,
      ignore: "pid,hostname",
    },
  },
});

module.exports = logger;
