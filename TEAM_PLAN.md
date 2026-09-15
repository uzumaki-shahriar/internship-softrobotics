# Mini Payment Ecosystem — 7-Module Team Plan

## Overview

3 independent systems (Bank, Gateway, Ecommerce) split into **7 independent modules** so each of the 7 members can work in parallel, with clear milestones and handoff contracts (API specs).

**Stack:** Node.js + Express | MySQL | Plain HTML/CSS/JS (minimal UI) | Shared API key auth

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
- Set up Node/Express project for Bank System
- Design and create the Bank DB schema
- Build all Bank API endpoints
- Seed dummy accounts & data

#### Database Schema
```sql
accounts
  id, account_number, holder_name, password_hash, balance (default 1000.00), status, created_at

bank_transactions
  id, account_id, type (debit/credit), amount, balance_after, reference, created_at
```

#### API Endpoints to Build
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Validate account_number + password → return session token |
| `GET` | `/api/accounts/:id/balance` | Get account balance |
| `POST` | `/api/accounts/:id/debit` | Deduct amount from account |
| `POST` | `/api/accounts/:id}/credit` | Add amount to account (refund) |

#### Auth
- All endpoints protected by shared `X-API-KEY` header (value agreed with Module 4)

#### Seed Data
- 5 dummy accounts: `ACC1001–ACC1005 / pass123`, each starting at ৳5000
- 3 banks mapped: National Bank, City Bank, DBBL

#### Deliverable / Handoff Contract
- Running on `localhost:8001`
- Postman collection with all endpoints tested
- Document the `X-API-KEY` value and endpoint request/response shapes for Module 4

---

### 🗄️ MODULE 2 — Gateway: Database & Project Setup
**Assigned to:** Member 2
**Milestone:** M1
**System:** Payment Gateway (Port 8000)

#### Responsibilities
- Set up Node/Express project for Payment Gateway
- Create full Gateway DB schema (based on `db.sql`)
- Seed reference data (banks, currencies, test merchant)
- Set up `.env`, DB connection, base routing structure

#### Database Tables to Create
```
banks, currencies, merchants, users (admin/merchant),
pos, wallets, transactions, refunds
```

#### Key Schema Notes
- `merchants` → has `store_id` (unique) + `api_key` (for Ecommerce auth)
- `pos` → commission %, fixed_fee, bank_fee, settlement_days per merchant
- `wallets` → merchant_id, currency_id, balance
- `transactions` → invoice_id, merchant_id, bank_id, gross, fee, net, status (pending/completed/failed), success_url, fail_url
- `refunds` → transaction_id, amount, status, created_at

#### Seed Data
- 2 currencies: BDT, USD
- 3 banks: National Bank, City Bank, DBBL
- 1 test merchant: `Merchant One`, store_id: `STORE001`, api_key: `mk_test_12345`
- POS config for Merchant One: 2% commission + ৳5 fixed fee
- Admin user: `admin@gateway.com / admin123`

#### Deliverable / Handoff Contract
- DB migrations + seed files ready and documented
- `.env.example` with all required config vars
- Base Express app running on `localhost:8000` with a `GET /health` endpoint
- Share DB schema diagram / table docs with Modules 3, 4, 5

---

### 🔐 MODULE 3 — Gateway: Merchant Auth & API Key Management
**Assigned to:** Member 3
**Milestone:** M1
**System:** Payment Gateway (Port 8000)

#### Responsibilities
- Merchant registration & login (JWT-based session)
- Admin login
- Middleware: validate `store_id` + `api_key` for Ecommerce-facing endpoints
- Middleware: validate `X-API-KEY` for internal/admin endpoints

#### API Endpoints to Build
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/merchant/register` | Register new merchant, auto-create wallet + POS config |
| `POST` | `/api/merchant/login` | Merchant login → JWT token |
| `POST` | `/api/admin/login` | Admin login → JWT token |
| `GET` | `/api/merchant/profile` | Get merchant info (auth required) |

#### Middleware
- `authenticateMerchant` — validates JWT for merchant routes
- `authenticateAdmin` — validates JWT for admin routes
- `validateApiKey` — validates `store_id` + `api_key` header for checkout init (used by Module 5)

#### Deliverable / Handoff Contract
- All auth endpoints tested via Postman
- Export middleware functions for use by Modules 4 and 5
- Document JWT secret in `.env`, token format, and middleware usage

---

### 💳 MODULE 4 — Gateway: Checkout Flow & Bank Integration
**Assigned to:** Member 4
**Milestone:** M2
**System:** Payment Gateway (Port 8000)

> **Depends on:** Module 1 (Bank API running), Module 2 (DB ready), Module 3 (Auth middleware)

#### Responsibilities
- Hosted checkout page UI (bank selection + account/password form)
- Full payment processing pipeline (Gateway → Bank System)
- Transaction creation and status management
- Redirect logic (success/fail back to Ecommerce)

#### API Endpoints to Build
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/checkout/init` | Ecommerce sends order details → returns `checkout_url` |
| `GET` | `/checkout/:invoice_id` | Hosted page — show bank list + payment form |
| `POST` | `/api/checkout/:invoice_id/pay` | Process payment (calls Bank API debit) |
| `GET` | `/api/transactions/:invoice_id/verify` | Ecommerce verifies payment status |

