from uuid import UUID
import httpx
from fastapi import APIRouter, Depends
from FastApi.dependencies import current_user, workshop_client
from FastApi.schemas.auth import AuthUser
from FastApi.schemas.vehicle import VehicleInput
from FastApi.services import vehicle_service as service

router = APIRouter(prefix="/api/vehicles", tags=["Vehicles"])


@router.get("")
def list_vehicles(user: AuthUser = Depends(current_user), client: httpx.Client = Depends(workshop_client)):
    return service.list_vehicles(client, user)


@router.get("/{vehicle_id}")
def get_vehicle(vehicle_id: UUID, user: AuthUser = Depends(current_user), client: httpx.Client = Depends(workshop_client)):
    return service.get_vehicle(client, user, vehicle_id)


@router.post("", status_code=201)
def create_vehicle(data: VehicleInput, user: AuthUser = Depends(current_user), client: httpx.Client = Depends(workshop_client)):
    return service.save_vehicle(client, user, data)


@router.put("/{vehicle_id}")
def edit_vehicle(vehicle_id: UUID, data: VehicleInput, user: AuthUser = Depends(current_user), client: httpx.Client = Depends(workshop_client)):
    return service.save_vehicle(client, user, data, vehicle_id)


@router.delete("/{vehicle_id}", status_code=204)
def delete_vehicle(vehicle_id: UUID, user: AuthUser = Depends(current_user), client: httpx.Client = Depends(workshop_client)):
    service.delete_vehicle(client, user, vehicle_id)
