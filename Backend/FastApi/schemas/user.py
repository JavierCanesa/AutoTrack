from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, SecretStr
from pydantic import field_validator

from FastApi.schemas.validation import clean_email, clean_name, clean_phone

Role = Literal["ADMIN", "MECHANIC", "CLIENT"]


class UserProfileInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    phone: str | None = Field(default=None, max_length=30)
    role: Role = "CLIENT"

    @field_validator("first_name", "last_name")
    @classmethod
    def valid_name(cls, value):
        return clean_name(value)

    @field_validator("phone")
    @classmethod
    def valid_phone(cls, value):
        return clean_phone(value)


class UserCreate(UserProfileInput):
    email: str = Field(max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    password: SecretStr = Field(min_length=8, max_length=4096)

    @field_validator("email")
    @classmethod
    def normalized_email(cls, value):
        return clean_email(value)


class UserView(BaseModel):
    id: UUID
    email: str | None
    first_name: str
    last_name: str
    phone: str | None
    role: Role | None
    profile_exists: bool
    deleted: bool
    email_confirmed: bool


class UserList(BaseModel):
    users: list[UserView]
    page: int
    per_page: int
