const express = require("express");
const prisma = require("../../db");

const router = express.Router();

/**
 * Labels each seeded personal account/card by what it's actually good for
 * testing, derived from its real state rather than a hardcoded name lookup
 * - so this stays correct even if someone adds/edits seed accounts later.
 * Order matters: card-level problems are checked before account-level ones,
 * which are checked before balance/limit, matching chargeService's own
 * validation order.
 */
function labelFor(account, card) {
  const now = new Date();
  const isExpired =
    card.expiryYear < now.getFullYear() ||
    (card.expiryYear === now.getFullYear() && card.expiryMonth < now.getMonth() + 1);

  if (isExpired) return { label: "Expired card", expected: "declined", reason: "EXPIRED_CARD" };
  if (card.status !== "active") return { label: "Blocked card", expected: "declined", reason: "CARD_BLOCKED" };
  if (account.status === "frozen") return { label: "Frozen account", expected: "declined", reason: "ACCOUNT_FROZEN" };
  if (account.status === "closed") return { label: "Closed account", expected: "declined", reason: "ACCOUNT_CLOSED" };
  if (Number(account.balance) < 1000) {
    return { label: "Insufficient funds", expected: "declined", reason: "INSUFFICIENT_FUNDS" };
  }
  if (Number(account.dailyLimit) < 1000) {
    return { label: "Daily limit too low", expected: "declined", reason: "LIMIT_EXCEEDED" };
  }
  return { label: "Happy path", expected: "approved", reason: null };
}

// Dev/testing convenience so an integrating merchant's checkout page (or a
// developer in Postman) can always pull the *current* seeded test cards
// instead of hardcoding numbers that change on every reseed. Same
// X-API-KEY auth surface as every other endpoint here - not a public route.
router.get("/", async (req, res, next) => {
  try {
    const accounts = await prisma.account.findMany({
      where: { type: "personal" },
      include: { cards: true },
      orderBy: { id: "asc" },
    });

    const cards = accounts.flatMap((account) =>
      account.cards.map((card) => {
        const { label, expected, reason } = labelFor(account, card);
        return {
          label,
          expected_result: expected,
          decline_reason: reason,
          holder_name: account.holderName,
          card_number: card.cardNumber,
          cvv: card.cvv,
          expiry_month: card.expiryMonth,
          expiry_year: card.expiryYear,
        };
      })
    );

    res.json(cards);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
