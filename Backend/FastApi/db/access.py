"""Acceso interno a Supabase. Los servicios validan permisos antes de cada operación."""
from contextlib import contextmanager

import httpx
from fastapi import HTTPException

from FastApi.db.config import get_settings


@contextmanager
def privileged_client():
    settings = get_settings()
    if not settings.supabase_secret_key:
        raise HTTPException(503, "Configura SUPABASE_SECRET_KEY en Backend/.env.")
    key = settings.supabase_secret_key.get_secret_value()
    headers = {"apikey": key}
    if not key.startswith("sb_secret_"):
        headers["Authorization"] = f"Bearer {key}"
    with httpx.Client(base_url=str(settings.supabase_url).rstrip("/"), headers=headers, timeout=20) as client:
        yield client


def call(client, method, path, **kwargs):
    try:
        response = client.request(method, path, **kwargs)
    except httpx.HTTPError:
        raise HTTPException(502, "No se pudo conectar con Supabase.") from None
    if response.status_code >= 400:
        try:
            code = response.json().get("code")
        except (ValueError, AttributeError):
            code = None
        if code in ("42703", "42P01", "PGRST202", "PGRST204", "PGRST205"):
            raise HTTPException(503, "Falta actualizar Supabase. Aplica workflow.sql y después workflow_roles.sql, en Backend/FastApi/db, y recarga el esquema de la API.")
        if code == "23505":
            raise HTTPException(409, "Ya existe la placa o una orden abierta para ese vehículo. Revisa sus órdenes antes de repetir.")
        if code == "P0001":
            # Solo mensajes de nuestras funciones, nunca SQL ni detalles del registro.
            raise HTTPException(409, "La operación ya no es válida. Actualiza la orden y comprueba propietario, diagnóstico, vigencia y versión de la cotización.")
        if response.status_code in (401, 403):
            raise HTTPException(503, "Revisa la clave administrativa y los permisos de Supabase.")
        if response.status_code == 404:
            raise HTTPException(404, "Recurso no encontrado. Para fotografías, verifica el bucket configurado.")
        if response.status_code == 429:
            raise HTTPException(429, "Demasiadas solicitudes. Intenta nuevamente en unos minutos.")
        if response.status_code >= 500:
            raise HTTPException(502, "Supabase no pudo completar la operación.")
        raise HTTPException(409, "No se pudo guardar: revisa valores únicos y registros relacionados.")
    return response


def rows(client, table, **params):
    return call(client, "GET", f"/rest/v1/{table}", params=params).json()


def all_rows(client, table, **params):
    """Recorre páginas para no truncar informes por el límite de PostgREST."""
    result = []
    while True:
        page = rows(client, table, **(params | {"offset": len(result), "limit": 500}))
        result.extend(page)
        if not page:
            return result


def one(client, table, record_id, select="*"):
    result = rows(client, table, id=f"eq.{record_id}", select=select, limit=1)
    if not result:
        raise HTTPException(404, "Registro no encontrado.")
    return result[0]


def insert(client, table, data):
    result = call(client, "POST", f"/rest/v1/{table}", json=data,
                  headers={"Prefer": "return=representation"}).json()
    return result[0]


def patch(client, table, record_id, data, **conditions):
    result = call(client, "PATCH", f"/rest/v1/{table}",
                  params={"id": f"eq.{record_id}", **conditions}, json=data,
                  headers={"Prefer": "return=representation"}).json()
    if not result:
        raise HTTPException(409, "El registro cambió. Actualiza la página e intenta nuevamente.")
    return result[0]
