# Manual Testing Reference

A complete, step-by-step, copy-paste-runnable test flow for the Payment
Gateway (Milestones 1-4), including every edge case worth checking. Each
step shows the exact command and what to expect. Run from a terminal with
`docker compose up -d` already running at the repo root (both `bank-system`
and `payment-gateway`).

Bank System test cards used below (full table + more scenarios: `bank-system/TESTING.md`):

| Holder | Card use |
|---|---|
| John Doe | Happy path - always approves |
| Jane Smith | `INSUFFICIENT_FUNDS` |

Card numbers/CVVs are regenerated on every reseed - pull current ones with:
```bash
docker exec internship-softrobotics-fahim-postgres-1 psql -U postgres -d bank_demo -c \
  "SELECT a.holder_name, c.card_number, c.cvv, c.expiry_month, c.expiry_year FROM accounts a JOIN cards c ON c.account_id=a.id;"
```

Set these once and reuse throughout:
```bash
BASE=http://localhost:8000
JOHN_CARD=<card_number for John Doe>
JOHN_CVV=<cvv for John Doe>
JANE_CARD=<card_number for Jane Smith>
JANE_CVV=<cvv for Jane Smith>
```

---

## 0. Health & baseline error shapes

```bash
curl -s $BASE/health
# {"status":"ok","service":"Payment Gateway"}

curl -s -w "\n%{http_code}\n" $BASE/api/nope
# {"success":false,"error":{"code":"NOT_FOUND","message":"Not Found"},"status_code":404}  /  404

curl -s -w "\n%{http_code}\n" $BASE/nope
# an HTML error page (non-/api/ routes render EJS, not JSON)  /  404
```

---

## 1. Merchant registration & credentials

```bash
# 1.1 Register - expect 201, status "pending", a one-time api_key
REG=$(curl -s -X POST $BASE/api/merchant/register -H "Content-Type: application/json" \
  -d '{"name":"Test Owner","email":"test1@example.com","password":"secret123","store_name":"Test Store","address":"Dhaka"}')
echo "$REG"
MID=$(echo "$REG" | node -pe "JSON.parse(require('fs').readFileSync(0)).merchant_id")
API_KEY=$(echo "$REG" | node -pe "JSON.parse(require('fs').readFileSync(0)).api_key")

# 1.2 EDGE CASE: duplicate email -> 409 CONFLICT
curl -s -w "\n%{http_code}\n" -X POST $BASE/api/merchant/register -H "Content-Type: application/json" \
  -d '{"name":"X","email":"test1@example.com","password":"secret123","store_name":"Y"}'

# 1.3 EDGE CASE: weak password (<8 chars) -> 422 VALIDATION_ERROR with field detail
curl -s -w "\n%{http_code}\n" -X POST $BASE/api/merchant/register -H "Content-Type: application/json" \
  -d '{"name":"X","email":"test2@example.com","password":"short","store_name":"Y"}'

# 1.4 EDGE CASE: invalid email format -> 422
curl -s -w "\n%{http_code}\n" -X POST $BASE/api/merchant/register -H "Content-Type: application/json" \
  -d '{"name":"X","email":"not-an-email","password":"secret123","store_name":"Y"}'

# 1.5 EDGE CASE: whoami while still pending -> 403 FORBIDDEN
curl -s -w "\n%{http_code}\n" $BASE/api/merchant/whoami -H "X-API-KEY: $API_KEY"

# 1.6 EDGE CASE: wrong API key -> 401 UNAUTHORIZED
curl -s -w "\n%{http_code}\n" $BASE/api/merchant/whoami -H "X-API-KEY: wrong-key"

# 1.7 EDGE CASE: missing API key -> 401
curl -s -w "\n%{http_code}\n" $BASE/api/merchant/whoami

# 1.8 Login - expect 200 + token
LOGIN=$(curl -s -X POST $BASE/api/merchant/login -H "Content-Type: application/json" \
  -d '{"email":"test1@example.com","password":"secret123"}')
echo "$LOGIN"
TOKEN=$(echo "$LOGIN" | node -pe "JSON.parse(require('fs').readFileSync(0)).token")

# 1.9 EDGE CASE: wrong password -> 401
curl -s -w "\n%{http_code}\n" -X POST $BASE/api/merchant/login -H "Content-Type: application/json" \
  -d '{"email":"test1@example.com","password":"wrong-password"}'

# 1.10 EDGE CASE: non-existent email -> 401 (same message as wrong password - don't reveal which)
curl -s -w "\n%{http_code}\n" -X POST $BASE/api/merchant/login -H "Content-Type: application/json" \
  -d '{"email":"nobody@example.com","password":"secret123"}'

# 1.11 Profile while pending - login still works even though not yet approved
curl -s $BASE/api/merchant/profile -H "Authorization: Bearer $TOKEN"

# 1.12 EDGE CASE: profile without a token -> 401
curl -s -w "\n%{http_code}\n" $BASE/api/merchant/profile

# 1.13 EDGE CASE: malformed Authorization header -> 401
curl -s -w "\n%{http_code}\n" $BASE/api/merchant/profile -H "Authorization: NotBearer $TOKEN"
```

