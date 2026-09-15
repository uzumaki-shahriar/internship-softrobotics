"""Central logging setup.

All logging in this project goes through loguru. Stdlib logging (uvicorn,
sqlalchemy, ...) is intercepted and routed through the same sinks so every
log line — ours or a library's — has the same concise, file:line-accurate
format and ends up in the same files.
"""

import logging
import sys
from pathlib import Path

from loguru import logger

from app.config import settings

LOG_DIR = Path(__file__).resolve().parent.parent.parent / "logs"
LOG_DIR.mkdir(exist_ok=True)

CONSOLE_FORMAT = (
    "<level>{level: <8}</level> | <green>{time:HH:mm:ss}</green> | "
    "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>"
)

FILE_FORMAT = (
    "{level: <8} | {time:YYYY-MM-DD HH:mm} | {name}:{function}:{line} - {message}"
)


# Starlette's ServerErrorMiddleware always re-raises an exception after an
# app.exception_handler already turned it into a response, purely so the
# ASGI server can log it too (its own comment: "allows servers to log the
# error"). uvicorn logs that as this exact message. Since our own handlers
# in app/core/utils/exceptions.py already log every error with file/line,
# forwarding this one too would just duplicate it - so it's dropped here.
_REDUNDANT_MESSAGES = {"Exception in ASGI application"}


class InterceptHandler(logging.Handler):
    """Redirects records from stdlib `logging` (uvicorn, sqlalchemy, ...) into loguru."""

    def emit(self, record: logging.LogRecord) -> None:
        if record.name == "uvicorn.error" and record.getMessage().strip() in _REDUNDANT_MESSAGES:
            return

        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        # Walk back through stdlib logging frames so loguru reports the
        # *caller's* file/line instead of pointing at this handler.
        frame, depth = logging.currentframe(), 2
        while frame.f_back and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(
            level, record.getMessage()
        )


def configure_logging() -> None:
    logger.remove()

    logger.add(
        sys.stderr,
        format=CONSOLE_FORMAT,
        level=settings.LOG_LEVEL,
        colorize=True,
        backtrace=False,
        diagnose=False,
    )

    # diagnose=False everywhere: it dumps every local variable per stack
    # frame, which turns one error into hundreds of log lines (and can leak
    # secrets held in locals). Our own exception handlers already log a
    # concise, app-only traceback - see app/core/utils/error_utils.py.
    logger.add(
        LOG_DIR / "app.log",
        format=FILE_FORMAT,
        level="INFO",
        rotation="10 MB",
        retention="14 days",
        compression="zip",
        backtrace=False,
        diagnose=False,
        enqueue=True,
    )

    logger.add(
        LOG_DIR / "error.log",
        format=FILE_FORMAT,
        level="ERROR",
        rotation="10 MB",
        retention="30 days",
        compression="zip",
        backtrace=False,
        diagnose=False,
        enqueue=True,
    )

    logging.basicConfig(handlers=[InterceptHandler()], level=0, force=True)
    for name in (
        "uvicorn",
        "uvicorn.access",
        "uvicorn.error",
        "sqlalchemy.engine",
        # SQLAlchemy's echo=True attaches its own StreamHandler directly to
        # this logger (not "sqlalchemy.engine") the first time an engine is
        # created - left alone, it prints raw AND propagates up to be
        # reformatted by us, so every query is logged twice.
        "sqlalchemy.engine.Engine",
    ):
        logging.getLogger(name).handlers = [InterceptHandler()]
        logging.getLogger(name).propagate = False
