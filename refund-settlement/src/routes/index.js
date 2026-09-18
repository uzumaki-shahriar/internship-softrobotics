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
router.get("/merchants/:id/edit", merchantController.showEditForm);
router.post("/merchants/:id/edit", merchantController.update);
router.get("/merchants/:id/dashboard", merchantController.dashboard);

// Merchant wallet
router.get("/merchants/:id/wallet", merchantController.showWallet);

// Merchant settlement config
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
