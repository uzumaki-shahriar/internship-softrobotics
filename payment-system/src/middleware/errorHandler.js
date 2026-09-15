const { AppError } = require("../errors");
const { getRootError } = require("../utils/errorUtils");

function isApiRequest(req) {
  return req.originalUrl.startsWith("/api/");
}

function notFoundHandler(req, res) {
  res.locals.logLevel = "warn";
  res.locals.logMessage = "[NOT_FOUND] Not Found";

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
  // Logging happens once, in requestLogger's res.on("finish") - this
  // handler only decides the level/message and sends the response.
  if (err instanceof AppError) {
    res.locals.logLevel = err.statusCode >= 500 ? "error" : "warn";
    res.locals.logMessage = `[${err.code}] ${err.message}`;

    if (isApiRequest(req)) {
      return res.status(err.statusCode).json({
        success: false,
        error: { code: err.code, message: err.message, details: err.details },
        status_code: err.statusCode,
      });
    }
    return res.status(err.statusCode).render("error", { message: err.message, status: err.statusCode });
  }

  // Unexpected error - the concise, file:line-anchored summary (see
  // errorUtils.getRootError), not the raw node_modules-laden stack trace.
  res.locals.logLevel = "error";
  res.locals.logMessage = getRootError(err);

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
