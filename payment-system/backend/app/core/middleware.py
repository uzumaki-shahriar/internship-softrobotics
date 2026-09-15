import time
import uuid

from loguru import logger
from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Receive, Scope, Send


class RequestLoggingMiddleware:
    """Tags every request with a short id and logs method/path/status/duration.

    Deliberately plain ASGI, not Starlette's BaseHTTPMiddleware: combining
    BaseHTTPMiddleware with app-level exception handlers makes every
    unhandled exception get logged twice (once by the handler, once again
    when it re-propagates through BaseHTTPMiddleware's task group into
    Starlette's own ServerErrorMiddleware logging).
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = str(uuid.uuid4())[:8]
        start = time.perf_counter()
        status_code = 0

        async def send_wrapper(message):
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                headers = MutableHeaders(scope=message)
                headers.append("X-Request-ID", request_id)
            await send(message)

        with logger.contextualize(request_id=request_id):
            await self.app(scope, receive, send_wrapper)
            duration_ms = (time.perf_counter() - start) * 1000
            logger.info(
                "{} {} -> {} ({:.1f}ms)",
                scope["method"],
                scope["path"],
                status_code,
                duration_ms,
            )
