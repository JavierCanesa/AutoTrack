from typing import Any
from fastapi import APIRouter, Depends, HTTPException

from FastApi.services.service_type_service import get_workshop_service_types
from FastApi.dependencies import current_user, workshop_client
from FastApi.db.access import privileged_client, all_rows
from FastApi.schemas.auth import AuthUser

router = APIRouter(prefix="/api/service-types", tags=["Service types"])


@router.get("/workshop")
def workshop_catalog(user: AuthUser = Depends(current_user), client: Any = Depends(workshop_client)):
    return get_workshop_service_types(client, user)


@router.get("")
def list_service_types():
    """Catálogo público de service_types."""
    try:
        with privileged_client() as client:
            return all_rows(client, "service_types", select="id,name,description,created_at", order="name.asc,id.asc")
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"No se pudo consultar service_types ({e}). Revisa la conexión a PostgreSQL local.",
        ) from None
