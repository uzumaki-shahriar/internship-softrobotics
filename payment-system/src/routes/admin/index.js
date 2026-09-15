const express = require("express");
const requireAdminSession = require("../../middleware/requireAdminSession");
const authRouter = require("./auth");
const dashboardRouter = require("./dashboard");
const merchantsRouter = require("./merchants");
const transactionsRouter = require("./transactions");
const refundsRouter = require("./refunds");
const banksRouter = require("./banks");

const router = express.Router();

router.use("/", authRouter); // login/logout - no session required

router.use(requireAdminSession);
router.use("/", dashboardRouter);
router.use("/merchants", merchantsRouter);
router.use("/transactions", transactionsRouter);
router.use("/refunds", refundsRouter);
router.use("/banks", banksRouter);

router.get("/", (req, res) => res.redirect("/admin/dashboard"));

module.exports = router;
