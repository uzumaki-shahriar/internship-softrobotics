"""JWT helpers for Module 3 (auth).

Only this module and app/core/dependencies.py should import from here.
Route handlers should use the FastAPI dependencies instead of calling
these functions directly.
"""

from datetime import datetime, timedelta, timezone

import jwt

from app.config import settings


def create_access_token(user_id: int, user_type: str) -> str:
    """Create a signed JWT token for a user.

    Args:
        user_id:   The user's primary key from the `users` table.
        user_type: Either ``"merchant"`` or ``"admin"``.

    Returns:
        A signed JWT string.
    """
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "type": user_type,
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Decode and validate a JWT token.

    Args:
        token: The raw JWT string (without the ``Bearer`` prefix).

    Returns:
        The decoded payload dict with ``sub`` and ``type`` keys.

    Raises:
        jwt.ExpiredSignatureError: If the token has expired.
        jwt.InvalidTokenError:    If the token is malformed or signature is wrong.
    """
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
