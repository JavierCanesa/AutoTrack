from fastapi import APIRouter, Depends, HTTPException
from httpx import HTTPError
from postgrest.exceptions import APIError
from supabase import Client

from FastApi.db.database import get_supabase
from FastApi.services.service_type_service import get_service_types

router = APIRouter(prefix="/api/service-types", tags=["Service types"])


@router.get("")
def list_service_types(supabase: Client = Depends(get_supabase)):
    """Prueba de lectura del catálogo public.service_types."""
    try:
        return get_service_types(supabase)
    except (APIError, HTTPError):
        raise HTTPException(
            status_code=502,
            detail="No se pudo consultar service_types en Supabase. Revisa la conexión y los permisos de lectura.",
        ) from None
