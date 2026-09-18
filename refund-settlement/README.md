# Simple Payment Gateway Demo — PRD

## 1. Goal

Build small PSP/payment gateway demo.

Main flow:

```text
Create Transaction
        ↓
     Pending
        ↓ cron
    Completed
        ↓
 Merchant Wallet
        ↓
 Settlement
        ↓ cron
 Settlement Completed
```

Also support:

```text
Completed Transaction
        ↓
      Refund
        ↓
 Partial Refund / Full Refund
```

No real bank/card integration.

Postman + minimal frontend enough.

---

# 2. User Roles

## PSP/Admin

Can:

* View transactions
* View merchants
* Configure merchant settlement
* Set settlement cycle
* Set settlement time
* Set block amount
* Set rolling amount

## Merchant

Can:

* View transactions
* Create transaction
* View transaction details
* Refund transaction
* View wallet
* Create settlement request
* View settlements

For demo, authentication can be skipped.

---

# 3. Frontend

Minimal Next.js + Tailwind + shadcn/ui.

## Pages

```text
/dashboard

/transactions
/transactions/new
/transactions/:id

/wallet

/settlement-config
```

### Transactions

Show:

```text
Transactions

[New Transaction]

ID       Order       Amount    Fee    Net    Status
1001     ORD-1001   ৳1000     ৳20    ৳980   Completed
1002     ORD-1002   ৳500      ৳10    ৳490   Pending
```

Click row → transaction details.

---

# 4. New Transaction

Form:

```text
Merchant
Order ID
Invoice ID
Amount
Currency
POS

[Create Transaction]
```

Example:

```json
{
  "merchant_id": 1,
  "order_id": "ORDER-1001",
  "invoice_id": "INV-1001",
  "amount": "1000.00",
  "currency_id": 4,
  "pos_id": 1
}
```

On creation:

```text
Transaction State = Pending
```

Cron later changes it:

```text
Pending → Completed
```

---

# 5. Transaction Details

Show:

```text
Transaction #1001

Order ID       ORDER-1001
Invoice ID     INV-1001

Gross          ৳1,000
Fee            ৳20
Net            ৳980
Refunded       ৳0
Refundable     ৳1,000

Status         Completed

----------------------------

Refund Amount
[ 300.00 ]

[ Refund ]
```

Refund button only available for:

```text
Completed
Partial Refunded
```

---

# 6. Refund

User enters refund amount.

Example:

```text
Gross = ৳1000
Refunded = ৳0

Refund = ৳300
```

Refund is direct — no Pending/approval step. Submitting the form immediately:

```text
Refund Status = Completed
refunded_amount += 300
wallet balance deducted
```

Transaction becomes:

```text
Partial Refunded
```

If:

```text
refunded_amount == gross
```

then:

```text
Transaction = Refunded
```

Validation:

```text
refund amount > 0

refund amount <=
gross - refunded_amount
```

Example:

```text
Gross:       ৳1000
Refunded:    ৳300
Refundable:  ৳700
```

---

# 7. Merchant Wallet

Wallet contains:

```text
total_balance
available_balance
blocked_balance
```

Formula:

```text
total_balance =
available_balance + blocked_balance
```

Frontend:

```text
Merchant Wallet

Total Balance       ৳1,470
Available Balance   ৳0
Blocked Balance     ৳1,470
```

---

# 8. Payment → Wallet

Example payment:

```text
Gross = ৳1000
Fee   = ৳20
Net   = ৳980
```

When payment becomes Completed:

```text
total_balance += 980
blocked_balance += 980
```

Result:

```text
Total      ৳980
Available  ৳0
Blocked    ৳980
```

Second payment:

```text
Gross = ৳500
Fee   = ৳10
Net   = ৳490
```

Result:

```text
Total      ৳1470
Available  ৳0
Blocked    ৳1470
```

---

# 9. PSP Merchant Settlement Configuration

PSP configures each merchant.

Frontend:

```text
Merchant: ABC Store

Settlement Cycle

( ) Daily
( ) Weekly
( ) Monthly

Settlement Time
[ 02:00 ]

Rolling Percentage
[ 10 ] %

Rolling Period

( ) Weekly
( ) Monthly

[ Save Configuration ]
```

Configuration fields:

```text
settlement_cycle
settlement_time
rolling_percentage
rolling_period
```

## Settlement Cycle

Supported:

```text
Daily
Weekly
Monthly
```

## Rolling Percentage & Period

Each completed transaction is split in two the moment it completes:

```text
rolling_amount = net * rolling_percentage / 100
blocked_amount = net - rolling_amount
```

