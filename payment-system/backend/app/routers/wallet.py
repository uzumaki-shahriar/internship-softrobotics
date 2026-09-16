"""Module 5 merchant wallet and transaction-history endpoints."""

from decimal import Decimal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func
from sqlmodel import Session, select

from app.core.dependencies import get_current_merchant
from app.core.utils.dependencies import get_pagination
from app.core.utils.exceptions import NotFoundException
from app.core.utils.pagination import PaginatedResponse, PaginationParams
from app.core.utils.response import ApiResponse
from app.database import get_session
from app.models import Currency, Merchant, Transaction, User, Wallet
from app.routers.checkout import TransactionResponse, _transaction_response

router = APIRouter()


class WalletResponse(BaseModel):
    currency: str
    amount: Decimal


def _merchant_for_user(user: User, session: Session) -> Merchant:
    merchant = session.exec(select(Merchant).where(Merchant.user_id == user.id)).first()
    if merchant is None:
        raise NotFoundException("Merchant profile not found")
    return merchant


@router.get("/merchant/wallet", response_model=ApiResponse[list[WalletResponse]])
def get_wallet(
    current_user: User = Depends(get_current_merchant),
    session: Session = Depends(get_session),
) -> ApiResponse[list[WalletResponse]]:
    wallets = session.exec(select(Wallet).where(Wallet.user_id == current_user.id)).all()
    return ApiResponse(
        data=[
            WalletResponse(currency=currency.code, amount=wallet.amount)
            for wallet in wallets
            if (currency := session.get(Currency, wallet.currency_id)) is not None
        ]
    )


@router.get("/merchant/transactions", response_model=PaginatedResponse[TransactionResponse])
def list_merchant_transactions(
    pagination: PaginationParams = Depends(get_pagination),
    current_user: User = Depends(get_current_merchant),
    session: Session = Depends(get_session),
) -> PaginatedResponse[TransactionResponse]:
    merchant = _merchant_for_user(current_user, session)
    statement = select(Transaction).where(Transaction.merchant_id == merchant.id)
    total = session.exec(select(func.count()).select_from(statement.subquery())).one()
    transactions = session.exec(
        statement.order_by(Transaction.created_at.desc()).offset(pagination.offset).limit(pagination.limit)
    ).all()
    return PaginatedResponse.create(
        items=[_transaction_response(transaction) for transaction in transactions],
        total=total,
        params=pagination,
    )
