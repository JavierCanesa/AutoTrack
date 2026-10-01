"""Órdenes y su historial. Toda lectura y escritura comprueba dueño o asignación."""
from datetime import datetime, timezone
from uuid import uuid4
from urllib.parse import quote
import re

from fastapi import HTTPException
from FastApi.db.access import all_rows, call, insert, one, patch, rows
from FastApi.db.config import get_settings
from FastApi.services.vehicle_service import require_role, valid_profile

TRANSITIONS = {
    "RECEIVED": {"DIAGNOSIS", "CANCELLED"},
    "DIAGNOSIS": {"WAITING_APPROVAL", "CANCELLED"},
    "WAITING_APPROVAL": {"IN_REPAIR", "CANCELLED"},
    "IN_REPAIR": {"TESTING", "CANCELLED"},
    "TESTING": {"IN_REPAIR", "COMPLETED", "CANCELLED"},
    "COMPLETED": {"DELIVERED"}, "DELIVERED": set(), "CANCELLED": set(),
}
ORDER_SELECT = "*,vehicle:vehicles(*),service_type:service_types(id,name)"


def list_orders(client, user):
    params = {"select": ORDER_SELECT, "order": "entry_date.desc,id.asc"}
    if user.role == "MECHANIC":
        params["mechanic_id"] = f"eq.{user.id}"
    if user.role == "CLIENT":
        params["select"] = ORDER_SELECT.replace("vehicles(*)", "vehicles!inner(*)")
        params["vehicle.client_id"] = f"eq.{user.id}"
    orders = all_rows(client, "work_orders", **params)
    for order in orders:
        if order["status"] == "WAITING_APPROVAL":
            latest = rows(client, "quotes", work_order_id=f"eq.{order['id']}", order="version.desc", limit=1)
            order["quote_status"] = latest[0]["status"] if latest else None
    return orders


def authorized_order(client, user, order_id, write=False):
    order = one(client, "work_orders", order_id, ORDER_SELECT)
    if user.role == "CLIENT" and (write or order["vehicle"]["client_id"] != str(user.id)):
        raise HTTPException(404, "Orden no encontrada.")
    if user.role == "MECHANIC" and order["mechanic_id"] != str(user.id):
        raise HTTPException(404, "Orden no encontrada.")
    if write and order["status"] in ("DELIVERED", "CANCELLED"):
        raise HTTPException(409, "Esta orden está cerrada; se conserva su historial.")
    return order


def detail(client, user, order_id):
    order = authorized_order(client, user, order_id)
    result = dict(order)
    result["client"] = one(client, "profiles", order["vehicle"]["client_id"], "id,first_name,last_name,client_code")
    quotes = rows(client, "quotes", work_order_id=f"eq.{order_id}", order="version.desc", limit=1)
    result["quote_status"] = quotes[0]["status"] if quotes else None
    for key, table in [("diagnoses", "diagnoses"), ("parts", "work_order_parts"), ("updates", "service_updates")]:
        result[key] = all_rows(client, table, work_order_id=f"eq.{order_id}", order="created_at.asc,id.asc")
    result["photos"] = all_rows(client, "evidence_photos", select="*,service_update:service_updates!inner(work_order_id)",
                               **{"service_update.work_order_id": f"eq.{order_id}", "order": "created_at.asc,id.asc"})
    result["allowed_statuses"] = sorted(TRANSITIONS[order["status"]])
    return result


def create_order(client, user, data):
    require_role(user, "ADMIN")
    one(client, "vehicles", data.vehicle_id)
    one(client, "service_types", data.service_type_id)
    if data.mechanic_id:
        valid_profile(client, data.mechanic_id, "MECHANIC")
    return insert(client, "work_orders", data.model_dump(mode="json") | {"status": "RECEIVED"})


def find_client(client, user, code):
    require_role(user, "MECHANIC", "ADMIN")
    found = rows(client, "profiles", client_code=f"eq.{code}", role="eq.CLIENT",
                 select="id,first_name,last_name,client_code", limit=1)
    if not found:
        raise HTTPException(404, "No existe un cliente con ese código.")
    profile = found[0]
    valid_profile(client, profile["id"], "CLIENT")
    open_orders = all_rows(client, "work_orders", select="id,vehicle_id,mechanic_id,status,vehicle:vehicles!inner(client_id)",
        **{"vehicle.client_id": f"eq.{profile['id']}", "status": "not.in.(DELIVERED,CANCELLED)", "order": "entry_date.desc"})
    return {"profile": profile, "vehicles": all_rows(client, "vehicles", client_id=f"eq.{profile['id']}", order="plate.asc"),
            "open_orders": open_orders}


