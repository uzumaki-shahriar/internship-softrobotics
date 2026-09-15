const { z } = require("zod");

// Deliberately no amount/currency here - those come from the stored
// Transaction, never from the client, so a customer can't tamper with the
// price in their browser at pay-time.
const paySchema = z.object({
  card_number: z.string().trim().regex(/^\d{13,19}$/, "Card number must be 13-19 digits"),
  card_holder_name: z.string().trim().min(1, "Cardholder name is required"),
  expiry_month: z.coerce.number().int().min(1).max(12),
  expiry_year: z.coerce.number().int().min(2000).max(2100),
  cvv: z.string().trim().regex(/^\d{3,4}$/, "CVV must be 3-4 digits"),
  // Ties this exact form render to one payment attempt - see
  // checkoutService.js's prepareAttempt/payForSession for why.
  attempt_token: z.string().trim().min(1, "Invalid or stale payment form, please reload"),
});

module.exports = { paySchema };