#### Checkout Flow Logic
```
1. /api/checkout/init
   → validate merchant api_key
   → create transactions row (status: pending, store invoice_id)
   → return { checkout_url: "http://localhost:8000/checkout/{invoice_id}" }

2. GET /checkout/:invoice_id
   → render HTML page: show bank dropdown (National/City/DBBL), account_number field, password field

3. POST /api/checkout/:invoice_id/pay
   → call Bank System: POST /api/auth/login (account_number + password)
   → call Bank System: POST /api/accounts/:id/debit (amount)
   → on success:
       - calculate fee from POS config (commission % + fixed fee)
       - update transaction: status=completed, gross, fee, net
       - credit merchant wallet: wallet.balance += net
   → on failure:
       - update transaction: status=failed
   → redirect to success_url or fail_url

4. GET /api/transactions/:invoice_id/verify
   → return transaction status + details (for Ecommerce server-side verify)
```

#### UI (Minimal)
- Simple HTML form: bank dropdown, account number input, password input, Pay button
- Basic CSS — clean, readable, no frameworks

#### Deliverable / Handoff Contract
- Full flow testable end-to-end (init → pay → verify)
- Share `invoice_id` format and `verify` endpoint response shape with Module 6

---

### 💰 MODULE 5 — Gateway: Wallet, Fees & Refunds
**Assigned to:** Member 5
**Milestone:** M2
**System:** Payment Gateway (Port 8000)

> **Depends on:** Module 2 (DB), Module 3 (Auth), Module 4 (transactions exist)

#### Responsibilities
- Merchant wallet balance view
- Refund flow (merchant/admin triggers → Gateway calls Bank credit)
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
  → validate transaction is "completed"
  → validate refund amount ≤ transaction.gross
  → call Bank System: POST /api/accounts/:id/credit (amount)
  → create refunds row
  → deduct from merchant wallet: wallet.balance -= amount
  → return refund status
```

#### Fee Calculation (Shared Utility)
```js
// utils/fee.js — used by Module 4 and this module
function calculateFee(gross, pos) {
  const commission = (gross * pos.commission_percent) / 100;
  const fee = commission + pos.fixed_fee;
  const net = gross - fee;
  return { fee, net };
}
```

#### Deliverable / Handoff Contract
- Refund flow tested via Postman
- Fee utility exported and documented for Module 4 to import
- Wallet balance endpoint ready for Module 7 (admin panel)

---

### 🛒 MODULE 6 — Ecommerce App
**Assigned to:** Member 6
**Milestone:** M3
**System:** Ecommerce App (Port 8002)

> **Depends on:** Module 4 (checkout init + verify endpoints working)

#### Responsibilities
- Set up Node/Express project for Ecommerce
- Products listing page
- Order creation and checkout trigger
- Handle Gateway redirect (success/fail)
- Call Gateway verify endpoint to confirm payment

#### Database Schema
```sql
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
| `GET` | `/fail` | Gateway redirects here → update order to failed → show fail page |

#### UI (Minimal)
- Simple product cards, Buy Now button, order confirmation page
- Plain HTML/CSS — no framework

#### Deliverable / Handoff Contract
- Full end-to-end purchase flow working
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
- Simple server-rendered HTML pages (no frontend framework)

#### Pages to Build
| Route | Description |
|---|---|
| `GET /admin/login` | Admin login form |
| `GET /admin/dashboard` | Overview: total transactions, total volume, merchants count |
| `GET /admin/transactions` | Table of all transactions (invoice_id, merchant, amount, fee, net, status, date) |
| `GET /admin/merchants` | Table of all merchants + wallet balance |
| `GET /admin/refunds` | Table of all refunds |
| `GET /admin/banks` | List of integrated banks |

#### API Calls Used (all from Module 4/5)
- Internal DB queries (admin has direct access to Gateway DB — same service)
- Render via Express + plain HTML templates (EJS or simple template strings)

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
| **M1 — Foundations** | 1, 2, 3 | All 3 projects scaffolded, DB ready, Bank API live, Auth working |
| **M2 — Core Flow** | 4, 5 | Full payment + refund flow working end-to-end (API level) |
| **M3 — Full System** | 6, 7 | UI complete, Ecommerce buying works, Admin panel live |

---

## Shared Contracts (Agree Before M1 Ends)

All members must agree on these before M2 starts:

| Contract | Owner | Consumers |
|---|---|---|
| Bank API base URL + `X-API-KEY` value | Module 1 | Module 4 |
| Gateway DB schema (final) | Module 2 | All Gateway modules |
| Auth middleware signatures | Module 3 | Modules 4, 5, 7 |
| `checkout/init` request/response shape | Module 4 | Module 6 |
| `verify` endpoint response shape | Module 4 | Module 6 |
| `invoice_id` format | Module 4 | All |
| `success_url` / `fail_url` format | Module 6 | Module 4 |

---

## Project Folder Structure (Suggested)

```
internship-payment-project/
├── bank-system/          ← Module 1
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── db/
│   │   └── app.js
│   ├── .env.example
│   └── package.json
│
├── payment-gateway/      ← Modules 2, 3, 4, 5, 7
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── views/        ← checkout + admin HTML pages
│   │   ├── utils/        ← fee.js, etc.
│   │   ├── db/
│   │   └── app.js
│   ├── .env.example
│   └── package.json
│
└── ecommerce-app/        ← Module 6
    ├── src/
    │   ├── routes/
    │   ├── controllers/
    │   ├── views/
    │   ├── db/
    │   └── app.js
    ├── .env.example
    └── package.json
```

---

> **Next Step:** Review this plan, confirm module assignments, then we start scaffolding all 3 projects.
