// Mirrors bank-system/payment-system's src/errors.js: one error hierarchy,
// one response shape.
class AppError extends Error {
  constructor(statusCode, message, code = "ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(404, message, "NOT_FOUND");
  }
}

module.exports = { AppError, NotFoundError };
