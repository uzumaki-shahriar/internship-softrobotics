from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.core.settlement import run_settlement
from app.models import Settlement, SettlementItem

router = APIRouter()


@router.post("/api/settlements/run", response_model=List[Settlement])
def settlements_run(session: Session = Depends(get_session)):
    """Trigger a single settlement run (for admin/testing)."""
    created = run_settlement(session)
    return created


@router.get("/api/settlements", response_model=List[Settlement])
def list_settlements(session: Session = Depends(get_session)):
    stmt = select(Settlement).order_by(Settlement.created_at.desc())
    results = session.exec(stmt).all()
    return results


@router.get("/api/settlements/{settlement_id}")
def get_settlement(settlement_id: int, session: Session = Depends(get_session)):
    settlement = session.get(Settlement, settlement_id)
    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement not found")
    items = session.exec(select(SettlementItem).where(SettlementItem.settlement_id == settlement_id)).all()
    return {"settlement": settlement, "items": items}
