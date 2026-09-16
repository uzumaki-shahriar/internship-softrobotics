const express = require("express");
const { PRODUCTS } = require("../products");
const { createOrderAndCheckout, confirmOrder } = require("../services/orderService");
const config = require("../config");

const router = express.Router();

router.get("/", (req, res) => {
  res.render("home", { products: PRODUCTS, currency: config.gatewayCurrency });
});

router.post("/orders", async (req, res, next) => {
  try {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const checkoutUrl = await createOrderAndCheckout({
      productId: req.body.product_id,
      buyerName: req.body.buyer_name || "Guest",
      baseUrl,
    });
    res.redirect(checkoutUrl);
  } catch (err) {
    next(err);
  }
});

router.get("/success", async (req, res, next) => {
  try {
    const order = await confirmOrder(req.query.invoice_id);
    res.render("success", { order });
  } catch (err) {
    next(err);
  }
});

router.get("/fail", async (req, res, next) => {
  try {
    const order = await confirmOrder(req.query.invoice_id);
    res.render("fail", { order, reason: req.query.reason });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
