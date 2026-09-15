# Mini Payment Ecosystem — 7-Module Team Plan

## Overview

3 independent systems (Bank, Gateway, Ecommerce) split into **7 independent modules** so each of the 7 members can work in parallel, with clear milestones and handoff contracts (API specs).

**The scenario:** a customer buys something on the Ecommerce App. The shop hands the customer off to our Payment Gateway instead of touching payment details itself. The customer enters their **card** (number, expiry, CVV, name) on the Gateway's checkout page. The Gateway sends that to the Bank System, which is the only system that owns accounts/cards — it validates everything a real bank would (card valid, account active, enough balance, within limits), moves the money, and returns approved or a specific decline reason. See `README.md` §2 for the full security/data-boundary rules — read that before building anything, especially Modules 1 and 4.

**Stack:** Payment Gateway (Modules 2, 3, 4, 5, 7) is FastAPI + SQLModel + PostgreSQL — already scaffolded, see `payment-system/README.md` for conventions (response shape, pagination, error handling, logging). Bank System (Module 1) and Ecommerce App (Module 6) should match this stack for consistency unless there's a strong reason not to.

**Ports:**
- `8001` → Bank System
- `8000` → Payment Gateway
- `8002` → Ecommerce App

---

## Milestone Overview

```
Milestone 1 (M1) — Foundations       → Modules 1, 2, 3 complete
Milestone 2 (M2) — Core Payment Flow → Modules 4, 5 complete
Milestone 3 (M3) — Full System Live  → Modules 6, 7 complete
```

---

## Module Breakdown

---

### 🏦 MODULE 1 — Bank System (Standalone)
**Assigned to:** Member 1
**Milestone:** M1
**System:** Bank System (Port 8001)

#### Responsibilities
- Set up the Bank System project (FastAPI recommended, see Stack above)
- Design and create the Bank DB schema — accounts **and cards**
- Build the charge/refund API with full real-bank-style validation and decline reasons
- Seed accounts, cards, and **deliberately-broken test cases** (frozen account, expired card, low limit) so Module 4 can test failure paths, not just the happy path

#### Database Schema
```
accounts
  id, account_number (unique), holder_name, balance (default 1000.00),
  status (active | frozen | closed), daily_limit, created_at

cards
  id, account_id (FK), card_number, card_holder_name,
  expiry_month, expiry_year, cvv, status (active | blocked), created_at

bank_transactions   (ledger — one row per charge/refund attempt, approved OR declined)
  id, account_id, card_id, type (debit | credit), amount, balance_after,
  reference, idempotency_key (unique), status (approved | declined),
  decline_reason (nullable), created_at
```

#### API Endpoints to Build
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/cards/charge` | Validate card + account, debit if OK, return approved/declined |
| `POST` | `/api/cards/refund` | Credit the account tied to a previous approved charge |
| `GET` | `/api/accounts/{account_number}/balance` | Check balance (testing/admin use) |

`POST /api/cards/charge` request/response — see `README.md` §3 for the exact JSON shape.

#### Validation order (must produce these exact decline reasons)
1. Card exists, not expired, CVV matches → else `INVALID_CARD` / `EXPIRED_CARD` / `CVV_MISMATCH`
2. Card `status == active` → else `CARD_BLOCKED`
3. Account `status == active` → else `ACCOUNT_FROZEN`
4. `balance >= amount` → else `INSUFFICIENT_FUNDS`
5. `amount <= daily_limit` → else `LIMIT_EXCEEDED`
6. If `idempotency_key` seen before → return the stored result of that original attempt, **do not charge again**

Write a `bank_transactions` row for every attempt, approved or declined — a real bank's ledger records declines too.

#### Auth
- All endpoints protected by shared `X-API-KEY` header (value agreed with Module 4)

#### Seed Data
- 5 dummy accounts with linked cards, each starting at ৳5,000-10,000
- At least 1 account with a low `daily_limit` (tests `LIMIT_EXCEEDED`)
- At least 1 `frozen` account (tests `ACCOUNT_FROZEN`)
- At least 1 expired or `blocked` card (tests `EXPIRED_CARD` / `CARD_BLOCKED`)

#### Deliverable / Handoff Contract
- Running on `localhost:8001`
- Postman collection covering **both** the approved path and every decline reason
- Document the `X-API-KEY` value, the exact request/response JSON shape, and the full list of `decline_reason` values for Module 4

---

### 🗄️ MODULE 2 — Gateway: Database & Project Setup ✅ done
**Assigned to:** Member 2
**Milestone:** M1
**System:** Payment Gateway (Port 8000)

Schema, migrations, seed data, `.env`/config, base FastAPI app, logging/error-handling conventions — all built. See `payment-system/README.md` for the actual conventions every other Gateway module must follow (response envelope, pagination, exceptions, logging).

One known follow-up for whoever picks up Module 4: the `transactions` table will likely need a `decline_reason` (and possibly `bank_reference`) column added once the charge flow is implemented — flag it here rather than silently bolting it on, so it goes through a proper migration.

---

### 🔐 MODULE 3 — Gateway: Merchant Auth & API Key Management
**Assigned to:** Member 3
**Milestone:** M1
**System:** Payment Gateway (Port 8000)

#### Responsibilities
- Merchant registration & login (JWT-based session)
- Admin login
- Middleware/dependency: validate `store_id` + merchant API key for Ecommerce-facing endpoints
- Middleware/dependency: validate `X-API-KEY` for internal/admin endpoints

#### API Endpoints to Build
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/merchant/register` | Register new merchant, auto-create wallet + POS config |
| `POST` | `/api/merchant/login` | Merchant login → JWT token |
| `POST` | `/api/admin/login` | Admin login → JWT token |
| `GET` | `/api/merchant/profile` | Get merchant info (auth required) |

