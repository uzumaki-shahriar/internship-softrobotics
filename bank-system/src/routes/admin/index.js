const express = require("express");
const requireAdminSession = require("../../middleware/requireAdminSession");
const authRouter = require("./auth");
const dashboardRouter = require("./dashboard");
const accountsRouter = require("./accounts");
const cardsRouter = require("./cards");
const transactionsRouter = require("./transactions");

const router = express.Router();

router.use("/", authRouter); // login/logout - no session required

router.use(requireAdminSession);
router.use("/", dashboardRouter);
router.use("/accounts", accountsRouter);
router.use("/cards", cardsRouter);
router.use("/transactions", transactionsRouter);

router.get("/", (req, res) => res.redirect("/admin/dashboard"));

module.exports = router;
