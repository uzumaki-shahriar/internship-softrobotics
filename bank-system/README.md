# Bank System

A simulated bank. **One running instance = one bank.** It owns accounts and
cards, validates and processes card charges/refunds the way a real bank
actually would (declines with a real reason, never double-charges on retry),
and gives that bank's admin a panel to monitor and manage it.

See the repo root `README.md` (§2 Security & data boundaries, §3 Bank
System) and `TEAM_PLAN.md` (Module 1) for the full cross-system contract this
implements. In short: **this is the only system allowed to store a full card
number or CVV** - the Payment Gateway forwards card data to us and never
persists it itself.

## Stack

Node.js + Express + EJS (server-rendered admin panel) + Prisma + PostgreSQL,
validated with Zod, logged with pino. Session-based admin auth
(`express-session`).

## Quick start (Docker - recommended)

```bash
docker compose up -d --build
```

This starts Postgres and the bank app together, running migrations and the
idempotent seed script automatically on boot (see `docker-entrypoint.sh`).

- Admin panel: http://localhost:8001/admin/login
- API base: http://localhost:8001/api
- Health check: http://localhost:8001/health

Default seeded admin login: `admin@bank.local` / `admin123` (override via
`ADMIN_EMAIL`/`ADMIN_PASSWORD` in `docker-compose.yml` before first boot).

`docker-compose.yml` lives at the repo root, not in this folder - the bank
system is a fully independent app from the Payment Gateway and Ecommerce
App, but its Postgres container is a convenient shared local-dev database
server (see the comment at the top of that file). Bring it down with
`docker compose down` (add `-v` to also wipe the database volume).

## Quick start (without Docker)

```bash
npm install
cp .env.example .env   # then point DATABASE_URL at a real Postgres you control
npx prisma migrate dev
node prisma/seed.js
npm run dev             # nodemon, restarts on file changes
```

## Environment variables (`.env`)

| Var | Meaning |
|---|---|
| `BANK_NAME`, `BANK_CODE` | This instance's identity - shown in the admin UI, used to derive card BIN prefixes. Change these (+ `DATABASE_URL`, `PORT`) to run a second bank instance. |
| `BANK_CURRENCY` | The only currency this bank will approve charges/payouts in. Anything else gets declined with `CURRENCY_NOT_SUPPORTED`. |
| `DATABASE_URL` | Postgres connection string. |
| `BANK_API_KEY` | Shared secret the Payment Gateway must send as `X-API-KEY` on every `/api/*` call. |
| `SESSION_SECRET` | Signs the admin session cookie. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Used only by `prisma/seed.js` to create the first admin login. |

## API (for the Payment Gateway - server-to-server, `X-API-KEY` required)

All money-moving endpoints require an `idempotency_key`: replaying the same
key returns the exact original result instead of processing again.

### `POST /api/cards/charge`

```json
{
  "card_number": "4242424242424242",
  "card_holder_name": "John Doe",
  "expiry_month": 12,
  "expiry_year": 2027,
  "cvv": "123",
  "amount": 500.00,
  "currency": "BDT",
  "idempotency_key": "INV-0001",
  "reference": "INV-0001"
}
```

Returns `{"status":"approved","bank_reference":"...","balance_after":...}` or
`{"status":"declined","decline_reason":"..."}`.

Validation order (first failure wins): `CURRENCY_NOT_SUPPORTED` →
`INVALID_CARD` → `EXPIRED_CARD` → `CVV_MISMATCH` → `CARD_BLOCKED` →
`ACCOUNT_FROZEN` / `ACCOUNT_CLOSED` → `INSUFFICIENT_FUNDS` →
`LIMIT_EXCEEDED` (a rolling sum of today's approved debits, not just this
one transaction).

### `POST /api/cards/refund`

```json
{ "bank_reference": "TXN-DEMO001-...", "amount": 200.00, "idempotency_key": "INV-0001:refund:1" }
```

Always ties back to the original charge via `bank_reference` - a real bank
won't credit an account for a charge it never made. Declines:
`REFERENCE_NOT_FOUND`, `ORIGINAL_NOT_APPROVED`, `REFUND_EXCEEDS_CHARGE`
(partial refunds are fine; refunding more than what's left on the original
charge is not).

