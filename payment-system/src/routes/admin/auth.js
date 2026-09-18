const express = require("express");

const router = express.Router();

// Login lives at the shared /login page (routes/auth.js) - only logout
// stays here, contextual to this session cookie.
router.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

module.exports = router;
