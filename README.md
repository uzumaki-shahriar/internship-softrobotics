# Mini Payment Ecosystem — Project Plan

A learning project simulating how real payment gateways (SSLCommerz, Stripe, bKash style) work, built as **3 independent systems** that talk over HTTP APIs — exactly like production.

---

## 1. Why 3 separate systems (not 1 shared DB)

In the real world, a bank, a payment gateway, and a merchant's e-commerce store are **owned by different companies**. They never share a database — they only exchange data through APIs. We replicate that:

| System | Owns | Talks to |
|---|---|---|
| **Bank System** | Accounts, balances, PINs/passwords | Exposes API for gateway to call |
| **Payment Gateway** | Merchants, transactions, POS config, wallets, refunds (your `db.sql`) | Calls Bank API, receives calls from Ecommerce |
| **Ecommerce App** | Products, orders, cart | Calls Gateway API (redirect/checkout style) |

Each has **its own database**, its own codebase, its own server/port. This is the actual architecture of real payment systems.

---

## 2. System 1 — Bank System (build from scratch)

Simulates a real bank. Simple schema:

```
accounts
  id, account_number, holder_name, password_hash, balance (default 1000.00), status, created_at

bank_transactions   (bank's own internal ledger)
  id, account_id, type (debit/credit), amount, balance_after, reference, created_at
```

**API endpoints (called by Payment Gateway only, server-to-server):**
- `POST /api/auth/login` — validate account_number + password → returns short-lived token
- `GET  /api/accounts/{id}/balance` — check balance
- `POST /api/accounts/{id}/debit` — deduct amount (used when user pays)
- `POST /api/accounts/{id}/credit` — add amount (used for refunds)
- All endpoints protected by a shared **API key/secret** (like real bank integrations use)

**Seed data:** 3–5 dummy accounts, each starting at ৳1000, e.g.
`ACC1001 / pass123`, `ACC1002 / pass123`, etc.

---

## 3. System 2 — Payment Gateway (your `db.sql` is exactly this)

This is the core focus. Your existing tables map like this:

- `banks` — which banks are integrated (reference data, matches Bank System accounts by bank code)
- `currencies` — BDT/USD
- `merchants` + `users` (user_type: admin/merchant) — merchant accounts + login
- `pos` — Point-of-Sale config per merchant: commission %, fixed fee, bank fee, settlement days
- `wallets` — merchant's internal balance in the gateway (money sits here after a sale, before settlement)
- `transactions` — every payment attempt (Pending → Completed/Failed)
- `refunds` — refund records against a transaction

**Real-world flow this enables:**
1. Merchant registers → gets `store_id` + API key (like Stripe's public/secret key)
2. Ecommerce app redirects customer to Gateway's hosted checkout page with order amount + merchant store_id
3. Gateway shows "choose your bank" screen (like SSLCommerz)
4. Customer enters bank account + password → Gateway calls **Bank System API** to debit
5. On success: Gateway creates `transactions` row (Completed), calculates `fee` (from `pos` table), credits `net` amount into merchant's `wallets`
6. Gateway redirects back to Ecommerce's `success_url` / `fail_url` with transaction status
7. Ecommerce marks the order paid
8. Optional: merchant can request refund → `refunds` table, Gateway calls Bank API to credit money back

**API endpoints Gateway exposes (to Ecommerce):**
- `POST /api/checkout/init` — ecommerce sends order_id, amount, merchant_key, success_url, fail_url → returns a `gateway_checkout_url`
- `GET  /checkout/{invoice_id}` — hosted page (bank selection + password)
- `POST /api/checkout/{invoice_id}/pay` — process payment (internally calls Bank System)
- `GET  /api/transactions/{invoice_id}/verify` — ecommerce verifies payment status server-side (important — never trust redirect alone, this is how real gateways work)
- `POST /api/refund` — merchant/admin triggers refund

---

## 4. System 3 — Ecommerce App (build from scratch, very small)

Just enough to trigger real payments.

```
products   — id, name, price, stock  (only 2 products)
orders     — id, product_id, buyer_name, amount, status (pending/paid/failed), invoice_id
```

**Flow:**
- Show 2 products → "Buy Now"
- Create order (status: pending) → call Gateway's `checkout/init` → redirect user to Gateway
- After payment, Gateway redirects back → Ecommerce calls Gateway's `verify` endpoint → updates order status
- Show "Order Successful" / "Payment Failed" page

---

## 5. Money flow example (end-to-end)

```
Customer buys product ৳500 on Ecommerce
   → Ecommerce → Gateway: init checkout (amount 500, merchant=Merchant One)
   → Gateway shows bank selection → customer picks "National Bank", enters account/password
   → Gateway → Bank System: debit ACC1001 by 500
   → Bank System: balance 1000 → 500, returns success
   → Gateway: fee = 2% + 5 = 15 → net = 485
   → Gateway: transactions row (gross=500, fee=15, net=485, state=Completed)
   → Gateway: merchant wallet += 485
   → Gateway → Ecommerce: redirect success
   → Ecommerce: order status = paid
```

---

## 6. Suggested tech stack (keep it simple)

- **Bank System:** Laravel (small, API-only) or plain Node/Express — your choice
- **Payment Gateway:** Laravel (matches your `db.sql`'s migration style, so recommended) — Blade for the hosted checkout page
- **Ecommerce:** Laravel or even plain PHP/Node — deliberately minimal
- Each runs on its own port (e.g. 8001 bank, 8000 gateway, 8002 shop), own `.env`, own DB
- Server-to-server calls via `Http::` (Laravel) with a shared API key header
- Later, if wanted: put all 3 behind Docker Compose, one command spins up everything

---

## 7. Build order (recommended)

1. **Bank System** first (simplest, standalone) — accounts + debit/credit API
2. **Payment Gateway** second — build on your existing `db.sql`, integrate with Bank API
3. **Ecommerce** last — thin client that just calls Gateway

---

## 8. Open questions before coding starts

1. **Stack**: Laravel for all 3, or mixed? Any language you're most comfortable with?
2. **Auth style** for merchant/bank API calls: simple API key in header, or full OAuth-style token?
3. **Checkout UI**: does Gateway need a real "hosted page" (separate blade view, redirect flow) or is a simple JSON API enough for now (no UI, just Postman/API testing)?
4. **Admin panel**: do you want a small admin view (see all transactions, banks, merchants) or skip UI entirely and focus on API + DB only?
5. **Bank selection**: should customer pick from multiple banks (National/City/DBBL) or is one dummy bank enough to start?