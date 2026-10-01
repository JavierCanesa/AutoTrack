import httpx
from fastapi import APIRouter, Depends
from FastApi.dependencies import require_admin, workshop_client
from FastApi.schemas.auth import AuthUser
from FastApi.schemas.report import Summary
from FastApi.services.report_service import summary

router = APIRouter(prefix="/api/reports", tags=["Reports"])


@router.get("/summary", response_model=Summary)
def get_summary(user: AuthUser = Depends(require_admin), client: httpx.Client = Depends(workshop_client)):
    return summary(client, user)
