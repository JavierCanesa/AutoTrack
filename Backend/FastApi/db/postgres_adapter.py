"""Adaptador nativo de PostgreSQL para AutoTrack.
Reemplaza las llamadas REST de Supabase/PostgREST con consultas SQL directas a PostgreSQL.
"""
from __future__ import annotations

import json
import os
import re
from contextlib import contextmanager
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any
from uuid import UUID

import psycopg
from psycopg.rows import dict_row
from fastapi import HTTPException

from FastApi.db.config import get_settings


class ResponseMock:
    """Simula una respuesta HTTP mínima para compatibilidad con código existente."""
    def __init__(self, data: Any = None, status_code: int = 200, content: bytes = b""):
        self._data = data
        self.status_code = status_code
        self._content = content

    @property
    def content(self):
        if not self._content and self._data is not None:
            self._content = json.dumps(self._data, default=str).encode("utf-8")
        return self._content

    def json(self):
        if self._data is not None:
            return self._data
        if self.content:
            return json.loads(self.content.decode("utf-8"))
        return None


def serialize_val(val: Any) -> Any:
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    if isinstance(val, UUID):
        return str(val)
    if isinstance(val, Decimal):
        return float(val)
    if isinstance(val, dict):
        return {k: serialize_val(v) for k, v in val.items()}
    if isinstance(val, list):
        return [serialize_val(v) for v in val]
    return val



