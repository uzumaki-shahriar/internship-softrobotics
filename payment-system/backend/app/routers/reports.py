from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.database import get_session
from app.models import Transaction

router = APIRouter()


@router.get("/api/reports/merchant/{merchant_id}")
def merchant_report(
    merchant_id: int,
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD, defaults to today UTC"),
    session: Session = Depends(get_session),
):
    """Return a reconciliation report for a merchant for the given date.

    The report includes totals (gross/fee/net) and a short transaction list.
    """
    if date:
        try:
            d = datetime.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")
    else:
        d = datetime.utcnow().date()

    start = datetime(d.year, d.month, d.day)
    end = start + timedelta(days=1)

    stmt = select(Transaction).where(
        Transaction.merchant_id == merchant_id,
        Transaction.created_at >= start,
        Transaction.created_at < end,
    )
    txs = session.exec(stmt).all()

    gross_total = 0
    fee_total = 0
    net_total = 0
    count = 0
    failed = []

    for t in txs:
        gross_total += float(t.gross)
        fee_total += float(t.fee)
        net_total += float(t.net)
        count += 1
        if getattr(t, "transaction_state", None) and str(t.transaction_state).lower() in ("failed", "failed"):
            failed.append({
                "invoice_id": t.invoice_id,
                "order_id": t.order_id,
                "gross": float(t.gross),
            })

    return {
        "date": d.isoformat(),
        "merchant_id": merchant_id,
        "count": count,
        "gross_total": gross_total,
        "fee_total": fee_total,
        "net_total": net_total,
        "failed_transactions": failed,
        "transactions": [
            {
                "invoice_id": t.invoice_id,
                "order_id": t.order_id,
                "state": str(t.transaction_state),
                "gross": float(t.gross),
                "fee": float(t.fee),
                "net": float(t.net),
                "created_at": t.created_at.isoformat(),
            }
            for t in txs
        ],
    }
