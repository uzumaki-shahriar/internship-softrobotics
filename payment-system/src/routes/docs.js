const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const README_PATH = path.join(__dirname, "..", "..", "README.md");

router.get("/", (req, res) => {
  const content = fs.readFileSync(README_PATH, "utf-8");
  res.render("docs", { content });
});

module.exports = router;
