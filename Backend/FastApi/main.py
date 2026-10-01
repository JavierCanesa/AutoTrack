from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from FastApi.routers import auth, service_types, users, vehicles, work_orders, reports

app = FastAPI(title="AutoTrack API", version="1.0.0")
app.include_router(service_types.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(vehicles.router)
app.include_router(work_orders.router)
app.include_router(reports.router)

FIELD_NAMES = {
    "first_name": "Nombre",
    "last_name": "Apellido",
    "phone": "Teléfono",
    "email": "Correo",
    "password": "Contraseña",
    "plate": "Placa",
    "brand": "Marca",
    "model": "Modelo",
    "vehicle_year": "Año",
    "vehicle_type": "Tipo de vehículo",
    "vin": "VIN",
    "code": "Código del cliente",
    "client_code": "Código del cliente",
    "description": "Descripción",
    "part_name": "Pieza",
    "comment": "Comentario",
    "valid_until": "Vigencia",
    "quantity": "Cantidad",
    "unit_price": "Precio",
    "notes": "Observaciones",
    "completed_items": "Piezas confirmadas",
}


def validation_message(error):
    kind = error["type"]
    if kind == "value_error":
        message = str(error.get("ctx", {}).get("error", "Valor no válido."))
        return message.removeprefix("Value error, ")
    messages = {
        "missing": "Este campo es obligatorio.",
        "extra_forbidden": "Este campo no está permitido.",
        "string_too_short": "El texto es demasiado corto.",
        "string_too_long": "El texto supera la longitud permitida.",
        "string_pattern_mismatch": "El formato no es válido.",
        "greater_than": "El valor debe ser mayor que el mínimo permitido.",
        "greater_than_equal": "El valor está por debajo del mínimo permitido.",
        "less_than_equal": "El valor supera el máximo permitido.",
        "decimal_max_places": "Usa como máximo dos decimales.",
        "uuid_parsing": "Selecciona una opción válida.",
        "date_from_datetime_parsing": "Escribe una fecha válida.",
        "enum": "Selecciona una opción válida.",
    }
    return messages.get(kind, "El valor enviado no es válido.")


@app.middleware("http")
async def private_responses(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "same-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


@app.exception_handler(RequestValidationError)
async def invalid_request(request, exc):
    # No devolver valores enviados: podrían contener contraseñas.
    errors = []
    for error in exc.errors():
        location = [part for part in error["loc"] if part not in ("body", "query", "path")]
        field = next((part for part in reversed(location) if isinstance(part, str)), "campo")
        errors.append({"field": ".".join(str(part) for part in location),
                       "message": validation_message(error),
                       "label": FIELD_NAMES.get(field, field.replace("_", " ").capitalize())})
    first = errors[0] if errors else None
    return JSONResponse(status_code=422, content={
        "detail": f"{first['label']}: {first['message']}" if first else "Revisa los campos enviados.",
        "errors": errors,
    })


@app.get("/")
def root():
    return {"message": "AutoTrack API funcionando"}