---

## 2. Admin approval flow

```bash
# 2.1 Admin login
ADMIN_TOKEN=$(curl -s -X POST $BASE/api/admin/login -H "Content-Type: application/json" \
  -d '{"email":"admin@gateway.local","password":"admin123"}' | node -pe "JSON.parse(require('fs').readFileSync(0)).token")

# 2.2 EDGE CASE: a merchant's own JWT used on an admin route -> 403 FORBIDDEN
curl -s -w "\n%{http_code}\n" $BASE/api/admin/merchants -H "Authorization: Bearer $TOKEN"

# 2.3 List merchants (paginated) - the new one should show status "pending", pricing_plans: []
curl -s "$BASE/api/admin/merchants?page=1&page_size=20" -H "Authorization: Bearer $ADMIN_TOKEN"

# 2.4 EDGE CASE: approve a non-existent merchant id -> 404
curl -s -w "\n%{http_code}\n" -X POST $BASE/api/admin/merchants/999999/approve -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -d '{"currency":"BDT","commission_percentage":2,"commission_fixed":5,"settlement_day":3}'

# 2.5 EDGE CASE: approve with an unsupported currency code -> 404
curl -s -w "\n%{http_code}\n" -X POST $BASE/api/admin/merchants/$MID/approve -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -d '{"currency":"ZZZ","commission_percentage":2,"commission_fixed":5,"settlement_day":3}'

# 2.6 Approve for real - expect status "active" in the response
curl -s -X POST $BASE/api/admin/merchants/$MID/approve -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -d '{"currency":"BDT","commission_percentage":2,"commission_fixed":5,"settlement_day":3}'

# 2.7 whoami now succeeds
curl -s $BASE/api/merchant/whoami -H "X-API-KEY: $API_KEY"

# 2.8 Re-approving the SAME currency updates the existing plan (upsert, not duplicate) -
#     run 2.6 again with different numbers and confirm profile shows the NEW rate, not two plans
curl -s -X POST $BASE/api/admin/merchants/$MID/approve -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -d '{"currency":"BDT","commission_percentage":2.5,"commission_fixed":5,"settlement_day":3}'
curl -s $BASE/api/merchant/profile -H "Authorization: Bearer $TOKEN"

# 2.9 Regenerate API key - old one must stop working immediately
NEWKEY=$(curl -s -X POST $BASE/api/merchant/api-key/regenerate -H "Authorization: Bearer $TOKEN" | node -pe "JSON.parse(require('fs').readFileSync(0)).api_key")
curl -s -w "\n%{http_code}\n" $BASE/api/merchant/whoami -H "X-API-KEY: $API_KEY"   # old key -> 401
curl -s -w "\n%{http_code}\n" $BASE/api/merchant/whoami -H "X-API-KEY: $NEWKEY"   # new key -> 200
API_KEY=$NEWKEY
```

---

