# Ecommerce App — Bookworm Cafe

The thin client from `CLAUDE.md`'s payment ecosystem: 2 fixed books, a customer buys one and pays via the Payment Gateway. Never touches card data — only `order_id`/`amount` and a redirect. See root `README.md` and `TEAM_PLAN.md` (Module 6) for the full cross-system contract.

## What makes this different from a typical toy shop

This shop is itself **a merchant of the Payment Gateway** — the same relationship a real bookstore has with Stripe or SSLCommerz. That means it needs a real, Gateway-issued merchant API key before checkout will work.

**Provisioning is manual, on purpose.** There is no code here that registers this shop or logs into the Gateway automatically - the 3 systems are separate, independently-run businesses in this simulation, and nothing should reach across that boundary holding someone else's login. Get a key the same way a real merchant does: register at the Gateway, wait for the Gateway's own admin to approve the account, then paste the issued key into `GATEWAY_API_KEY`. Full step-by-step: root `README.md`'s "Provisioning a merchant" section.

## Stack

Node.js + Express + EJS + Prisma + PostgreSQL + pino, mirroring `bank-system`/`payment-system`'s logging/error conventions exactly (one log line per request, `AppError` hierarchy, `res.locals`-based single-log-point).

## Quick start (Docker)

```bash
docker compose up -d --build   # from the repo root
```

Checkout will fail with "payment account is still pending approval" until
you've provisioned a real `GATEWAY_API_KEY` for this service (see root
`README.md`) - that's expected, not a bug.

- Shop: http://localhost:3000
- Health: http://localhost:3000/health

## Quick start (without Docker)

```bash
docker compose up -d postgres bank-system payment-gateway   # from the repo root
npm install
cp .env.example .env
# provision a real merchant (root README's "Provisioning a merchant"), then
# put the api_key it gives you into .env as GATEWAY_API_KEY
npx prisma migrate dev
npm run dev
```

## The flow

1. `GET /` — 2 books, a "Buy now" form (name field, no account needed)
2. `POST /orders` — creates a local `Order(pending)`, calls the Gateway's `checkout/init` using this shop's own API key, redirects the customer to the returned `checkout_url`
3. Customer pays on the Gateway's hosted page (this app never sees the card)
4. Gateway redirects back to `/success` or `/fail` — **both routes call the Gateway's `verify` endpoint server-side before trusting anything**, updating the local order to `paid`/`failed` based on the real status, not the redirect's query string

## Schema

`Order` (product, buyer name, amount, status, invoice_id, decline_reason). The merchant API key itself is never stored in this app's database - it lives only in config (`GATEWAY_API_KEY`), the same as `payment-system`'s `BANK_API_KEY`.
