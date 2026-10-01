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

export default function WorkflowPage({ user }: { user: AuthUser }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [mechanics, setMechanics] = useState<ManagedUser[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
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
  const filtered = orders.filter((o) =>
    `${o.vehicle.plate} ${o.vehicle.brand} ${o.service_type?.name || "Servicio por definir"}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
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
        </div>
        <button
          className="ws-secondary"
          onClick={() => setReload((n) => n + 1)}
        >
          Actualizar
        </button>
      </div>
      <p>
        {user.role === "ADMIN"
          ? "Abre una orden para preparar el presupuesto, enviar una versión y consultar la respuesta del cliente."
          : "Consulta el detalle, descarga el PDF y acepta o rechaza la cotización de tu vehículo."}
      </p>
      <label className="hub-search">
        Buscar vehículo o servicio
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Placa, marca o servicio…"
        />
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Cargando servicios…</p>
      ) : (
        !error && (
          <div className="hub-rows">
            {filtered.map((o) => (
              <article className="hub-row" key={o.id}>
                <span className="role-plate">{o.vehicle.plate}</span>
                <div>
                  <strong>
                    {o.vehicle.brand} {o.vehicle.model}
                  </strong>
                  <small>
                    {o.service_type?.name || "Servicio por definir"}
                  </small>
                </div>
                <span className={`ws-badge ws-${o.status.toLowerCase()}`}>
                  {orderLabel(o)}
                </span>
                <button
                  className="ws-secondary"
                  onClick={() => setSelected(o.id)}
                >
                  Ver cotización
                </button>
              </article>
            ))}
            {!filtered.length && (
              <p className="ws-empty">No hay servicios para mostrar.</p>
            )}
          </div>
        )
      )}
    </section>
  );
}
