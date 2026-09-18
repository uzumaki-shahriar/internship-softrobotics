const { z } = require("zod");

const debitSchema = z.object({
  account_number: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
  currency: z.string().trim().length(3),
  idempotency_key: z.string().trim().min(1),
  reference: z.string().trim().min(1),
});

module.exports = { debitSchema };
