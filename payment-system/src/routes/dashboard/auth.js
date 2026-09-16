const express = require("express");
const bcrypt = require("bcryptjs");
const prisma = require("../../db");
const { loginSchema, registerSchema } = require("../../validators/merchantAuth.schema");
const { registerMerchant } = require("../../services/merchantService");
const { ConflictError } = require("../../errors");

const router = express.Router();

router.get("/login", (req, res) => {
  if (req.session.merchantId) return res.redirect("/dashboard/overview");
  res.render("merchant/login", { error: null });
});

router.get("/register", (req, res) => {
  if (req.session.merchantId) return res.redirect("/dashboard/overview");
  res.render("merchant/register", { error: null, values: {} });
});

router.post("/register", async (req, res, next) => {
  try {
    if (req.session.merchantId) return res.redirect("/dashboard/overview");

    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).render("merchant/register", {
        error: parsed.error.issues[0].message,
        values: req.body,
      });
    }

    const { user, merchant, fullApiKey } = await registerMerchant(parsed.data);

    // Same treatment as regenerating a key from Settings - the secret is
    // rendered directly on this one response, never round-tripped through
    // a redirect or flash message, since it can't be shown again after this.
    req.session.merchantId = merchant.id;
    req.session.merchantName = merchant.name;
    req.session.merchantStoreId = merchant.storeId;
    res.render("merchant/registered", { merchant, email: user.email, apiKey: fullApiKey });
  } catch (err) {
    if (err instanceof ConflictError) {
      return res.status(409).render("merchant/register", { error: err.message, values: req.body });
    }
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).render("merchant/login", { error: "Enter a valid email and password." });
    }
    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email }, include: { merchant: true } });
    if (
      !user ||
      user.userType !== "merchant" ||
      !user.merchant ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      return res.status(401).render("merchant/login", { error: "Invalid email or password." });
    }

    req.session.merchantId = user.merchant.id;
    req.session.merchantName = user.merchant.name;
    req.session.merchantStoreId = user.merchant.storeId;
    res.redirect("/dashboard/overview");
  } catch (err) {
    next(err);
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/dashboard/login"));
});

module.exports = router;
