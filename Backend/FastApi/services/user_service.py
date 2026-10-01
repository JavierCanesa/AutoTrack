"""Gestión de cuentas Auth y perfiles sin cambiar sus claves primarias."""

from uuid import UUID
from datetime import datetime, timezone

import httpx
from fastapi import Depends, HTTPException

from FastApi.db.config import get_settings
from FastApi.dependencies import require_admin
from FastApi.schemas.auth import AuthUser
from FastApi.schemas.user import UserCreate, UserProfileInput, UserView
from FastApi.services.auth_service import request


def admin_client(actor: AuthUser = Depends(require_admin)):
    settings = get_settings()
    if not settings.supabase_secret_key:
        raise HTTPException(503, "Configura SUPABASE_SECRET_KEY solo en Backend/.env para gestionar usuarios.")
    key = settings.supabase_secret_key.get_secret_value()
    headers = {"apikey": key}
    # Las claves service_role antiguas son JWT; las nuevas sb_secret_ van en apikey.
    if not key.startswith("sb_secret_"):
        headers["Authorization"] = f"Bearer {key}"
    with httpx.Client(base_url=str(settings.supabase_url).rstrip("/"), headers=headers, timeout=15) as client:
        # La autorización ya fue validada con el token real antes de usar esta clave.
        yield client


def checked(client, method, path, **kwargs):
    result = request(client, method, path, **kwargs)
    if result.status_code in (401, 403):
        raise HTTPException(503, "La clave administrativa no tiene permisos. Revisa SUPABASE_SECRET_KEY.")
    if result.status_code == 404:
        raise HTTPException(404, "Usuario no encontrado.")
    if result.status_code >= 400:
        raise HTTPException(409, "Supabase rechazó la operación. Revisa si el correo existe y las restricciones o triggers de profiles.")
    return result.json() if result.content else None


def auth_account(client, user_id: UUID):
    return checked(client, "GET", f"/auth/v1/admin/users/{user_id}")


def view(account, profile):
    return UserView(
        id=account["id"], email=account.get("email"),
        first_name=(profile or {}).get("first_name") or "",
        last_name=(profile or {}).get("last_name") or "",
        phone=(profile or {}).get("phone"), role=(profile or {}).get("role"),
        profile_exists=profile is not None, deleted=bool(account.get("deleted_at")),
        email_confirmed=bool(account.get("email_confirmed_at")),
    )


def get_profile(client, user_id):
    rows = checked(client, "GET", "/rest/v1/profiles", params={
        "id": f"eq.{user_id}", "select": "id,first_name,last_name,phone,role", "limit": "1",
    })
    return rows[0] if rows else None


def get_user_view(client, user_id: UUID):
    return view(auth_account(client, user_id), get_profile(client, user_id))


def list_users(client, page: int, per_page: int):
    accounts = checked(client, "GET", "/auth/v1/admin/users", params={"page": page, "per_page": per_page})["users"]
    if not accounts:
        return []
    ids = ",".join(str(UUID(account["id"])) for account in accounts)
    profiles = checked(client, "GET", "/rest/v1/profiles", params={
        "id": f"in.({ids})", "select": "id,first_name,last_name,phone,role",
    })
    by_id = {row["id"]: row for row in profiles}
    return [view(account, by_id.get(account["id"])) for account in accounts]


def save_profile(client, user_id: UUID, data: UserProfileInput):
    # UPSERT por el UUID de Auth: completa el perfil creado por el trigger o lo crea
    # si falta. No genera otro UUID ni modifica las referencias de los vehículos.
    checked(client, "POST", "/rest/v1/profiles", params={"on_conflict": "id"},
            headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
            json={"id": str(user_id), **data.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()})


def create_user(client, data: UserCreate):
    account = checked(client, "POST", "/auth/v1/admin/users", json={
        "email": data.email, "password": data.password.get_secret_value(),
        "email_confirm": True,
        "user_metadata": {"first_name": data.first_name, "last_name": data.last_name, "phone": data.phone},
    })
    user_id = UUID(account["id"])
    profile = UserProfileInput(**data.model_dump(exclude={"email", "password"}))
    try:
        save_profile(client, user_id, profile)
    except HTTPException:
        # No borrar la cuenta como compensación: Auth podría haber ejecutado triggers.
        raise HTTPException(409, f"La cuenta fue creada con UUID {user_id}, pero falta completar el perfil. Recarga Usuarios y usa Editar; no crees otra cuenta.") from None
    return view(account, {"id": str(user_id), **profile.model_dump()})


def update_user(client, user_id: UUID, data: UserProfileInput):
    account = auth_account(client, user_id)
    if account.get("deleted_at"):
        raise HTTPException(409, "Una cuenta eliminada no puede editarse.")
    existing = get_profile(client, user_id)
    if existing and existing["role"] != data.role:
        if existing["role"] == "ADMIN":
            raise HTTPException(409, "No se permite quitar el rol ADMIN desde este módulo para evitar perder el acceso administrativo.")
        references = [("vehicles", "client_id"), ("work_orders", "mechanic_id"),
                      ("diagnoses", "mechanic_id"), ("service_updates", "mechanic_id"), ("evidence_photos", "uploaded_by")]
        for table, column in references:
            rows = checked(client, "GET", f"/rest/v1/{table}", params={column: f"eq.{user_id}", "select": "id", "limit": "1"})
            if rows:
                raise HTTPException(409, "Este usuario tiene vehículos o trabajos relacionados. Conserva su rol para proteger el historial.")
    save_profile(client, user_id, data)
    return view(account, {"id": str(user_id), **data.model_dump()})


def delete_user(client, user_id: UUID, actor_id: UUID):
    if user_id == actor_id:
        raise HTTPException(409, "No puedes eliminar tu propia cuenta.")
    account = auth_account(client, user_id)
    profile = get_profile(client, user_id)
    if profile and profile["role"] == "ADMIN":
        raise HTTPException(409, "Las cuentas ADMIN no se eliminan desde este módulo.")
    if not account.get("deleted_at"):
        # Conserva auth.users.id y profiles: no se disparan cascadas sobre el historial.
        checked(client, "DELETE", f"/auth/v1/admin/users/{user_id}", json={"should_soft_delete": True})
