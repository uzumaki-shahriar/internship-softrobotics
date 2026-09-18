const express = require("express");
const bcrypt = require("bcryptjs");
const prisma = require("../db");
const { loginSchema } = require("../validators/merchantAuth.schema");

// One shared login page/form for both roles - the account's own userType
// decides which dashboard it goes to and which session cookie gets set
// (see app.js for why admin/merchant sessions stay separate cookies).
// Exported as a factory since it needs the exact session()/flash()
// middleware instances app.js already built for /admin and /dashboard, so
// a login here writes to the same cookie those areas read from.
module.exports = function buildAuthRouter({ adminSession, merchantSession, adminFlash, merchantFlash }) {
  const router = express.Router();

  function run(mw, req, res) {
    return new Promise((resolve, reject) => {
      mw(req, res, (err) => (err ? reject(err) : resolve()));
    });
  }

  router.get("/login", async (req, res, next) => {
    try {
      // Only ever run ONE of the two session() instances per request -
      // chaining both on the same req/res is unreliable (the second one
      // fails to read back its own session; verified with a minimal
      // repro). The cookie's own name tells us which one is relevant here.
      const cookies = req.headers.cookie || "";
      if (cookies.includes("admin.sid=")) {
        await run(adminSession, req, res);
        if (req.session.adminId) return res.redirect("/admin/dashboard");
      } else if (cookies.includes("merchant.sid=")) {
        await run(merchantSession, req, res);
        if (req.session.merchantId) return res.redirect("/dashboard/overview");
      }

      res.render("login", { error: null });
    } catch (err) {
      next(err);
    }
  });

  router.post("/login", async (req, res, next) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(422).render("login", { error: "Enter a valid email and password." });
      }
      const { email, password } = parsed.data;
      const user = await prisma.user.findUnique({ where: { email }, include: { merchant: true } });
      const invalid = () => res.status(401).render("login", { error: "Invalid email or password." });

      if (!user || !(await bcrypt.compare(password, user.passwordHash))) return invalid();

      if (user.userType === "admin") {
        await run(adminSession, req, res);
        await run(adminFlash, req, res);
        req.session.adminId = user.id;
        req.session.adminName = user.name;
        return req.session.save(() => res.redirect("/admin/dashboard"));
      }

      if (user.userType === "merchant" && user.merchant) {
        await run(merchantSession, req, res);
        await run(merchantFlash, req, res);
        req.session.merchantId = user.merchant.id;
        req.session.merchantName = user.merchant.name;
        req.session.merchantStoreId = user.merchant.storeId;
        return req.session.save(() => res.redirect("/dashboard/overview"));
      }

      return invalid();
    } catch (err) {
      next(err);
    }
  });

  return router;
};
