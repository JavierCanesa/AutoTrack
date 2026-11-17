"""Acceso interno a PostgreSQL local. Los servicios validan permisos antes de cada operación."""
from contextlib import contextmanager
from typing import Any

from fastapi import HTTPException

from FastApi.db.config import get_settings
from FastApi.db.postgres_adapter import get_postgres_connection, PostgresSession


@contextmanager
def privileged_client():
    settings = get_settings()
    # Si está configurado PostgreSQL local (por defecto)
    with get_postgres_connection() as conn:
        yield PostgresSession(conn)


def call(client, method, path, **kwargs):
    if hasattr(client, "request"):
        return client.request(method, path, **kwargs)
    raise HTTPException(500, "Cliente de base de datos no válido.")


def rows(client, table, **params):
    return call(client, "GET", f"/rest/v1/{table}", params=params).json()


def all_rows(client, table, **params):
    result = []
    while True:
        page = rows(client, table, **(params | {"offset": len(result), "limit": 500}))
        result.extend(page)
        if not page or len(page) < 500:
            return result


def one(client, table, record_id, select="*"):
    result = rows(client, table, id=f"eq.{record_id}", select=select, limit=1)
    if not result:
        raise HTTPException(404, "Registro no encontrado.")
    return result[0]


def insert(client, table, data):
    result = call(client, "POST", f"/rest/v1/{table}", json=data).json()
    return result[0] if result else {}


def patch(client, table, record_id, data, **conditions):
    result = call(client, "PATCH", f"/rest/v1/{table}",
                  params={"id": f"eq.{record_id}", **conditions}, json=data).json()
    if not result:
        raise HTTPException(409, "El registro cambió. Actualiza la página e intenta nuevamente.")
    return result[0]
