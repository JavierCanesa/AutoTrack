from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator

from FastApi.schemas.validation import clean_email, clean_name, clean_phone


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    email: str = Field(min_length=3, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    password: SecretStr = Field(min_length=1, max_length=4096)

    @field_validator("email")
    @classmethod
    def normalized_email(cls, value):
        return clean_email(value)


class RegisterRequest(LoginRequest):
    password: SecretStr = Field(min_length=8, max_length=4096)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    phone: str | None = Field(default=None, max_length=30)

    @field_validator("first_name", "last_name")
    @classmethod
    def non_blank(cls, value):
        return clean_name(value)

    @field_validator("phone")
    @classmethod
    def valid_phone(cls, value):
        return clean_phone(value)

    @field_validator("password")
    @classmethod
    def strong_password(cls, value):
        password = value.get_secret_value()
        requirements = (
            (any(char.islower() for char in password), "una letra minúscula"),
            (any(char.isupper() for char in password), "una letra mayúscula"),
            (any(char.isdigit() for char in password), "un número"),
            (any(not char.isalnum() and not char.isspace() for char in password), "un símbolo"),
        )
        missing = [label for valid, label in requirements if not valid]
        if missing:
            raise ValueError(f"La contraseña debe incluir {', '.join(missing)}.")
        return value


class AuthUser(BaseModel):
    id: UUID
    email: str
    client_code: str | None = None
    first_name: str
    last_name: str
    role: Literal["ADMIN", "MECHANIC", "CLIENT"]

    @field_validator("first_name", "last_name", mode="before")
    @classmethod
    def empty_name(cls, value):
        # Auth puede crear perfiles antes de que el administrador complete sus nombres.
        return value if value is not None else ""


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: AuthUser


class OwnProfileInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    phone: str | None = Field(default=None, max_length=30)

    @field_validator("first_name", "last_name")
    @classmethod
    def valid_name(cls, value):
        return clean_name(value)

    @field_validator("phone")
    @classmethod
    def valid_phone(cls, value):
        return clean_phone(value)
