"""Seed reference data for local development (TEAM_PLAN.md, Module 2),
mirroring the rows in db.sql where a legacy value already exists.

Run with:  python -m app.seed
Safe to re-run - it only inserts rows that don't already exist (matched by
their natural unique key: currency code, bank code, user/merchant email).
"""

from decimal import Decimal

from loguru import logger
from sqlmodel import Session, select

from app.core.logging import configure_logging
from app.core.security import hash_password
from app.database import engine
from app.models import Bank, Currency, Merchant, Pos, User, UserType, Wallet


def _get_or_create(session: Session, model, defaults: dict, **lookup):
    instance = session.exec(select(model).filter_by(**lookup)).first()
    if instance:
        return instance, False
    instance = model(**lookup, **defaults)
    session.add(instance)
    session.commit()
    session.refresh(instance)
    return instance, True


def seed() -> None:
    with Session(engine) as session:
        bdt, _ = _get_or_create(session, Currency, {"name": "Taka", "symbol": "৳"}, code="BDT")
        logger.info("Currency BDT ready (id={})", bdt.id)

        _get_or_create(session, Currency, {"name": "US Dollar", "symbol": "$"}, code="USD")
        logger.info("Currency USD ready")

        national_bank, _ = _get_or_create(
            session,
            Bank,
            {
                "issuer_name": "NB",
                "api_url": "https://api.nbank.com",
                "user_name": "nb_user",
                "user_password": "nb_pass",
                "branch": "Dhaka Branch",
            },
            name="National Bank",
            code="NB001",
        )
        logger.info("Bank National Bank ready (id={})", national_bank.id)

        _get_or_create(
            session,
            Bank,
            {
                "issuer_name": "CB",
                "api_url": "https://api.citybank.com",
                "user_name": "cb_user",
                "user_password": "cb_pass",
                "branch": "Chittagong Branch",
            },
            name="City Bank",
            code="CB002",
        )
        logger.info("Bank City Bank ready")

        _get_or_create(
            session,
            Bank,
            {
                "issuer_name": "DBBL",
                "api_url": "https://api.dbbl.com",
                "user_name": "dbbl_user",
                "user_password": "dbbl_pass",
                "branch": "Sylhet Branch",
            },
            name="Dutch-Bangla Bank",
            code="DB003",
        )
        logger.info("Bank Dutch-Bangla Bank ready")

        _get_or_create(
            session,
            User,
            {"name": "Admin", "user_type": UserType.admin, "password": hash_password("admin123")},
            email="admin@gateway.com",
        )
        logger.info("Admin user ready (admin@gateway.com / admin123)")

        merchant_user, _ = _get_or_create(
            session,
            User,
            {
                "name": "MerchantUser1",
                "user_type": UserType.merchant,
                "password": hash_password("merchant123"),
            },
            email="merchant1@example.com",
        )
        logger.info("Merchant user ready (merchant1@example.com / merchant123)")

        merchant, _ = _get_or_create(
            session,
            Merchant,
            {
                "user_id": merchant_user.id,
                "name": "Merchant One",
                "address": "123 Main Street, Dhaka",
                "api_key": "mk_live_test1234567890abcdef",
            },
            store_id="STORE1001",
            email="merchant1@example.com",
        )
        logger.info("Merchant STORE1001 ready (id={})", merchant.id)

        _get_or_create(
            session,
            Wallet,
            {"amount": Decimal("0.00")},
            user_id=merchant_user.id,
            currency_id=bdt.id,
        )
        logger.info("Wallet for merchant user ready")

        _get_or_create(
            session,
            Pos,
            {
                "commission_percentage": Decimal("2.00"),
                "commission_fixed": Decimal("5.00"),
                "bank_fee": Decimal("0.00"),
                "settlement_day": 3,
            },
            name="National Bank BDT POS",
            bank_id=national_bank.id,
            currency_id=bdt.id,
        )
        logger.info("POS config ready (National Bank / BDT, 2% + 5 fixed fee)")

    logger.info("Seeding complete.")


if __name__ == "__main__":
    configure_logging()
    seed()
