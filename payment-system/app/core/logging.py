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
    "<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | "
    "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>"
)

FILE_FORMAT = (
    "{time:YYYY-MM-DD HH:mm} | {level: <8} | {name}:{function}:{line} - {message}"
)


class InterceptHandler(logging.Handler):
    """Redirects records from stdlib `logging` (uvicorn, sqlalchemy, ...) into loguru."""

    def emit(self, record: logging.LogRecord) -> None:
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

    logger.add(
        LOG_DIR / "app.log",
        format=FILE_FORMAT,
        level="INFO",
        rotation="10 MB",
        retention="14 days",
        compression="zip",
        backtrace=True,
        diagnose=settings.DEBUG,
        enqueue=True,
    )

    logger.add(
        LOG_DIR / "error.log",
        format=FILE_FORMAT,
        level="ERROR",
        rotation="10 MB",
        retention="30 days",
        compression="zip",
        backtrace=True,
        diagnose=settings.DEBUG,
        enqueue=True,
    )

    logging.basicConfig(handlers=[InterceptHandler()], level=0, force=True)
    for name in ("uvicorn", "uvicorn.access", "uvicorn.error", "sqlalchemy.engine"):
        logging.getLogger(name).handlers = [InterceptHandler()]
        logging.getLogger(name).propagate = False
