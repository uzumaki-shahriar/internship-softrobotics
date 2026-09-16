from collections import defaultdict
from datetime import datetime, date
from decimal import Decimal
from typing import List

from sqlmodel import Session, select

from app.models import Transaction, Settlement, SettlementItem, Wallet, Merchant


def run_settlement(session: Session, scheduled_at: datetime = None) -> List[Settlement]:
    """Run a single settlement pass. Returns created Settlement objects."""
    if scheduled_at is None:
        scheduled_at = datetime.utcnow()

    today = date.fromtimestamp(scheduled_at.timestamp())

    # find transactions that are Completed, settlement_date <= today, and not yet in any settlement_items
    subq = select(SettlementItem.transaction_id)
    stmt = select(Transaction).where(
        Transaction.transaction_state == Transaction.__fields__["transaction_state"].type_.__class__("Completed"),
        Transaction.settlement_date != None,
        Transaction.settlement_date <= today,
        ~Transaction.id.in_(subq)
    )
    transactions = session.exec(stmt).all()

    # group by merchant_id and currency_id
    groups = defaultdict(list)
    for tx in transactions:
        groups[(tx.merchant_id, tx.currency_id)].append(tx)

    created = []
    for (merchant_id, currency_id), txs in groups.items():
        gross_total = Decimal("0.00")
        fee_total = Decimal("0.00")
        net_total = Decimal("0.00")

        for t in txs:
            gross_total += t.gross
            fee_total += t.fee
            net_total += t.net

        settlement = Settlement(
            merchant_id=merchant_id,
            currency_id=currency_id,
            gross_total=gross_total,
            fee_total=fee_total,
            net_total=net_total,
            status="pending",
            scheduled_at=scheduled_at,
        )
        session.add(settlement)
        session.flush()

        # create items
        for t in txs:
            item = SettlementItem(
                settlement_id=settlement.id,
                transaction_id=t.id,
                gross=t.gross,
                fee=t.fee,
                net=t.net,
            )
            session.add(item)

        # attempt to debit merchant wallet by net_total
        # Merchant.user_id maps to wallets.user_id
        merchant = session.get(Merchant, merchant_id)
        wallet = session.exec(select(Wallet).where(Wallet.user_id == merchant.user_id, Wallet.currency_id == currency_id)).first()
        if wallet is None:
            settlement.status = "failed"
        else:
            if wallet.amount >= net_total:
                wallet.amount = wallet.amount - net_total
                settlement.status = "settled"
                settlement.settled_at = datetime.utcnow()
            else:
                settlement.status = "failed"

        session.add(settlement)
        session.commit()
        session.refresh(settlement)
        created.append(settlement)

    return created
