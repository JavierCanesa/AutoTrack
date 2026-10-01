from supabase import Client
from FastApi.db.access import all_rows
from FastApi.services.vehicle_service import require_role


def get_workshop_service_types(client, user):
    require_role(user, "ADMIN", "MECHANIC")
    return all_rows(client, "service_types", select="id,name,description,created_at", order="name.asc,id.asc")


def get_service_types(supabase: Client) -> list[dict]:
    response = (
        supabase.schema("public")
        .table("service_types")
        .select("id,name,description,created_at")
        .order("name")
        .execute()
    )
    return response.data
