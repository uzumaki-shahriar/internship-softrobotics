const express = require("express");
const bcrypt = require("bcryptjs");
const prisma = require("../../db");
const { loginSchema } = require("../../validators/merchantAuth.schema");

const router = express.Router();

router.get("/login", (req, res) => {
  if (req.session.merchantId) return res.redirect("/dashboard/overview");
  res.render("merchant/login", { error: null });
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
