from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central app configuration, loaded from environment variables / .env."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "Payment Gateway"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # Postgres connection string, e.g.
    # postgresql+psycopg2://gateway_user:gateway_pass@localhost:5432/payment_gateway
    DATABASE_URL: str

    # JWT — used by Module 3 (auth) to sign and verify merchant/admin tokens
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60

    # Shared static API key for internal/admin server-to-server calls
    # (sent as X-API-KEY header by trusted callers, e.g. the Bank System)
    GATEWAY_API_KEY: str


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
