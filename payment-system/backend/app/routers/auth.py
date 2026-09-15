"""Module 3 — Auth router.

Endpoints:
    POST /api/merchant/register  → create merchant account, return store_id + api_key
    POST /api/merchant/login     → verify credentials, return JWT
    POST /api/admin/login        → verify admin credentials, return JWT
    GET  /api/merchant/profile   → return authenticated merchant's info
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from loguru import logger
from pydantic import BaseModel, EmailStr
from sqlmodel import Session, select

from app.core.dependencies import get_current_merchant
from app.core.utils.exceptions import ConflictException, UnauthorizedException
from app.core.utils.jwt import create_access_token
from app.core.utils.response import ApiResponse
from app.core.security import hash_password, verify_password
from app.database import get_session
from app.models import Merchant, User, UserType, Wallet, Currency

router = APIRouter()


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class MerchantRegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    address: Optional[str] = None


class MerchantLoginRequest(BaseModel):
    email: EmailStr
    password: str


class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MerchantRegisterResponse(BaseModel):
    store_id: str
    api_key: str
    access_token: str
    token_type: str = "bearer"


class MerchantProfileResponse(BaseModel):
    id: int
    store_id: str
    api_key: str
    name: str
    email: str
    address: Optional[str]
    status: bool


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _generate_store_id() -> str:
    """e.g. STORE-A1B2C3D4"""
    return f"STORE-{uuid.uuid4().hex[:8].upper()}"


def _generate_api_key() -> str:
    """e.g. mk_live_a1b2c3d4e5f6..."""
    return f"mk_live_{uuid.uuid4().hex}"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/merchant/register", response_model=ApiResponse[MerchantRegisterResponse])
async def register_merchant(
    body: MerchantRegisterRequest,
    session: Session = Depends(get_session),
) -> ApiResponse[MerchantRegisterResponse]:
    """Register a new merchant.

    Creates a User (type=merchant), a Merchant record with auto-generated
    store_id and api_key, and a BDT Wallet with zero balance.

    Returns the store_id, api_key, and a JWT so the merchant can immediately
    make authenticated requests without a separate login step.
    """
    # Check email uniqueness across users table
    existing = session.exec(select(User).where(User.email == body.email)).first()
    if existing:
        raise ConflictException(f"Email '{body.email}' is already registered")

    # Create user
    user = User(
        name=body.name,
        email=body.email,
        password=hash_password(body.password),
        user_type=UserType.merchant,
    )
    session.add(user)
    session.flush()  # get user.id without committing

    # Create merchant with unique store_id and api_key
    store_id = _generate_store_id()
    api_key = _generate_api_key()

    merchant = Merchant(
        user_id=user.id,
        store_id=store_id,
        api_key=api_key,
        name=body.name,
        email=body.email,
        address=body.address,
    )
    session.add(merchant)
    session.flush()  # get merchant.id

    # Auto-create a BDT wallet with zero balance
    bdt = session.exec(select(Currency).where(Currency.code == "BDT")).first()
    if bdt:
        wallet = Wallet(user_id=user.id, currency_id=bdt.id)
        session.add(wallet)

    session.commit()
    logger.info("New merchant registered: store_id={} email={}", store_id, body.email)

    token = create_access_token(user_id=user.id, user_type=UserType.merchant.value)
    return ApiResponse(
        message="Merchant registered successfully",
        data=MerchantRegisterResponse(
            store_id=store_id,
            api_key=api_key,
            access_token=token,
        ),
    )


@router.post("/merchant/login", response_model=ApiResponse[TokenResponse])
async def merchant_login(
    body: MerchantLoginRequest,
    session: Session = Depends(get_session),
) -> ApiResponse[TokenResponse]:
    """Authenticate a merchant and return a JWT.

    Returns 401 for any credential failure — deliberately no distinction
    between \"email not found\" and \"wrong password\" to avoid user enumeration.
    """
    user = session.exec(
        select(User).where(User.email == body.email, User.user_type == UserType.merchant)
    ).first()

    if user is None or not verify_password(body.password, user.password) or not user.status:
        raise UnauthorizedException("Invalid email or password")

    token = create_access_token(user_id=user.id, user_type=UserType.merchant.value)
    logger.info("Merchant login: email={}", body.email)
    return ApiResponse(
        message="Login successful",
        data=TokenResponse(access_token=token),
    )


@router.post("/admin/login", response_model=ApiResponse[TokenResponse])
async def admin_login(
    body: AdminLoginRequest,
    session: Session = Depends(get_session),
) -> ApiResponse[TokenResponse]:
    """Authenticate an admin and return a JWT.

    Only users with user_type=admin can obtain an admin token.
    Returns 401 for any credential failure.
    """
    user = session.exec(
        select(User).where(User.email == body.email, User.user_type == UserType.admin)
    ).first()

    if user is None or not verify_password(body.password, user.password) or not user.status:
        raise UnauthorizedException("Invalid email or password")

    token = create_access_token(user_id=user.id, user_type=UserType.admin.value)
    logger.info("Admin login: email={}", body.email)
    return ApiResponse(
        message="Login successful",
        data=TokenResponse(access_token=token),
    )


@router.get("/merchant/profile", response_model=ApiResponse[MerchantProfileResponse])
async def merchant_profile(
    current_user: User = Depends(get_current_merchant),
    session: Session = Depends(get_session),
) -> ApiResponse[MerchantProfileResponse]:
    """Return the authenticated merchant's profile.

    Requires a valid merchant JWT in the Authorization: Bearer <token> header.
    """
    merchant = session.exec(
        select(Merchant).where(Merchant.user_id == current_user.id)
    ).first()

    if merchant is None:
        raise UnauthorizedException("Merchant profile not found")

    return ApiResponse(
        data=MerchantProfileResponse(
            id=merchant.id,
            store_id=merchant.store_id,
            api_key=merchant.api_key,
            name=merchant.name,
            email=merchant.email,
            address=merchant.address,
            status=merchant.status,
        )
    )
