from functools import lru_cache

from fastapi import HTTPException
from pydantic import ValidationError
from supabase import Client, create_client

from FastApi.db.config import get_settings


@lru_cache
def get_supabase() -> Client:
    try:
        settings = get_settings()
        return create_client(
            str(settings.supabase_url), settings.supabase_key.get_secret_value()
        )
    except (ValidationError, ValueError):
        raise HTTPException(
            status_code=503,
            detail="Configura SUPABASE_URL y SUPABASE_KEY en Backend/.env.",
        ) from None
