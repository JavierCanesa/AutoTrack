import logging

import httpx
from fastapi import HTTPException
from pydantic import ValidationError

from FastApi.db.config import get_settings
from FastApi.schemas.auth import AuthUser, LoginRequest, LoginResponse


logger = logging.getLogger(__name__)


def response_error(response: httpx.Response):
    try:
        payload = response.json()
    except ValueError:
        payload = {}
    if not isinstance(payload, dict):
        payload = {}
    code = str(payload.get("error_code") or payload.get("code") or "").lower()
    message = str(
        payload.get("msg")
        or payload.get("message")
        or payload.get("error_description")
        or ""
    ).lower()
    return code, message


def auth_client():
    """Un cliente por petición: nunca comparte sesiones entre usuarios."""
    try:
        settings = get_settings()
    except ValidationError:
        raise HTTPException(503, "Revisa la configuración de Supabase en Backend/.env.") from None
    with httpx.Client(
        base_url=str(settings.supabase_url).rstrip("/"),
        headers={"apikey": settings.supabase_key.get_secret_value()},
        timeout=15,
    ) as client:
        yield client


def request(client: httpx.Client, method: str, path: str, **kwargs):
    try:
        response = client.request(method, path, **kwargs)
    except httpx.HTTPError:
        raise HTTPException(502, "No se pudo conectar con Supabase. Intenta nuevamente.") from None
    if response.status_code == 429:
        raise HTTPException(429, "Demasiados intentos. Espera unos minutos.")
    if response.status_code >= 500:
        code, message = response_error(response)
        if code == "42p17":
            raise HTTPException(503, "Una política RLS de profiles tiene recursión. Revisa sus condiciones en Supabase.")
        if path == "/auth/v1/signup" and (
            code == "unexpected_failure" or "database error saving new user" in message
        ):
            logger.warning("Supabase signup database failure: status=%s code=%s", response.status_code, code or "unknown")
            raise HTTPException(503, "Supabase no pudo crear el perfil. Revisa el trigger de auth.users y la tabla profiles.")
        raise HTTPException(502, "Supabase no está disponible. Intenta nuevamente.")
    return response


def get_user(client: httpx.Client, token: str) -> AuthUser:
    headers = {"Authorization": f"Bearer {token}"}
    response = request(client, "GET", "/auth/v1/user", headers=headers)
    if response.status_code != 200:
        raise HTTPException(401, "La sesión no es válida o ha vencido.", headers={"WWW-Authenticate": "Bearer"})
    user = response.json()
    if user.get("deleted_at"):
        raise HTTPException(401, "La cuenta ya no está disponible.")
    profile = request(client, "GET", "/rest/v1/profiles", headers=headers, params={
        "select": "id,first_name,last_name,role,client_code",
        "id": f"eq.{user['id']}",
        "limit": "1",
    })
    if profile.status_code != 200:
        raise HTTPException(503, "No se pudo leer tu perfil. Revisa los permisos de profiles.")
    rows = profile.json()
    if not rows:
        # Solo después de verificar el token con Auth. Nunca confiar en UUID/rol del formulario.
        from FastApi.db.access import privileged_client, call, rows as read_rows
        metadata = user.get("user_metadata") or {}
        with privileged_client() as admin:
            existing = read_rows(admin, "profiles", id=f"eq.{user['id']}", select="id", limit=1)
            if not existing:
                first = str(metadata.get("first_name") or "").strip()[:100]
                last = str(metadata.get("last_name") or "").strip()[:100]
                if not first or not last:
                    raise HTTPException(403, "Pide al administrador que complete tu perfil en Usuarios.")
                call(admin, "POST", "/rest/v1/profiles", params={"on_conflict": "id"},
                     headers={"Prefer": "resolution=ignore-duplicates,return=minimal"},
                     json={"id": user["id"], "first_name": first, "last_name": last,
                           "phone": str(metadata.get("phone") or "")[:30] or None, "role": "CLIENT"})
        profile = request(client, "GET", "/rest/v1/profiles", headers=headers,
                          params={"select": "id,first_name,last_name,role,client_code", "id": f"eq.{user['id']}", "limit": "1"})
        if profile.status_code != 200 or not profile.json():
            raise HTTPException(403, "Tu perfil existe, pero RLS no permite leerlo. Revisa la política SELECT de profiles.")
        rows = profile.json()
    try:
        return AuthUser(**rows[0], email=user.get("email", ""))
    except ValidationError:
        raise HTTPException(403, "Tu perfil está incompleto o tiene un rol no válido.") from None


def login_tokens(client: httpx.Client, data: LoginRequest):
    response = request(client, "POST", "/auth/v1/token", params={"grant_type": "password"},
                       json={"email": data.email, "password": data.password.get_secret_value()})
    if response.status_code != 200:
        code = response.json().get("error_code")
        if code == "email_not_confirmed":
            raise HTTPException(403, "Tu correo todavía no está confirmado en Supabase Authentication.")
        raise HTTPException(401, "Correo o contraseña incorrectos, o cuenta no disponible.")
    return response.json()


def session_view(client, session):
    return LoginResponse(access_token=session["access_token"], expires_in=session["expires_in"],
                         user=get_user(client, session["access_token"]))


def login(client, data):
    return session_view(client, login_tokens(client, data))


def register(client, data):
    response = request(client, "POST", "/auth/v1/signup", json={
        "email": data.email, "password": data.password.get_secret_value(),
        "data": {"first_name": data.first_name, "last_name": data.last_name, "phone": data.phone},
    })
    if response.status_code >= 400:
        code, message = response_error(response)
        logger.warning("Supabase signup rejected: status=%s code=%s", response.status_code, code or "unknown")
        if code in {"weak_password", "validation_failed"} or "password" in message:
            raise HTTPException(422, "Supabase rechazó la contraseña. Usa mayúscula, minúscula, número y símbolo; evita claves comunes.")
        if code in {"email_address_invalid", "invalid_email"} or "invalid email" in message:
            raise HTTPException(422, "El correo electrónico no es válido para Supabase.")
        if code in {"email_exists", "user_already_exists"} or "already registered" in message:
            raise HTTPException(409, "No se pudo registrar ese correo. Si ya tienes una cuenta, inicia sesión o recupera tu contraseña.")
        if code == "signup_disabled" or "signups not allowed" in message:
            raise HTTPException(503, "El registro de cuentas está deshabilitado en Supabase Authentication.")
        if code == "captcha_failed" or "captcha" in message:
            raise HTTPException(422, "No se pudo completar la verificación de seguridad. Recarga la página e inténtalo nuevamente.")
        raise HTTPException(400, f"Supabase rechazó el registro{f' ({code})' if code else ''}. Revisa los datos e inténtalo nuevamente.")
    return {"message": "Solicitud recibida. Si tu correo necesita confirmación, revisa tu bandeja antes de iniciar sesión."}


def own_profile(client, user, data=None):
    from FastApi.db.access import one, patch
    from datetime import datetime, timezone
    if data is not None:
        patch(client, "profiles", user.id, data.model_dump() | {"updated_at": datetime.now(timezone.utc).isoformat()})
    return one(client, "profiles", user.id, "id,first_name,last_name,phone,role,client_code")
