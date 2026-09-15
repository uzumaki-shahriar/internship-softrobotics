const express = require("express");
const bcrypt = require("bcryptjs");
const prisma = require("../../db");
const { loginSchema } = require("../../validators/auth.schema");

const router = express.Router();

router.get("/login", (req, res) => {
  if (req.session.adminId) return res.redirect("/admin/dashboard");
  res.render("login", { error: null });
});

router.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).render("login", { error: "Enter a valid email and password." });
    }
    const { email, password } = parsed.data;
    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      return res.status(401).render("login", { error: "Invalid email or password." });
    }
    req.session.adminId = admin.id;
    req.session.adminName = admin.name;
    res.redirect("/admin/dashboard");
  } catch (err) {
    next(err);
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/admin/login"));
});

module.exports = router;