## 3. Checkout session creation

```bash
# 3.1 EDGE CASE: unsupported currency -> 422
curl -s -w "\n%{http_code}\n" -X POST $BASE/api/checkout/init -H "X-API-KEY: $API_KEY" -H "Content-Type: application/json" \
  -d '{"order_id":"ORD-X1","amount":10,"currency":"ZZZ","success_url":"http://localhost:9999/success","fail_url":"http://localhost:9999/fail"}'

# 3.2 EDGE CASE: currency merchant has no pricing plan for -> 422, checked BEFORE any card is ever collected
curl -s -w "\n%{http_code}\n" -X POST $BASE/api/checkout/init -H "X-API-KEY: $API_KEY" -H "Content-Type: application/json" \
  -d '{"order_id":"ORD-X2","amount":10,"currency":"USD","success_url":"http://localhost:9999/success","fail_url":"http://localhost:9999/fail"}'

# 3.3 EDGE CASE: invalid success_url (not a URL) -> 422
curl -s -w "\n%{http_code}\n" -X POST $BASE/api/checkout/init -H "X-API-KEY: $API_KEY" -H "Content-Type: application/json" \
  -d '{"order_id":"ORD-X3","amount":10,"currency":"BDT","success_url":"not-a-url","fail_url":"http://localhost:9999/fail"}'

# 3.4 EDGE CASE: negative/zero amount -> 422
curl -s -w "\n%{http_code}\n" -X POST $BASE/api/checkout/init -H "X-API-KEY: $API_KEY" -H "Content-Type: application/json" \
  -d '{"order_id":"ORD-X4","amount":0,"currency":"BDT","success_url":"http://localhost:9999/success","fail_url":"http://localhost:9999/fail"}'

# 3.5 EDGE CASE: no X-API-KEY -> 401
curl -s -w "\n%{http_code}\n" -X POST $BASE/api/checkout/init -H "Content-Type: application/json" \
  -d '{"order_id":"ORD-X5","amount":10,"currency":"BDT","success_url":"http://localhost:9999/success","fail_url":"http://localhost:9999/fail"}'

# 3.6 Happy path init - save invoice_id for the next section
INIT=$(curl -s -X POST $BASE/api/checkout/init -H "X-API-KEY: $API_KEY" -H "Content-Type: application/json" \
  -d '{"order_id":"ORD-1","amount":500,"currency":"BDT","success_url":"http://localhost:9999/success","fail_url":"http://localhost:9999/fail"}')
echo "$INIT"
INVOICE=$(echo "$INIT" | node -pe "JSON.parse(require('fs').readFileSync(0)).invoice_id")
```

---

## 4. Hosted checkout page & payment

**Open the `checkout_url` from step 3.6 in an actual browser for this section** - curl can hit the page but won't show you the live countdown, inline field-level validation highlighting, or how the closed/expired pages actually look. See "Browser checklist" below.