def receive(client, user, data):
    require_role(user, "MECHANIC")
    found = find_client(client, user, data.client_code)
    if data.new_vehicle and str(data.new_vehicle.client_id) != found["profile"]["id"]:
        raise HTTPException(403, "El vehículo debe pertenecer al cliente indicado.")
    if data.service_type_id:
        one(client, "service_types", data.service_type_id)
    result = call(client, "POST", "/rest/v1/rpc/receive_vehicle", json={
        "p_actor": str(user.id), "p_code": data.client_code,
        "p_vehicle": str(data.vehicle_id) if data.vehicle_id else None,
        "p_new_vehicle": data.new_vehicle.model_dump(mode="json") if data.new_vehicle else None,
        "p_service": str(data.service_type_id) if data.service_type_id else None, "p_description": data.description,
    }).json()
    return result[0] if isinstance(result, list) else result


def assign(client, user, order_id, data):
    require_role(user, "ADMIN")
    order = authorized_order(client, user, order_id, write=True)
    if data.mechanic_id:
        valid_profile(client, data.mechanic_id, "MECHANIC")
    return patch(client, "work_orders", order_id, data.model_dump(mode="json") | {"updated_at": datetime.now(timezone.utc).isoformat()}, updated_at=f"eq.{order['updated_at']}")


def mechanic_for(order):
    if not order["mechanic_id"]:
        raise HTTPException(409, "Asigna un mecánico antes de registrar el trabajo.")
    return order["mechanic_id"]


def diagnosis_order(client, user, order_id):
    require_role(user, "MECHANIC")
    order = authorized_order(client, user, order_id, write=True)
    if order["status"] != "DIAGNOSIS":
        raise HTTPException(409, "El diagnóstico y las piezas se registran en la etapa de diagnóstico.")
    return order


def add_diagnosis(client, user, order_id, data):
    require_role(user, "MECHANIC")
    order = diagnosis_order(client, user, order_id)
    service_id = data.service_type_id or order.get("service_type_id")
    if not service_id:
        raise HTTPException(422, "Selecciona el servicio al registrar el diagnóstico.")
    one(client, "service_types", service_id)
    if str(service_id) != order.get("service_type_id"):
        patch(client, "work_orders", order_id, {"service_type_id": str(service_id)})
    return insert(client, "diagnoses", data.model_dump(exclude={"service_type_id"}) | {"work_order_id": str(order_id), "mechanic_id": mechanic_for(order)})


def add_part(client, user, order_id, data):
    require_role(user, "MECHANIC")
    diagnosis_order(client, user, order_id)
    return insert(client, "work_order_parts", data.model_dump() | {"work_order_id": str(order_id)})


def add_progress(client, user, order_id, data):
    order = authorized_order(client, user, order_id, write=True)
    if user.role == "ADMIN" and data.status not in ("DELIVERED", "CANCELLED"):
        raise HTTPException(403, "El administrador solo entrega o cancela; el mecánico registra el trabajo.")
    if user.role == "MECHANIC" and data.status in ("DELIVERED", "CANCELLED"):
        raise HTTPException(403, "Solo el administrador entrega o cancela una orden.")
    if data.status != order["status"] and data.status not in TRANSITIONS[order["status"]]:
        raise HTTPException(409, "Transición de estado no permitida.")
    if data.status == "IN_REPAIR":
        latest = rows(client, "quotes", work_order_id=f"eq.{order_id}", order="version.desc", limit=1)
        if not latest or latest[0]["status"] != "ACCEPTED":
            raise HTTPException(409, "El cliente debe aceptar la cotización vigente antes de reparar.")
    comment = data.comment
    if user.role == "MECHANIC":
        if order["status"] in ("RECEIVED", "DIAGNOSIS") and data.status == "DIAGNOSIS":
            comment = "Síntomas reportados: " + comment
        if data.status == "WAITING_APPROVAL":
            if not rows(client, "diagnoses", work_order_id=f"eq.{order_id}", limit=1):
                raise HTTPException(409, "Registra las fallas encontradas antes de solicitar la cotización.")
            evidence = rows(client, "evidence_photos", select="id,service_update:service_updates!inner(work_order_id)",
                            **{"service_update.work_order_id": f"eq.{order_id}", "limit": 1})
            if not evidence:
                raise HTTPException(409, "Adjunta una fotografía del diagnóstico antes de solicitar la cotización.")
        if data.status == "TESTING":
            quotes = rows(client, "quotes", work_order_id=f"eq.{order_id}", order="version.desc", limit=1)
            if not quotes or quotes[0]["status"] != "ACCEPTED":
                raise HTTPException(409, "No hay una cotización aceptada para comprobar la reparación.")
            items = quotes[0]["items"]
            required = {i for i, item in enumerate(items) if item["kind"] == "PART"}
            if set(data.completed_items) != required:
                raise HTTPException(422, "Confirma el trabajo realizado en cada pieza de la cotización aceptada.")
            names = "; ".join(items[i]["description"] for i in sorted(required))
            comment = f"Reparación realizada. Piezas: {names or 'Sin piezas cotizadas'}. Trabajo: {comment}"
    result = call(client, "POST", "/rest/v1/rpc/record_progress", json={
        "p_actor": str(user.id), "p_order": str(order_id), "p_status": data.status.value,
        "p_comment": comment, "p_expected": order["status"],
    }).json()
    return result


