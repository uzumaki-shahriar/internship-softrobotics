const { z } = require("zod");

const createCardSchema = z.object({
  account_id: z.coerce.number().int().positive(),
  card_holder_name: z.string().trim().min(1, "Cardholder name is required"),
  expiry_month: z.coerce.number().int().min(1).max(12),
  expiry_year: z.coerce.number().int().min(new Date().getFullYear()),
});

module.exports = { createCardSchema };
