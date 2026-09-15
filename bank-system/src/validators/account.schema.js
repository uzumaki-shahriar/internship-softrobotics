const { z } = require("zod");

const createAccountSchema = z.object({
  holder_name: z.string().trim().min(1, "Holder name is required"),
  balance: z.coerce.number().min(0).default(1000),
  daily_limit: z.coerce.number().positive().default(100000),
});

module.exports = { createAccountSchema };