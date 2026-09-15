# Mini Payment Ecosystem

## What this is

A learning project simulating how real card payment systems work (SSLCommerz/Stripe/bKash-style), built as **3 completely separate applications** — different codebases, different databases, different ports — that only ever talk to each other over HTTP APIs. Never take a shortcut that has one system reach into another's database directly; that would defeat the entire point of the exercise.

Full narrative and rationale: root `README.md`. Per-module specs and handoff contracts: `TEAM_PLAN.md`. Both are living docs — when a design decision changes, update them, don't let them drift from the code.

## The scenario, end to end

A customer buys something on the **Ecommerce App**. At checkout, the shop hands the customer off to the **Payment Gateway** instead of touching payment details itself — exactly like a real store integrates Stripe/SSLCommerz rather than handling cards itself. The customer enters their card (number, expiry, CVV, name) on the Gateway's hosted checkout page. The Gateway forwards that to the **Bank System**, which is the only system that owns accounts and cards — it validates everything a real bank would (card valid and not expired, CVV matches, card not blocked, account not frozen/closed, enough balance, within the daily limit) and returns either an approval or a specific decline reason. On approval, the Gateway calculates its fee, marks the sale complete, and credits the merchant's internal wallet. Later, the Gateway settles that wallet balance out to the merchant's actual bank account by calling the Bank System's payout endpoint — the same way a real acquirer/PSP eventually wires accumulated sales to a merchant's bank.

```
Customer  →  Ecommerce App  →  Payment Gateway  →  Bank System
                                (holds merchant       (owns accounts, cards,
                                 wallets + fees)        approves/declines,
                                                         pays out to merchants)
```

## The one rule that matters most

**Only the Bank System is ever allowed to store a full card number or CVV.** The Gateway's checkout page collects the card and forwards it server-to-server to the Bank System, but never persists it (at most a masked last-4 for display). The Ecommerce App never sees card data at all — only `order_id`/`amount` and a redirect. Every money-moving call (charge, refund, payout) carries an idempotency key so a network retry can never double-charge, double-refund, or double-pay-out. See root `README.md` §2 for the full reasoning — this isn't a style preference, it's the thing that makes the simulation actually resemble real payment architecture instead of one app in three folders.

Also load-bearing: **the customer never picks their bank at checkout.** The card itself determines the issuing bank (the Bank System tells the Gateway which bank it is), the same way a real checkout never asks "which bank are you with?" — that would be like asking someone which credit bureau to check.

## The 3 systems

| System | Path | Owns | Status |
|---|---|---|---|
| Bank System | `bank-system/` | Accounts, cards, its own ledger | **Built** — see below |
| Payment Gateway | `payment-system/` | Merchants, transactions, pricing plans, wallets, refunds | **Built (all 5 milestones)** — see below |
| Ecommerce App | *(not started)* | Products, orders, cart | Not started |

Each has its own `README.md` with setup instructions and conventions — read the relevant one before touching that system's code. This file is the map, not the manual.

### Bank System (`bank-system/`) — built

Node.js + Express + EJS + Prisma + PostgreSQL, Zod validation, pino logging. One running instance = one bank (parameterized by `.env`: `BANK_NAME`, `BANK_CODE`, `PORT`, `DATABASE_URL` — copy the service and change these to simulate a second bank later; not done yet, single instance only for now per explicit direction).

