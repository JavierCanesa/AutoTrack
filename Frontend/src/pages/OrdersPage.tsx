import ServiceList from "../components/ServiceList";
import Modal from "../components/Modal";
import { TableSkeleton } from "../components/Skeleton";
import EmptyState from "../components/EmptyState";
import { useEffect, useState, type FormEvent } from "react";
import type { AuthUser } from "../services/authService";
import type { ManagedUser } from "../services/userService";
import {
  getWorkshopServiceTypes,
  type ServiceType,
} from "../services/serviceTypeService";
import {
  api,
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

  async function create(event: FormEvent<HTMLFormElement>) {
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
          <TableSkeleton rows={4} columns={4} />
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

  const hasFilters = !!(
    query ||
    status ||
    activeFilter.brand ||
    activeFilter.mechanic ||
    activeFilter.active
  );

  return (
    <article className="ws-panel">
      <div className="ws-panel-title">
        <h2>{history ? "Historial de servicios" : "Órdenes de trabajo"}</h2>
        {user.role === "ADMIN" && (
          <button
            className="ws-primary"
            disabled={loading || busy}
            onClick={() => {
              setError("");
              setShow(true);
            }}
          >
            Crear orden
          </button>
        )}
      </div>

      {error && !show && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {/* Modal Reutilizable para Nueva Orden de Trabajo */}
      <Modal
        isOpen={show}
        onClose={() => {
          if (!busy) {
            setShow(false);
            setError("");
          }
        }}
        title="Nueva orden de trabajo"
        subtitle="Asigna un vehículo, el tipo de servicio inicial y el mecánico encargado."
        icon={
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
        }
        onSubmit={create}
        primaryLabel="Guardar orden"
        secondaryLabel="Cancelar"
        busy={busy}
        error={error}
      >
        <div className="at-modal-grid-2">
          <div className="at-form-field">
            <label className="at-form-label" htmlFor="order-vehicle">
              Vehículo <span className="at-required-star">*</span>
            </label>
            <select
              id="order-vehicle"
              name="vehicle_id"
              className="at-form-select"
              required
            >
              <option value="">Selecciona un vehículo</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate} · {v.brand} {v.model}
                </option>
              ))}
            </select>
          </div>

          <div className="at-form-field">
            <label className="at-form-label" htmlFor="order-service">
              Servicio <span className="at-required-star">*</span>
            </label>
            <select
              id="order-service"
              name="service_type_id"
              className="at-form-select"
              required
            >
              <option value="">Selecciona un servicio</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="at-form-field">
          <label className="at-form-label" htmlFor="order-mechanic">
            Mecánico asignado
          </label>
          <select
            id="order-mechanic"
            name="mechanic_id"
            className="at-form-select"
          >
            <option value="">Sin asignar (pendiente)</option>
            {mechanics.map((p) => (
              <option key={p.id} value={p.id}>
                {p.first_name} {p.last_name}
              </option>
            ))}
          </select>
        </div>

        <div className="at-form-field">
          <label className="at-form-label" htmlFor="order-desc">
            Descripción / Síntomas reportados
          </label>
          <textarea
            id="order-desc"
            name="description"
            className="at-form-textarea"
            maxLength={4000}
            rows={3}
            placeholder="Describe los detalles iniciales o fallas reportadas por el cliente…"
          />
        </div>
      </Modal>

      {(activeFilter.brand || activeFilter.mechanic || activeFilter.active) && (
        <div className="at-active-filter-strip" role="status">
          <span>
            Filtro activo:{" "}
            {activeFilter.brand ? `Marca ${activeFilter.brand} · ` : ""}
            {activeFilter.mechanic
              ? `Mecánico ${mechanics.find((m) => m.id === activeFilter.mechanic)?.first_name || "seleccionado"} · `
              : ""}
            {activeFilter.active ? "Solo órdenes activas" : ""}
          </span>
          <button
            className="ws-text-button"
            onClick={() => setActiveFilter({})}
          >
            Quitar filtro
          </button>
        </div>
      )}

      <div className="ws-filters">
        <label>
          Buscar
          <div className="at-search-wrap">
            <span className="at-search-icon" aria-hidden="true">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="search"
              className="at-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Placa, vehículo o servicio…"
            />
            {query && (
              <button
                type="button"
                className="at-search-clear"
                aria-label="Limpiar búsqueda"
                onClick={() => setQuery("")}
              >
                ✕
              </button>
            )}
          </div>
        </label>
        {!loading && (
          <span className="at-filter-count">
            {filtered.length} de {orders.length} órdenes
          </span>
        )}
      </div>

      {!loading && orders.length > 0 && (
        <div className="at-status-chips" role="group" aria-label="Filtros rápidos por estado">
          <button
            type="button"
            className={`at-chip ${status === "" ? "is-active" : ""}`}
            onClick={() => setStatus("")}
          >
            Todas <span className="at-chip-count">{orders.length}</span>
          </button>
          {(
            [
              ["RECEIVED", "Recibido"],
              ["DIAGNOSIS", "Diagnóstico"],
              ["WAITING_APPROVAL", "Por autorizar"],
              ["IN_REPAIR", "En reparación"],
              ["TESTING", "En pruebas"],
              ["COMPLETED", "Reparado"],
              ["DELIVERED", "Entregado"],
              ["CANCELLED", "Cancelado"],
            ] as const
          ).map(([key, label]) => {
            const count = orders.filter((o) => o.status === key).length;
            if (!count && status !== key) return null;
            return (
              <button
                key={key}
                type="button"
                className={`at-chip ${status === key ? "is-active" : ""}`}
                onClick={() => setStatus(status === key ? "" : key)}
              >
                {label} <span className="at-chip-count">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={5} columns={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={
            hasFilters
              ? "No hay órdenes que coincidan"
              : "No hay órdenes de trabajo"
          }
          description={
            hasFilters
              ? "Prueba ajustando los filtros de búsqueda o estado para encontrar órdenes."
              : "Aún no se han registrado órdenes de trabajo en el sistema."
          }
          action={
            hasFilters ? (
              <button
                className="ws-secondary"
                onClick={() => {
                  setQuery("");
                  setStatus("");
                  setActiveFilter({});
                }}
              >
                Limpiar filtros
              </button>
            ) : user.role === "ADMIN" ? (
              <button
                className="ws-primary"
                disabled={busy}
                onClick={() => {
                  setError("");
                  setShow(true);
                }}
              >
                Crear primera orden
              </button>
            ) : undefined
          }
        />
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
              {filtered.map((o) => {
                const mechanic = o.mechanic_id
                  ? mechanics.find((m) => m.id === o.mechanic_id)
                  : null;
                return (
                  <tr key={o.id}>
                    <td>
                      <div className="at-order-vehicle-cell">
                        <span className="at-plate-badge">{o.vehicle.plate}</span>
                        <span className="at-order-vehicle-name">
                          {o.vehicle.brand} {o.vehicle.model}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="at-order-service-name">
                        {o.service_type?.name || "Servicio por definir"}
                      </span>
                      {user.role === "ADMIN" && (
                        <small className="at-order-mechanic-sub">
                          {mechanic
                            ? `Mecánico: ${mechanic.first_name} ${mechanic.last_name}`
                            : "Mecánico: Sin asignar"}
                        </small>
                      )}
                    </td>
                    <td>{new Date(o.entry_date).toLocaleDateString("es-SV")}</td>
                    <td>
                      <span className={`ws-badge ws-${o.status.toLowerCase()}`}>
                        {orderLabel(o)}
                      </span>
                    </td>
                    <td>
                      <button
                        className="at-table-action-btn"
                        onClick={() => setSelected(o.id)}
                      >
                        Ver detalle →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="at-panel-footer">
        <button
          className="ws-secondary"
          disabled={busy || loading}
          onClick={() => setReload((n) => n + 1)}
        >
          Actualizar
        </button>
      </div>
    </article>
  );
}
