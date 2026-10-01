from urllib.parse import urlsplit

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials

from FastApi.db.config import get_settings
from FastApi.dependencies import bearer, current_user
from FastApi.schemas.auth import AuthUser, LoginRequest, LoginResponse, RegisterRequest
from FastApi.schemas.auth import OwnProfileInput
from FastApi.dependencies import workshop_client
from FastApi.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["Auth"])
COOKIE = "autotrack_refresh"


@router.get("/profile")
def read_own_profile(user: AuthUser = Depends(current_user), client: httpx.Client = Depends(workshop_client)):
    return auth_service.own_profile(client, user)


@router.patch("/profile")
def update_own_profile(data: OwnProfileInput, user: AuthUser = Depends(current_user), client: httpx.Client = Depends(workshop_client)):
    return auth_service.own_profile(client, user, data)


def same_origin(request: Request):
    origin = request.headers.get("origin")
    if request.headers.get("sec-fetch-site") == "cross-site" or (origin and urlsplit(origin).netloc != request.headers.get("host")):
        raise HTTPException(403, "Origen de solicitud no permitido.")


def set_session_cookie(response, token):
    response.set_cookie(COOKIE, token, httponly=True, secure=get_settings().cookie_secure,
                        samesite="strict", path="/api/auth", max_age=30 * 24 * 3600)
    response.headers["Cache-Control"] = "no-store"


@router.post("/login", response_model=LoginResponse, dependencies=[Depends(same_origin)])
def sign_in(data: LoginRequest, response: Response, client: httpx.Client = Depends(auth_service.auth_client)):
    tokens = auth_service.login_tokens(client, data)
    result = auth_service.session_view(client, tokens)
    set_session_cookie(response, tokens["refresh_token"])
    return result


@router.post("/register", dependencies=[Depends(same_origin)])
def sign_up(data: RegisterRequest, client: httpx.Client = Depends(auth_service.auth_client)):
    return auth_service.register(client, data)


@router.post("/refresh", response_model=LoginResponse, dependencies=[Depends(same_origin)])
def refresh(request: Request, response: Response, client: httpx.Client = Depends(auth_service.auth_client)):
    token = request.cookies.get(COOKIE)
    if not token:
        raise HTTPException(401, "Inicia sesión para continuar.")
    upstream = auth_service.request(client, "POST", "/auth/v1/token", params={"grant_type": "refresh_token"}, json={"refresh_token": token})
    if upstream.status_code != 200:
        result = JSONResponse({"detail": "La sesión venció. Inicia sesión nuevamente."}, status_code=401)
        result.delete_cookie(COOKIE, path="/api/auth")
        return result
    tokens = upstream.json()
    result = auth_service.session_view(client, tokens)
    set_session_cookie(response, tokens["refresh_token"])
    return result


@router.post("/logout", status_code=204, dependencies=[Depends(same_origin)])
def logout(response: Response, credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
           client: httpx.Client = Depends(auth_service.auth_client)):
    if credentials:
        upstream = auth_service.request(client, "POST", "/auth/v1/logout", params={"scope": "local"},
                                        headers={"Authorization": f"Bearer {credentials.credentials}"})
        if upstream.status_code not in (200, 204, 401, 403):
            raise HTTPException(502, "No se pudo cerrar la sesión. Intenta nuevamente.")
    response.delete_cookie(COOKIE, path="/api/auth")
    response.headers["Cache-Control"] = "no-store"


@router.get("/me", response_model=AuthUser)
def me(response: Response, user: AuthUser = Depends(current_user)):
    response.headers["Cache-Control"] = "no-store"
    return user
