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


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
