const logger = require("../logger");
const { AppError } = require("../errors");
const { getRootError } = require("../utils/errorUtils");

function isApiRequest(req) {
  return req.originalUrl.startsWith("/api/");
}

function notFoundHandler(req, res, next) {
  if (isApiRequest(req)) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Not Found" },
      status_code: 404,
    });
  }
  res.status(404).render("error", { message: "Page not found", status: 404 });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const endpoint = `${req.method} ${req.originalUrl}`;

  if (err instanceof AppError) {
    const line = `${endpoint} -> ${err.statusCode} [${err.code}] ${err.message}`;
    if (err.statusCode >= 500) {
      logger.error(line);
    } else {
      logger.warn(line);
    }
    if (isApiRequest(req)) {
      return res.status(err.statusCode).json({
        success: false,
        error: { code: err.code, message: err.message, details: err.details },
        status_code: err.statusCode,
      });
    }
    return res.status(err.statusCode).render("error", { message: err.message, status: err.statusCode });
  }

  // Unexpected error - log the concise, file:line-anchored summary (see
  // errorUtils.getRootError), not the raw node_modules-laden stack trace.
  logger.error(`${endpoint} -> 500 ${getRootError(err)}`);

  if (isApiRequest(req)) {
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
      status_code: 500,
    });
  }
  res.status(500).render("error", { message: "Something went wrong.", status: 500 });
}

module.exports = { errorHandler, notFoundHandler };
