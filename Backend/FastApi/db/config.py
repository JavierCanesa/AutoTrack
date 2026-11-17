from functools import lru_cache
from pathlib import Path

from pydantic import HttpUrl, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@localhost:5432/autotrack"
    jwt_secret: str = "autotrack_secret_key_2026_super_secure"
    upload_dir: Path = Path(__file__).resolve().parents[2] / "uploads"
    supabase_url: HttpUrl | None = None
    supabase_key: SecretStr | None = None
    supabase_secret_key: SecretStr | None = None
    cookie_secure: bool = False
    evidence_bucket: str = "evidence"

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
