const { ForbiddenError } = require("../errors");

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return next(new ForbiddenError(`Requires ${role} role`));
    }
    next();
  };
}

module.exports = requireRole;
