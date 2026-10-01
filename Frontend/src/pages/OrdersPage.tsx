import ServiceList from "../components/ServiceList";
import { useEffect, useState, type SubmitEvent } from "react";
import type { AuthUser } from "../services/authService";
import type { ManagedUser } from "../services/userService";
import {
  getWorkshopServiceTypes,
  type ServiceType,
} from "../services/serviceTypeService";
import {
  api,
  labels,
  orderLabel,
  people,
  type Order,
  type Vehicle,
} from "../services/workshopService";
import OrderDetail from "./OrderDetail";
import { optionalText } from "../validation";

export default function OrdersPage({
  user,
  history,
  initialVehicle = "",
  filter = {},
}: {
  user: AuthUser;
  history: boolean;
  initialVehicle?: string;
  filter?: {
    status?: string;
    brand?: string;
    mechanic?: string;
    active?: boolean;
  };
}) {
  const [activeFilter, setActiveFilter] = useState(filter);
  const [orders, setOrders] = useState<Order[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [mechanics, setMechanics] = useState<ManagedUser[]>([]);
  const [services, setServices] = useState<ServiceType[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(filter.status || "");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      api<Order[]>("/work-orders"),
      user.role === "ADMIN" ? api<Vehicle[]>("/vehicles") : Promise.resolve([]),
      user.role === "ADMIN" ? people() : Promise.resolve([]),
      user.role === "ADMIN" ? getWorkshopServiceTypes() : Promise.resolve([]),
    ])
      .then(([o, v, p, s]) => {
        if (active) {
          setOrders(o);
          setVehicles(v);
          setMechanics(p.filter((person) => person.role === "MECHANIC"));
          setServices(s);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload, user.role]);
  async function create(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const order = await api<Order>("/work-orders", "POST", {
        vehicle_id: form.get("vehicle_id"),
        service_type_id: form.get("service_type_id"),
        mechanic_id: form.get("mechanic_id") || null,
        description: optionalText(form.get("description")),
      });
      setShow(false);
      setSelected(order.id);
      setReload((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear.");
    } finally {
      setBusy(false);
    }
  }
  if (selected)
    return (
      <OrderDetail
        orderId={selected}
        user={user}
        mechanics={mechanics}
        onBack={() => {
          setSelected(null);
          setReload((n) => n + 1);
        }}
      />
    );
  if (history)
    return (
      <>
        <button
          className="ws-secondary"
          onClick={() => setReload((n) => n + 1)}
        >
          Actualizar historial
        </button>
        {error && <p role="alert">{error}</p>}
        {loading ? (
          <p>Cargando historial…</p>
        ) : (
          <ServiceList
            orders={orders.filter((o) =>
              ["COMPLETED", "DELIVERED", "CANCELLED"].includes(o.status),
            )}
            history
            initialVehicle={initialVehicle}
            onOpen={setSelected}
          />
        )}
      </>
    );
  const filtered = orders.filter(
    (o) =>
      (!history ||
        ["COMPLETED", "DELIVERED", "CANCELLED"].includes(o.status)) &&
      (!status || o.status === status) &&
      (!activeFilter.brand ||
        (o.vehicle.brand === activeFilter.brand &&
          !["DELIVERED", "CANCELLED"].includes(o.status))) &&
      (!activeFilter.mechanic || o.mechanic_id === activeFilter.mechanic) &&
      (!activeFilter.active ||
        !["COMPLETED", "DELIVERED", "CANCELLED"].includes(o.status)) &&
      `${o.vehicle.plate} ${o.vehicle.brand} ${o.vehicle.model} ${o.service_type?.name || "Servicio por definir"}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <article className="ws-panel">
      <div className="ws-panel-title">
        <h2>{history ? "Historial de servicios" : "Órdenes de trabajo"}</h2>
        {user.role === "ADMIN" && (
          <button
            className="ws-primary"
            disabled={loading || busy}
            onClick={() => setShow(true)}
          >
            Crear orden
          </button>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {show && (
        <form onSubmit={create} className="ws-progress">
          <h3>Nueva orden</h3>
          <fieldset disabled={busy}>
            <label>
              Vehículo
              <select name="vehicle_id" required>
                <option value="">Selecciona un vehículo</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate} · {v.brand} {v.model}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Servicio
              <select name="service_type_id" required>
                <option value="">Selecciona un servicio</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Mecánico
              <select name="mechanic_id">
                <option value="">Sin asignar</option>
                {mechanics.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.first_name} {p.last_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Descripción
              <textarea name="description" maxLength={4000} rows={3} />
            </label>
            <div className="ws-actions">
              <button className="ws-primary" type="submit">
                {busy ? "Guardando…" : "Guardar orden"}
              </button>
              <button
                className="ws-secondary"
                type="button"
                onClick={() => setShow(false)}
              >
                Cancelar
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {(activeFilter.brand || activeFilter.mechanic || activeFilter.active) && (
        <p role="status">
          {activeFilter.brand ? `Marca: ${activeFilter.brand}. ` : ""}
          {activeFilter.mechanic
            ? `Mecánico: ${mechanics.find((m) => m.id === activeFilter.mechanic)?.first_name || "seleccionado"}. `
            : ""}
          {activeFilter.active ? "Solo órdenes activas. " : ""}
          <button
            className="ws-text-button"
            onClick={() => setActiveFilter({})}
          >
            Quitar filtro del resumen
          </button>
        </p>
      )}
      <div className="ws-filters">
        <label>
          Buscar
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Placa, vehículo o servicio"
          />
        </label>
        <label>
          Estado
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(labels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {loading ? (
        <p role="status">Cargando órdenes…</p>
      ) : (
        <div className="ws-table-wrap">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Vehículo</th>
                <th>Servicio</th>
                <th>Ingreso</th>
                <th>Estado</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id}>
                  <td>
                    <strong>
                      {o.vehicle.brand} {o.vehicle.model}
                    </strong>
                    <small>{o.vehicle.plate}</small>
                  </td>
                  <td>{o.service_type?.name || "Servicio por definir"}</td>
                  <td>{new Date(o.entry_date).toLocaleDateString("es-SV")}</td>
                  <td>
                    <span className={`ws-badge ws-${o.status.toLowerCase()}`}>
                      {orderLabel(o)}
                    </span>
                  </td>
                  <td>
                    <button
                      className="ws-text-button"
                      onClick={() => setSelected(o.id)}
                    >
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && !filtered.length && <p>No hay órdenes para mostrar.</p>}
      <button
        className="ws-secondary"
        disabled={busy || loading}
        onClick={() => setReload((n) => n + 1)}
      >
        Actualizar
      </button>
    </article>
  );
}
