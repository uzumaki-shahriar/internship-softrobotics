from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/health/error")
async def health_error():
    """Deliberately raises so we can confirm the global exception handler
    and logs/error.log capture unhandled errors with file/line info."""
    raise RuntimeError("Test error from /health/error")
