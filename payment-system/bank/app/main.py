from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid

app = FastAPI(title="Mini Bank")

# Simple in-memory store for idempotency and accounts (for local testing only).
_idempotency = {}
_accounts = {
    "4242424242424242": {"account_number": "ACC-1001", "balance": 10000.00, "status": "active"}
}


class ChargeRequest(BaseModel):
    card_number: str
    card_holder_name: str
    expiry_month: int
    expiry_year: int
    cvv: str
    amount: float
    currency: str
    idempotency_key: str
    reference: Optional[str] = None


class ChargeResponse(BaseModel):
    status: str
    bank_reference: Optional[str] = None
    balance_after: Optional[float] = None
    decline_reason: Optional[str] = None


@app.post("/api/cards/charge", response_model=ChargeResponse)
def charge(req: ChargeRequest):
    # idempotency
    if req.idempotency_key in _idempotency:
        return _idempotency[req.idempotency_key]

    acct = _accounts.get(req.card_number)
    if not acct:
        resp = ChargeResponse(status="declined", decline_reason="INVALID_CARD")
        _idempotency[req.idempotency_key] = resp
        return resp

    if acct["status"] != "active":
        resp = ChargeResponse(status="declined", decline_reason="ACCOUNT_FROZEN")
        _idempotency[req.idempotency_key] = resp
        return resp

    if acct["balance"] < req.amount:
        resp = ChargeResponse(status="declined", decline_reason="INSUFFICIENT_FUNDS")
        _idempotency[req.idempotency_key] = resp
        return resp

    # approve
    acct["balance"] -= req.amount
    bank_ref = f"TXN-BANK-{uuid.uuid4().hex[:8]}"
    resp = ChargeResponse(status="approved", bank_reference=bank_ref, balance_after=acct["balance"]) 
    _idempotency[req.idempotency_key] = resp
    return resp


@app.post("/api/cards/refund")
def refund(data: dict):
    # simplistic refund: expects {"bank_reference": "...", "amount": 100}
    return {"status": "refunded"}


@app.get("/api/accounts/{account_number}/balance")
def balance(account_number: str):
    for c, v in _accounts.items():
        if v["account_number"] == account_number:
            return {"balance": v["balance"]}
    raise HTTPException(status_code=404, detail="Account not found")
