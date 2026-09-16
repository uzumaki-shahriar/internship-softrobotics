const app = require("./app");
const config = require("./config");
const logger = require("./logger");

app.listen(config.port, () => {
  logger.info(`${config.bankName} (${config.bankCode}) listening on port ${config.port}`);
});
