/**
 * Runs once at container startup (see docker-entrypoint.sh), before the
 * server starts serving traffic. This shop is itself a merchant of the
 * Payment Gateway - a real integration would do this by hand once (sign up
 * in the dashboard, get approved, paste the key into .env). Automating it
 * here means `docker compose up` brings up the entire chain - Bank System,
 * Payment Gateway, this shop - with zero manual configuration, using the
 * exact same public APIs a human would use.
 *
 * Idempotent: safe to run on every container start. Fast-exits once a
 * ShopConfig row exists.
 */
require("dotenv").config();
const prisma = require("./db");
const config = require("./config");
const logger = require("./logger");

// docker-compose's depends_on only guarantees the Gateway's *container
// process started*, not that its own migrate+seed entrypoint has finished
// and it's actually accepting requests yet - so retry with backoff rather
// than fail on the first connection refused.
async function waitForGateway(maxAttempts = 15, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(`${config.gatewayBaseUrl}/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) return;
    } catch {
      // not up yet - fall through to retry
    }
    logger.info(`Waiting for Payment Gateway at ${config.gatewayBaseUrl} (attempt ${attempt}/${maxAttempts})`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`Payment Gateway never became reachable at ${config.gatewayBaseUrl}`);
}

async function gatewayFetch(path, options) {
  const res = await fetch(`${config.gatewayBaseUrl}${path}`, options);
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function registerOrRecover() {
  const register = await gatewayFetch("/api/merchant/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: config.bootstrap.ownerName,
      email: config.bootstrap.ownerEmail,
      password: config.bootstrap.ownerPassword,
      store_name: config.bootstrap.storeName,
    }),
  });

  if (register.ok) {
    logger.info(`Registered as a new merchant: ${register.body.store_id}`);
    return { merchantId: register.body.merchant_id, storeId: register.body.store_id, apiKey: register.body.api_key };
  }

  if (register.status !== 409) {
    throw new Error(`Merchant registration failed: ${register.body?.error?.message || register.status}`);
  }

  // Already registered from a prior bootstrap attempt that crashed before
  // ShopConfig got saved - log back in and mint a fresh key since the
  // original was never persisted anywhere we can read it back from.
  logger.info("Already registered from a previous attempt - recovering credentials");
  const login = await gatewayFetch("/api/merchant/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: config.bootstrap.ownerEmail, password: config.bootstrap.ownerPassword }),
  });
  if (!login.ok) throw new Error(`Recovery login failed: ${login.body?.error?.message || login.status}`);

  const regenerate = await gatewayFetch("/api/merchant/api-key/regenerate", {
    method: "POST",
    headers: { Authorization: `Bearer ${login.body.token}` },
  });
  if (!regenerate.ok) throw new Error(`Recovery key regeneration failed: ${regenerate.status}`);

  return {
    merchantId: login.body.merchant.id,
    storeId: login.body.merchant.store_id,
    apiKey: regenerate.body.api_key,
  };
}

async function approve(merchantId) {
  if (!config.bootstrap.adminEmail || !config.bootstrap.adminPassword) {
    throw new Error("GATEWAY_ADMIN_EMAIL / GATEWAY_ADMIN_PASSWORD must be set to self-approve on bootstrap");
  }

  const adminLogin = await gatewayFetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: config.bootstrap.adminEmail, password: config.bootstrap.adminPassword }),
  });
  if (!adminLogin.ok) throw new Error(`Admin login failed: ${adminLogin.body?.error?.message || adminLogin.status}`);

  // Upsert semantics on the Gateway side - safe to call even if this
  // merchant is already approved (just re-affirms the same commission).
  const approveRes = await gatewayFetch(`/api/admin/merchants/${merchantId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminLogin.body.token}` },
    body: JSON.stringify({
      currency: config.gatewayCurrency,
      commission_percentage: config.bootstrap.commissionPercentage,
      commission_fixed: config.bootstrap.commissionFixed,
      settlement_day: 3,
    }),
  });
  if (!approveRes.ok) throw new Error(`Admin approval failed: ${approveRes.body?.error?.message || approveRes.status}`);
}

async function bootstrap() {
  const existing = await prisma.shopConfig.findFirst({ orderBy: { id: "desc" } });
  if (existing) {
    logger.info(`Already provisioned as merchant ${existing.storeId} - skipping bootstrap`);
    return;
  }

  await waitForGateway();
  const { merchantId, storeId, apiKey } = await registerOrRecover();
  await approve(merchantId);
  await prisma.shopConfig.create({ data: { storeId, merchantApiKey: apiKey } });
  logger.info(`Provisioned as merchant ${storeId} and approved for ${config.gatewayCurrency}`);
}

bootstrap()
  .catch((err) => {
    logger.error(`Bootstrap failed: ${err.message}`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
