import { useEffect, useState } from "react";
import type { AuthUser } from "../services/authService";
import {
  api,
  orderLabel,
  people,
  type Order,
} from "../services/workshopService";
import type { ManagedUser } from "../services/userService";
import OrderDetail from "./OrderDetail";
import { TableSkeleton } from "../components/Skeleton";
import EmptyState from "../components/EmptyState";

export default function WorkflowPage({ user }: { user: AuthUser }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [mechanics, setMechanics] = useState<ManagedUser[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      api<Order[]>("/work-orders"),
      user.role === "ADMIN" ? people() : Promise.resolve([]),
    ])
      .then(([o, p]) => {
        if (active) {
          setOrders(o);
          setMechanics(p.filter((person) => person.role === "MECHANIC"));
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
  }, [user.role, reload, selected]);

  if (selected)
    return (
      <OrderDetail
        orderId={selected}
        user={user}
        mechanics={mechanics}
        initialTab="quotes"
        onBack={() => setSelected(null)}
      />
    );

  const filtered = orders.filter((o) => {
    const matchesStatus = !statusFilter || o.status === statusFilter;
    const matchesQuery =
      `${o.vehicle.plate} ${o.vehicle.brand} ${o.vehicle.model} ${o.service_type?.name || "Servicio por definir"}`
        .toLowerCase()
        .includes(query.toLowerCase());
    return matchesStatus && matchesQuery;
  });

  const hasFilters = !!(query || statusFilter);

  return (
    <section className="ws-panel">
      <div className="ws-panel-title">
        <div>
          <p className="ws-overline">AUTORIZACIÓN DEL SERVICIO</p>
          <h2>
            {user.role === "ADMIN"
              ? "Del diagnóstico a la aprobación"
              : "Revisa antes de autorizar"}
          </h2>
          <p>
            {user.role === "ADMIN"
              ? "Abre una orden para preparar el presupuesto, enviar una versión y consultar la respuesta del cliente."
              : "Consulta el detalle, descarga el PDF y acepta o rechaza la cotización de tu vehículo."}
          </p>
        </div>
        <button
          className="ws-secondary"
          disabled={loading}
          onClick={() => setReload((n) => n + 1)}
        >
          Actualizar
        </button>
      </div>

      <div className="ws-filters">
        <label>
          Buscar vehículo o servicio
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
              placeholder="Placa, marca, modelo o servicio…"
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
            {filtered.length} de {orders.length} servicios
          </span>
        )}
      </div>

      {!loading && orders.length > 0 && (
        <div
          className="at-status-chips"
          role="group"
          aria-label="Filtros rápidos de cotizaciones"
        >
          <button
            type="button"
            className={`at-chip ${statusFilter === "" ? "is-active" : ""}`}
            onClick={() => setStatusFilter("")}
          >
            Todos <span className="at-chip-count">{orders.length}</span>
          </button>
          {(
            [
              ["WAITING_APPROVAL", "Por autorizar"],
              ["DIAGNOSIS", "En diagnóstico"],
              ["IN_REPAIR", "En reparación"],
              ["COMPLETED", "Reparado"],
            ] as const
          ).map(([key, label]) => {
            const count = orders.filter((o) => o.status === key).length;
            if (!count && statusFilter !== key) return null;
            return (
              <button
                key={key}
                type="button"
                className={`at-chip ${statusFilter === key ? "is-active" : ""}`}
                onClick={() =>
                  setStatusFilter(statusFilter === key ? "" : key)
                }
              >
                {label} <span className="at-chip-count">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {loading ? (
        <TableSkeleton rows={4} columns={4} />
      ) : (
        !error &&
        (filtered.length === 0 ? (
          <EmptyState
            title={
              hasFilters
                ? "Sin cotizaciones que coincidan"
                : "No hay servicios disponibles"
            }
            description={
              hasFilters
                ? "Prueba ajustando tu búsqueda o quitando el filtro de estado."
                : "Cuando existan órdenes registradas aparecerán aquí para gestionar su cotización."
            }
            action={
              hasFilters ? (
                <button
                  className="ws-secondary"
                  onClick={() => {
                    setQuery("");
                    setStatusFilter("");
                  }}
                >
                  Limpiar filtros
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
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <div className="at-order-vehicle-cell">
                        <span className="at-plate-badge">
                          {o.vehicle.plate}
                        </span>
                        <span className="at-order-vehicle-name">
                          {o.vehicle.brand} {o.vehicle.model}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="at-order-service-name">
                        {o.service_type?.name || "Servicio por definir"}
                      </span>
                    </td>
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
                        Ver cotización →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </section>
  );
}
