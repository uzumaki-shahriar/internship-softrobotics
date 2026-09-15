const pino = require("pino");
const config = require("./config");

// pino-pretty in dev for readable console output; plain JSON in prod (so it
// can be piped into a real log aggregator). err.stack (logged automatically
// by pino for an `err` field) carries the exact file/line of any exception -
// that's what makes errors traceable, not a custom formatter.
const logger = pino({
  level: config.logLevel,
  transport:
    config.nodeEnv === "development"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
      : undefined,
});

module.exports = logger;
