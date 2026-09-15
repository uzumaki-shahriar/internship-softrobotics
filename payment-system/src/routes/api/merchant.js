const express = require("express");
const bcrypt = require("bcryptjs");
const prisma = require("../../db");
const { registerSchema, loginSchema } = require("../../validators/merchantAuth.schema");
const { validateBody } = require("../../middleware/validate");
const jwtAuth = require("../../middleware/jwtAuth");
const requireRole = require("../../middleware/requireRole");
const apiKeyAuth = require("../../middleware/apiKeyAuth");
const { signToken } = require("../../utils/jwt");
const { UnauthorizedError } = require("../../errors");
const {
  registerMerchant,
  regenerateApiKey,
  getMerchantProfile,
} = require("../../services/merchantService");
const { listTransactions } = require("../../services/walletService");

const router = express.Router();

router.post("/register", validateBody(registerSchema), async (req, res, next) => {
  try {
    const { user, merchant, fullApiKey } = await registerMerchant(req.body);
    res.status(201).json({
      merchant_id: merchant.id,
      store_id: merchant.storeId,
      name: merchant.name,
      email: user.email,
      status: merchant.status,
      api_key: fullApiKey,
      api_key_prefix: merchant.apiKeyPrefix,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/login", validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email }, include: { merchant: true } });
    if (!user || user.userType !== "merchant" || !user.merchant) {
      throw new UnauthorizedError("Invalid email or password");
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedError("Invalid email or password");

    const token = signToken({ sub: user.id, role: "merchant", merchantId: user.merchant.id });
    res.json({
      token,
      merchant: { id: user.merchant.id, store_id: user.merchant.storeId, status: user.merchant.status },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/profile", jwtAuth, requireRole("merchant"), async (req, res, next) => {
  try {
    const merchant = await getMerchantProfile(req.user.merchantId);
    res.json({
      id: merchant.id,
      store_id: merchant.storeId,
      name: merchant.name,
      address: merchant.address,
      status: merchant.status,
      api_key_prefix: merchant.apiKeyPrefix,
      pricing_plans: merchant.pricingPlans.map((p) => ({
        currency: p.currency.code,
        commission_percentage: p.commissionPercentage,
        commission_fixed: p.commissionFixed,
        settlement_day: p.settlementDay,
      })),
      wallets: merchant.wallets.map((w) => ({ currency: w.currency.code, balance: w.balance })),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/api-key/regenerate", jwtAuth, requireRole("merchant"), async (req, res, next) => {
  try {
    const { merchant, fullApiKey } = await regenerateApiKey(req.user.merchantId);
    res.json({ api_key: fullApiKey, api_key_prefix: merchant.apiKeyPrefix });
  } catch (err) {
    next(err);
  }
});

const TRANSACTION_STATUSES = ["pending", "completed", "failed", "expired", "refunded", "partial_refunded"];

router.get("/transactions", jwtAuth, requireRole("merchant"), async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.page_size, 10) || 20));
    const status = TRANSACTION_STATUSES.includes(req.query.status) ? req.query.status : undefined;
    const result = await listTransactions(req.user.merchantId, { page, pageSize, status });
    res.json({
      items: result.items.map((t) => ({
        invoice_id: t.invoiceId,
        order_id: t.orderId,
        status: t.status,
        gross_amount: t.grossAmount,
        fee_amount: t.feeAmount,
        net_amount: t.netAmount,
        refunded_amount: t.refundedAmount,
        currency: t.currency.code,
        decline_reason: t.declineReason,
        created_at: t.createdAt,
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

// Lets a merchant's server sanity-check its own credentials -
// server-to-server, X-API-KEY, same auth surface checkout/refund/wallet
// endpoints will use from Milestone 3 onward.
router.get("/whoami", apiKeyAuth, (req, res) => {
  res.json({ store_id: req.merchant.storeId, name: req.merchant.name, status: req.merchant.status });
});

module.exports = router;