- `POST /api/cards/charge`, `POST /api/cards/refund`, `POST /api/accounts/payout`, `GET /api/accounts/{account_number}/balance` — all server-to-server, `X-API-KEY` protected, all idempotent.
- Full decline-reason taxonomy (`INVALID_CARD`, `EXPIRED_CARD`, `CVV_MISMATCH`, `CARD_BLOCKED`, `ACCOUNT_FROZEN`, `ACCOUNT_CLOSED`, `INSUFFICIENT_FUNDS`, `LIMIT_EXCEEDED`, `CURRENCY_NOT_SUPPORTED`, plus refund/payout-specific ones) — every decline gets a real ledger row, not just successes.
- Accounts have a `type`: `personal` (has cards, pays) or `business` (a merchant's payout account — no card, only ever receives credits via `/api/accounts/payout`). A merchant account is just a plain bank account the admin opened, same as any other — the Bank System has no concept of "merchant" at all, that's the Gateway's job to track (which account number belongs to which of its merchants).
- Admin panel (session auth): dashboard, accounts (create/freeze/unfreeze/close), cards (create/block/unblock), transaction ledger.
- Seed data deliberately includes broken cases (frozen account, blocked/expired card, low limit, insufficient funds) so decline paths are testable, not just the happy path. See `bank-system/README.md` for the full table.
- Run via `docker compose up -d --build` from the repo root (`docker-compose.yml` lives at root and now also runs the Payment Gateway alongside it, on the same shared Postgres server, in its own `payment_gateway` database).

### Payment Gateway (`payment-system/`) — built, all 5 milestones

Rebuilt from an earlier FastAPI/SQLModel start (deleted, was fully recoverable via git history) into **Node.js + Express + EJS + Prisma + PostgreSQL + Zod + pino + jsonwebtoken**, deliberately mirroring `bank-system/`'s conventions exactly (same `AppError` hierarchy, same central error handler and response envelope, same request/error logging format, same idempotency-first pattern). No `backend`/`frontend` split — it's one Express app serving both the JSON API and the EJS-rendered checkout/admin pages, same as `bank-system`. Full plan: `/Users/mohammedsajidulislam/.claude/plans/harmonic-frolicking-pearl.md` (5 milestones, each independently demoable).

Schema (`prisma/schema.prisma`): `Currency`, `Bank` (display-only reference row — the real Bank System URL/key live in `.env`, never in a DB row), `User`/`Merchant` (one merchant per user; a single `sk_test_...` API key stored only as a SHA-256 hash + a plaintext prefix for display, never the raw key after issuance), `PricingPlan` (a merchant's negotiated commission "deal" per currency — admin-assigned, not self-selected), `Wallet`, `Transaction` (one row per checkout session — `expires_at`, `decline_reason`, `bank_reference`, `success_url`/`fail_url`, `status` enum), `Refund`.

**Merchant onboarding is admin-gated, not instant-active** (a deliberate refinement after Milestone 1): a merchant self-registers via `POST /api/merchant/register` and gets a working API key immediately, but starts `status: pending` — every `X-API-KEY`-authenticated call is rejected (403) until the platform's admin reviews them and calls `POST /api/admin/merchants/:id/approve` with a commission (`commission_percentage`, `commission_fixed`, `settlement_day`) for a currency, which creates/updates their `PricingPlan`, ensures a `Wallet`, and flips them to `active`. This mirrors real underwriting (Stripe: instant test-mode signup, but live charging needs business verification) more accurately than pure instant self-service. The same approve endpoint is reused later to renegotiate a currency's rate, not just for first approval.

Done: full schema + migration, seed data, logging/error/validation scaffolding, `/health`; merchant registration/login, admin login, merchant profile, API key regeneration, the approve-with-commission flow, `GET /api/merchant/whoami`; the hosted checkout session (5-minute expiry, lazy expiry check at both page-render and pay-submit, `POST /api/checkout/init`, `GET/POST /checkout/:invoiceId`, `GET /api/transactions/:invoiceId/verify`) calling the real Bank System via `src/clients/bankClient.js` (idempotency key = invoice id, `GATEWAY_ERROR` decline on a timeout/unreachable bank rather than hanging or 500ing); real per-merchant fee calculation (`src/utils/fee.js`) crediting/debiting the `Wallet` on charge/refund (a refund only debits the wallet's *net* portion — the commission isn't refunded, matching real Stripe-style practice); `POST /api/refund` and `GET /api/merchant/transactions`; and an EJS admin panel (`src/routes/admin/`, session auth) — dashboard, merchant list/detail with the pricing-plan editor that's the actual "any merchant as per their deal" UI, suspend/reactivate, transactions (filterable), refunds, banks.

Full step-by-step test flow with every edge case exercised against the real running containers: `payment-system/TESTING.md`.

### Ecommerce App — not started

Thin client only: product listing, order creation, redirect to the Gateway's checkout, and a server-side `verify` call before marking an order paid (never trust the redirect alone). See `TEAM_PLAN.md` Module 6.

## Key design decisions already made (don't relitigate without a reason)

- **Card-based checkout, not "log into your bank."** Early drafts of this plan had the customer authenticate with an account number + password, like online banking. That's wrong for a card-payment simulation — real checkouts collect a card, not bank login credentials. Fixed; don't reintroduce it.
- **No manual bank selection at checkout.** The card determines the issuing bank. See "the one rule that matters most" above.
- **Merchants get their key from the Gateway, not from a bank.** This project simulates a payment facilitator / aggregator model (SSLCommerz/Stripe-style), not the traditional model where a merchant gets a Merchant ID directly from an acquiring bank. The Gateway's `store_id` + merchant API key (already built) is the correct, realistic mechanism for this style of gateway — don't add a competing bank-issued merchant credential.
- **The Payment Gateway schema has since diverged from `db.sql` on purpose, twice.** `db.sql`'s original `pos` (bank+currency-keyed fee config, no merchant link at all) couldn't express "different merchants get different deals," which the user explicitly asked for — so the Node rewrite renamed it `PricingPlan`, keyed by `merchant_id` + `currency_id`, and dropped `bank_id`/`bank_fee` entirely (real aggregators quote one flat rate per merchant regardless of which bank issued the card). `wallets` is now keyed by `merchant_id`, not `user_id`, for the same reason. This is a deliberate, reasoned departure from the earlier "stay close to `db.sql`" instinct — the schema should serve the real requirement, not fidelity to a dump that predates the "per-merchant deal" requirement.
- **Logging philosophy, both systems:** every log line is a single, deliberately composed string — level *first*, then endpoint, and (for real exceptions) a concise `file:line` pointing at *our own* code, never a raw framework stack dump or a structured JSON blob. Both systems use pino identically (`bank-system/src/logger.js`, `payment-system/src/logger.js` — literally the same `levelFirst: true, ignore: "pid,hostname"` pino-pretty config in both). Don't reach for `console.log`, and don't let a caught error get logged twice (throw and let the one central handler log it once).
- **Docker scope:** `docker-compose.yml` at the repo root orchestrates all systems together for local-dev convenience (one shared Postgres server, multiple databases - `bank_demo`, `payment_gateway`, room for more) plus each app's own service block (`bank-system`, `payment-gateway`, later the Ecommerce App). This is convenience orchestration only, not a merger — each app is still a fully separate codebase/Dockerfile/dependency tree, and nothing here lets one app query another's database. Don't create a second, separate compose file per app; add a new service block here instead.

## Known, intentional simplifications vs. real card payments

(Full list: root `README.md` §9.) The biggest one: a real charge routes through an acquiring bank → card network (Visa/Mastercard rails) → issuing bank — at least three parties. This project collapses all of that into one Bank System. Also skipped: 3-D Secure/OTP step-up auth, chargebacks/disputes, fraud scoring, saved/tokenized cards, FX conversion. These are deliberate scope cuts for a learning project, not oversights — don't "fix" them without checking whether that's actually wanted.
