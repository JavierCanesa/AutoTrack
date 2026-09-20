from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, SecretStr


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    password: SecretStr = Field(min_length=1, max_length=4096)


class AuthUser(BaseModel):
    id: UUID
    email: str
    first_name: str
    last_name: str
    role: Literal["ADMIN", "MECHANIC", "CLIENT"]


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: AuthUser
