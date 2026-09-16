# Module 5 — Wallet, Fees & Refunds

Module 5 provides merchant wallet visibility, merchant-scoped transaction history,
refunds through the Bank System, and the fee utility shared with checkout.

## Prerequisites

- Apply migrations through `alembic upgrade head`.
- Module 3 authentication must be available. Merchant endpoints use a JWT in
  `Authorization: Bearer <token>`.
- A completed checkout transaction must have a `bank_reference`, created by
  Module 4 after a successful Bank System charge.
- Configure the Bank System connection in `.env`:

```env
BANK_API_URL=http://localhost:8001
BANK_API_KEY=<same value as the Bank System BANK_API_KEY>
```

## Fee utility

`app.core.utils.fee.calculate_fee(gross, pos)` is used by checkout and returns:

```python
fee, net = calculate_fee(gross, pos)
```

The calculation is `gross * commission_percentage / 100 + commission_fixed`.
`net` is `gross - fee`.

## Merchant endpoints

All successful single-object responses use the standard `ApiResponse` envelope.

### Get wallet balances

`GET /api/merchant/wallet`

Requires a merchant JWT. Returns every wallet owned by the authenticated merchant,
including its currency and current balance.

### List merchant transactions

`GET /api/merchant/transactions?page=1&page_size=20`

Requires a merchant JWT. Only returns transactions owned by the authenticated
merchant. It uses the project pagination response with `items`, `total`, `page`,
`page_size`, and `pages`.

### Create or retry a refund

`POST /api/refund`

Requires a merchant JWT.

```json
{
  "invoice_id": "INV-EXAMPLE-001",
  "amount": 20.00,
  "idempotency_key": "INV-EXAMPLE-001:refund:1"
}
```

`idempotency_key` is optional. If omitted, the gateway generates one and returns
it in the response. Clients should retain and reuse that key when retrying the
same refund operation.

The refund flow:

1. Confirms the transaction belongs to the authenticated merchant and is
   `Completed` or `Partial Refunded`.
2. Confirms the requested amount does not exceed `gross - refunded_amount`.
3. Saves a pending refund record with the idempotency key.
4. Calls `POST /api/cards/refund` on the Bank System using the original charge
   `bank_reference`.
5. On approval, records the Bank refund reference, increments
   `refunded_amount`, updates the transaction to `Partial Refunded` or
   `Refunded`, and deducts the full customer refund from the merchant wallet.

The gateway credits a merchant wallet with the net sale amount but deducts the
full refund amount, as specified by the team plan. A wallet can therefore become
negative after a full refund; this preserves the customer's refund rather than
rejecting it because fees were previously retained.

## Database changes

Migration `f7b8c9d0e1f2_add_payment_and_refund_references.py` adds:

- `transactions.bank_reference`
- `transactions.decline_reason`
- `refunds.idempotency_key`
- `refunds.bank_reference`
- `refunds.decline_reason`

Apply it with:

```bash
alembic upgrade head
```

## Verification

Run the focused Module 4/5 coverage:

```bash
pytest -q tests/test_checkout_refund.py
```

For a live flow, start the Bank System on port `8001`, ensure both systems use
the same `BANK_API_KEY`, create a checkout transaction, complete its payment,
then call `/api/refund` with the merchant JWT.
