const express = require("express");
const bcrypt = require("bcryptjs");
const prisma = require("../../db");
const { loginSchema } = require("../../validators/merchantAuth.schema");
const { approveSchema } = require("../../validators/merchantAdmin.schema");
const { validateBody } = require("../../middleware/validate");
const jwtAuth = require("../../middleware/jwtAuth");
const requireRole = require("../../middleware/requireRole");
const { signToken } = require("../../utils/jwt");
const { UnauthorizedError } = require("../../errors");
const { listMerchants, approveMerchant } = require("../../services/merchantService");

const router = express.Router();

router.post("/login", validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.userType !== "admin") {
      throw new UnauthorizedError("Invalid email or password");
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedError("Invalid email or password");

    const token = signToken({ sub: user.id, role: "admin" });
    res.json({ token });
  } catch (err) {
    next(err);
  }
});

router.get("/merchants", jwtAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.page_size, 10) || 20));
    const result = await listMerchants({ page, pageSize });
    res.json({
      items: result.items.map((m) => ({
        id: m.id,
        store_id: m.storeId,
        name: m.name,
        status: m.status,
        pricing_plans: m.pricingPlans.map((p) => ({
          currency: p.currency.code,
          commission_percentage: p.commissionPercentage,
          commission_fixed: p.commissionFixed,
        })),
      })),
      total: result.total,
      page: result.page,
      page_size: result.page_size,
      pages: result.pages,
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/merchants/:id/approve",
  jwtAuth,
  requireRole("admin"),
  validateBody(approveSchema),
  async (req, res, next) => {
    try {
      const plan = await approveMerchant(Number(req.params.id), req.body);
      res.json({
        merchant_id: Number(req.params.id),
        currency: req.body.currency,
        commission_percentage: plan.commissionPercentage,
        commission_fixed: plan.commissionFixed,
        settlement_day: plan.settlementDay,
        status: "active",
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
