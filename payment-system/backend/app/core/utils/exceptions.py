"""App-wide exception types and the handlers that turn them into responses.

Every handler here logs exactly once (through loguru, the project's single
logging pipeline - see app/core/logging.py) and returns the same error shape:

    {"success": false, "error": {"code": ..., "message": ...}, "status_code": ...}
"""

from typing import cast

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from loguru import logger
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.utils.error_utils import format_app_traceback, get_root_error


def _log_for_status(status_code: int):
    """5xx -> error, 4xx -> warning, everything else -> info."""
    if status_code >= 500:
        return logger.error
    if status_code >= 400:
        return logger.warning
    return logger.info


class AppException(Exception):
    def __init__(self, status_code: int, detail: str, code: str = "ERROR"):
        self.status_code = status_code
        self.detail = detail
        self.code = code
        super().__init__(detail)


class NotFoundException(AppException):
    def __init__(self, detail: str = "Resource not found"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail, code="NOT_FOUND")


class UnauthorizedException(AppException):
    def __init__(self, detail: str = "Unauthorized"):
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail, code="UNAUTHORIZED")


class ForbiddenException(AppException):
    def __init__(self, detail: str = "Forbidden"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail, code="FORBIDDEN")


class ConflictException(AppException):
    def __init__(self, detail: str = "Conflict"):
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail, code="CONFLICT")


class BadRequestException(AppException):
    def __init__(self, detail: str = "Bad request"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail, code="BAD_REQUEST")


def _error_body(status_code: int, detail: str, code: str = "ERROR") -> dict:
    return {
        "success": False,
        "error": {"code": code, "message": detail},
        "status_code": status_code,
    }


async def app_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    app_exception = cast(AppException, exc)
    _log_for_status(app_exception.status_code)(
        "{} {} -> {} [{}] {}",
        request.method,
        request.url.path,
        app_exception.status_code,
        app_exception.code,
        app_exception.detail,
    )
    return JSONResponse(
        status_code=app_exception.status_code,
        content=_error_body(app_exception.status_code, app_exception.detail, app_exception.code),
    )


async def http_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    http_exception = cast(StarletteHTTPException, exc)
    _log_for_status(http_exception.status_code)(
        "{} {} -> {} {}",
        request.method,
        request.url.path,
        http_exception.status_code,
        http_exception.detail,
    )
    return JSONResponse(
        status_code=http_exception.status_code,
        content=_error_body(http_exception.status_code, str(http_exception.detail)),
    )


async def validation_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    validation_exception = cast(RequestValidationError, exc)
    errors = [
        {"field": ".".join(str(loc) for loc in err["loc"]), "message": err["msg"]}
        for err in validation_exception.errors()
    ]
    logger.warning(
        "{} {} -> 422 validation failed: {}", request.method, request.url.path, errors
    )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Validation failed",
                "details": errors,
            },
            "status_code": status.HTTP_422_UNPROCESSABLE_ENTITY,
        },
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(
        "{} {} -> 500 {}\n{}",
        request.method,
        request.url.path,
        get_root_error(exc),
        format_app_traceback(exc),
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=_error_body(500, "An unexpected error occurred.", "INTERNAL_ERROR"),
    )
