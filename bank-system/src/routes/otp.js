const express = require("express");
const { z } = require("zod");
const { getChallengeForDisplay, verifyOtp, resendOtp } = require("../services/otpService");

const router = express.Router();

// Public, customer-facing - no X-API-KEY, no admin session. Protected by
// the reference being unguessable (bankReference) + a short expiry + a
// capped attempt count, the same trust model a real bank's ACS challenge
// link uses.
const codeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code") });

router.get("/:reference", async (req, res, next) => {
  try {
    const challenge = await getChallengeForDisplay(req.params.reference);
    if (challenge.status !== "pending") {
      return res.render("otp/closed", { challenge });
    }
    res.render("otp/challenge", { challenge, error: null });
  } catch (err) {
    next(err);
  }
});

router.post("/:reference/verify", async (req, res, next) => {
  try {
    const challenge = await getChallengeForDisplay(req.params.reference);
    if (challenge.status !== "pending") {
      return res.render("otp/closed", { challenge });
    }

    const parsed = codeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).render("otp/challenge", { challenge, error: parsed.error.issues[0].message });
    }

    const result = await verifyOtp(req.params.reference, parsed.data.code);

    if (!result.resolved) {
      res.locals.logLevel = "warn";
      res.locals.logMessage = `[OTP] wrong code for ${req.params.reference} (${result.attemptsRemaining} left)`;
      return res.status(422).render("otp/challenge", {
        challenge,
        error: `${result.error} - ${result.attemptsRemaining} attempt${result.attemptsRemaining === 1 ? "" : "s"} left`,
      });
    }

    res.locals.logLevel = result.approved ? "info" : "warn";
    res.locals.logMessage = `[OTP] ${req.params.reference} ${result.approved ? "verified" : "failed"}`;
    res.redirect(result.returnUrl);
  } catch (err) {
    next(err);
  }
});

router.post("/:reference/resend", async (req, res, next) => {
  try {
    const challenge = await getChallengeForDisplay(req.params.reference);
    if (challenge.status !== "pending") {
      return res.render("otp/closed", { challenge });
    }

    const result = await resendOtp(req.params.reference);
    if (result.resolved) {
      // Resolved between page-load and resend click (e.g. it just expired) -
      // nothing left to resend.
      return res.redirect(result.returnUrl);
    }

    res.locals.logLevel = "info";
    res.locals.logMessage = `[OTP] resent code for ${req.params.reference}`;
    res.render("otp/challenge", {
      challenge: await getChallengeForDisplay(req.params.reference),
      error: null,
      resent: true,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
