const { z } = require("zod");

const chargeSchema = z.object({
  card_number: z.string().trim().regex(/^\d{13,19}$/, "card_number must be 13-19 digits"),
  card_holder_name: z.string().trim().min(1),
  expiry_month: z.coerce.number().int().min(1).max(12),
  expiry_year: z.coerce.number().int().min(2000).max(2100),
  cvv: z.string().trim().regex(/^\d{3,4}$/, "cvv must be 3-4 digits"),
  amount: z.coerce.number().positive(),
  currency: z.string().trim().length(3),
  idempotency_key: z.string().trim().min(1),
  reference: z.string().trim().min(1),
  // Where to send the customer's browser back to once an OTP challenge
  // (if one is needed) resolves - see otpService.js. Always sent, even
  // though most charges never trigger OTP, since the bank can't know in
  // advance whether this card will need it.
  return_url: z.string().trim().url(),
});

module.exports = { chargeSchema };
