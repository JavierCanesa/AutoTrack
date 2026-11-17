import json
import logging
import time
from datetime import datetime, timezone
from uuid import UUID

import bcrypt
import jwt
from fastapi import HTTPException
from pydantic import ValidationError

from FastApi.db.config import get_settings
from FastApi.db.postgres_adapter import get_postgres_connection, PostgresSession, ResponseMock
from FastApi.schemas.auth import AuthUser, LoginRequest, LoginResponse

logger = logging.getLogger(__name__)


def auth_client():
    """Un cliente por petición para operaciones de autenticación."""
    with get_postgres_connection() as conn:
        yield PostgresSession(conn)


def request(client, method: str, path: str, **kwargs):
    norm_path = path.lstrip("/")
    # Soporte para /auth/v1/token con grant_type=refresh_token
    if norm_path == "auth/v1/token":
        params = kwargs.get("params", {})
        if params.get("grant_type") == "refresh_token":
            body = kwargs.get("json", {})
            refresh_token = body.get("refresh_token")
            if not refresh_token:
                return ResponseMock(status_code=401)
            settings = get_settings()
            try:
                payload = jwt.decode(refresh_token, settings.jwt_secret, algorithms=["HS256"])
            except jwt.PyJWTError:
                return ResponseMock(status_code=401)
            user_id = payload.get("sub")
            if not user_id or payload.get("type") != "refresh":
                return ResponseMock(status_code=401)
            with client.conn.cursor() as cur:
                cur.execute("SELECT id, email, deleted_at FROM auth.users WHERE id = %s", (user_id,))
                user = cur.fetchone()
                if not user or user[2]:
                    return ResponseMock(status_code=401)
            expires_in = 86400
            now = int(time.time())
            new_access = jwt.encode({"sub": str(user[0]), "email": user[1], "exp": now + expires_in}, settings.jwt_secret, algorithm="HS256")
            new_refresh = jwt.encode({"sub": str(user[0]), "type": "refresh", "exp": now + 30 * 86400}, settings.jwt_secret, algorithm="HS256")
            return ResponseMock({
                "access_token": new_access,
                "expires_in": expires_in,
                "refresh_token": new_refresh,
                "token_type": "bearer",
            })

    # Soporte para /auth/v1/logout
    if norm_path == "auth/v1/logout":
        return ResponseMock(status_code=204)

    if hasattr(client, "request"):
        return client.request(method, path, **kwargs)
    raise HTTPException(500, "Cliente de base de datos no válido.")



def get_user(client, token: str) -> AuthUser:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "La sesión no es válida o ha vencido.", headers={"WWW-Authenticate": "Bearer"})

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(401, "La sesión no es válida o ha vencido.", headers={"WWW-Authenticate": "Bearer"})

    with client.conn.cursor() as cur:
        # Verificar cuenta no eliminada
        cur.execute("SELECT id, email, deleted_at FROM auth.users WHERE id = %s", (user_id,))
        acc = cur.fetchone()
        if not acc:
            raise HTTPException(401, "La cuenta ya no existe.")
        if acc[2]:  # deleted_at
            raise HTTPException(401, "La cuenta ya no está disponible.")

        # Obtener perfil
        cur.execute("SELECT id, first_name, last_name, role, client_code FROM public.profiles WHERE id = %s", (user_id,))
        prof = cur.fetchone()
        if not prof:
            raise HTTPException(403, "Pide al administrador que complete tu perfil en Usuarios.")

    try:
        return AuthUser(
            id=prof[0],
            first_name=prof[1],
            last_name=prof[2],
            role=prof[3],
            client_code=prof[4],
            email=payload.get("email") or acc[1] or "",
        )
    except ValidationError:
        raise HTTPException(403, "Tu perfil está incompleto o tiene un rol no válido.") from None


def login_tokens(client, data: LoginRequest):
    settings = get_settings()
    email_clean = data.email.lower().strip()
    raw_password = data.password.get_secret_value()

    with client.conn.cursor() as cur:
        cur.execute(
            "SELECT id, email, encrypted_password, deleted_at FROM auth.users WHERE lower(email) = %s",
            (email_clean,)
        )
        user = cur.fetchone()

    if not user:
        raise HTTPException(401, "Correo o contraseña incorrectos, o cuenta no disponible.")

    user_id, email, encrypted_password, deleted_at = user
    if deleted_at:
        raise HTTPException(401, "La cuenta ya no está disponible.")

    # Verificar contraseña con bcrypt
    try:
        valid = bcrypt.checkpw(raw_password.encode("utf-8"), encrypted_password.encode("utf-8"))
    except Exception:
        valid = False

    if not valid:
        raise HTTPException(401, "Correo o contraseña incorrectos, o cuenta no disponible.")

    expires_in = 86400  # 24 horas
    now = int(time.time())
    token = jwt.encode(
        {"sub": str(user_id), "email": email, "exp": now + expires_in},
        settings.jwt_secret,
        algorithm="HS256"
    )
    refresh_token = jwt.encode(
        {"sub": str(user_id), "type": "refresh", "exp": now + 30 * 86400},
        settings.jwt_secret,
        algorithm="HS256"
    )

    return {"access_token": token, "expires_in": expires_in, "refresh_token": refresh_token, "token_type": "bearer"}


def session_view(client, session):
    return LoginResponse(
        access_token=session["access_token"],
        expires_in=session["expires_in"],
        user=get_user(client, session["access_token"]),
    )


def login(client, data):
    return session_view(client, login_tokens(client, data))


def register(client, data):
    email_clean = data.email.lower().strip()
    raw_password = data.password.get_secret_value()

    with client.conn.cursor() as cur:
        cur.execute("SELECT id FROM auth.users WHERE lower(email) = %s", (email_clean,))
        if cur.fetchone():
            raise HTTPException(409, "No se pudo registrar ese correo. Si ya tienes una cuenta, inicia sesión o recupera tu contraseña.")

        hashed = bcrypt.hashpw(raw_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        user_meta = json.dumps({"first_name": data.first_name, "last_name": data.last_name, "phone": data.phone})

        cur.execute("""
            INSERT INTO auth.users (
                instance_id, id, aud, role, email, encrypted_password,
                email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                created_at, updated_at
            ) VALUES (
                '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
                %s, %s, now(), '{"provider":"email","providers":["email"]}'::jsonb, %s::jsonb,
                now(), now()
            ) RETURNING id
        """, (email_clean, hashed, user_meta))
        new_id = cur.fetchone()[0]

        # Crear perfil como CLIENT si el trigger no lo creó
        cur.execute("""
            INSERT INTO public.profiles (id, first_name, last_name, phone, role)
            VALUES (%s, %s, %s, %s, 'CLIENT')
            ON CONFLICT (id) DO UPDATE SET
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                phone = EXCLUDED.phone
        """, (new_id, data.first_name, data.last_name, data.phone))

        client.conn.commit()

    return {"message": "Registro completado con éxito. Ya puedes iniciar sesión con tu correo y contraseña."}


def own_profile(client, user, data=None):
    from FastApi.db.access import one, patch
    if data is not None:
        patch(client, "profiles", user.id, data.model_dump() | {"updated_at": datetime.now(timezone.utc).isoformat()})
    return one(client, "profiles", user.id, "id,first_name,last_name,phone,role,client_code")
