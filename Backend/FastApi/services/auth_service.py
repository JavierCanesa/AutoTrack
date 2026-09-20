import httpx
from fastapi import HTTPException
from pydantic import ValidationError

from FastApi.db.config import get_settings
from FastApi.schemas.auth import AuthUser, LoginRequest, LoginResponse


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
        raise HTTPException(502, "Supabase no está disponible. Intenta nuevamente.")
    return response


def get_user(client: httpx.Client, token: str) -> AuthUser:
    headers = {"Authorization": f"Bearer {token}"}
    response = request(client, "GET", "/auth/v1/user", headers=headers)
    if response.status_code != 200:
        raise HTTPException(401, "La sesión no es válida o ha vencido.", headers={"WWW-Authenticate": "Bearer"})
    user = response.json()
    profile = request(client, "GET", "/rest/v1/profiles", headers=headers, params={
        "select": "id,first_name,last_name,role",
        "id": f"eq.{user['id']}",
        "limit": "1",
    })
    if profile.status_code != 200:
        raise HTTPException(503, "No se pudo leer tu perfil. Revisa los permisos de profiles.")
    rows = profile.json()
    if not rows:
        raise HTTPException(403, "Tu perfil no está disponible. Contacta al administrador del taller.")
    try:
        return AuthUser(**rows[0], email=user.get("email", ""))
    except ValidationError:
        raise HTTPException(403, "Tu perfil está incompleto o tiene un rol no válido.") from None


def login(client: httpx.Client, data: LoginRequest) -> LoginResponse:
    response = request(client, "POST", "/auth/v1/token", params={"grant_type": "password"},
                       json={"email": data.email, "password": data.password.get_secret_value()})
    if response.status_code != 200:
        raise HTTPException(401, "No se pudo iniciar sesión. Revisa el correo, la contraseña y la confirmación de tu cuenta.")
    session = response.json()
    user = get_user(client, session["access_token"])
    return LoginResponse(access_token=session["access_token"], expires_in=session["expires_in"], user=user)
