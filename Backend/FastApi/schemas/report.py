from pydantic import BaseModel


class Summary(BaseModel):
    total_orders: int
    active_orders: int
    total_vehicles: int
    by_status: dict[str, int]
    by_mechanic: list[dict]
    total_clients: int
    total_mechanics: int
    pending_quotes: int
    unassigned_orders: int
    by_brand: dict[str, int]
