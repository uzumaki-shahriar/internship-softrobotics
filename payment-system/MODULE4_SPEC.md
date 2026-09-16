Module 4 — Settlement, Reconciliation, Orchestration, Tests
===============================================

Summary
-------
Module 4 adds merchant settlement and reconciliation features to the Payment Gateway, local orchestration (docker-compose) to run Bank/Gateway/Ecommerce together, and end-to-end tests.

Assumptions
-----------
- Settlements run once per day (configurable) and settle completed transactions whose settlement date <= today.
- Settlement moves `net` from gateway bookkeeping into a `settlements` ledger and reduces merchant `wallets` balance.
- Idempotency: each settlement run is idempotent per `settlement_id`.

DB additions
------------
- `settlements` table:
  - id, merchant_id, currency, gross_total, fee_total, net_total, status (pending|settled|failed), scheduled_at, settled_at, created_at
- `settlement_items` table (rows settled in a settlement):
  - id, settlement_id (FK), transaction_id (gateway transactions.invoice_id), gross, fee, net
- `reconciliation_reports` (optional cached reports): id, merchant_id, date, report_json, generated_at

Scheduler behavior
------------------
- Daily job (configurable cron) runs:
  1. Query `transactions` where state=Completed and not yet included in a settlement and settlement_date <= now
  2. Group by `merchant_id`, currency
  3. For each merchant group create `settlements` row with status=pending and add `settlement_items` rows
  4. Attempt to mark settlement as `settled` by debiting gateway internal funds and marking merchant `wallets` balance decreased by `net_total`.
  5. If any failure, mark settlement `failed` and include an error message in logs (retryable)

Edge cases & guarantees
-----------------------
- Settlement must be idempotent: re-running the scheduler must not double-settle the same `transaction`.
- If a merchant's wallet doesn't have sufficient funds to cover a settlement reversal, settlement should fail and be retried; however normal flow is to credit wallets on transaction completion so this shouldn't occur.
- Timezones: all scheduled_at/settled_at are stored in UTC.

APIs to add
-----------
- `GET /api/settlements` (admin/merchant) — list settlements with pagination/filter by merchant/date/status
- `GET /api/settlements/{id}` — detail with `settlement_items`
- `POST /api/settlements/{id}/retry` — admin endpoint to retry failed settlement
- `GET /api/reports/merchant/{merchant_id}?date=YYYY-MM-DD` — reconciliation report for that day

Orchestration (docker-compose)
------------------------------
- Add `docker-compose.yml` at repo root that defines three services:
  - `bank` (port 8001)
  - `gateway` (port 8000)
  - `shop` (port 8002)
- Each service uses its folder and a simple `Dockerfile`/`requirements.txt`. Compose defines a network and environment overrides for DB urls and ports.

Tests
-----
- Add e2e tests that:
  1. Start the three services (or use test fixtures that mock Bank responses)
  2. Create a merchant, run a checkout, simulate approved and declined flows
  3. Run scheduler and verify settlements created and merchant `wallets` updated

Next steps (immediate)
----------------------
1. Implement settlement scheduler and DB migrations (create tables)
2. Add settlement API endpoints and unit tests
3. Add minimal `docker-compose.yml` for local orchestration
4. Add E2E tests and update `payment-system/README.md` with run instructions
