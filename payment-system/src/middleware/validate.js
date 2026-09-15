const { ValidationError } = require("../errors");

/**
 * Validates req.body against a Zod schema. On success, replaces req.body
 * with the parsed (and coerced/defaulted) data. On failure, throws a
 * ValidationError the central error handler turns into a 422. Mirrors
 * bank-system's src/middleware/validate.js exactly.
 */
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return next(new ValidationError("Validation failed", details));
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validateBody };
