import httpx
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from FastApi.schemas.auth import AuthUser, LoginRequest, LoginResponse
from FastApi.services.auth_service import auth_client, get_user, login

router = APIRouter(prefix="/api/auth", tags=["Auth"])
bearer = HTTPBearer(auto_error=False)


@router.post("/login", response_model=LoginResponse)
def sign_in(data: LoginRequest, response: Response, client: httpx.Client = Depends(auth_client)):
    response.headers["Cache-Control"] = "no-store"
    return login(client, data)


@router.get("/me", response_model=AuthUser)
def me(response: Response, credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
       client: httpx.Client = Depends(auth_client)):
    response.headers["Cache-Control"] = "no-store"
    if credentials is None:
        raise HTTPException(401, "Inicia sesión para continuar.", headers={"WWW-Authenticate": "Bearer"})
    return get_user(client, credentials.credentials)
