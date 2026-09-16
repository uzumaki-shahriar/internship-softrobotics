"""Module 5 refunds backed by the Bank System's original charge reference."""

import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.core.bank_client import post_to_bank
from app.core.dependencies import get_current_merchant
from app.core.utils.exceptions import BadRequestException, NotFoundException
from app.core.utils.response import ApiResponse
from app.database import get_session
from app.models import Merchant, Refund, Transaction, TransactionState, User, Wallet

router = APIRouter()


class RefundRequest(BaseModel):
    invoice_id: str
    amount: Decimal = Field(gt=0, max_digits=15, decimal_places=2)
    idempotency_key: str | None = None


class RefundResponse(BaseModel):
    invoice_id: str
    amount: Decimal
    state: str
    bank_reference: str | None
    decline_reason: str | None
    idempotency_key: str


def _refund_response(refund: Refund) -> RefundResponse:
    return RefundResponse(
        invoice_id=refund.invoice_id,
        amount=refund.amount,
        state=refund.transaction_state.value,
        bank_reference=refund.bank_reference,
        decline_reason=refund.decline_reason,
        idempotency_key=refund.idempotency_key,
    )


@router.post("/refund", response_model=ApiResponse[RefundResponse])
def create_refund(
    body: RefundRequest,
    current_user: User = Depends(get_current_merchant),
    session: Session = Depends(get_session),
) -> ApiResponse[RefundResponse]:
    idempotency_key = body.idempotency_key or f"{body.invoice_id}:refund:{uuid.uuid4().hex}"
    refund = session.exec(select(Refund).where(Refund.idempotency_key == idempotency_key)).first()
    if refund is not None and refund.transaction_state != TransactionState.Pending:
        return ApiResponse(message="Refund already processed", data=_refund_response(refund))

    transaction = session.exec(select(Transaction).where(Transaction.invoice_id == body.invoice_id)).first()
    if transaction is None:
        raise NotFoundException("Transaction not found")
    merchant = session.exec(select(Merchant).where(Merchant.user_id == current_user.id)).first()
    if merchant is None or transaction.merchant_id != merchant.id:
        raise NotFoundException("Transaction not found")
    if transaction.transaction_state not in {TransactionState.Completed, TransactionState.Partial_Refunded}:
        raise BadRequestException("Only completed transactions can be refunded")
    if transaction.bank_reference is None:
        raise BadRequestException("Transaction has no bank reference")

    remaining = transaction.gross - transaction.refunded_amount
    if body.amount > remaining:
        raise BadRequestException("Refund amount exceeds the remaining refundable amount")

    if refund is None:
        refund = Refund(
            transaction_id=transaction.id,
            invoice_id=transaction.invoice_id,
            transaction_state=TransactionState.Pending,
            amount=body.amount,
            idempotency_key=idempotency_key,
        )
        # Commit the pending record before the remote call so a retry can use
        # the exact same Bank idempotency key.
        session.add(refund)
        session.commit()
        session.refresh(refund)

    result = post_to_bank(
        "/api/cards/refund",
        {
            "bank_reference": transaction.bank_reference,
            "amount": float(refund.amount),
            "idempotency_key": refund.idempotency_key,
        },
    )
    if result["status"] == "declined":
        refund.transaction_state = TransactionState.Failed
        refund.decline_reason = result.get("decline_reason", "REFUND_DECLINED")
        session.add(refund)
        session.commit()
        return ApiResponse(message="Refund declined", data=_refund_response(refund))

    wallet = session.exec(
        select(Wallet).where(Wallet.user_id == merchant.user_id, Wallet.currency_id == transaction.currency_id)
    ).first()
    if wallet is None:
        raise NotFoundException("Merchant wallet not found")

    refund.transaction_state = TransactionState.Completed
    refund.bank_reference = result.get("bank_reference")
    refund.decline_reason = None
    transaction.refunded_amount += refund.amount
    transaction.transaction_state = (
        TransactionState.Refunded
        if transaction.refunded_amount == transaction.gross
        else TransactionState.Partial_Refunded
    )
    # Fees stay charged by design; the project contract deducts the full
    # customer refund from the gateway wallet, so a wallet may become negative.
    wallet.amount -= refund.amount
    session.add(refund)
    session.add(transaction)
    session.add(wallet)
    session.commit()
    return ApiResponse(message="Refund completed", data=_refund_response(refund))
