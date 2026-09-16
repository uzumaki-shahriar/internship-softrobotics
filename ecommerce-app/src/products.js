const config = require("./config");

// Deliberately hardcoded, not a DB table - this shop is intentionally
// minimal so the focus stays on the payment flow, not a catalog feature.
const PRODUCTS = [
  { id: 1, name: "The Midnight Library", price: 500, currency: config.gatewayCurrency },
  { id: 2, name: "Atomic Habits", price: 1200, currency: config.gatewayCurrency },
];

function getProduct(id) {
  return PRODUCTS.find((p) => p.id === Number(id));
}

module.exports = { PRODUCTS, getProduct };
