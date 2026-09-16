const { z } = require("zod");

const refundSchema = z.object({
  bank_reference: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
  idempotency_key: z.string().trim().min(1),
});

module.exports = { refundSchema };
