# Mini Payment Ecosystem — Project Plan

A learning project simulating how real payment gateways (SSLCommerz, Stripe, bKash style) work, built as **3 independent systems** that talk over HTTP APIs — exactly like production.

**The scenario:** a customer is buying something from an online shop (the Ecommerce App). At checkout, the shop (the merchant) doesn't handle the customer's card itself — it hands the customer off to our Payment Gateway, exactly like a real store uses Stripe/SSLCommerz instead of touching card numbers itself. The customer types their card details into the Gateway's checkout page. The Gateway sends that card to the Bank System, which is the only system that actually knows about accounts and cards — it validates the card, checks the account has enough money (and isn't frozen, expired, etc.), moves the money, and tells the Gateway whether the payment was approved or declined and why. The Gateway then pays the merchant (minus its fee) and tells the Ecommerce App how it went.

---

## 1. Why 3 separate systems (not 1 shared DB)

In the real world, a bank, a payment gateway, and a merchant's e-commerce store are **owned by different companies**. They never share a database — they only exchange data through APIs. We replicate that:

| System | Owns | Talks to |
|---|---|---|
| **Bank System** | Accounts, cards, balances, its own ledger | Exposes API for gateway to call |
| **Payment Gateway** | Merchants, transactions, POS/fee config, wallets, refunds (your `db.sql`) | Calls Bank API, receives calls from Ecommerce |
| **Ecommerce App** | Products, orders, cart | Calls Gateway API (redirect/checkout style) |

Each has **its own database**, its own codebase, its own server/port. This is the actual architecture of real payment systems.

---

## 2. Security & data boundaries (read this before building anything)

This is what makes the simulation actually resemble a real payment system instead of one shared app with three folders — get this rule wrong and the "3 independent systems" idea falls apart.

- **Only the Bank System ever stores a full card number or CVV.** The customer types their card into the Gateway's checkout page, but the Gateway forwards it straight to the Bank System over the server-to-server API and does **not** persist it — at most it may keep a masked display value (e.g. `**** **** **** 4242`) for the merchant's transaction history. This mirrors why real PCI-DSS compliance scoping exists: the fewer systems that touch raw card data, the smaller the blast radius of a leak.
- **The Ecommerce App never sees card data at all.** It only ever deals with `order_id`, `amount`, and a redirect to the Gateway. It finds out the payment result via the Gateway's `verify` endpoint, never from the card itself.
- **Every money-moving call carries an idempotency key.** A network timeout between Gateway and Bank must never be able to charge (or refund) the same payment twice. The Gateway generates a key per attempt (the `invoice_id` is a natural fit) and the Bank System must return the *same* result if it sees that key again instead of moving money a second time.
- **Declines are not exceptions, they're a normal response.** A real bank rejects payments constantly (insufficient funds, expired card, frozen account, wrong CVV). The Bank System returns a clear reason code for every decline (see §3) instead of the Gateway having to guess from an HTTP status.

---

## 3. System 1 — Bank System (build from scratch)

Simulates a real bank: it owns accounts and the cards linked to them, and it is the **only** place a full card number/CVV is allowed to exist.

```
accounts
  id, account_number (unique), holder_name, balance (default 1000.00),
  status (active | frozen | closed), daily_limit, created_at

cards
  id, account_id (FK), card_number, card_holder_name,
  expiry_month, expiry_year, cvv, status (active | blocked), created_at

bank_transactions   (bank's own internal ledger — one row per charge/refund attempt, success or decline)
  id, account_id, card_id, type (debit | credit), amount, balance_after,
  reference (Gateway's invoice_id), idempotency_key (unique), status (approved | declined),
  decline_reason (nullable), created_at
```

