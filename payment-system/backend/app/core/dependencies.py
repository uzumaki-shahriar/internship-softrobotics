"""FastAPI dependencies for Module 3 (auth).

Import and use these in route functions via ``Depends()``:

    from app.core.dependencies import get_current_merchant, get_current_admin, verify_merchant_api_key

Usage examples:

    # Protect a merchant-only route
    @router.get("/merchant/profile")
    async def profile(merchant: Merchant = Depends(get_current_merchant)):
        ...

    # Protect an admin-only route
    @router.get("/admin/dashboard")
    async def dashboard(admin: User = Depends(get_current_admin)):
        ...

    # Validate Ecommerce-facing checkout/init calls (body carries store_id + api_key)
    @router.post("/checkout/init")
    async def checkout_init(
        body: CheckoutInitRequest,
        merchant: Merchant = Depends(verify_merchant_api_key),
    ):
        ...
    # Note: verify_merchant_api_key reads store_id + api_key from the *request body*,
    # so CheckoutInitRequest must include those two fields.
"""

import jwt
from fastapi import Depends, Header, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session, select

from app.config import settings
from app.core.utils.exceptions import ForbiddenException, UnauthorizedException
from app.core.utils.jwt import decode_access_token
from app.database import get_session
from app.models import Merchant, User, UserType

_bearer = HTTPBearer(auto_error=False)


def _extract_user(
    credentials: HTTPAuthorizationCredentials | None,
    session: Session,
    required_type: UserType,
) -> User:
    """Shared logic: decode JWT, fetch user, enforce type."""
    if credentials is None:
        raise UnauthorizedException("Missing Authorization header")

    try:
        payload = decode_access_token(credentials.credentials)
    except jwt.ExpiredSignatureError:
        raise UnauthorizedException("Token has expired")
    except jwt.InvalidTokenError:
        raise UnauthorizedException("Invalid token")

    if payload.get("type") != required_type.value:
        raise ForbiddenException(f"This endpoint requires a {required_type.value} token")

    user_id = int(payload["sub"])
    user = session.get(User, user_id)
    if user is None or not user.status:
        raise UnauthorizedException("User not found or inactive")

    return user


def get_current_merchant(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    session: Session = Depends(get_session),
) -> User:
    """Validate a merchant JWT and return the authenticated User.

    Use as a FastAPI dependency on any merchant-only route.
    Raises UnauthorizedException (401) or ForbiddenException (403) on failure.
    """
    return _extract_user(credentials, session, UserType.merchant)


def get_current_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    session: Session = Depends(get_session),
) -> User:
    """Validate an admin JWT and return the authenticated User.

    Use as a FastAPI dependency on any admin-only route.
    Raises UnauthorizedException (401) or ForbiddenException (403) on failure.
    """
    return _extract_user(credentials, session, UserType.admin)


def verify_merchant_api_key(
    request: Request,
    session: Session = Depends(get_session),
) -> Merchant:
    """Validate a merchant's store_id + api_key from the request body.

    Reads ``store_id`` and ``api_key`` from the parsed request body (injected
    by FastAPI before this dependency runs).  Module 4's ``checkout/init``
    request body *must* include both fields.

    Returns the matching active Merchant on success.
    Raises UnauthorizedException (401) if the credentials are wrong or the
    merchant is inactive.

    Note: this dependency is designed to be used *alongside* a Pydantic body
    model in the route — FastAPI parses the body into the model first, then
    this dependency reads the already-parsed JSON body via request.state or
    the route function re-passes the values.  The simplest pattern for Module 4:

        @router.post("/api/checkout/init")
        async def checkout_init(
            body: CheckoutInitRequest,   # has .store_id and .api_key
            session: Session = Depends(get_session),
        ):
            merchant = _resolve_merchant_api_key(body.store_id, body.api_key, session)
            ...

    To avoid double-parsing the body (FastAPI reads it once), Module 4 should
    call the helper below directly rather than using this as a Depends().
    """
    # Intentionally left as a thin wrapper — see docstring above.
    raise NotImplementedError(
        "Use resolve_merchant_api_key(store_id, api_key, session) directly in your route."
    )


def resolve_merchant_api_key(store_id: str, api_key: str, session: Session) -> Merchant:
    """Validate store_id + api_key and return the matching active Merchant.

    This is the function Module 4 (checkout/init) should call directly,
    passing the values it already has from the parsed request body.

    Raises:
        UnauthorizedException: if the credentials don't match or the merchant
                               is inactive.
    """
    merchant = session.exec(
        select(Merchant).where(Merchant.store_id == store_id)
    ).first()

    if merchant is None or merchant.api_key != api_key or not merchant.status:
        raise UnauthorizedException("Invalid store_id or api_key")

    return merchant


def verify_gateway_api_key(x_api_key: str = Header(..., alias="X-API-KEY")) -> None:
    """Validate the static gateway API key sent by internal/admin callers.

    Use as a FastAPI dependency on any route that should only be reachable
    by trusted internal callers (e.g. admin panel, Bank System callbacks):

        @router.get("/admin/dashboard")
        async def dashboard(_: None = Depends(verify_gateway_api_key)):
            ...

    Raises ForbiddenException (403) if the key is wrong or missing.
    """
    if x_api_key != settings.GATEWAY_API_KEY:
        raise ForbiddenException("Invalid or missing X-API-KEY")
