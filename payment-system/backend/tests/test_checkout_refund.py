from decimal import Decimal

from sqlmodel import SQLModel, Session, create_engine

from app.models import Bank, Currency, Merchant, Pos, User, UserType, Wallet
from app.routers import checkout, refund, wallet
from app.routers.checkout import CardPaymentRequest, CheckoutInitRequest
from app.routers.refund import RefundRequest


def _session_with_merchant() -> tuple[Session, User]:
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    session = Session(engine)

    user = User(name="Merchant", user_type=UserType.merchant, email="merchant@test.local", password="x")
    session.add(user)
    session.commit()
    session.refresh(user)
    merchant = Merchant(
        user_id=user.id,
        store_id="STORE-TEST",
        api_key="key-test",
        name="Merchant",
        email=user.email,
    )
    currency = Currency(name="Taka", symbol="৳", code="BDT")
    bank = Bank(name="Test Bank", issuer_name="TB", user_name="user", user_password="pass")
    session.add(merchant)
    session.add(currency)
    session.add(bank)
    session.commit()
    session.refresh(currency)
    session.refresh(bank)
    session.add(
        Pos(
            name="BDT POS",
            bank_id=bank.id,
            currency_id=currency.id,
            commission_percentage=Decimal("2.00"),
            commission_fixed=Decimal("5.00"),
            bank_fee=Decimal("0.00"),
            settlement_day=3,
        )
    )
    session.add(Wallet(user_id=user.id, currency_id=currency.id, amount=Decimal("0.00")))
    session.commit()
    return session, user


def test_checkout_payment_and_partial_refund(monkeypatch):
    session, user = _session_with_merchant()

    def bank_approved(path, payload):
        assert payload["idempotency_key"]
        if path.endswith("charge"):
            return {"status": "approved", "bank_reference": "BANK-CHARGE-1"}
        return {"status": "approved", "bank_reference": "BANK-REFUND-1"}

    monkeypatch.setattr(checkout, "post_to_bank", bank_approved)
    monkeypatch.setattr(refund, "post_to_bank", bank_approved)

    initialized = checkout.init_checkout(
        CheckoutInitRequest(
            store_id="STORE-TEST",
            api_key="key-test",
            order_id="ORDER-1",
            invoice_id="INV-1",
            amount=Decimal("100.00"),
        ),
        session,
    )
    assert initialized.data.invoice_id == "INV-1"

    paid = checkout.pay_checkout(
        "INV-1",
        CardPaymentRequest(
            card_number="4242424242424242",
            card_holder_name="Test Customer",
            expiry_month=12,
            expiry_year=2030,
            cvv="123",
        ),
        session,
    )
    assert paid.data.state == "Completed"
    assert paid.data.fee == Decimal("7.00")
    assert paid.data.net == Decimal("93.00")
    assert paid.data.bank_reference == "BANK-CHARGE-1"

    completed_refund = refund.create_refund(
        RefundRequest(invoice_id="INV-1", amount=Decimal("20.00"), idempotency_key="INV-1:refund:1"),
        user,
        session,
    )
    assert completed_refund.data.state == "Completed"

    balance = wallet.get_wallet(user, session)
    assert balance.data[0].amount == Decimal("73.00")

    verified = checkout.verify_transaction("INV-1", session)
    assert verified.data.state == "Partial Refunded"
    assert verified.data.refunded_amount == Decimal("20.00")

    duplicate = refund.create_refund(
        RefundRequest(invoice_id="INV-1", amount=Decimal("20.00"), idempotency_key="INV-1:refund:1"),
        user,
        session,
    )
    assert duplicate.message == "Refund already processed"
    assert wallet.get_wallet(user, session).data[0].amount == Decimal("73.00")
