from enum import StrEnum
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic import model_validator
from datetime import date
from decimal import Decimal
from FastApi.schemas.vehicle import VehicleInput
from FastApi.schemas.validation import clean_optional_text, clean_required_text, clean_single_line


class Status(StrEnum):
    RECEIVED = "RECEIVED"
    DIAGNOSIS = "DIAGNOSIS"
    WAITING_APPROVAL = "WAITING_APPROVAL"
    IN_REPAIR = "IN_REPAIR"
    TESTING = "TESTING"
    COMPLETED = "COMPLETED"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class OrderInput(Input):
    vehicle_id: UUID
    service_type_id: UUID
    mechanic_id: UUID | None = None
    description: str | None = Field(default=None, max_length=4000)

    @field_validator("description")
    @classmethod
    def valid_description(cls, value):
        return clean_optional_text(value)


class Assignment(Input):
    mechanic_id: UUID | None


class DiagnosisInput(Input):
    description: str = Field(min_length=1, max_length=4000)
    symptoms: str | None = Field(default=None, max_length=2000)
    service_type_id: UUID | None = None

    @field_validator("description")
    @classmethod
    def valid_description(cls, value):
        return clean_required_text(value)

    @field_validator("symptoms")
    @classmethod
    def valid_symptoms(cls, value):
        return clean_optional_text(value)


class PartInput(Input):
    part_name: str = Field(min_length=1, max_length=150)
    action: str = Field(pattern="^(REPAIR|REPLACE)$")
    notes: str | None = Field(default=None, max_length=2000)
    priority: str = Field(default="MEDIUM", pattern="^(HIGH|MEDIUM|LOW)$")

    @field_validator("part_name")
    @classmethod
    def valid_part_name(cls, value):
        return clean_single_line(value)

    @field_validator("notes")
    @classmethod
    def valid_notes(cls, value):
        return clean_optional_text(value)


class ReceptionInput(Input):
    client_code: str = Field(pattern="^[A-Z0-9]{8}$")
    vehicle_id: UUID | None = None
    new_vehicle: VehicleInput | None = None
    service_type_id: UUID | None = None
    description: str | None = Field(default=None, max_length=4000)

    @field_validator("client_code", mode="before")
    @classmethod
    def normalized_code(cls, value):
        return str(value).strip().upper()

    @field_validator("description")
    @classmethod
    def valid_description(cls, value):
        return clean_optional_text(value)

    @model_validator(mode="after")
    def exactly_one_vehicle(self):
        if (self.vehicle_id is None) == (self.new_vehicle is None):
            raise ValueError("Selecciona un vehículo o registra uno nuevo.")
        return self


class QuoteItem(Input):
    description: str = Field(min_length=1, max_length=200)
    kind: str = Field(pattern="^(PART|LABOR)$")
    quantity: Decimal = Field(gt=0, le=10000, decimal_places=2, allow_inf_nan=False)
    unit_price: Decimal = Field(ge=0, le=1000000, decimal_places=2, allow_inf_nan=False)

    @field_validator("description")
    @classmethod
    def valid_description(cls, value):
        return clean_single_line(value)


class QuoteInput(Input):
    items: list[QuoteItem] = Field(min_length=1, max_length=100)
    valid_until: date
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("notes")
    @classmethod
    def valid_notes(cls, value):
        return clean_optional_text(value)

    @field_validator("valid_until")
    @classmethod
    def valid_date(cls, value):
        if value < date.today():
            raise ValueError("La vigencia no puede estar en el pasado.")
        return value

    @model_validator(mode="after")
    def valid_limits(self):
        total = sum((item.quantity * item.unit_price for item in self.items), Decimal("0"))
        if total > Decimal("999999999999.99"):
            raise ValueError("El total de la cotización excede el máximo permitido.")
        return self


class ProgressInput(Input):
    completed_items: list[int] = Field(default_factory=list, max_length=100)
    status: Status
    comment: str = Field(min_length=1, max_length=2000)

    @field_validator("comment")
    @classmethod
    def valid_comment(cls, value):
        return clean_required_text(value)

    @field_validator("completed_items")
    @classmethod
    def valid_completed_items(cls, value):
        if any(index < 0 or index > 99 for index in value) or len(value) != len(set(value)):
            raise ValueError("La lista de piezas confirmadas no es válida.")
        return value
