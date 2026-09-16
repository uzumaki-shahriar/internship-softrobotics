const pino = require("pino");
const config = require("./config");

// Same simple one-line format as bank-system/payment-system: level first,
// no PID, no structured JSON blob - every call composes its own concise
// message.
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
