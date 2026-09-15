const { z } = require("zod");

// Approves a merchant for a currency and sets/updates their commission
// "deal" for it in one action - see merchantService.approveMerchant.
const approveSchema = z.object({
  currency: z.string().trim().length(3),
  commission_percentage: z.coerce.number().min(0).max(100),
  commission_fixed: z.coerce.number().min(0),
  settlement_day: z.coerce.number().int().min(0).default(3),
});

// Admin-assisted onboarding - no password field, one is generated and
// shown once (see merchantService.createMerchantByAdmin).
const createMerchantSchema = z.object({
  name: z.string().trim().min(1, "Owner name is required"),
  email: z.string().trim().email(),
  store_name: z.string().trim().min(1, "Store name is required"),
  address: z.string().trim().optional(),
});

const editMerchantSchema = z.object({
  owner_name: z.string().trim().min(1, "Owner name is required"),
  email: z.string().trim().email(),
  store_name: z.string().trim().min(1, "Store name is required"),
  address: z.string().trim().optional(),
});

module.exports = { approveSchema, createMerchantSchema, editMerchantSchema };
