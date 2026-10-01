from uuid import UUID
from datetime import date
import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

from FastApi.schemas.validation import clean_optional_text, clean_single_line


class VehicleInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    client_id: UUID
    plate: str = Field(min_length=1, max_length=20)
    brand: str = Field(min_length=1, max_length=80)
    model: str = Field(min_length=1, max_length=80)
    vehicle_year: int | None = Field(default=None, ge=1900)
    color: str | None = Field(default=None, max_length=40)
    vin: str | None = Field(default=None, max_length=17)
    vehicle_type: str = Field(pattern="^(SEDAN|SUV|MOTORCYCLE|PICKUP|SPORT)$")

    @field_validator("plate")
    @classmethod
    def uppercase(cls, value):
        value = value.strip().upper()
        compact = re.sub(r'[\s-]', '', value)
        if re.fullmatch(r'P\d{3}[A-Z0-9]{3}|[MC]\d{6}', compact):
            return f'{compact[0]} {compact[1:4]}-{compact[4:]}'
        raise ValueError("Usa una placa P 123-A4F, M 123-456 o C 123-456.")

    @field_validator("brand")
    @classmethod
    def normalize_brand(cls, value):
        return clean_single_line(value).upper()

    @field_validator("model")
    @classmethod
    def normalize_model(cls, value):
        return clean_single_line(value)

    @field_validator("vehicle_year")
    @classmethod
    def realistic_year(cls, value):
        if value is not None and value > date.today().year + 1:
            raise ValueError("El año no puede superar el próximo año modelo.")
        return value

    @field_validator("color")
    @classmethod
    def normalize_color(cls, value):
        return clean_optional_text(value)

    @field_validator("vin")
    @classmethod
    def valid_vin(cls, value):
        value = clean_optional_text(value)
        if value is None:
            return None
        value = value.replace(" ", "").upper()
        if not re.fullmatch(r"[A-HJ-NPR-Z0-9]{17}", value):
            raise ValueError("El VIN debe tener 17 caracteres y no puede incluir I, O ni Q.")
        return value
