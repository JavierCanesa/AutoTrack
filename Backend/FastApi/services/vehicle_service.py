"""Vehículos: administración y lectura restringida al dueño o mecánico asignado."""
from datetime import datetime, timezone
from fastapi import HTTPException
from FastApi.db.access import all_rows, call, insert, one, patch, rows


def require_role(user, *roles):
    if user.role not in roles:
        raise HTTPException(403, "Tu rol no permite esta operación.")


def valid_profile(client, profile_id, role):
    profile = one(client, "profiles", profile_id)
    if profile["role"] != role:
        raise HTTPException(422, f"Selecciona un usuario con rol {role}.")
    account = call(client, "GET", f"/auth/v1/admin/users/{profile_id}").json()
    if account.get("deleted_at"):
        raise HTTPException(422, "La cuenta seleccionada está eliminada.")


def list_vehicles(client, user):
    params = {"select": "*", "order": "plate.asc,id.asc"}
    if user.role == "CLIENT":
        params["client_id"] = f"eq.{user.id}"
    elif user.role == "MECHANIC":
        orders = all_rows(client, "work_orders", select="vehicle_id", mechanic_id=f"eq.{user.id}", order="id.asc")
        ids = sorted({order["vehicle_id"] for order in orders})
        if not ids:
            return []
        # Consultas cortas, evitando un filtro IN que exceda el tamaño de URL.
        return [one(client, "vehicles", record_id) for record_id in ids]
    return all_rows(client, "vehicles", **params)


def get_vehicle(client, user, record_id):
    vehicle = one(client, "vehicles", record_id)
    if user.role == "CLIENT" and vehicle["client_id"] != str(user.id):
        raise HTTPException(404, "Vehículo no encontrado.")
    if user.role == "MECHANIC" and not rows(client, "work_orders", vehicle_id=f"eq.{record_id}", mechanic_id=f"eq.{user.id}", select="id", limit=1):
        raise HTTPException(404, "Vehículo no encontrado.")
    return vehicle


def save_vehicle(client, user, data, record_id=None):
    require_role(user, "ADMIN", "CLIENT")
    if user.role == "CLIENT":
        if data.client_id != user.id:
            raise HTTPException(403, "Solo puedes registrar vehículos a tu nombre.")
    else:
        valid_profile(client, data.client_id, "CLIENT")
    payload = data.model_dump(mode="json", exclude_unset=True)
    if record_id:
        existing = get_vehicle(client, user, record_id)
        if existing["client_id"] != str(data.client_id) and rows(client, "work_orders", vehicle_id=f"eq.{record_id}", select="id", limit=1):
            raise HTTPException(409, "No se cambia el propietario de un vehículo con historial.")
        conditions = {"client_id": f"eq.{user.id}"} if user.role == "CLIENT" else {}
        return patch(client, "vehicles", record_id, payload | {"updated_at": datetime.now(timezone.utc).isoformat()}, **conditions)
    return insert(client, "vehicles", payload)


def delete_vehicle(client, user, record_id):
    require_role(user, "ADMIN", "CLIENT")
    get_vehicle(client, user, record_id)
    if rows(client, "work_orders", vehicle_id=f"eq.{record_id}", select="id", limit=1):
        raise HTTPException(409, "Este vehículo tiene órdenes. Se conserva para proteger el historial.")
    conditions = {"client_id": f"eq.{user.id}"} if user.role == "CLIENT" else {}
    call(client, "DELETE", "/rest/v1/vehicles", params={"id": f"eq.{record_id}", **conditions})
