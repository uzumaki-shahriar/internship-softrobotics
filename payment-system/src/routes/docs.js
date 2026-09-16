const express = require("express");

const router = express.Router();

// Hand-authored API reference for merchants integrating with this Gateway -
// deliberately NOT the repo's README.md. That file is an internal
// engineering doc (milestones, Docker internals, schema field notes) never
// meant for a client-facing audience; this page shows only what an
// integrating merchant actually needs, the same separation a real payment
// gateway keeps between its public docs site and its own engineering repo.
router.get("/", (req, res) => {
  res.render("docs");
});

module.exports = router;
