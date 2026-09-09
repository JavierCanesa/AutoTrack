from supabase import Client


def get_service_types(supabase: Client) -> list[dict]:
    response = (
        supabase.schema("public")
        .table("service_types")
        .select("id,name,description,created_at")
        .order("name")
        .execute()
    )
    return response.data
