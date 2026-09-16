"""Small synchronous client for the Bank System's card APIs."""

from typing import Any

import httpx

from app.config import settings
from app.core.utils.exceptions import AppException


def post_to_bank(path: str, payload: dict[str, Any]) -> dict[str, Any]:
    try:
        response = httpx.post(
            f"{settings.BANK_API_URL.rstrip('/')}{path}",
            json=payload,
            headers={"X-API-KEY": settings.BANK_API_KEY},
            timeout=10.0,
        )
        response.raise_for_status()
        body = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise AppException(502, "Bank System is unavailable", "BANK_UNAVAILABLE") from exc

    if not isinstance(body, dict) or body.get("status") not in {"approved", "declined"}:
        raise AppException(502, "Bank System returned an invalid response", "BANK_INVALID_RESPONSE")
    return body
