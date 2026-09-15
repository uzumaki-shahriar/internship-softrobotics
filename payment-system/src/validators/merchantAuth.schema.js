const { z } = require("zod");

const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  store_name: z.string().trim().min(1, "Store name is required"),
  address: z.string().trim().optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

module.exports = { registerSchema, loginSchema };
