const { AppError } = require("../errors");
const { getRootError } = require("../utils/errorUtils");

function notFoundHandler(req, res) {
  res.locals.logLevel = "warn";
  res.locals.logMessage = "[NOT_FOUND] Not Found";
  res.status(404).render("error", { message: "Page not found", status: 404 });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    res.locals.logLevel = err.statusCode >= 500 ? "error" : "warn";
    res.locals.logMessage = `[${err.code}] ${err.message}`;
    return res.status(err.statusCode).render("error", { message: err.message, status: err.statusCode });
  }

  res.locals.logLevel = "error";
  res.locals.logMessage = getRootError(err);
  res.status(500).render("error", { message: "Something went wrong.", status: 500 });
}

module.exports = { errorHandler, notFoundHandler };