**API endpoints (called by Payment Gateway only, server-to-server):**

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/cards/charge` | Validate card + account, debit if everything checks out, return approved/declined |
| `POST` | `/api/cards/refund` | Credit the account tied to a previous approved charge |
| `GET` | `/api/accounts/{account_number}/balance` | Check balance (testing/admin use) |

`POST /api/cards/charge` request:
```json
{
  "card_number": "4242424242424242",
  "card_holder_name": "John Doe",
  "expiry_month": 12,
  "expiry_year": 2027,
  "cvv": "123",
  "amount": 500.00,
  "currency": "BDT",
  "idempotency_key": "INV-20260915-0001",
  "reference": "INV-20260915-0001"
}
```

Response (approved):
```json
{ "status": "approved", "bank_reference": "TXN-BANK-9001", "balance_after": 500.00 }
```

Response (declined):
```json
{ "status": "declined", "decline_reason": "INSUFFICIENT_FUNDS" }
```

**What the Bank System must actually check before approving a charge** (this is the "handle everything a real bank handles" part):
1. Card exists, isn't expired, and the CVV matches → else `INVALID_CARD` / `EXPIRED_CARD` / `CVV_MISMATCH`
2. Card status is `active`, not `blocked` → else `CARD_BLOCKED`
3. Account status is `active`, not `frozen`/`closed` → else `ACCOUNT_FROZEN`
4. Account balance ≥ amount → else `INSUFFICIENT_FUNDS`
5. Amount doesn't exceed the account's `daily_limit` → else `LIMIT_EXCEEDED`
6. If `idempotency_key` was already used, return the **stored result** of that original attempt — never charge again

Every attempt (approved or declined) gets a `bank_transactions` row — a real bank's ledger records declines too, not just successes.

**Seed data** — include failure cases on purpose, don't just seed happy-path accounts:
- 3-5 accounts, each with one active card, starting at ৳5,000-10,000
- At least one account with a **low `daily_limit`** (to test `LIMIT_EXCEEDED`)
- At least one **frozen** account (to test `ACCOUNT_FROZEN`)
- At least one card that's **expired** or **blocked** (to test those decline paths)

---

## 4. System 2 — Payment Gateway (your `db.sql` is exactly this)

This is the core focus. Your existing tables map like this:

- `banks` — reference data used to look up **fee config**, not something the customer picks (see the flow below — the Bank System's response tells the Gateway which bank issued the card)
- `currencies` — BDT/USD
- `merchants` + `users` (user_type: admin/merchant) — merchant accounts + login
- `pos` — fee config keyed by bank + currency: commission %, fixed fee, bank fee, settlement days
- `wallets` — merchant's internal balance in the gateway (money sits here after a sale, before settlement)
- `transactions` — every payment attempt (Pending → Completed/Failed, with a decline reason when it fails)
- `refunds` — refund records against a transaction

**Real-world flow this enables:**
1. Merchant registers → gets `store_id` + API key (like Stripe's public/secret key)
2. Ecommerce app redirects customer to Gateway's hosted checkout page with order amount + merchant store_id
3. Gateway's checkout page asks for **card number, expiry, CVV, cardholder name** — no bank selection dropdown. Just like a real checkout, the customer doesn't declare which bank they're with; the card itself determines that.
4. Gateway calls **Bank System's `/api/cards/charge`** with the card details and an idempotency key
5. Bank System validates everything (§3) and responds approved/declined
6. On approval: Gateway looks up the matching `pos` fee config (by the bank the Bank System says issued the card + currency), calculates `fee`/`net`, marks the `transactions` row Completed, credits the merchant's `wallets` balance
7. On decline: Gateway marks the `transactions` row Failed with the bank's `decline_reason`
8. Gateway redirects back to Ecommerce's `success_url` / `fail_url`
9. Ecommerce marks the order paid/failed — but only after calling Gateway's `verify` endpoint server-side, never by trusting the redirect alone
10. Optional: merchant requests a refund → Gateway calls Bank System's `/api/cards/refund` referencing the original `bank_reference`, creates a `refunds` row, debits the merchant's wallet

**API endpoints Gateway exposes (to Ecommerce):**
- `POST /api/checkout/init` — ecommerce sends order_id, amount, merchant_key, success_url, fail_url → returns a `gateway_checkout_url`
- `GET  /checkout/{invoice_id}` — hosted page (card number / expiry / CVV / cardholder name form)
- `POST /api/checkout/{invoice_id}/pay` — process payment (internally calls Bank System, using `invoice_id` as the idempotency key)
- `GET  /api/transactions/{invoice_id}/verify` — ecommerce verifies payment status server-side (important — never trust redirect alone, this is how real gateways work)
- `POST /api/refund` — merchant/admin triggers refund

---

## 5. System 3 — Ecommerce App (build from scratch, very small)

Just enough to trigger real payments. Never touches card data — only order state.

```
products   — id, name, price, stock  (only 2 products)
orders     — id, product_id, buyer_name, amount, status (pending/paid/failed), invoice_id
```

**Flow:**
- Show 2 products → "Buy Now"
- Create order (status: pending) → call Gateway's `checkout/init` → redirect user to Gateway
- After payment, Gateway redirects back → Ecommerce calls Gateway's `verify` endpoint → updates order status
- Show "Order Successful" / "Payment Failed" page (show the decline reason on failure if the Gateway provides one — a real checkout tells you *why* your card was declined)

---

## 5a. Provisioning a merchant (manual, on purpose)

The 3 systems are separate, independently-operated businesses in this
simulation, exactly like a real store and Stripe/SSLCommerz. Nothing in the
Ecommerce App's code registers it with the Payment Gateway or logs into the
Gateway's admin panel automatically - a merchant credential is something a
human obtains, the same way it works for real:

1. Bring up the Bank System and Payment Gateway: `docker compose up -d postgres bank-system payment-gateway`.
2. Register the shop as a merchant (its own details, its own new login - never anyone else's) at `http://localhost:8000/dashboard/register`, or the equivalent API call if you're scripting it:
   ```bash
   curl -X POST http://localhost:8000/api/merchant/register -H "Content-Type: application/json" \
     -d '{"name":"Bookworm Cafe Owner","email":"owner@bookwormcafe.example","password":"<choose one>","store_name":"Bookworm Cafe"}'
   ```
   Either way you get an `api_key` (`sk_test_...`) immediately, shown once - the merchant is registered but its status is `pending`, and every Gateway API call with that key is rejected until approved.
