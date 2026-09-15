# Payment Gateway

The Payment Gateway from `CLAUDE.md`'s payment ecosystem: merchant onboarding, hosted checkout sessions, wallets, refunds. It never stores card data itself — it forwards it server-to-server to the Bank System and never persists it. See root `README.md` (§2 Security & data boundaries) and `TEAM_PLAN.md` for the full cross-system contract.

**Status:** Milestone 1 of 5 (foundation) — see `/Users/mohammedsajidulislam/.claude/plans/harmonic-frolicking-pearl.md` for the full milestone plan. Only `/health` exists so far; no auth/checkout/wallet/refund endpoints yet.

## Stack

Node.js + Express + EJS (checkout page, admin panel) + Prisma + PostgreSQL, validated with Zod, logged with pino, JWT for merchant/admin auth. Deliberately mirrors `bank-system/`'s conventions exactly — same logging format, same error hierarchy, same idempotency-first pattern for money-moving calls — so both codebases feel like one system to work in.

## Quick start (Docker)

```bash
docker compose up -d --build   # from the repo ROOT, not this folder
```

This app's Docker setup lives in the repo root's `docker-compose.yml` alongside the Bank System's — they're still independent applications (separate codebase, separate Dockerfile, separate `package.json`), just orchestrated together for local-dev convenience on one shared Postgres server. That's also why, from Milestone 3 onward, this Gateway can reach the real Bank System at `http://bank-system:8001` (same Docker network) instead of needing `host.docker.internal`.

- API base: http://localhost:8000/api
- Health check: http://localhost:8000/health

## Quick start (without Docker)

```bash
docker compose up -d postgres   # from the repo root - just the shared DB
npm install
cp .env.example .env
npx prisma migrate dev
node prisma/seed.js
npm run dev
```

## Environment variables (`.env`)

| Var | Meaning |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | Signs merchant/admin JWTs (Milestone 2+) |
| `SESSION_SECRET` | Reserved for admin-session use (Milestone 5) |
| `BANK_API_BASE_URL`, `BANK_API_KEY` | Where the real Bank System lives and its shared secret — this Gateway's copy of the same key the Bank System's `.env` expects as `X-API-KEY` |
| `CHECKOUT_SESSION_TTL_MINUTES` | How long a checkout session stays payable (default 5) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Used only by `prisma/seed.js` to create the first admin login |

## Response & error conventions

Ported directly from `bank-system/src/{errors,logger}.js` and `src/middleware/{errorHandler,requestLogger,validate}.js` — read those for the authoritative version, this is the same code:

- **Errors**: always `{success:false, error:{code,message,details?}, status_code}`, thrown as one of `AppError`'s subclasses (`src/errors.js`) and caught once, centrally, by `src/middleware/errorHandler.js`. Never hand-build this shape in a route.
- **Success**: plain, purpose-shaped JSON for that endpoint — not force-wrapped in an envelope. List endpoints return `{items, total, page, page_size, pages}`.
- **Logging**: one composed line per event — `METHOD path -> status (Xms)` for requests, `METHOD path -> status [CODE] message` for handled errors, and a concise `src/`-only `file:line` (via `src/utils/errorUtils.js`) for anything unexpected. Same simple format in Docker and locally, no structured JSON dump.
- **Validation**: Zod schemas under `src/validators/`, applied via `src/middleware/validate.js`'s `validateBody(schema)`.

## Schema (Milestone 1)

`Currency`, `Bank` (display-only reference data — the real Bank System URL/key live in `.env`, never in a DB row), `User`/`Merchant` (one merchant per user, a single `sk_test_...` API key stored only as a SHA-256 hash + a plaintext prefix for display), `PricingPlan` (a merchant's negotiated fee per currency — "the deal," admin-assigned in Milestone 2/5, not self-selected), `Wallet` (merchant balance per currency), `Transaction` (one row per checkout session, with `expires_at`/`decline_reason`/`bank_reference`/`success_url`/`fail_url`), `Refund`.

Full field-level detail: `prisma/schema.prisma`.
