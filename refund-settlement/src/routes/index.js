const express = require("express");
const router = express.Router();

const transactionController = require("../controllers/transactionController");
const merchantController = require("../controllers/merchantController");
const dashboardController = require("../controllers/dashboardController");

router.get("/", (req, res) => res.redirect("/dashboard"));

// PSP dashboard
router.get("/dashboard", dashboardController.pspDashboard);

// Transactions
router.get("/transactions", transactionController.list);
router.get("/transactions/new", transactionController.showNewForm);
router.post("/transactions", transactionController.create);
router.get("/transactions/:id", transactionController.show);
router.post("/transactions/:id/refund", transactionController.refund);

// Merchant management
router.get("/merchants", merchantController.list);
router.get("/merchants/new", merchantController.showNewForm);
router.post("/merchants", merchantController.create);
router.get("/merchants/:id/dashboard", merchantController.dashboard);

// Merchant settlement config (also the merchant's edit page — name lives on
// the same row as the settlement/rolling fields)
router.get(
  "/merchants/:id/settlement-config",
  merchantController.showSettlementConfig
);
router.post(
  "/merchants/:id/settlement-config",
  merchantController.updateSettlementConfig
);

// Settlements
router.post(
  "/merchants/:id/settlements",
  merchantController.createSettlement
);

module.exports = router;
