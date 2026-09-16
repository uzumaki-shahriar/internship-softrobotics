const express = require("express");
const prisma = require("../../db");
const { createCardSchema } = require("../../validators/card.schema");
const { listCards, createCard, setCardStatus } = require("../../services/cardService");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const cards = await listCards();
    res.render("cards/index", { cards });
  } catch (err) {
    next(err);
  }
});

router.get("/new", async (req, res, next) => {
  try {
    const accounts = await prisma.account.findMany({ orderBy: { createdAt: "desc" } });
    res.render("cards/new", { error: null, values: {}, accounts });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const parsed = createCardSchema.safeParse(req.body);
    if (!parsed.success) {
      const accounts = await prisma.account.findMany({ orderBy: { createdAt: "desc" } });
      return res
        .status(422)
        .render("cards/new", { error: parsed.error.issues[0].message, values: req.body, accounts });
    }
    const card = await createCard(parsed.data);
    req.flash("success", `Card ${card.cardNumber} created.`);
    res.redirect("/admin/cards");
  } catch (err) {
    next(err);
  }
});

router.post("/:id/block", async (req, res, next) => {
  try {
    await setCardStatus(req.params.id, "blocked");
    req.flash("success", "Card blocked.");
    res.redirect("/admin/cards");
  } catch (err) {
    next(err);
  }
});

router.post("/:id/unblock", async (req, res, next) => {
  try {
    await setCardStatus(req.params.id, "active");
    req.flash("success", "Card reactivated.");
    res.redirect("/admin/cards");
  } catch (err) {
    next(err);
  }
});

module.exports = router;
