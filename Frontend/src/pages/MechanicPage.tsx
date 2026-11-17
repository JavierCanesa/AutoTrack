import WorkflowGuide from "../components/WorkflowGuide";
import { useEffect, useState } from "react";
import type { AuthUser } from "../services/authService";
import { api, labels, type Order } from "../services/workshopService";
import ServiceList, { closed } from "../components/ServiceList";
import OrderDetail from "./OrderDetail";
import ReceptionPage from "./ReceptionPage";
import { CardGridSkeleton, TableSkeleton } from "../components/Skeleton";
import EmptyState from "../components/EmptyState";

export default function MechanicPage({
  user,
  page,
  navigation,
  onNavigate,
}: {
  user: AuthUser;
  page: string;
  navigation: number;
  onNavigate: (page: string) => void;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    setStatusFilter("");
  }, [page, navigation]);

  const [detailTab, setDetailTab] = useState("diagnoses");

  useEffect(() => {
    setSelected(null);
  }, [page, navigation]);

  useEffect(() => {
    let disposed = false;
    if (selected) return;
    setLoading(true);
    setError("");
    api<Order[]>("/work-orders")
      .then((result) => {
        if (!disposed) setOrders(result);
      })
      .catch((e) => {
        if (!disposed) setError(e.message);
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [reload, selected, user.id]);

  if (selected)
    return (
      <OrderDetail
        key={selected}
        orderId={selected}
        user={user}
        mechanics={[]}
        initialTab={detailTab}
        onBack={() => setSelected(null)}
      />
    );

  if (page === "Recibir vehículo")
    return (
      <ReceptionPage
        mechanicId={user.id}
        onBack={() => {
          onNavigate("Mi jornada");
        }}
        onReceived={(id) => {
          setDetailTab("diagnoses");
          setSelected(id);
        }}
      />
    );

  const history = page === "Historial de trabajos";
  const active = orders.filter((o) => !closed(o));
  const initials =
    `${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}`.toUpperCase() ||
    "M";

  return (
    <div className="role-portal">
      <div className="at-mechanic-welcome">
        <div className="at-mechanic-welcome-left">
          <div className="at-mechanic-welcome-avatar" aria-hidden="true">
            {initials}
          </div>
          <div>
            <p className="ws-overline">ÁREA DE MECÁNICA</p>
            <h2>Hola, {user.first_name}</h2>
            <p>
              {history
                ? "Consulta el historial completo de tus trabajos finalizados."
                : "Tus órdenes asignadas, el diagnóstico y cada avance en un solo lugar."}
            </p>
          </div>
        </div>
        <button
          className="ws-primary"
          disabled={loading}
          onClick={() => setReload((n) => n + 1)}
        >
          {loading ? "Actualizando…" : "Actualizar trabajos"}
        </button>
      </div>

      {error && (
        <article className="ws-panel">
          <EmptyState
            title="No se pudieron cargar tus trabajos"
            description={error}
            action={
              <button
                className="ws-primary"
                onClick={() => setReload((n) => n + 1)}
              >
                Reintentar
              </button>
            }
          />
        </article>
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <CardGridSkeleton count={4} />
          <TableSkeleton rows={4} columns={3} />
        </div>
      ) : (
        !error && (
          <>
            {!history && (
              <div className="at-mechanic-stats">
                {[
                  "RECEIVED",
                  "DIAGNOSIS",
                  "WAITING_APPROVAL",
                  "IN_REPAIR",
                  "TESTING",
                ].map((status) => {
                  const count = active.filter((o) => o.status === status).length;
                  const isActive = statusFilter === status;
                  return (
                    <button
                      className={`at-mechanic-stat ${isActive ? "is-active" : ""}`}
                      key={status}
                      aria-pressed={isActive}
                      onClick={() =>
                        setStatusFilter(isActive ? "" : status)
                      }
                    >
                      <span className="at-mechanic-stat-label">
                        {labels[status as keyof typeof labels]}
                      </span>
                      <strong className="at-mechanic-stat-value">
                        {count}
                      </strong>
                      <span className="at-mechanic-stat-hint">
                        {isActive ? "Filtro activo ✕" : "Filtrar vehículos →"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {page === "Mi jornada" && <WorkflowGuide />}
            <ServiceList
              key={`${page}-${statusFilter}`}
              initialStatus={statusFilter}
              orders={history ? orders.filter(closed) : active}
              history={history}
              mechanic
              onOpen={(id) => {
                setDetailTab("diagnoses");
                setSelected(id);
              }}
            />
          </>
        )
      )}
    </div>
  );
}
