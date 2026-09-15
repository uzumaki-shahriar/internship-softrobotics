from typing import Any, Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    success: bool = True
    message: str = "Operation completed successfully"
    data: T | None = None
    errors: Any | None = None


# For paginated list endpoints, use PaginatedResponse from
# app.core.utils.pagination instead - see that module's PaginationParams /
# get_pagination dependency for how it's built.
