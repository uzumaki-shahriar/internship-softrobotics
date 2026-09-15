const express = require("express");
const prisma = require("../../db");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const banks = await prisma.bank.findMany({ orderBy: { name: "asc" } });
    res.render("banks/index", { banks });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
