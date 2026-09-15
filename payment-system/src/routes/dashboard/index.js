const express = require("express");
const requireMerchantSession = require("../../middleware/requireMerchantSession");
const authRouter = require("./auth");
const overviewRouter = require("./overview");
const transactionsRouter = require("./transactions");
const refundsRouter = require("./refunds");
const settingsRouter = require("./settings");

const router = express.Router();

router.use("/", authRouter); // login/logout - no session required

router.use(requireMerchantSession);
router.use("/", overviewRouter);
router.use("/transactions", transactionsRouter);
router.use("/refunds", refundsRouter);
router.use("/", settingsRouter);

router.get("/", (req, res) => res.redirect("/dashboard/overview"));

module.exports = router;