```bash
# 4.1 GET the page - expect the card form (curl just for a quick sanity check)
curl -s $BASE/checkout/$INVOICE | grep -o '<h1>[^<]*</h1>\|action="[^"]*"'

# 4.2 EDGE CASE: unknown invoice_id -> 404 (HTML error page)
curl -s -w "\n%{http_code}\n" $BASE/checkout/inv_does_not_exist

# 4.3 EDGE CASE: malformed card number -> 422, form re-rendered with inline error, other fields preserved
curl -s -X POST $BASE/checkout/$INVOICE/pay \
  --data-urlencode "card_number=abc" --data-urlencode "card_holder_name=Test" \
  --data-urlencode "expiry_month=12" --data-urlencode "expiry_year=2029" --data-urlencode "cvv=123" \
  | grep -A1 "flash-error"

# 4.4 Pay with John Doe's card (approved) - expect a 302 to success_url
curl -s -i -X POST $BASE/checkout/$INVOICE/pay \
  --data-urlencode "card_number=$JOHN_CARD" --data-urlencode "card_holder_name=John Doe" \
  --data-urlencode "expiry_month=12" --data-urlencode "expiry_year=2029" --data-urlencode "cvv=$JOHN_CVV" \
  | grep -i location

# 4.5 EDGE CASE: double-submit an already-completed session -> redirects to success_url AGAIN,
#     does NOT re-charge (check bank-system's request count doesn't move - see bank-system logs)
curl -s -i -X POST $BASE/checkout/$INVOICE/pay \
  --data-urlencode "card_number=$JOHN_CARD" --data-urlencode "card_holder_name=John Doe" \
  --data-urlencode "expiry_month=12" --data-urlencode "expiry_year=2029" --data-urlencode "cvv=$JOHN_CVV" \
  | grep -i location

# 4.6 GET the page for a completed session -> "closed" page, not the form
curl -s $BASE/checkout/$INVOICE | grep -o '<h1>[^<]*</h1>'

# 4.7 A fresh session, declined card (Jane Smith) -> 302 to fail_url?reason=INSUFFICIENT_FUNDS
INIT2=$(curl -s -X POST $BASE/api/checkout/init -H "X-API-KEY: $API_KEY" -H "Content-Type: application/json" \
  -d '{"order_id":"ORD-2","amount":500,"currency":"BDT","success_url":"http://localhost:9999/success","fail_url":"http://localhost:9999/fail"}')
INVOICE2=$(echo "$INIT2" | node -pe "JSON.parse(require('fs').readFileSync(0)).invoice_id")
curl -s -i -X POST $BASE/checkout/$INVOICE2/pay \
  --data-urlencode "card_number=$JANE_CARD" --data-urlencode "card_holder_name=Jane Smith" \
  --data-urlencode "expiry_month=12" --data-urlencode "expiry_year=2029" --data-urlencode "cvv=$JANE_CVV" \
  | grep -i location

# 4.8 EDGE CASE: expired session never reaches the Bank System. Backdate one, then try to pay it.
INIT3=$(curl -s -X POST $BASE/api/checkout/init -H "X-API-KEY: $API_KEY" -H "Content-Type: application/json" \
  -d '{"order_id":"ORD-3","amount":500,"currency":"BDT","success_url":"http://localhost:9999/success","fail_url":"http://localhost:9999/fail"}')
INVOICE3=$(echo "$INIT3" | node -pe "JSON.parse(require('fs').readFileSync(0)).invoice_id")
docker exec internship-softrobotics-fahim-postgres-1 psql -U postgres -d payment_gateway -c \
  "UPDATE transactions SET expires_at = now() - interval '1 minute' WHERE invoice_id = '$INVOICE3';"
BANK_CALLS_BEFORE=$(docker logs internship-softrobotics-fahim-bank-system-1 2>&1 | grep -c "cards/charge")
curl -s $BASE/checkout/$INVOICE3 | grep -o '<h1>[^<]*</h1>'   # -> "Payment link expired"
curl -s -i -X POST $BASE/checkout/$INVOICE3/pay \
  --data-urlencode "card_number=$JOHN_CARD" --data-urlencode "card_holder_name=John Doe" \
  --data-urlencode "expiry_month=12" --data-urlencode "expiry_year=2029" --data-urlencode "cvv=$JOHN_CVV" \
  | grep -i location   # -> fail_url?reason=SESSION_EXPIRED
BANK_CALLS_AFTER=$(docker logs internship-softrobotics-fahim-bank-system-1 2>&1 | grep -c "cards/charge")
echo "bank charge calls before=$BANK_CALLS_BEFORE after=$BANK_CALLS_AFTER (must be equal)"
```

### Browser checklist (do this manually)
1. Create a fresh session (repeat 3.6) and open its `checkout_url`.
2. Watch the countdown under the amount actually tick down second by second.
3. Click "Pay" with all fields empty - see the browser's native required-field highlighting before any request is even sent.
4. Type a 3-digit card number and submit - see the red inline error appear under that field without losing what you typed elsewhere.
5. Pay with a real test card and confirm the browser actually navigates to `success_url`/`fail_url`.
6. Reload the page after paying - confirm you see the "already paid" closed page, not the form again.

