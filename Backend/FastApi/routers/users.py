from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, Query, Response

from FastApi.dependencies import require_admin
from FastApi.schemas.auth import AuthUser
from FastApi.schemas.user import UserCreate, UserList, UserProfileInput, UserView
from FastApi.services import user_service

router = APIRouter(prefix="/api/users", tags=["Users"], dependencies=[Depends(require_admin)])


@router.get("", response_model=UserList)
def list_users(page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
               client: httpx.Client = Depends(user_service.admin_client)):
    return UserList(users=user_service.list_users(client, page, per_page), page=page, per_page=per_page)


@router.get("/{user_id}", response_model=UserView)
def get_user(user_id: UUID, client: httpx.Client = Depends(user_service.admin_client)):
    return user_service.get_user_view(client, user_id)


@router.post("", response_model=UserView, status_code=201)
def create_user(data: UserCreate, client: httpx.Client = Depends(user_service.admin_client)):
    return user_service.create_user(client, data)


@router.put("/{user_id}", response_model=UserView)
def update_user(user_id: UUID, data: UserProfileInput, client: httpx.Client = Depends(user_service.admin_client)):
    return user_service.update_user(client, user_id, data)


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: UUID, actor: AuthUser = Depends(require_admin),
                client: httpx.Client = Depends(user_service.admin_client)):
    user_service.delete_user(client, user_id, actor.id)
    return Response(status_code=204)
