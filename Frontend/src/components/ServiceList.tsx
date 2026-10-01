import { useState } from "react";
import { labels, orderLabel, type Order } from "../services/workshopService";

export const completed = (order: Order) =>
  ["COMPLETED", "DELIVERED"].includes(order.status);
export const closed = (order: Order) =>
  completed(order) || order.status === "CANCELLED";
const localDate = (value: string) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
export default function ServiceList({
  orders,
  history = false,
  initialVehicle = "",
  initialStatus = "",
  onOpen,
  mechanic = false,
  compactOnly = false,
}: {
  orders: Order[];
  history?: boolean;
  initialVehicle?: string;
  onOpen: (id: string) => void;
  mechanic?: boolean;
  initialStatus?: string;
  compactOnly?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [compact, setCompact] = useState(history || compactOnly);
  const [advanced, setAdvanced] = useState(false);
  const [vehicle, setVehicle] = useState(initialVehicle);
  const [service, setService] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const vehicles = Array.from(
    new Map(orders.map((o) => [o.vehicle_id, o.vehicle])).values(),
  );
  const services = Array.from(
    new Map(orders.map((o) => [o.service_type_id, o.service_type])).values(),
  );
  const dateOf = (order: Order) =>
    history ? order.completion_date || order.entry_date : order.entry_date;
  const invalidRange = !!from && !!to && from > to;
  const filtered = orders
    .filter(
      (o) =>
        !invalidRange &&
        (!vehicle || vehicle === o.vehicle_id) &&
        (!service || service === o.service_type_id) &&
        (!status || status === o.status) &&
        (!from || localDate(dateOf(o)) >= from) &&
        (!to || localDate(dateOf(o)) <= to) &&
        `${o.vehicle.plate} ${o.vehicle.brand} ${o.vehicle.model} ${o.service_type?.name || "Servicio por definir"}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort(
      (a, b) => new Date(dateOf(b)).getTime() - new Date(dateOf(a)).getTime(),
    );
  function clear() {
    setQuery("");
    setVehicle("");
    setService("");
    setStatus("");
    setFrom("");
    setTo("");
  }
  return (
    <section
      className="ws-panel role-list"
      aria-label={history ? "Historial filtrable" : "Servicios filtrables"}
    >
      <div className="ws-panel-title">
        <div>
          <h2>
            {history
              ? "Historial por vehículo"
              : mechanic
                ? "Trabajos asignados"
                : "Servicios del taller"}
          </h2>
          <p>
            {history
              ? "Filtra por fecha de finalización; si no existe, se usa la fecha de ingreso."
              : "Abre un servicio para consultar su detalle."}
          </p>
        </div>
        <span className="role-result-count">{filtered.length} resultados</span>
      </div>
      {mechanic && (
        <div className="mechanic-filters">
          <label>
            Buscar un carro
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Escribe la placa, marca o servicio…"
            />
          </label>
          <div
            className="filter-chips"
            aria-label="Filtrar trabajos por estado"
          >
            <button
              className={!status ? "is-selected" : ""}
              aria-pressed={!status}
              onClick={() => setStatus("")}
            >
              Todos ({orders.length})
            </button>
            {Object.entries(labels)
              .filter(([key]) => orders.some((o) => o.status === key))
              .map(([key, label]) => (
                <button
                  key={key}
                  className={status === key ? "is-selected" : ""}
                  aria-pressed={status === key}
                  onClick={() => setStatus(key)}
                >
                  {label} ({orders.filter((o) => o.status === key).length})
                </button>
              ))}
          </div>
          <button
            className="ws-text-button"
            aria-expanded={advanced}
            onClick={() => setAdvanced((value) => !value)}
          >
            {advanced
              ? "Ocultar filtros adicionales"
              : history
                ? "Filtrar por fechas o servicio"
                : "Más filtros"}
          </button>
          {!advanced && (from || to || service || vehicle) && (
            <p>
              Hay filtros adicionales activos. Pulsa «Limpiar filtros» para ver
              todos los trabajos.
            </p>
          )}
        </div>
      )}
      {(!mechanic || advanced) && (
        <div className="role-filters">
          {!mechanic && (
            <label>
              Buscar
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Placa, marca o servicio"
              />
            </label>
          )}
          <label>
            Vehículo
            <select
              aria-label="Filtrar por vehículo"
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
            >
              <option value="">Todos los vehículos</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate} · {v.brand} {v.model}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tipo de servicio
            <select
              aria-label="Filtrar por servicio"
              value={service}
              onChange={(e) => setService(e.target.value)}
            >
              <option value="">Todos los servicios</option>
              {services.map(
                (s) =>
                  s && (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ),
              )}
            </select>
          </label>
          <label>
            Estado
            <select
              aria-label="Filtrar por estado"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Todos los estados</option>
              {Object.entries(labels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Desde
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
      )}
      <div className="list-tools">
        <button className="ws-text-button" onClick={clear}>
          Limpiar filtros
        </button>
        {!compactOnly && (
          <button
            className="ws-secondary"
            aria-pressed={compact}
            onClick={() => setCompact((value) => !value)}
          >
            {compact ? "Ver tarjetas" : "Ver lista compacta"}
          </button>
        )}
      </div>
      {invalidRange && (
        <p role="alert" className="error">
          La fecha inicial debe ser anterior o igual a la final.
        </p>
      )}
      {filtered.length ? (
        <div className={`role-order-grid ${compact ? "compact-orders" : ""}`}>
          {filtered.map((o) => (
            <article className="role-order-card" key={o.id}>
              <div className="role-card-top">
                <span className="role-plate">{o.vehicle.plate}</span>
                <span className={`ws-badge ws-${o.status.toLowerCase()}`}>
                  {orderLabel(o)}
                </span>
              </div>
              <h3>
                {o.vehicle.brand} {o.vehicle.model}
              </h3>
              <p>{o.service_type?.name || "Servicio por definir"}</p>
              <p className="role-order-description">
                {o.description || "Sin observaciones de ingreso."}
              </p>
              <div className="role-card-bottom">
                <small>
                  {history && o.completion_date ? "Finalizado" : "Ingreso"}:{" "}
                  {new Date(dateOf(o)).toLocaleDateString("es-SV")}
                </small>
                <button className="ws-primary" onClick={() => onOpen(o.id)}>
                  {mechanic && !history ? "Abrir trabajo" : "Ver detalle"}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="ws-empty">
          <h3>No hay servicios para mostrar</h3>
          <p>
            {orders.length
              ? "Prueba con otros filtros."
              : history
                ? "Los servicios finalizados aparecerán aquí."
                : "Los servicios aparecerán cuando el taller registre una orden."}
          </p>
        </div>
      )}
    </section>
  );
}
