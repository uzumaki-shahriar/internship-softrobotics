from fastapi import APIRouter

from app.routers import auth, checkout, health, refund, wallet
from app.routers import reports
from app.routers import settlements

# Register each module's router here as it's built.
# Module 3 (auth): merchant register/login, admin login, merchant profile
api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router, prefix="/api", tags=["auth"])
api_router.include_router(checkout.router, prefix="/api", tags=["checkout"])
api_router.include_router(wallet.router, prefix="/api", tags=["wallet"])
api_router.include_router(refund.router, prefix="/api", tags=["refund"])
api_router.include_router(settlements.router)
api_router.include_router(reports.router)
