const express = require("express");
const merchantRouter = require("./merchant");
const adminRouter = require("./admin");
const checkoutRouter = require("./checkout");
const transactionsRouter = require("./transactions");
const walletRouter = require("./wallet");
const refundRouter = require("./refund");

const router = express.Router();

router.use("/merchant/wallet", walletRouter);
router.use("/merchant", merchantRouter);
router.use("/admin", adminRouter);
router.use("/checkout", checkoutRouter);
router.use("/transactions", transactionsRouter);
router.use("/refund", refundRouter);

module.exports = router;
