import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from FastApi.schemas.auth import AuthUser
from FastApi.services.auth_service import auth_client, get_user
from FastApi.db.access import privileged_client

bearer = HTTPBearer(auto_error=False)


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
                 client: httpx.Client = Depends(auth_client)) -> AuthUser:
    if credentials is None:
        raise HTTPException(401, "Inicia sesión para continuar.", headers={"WWW-Authenticate": "Bearer"})
    return get_user(client, credentials.credentials)


def require_admin(user: AuthUser = Depends(current_user)) -> AuthUser:
    if user.role != "ADMIN":
        raise HTTPException(403, "Solo un administrador puede gestionar usuarios.")
    return user


def workshop_client(user: AuthUser = Depends(current_user)):
    # Nunca se entrega la clave al navegador. Cada servicio filtra por dueño/asignación.
    with privileged_client() as client:
        yield client
