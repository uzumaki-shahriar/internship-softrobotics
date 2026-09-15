# Ecommerce App — Bookworm Cafe

The thin client from `CLAUDE.md`'s payment ecosystem: 2 fixed books, a customer buys one and pays via the Payment Gateway. Never touches card data — only `order_id`/`amount` and a redirect. See root `README.md` and `TEAM_PLAN.md` (Module 6) for the full cross-system contract.

## What makes this different from a typical toy shop

This shop is itself **a merchant of the Payment Gateway** — the same relationship a real bookstore has with Stripe or SSLCommerz. On first boot (`src/bootstrap.js`, run from `docker-entrypoint.sh` before the server starts), it:

1. Waits for the Payment Gateway to actually be reachable (container "started" ≠ "ready")
2. Self-registers as a merchant via `POST /api/merchant/register` (or recovers cleanly if a prior attempt registered but crashed before saving)
3. Logs in as the Gateway's admin and approves itself with a commission via `POST /api/admin/merchants/:id/approve`
4. Saves the resulting API key in its own database (`ShopConfig` table) — never in `.env`, never touched again

This means `docker compose up` at the repo root brings up the entire chain — Bank System → Payment Gateway → this shop — with zero manual API key configuration, using the exact same public APIs a real integration would use by hand.

## Stack

Node.js + Express + EJS + Prisma + PostgreSQL + pino, mirroring `bank-system`/`payment-system`'s logging/error conventions exactly (one log line per request, `AppError` hierarchy, `res.locals`-based single-log-point).

## Quick start (Docker)

```bash
docker compose up -d --build   # from the repo root
```

- Shop: http://localhost:3000
- Health: http://localhost:3000/health

## Quick start (without Docker)

```bash
docker compose up -d postgres bank-system payment-gateway   # from the repo root
npm install
cp .env.example .env
npx prisma migrate dev
node src/bootstrap.js   # one-time - registers + approves this shop
npm run dev
```

## The flow

1. `GET /` — 2 books, a "Buy now" form (name field, no account needed)
2. `POST /orders` — creates a local `Order(pending)`, calls the Gateway's `checkout/init` using this shop's own API key, redirects the customer to the returned `checkout_url`
3. Customer pays on the Gateway's hosted page (this app never sees the card)
4. Gateway redirects back to `/success` or `/fail` — **both routes call the Gateway's `verify` endpoint server-side before trusting anything**, updating the local order to `paid`/`failed` based on the real status, not the redirect's query string

## Schema

`Order` (product, buyer name, amount, status, invoice_id, decline_reason), `ShopConfig` (this shop's own merchant API key, one row).