#### Dependencies (FastAPI-style, not Express middleware)
- `get_current_merchant` — validates JWT for merchant routes
- `get_current_admin` — validates JWT for admin routes
- `verify_merchant_api_key` — validates `store_id` + API key for checkout init (used by Module 4)

Use the response envelope and exceptions from `app.core.utils` (see `payment-system/README.md`) — don't invent a different auth error shape.

#### Deliverable / Handoff Contract
- All auth endpoints tested
- Export the dependencies for use by Modules 4 and 5
- Document the JWT secret's `.env` var, token format, and how to use the dependencies

---

### 💳 MODULE 4 — Gateway: Checkout Flow & Bank Integration
**Assigned to:** Member 4
**Milestone:** M2
**System:** Payment Gateway (Port 8000)

> **Depends on:** Module 1 (Bank API running), Module 2 (DB ready), Module 3 (Auth)

#### Responsibilities
- Hosted checkout page: **card number, expiry, CVV, cardholder name** — no bank selection dropdown (the card determines the issuing bank, the customer doesn't declare it)
- Full payment processing pipeline (Gateway → Bank System), including every decline path from Module 1
- Transaction creation and status management
- Redirect logic (success/fail back to Ecommerce), including the decline reason on failure

#### API Endpoints to Build
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/checkout/init` | Ecommerce sends order details → returns `checkout_url` |
| `GET` | `/checkout/{invoice_id}` | Hosted page — card entry form |
| `POST` | `/api/checkout/{invoice_id}/pay` | Process payment (calls Bank API charge) |
| `GET` | `/api/transactions/{invoice_id}/verify` | Ecommerce verifies payment status |

#### Checkout Flow Logic
```
1. POST /api/checkout/init
   → validate merchant api_key
   → create transactions row (state=Pending, store invoice_id)
   → return { checkout_url: "http://localhost:8000/checkout/{invoice_id}" }

2. GET /checkout/{invoice_id}
   → render HTML page: card number, expiry, CVV, cardholder name fields

3. POST /api/checkout/{invoice_id}/pay
   → call Bank System: POST /api/cards/charge
       - idempotency_key = invoice_id  (never regenerate this on retry)
       - amount = transaction.gross, currency = transaction.currency
   → on approved:
       - look up pos row by (bank the Bank System says issued the card, currency)
         - if no matching pos config exists for that bank+currency, fall back to
           a default POS row for the currency (agree this default with Module 2/5
           rather than crashing the checkout)
       - calculate fee from POS config (commission % + fixed fee)
       - update transaction: state=Completed, gross, fee, net
       - credit merchant wallet: wallet.amount += net
   → on declined:
       - update transaction: state=Failed, decline_reason=<from Bank System>
   → redirect to success_url, or fail_url?reason=<decline_reason>

4. GET /api/transactions/{invoice_id}/verify
   → return transaction status + decline_reason (if any) for Ecommerce's
     server-side verify — never let Ecommerce trust the redirect alone
```

#### UI (Minimal)
- Simple HTML form: card number, expiry (MM/YY), CVV, cardholder name, Pay button
- On decline, show the reason in plain language (e.g. "insufficient funds") — don't just say "payment failed"
- Basic CSS — clean, readable, no frameworks

#### Deliverable / Handoff Contract
- Full flow testable end-to-end (init → pay → verify), **for both an approved and at least 2 different declined cases** (use Module 1's seeded broken accounts/cards)
- Share `invoice_id` format and `verify` endpoint response shape (including `decline_reason`) with Module 6

---

### 💰 MODULE 5 — Gateway: Wallet, Fees & Refunds
**Assigned to:** Member 5
**Milestone:** M2
**System:** Payment Gateway (Port 8000)

> **Depends on:** Module 2 (DB), Module 3 (Auth), Module 4 (transactions + bank_reference exist)

#### Responsibilities
- Merchant wallet balance view
- Refund flow (merchant/admin triggers → Gateway calls Bank System's refund endpoint, referencing the **original bank transaction**, not just the account)
- Fee calculation utility (shared with Module 4)

#### API Endpoints to Build
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/merchant/wallet` | Get merchant wallet balance (auth required) |
| `POST` | `/api/refund` | Trigger refund for a completed transaction |
| `GET` | `/api/merchant/transactions` | List merchant's own transactions |

#### Refund Flow Logic
```
POST /api/refund { invoice_id, amount }
  → validate transaction.state == "Completed"
  → validate refund amount <= (transaction.gross - transaction.refunded_amount)
  → call Bank System: POST /api/cards/refund
       - bank_reference = transaction.bank_reference   (ties the refund to the
         original charge — a real bank won't credit an account for a charge
         it never made)
       - idempotency_key = a fresh key per refund attempt, e.g. invoice_id + ":refund:1"
  → create refunds row (transaction_id, invoice_id, amount, state)
  → update transaction.refunded_amount += amount
    (state=Refunded if fully refunded, Partial Refunded otherwise)
  → deduct from merchant wallet: wallet.amount -= amount
  → return refund status
```

#### Fee Calculation (Shared Utility)
```python
# app/core/utils/fee.py — used by Module 4 and this module
def calculate_fee(gross: Decimal, pos) -> tuple[Decimal, Decimal]:
    commission = gross * pos.commission_percentage / 100
    fee = commission + pos.commission_fixed
    net = gross - fee
    return fee, net
```

#### Deliverable / Handoff Contract
- Refund flow tested against both a full and a partial refund
- Fee utility exported and documented for Module 4 to import
- Wallet balance endpoint ready for Module 7 (admin panel)

---

### 🛒 MODULE 6 — Ecommerce App
**Assigned to:** Member 6
**Milestone:** M3
**System:** Ecommerce App (Port 8002)

> **Depends on:** Module 4 (checkout init + verify endpoints working)

#### Responsibilities
- Set up the Ecommerce project (FastAPI recommended, see Stack above)
- Products listing page
- Order creation and checkout trigger
- Handle Gateway redirect (success/fail)
- Call Gateway verify endpoint to confirm payment — never trust the redirect alone
- This app never sees card data — only `order_id`/`amount` and a redirect to the Gateway

#### Database Schema
```
products  — id, name, price, stock
orders    — id, product_id, buyer_name, amount, status (pending/paid/failed), invoice_id
```

#### Seed Data
- 2 products: `Product A ৳500`, `Product B ৳1200`

#### Pages / Endpoints
| Type | Route | Description |
|---|---|---|
| `GET` | `/` | Product listing — show 2 products with Buy Now |
| `POST` | `/orders` | Create order (pending) → call Gateway `checkout/init` → redirect to Gateway checkout URL |
| `GET` | `/success` | Gateway redirects here → call Gateway `verify` → update order to paid → show success page |
| `GET` | `/fail` | Gateway redirects here → call Gateway `verify` → update order to failed → show fail page with the reason |

#### UI (Minimal)
- Simple product cards, Buy Now button, order confirmation page
- Plain HTML/CSS — no framework

#### Deliverable / Handoff Contract
- Full end-to-end purchase flow working, for both an approved and a declined card
- Document `success_url` and `fail_url` format for Module 4 testing

---

### 🖥️ MODULE 7 — Gateway: Admin Panel UI
**Assigned to:** Member 7
**Milestone:** M3
**System:** Payment Gateway (Port 8000)

> **Depends on:** Modules 2, 3, 4, 5 (all Gateway APIs working)

#### Responsibilities
- Admin login page
- Dashboard: view all transactions, merchants, banks, wallet balances
- Simple server-rendered HTML pages (Jinja2, since we're on FastAPI)

#### Pages to Build
| Route | Description |
|---|---|
| `GET /admin/login` | Admin login form |
| `GET /admin/dashboard` | Overview: total transactions, total volume, merchants count |
| `GET /admin/transactions` | Table of all transactions (invoice_id, merchant, amount, fee, net, status, decline_reason, date) |
| `GET /admin/merchants` | Table of all merchants + wallet balance |
| `GET /admin/refunds` | Table of all refunds |
| `GET /admin/banks` | List of integrated banks |

#### API Calls Used (all from Module 4/5)
- Internal DB queries (admin has direct access to Gateway DB — same service)
- Render via FastAPI + Jinja2 templates

#### UI (Minimal)
- Simple table-based layout
- Sidebar navigation
- No heavy CSS framework — just clean plain CSS

#### Deliverable / Handoff Contract
- All pages accessible after admin login
- Works with seeded data from Module 2

---

## Dependency Graph

```
Module 1 ──────────────────────────────► Module 4
Module 2 ──────┬───────────────────────► Module 4
               ├───────────────────────► Module 5
               └───────────────────────► Module 7
Module 3 ──────┬───────────────────────► Module 4
               ├───────────────────────► Module 5
               └───────────────────────► Module 7
Module 4 ──────────────────────────────► Module 6
Module 5 ──────────────────────────────► Module 7
```

---

## Milestone Summary

| Milestone | Modules | Goal |
|---|---|---|
| **M1 — Foundations** | 1, 2, 3 | All 3 projects scaffolded, DB ready, Bank API live (incl. decline paths), Auth working |
| **M2 — Core Flow** | 4, 5 | Full card payment + refund flow working end-to-end (API level), including decline handling |
| **M3 — Full System** | 6, 7 | UI complete, Ecommerce buying works for both approved and declined cards, Admin panel live |

---

## Shared Contracts (Agree Before M1 Ends)

All members must agree on these before M2 starts:

| Contract | Owner | Consumers |
|---|---|---|
| Bank API base URL + `X-API-KEY` value | Module 1 | Module 4 |
| `/api/cards/charge` and `/api/cards/refund` request/response shape | Module 1 | Module 4, Module 5 |
| Full list of `decline_reason` values | Module 1 | Module 4, Module 6, Module 7 |
| Idempotency key format (recommend: the `invoice_id` itself for charges) | Module 4 | Module 1 |
| Gateway DB schema (final, incl. any `transactions` columns added for decline handling) | Module 2 | All Gateway modules |
| Auth dependency signatures | Module 3 | Modules 4, 5, 7 |
| `checkout/init` request/response shape | Module 4 | Module 6 |
| `verify` endpoint response shape (incl. `decline_reason`) | Module 4 | Module 6 |
| `invoice_id` format | Module 4 | All |
| `success_url` / `fail_url` format | Module 6 | Module 4 |

---

## Project Folder Structure

```
internship-softrobotics-fahim/
├── payment-system/       ← Modules 2, 3, 4, 5, 7 (FastAPI — already scaffolded)
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── core/          ← logging, middleware, exceptions, response, pagination
│   │   ├── models/         ← SQLModel table classes
│   │   └── routers/
│   ├── alembic/
│   ├── .env.example
│   ├── requirements.txt
│   └── README.md          ← read this before writing any Gateway code
│
├── bank-system/          ← Module 1 (recommended: same FastAPI layout as payment-system)
│
└── ecommerce-app/        ← Module 6 (recommended: same FastAPI layout as payment-system)
```

---

> **Next Step:** Module 1 and Module 4 agree on the exact `/api/cards/charge` contract (request shape, response shape, full decline reason list) before either starts building — everything downstream depends on it matching exactly.
