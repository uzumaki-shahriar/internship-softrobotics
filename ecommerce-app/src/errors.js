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

// Thrown when the Gateway rejects our own X-API-KEY call because this
// store's merchant account isn't "active" yet - i.e. it registered but is
// still waiting on the Gateway admin to review and approve it. Same real
// state as a brand-new Stripe/SSLCommerz merchant whose first live charge
// attempt is blocked pending verification.
class MerchantNotApprovedError extends AppError {
  constructor(message = "This store's payment account is still pending approval") {
    super(503, message, "MERCHANT_NOT_APPROVED");
  }
}

module.exports = { AppError, NotFoundError, MerchantNotApprovedError };
