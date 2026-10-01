from collections import Counter
from FastApi.db.access import all_rows
from FastApi.services.vehicle_service import require_role


def summary(client, user):
    require_role(user, "ADMIN")
    orders = all_rows(client, "work_orders", select="id,status,mechanic_id,vehicle_id", order="id.asc")
    vehicles = all_rows(client, "vehicles", select="id,brand", order="id.asc")
    mechanics = all_rows(client, "profiles", select="id,first_name,last_name", role="eq.MECHANIC", order="id.asc")
    active = [order for order in orders if order["status"] not in ("COMPLETED", "DELIVERED", "CANCELLED")]
    workload = Counter(order["mechanic_id"] for order in active)
    customers = all_rows(client, "profiles", select="id", role="eq.CLIENT", order="id.asc")
    quotes = all_rows(client, "quotes", select="id,status", status="eq.SENT", order="id.asc")
    in_shop = {o.get("vehicle_id") for o in orders if o["status"] not in ("DELIVERED", "CANCELLED")}
    return {"total_orders": len(orders), "active_orders": len(active), "total_vehicles": len(vehicles),
            "total_clients": len(customers), "total_mechanics": len(mechanics),
            "pending_quotes": len(quotes), "unassigned_orders": workload[None],
            "by_brand": dict(Counter(v.get("brand", "Sin marca") for v in vehicles if v["id"] in in_shop)),
            "by_status": dict(Counter(order["status"] for order in orders)),
            "by_mechanic": [{**mechanic, "active_orders": workload[mechanic["id"]]} for mechanic in mechanics]}