3. Log into the Gateway's **own** admin panel at `http://localhost:8000/admin/login` (`admin@gateway.local` / `admin123` from `docker-compose.yml`) and approve the new merchant from the Merchants list, setting its commission. (Or call `POST /api/admin/merchants/:id/approve` directly if you're scripting a test setup.)
4. Put the `api_key` from step 2 into `ecommerce-app`'s config as `GATEWAY_API_KEY` (in `docker-compose.yml` for Docker, or `.env` for `npm run dev`), then start/restart it: `docker compose up -d --build ecommerce-app`.

Until step 4 is done with a real, approved key, the shop's checkout will
correctly fail with "This store's payment account is still pending
approval" rather than silently succeeding - that failure mode is itself
part of the simulation, not a bug.

---

## 6. Money flow examples (end-to-end)

**Approved:**
```
Customer buys product ৳500 on Ecommerce
   → Ecommerce → Gateway: init checkout (amount 500, merchant=Merchant One)
   → Gateway shows card entry form → customer enters card 4242..., expiry, CVV
   → Gateway → Bank System: POST /api/cards/charge (amount 500, idempotency_key=INV-0001)
   → Bank System: validates card + account, balance 1000 → 500, returns approved (bank=National Bank)
   → Gateway: looks up pos config for (National Bank, BDT) → fee = 2% + 5 = 15 → net = 485
   → Gateway: transactions row (gross=500, fee=15, net=485, state=Completed)
   → Gateway: merchant wallet += 485
   → Gateway → Ecommerce: redirect success
   → Ecommerce: order status = paid
```

**Declined:**
```
Customer tries to buy ৳2000 on Ecommerce with a card that only has ৳500 left
   → Gateway → Bank System: POST /api/cards/charge (amount 2000, idempotency_key=INV-0002)
   → Bank System: balance 500 < 2000 → returns declined, decline_reason=INSUFFICIENT_FUNDS
   → Gateway: transactions row (gross=2000, state=Failed, decline_reason=INSUFFICIENT_FUNDS)
   → Gateway → Ecommerce: redirect fail (?reason=INSUFFICIENT_FUNDS)
   → Ecommerce: order status = failed, shows "Insufficient funds" to the customer
```

---

## 7. Tech stack

- **Payment Gateway:** FastAPI + SQLModel + PostgreSQL — already scaffolded, see `payment-system/README.md` for conventions (response shape, pagination, error handling, logging).
- **Bank System / Ecommerce App:** not started yet. Recommended: match the Gateway's stack (FastAPI + SQLModel + PostgreSQL) so all three systems share the same conventions and nobody has to context-switch between two ecosystems — but this is each system's own team's call.
- Each runs on its own port (`8001` bank, `8000` gateway, `8002` shop), own `.env`, own DB.
- Server-to-server calls use a shared `X-API-KEY` header (no OAuth needed for this project's scope).
- Later, if wanted: put all 3 behind Docker Compose, one command spins up everything.

---

## 8. Build order (recommended)

1. **Bank System** first (simplest, standalone) — accounts + cards + charge/refund API, including the decline paths
2. **Payment Gateway** second — build on your existing `db.sql`, integrate with Bank API
3. **Ecommerce** last — thin client that just calls Gateway

---

## 9. Open questions (before Milestone 2 starts)

Resolved by this update:
- ~~Stack~~ → Gateway is FastAPI+SQLModel+Postgres; recommend the same for Bank/Ecommerce.
- ~~Bank selection at checkout~~ → removed. The card determines the issuing bank; the customer never picks one.
- ~~Checkout UI~~ → real hosted page needed (card entry form), not just a JSON API.

Still open — decide before Module 1/4 lock their contract:
1. **Card number realism**: do we validate with a Luhn checksum, or accept any 16-digit string? (Luhn is a nice touch, not required.)
2. **Multiple bank brands**: should the Bank System simulate 2-3 named banks (so a card's issuer genuinely varies), or is one generic bank issuing all cards enough for this project's scope?
3. **Idempotency key retention**: how long does the Bank System need to remember an idempotency key to dedupe retries? (24 hours is plenty for a learning project.)
4. **Auth vs. capture**: do we simulate a two-step authorize-then-capture (closer to real card networks), or one atomic charge call? Recommend the atomic charge for scope — call it out explicitly so Module 1 and Module 4 agree before building.