---

## 5. Server-side verify

```bash
# 5.1 Happy path - full transaction detail
curl -s $BASE/api/transactions/$INVOICE/verify -H "X-API-KEY: $API_KEY"

# 5.2 EDGE CASE: no X-API-KEY -> 401
curl -s -w "\n%{http_code}\n" $BASE/api/transactions/$INVOICE/verify

# 5.3 EDGE CASE: unknown invoice_id -> 404
curl -s -w "\n%{http_code}\n" $BASE/api/transactions/inv_does_not_exist/verify -H "X-API-KEY: $API_KEY"

# 5.4 EDGE CASE: a DIFFERENT merchant's API key trying to verify this invoice -> 404,
#     not 403 - never confirm to one merchant that another's invoice_id exists
OTHER_KEY=$(curl -s -X POST $BASE/api/merchant/register -H "Content-Type: application/json" \
  -d '{"name":"Other","email":"other@example.com","password":"secret123","store_name":"Other Store"}' \
  | node -pe "JSON.parse(require('fs').readFileSync(0)).api_key")
curl -s -w "\n%{http_code}\n" $BASE/api/transactions/$INVOICE/verify -H "X-API-KEY: $OTHER_KEY"
```

---

## 6. Wallet & transactions

```bash
# 6.1 Wallet balance - should be net (gross - fee), not gross
curl -s $BASE/api/merchant/wallet -H "Authorization: Bearer $TOKEN"

# 6.2 EDGE CASE: no token -> 401
curl -s -w "\n%{http_code}\n" $BASE/api/merchant/wallet

# 6.3 Transaction list, paginated - only THIS merchant's own transactions
curl -s "$BASE/api/merchant/transactions?page=1&page_size=10" -H "Authorization: Bearer $TOKEN"
```

---

## 7. Refunds

```bash
# 7.1 EDGE CASE: refund more than the transaction's remaining balance -> 422
curl -s -w "\n%{http_code}\n" -X POST $BASE/api/refund -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"invoice_id\":\"$INVOICE\",\"amount\":100000}"

# 7.2 EDGE CASE: refund a failed/declined transaction -> 422 ("Cannot refund a transaction with status...")
curl -s -w "\n%{http_code}\n" -X POST $BASE/api/refund -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"invoice_id\":\"$INVOICE2\",\"amount\":10}"

# 7.3 Partial refund - wallet debit is LESS than the refund amount (fee ratio retained)
curl -s -X POST $BASE/api/refund -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"invoice_id\":\"$INVOICE\",\"amount\":100}"
curl -s $BASE/api/merchant/wallet -H "Authorization: Bearer $TOKEN"
curl -s $BASE/api/transactions/$INVOICE/verify -H "X-API-KEY: $API_KEY"   # status: partial_refunded

# 7.4 EDGE CASE: refund exceeding what's NOW left (400 remains, try 500) -> 422
curl -s -w "\n%{http_code}\n" -X POST $BASE/api/refund -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"invoice_id\":\"$INVOICE\",\"amount\":500}"

# 7.5 Refund the exact remainder - status flips to "refunded", wallet nets to what it was pre-sale
curl -s -X POST $BASE/api/refund -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"invoice_id\":\"$INVOICE\",\"amount\":400}"
curl -s $BASE/api/merchant/wallet -H "Authorization: Bearer $TOKEN"
curl -s $BASE/api/transactions/$INVOICE/verify -H "X-API-KEY: $API_KEY"   # status: refunded

# 7.6 EDGE CASE: refund an already-fully-refunded transaction -> 422
curl -s -w "\n%{http_code}\n" -X POST $BASE/api/refund -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"invoice_id\":\"$INVOICE\",\"amount\":1}"

# 7.7 EDGE CASE: refund someone else's transaction -> 404
OTHER_TOKEN=$(curl -s -X POST $BASE/api/merchant/login -H "Content-Type: application/json" \
  -d '{"email":"other@example.com","password":"secret123"}' | node -pe "JSON.parse(require('fs').readFileSync(0)).token")
curl -s -w "\n%{http_code}\n" -X POST $BASE/api/refund -H "Authorization: Bearer $OTHER_TOKEN" -H "Content-Type: application/json" \
  -d "{\"invoice_id\":\"$INVOICE2\",\"amount\":10}"
```