`rolling_amount` is held per-transaction and only released back into the
wallet once its own `rolling_period` (Weekly or Monthly) has elapsed from
completion — independent of the settlement cycle. `blocked_amount` becomes
available at the merchant's next settlement cycle tick (see §10).

Example:

```text
Transaction net = ৳100
Rolling percentage = 10%

Rolling reserve = ৳10   (released 1 rolling period later)
Blocked          = ৳90  (released at next settlement cycle)
```

There is no flat block amount — the entire blocked portion of a transaction
is released at the next settlement cycle; only the rolling percentage is
held back longer-term.

---

# 10. Settlement Eligibility

When settlement time arrives, eligible blocked money becomes available for settlement.

Example:

```text
Total      ৳1470
Blocked    ৳1470
Available  ৳0
```

After settlement eligibility:

```text
Total      ৳1470
Blocked    ৳0
Available  ৳1470
```

Then settlement can be requested.

---

# 11. Settlement

Merchant can request settlement.

Frontend:

```text
Available Balance: ৳1470

Settlement Amount
[ 1000.00 ]

[ Request Settlement ]
```

API:

```http
POST /api/merchants/:id/settlements
```

Body:

```json
{
  "amount": "1000.00"
}
```

New settlement:

```text
Status = Pending
```

Cron:

```text
Pending → Completed
```

On completion:

```text
available_balance -= amount
total_balance -= amount
```

Example:

```text
Before:

Total      ৳1470
Available  ৳1470
Blocked    ৳0

Settlement = ৳1000

After:

Total      ৳470
Available  ৳470
Blocked    ৳0
```

Prevent:

```text
settlement amount > available balance
```

---

# 12. Database

Keep existing tables:

```text
merchants
currencies
pos
transactions
refunds
```

Modify/add:

## wallets

```text
id
merchant_id
currency_id
total_balance
available_balance
blocked_balance
rolling_balance
created_at
updated_at
```

```text
total_balance = available_balance + blocked_balance + rolling_balance
```

Unique:

```text
merchant_id + currency_id
```

---

## transactions

```text
id
invoice_id
order_id
merchant_id
pos_id
currency_id

gross
fee
net
refunded_amount
settled_amount

rolling_amount
rolling_release_at
rolling_released_at

transaction_state
settlement_date

created_at
updated_at
completed_at
```

States:

```text
Pending
Completed
Partial Refunded
Refunded
Failed
```

---

## refunds

```text
id
transaction_id
amount
status
created_at
completed_at
```

Refunds are created directly as `Completed` — there is no `Pending`
approval step; `completed_at` is set immediately on creation.

---

## settlements

```text
id
merchant_id
wallet_id
amount
status
created_at
completed_at
```

Statuses:

```text
Pending
Completed
Failed
```

---

## merchant settlement config

Add simple table:

```text
merchant_settlement_configs

id
merchant_id
settlement_cycle
settlement_time
rolling_percentage
rolling_period
last_settled_at
created_at
updated_at
```

Example:

```text
merchant_id         1
settlement_cycle    Daily
settlement_time     02:00
rolling_percentage  10
rolling_period      Monthly
```

---

# 13. API

```http
POST /api/payments

GET /api/payments

GET /api/payments/:id

POST /api/payments/:id/refund

GET /api/merchants/:id/wallet

GET /api/merchants/:id/settlement-config

PUT /api/merchants/:id/settlement-config

POST /api/merchants/:id/settlements

GET /api/merchants/:id/settlements
```

---

# 14. Cron Jobs

Run every minute for demo.

```text
process-payments
process-settlements
process-rolling-releases
```

Refunds are not a cron job — they apply immediately when requested (see §6).

## Payment job

```text
Find Pending payments
        ↓
Mark Completed
        ↓
Split net into rolling_amount / blocked_amount
        ↓
Update wallet (total, blocked, rolling)
        ↓
Set rolling_release_at = now + rolling_period
```

## Settlement job

```text
For each merchant config, if cycle is due
        ↓
Move entire blocked_balance → available_balance
        ↓
Set last_settled_at = now
```

## Rolling release job

```text
Find transactions where rolling_release_at <= now
and rolling_released_at is null
        ↓
Move rolling_amount → available_balance
        ↓
Set rolling_released_at = now
```

---

# 15. Wallet Rules

## Payment

```text
total += net
rolling_amount = net * rolling_percentage / 100
blocked += (net - rolling_amount)
rolling += rolling_amount
```

## Settlement eligibility (cycle tick)

```text
available += blocked
blocked = 0
```

## Rolling release (per transaction, when its rolling_period elapses)

