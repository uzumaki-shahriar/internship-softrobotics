const bcrypt = require("bcryptjs");
const prisma = require("../db");
const bankClient = require("../clients/bankClient");
const { ConflictError, NotFoundError, ValidationError } = require("../errors");
const {
  generateStoreId,
  generateApiKey,
  apiKeyPrefix,
  hashApiKey,
  generateTemporaryPassword,
} = require("../utils/generators");

async function createMerchant({ name, email, password, store_name, address }) {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) throw new ConflictError("Email already registered");

  const passwordHash = await bcrypt.hash(password, 10);
  const fullApiKey = generateApiKey();

  // Retry on the (astronomically unlikely) chance of a store_id collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const storeId = generateStoreId();
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { name, email, passwordHash, userType: "merchant" },
        });
        const merchant = await tx.merchant.create({
          data: {
            userId: user.id,
            storeId,
            name: store_name,
            address,
            apiKeyHash: hashApiKey(fullApiKey),
            apiKeyPrefix: apiKeyPrefix(fullApiKey),
            status: "pending",
          },
        });
        return { user, merchant };
      });

      return { ...result, fullApiKey };
    } catch (err) {
      if (err.code === "P2002" && err.meta?.target?.includes("store_id")) continue;
      throw err;
    }
  }
  throw new Error("Failed to generate a unique store_id after 5 attempts");
}

/**
 * Self-service registration - a merchant gets a working API key
 * immediately, but starts "pending": every server-to-server call is
 * rejected (see apiKeyAuth) until an admin reviews and approves them with
 * a commission. Mirrors real underwriting - Stripe's test-mode signup is
 * instant, but live charging is gated behind business verification.
 */
async function registerMerchant(input) {
  return createMerchant(input);
}

/**
 * Admin-assisted onboarding (e.g. a merchant signed up over a sales call
 * rather than self-registering). A random temporary password is generated
 * - the admin never chooses a password on someone else's behalf - and
 * returned once, the same "shown exactly once" treatment as the API key.
 * There's no forced-change-on-first-login flow here (a real product would
 * add one); note it to the admin as a known follow-up.
 */
async function createMerchantByAdmin({ name, email, store_name, address }) {
  const temporaryPassword = generateTemporaryPassword();
  const result = await createMerchant({ name, email, password: temporaryPassword, store_name, address });
  return { ...result, temporaryPassword };
}

/**
 * Corrects business details an admin is trusted to fix on a merchant's
 * behalf (a typo'd business name, a changed address, a login email that
 * bounced). Never touches the password or API key - those are the
 * merchant's own to manage (login + regenerate, respectively).
 */
async function updateMerchantDetails(merchantId, { owner_name, email, store_name, address }) {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) throw new NotFoundError("Merchant not found");

  if (email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== merchant.userId) {
      throw new ConflictError("Email already in use by another account");
    }
  }

  const [, updatedMerchant] = await prisma.$transaction([
    prisma.user.update({
      where: { id: merchant.userId },
      data: { ...(owner_name && { name: owner_name }), ...(email && { email }) },
    }),
    prisma.merchant.update({
      where: { id: merchantId },
      data: { name: store_name || merchant.name, address },
    }),
  ]);
  return updatedMerchant;
}

async function regenerateApiKey(merchantId) {
  const fullApiKey = generateApiKey();
  const merchant = await prisma.merchant.update({
    where: { id: merchantId },
    data: { apiKeyHash: hashApiKey(fullApiKey), apiKeyPrefix: apiKeyPrefix(fullApiKey) },
  });
  return { merchant, fullApiKey };
}

async function getMerchantProfile(merchantId) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    include: { pricingPlans: { include: { currency: true } }, wallets: { include: { currency: true } } },
  });
  if (!merchant) throw new NotFoundError("Merchant not found");
  return merchant;
}

async function listMerchants({ page, pageSize }) {
  const [items, total] = await Promise.all([
    prisma.merchant.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { pricingPlans: { include: { currency: true } } },
    }),
    prisma.merchant.count(),
  ]);
  return { items, total, page, page_size: pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

/**
 * Sets/updates a merchant's commission "deal" for one currency and ensures
 * they're active. Reused for both first approval and later renegotiating a
 * currency's rate - upsert semantics, not a one-time-only action.
 */
async function approveMerchant(
  merchantId,
  { currency, commission_percentage, commission_fixed, settlement_day, rolling_percentage, rolling_period }
) {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) throw new NotFoundError("Merchant not found");

  const currencyRow = await prisma.currency.findUnique({ where: { code: currency } });
  if (!currencyRow) throw new NotFoundError(`Currency ${currency} is not supported`);

  const [pricingPlan] = await prisma.$transaction([
    prisma.pricingPlan.upsert({
      where: { merchantId_currencyId: { merchantId, currencyId: currencyRow.id } },
      update: {
        commissionPercentage: commission_percentage,
        commissionFixed: commission_fixed,
        settlementDay: settlement_day,
        rollingPercentage: rolling_percentage,
        rollingPeriod: rolling_period,
      },
      create: {
        merchantId,
        currencyId: currencyRow.id,
        commissionPercentage: commission_percentage,
        commissionFixed: commission_fixed,
        settlementDay: settlement_day,
        rollingPercentage: rolling_percentage,
        rollingPeriod: rolling_period,
      },
    }),
    prisma.wallet.upsert({
      where: { merchantId_currencyId: { merchantId, currencyId: currencyRow.id } },
      update: {},
      create: { merchantId, currencyId: currencyRow.id, balance: 0 },
    }),
    prisma.merchant.update({ where: { id: merchantId }, data: { status: "active" } }),
  ]);

  return pricingPlan;
}

/**
 * Links the merchant's real payout account at the Bank System - settlement
 * and rolling release pay out here (see settlementService.js). Only
 * confirms the account exists; the Bank's balance endpoint doesn't expose
 * account type, so a personal account can't be rejected here.
 */
async function setBankAccount(merchantId, accountNumber) {
  const account = await bankClient.getAccountBalance(accountNumber);
  if (!account) throw new ValidationError("Bank account number not found");

  return prisma.merchant.update({
    where: { id: merchantId },
    data: { bankAccountNumber: accountNumber },
  });
}

async function setMerchantStatus(merchantId, status) {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) throw new NotFoundError("Merchant not found");
  return prisma.merchant.update({ where: { id: merchantId }, data: { status } });
}

module.exports = {
  registerMerchant,
  createMerchantByAdmin,
  updateMerchantDetails,
  regenerateApiKey,
  getMerchantProfile,
  listMerchants,
  approveMerchant,
  setMerchantStatus,
  setBankAccount,
};