def clean_row(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {k: serialize_val(v) for k, v in row.items()}


class PostgresSession:
    def __init__(self, conn: psycopg.Connection):
        self.conn = conn
        self.settings = get_settings()

    def request(self, method: str, path: str, **kwargs) -> ResponseMock:
        method = method.upper()
        path = path.lstrip("/")

        # 1. RPC Functions
        if path.startswith("rest/v1/rpc/"):
            func_name = path.replace("rest/v1/rpc/", "").split("?")[0]
            return self._handle_rpc(func_name, kwargs.get("json", {}))

        # 2. REST Tables
        if path.startswith("rest/v1/"):
            table_name = path.replace("rest/v1/", "").split("?")[0]
            params = kwargs.get("params", {})
            json_body = kwargs.get("json", None)
            if method == "GET":
                return self._handle_select(table_name, params)
            elif method == "POST":
                return self._handle_insert(table_name, json_body, params)
            elif method == "PATCH":
                return self._handle_update(table_name, json_body, params)
            elif method == "DELETE":
                return self._handle_delete(table_name, params)

        # 3. Storage
        if path.startswith("storage/v1/"):
            return self._handle_storage(method, path, **kwargs)

        # 4. Auth Admin
        if path.startswith("auth/v1/admin/users"):
            return self._handle_auth_admin(method, path, **kwargs)

        raise HTTPException(404, f"Ruta no implementada en adaptador local: {path}")

    def _handle_rpc(self, func_name: str, args: dict[str, Any]) -> ResponseMock:
        with self.conn.cursor(row_factory=dict_row) as cur:
            try:
                if func_name == "receive_vehicle":
                    p_actor = args.get("p_actor")
                    p_code = args.get("p_code")
                    p_vehicle = args.get("p_vehicle")
                    p_new_vehicle = json.dumps(args.get("p_new_vehicle")) if args.get("p_new_vehicle") else None
                    p_service = args.get("p_service")
                    p_description = args.get("p_description")
                    cur.execute(
                        "SELECT * FROM public.receive_vehicle(%s, %s, %s, %s::jsonb, %s, %s)",
                        (p_actor, p_code, p_vehicle, p_new_vehicle, p_service, p_description)
                    )
                    row = cur.fetchone()
                    self.conn.commit()
                    return ResponseMock(clean_row(row))

                elif func_name == "quote_action":
                    p_actor = args.get("p_actor")
                    p_order = args.get("p_order")
                    p_action = args.get("p_action")
                    p_quote = args.get("p_quote")
                    p_data = json.dumps(args.get("p_data", {}))
                    cur.execute(
                        "SELECT * FROM public.quote_action(%s, %s, %s, %s, %s::jsonb)",
                        (p_actor, p_order, p_action, p_quote, p_data)
                    )
                    row = cur.fetchone()
                    self.conn.commit()
                    return ResponseMock(clean_row(row))

                elif func_name == "record_progress":
                    p_actor = args.get("p_actor")
                    p_order = args.get("p_order")
                    p_status = args.get("p_status")
                    p_comment = args.get("p_comment")
                    p_expected = args.get("p_expected")
                    cur.execute(
                        "SELECT public.record_progress(%s, %s, %s, %s, %s) AS result",
                        (p_actor, p_order, p_status, p_comment, p_expected)
                    )
                    row = cur.fetchone()
                    self.conn.commit()
                    res = row["result"] if row else None
                    if isinstance(res, str):
                        res = json.loads(res)
                    return ResponseMock(clean_row(res))

                else:
                    param_placeholders = ", ".join([f"%({k})s" for k in args.keys()])
                    cur.execute(f"SELECT * FROM public.{func_name}({param_placeholders})", args)
                    row = cur.fetchone()
                    self.conn.commit()
                    return ResponseMock(clean_row(row))
            except psycopg.Error as e:
                self.conn.rollback()
                raise self._map_pg_error(e)

    def _handle_select(self, table: str, params: dict[str, Any]) -> ResponseMock:
        with self.conn.cursor(row_factory=dict_row) as cur:
            select_cols = str(params.get("select", "*"))

            # Manejo especializado de consultas compuestas de work_orders
            if table == "work_orders" and (":" in select_cols or "vehicle." in "".join(params.keys())):
                query = """
                    SELECT
                        wo.*,
                        to_jsonb(v.*) AS vehicle,
                        CASE
                            WHEN st.id IS NOT NULL THEN jsonb_build_object('id', st.id, 'name', st.name)
                            ELSE NULL
                        END AS service_type
                    FROM public.work_orders wo
                    LEFT JOIN public.vehicles v ON v.id = wo.vehicle_id
                    LEFT JOIN public.service_types st ON st.id = wo.service_type_id
                """
                where_parts = []
                values = []
                for k, v in params.items():
                    if k in ("select", "order", "limit", "offset"):
                        continue
                    v_str = str(v)
                    val = v_str[3:] if v_str.startswith("eq.") else v_str
                    if k in ("vehicle.client_id", "vehicle_client_id"):
                        where_parts.append("v.client_id = %s")
                        values.append(val)
                    elif k == "mechanic_id":
                        where_parts.append("wo.mechanic_id = %s")
                        values.append(val)
                    elif k == "vehicle_id":
                        where_parts.append("wo.vehicle_id = %s")
                        values.append(val)
                    elif k == "id":
                        where_parts.append("wo.id = %s")
                        values.append(val)
                    elif k == "status":
                        where_parts.append("wo.status = %s")
                        values.append(val)

                if where_parts:
                    query += " WHERE " + " AND ".join(where_parts)

                order_by = params.get("order", "entry_date.desc,id.asc")
                order_clauses = []
                for p in order_by.split(","):
                    p = p.strip()
                    if "." in p:
                        col, d = p.split(".", 1)
                        dir_sql = "DESC" if d.lower() == "desc" else "ASC"
                        order_clauses.append(f"wo.{col} {dir_sql}")
                    else:
                        order_clauses.append(f"wo.{p} ASC")
                if order_clauses:
                    query += " ORDER BY " + ", ".join(order_clauses)

                if "limit" in params:
                    query += f" LIMIT {int(params['limit'])}"
                if "offset" in params:
                    query += f" OFFSET {int(params['offset'])}"

                try:
                    cur.execute(query, values)
                    rows = [clean_row(r) for r in cur.fetchall()]
                    return ResponseMock(rows)
                except psycopg.Error as e:
                    raise self._map_pg_error(e)

            # Manejo especializado de evidence_photos con JOIN a service_updates
            if table == "evidence_photos" and (":" in select_cols or "service_update" in "".join(params.keys())):
                query = """
                    SELECT ep.*
                    FROM public.evidence_photos ep
                    JOIN public.service_updates su ON su.id = ep.service_update_id
                """
                where_parts = []
                values = []
                for k, v in params.items():
                    if k in ("select", "order", "limit", "offset"):
                        continue
                    v_str = str(v)
                    val = v_str[3:] if v_str.startswith("eq.") else v_str
                    if "work_order_id" in k:
                        where_parts.append("su.work_order_id = %s")
                        values.append(val)
                    elif k == "id":
                        where_parts.append("ep.id = %s")
                        values.append(val)

                if where_parts:
                    query += " WHERE " + " AND ".join(where_parts)

                order_by = params.get("order", "created_at.asc,id.asc")
                order_clauses = []
                for p in order_by.split(","):
                    p = p.strip()
                    if "." in p:
                        col, d = p.split(".", 1)
                        dir_sql = "DESC" if d.lower() == "desc" else "ASC"
                        order_clauses.append(f"ep.{col} {dir_sql}")
                    else:
                        order_clauses.append(f"ep.{p} ASC")
                if order_clauses:
                    query += " ORDER BY " + ", ".join(order_clauses)

                if "limit" in params:
                    query += f" LIMIT {int(params['limit'])}"
                if "offset" in params:
                    query += f" OFFSET {int(params['offset'])}"

                try:
                    cur.execute(query, values)
                    rows = [clean_row(r) for r in cur.fetchall()]
                    return ResponseMock(rows)
                except psycopg.Error as e:
                    raise self._map_pg_error(e)

            # Consultas generales a tablas
            if select_cols == "*":
                cols_sql = "*"
            else:
                cols = [c.strip() for c in select_cols.split(",") if c.strip() and ":" not in c]
                if not cols:
                    cols_sql = "*"
                else:
                    cols_sql = ", ".join(c if c == "*" else (f'"{c}"' if not c.startswith('"') else c) for c in cols)

            where_clauses, values = self._parse_filters(params)
            where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

            order_by = params.get("order", "")
            order_sql = ""
            if order_by:
                order_parts = []
                for part in order_by.split(","):
                    p = part.strip()
                    if "." in p:
                        col, direction = p.split(".", 1)
                        direction = "DESC" if direction.lower() == "desc" else "ASC"
                        order_parts.append(f'"{col}" {direction}')
                    else:
                        order_parts.append(f'"{p}" ASC')
                order_sql = f"ORDER BY {', '.join(order_parts)}"

            limit_sql = ""
            if "limit" in params:
                limit_sql = f"LIMIT {int(params['limit'])}"
            if "offset" in params:
                limit_sql += f" OFFSET {int(params['offset'])}"

            schema = "auth" if table == "users" else "public"
            query = f'SELECT {cols_sql} FROM {schema}."{table}" {where_sql} {order_sql} {limit_sql}'.strip()

            try:
                cur.execute(query, values)
                rows = [clean_row(r) for r in cur.fetchall()]
                return ResponseMock(rows)
            except psycopg.Error as e:
                raise self._map_pg_error(e)

    def _handle_insert(self, table: str, json_body: Any, params: dict[str, Any]) -> ResponseMock:
        with self.conn.cursor(row_factory=dict_row) as cur:
            if not json_body:
                return ResponseMock([])
            items = json_body if isinstance(json_body, list) else [json_body]
            results = []
            schema = "auth" if table == "users" else "public"

            for item in items:
                cols = list(item.keys())
                vals = [json.dumps(v) if isinstance(v, (dict, list)) else v for v in item.values()]
                col_names = ", ".join(f'"{c}"' for c in cols)
                placeholders = ", ".join(["%s"] * len(cols))

                on_conflict = params.get("on_conflict")
                conflict_sql = ""
                if on_conflict:
                    update_parts = [f'"{c}" = EXCLUDED."{c}"' for c in cols if c != on_conflict]
                    if update_parts:
                        conflict_sql = f'ON CONFLICT ("{on_conflict}") DO UPDATE SET {", ".join(update_parts)}'
                    else:
                        conflict_sql = f'ON CONFLICT ("{on_conflict}") DO NOTHING'

                query = f'INSERT INTO {schema}."{table}" ({col_names}) VALUES ({placeholders}) {conflict_sql} RETURNING *'
                try:
                    cur.execute(query, vals)
                    row = cur.fetchone()
                    if row:
                        results.append(clean_row(row))
                    else:
                        results.append(item)
                except psycopg.Error as e:
                    self.conn.rollback()
                    raise self._map_pg_error(e)

            self.conn.commit()
            return ResponseMock(results, status_code=201)

    def _handle_update(self, table: str, json_body: dict[str, Any], params: dict[str, Any]) -> ResponseMock:
        with self.conn.cursor(row_factory=dict_row) as cur:
            where_clauses, values = self._parse_filters(params)
            if not where_clauses:
                raise HTTPException(400, "Update requiere condiciones.")

            set_parts = []
            set_values = []
            for k, v in json_body.items():
                set_parts.append(f'"{k}" = %s')
                set_values.append(json.dumps(v) if isinstance(v, (dict, list)) else v)

            schema = "auth" if table == "users" else "public"
            query = f'UPDATE {schema}."{table}" SET {", ".join(set_parts)} WHERE {" AND ".join(where_clauses)} RETURNING *'

            try:
                cur.execute(query, set_values + values)
                rows = [clean_row(r) for r in cur.fetchall()]
                self.conn.commit()
                return ResponseMock(rows)
            except psycopg.Error as e:
                self.conn.rollback()
                raise self._map_pg_error(e)

    def _handle_delete(self, table: str, params: dict[str, Any]) -> ResponseMock:
        with self.conn.cursor() as cur:
            where_clauses, values = self._parse_filters(params)
            if not where_clauses:
                raise HTTPException(400, "Delete requiere condiciones.")

            schema = "auth" if table == "users" else "public"
            query = f'DELETE FROM {schema}."{table}" WHERE {" AND ".join(where_clauses)}'
            try:
                cur.execute(query, values)
                self.conn.commit()
                return ResponseMock(None, status_code=204)
            except psycopg.Error as e:
                self.conn.rollback()
                raise self._map_pg_error(e)

    def _handle_storage(self, method: str, path: str, **kwargs) -> ResponseMock:
        parts = path.split("/")
        upload_base = Path(self.settings.upload_dir)
        upload_base.mkdir(parents=True, exist_ok=True)

        if "bucket" in parts:
            bucket_name = parts[-1]
            bucket_dir = upload_base / bucket_name
            bucket_dir.mkdir(parents=True, exist_ok=True)
            return ResponseMock({"name": bucket_name, "public": False})

        if "object" in parts:
            obj_idx = parts.index("object")
            subparts = parts[obj_idx + 1:]
            if subparts and subparts[0] == "authenticated":
                subparts = subparts[1:]
            if not subparts:
                raise HTTPException(400, "Ruta de objeto inválida.")

            bucket_name = subparts[0]
            rel_path = "/".join(subparts[1:])
            target_file = upload_base / bucket_name / rel_path

            if method == "POST":
                target_file.parent.mkdir(parents=True, exist_ok=True)
                content = kwargs.get("content", b"")
                with open(target_file, "wb") as f:
                    f.write(content)
                return ResponseMock({"Key": f"{bucket_name}/{rel_path}"}, status_code=200)

            elif method == "GET":
                if not target_file.exists():
                    raise HTTPException(404, "Fotografía no encontrada en el almacenamiento local.")
                with open(target_file, "rb") as f:
                    content = f.read()
                return ResponseMock(content=content, status_code=200)

        raise HTTPException(404, f"Operación de storage no encontrada: {path}")

    def _handle_auth_admin(self, method: str, path: str, **kwargs) -> ResponseMock:
        import bcrypt
        with self.conn.cursor(row_factory=dict_row) as cur:
            parts = [p for p in path.split("/") if p]
            if len(parts) >= 5:
                user_id = parts[4]
                if method == "GET":
                    cur.execute("SELECT * FROM auth.users WHERE id = %s", (user_id,))
                    row = cur.fetchone()
                    if not row:
                        raise HTTPException(404, "Usuario no encontrado.")
                    return ResponseMock(clean_row(row))
                elif method == "DELETE":
                    cur.execute("UPDATE auth.users SET deleted_at = now() WHERE id = %s RETURNING *", (user_id,))
                    row = cur.fetchone()
                    self.conn.commit()
                    return ResponseMock(clean_row(row))


            if method == "GET":
                params = kwargs.get("params", {})
                page = int(params.get("page", 1))
                per_page = int(params.get("per_page", 50))
                offset = (page - 1) * per_page
                cur.execute("SELECT * FROM auth.users ORDER BY created_at DESC LIMIT %s OFFSET %s", (per_page, offset))
                rows = [clean_row(r) for r in cur.fetchall()]
                return ResponseMock({"users": rows})

            elif method == "POST":
                body = kwargs.get("json", {})
                email = body.get("email", "").lower().strip()
                raw_password = body.get("password", "")
                hashed = bcrypt.hashpw(raw_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
                user_metadata = json.dumps(body.get("user_metadata", {}))

                cur.execute("""
                    INSERT INTO auth.users (
                        instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at
                    ) VALUES (
                        '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
                        %s, %s, now(), '{"provider":"email","providers":["email"]}'::jsonb, %s::jsonb,
                        now(), now()
                    ) RETURNING *
                """, (email, hashed, user_metadata))
                row = cur.fetchone()
                self.conn.commit()
                return ResponseMock(clean_row(row), status_code=201)

        raise HTTPException(404, f"Operación auth admin no encontrada: {path}")

    def _parse_filters(self, params: dict[str, Any]) -> tuple[list[str], list[Any]]:
        where = []
        values = []
        skip_keys = {"select", "order", "limit", "offset", "on_conflict"}

        for k, v in params.items():
            if k in skip_keys:
                continue
            col = f'"{k}"'
            v_str = str(v)
            if v_str.startswith("eq."):
                val = v_str[3:]
                where.append(f"{col} = %s")
                values.append(val)
            elif v_str.startswith("neq."):
                val = v_str[4:]
                where.append(f"{col} != %s")
                values.append(val)
            elif v_str == "is.null":
                where.append(f"{col} IS NULL")
            elif v_str == "not.is.null":
                where.append(f"{col} IS NOT NULL")
            elif v_str.startswith("in.(") and v_str.endswith(")"):
                inner = v_str[4:-1]
                items = [item.strip() for item in inner.split(",") if item.strip()]
                if items:
                    placeholders = ", ".join(["%s"] * len(items))
                    where.append(f"{col} IN ({placeholders})")
                    values.extend(items)
            else:
                where.append(f"{col} = %s")
                values.append(v)
        return where, values

    def _map_pg_error(self, e: psycopg.Error) -> HTTPException:
        sqlstate = getattr(e, "sqlstate", None)
        msg = str(e)
        if sqlstate == "23505":
            return HTTPException(409, "Ya existe la placa o una orden abierta para ese vehículo. Revisa sus órdenes antes de repetir.")
        if sqlstate == "P0001":
            clean_msg = msg.split("\n")[0].replace("ERROR:  ", "").strip()
            return HTTPException(409, clean_msg or "La operación ya no es válida.")
        return HTTPException(409, f"Error en base de datos: {msg}")


@contextmanager
def get_postgres_connection():
    settings = get_settings()
    try:
        with psycopg.connect(settings.database_url, autocommit=False) as conn:
            yield conn
    except psycopg.Error as e:
        raise HTTPException(503, f"No se pudo conectar a PostgreSQL local ({e}). Revisa DATABASE_URL en Backend/.env.")
