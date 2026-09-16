const { z } = require("zod");

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

module.exports = { loginSchema };
