const express = require("express");
const { registerSchema } = require("../../validators/merchantAuth.schema");
const { registerMerchant } = require("../../services/merchantService");
const { ConflictError } = require("../../errors");

const router = express.Router();

// Login lives at the shared /login page (routes/auth.js) - only
// registration and logout stay here, contextual to this session cookie.
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

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

module.exports = router;
