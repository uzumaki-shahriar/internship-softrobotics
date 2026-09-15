import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from loguru import logger
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.core.logging import configure_logging
from app.routers import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    logger.info("Starting {} (debug={})", settings.APP_NAME, settings.DEBUG)
    yield
    logger.info("Shutting down {}", settings.APP_NAME)


app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)
app.include_router(api_router)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Tags every request with a short id and logs method/path/status/duration."""
    request_id = str(uuid.uuid4())[:8]
    start = time.perf_counter()
    with logger.contextualize(request_id=request_id):
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000
        logger.info(
            "{} {} -> {} ({:.1f}ms)",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
        response.headers["X-Request-ID"] = request_id
        return response


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    logger.warning(
        "HTTP {} on {} {}: {}", exc.status_code, request.method, request.url.path, exc.detail
    )
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(
        "Validation error on {} {}: {}", request.method, request.url.path, exc.errors()
    )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # logger.exception attaches the full traceback (file/line for every
    # frame) to the log record - this is what shows up in logs/error.log.
    logger.exception("Unhandled exception on {} {}", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}
