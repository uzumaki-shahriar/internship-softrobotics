const { z } = require("zod");

const refundSchema = z.object({
  invoice_id: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
});

module.exports = { refundSchema };
