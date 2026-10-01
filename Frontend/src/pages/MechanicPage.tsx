import WorkflowGuide from "../components/WorkflowGuide";
import { useEffect, useState } from "react";
import type { AuthUser } from "../services/authService";
import { api, labels, type Order } from "../services/workshopService";
import ServiceList, { closed } from "../components/ServiceList";
import OrderDetail from "./OrderDetail";
import ReceptionPage from "./ReceptionPage";

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
  return (
    <div className="role-portal">
      <div className="role-welcome">
        <div>
          <p className="ws-overline">ÁREA DE MECÁNICA</p>
          <h2>Hola, {user.first_name}</h2>
          <p>
            {history
              ? "Consulta tus trabajos finalizados."
              : "Tus órdenes asignadas, el diagnóstico y cada avance en un solo lugar."}
          </p>
        </div>
        <button
          className="ws-secondary"
          disabled={loading}
          onClick={() => setReload((n) => n + 1)}
        >
          Actualizar trabajos
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Cargando tus trabajos…</p>
      ) : (
        !error && (
          <>
            {!history && (
              <div className="ws-stats role-stats">
                {[
                  "RECEIVED",
                  "DIAGNOSIS",
                  "WAITING_APPROVAL",
                  "IN_REPAIR",
                  "TESTING",
                ].map((status) => (
                  <button
                    className="ws-stat"
                    key={status}
                    aria-pressed={statusFilter === status}
                    onClick={() =>
                      setStatusFilter(statusFilter === status ? "" : status)
                    }
                  >
                    <div>{labels[status as keyof typeof labels]}</div>
                    <strong>
                      {active.filter((o) => o.status === status).length}
                    </strong>
                    <small>Ver vehículos</small>
                  </button>
                ))}
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
