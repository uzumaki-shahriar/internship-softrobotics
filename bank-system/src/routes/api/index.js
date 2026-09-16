const express = require("express");
const apiKeyAuth = require("../../middleware/apiKeyAuth");
const cardsRouter = require("./cards");
const accountsRouter = require("./accounts");
const testCardsRouter = require("./testCards");

const router = express.Router();

router.use(apiKeyAuth);
router.use("/cards", cardsRouter);
router.use("/accounts", accountsRouter);
router.use("/test-cards", testCardsRouter);

module.exports = router;
