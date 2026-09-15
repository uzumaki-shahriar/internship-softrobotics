# Payment Gateway — Backend

FastAPI + SQLModel + PostgreSQL. This is the initial project skeleton — read
this before you start adding your module's routes/models so we stay
consistent across all 5 of us.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env             # then fill in your local DATABASE_URL
uvicorn app.main:app --reload
```

`DATABASE_URL` has no default in `app/config.py` on purpose — the app
refuses to start without it rather than silently falling back to something
wrong. Create the Postgres database yourself first (`createdb payment_gateway`
or via psql) before running the app.

## Project layout

```
app/
├── main.py            entrypoint - wires config, logging, middleware, exception
│                       handlers and routers together. Don't add routes here.
├── config.py           Settings (pydantic-settings), reads .env
├── database.py         SQLModel engine + get_session() dependency
├── core/
│   ├── logging.py       loguru setup - don't touch unless you know why
│   ├── middleware.py     request-id + request logging (plain ASGI)
│   └── utils/
│       ├── exceptions.py   AppException + friends, global exception handlers
│       ├── error_utils.py  traceback formatting helpers used by exceptions.py
│       ├── response.py     ApiResponse envelope
│       ├── pagination.py   PaginationParams + PaginatedResponse
│       └── dependencies.py get_pagination() FastAPI dependency
├── models/              SQLModel table classes go here, one file per table
└── routers/
    ├── __init__.py       api_router - register your router here
    └── health.py          example router (GET /health, GET /health/error)
```

## Adding your module

1. Add your SQLModel table(s) under `app/models/<name>.py`, then import the
   class in `app/models/__init__.py` so Alembic picks it up.
2. Generate a migration: `alembic revision --autogenerate -m "add X table"`,
   check the generated file, then `alembic upgrade head`.
3. Add your router in `app/routers/<name>.py`, then register it in
   `app/routers/__init__.py`:
   ```python
   from app.routers import your_module
   api_router.include_router(your_module.router, prefix="/your-prefix", tags=["your-tag"])
   ```
4. Use `Session = Depends(get_session)` from `app.database` for DB access in
   your route functions — don't create your own engine/session.

## Response shape — use it everywhere

Every endpoint should return `ApiResponse` (`app.core.utils.response`) for a
single object, or `PaginatedResponse` (`app.core.utils.pagination`) for a
list. Don't return raw dicts or bare Pydantic models — the whole point is
that every response from every module looks the same on the wire.

```python
from app.core.utils.response import ApiResponse

@router.get("/merchants/{id}")
async def get_merchant(id: int) -> ApiResponse[MerchantRead]:
    merchant = ...
    return ApiResponse(data=merchant)
```

```json
{ "success": true, "message": "Operation completed successfully", "data": { ... }, "errors": null }
```

## Pagination — use it, don't reinvent it

```python
from app.core.utils.dependencies import get_pagination
from app.core.utils.pagination import PaginationParams, PaginatedResponse

@router.get("/transactions")
async def list_transactions(
    pagination: PaginationParams = Depends(get_pagination),
    session: Session = Depends(get_session),
) -> PaginatedResponse[TransactionRead]:
    total = session.exec(select(func.count()).select_from(Transaction)).one()
    items = session.exec(
        select(Transaction).offset(pagination.offset).limit(pagination.limit)
    ).all()
    return PaginatedResponse.create(items=items, total=total, params=pagination)
```

This gives clients `?page=1&page_size=20` query params and a consistent
`{items, total, page, page_size, pages}` shape. Don't hand-roll your own
`limit`/`offset` query params or a different pagination envelope.

## Errors — raise, don't return

Don't build error JSON by hand and don't use bare `HTTPException` for
anything domain-specific. Raise one of the exceptions in
`app.core.utils.exceptions` and the global handler in `app/main.py` turns it
into the right status code, logs it, and shapes the response for you:

```python
from app.core.utils.exceptions import NotFoundException, ConflictException

merchant = session.get(Merchant, id)
if merchant is None:
    raise NotFoundException("Merchant not found")
```

Available: `NotFoundException` (404), `UnauthorizedException` (401),
`ForbiddenException` (403), `ConflictException` (409), `BadRequestException`
(400). Need a status code none of these cover? Raise `AppException(status_code=..., detail=..., code="SOME_CODE")` directly rather than a plain `HTTPException`, so it still goes through the same logging/response path.

Every error response has this shape, whether it came from your code, a 404,
or a genuine unhandled bug:

```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Merchant not found" }, "status_code": 404 }
```

Don't add another `try/except` around your route to catch-and-log unexpected
errors — the global handler in `app/main.py` already does that for anything
you don't explicitly raise, and logs it with the exact file/line it came
from. Adding your own would just produce a duplicate log line.

## Logging

Use loguru everywhere, not `print()` and not the stdlib `logging` module:

```python
from loguru import logger

logger.info("Merchant {} settled {} transactions", merchant.id, count)
logger.warning("Refund amount {} exceeds transaction gross {}", amount, gross)
```

- Console output and `logs/app.log` / `logs/error.log` all come from the one
  config in `app/core/logging.py` — you don't need to configure anything
  per-module.
- `logger.info`/`warning` go to `app.log`; anything `error` level or above
  also lands in `error.log`.
- Don't call `logger.exception(...)` yourself inside a route to log an error
  you're about to raise — raise the exception and let the global handler log
  it once. Calling both means the same error shows up twice.
- `logs/*.log` are gitignored. Don't commit them, and don't rely on them
  existing until the app has actually run.

## Things not to do

- Don't add your own `@app.exception_handler(...)` in `main.py` — extend
  `app/core/utils/exceptions.py` instead so every module's errors look the
  same.
- Don't add another request-logging middleware — one is already registered
  in `main.py`. If you use `@app.middleware("http")` (Starlette's
  `BaseHTTPMiddleware`) for anything, be aware it interacts badly with
  global exception handlers and will duplicate error logs — see the comment
  at the top of `app/core/middleware.py`.
- Don't create a second SQLAlchemy engine/session — always go through
  `app.database.get_session`.
- Don't hardcode config (DB URL, secrets, ports) — add it to `Settings` in
  `app/config.py` and `.env.example`.
