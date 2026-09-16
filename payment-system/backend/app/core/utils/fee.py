from decimal import Decimal

from app.models import Pos


def calculate_fee(gross: Decimal, pos: Pos) -> tuple[Decimal, Decimal]:
    """Return the gateway fee and merchant net amount for a successful charge."""
    commission = gross * pos.commission_percentage / Decimal("100")
    fee = commission + pos.commission_fixed
    return fee, gross - fee
