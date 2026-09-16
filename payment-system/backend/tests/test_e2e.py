import os
from datetime import date

os.environ.setdefault("JWT_SECRET", "testsecret")
os.environ.setdefault("GATEWAY_API_KEY", "testkey")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session

from app import database
from app.main import app as gateway_app
from app.models import User, Merchant, Currency, Bank, Pos, Wallet, Transaction


def setup_db():
    engine = database.engine
    SQLModel.metadata.create_all(engine)
    return engine


def seed_data(session: Session):
    user = User(name="M2", user_type="merchant", email="m2@example.com", password="x")
    session.add(user)
    session.commit()
    session.refresh(user)

    merchant = Merchant(user_id=user.id, store_id="store-2", api_key="key-2", name="M2", email="m2@example.com")
    session.add(merchant)
    session.commit()
    session.refresh(merchant)

    currency = Currency(name="Taka", symbol="BDT", code="BDT")
    session.add(currency)
    session.commit()
    session.refresh(currency)

    bank = Bank(name="TestBank", issuer_name="TB", user_name="u", user_password="p")
    session.add(bank)
    session.commit()
    session.refresh(bank)

    pos = Pos(name="POS1", bank_id=bank.id, currency_id=currency.id, commission_percentage=0, commission_fixed=0, bank_fee=0, settlement_day=0)
    session.add(pos)
    session.commit()
    session.refresh(pos)

    wallet = Wallet(user_id=user.id, currency_id=currency.id, amount=1000)
    session.add(wallet)
    session.commit()
    session.refresh(wallet)

    tx = Transaction(
        invoice_id="EINV-1",
        order_id="EORD-1",
        transaction_state="Completed",
        gross=200,
        fee=5,
        net=195,
        pos_id=pos.id,
        currency_id=currency.id,
        merchant_id=merchant.id,
        settlement_date=date.today(),
    )
    session.add(tx)
    session.commit()
    session.refresh(tx)


def test_e2e_settlement_flow():
    engine = setup_db()
    client = TestClient(gateway_app)

    # seed data
    with Session(engine) as session:
        seed_data(session)

    # trigger settlement run
    resp = client.post("/api/settlements/run")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 1

    # list settlements
    resp2 = client.get("/api/settlements")
    assert resp2.status_code == 200
    settles = resp2.json()
    assert len(settles) >= 1

    # merchant report
    merchant_id = settles[0]["merchant_id"]
    r = client.get(f"/api/reports/merchant/{merchant_id}")
    assert r.status_code == 200
    report = r.json()
    assert report["count"] >= 1