def upload_photo(client, user, order_id, update_id, filename, content):
    require_role(user, "MECHANIC")
    diagnosis_order(client, user, order_id)
    update = one(client, "service_updates", update_id)
    if update["work_order_id"] != str(order_id):
        raise HTTPException(404, "Avance no encontrado en esta orden.")
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(413, "La fotografía debe pesar como máximo 5 MB.")
    if content.startswith(b"\xff\xd8\xff"):
        mime, ext = "image/jpeg", "jpg"
    elif content.startswith(b"\x89PNG\r\n\x1a\n"):
        mime, ext = "image/png", "png"
    elif content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        mime, ext = "image/webp", "webp"
    else:
        raise HTTPException(422, "Selecciona una fotografía JPEG, PNG o WebP.")
    bucket = quote(get_settings().evidence_bucket, safe="")
    try:
        bucket_info = call(client, "GET", f"/storage/v1/bucket/{bucket}").json()
    except HTTPException as exc:
        if exc.status_code in (404, 409):
            raise HTTPException(503, "Crea un bucket privado en Supabase Storage con el nombre configurado en EVIDENCE_BUCKET (por defecto evidence).") from None
        raise
    if bucket_info.get("public"):
        raise HTTPException(409, "Configura el bucket de evidencias como privado antes de subir fotografías.")
    path = f"{order_id}/{update_id}/{uuid4()}.{ext}"
    call(client, "POST", f"/storage/v1/object/{bucket}/{path}", content=content, headers={"Content-Type": mime, "x-upsert": "false"})
    safe_name = (filename or f"foto.{ext}").replace("\\", "/").rsplit("/", 1)[-1]
    safe_name = re.sub(r"[\x00-\x1f\x7f]", "", safe_name).strip()[:200] or f"foto.{ext}"
    try:
        return insert(client, "evidence_photos", {"service_update_id": str(update_id), "uploaded_by": str(user.id),
                                                  "storage_path": path, "file_name": safe_name, "mime_type": mime})
    except HTTPException:
        # No borrar ante una respuesta incierta: la fila podría haberse guardado.
        raise HTTPException(409, "La foto se subió, pero no se confirmó su registro. Actualiza el detalle antes de reintentar.") from None


def download_photo(client, user, order_id, photo_id):
    authorized_order(client, user, order_id)
    photo = one(client, "evidence_photos", photo_id)
    update = one(client, "service_updates", photo["service_update_id"])
    if update["work_order_id"] != str(order_id):
        raise HTTPException(404, "Fotografía no encontrada en esta orden.")
    path = photo["storage_path"]
    if ".." in path.split("/") or path.startswith("/"):
        raise HTTPException(409, "Ruta de fotografía inválida.")
    bucket = quote(get_settings().evidence_bucket, safe="")
    result = call(client, "GET", f"/storage/v1/object/authenticated/{bucket}/{quote(path, safe='/')}")
    return result.content, photo["mime_type"] if photo["mime_type"] in ("image/png", "image/jpeg", "image/webp") else "application/octet-stream"
