from fastapi import APIRouter

from app.routers import auth, health

# Register each module's router here as it's built.
# Module 3 (auth): merchant register/login, admin login, merchant profile
# Future modules add their routers below, e.g.:
#   from app.routers import checkout, wallet, refund, admin
#   api_router.include_router(checkout.router, prefix="/api", tags=["checkout"])
api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router, prefix="/api", tags=["auth"])