---

## 8. Resilience: Bank System unreachable

```bash
# Stop the bank so the Gateway can't reach it
docker stop internship-softrobotics-fahim-bank-system-1

INIT4=$(curl -s -X POST $BASE/api/checkout/init -H "X-API-KEY: $API_KEY" -H "Content-Type: application/json" \
  -d '{"order_id":"ORD-4","amount":500,"currency":"BDT","success_url":"http://localhost:9999/success","fail_url":"http://localhost:9999/fail"}')
INVOICE4=$(echo "$INIT4" | node -pe "JSON.parse(require('fs').readFileSync(0)).invoice_id")

# Expect: redirects to fail_url?reason=GATEWAY_ERROR within ~10s (the fetch timeout), NOT a hang or a 500
curl -s -i -X POST $BASE/checkout/$INVOICE4/pay \
  --data-urlencode "card_number=$JOHN_CARD" --data-urlencode "card_holder_name=John Doe" \
  --data-urlencode "expiry_month=12" --data-urlencode "expiry_year=2029" --data-urlencode "cvv=$JOHN_CVV" \
  | grep -i location

# Bring it back
docker start internship-softrobotics-fahim-bank-system-1
```

---

## 9. Admin panel (browser)

Log in at `http://localhost:8000/admin/login` (`admin@gateway.local` / `admin123`).

1. **Dashboard** - confirm the merchant/pending/transaction/decline counts match what section 1-8 actually produced.
2. **Merchants → a merchant's detail page** - the core Milestone 5 feature. Change the commission field (e.g. from 2% to 3%, fixed fee from 5 to 10) and hit "Save & activate". Confirm the pricing plans table shows the new numbers immediately.
3. **Close the loop**: run one more `checkout/init` + pay (Postman or curl) for that merchant, then check `verify` - the `fee_amount`/`net_amount` must reflect the *new* rate, not the old one. This is the thing to actually verify, not just that the form saves.
4. **Suspend** a merchant from their detail page, then try `GET /api/merchant/whoami` with their API key in Postman - expect `403`. **Reactivate** and confirm it works again.
5. **Transactions** - filter by each status in the dropdown, confirm the table actually filters (not just cosmetically - check the URL query param changes and the rows change).
6. **Refunds** - confirm entries from section 7 show up with the correct merchant link, amount, and bank reference.
7. **Banks** - just a reference list; confirm it shows the Bank System's display row.
8. Log out, then try hitting `/admin/dashboard` directly (paste the URL) - confirm it redirects to `/admin/login` rather than showing anything.

## Already verified for you (Milestone 5)

- Renegotiating a merchant's rate via the admin form and confirming a subsequent real charge uses the new rate: tested with 2%+5 → 3%+10 on a ৳1000 charge, fee came out to exactly ৳40 (not the old ৳25)
- Re-approving the same currency updates the existing pricing plan in place (no duplicate rows)
- Suspend correctly blocks `X-API-KEY` calls (`403`), reactivate restores them
- Unauthenticated access to any `/admin/*` page redirects to `/admin/login`
- Every admin action still produces exactly one log line

---

## Result you should have at the end

- 2 merchants registered (`test1@example.com` approved for BDT, `other@example.com` never approved)
- One transaction (`$INVOICE`) fully refunded, one declined (`$INVOICE2`), one expired (`$INVOICE3`), one that failed via `GATEWAY_ERROR` (`$INVOICE4`)
- Wallet for `test1@example.com` back near where it started (net of the original ৳15 fee, since that portion is never refunded)
- Every request in the container logs as exactly one line - `docker logs internship-softrobotics-fahim-payment-gateway-1` should show no duplicate or missing lines for anything above
