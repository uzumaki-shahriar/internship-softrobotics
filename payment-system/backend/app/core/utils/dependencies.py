from app.core.utils.pagination import PaginationParams


def get_pagination(page: int = 1, page_size: int = 20) -> PaginationParams:
    return PaginationParams(page=page, page_size=page_size)
