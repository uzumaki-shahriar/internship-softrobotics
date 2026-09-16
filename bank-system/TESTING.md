# Manual Testing Reference

Seeded test data and ready-to-use request bodies for exercising every
decline path. Regenerate this data by wiping and re-running the seed
(`docker compose down -v && docker compose up -d --build`, or locally
`npx prisma migrate reset && node prisma/seed.js`) — card numbers/CVVs are
randomly generated each time, so re-check them against the DB after a
reset rather than assuming these exact values still apply:

```bash
docker exec internship-softrobotics-fahim-postgres-1 psql -U postgres -d bank_demo -c \
  "SELECT a.account_number, a.holder_name, a.type, a.balance, a.daily_limit, a.status, c.card_number, c.cvv, c.expiry_month, c.expiry_year, c.status as card_status FROM accounts a LEFT JOIN cards c ON c.account_id = a.id ORDER BY a.id;"
```

## Credentials & seed data at a glance

| What | Value | Used for |
|---|---|---|
| Admin login | `admin@bank.local` / `admin123` | `/admin/login` web UI |
| API key | `dev-bank-api-key` | `X-API-KEY` header on every `/api/*` request |
| Base URL | `http://localhost:8001` | All requests below |

(Admin email/password come from `ADMIN_EMAIL`/`ADMIN_PASSWORD` in
`docker-compose.yml`; API key from `BANK_API_KEY` there. Change either and
these values change with them.)

## Postman setup

Environment variables:

| Variable | Value |
|---|---|
| `base_url` | `http://localhost:8001` |
| `api_key` | `dev-bank-api-key` |

Every `/api/*` request needs headers `X-API-KEY: {{api_key}}` and
`Content-Type: application/json`.

## Seeded accounts & cards (as of last seed run)

| Holder | Account # | Type | Balance | Daily limit | Account status | Card # | CVV | Expiry | Card status | Tests |
|---|---|---|---|---|---|---|---|---|---|---|
| John Doe | `DEMO9664280989` | personal | 10000.00 | 50000.00 | active | `2269631329830537` | 186 | 12/2029 | active | Happy path |
| Jane Smith | `DEMO1867105878` | personal | 100.00 | 50000.00 | active | `2269639446175827` | 112 | 12/2029 | active | `INSUFFICIENT_FUNDS` |
| Low Limit Larry | `DEMO1948247045` | personal | 10000.00 | 200.00 | active | `2269630183085485` | 131 | 12/2029 | active | `LIMIT_EXCEEDED` |
| Frozen Fred | `DEMO7234347955` | personal | 10000.00 | 50000.00 | **frozen** | `2269639073623099` | 564 | 12/2029 | active | `ACCOUNT_FROZEN` |
| Blocked Bob | `DEMO3097935996` | personal | 10000.00 | 50000.00 | active | `2269630296386812` | 752 | 12/2029 | **blocked** | `CARD_BLOCKED` |
| Expired Eve | `DEMO9962673076` | personal | 10000.00 | 50000.00 | active | `2269634697562096` | 074 | **1/2025** | active | `EXPIRED_CARD` |
| Merchant One | `DEMO5225871423` | **business** | (varies) | 1000000.00 | active | *(no card)* | - | - | - | Payout endpoint |

Admin login: `admin@bank.local` / `admin123` at `http://localhost:8001/admin/login`.

## 1. Charge — `POST {{base_url}}/api/cards/charge`

**Uses:** `api_key` header + one row from the accounts/cards table above per scenario.

Happy path:
```json
{
  "card_number": "2269631329830537",
  "card_holder_name": "John Doe",
  "expiry_month": 12,
  "expiry_year": 2029,
  "cvv": "186",
  "amount": 500,
  "currency": "BDT",
  "idempotency_key": "postman-test-1",
  "reference": "postman-test-1"
}
```
Expect `{"status":"approved","bank_reference":"TXN-...","balance_after":9500}`.

