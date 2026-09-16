const express = require("express");
const { createAccountSchema } = require("../../validators/account.schema");
const { listAccounts, getAccount, createAccount, setAccountStatus } = require("../../services/accountService");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const accounts = await listAccounts();
    res.render("accounts/index", { accounts });
  } catch (err) {
    next(err);
  }
});

router.get("/new", (req, res) => {
  res.render("accounts/new", { error: null, values: {} });
});

router.post("/", async (req, res, next) => {
  try {
    const parsed = createAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(422)
        .render("accounts/new", { error: parsed.error.issues[0].message, values: req.body });
    }
    const account = await createAccount(parsed.data);
    req.flash("success", `Account ${account.accountNumber} created.`);
    res.redirect(`/admin/accounts/${account.id}`);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const account = await getAccount(req.params.id);
    res.render("accounts/show", { account });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/freeze", async (req, res, next) => {
  try {
    await setAccountStatus(req.params.id, "frozen");
    req.flash("success", "Account frozen.");
    res.redirect(`/admin/accounts/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/unfreeze", async (req, res, next) => {
  try {
    await setAccountStatus(req.params.id, "active");
    req.flash("success", "Account reactivated.");
    res.redirect(`/admin/accounts/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/close", async (req, res, next) => {
  try {
    await setAccountStatus(req.params.id, "closed");
    req.flash("success", "Account closed.");
    res.redirect(`/admin/accounts/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