### `POST /api/accounts/payout`

```json
{ "account_number": "DEMO5225871423", "amount": 485.00, "currency": "BDT", "idempotency_key": "SETTLE-...", "reference": "SETTLE-..." }
```

Deposits money into an account with **no card and no link to a prior
charge** - this is how a merchant's payout account actually receives
settlement money (see "Merchant accounts" below). Declines:
`CURRENCY_NOT_SUPPORTED`, `ACCOUNT_NOT_FOUND`, `ACCOUNT_FROZEN`,
`ACCOUNT_CLOSED`.

### `GET /api/accounts/{account_number}/balance`

Testing/admin convenience - `{"account_number":"...","balance":...,"status":"active"}`.

## Merchant accounts

An `Account` has a `type`: `personal` (a customer, pays by a linked card) or
`business` (a merchant's payout account - only ever receives credits via the
payout endpoint above, never has a card). This mirrors real life: a merchant
account is just a bank account a business opened, set up by the bank's
admin (or its onboarding team) the same way any account is opened - not a
special "merchant" concept the bank needs to understand. The Payment Gateway
is the one that knows *which* account number belongs to *which* merchant,
and calls `/api/accounts/payout` to settle into it. The seed data creates
one (`Merchant One`, matching the merchant seeded in the Payment Gateway).

The admin panel's "New account" form lets you create either type.

## Admin panel

- **Dashboard** - account/card counts, total balance held, today's
  transaction and decline counts.
- **Accounts** - list, create (personal or business), view detail (cards +
  recent transactions), freeze/unfreeze/close.
- **Cards** - list, create for an existing account (number/CVV are
  generated - a Luhn-valid 16-digit number derived from `BANK_CODE`, so
  cards from different bank instances don't collide), block/unblock.
- **Transactions** - full ledger, approved and declined, filterable by
  status.

## Seed data (`prisma/seed.js`, idempotent - safe to re-run)

Deliberately includes broken cases so decline paths are testable, not just
the happy path:

| Holder | Purpose |
|---|---|
| John Doe | Happy path - active account, active card |
| Jane Smith | `INSUFFICIENT_FUNDS` (balance ৳100) |
| Low Limit Larry | `LIMIT_EXCEEDED` (daily limit ৳200) |
| Frozen Fred | `ACCOUNT_FROZEN` |
| Blocked Bob | `CARD_BLOCKED` |
| Expired Eve | `EXPIRED_CARD` |
| Merchant One | Business/payout account, no card |

Card numbers and CVVs are printed to the console on seed - read them from
there (or the admin UI's account detail page shows a masked version) rather
than the database directly.

## Logging & error handling

One rule: every log line is a single, self-composed string - `LABEL |
endpoint | message`, not structured JSON key-value dumps. See
`src/logger.js` (same simple format in Docker and locally) and
`src/middleware/errorHandler.js`. An unexpected exception logs a concise,
`src/`-only file:line (via `src/utils/errorUtils.js` - it skips
node_modules/Express-internal frames so the log points straight at the bug)
instead of a full raw stack trace. Business logic (`src/services/*`) never
calls `logger.exception`-style APIs itself for an error it's about to
return as a decline - declines aren't exceptions, they're a normal,
expected response (see `chargeService.js`), logged once as a warning.

All custom errors extend `AppError` (`src/errors.js`) and get one
consistent JSON shape on `/api/*` routes: `{"success":false,"error":{"code":...,"message":...},"status_code":...}`.

## Known simplifications (see root `README.md` §9 for the full list)

- Session store is in-memory (`express-session`'s default) - fine for one
  dev instance, would need a real store (Redis, `connect-pg-simple`) for
  multiple admin-panel processes.
- No 3-D Secure/OTP step-up, no fraud scoring, no chargebacks - see root
  README for what's intentionally out of scope.
- The daily spending limit re-sums today's approved debits on every charge
  rather than maintaining a running counter - fine at this scale, would
  need a different approach at real transaction volume.
