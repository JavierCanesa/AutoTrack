from uuid import UUID
import httpx
from fastapi import APIRouter, Depends, File, UploadFile, Response
from FastApi.dependencies import current_user, workshop_client
from FastApi.schemas.auth import AuthUser
from FastApi.schemas.work_order import OrderInput, Assignment, DiagnosisInput, PartInput, ProgressInput
from FastApi.schemas.work_order import ReceptionInput, QuoteInput
from FastApi.services import quote_service
from fastapi import Query
from FastApi.services import work_order_service as service

router = APIRouter(prefix="/api/work-orders", tags=["Work orders"])


@router.get("/reception/client")
def reception_client(code: str = Query(pattern="^[A-Za-z0-9]{8}$"), user: AuthUser = Depends(current_user), client: httpx.Client = Depends(workshop_client)):
    return service.find_client(client, user, code.upper())


@router.post("/reception", status_code=201)
def reception(data: ReceptionInput, user: AuthUser = Depends(current_user), client: httpx.Client = Depends(workshop_client)):
    return service.receive(client, user, data)


@router.get("/{order_id}/quotes")
def quotes(order_id: UUID, user: AuthUser = Depends(current_user), client: httpx.Client = Depends(workshop_client)):
    return quote_service.list_quotes(client, user, order_id)


@router.post("/{order_id}/quotes", status_code=201)
def create_quote(order_id: UUID, data: QuoteInput, user: AuthUser = Depends(current_user), client: httpx.Client = Depends(workshop_client)):
    return quote_service.action(client, user, order_id, "CREATE", data=data)


@router.post("/{order_id}/quotes/{quote_id}/{operation}")
def respond_quote(order_id: UUID, quote_id: UUID, operation: str, user: AuthUser = Depends(current_user), client: httpx.Client = Depends(workshop_client)):
    from fastapi import HTTPException
    if operation not in ("send", "accept", "reject"):
        raise HTTPException(404, "Acción no encontrada.")
    return quote_service.action(client, user, order_id, operation.upper(), quote_id)


@router.get("/{order_id}/quotes/{quote_id}/pdf")
def quote_pdf(order_id: UUID, quote_id: UUID, user: AuthUser = Depends(current_user), client: httpx.Client = Depends(workshop_client)):
    return Response(quote_service.pdf(client, user, order_id, quote_id), media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="cotizacion-{quote_id}.pdf"', "Cache-Control": "no-store"})


@router.get("")
def list_orders(user: AuthUser = Depends(current_user), client: httpx.Client = Depends(workshop_client)):
    return service.list_orders(client, user)


@router.post("", status_code=201)
def create_order(data: OrderInput, user: AuthUser = Depends(current_user), client: httpx.Client = Depends(workshop_client)):
    return service.create_order(client, user, data)


@router.get("/{order_id}")
def detail(order_id: UUID, user: AuthUser = Depends(current_user), client: httpx.Client = Depends(workshop_client)):
    return service.detail(client, user, order_id)


@router.patch("/{order_id}/assignment")
def assign(order_id: UUID, data: Assignment, user: AuthUser = Depends(current_user), client: httpx.Client = Depends(workshop_client)):
    return service.assign(client, user, order_id, data)


@router.post("/{order_id}/diagnoses", status_code=201)
def diagnosis(order_id: UUID, data: DiagnosisInput, user: AuthUser = Depends(current_user), client: httpx.Client = Depends(workshop_client)):
    return service.add_diagnosis(client, user, order_id, data)


@router.post("/{order_id}/parts", status_code=201)
def part(order_id: UUID, data: PartInput, user: AuthUser = Depends(current_user), client: httpx.Client = Depends(workshop_client)):
    return service.add_part(client, user, order_id, data)


@router.post("/{order_id}/updates", status_code=201)
def progress(order_id: UUID, data: ProgressInput, user: AuthUser = Depends(current_user), client: httpx.Client = Depends(workshop_client)):
    return service.add_progress(client, user, order_id, data)


@router.post("/{order_id}/updates/{update_id}/photos", status_code=201)
def upload(order_id: UUID, update_id: UUID, file: UploadFile = File(...), user: AuthUser = Depends(current_user), client: httpx.Client = Depends(workshop_client)):
    return service.upload_photo(client, user, order_id, update_id, file.filename, file.file.read(5 * 1024 * 1024 + 1))


@router.get("/{order_id}/photos/{photo_id}")
def photo(order_id: UUID, photo_id: UUID, user: AuthUser = Depends(current_user), client: httpx.Client = Depends(workshop_client)):
    content, mime = service.download_photo(client, user, order_id, photo_id)
    return Response(content, media_type=mime, headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})
