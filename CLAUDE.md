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
| Payment Gateway | `payment-system/backend/` | Merchants, transactions, fee config, wallets, refunds | **Partially built** — see below |
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

### Payment Gateway (`payment-system/backend/`) — partially built

FastAPI + SQLModel + PostgreSQL, Alembic migrations, loguru logging. Schema mirrors the original `db.sql` (banks, currencies, merchants, users, pos, wallets, transactions, refunds) — see `payment-system/backend/README.md` for the required response envelope (`ApiResponse`/`PaginatedResponse`), exception conventions (`AppException` subclasses, never a bare `HTTPException` for domain errors), and logging setup. **Read that README before adding any route or model here** — it documents hard conventions, not suggestions.

Done: DB schema + migrations, seed data, config/logging/error-handling scaffolding, `/health` router.
Not yet built: merchant auth (JWT), the actual checkout/charge flow (calling the Bank System's `/api/cards/charge`), wallet/refund endpoints, admin panel. These map to Modules 3–5 and 7 in `TEAM_PLAN.md`.

One concrete follow-up already flagged in `TEAM_PLAN.md`: `transactions` will need a `decline_reason` column (and a way to remember the Bank System's `bank_reference` for refunds) once the checkout flow is built — not added yet since Module 4 hasn't started.

### Ecommerce App — not started

Thin client only: product listing, order creation, redirect to the Gateway's checkout, and a server-side `verify` call before marking an order paid (never trust the redirect alone). See `TEAM_PLAN.md` Module 6.

## Key design decisions already made (don't relitigate without a reason)

- **Card-based checkout, not "log into your bank."** Early drafts of this plan had the customer authenticate with an account number + password, like online banking. That's wrong for a card-payment simulation — real checkouts collect a card, not bank login credentials. Fixed; don't reintroduce it.
- **No manual bank selection at checkout.** The card determines the issuing bank. See "the one rule that matters most" above.
- **Merchants get their key from the Gateway, not from a bank.** This project simulates a payment facilitator / aggregator model (SSLCommerz/Stripe-style), not the traditional model where a merchant gets a Merchant ID directly from an acquiring bank. The Gateway's `store_id` + merchant API key (already built) is the correct, realistic mechanism for this style of gateway — don't add a competing bank-issued merchant credential.
- **Sticking close to the original `db.sql` field names/relations** for the Payment Gateway schema (e.g. `pos` keyed by `bank_id` + `currency_id`, `wallets` keyed by `user_id` with an `amount` column, `transaction_state` enum) rather than a redesigned schema — even where a cleaner design was tempting, matching the existing dump was an explicit choice so the schema stays recognizable to whoever wrote `db.sql`.
- **Logging philosophy, both systems:** every log line is a single, deliberately composed string — level, endpoint, and (for real exceptions) a concise `file:line` pointing at *our own* code, never a raw framework stack dump or a structured JSON blob. Loguru on the Python side (`payment-system/backend/app/core/logging.py`), pino on the Node side (`bank-system/src/logger.js`) — same philosophy, different library. Don't reach for `console.log`/`print`, and don't let a caught error get logged twice (raise/throw and let the one central handler log it once).
- **Docker scope:** `docker-compose.yml` at the repo root orchestrates all systems together for local-dev convenience (one shared Postgres server, multiple databases - `bank_demo`, `payment_gateway`, room for more) plus each app's own service block (`bank-system`, `payment-gateway`, later the Ecommerce App). This is convenience orchestration only, not a merger — each app is still a fully separate codebase/Dockerfile/dependency tree, and nothing here lets one app query another's database. Don't create a second, separate compose file per app; add a new service block here instead.

## Known, intentional simplifications vs. real card payments

(Full list: root `README.md` §9.) The biggest one: a real charge routes through an acquiring bank → card network (Visa/Mastercard rails) → issuing bank — at least three parties. This project collapses all of that into one Bank System. Also skipped: 3-D Secure/OTP step-up auth, chargebacks/disputes, fraud scoring, saved/tokenized cards, FX conversion. These are deliberate scope cuts for a learning project, not oversights — don't "fix" them without checking whether that's actually wanted.
