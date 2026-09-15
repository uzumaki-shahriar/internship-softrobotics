from fastapi import APIRouter

from app.routers import health

# Each module adds its own router here as it's built, e.g.:
#   from app.routers import auth, merchant, checkout, wallet, refund, admin
#   api_router.include_router(auth.router)
api_router = APIRouter()
api_router.include_router(health.router)
