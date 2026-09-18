const express = require("express");
const prisma = require("../../db");
const { ConflictError } = require("../../errors");
const { approveSchema, createMerchantSchema, editMerchantSchema } = require("../../validators/merchantAdmin.schema");
const {
  listMerchants,
  getMerchantProfile,
  approveMerchant,
  setMerchantStatus,
  createMerchantByAdmin,
  updateMerchantDetails,
} = require("../../services/merchantService");

const router = express.Router();

async function loadMerchantDetail(id) {
  const merchant = await getMerchantProfile(id);
  const [currencies, transactions] = await Promise.all([
    prisma.currency.findMany(),
    prisma.transaction.findMany({
      where: { merchantId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { currency: true },
    }),
  ]);
  return { merchant, currencies, transactions };
}

router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const result = await listMerchants({ page, pageSize: 20 });
    res.render("merchants/index", { merchants: result.items, page: result.page, pages: result.pages });
  } catch (err) {
    next(err);
  }
});

router.get("/new", (req, res) => {
  res.render("merchants/new", { error: null, values: {} });
});

router.post("/", async (req, res, next) => {
  try {
    const parsed = createMerchantSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).render("merchants/new", { error: parsed.error.issues[0].message, values: req.body });
    }
    const { merchant, fullApiKey, temporaryPassword } = await createMerchantByAdmin(parsed.data);
    // Shown once, on this response only - never persisted anywhere in
    // plaintext, never round-tripped through flash/session storage.
    res.render("merchants/new", {
      error: null,
      values: {},
      created: { merchant, apiKey: fullApiKey, temporaryPassword },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const detail = await loadMerchantDetail(Number(req.params.id));
    res.render("merchants/show", { ...detail, error: null });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/edit", async (req, res, next) => {
  try {
    const merchant = await getMerchantProfile(Number(req.params.id));
    const user = await prisma.user.findUnique({ where: { id: merchant.userId } });
    res.render("merchants/edit", {
      merchant,
      error: null,
      values: { owner_name: user.name, email: user.email, store_name: merchant.name, address: merchant.address },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/edit", async (req, res, next) => {
  try {
    const parsed = editMerchantSchema.safeParse(req.body);
    if (!parsed.success) {
      const merchant = await getMerchantProfile(Number(req.params.id));
      return res.status(422).render("merchants/edit", {
        merchant,
        error: parsed.error.issues[0].message,
        values: req.body,
      });
    }
    await updateMerchantDetails(Number(req.params.id), parsed.data);
    req.flash("success", "Merchant details updated.");
    res.redirect(`/admin/merchants/${req.params.id}`);
  } catch (err) {
    if (err instanceof ConflictError) {
      const merchant = await getMerchantProfile(Number(req.params.id));
      return res.status(409).render("merchants/edit", { merchant, error: err.message, values: req.body });
    }
    next(err);
  }
});

// Sets/updates the merchant's commission "deal" for a currency and ensures
// they're active - the same action for first approval and for later
// renegotiating a rate.
router.post("/:id/approve", async (req, res, next) => {
  try {
    const parsed = approveSchema.safeParse(req.body);
    if (!parsed.success) {
      const detail = await loadMerchantDetail(Number(req.params.id));
      return res.status(422).render("merchants/show", {
        ...detail,
        error: parsed.error.issues[0].message,
        values: req.body,
      });
    }
    await approveMerchant(Number(req.params.id), parsed.data);
    req.flash("success", `Commission set for ${parsed.data.currency} - merchant is active.`);
    res.redirect(`/admin/merchants/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/suspend", async (req, res, next) => {
  try {
    await setMerchantStatus(Number(req.params.id), "suspended");
    req.flash("success", "Merchant suspended.");
    res.redirect(`/admin/merchants/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/reactivate", async (req, res, next) => {
  try {
    await setMerchantStatus(Number(req.params.id), "active");
    req.flash("success", "Merchant reactivated.");
    res.redirect(`/admin/merchants/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
