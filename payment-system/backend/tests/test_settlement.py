from datetime import date, datetime

from sqlmodel import create_engine, SQLModel, Session

from app.models import User, Merchant, Currency, Bank, Pos, Wallet, Transaction
from app.core.settlement import run_settlement


def test_run_settlement_debits_wallet():
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        # create user and merchant
        user = User(name="Merchant One", user_type="merchant", email="m@example.com", password="x")
        session.add(user)
        session.commit()
        session.refresh(user)

        merchant = Merchant(user_id=user.id, store_id="store-1", api_key="key-1", name="M1", email="m1@example.com")
        session.add(merchant)
        session.commit()
        session.refresh(merchant)

        # currency and bank/pos
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

        # wallet with sufficient funds
        wallet = Wallet(user_id=user.id, currency_id=currency.id, amount=1000)
        session.add(wallet)
        session.commit()
        session.refresh(wallet)

        # completed transaction ready for settlement
        tx = Transaction(
            invoice_id="INV-1",
            order_id="ORD-1",
            transaction_state="Completed",
            gross=100,
            fee=2,
            net=98,
            pos_id=pos.id,
            currency_id=currency.id,
            merchant_id=merchant.id,
            settlement_date=date.today(),
        )
        session.add(tx)
        session.commit()
        session.refresh(tx)

        # run settlement
        created = run_settlement(session)
        assert len(created) == 1

        # wallet should be debited by net
        w = session.get(Wallet, wallet.id)
        assert float(w.amount) == 902.0