```text
available += transaction.rolling_amount
rolling -= transaction.rolling_amount
```

## Settlement request (merchant payout, §11)

```text
available -= settlement_amount
total -= settlement_amount
```

## Refund

Deducted in priority order — blocked first, then available, then rolling —
so a refund never has to wait on a bucket that happens to be empty:

```text
remaining = refund_amount

take = min(remaining, blocked);   blocked -= take;   remaining -= take
take = min(remaining, available); available -= take; remaining -= take
take = min(remaining, rolling);   rolling -= take;   remaining -= take

total -= refund_amount
```

Never allow:

```text
total < 0
available < 0
blocked < 0
rolling < 0
```

---

# 16. Rolling Balance Rule

Rolling is tracked per transaction, not as a flat configuration value.

Each merchant configures:

```text
rolling_percentage   e.g. 10%
rolling_period       Weekly or Monthly
```

When a transaction completes, `rolling_percentage` of its `net` amount is
held as that transaction's own rolling reserve, separate from the wallet's
`blocked_balance`:

```text
rolling_amount = net * rolling_percentage / 100
rolling_release_at = completed_at + rolling_period
```

That reserve is released back into `available_balance` only once its own
`rolling_release_at` has passed — independent of the settlement cycle, and
independent of every other transaction's reserve.

Example:

```text
Transaction: net ৳100, rolling 10%, cycle Daily, period Monthly

On completion:
  total     ৳100
  available ৳0
  blocked   ৳90   (released at next daily settlement)
  rolling   ৳10   (released 1 month after completion)

After next settlement tick:
  available ৳90
  blocked   ৳0
  rolling   ৳10

After 1 month (rolling release):
  available ৳100
  rolling   ৳0
```

---

# 17. Transaction Safety

Wallet-changing operations must use DB transaction.

Example:

```text
BEGIN

Lock wallet
    ↓
Validate balance
    ↓
Update wallet
    ↓
Update transaction/refund/settlement
    ↓
COMMIT
```

On error:

```text
ROLLBACK
```

Use:

```sql
SELECT ... FOR UPDATE
```

to prevent concurrent balance corruption.

---

# 18. Demo Scenario

Initial:

```text
Total      ৳0
Available  ৳0
Blocked    ৳0
```

Payment 1:

```text
Gross = ৳1000
Fee   = ৳20
Net   = ৳980
```

After cron:

```text
Total      ৳980
Available  ৳0
Blocked    ৳980
```

Payment 2:

```text
Gross = ৳500
Fee   = ৳10
Net   = ৳490
```

After cron:

```text
Total      ৳1470
Available  ৳0
Blocked    ৳1470
```

Settlement eligibility:

```text
Total      ৳1470
Available  ৳1470
Blocked    ৳0
```

Partial refund:

```text
Refund = ৳300
```

Result:

```text
Total      ৳1170
Available  ৳1170
Blocked    ৳0

Transaction:
Partial Refunded
```

Settlement:

```text
Settlement = ৳1000
```

After cron:

```text
Total      ৳170
Available  ৳170
Blocked    ৳0
```

---

# 19. Out of Scope

Do NOT build:

```text
Real bank integration
Real card processing
Authentication
KYC
Fraud detection
Chargeback
Dispute system
Double-entry accounting
Complex ledger
Webhook system
Notifications
Real payout integration
Frontend admin permission system
Multi-currency complexity
```

---

# 20. 2-Hour Build Plan

```text
0–20 min
Database + migrations

20–45 min
Payment API + transaction list/details

45–65 min
Wallet + payment cron

65–85 min
Refund API + refund cron

85–105 min
Settlement config + settlement API

105–120 min
Settlement cron + frontend cleanup + demo
```

---

# 21. Final Demo Scope

User should be able to do:

```text
1. Open transaction list
2. Create new transaction
3. See Pending
4. Cron → Completed
5. Open transaction details
6. Enter refund amount
7. Refund
8. See Partial Refunded / Refunded
9. Open merchant wallet
10. See Total / Available / Blocked
11. PSP configure settlement cycle/time/block/rolling
12. Request settlement
13. Cron → Settlement Completed
14. See wallet balance reduced
```

Final system:

```text
             PSP
              │
              │ configure
              ↓
       Merchant Config
              │
              ↓
        New Transaction
              │
              ↓
           Pending
              │
           Cron
              ↓
         Completed
              │
              ↓
       Merchant Wallet
        ┌─────┴─────┐
        ↓           ↓
     Refund      Settlement
        ↓           ↓
      Cron         Cron
        ↓           ↓
     Wallet       Wallet
```

**Target:** small, understandable PSP demo. No production complexity.
