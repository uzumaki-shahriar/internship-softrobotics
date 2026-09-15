const { z } = require("zod");

const initSchema = z.object({
  order_id: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
  currency: z.string().trim().length(3),
  success_url: z.string().trim().url(),
  fail_url: z.string().trim().url(),
});

module.exports = { initSchema };