**Always use a fresh `idempotency_key` per test** — reusing one replays the
original stored result instead of processing again (that's the point of
idempotency: proves retries are safe).

Decline scenarios — same shape, swap in:

| Scenario | card_number | cvv | expiry_month/year | amount | currency | Expected `decline_reason` |
|---|---|---|---|---|---|---|
| Insufficient funds | `2269639446175827` | 112 | 12/2029 | 500 | BDT | `INSUFFICIENT_FUNDS` |
| Limit exceeded | `2269630183085485` | 131 | 12/2029 | 500 | BDT | `LIMIT_EXCEEDED` |
| Frozen account | `2269639073623099` | 564 | 12/2029 | 100 | BDT | `ACCOUNT_FROZEN` |
| Blocked card | `2269630296386812` | 752 | 12/2029 | 100 | BDT | `CARD_BLOCKED` |
| Expired card | `2269634697562096` | 074 | 1/2025 | 100 | BDT | `EXPIRED_CARD` |
| CVV mismatch | `2269631329830537` | **000** | 12/2029 | 100 | BDT | `CVV_MISMATCH` |
| Invalid card | `9999999999999999` | 123 | 12/2029 | 100 | BDT | `INVALID_CARD` |
| Unsupported currency | `2269631329830537` | 186 | 12/2029 | 100 | **USD** | `CURRENCY_NOT_SUPPORTED` |

Also worth testing:
- No `X-API-KEY` header → `401 UNAUTHORIZED`
- Malformed body (e.g. `"card_number": "abc"`) → `422 VALIDATION_ERROR` with per-field details
- Same `idempotency_key` sent twice → identical response both times, balance only moves once

## 2. Refund — `POST {{base_url}}/api/cards/refund`

**Uses:** `api_key` header + a `bank_reference` you got back from a charge in step 1 (run a charge first if you don't have one yet).

```json
{ "bank_reference": "TXN-DEMO001-...", "amount": 200, "idempotency_key": "postman-refund-1" }
```
Use a `bank_reference` from a prior approved charge response.

- Refund amount greater than what's left on that charge → `REFUND_EXCEEDS_CHARGE`
- Made-up `bank_reference` → `REFERENCE_NOT_FOUND`
- Refunding a charge twice for the full amount (second attempt with a new idempotency key) → `REFUND_EXCEEDS_CHARGE` once nothing is left

## 3. Payout (merchant settlement) — `POST {{base_url}}/api/accounts/payout`

**Uses:** `api_key` header + Merchant One's account number `DEMO5225871423` (the only `business`-type seeded account — no card, since payouts never involve a card).

```json
{
  "account_number": "DEMO5225871423",
  "amount": 250,
  "currency": "BDT",
  "idempotency_key": "postman-payout-1",
  "reference": "postman-payout-1"
}
```
- Bad account number → `ACCOUNT_NOT_FOUND`
- Freeze `DEMO5225871423` in the admin panel first, then retry → `ACCOUNT_FROZEN`

## 4. Balance check — `GET {{base_url}}/api/accounts/{account_number}/balance`

**Uses:** `api_key` header + any account number from the table above.

No body, just the `X-API-KEY` header. Example:
`GET {{base_url}}/api/accounts/DEMO9664280989/balance`

## 5. Admin panel walkthrough (browser)

**Uses:** Admin login `admin@bank.local` / `admin123`.

1. Log in at `/admin/login`.
2. `/admin/dashboard` — sanity-check the counters after running the tests above.
3. `/admin/accounts` → open an account → Freeze it → re-run a charge against its card in Postman → should now decline `ACCOUNT_FROZEN`. Unfreeze to revert.
4. `/admin/cards` → block/unblock a card the same way.
5. `/admin/accounts/new` → create a new personal or business account, then (for personal) `/admin/cards/new` → issue it a card, then charge that new card from Postman to confirm the full loop.
6. `/admin/transactions` → filter by `declined` to see every decline reason you triggered above, with file-accurate detail in `docker logs internship-softrobotics-fahim-bank-system-1`.
