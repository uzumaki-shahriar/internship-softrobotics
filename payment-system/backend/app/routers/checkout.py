"""Module 4 checkout APIs required to create bank-backed transactions."""

import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.config import settings
from app.core.bank_client import post_to_bank
from app.core.dependencies import resolve_merchant_api_key
from app.core.utils.exceptions import AppException, BadRequestException, ConflictException, NotFoundException
from app.core.utils.fee import calculate_fee
from app.core.utils.response import ApiResponse
from app.database import get_session
from app.models import Currency, Merchant, Pos, Transaction, TransactionState, Wallet

router = APIRouter()


class CheckoutInitRequest(BaseModel):
    store_id: str
    api_key: str
    order_id: str
    amount: Decimal = Field(gt=0, max_digits=15, decimal_places=2)
    currency: str = Field(default="BDT", min_length=3, max_length=5)
    invoice_id: str | None = None


class CardPaymentRequest(BaseModel):
    card_number: str = Field(pattern=r"^\d{13,19}$")
    card_holder_name: str = Field(min_length=1)
    expiry_month: int = Field(ge=1, le=12)
    expiry_year: int = Field(ge=2000, le=2100)
    cvv: str = Field(pattern=r"^\d{3,4}$")


class CheckoutInitResponse(BaseModel):
    invoice_id: str
    checkout_url: str


class TransactionResponse(BaseModel):
    invoice_id: str
    state: str
    gross: Decimal
    fee: Decimal
    net: Decimal
    refunded_amount: Decimal
    bank_reference: str | None
    decline_reason: str | None


def _transaction_response(transaction: Transaction) -> TransactionResponse:
    return TransactionResponse(
        invoice_id=transaction.invoice_id,
        state=transaction.transaction_state.value,
        gross=transaction.gross,
        fee=transaction.fee,
        net=transaction.net,
        refunded_amount=transaction.refunded_amount,
        bank_reference=transaction.bank_reference,
        decline_reason=transaction.decline_reason,
    )


@router.post("/checkout/init", response_model=ApiResponse[CheckoutInitResponse])
def init_checkout(
    body: CheckoutInitRequest,
    session: Session = Depends(get_session),
) -> ApiResponse[CheckoutInitResponse]:
    merchant = resolve_merchant_api_key(body.store_id, body.api_key, session)
    currency = session.exec(select(Currency).where(Currency.code == body.currency.upper())).first()
    if currency is None:
        raise BadRequestException("Unsupported currency")

    invoice_id = body.invoice_id or f"INV-{uuid.uuid4().hex.upper()}"
    if session.exec(select(Transaction).where(Transaction.invoice_id == invoice_id)).first():
        raise ConflictException("invoice_id already exists")

    # The Bank API does not currently return an issuer identifier.  Select the
    # active currency-default POS at initiation; it remains the fee record for
    # this transaction.
    pos = session.exec(
        select(Pos).where(Pos.currency_id == currency.id, Pos.status.is_(True)).order_by(Pos.id)
    ).first()
    if pos is None:
        raise BadRequestException("No active POS configuration for this currency")

    wallet = session.exec(
        select(Wallet).where(Wallet.user_id == merchant.user_id, Wallet.currency_id == currency.id)
    ).first()
    if wallet is None:
        raise BadRequestException("Merchant wallet is not configured for this currency")

    transaction = Transaction(
        invoice_id=invoice_id,
        order_id=body.order_id,
        gross=body.amount,
        pos_id=pos.id,
        currency_id=currency.id,
        merchant_id=merchant.id,
    )
    session.add(transaction)
    session.commit()
    return ApiResponse(
        message="Checkout initialized",
        data=CheckoutInitResponse(
            invoice_id=invoice_id,
            checkout_url=f"{settings.GATEWAY_BASE_URL.rstrip('/')}/checkout/{invoice_id}",
        ),
    )


@router.post("/checkout/{invoice_id}/pay", response_model=ApiResponse[TransactionResponse])
def pay_checkout(
    invoice_id: str,
    body: CardPaymentRequest,
    session: Session = Depends(get_session),
) -> ApiResponse[TransactionResponse]:
    transaction = session.exec(select(Transaction).where(Transaction.invoice_id == invoice_id)).first()
    if transaction is None:
        raise NotFoundException("Transaction not found")
    if transaction.transaction_state != TransactionState.Pending:
        return ApiResponse(message="Transaction already processed", data=_transaction_response(transaction))

    currency = session.get(Currency, transaction.currency_id)
    if currency is None:
        raise NotFoundException("Transaction currency not found")

    result = post_to_bank(
        "/api/cards/charge",
        {
            **body.model_dump(),
            "amount": float(transaction.gross),
            "currency": currency.code,
            "idempotency_key": transaction.invoice_id,
            "reference": transaction.invoice_id,
        },
    )

    if result["status"] == "declined":
        transaction.transaction_state = TransactionState.Failed
        transaction.decline_reason = result.get("decline_reason", "PAYMENT_DECLINED")
        session.add(transaction)
        session.commit()
        return ApiResponse(message="Payment declined", data=_transaction_response(transaction))

    pos = session.get(Pos, transaction.pos_id)
    merchant = session.get(Merchant, transaction.merchant_id)
    merchant_wallet = session.exec(
        select(Wallet).where(Wallet.user_id == merchant.user_id, Wallet.currency_id == transaction.currency_id)
    ).first() if merchant else None
    if pos is None or merchant_wallet is None:
        raise AppException(500, "Transaction settlement configuration is missing", "SETTLEMENT_CONFIGURATION_ERROR")

    transaction.fee, transaction.net = calculate_fee(transaction.gross, pos)
    transaction.bank_reference = result["bank_reference"]
    transaction.decline_reason = None
    transaction.transaction_state = TransactionState.Completed
    merchant_wallet.amount += transaction.net
    session.add(transaction)
    session.add(merchant_wallet)
    session.commit()
    return ApiResponse(message="Payment completed", data=_transaction_response(transaction))


@router.get("/transactions/{invoice_id}/verify", response_model=ApiResponse[TransactionResponse])
def verify_transaction(invoice_id: str, session: Session = Depends(get_session)) -> ApiResponse[TransactionResponse]:
    transaction = session.exec(select(Transaction).where(Transaction.invoice_id == invoice_id)).first()
    if transaction is None:
        raise NotFoundException("Transaction not found")
    return ApiResponse(data=_transaction_response(transaction))
