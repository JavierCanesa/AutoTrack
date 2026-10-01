import WorkflowGuide from "../components/WorkflowGuide";
import { useEffect, useState } from "react";
import type { AuthUser } from "../services/authService";
import { api, type Order, type Vehicle } from "../services/workshopService";
import ServiceProgress from "../components/ServiceProgress";
import ServiceList, { closed, completed } from "../components/ServiceList";
import OrderDetail from "./OrderDetail";
import VehiclesPage from "./VehiclesPage";

export default function ClientPage({
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
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [historyVehicle, setHistoryVehicle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [updated, setUpdated] = useState<Date | null>(null);
  useEffect(() => {
    setSelected(null);
  }, [page, navigation]);
  useEffect(() => {
    setHistoryVehicle("");
  }, [navigation]);
  useEffect(() => {
    if (selected || page === "Mis vehículos") return;
    let disposed = false;
    let inFlight = false;
    setLoading(true);
    async function load() {
      if (inFlight) return;
      inFlight = true;
      try {
        const [v, o] = await Promise.all([
          api<Vehicle[]>("/vehicles"),
          api<Order[]>("/work-orders"),
        ]);
        if (!disposed) {
          setVehicles(v);
          setOrders(o);
          setError("");
          setUpdated(new Date());
        }
      } catch (e) {
        if (!disposed)
          setError(
            e instanceof Error
              ? e.message
              : "No se pudo actualizar el seguimiento.",
          );
      } finally {
        inFlight = false;
        if (!disposed) setLoading(false);
      }
    }
    void load();
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = window.setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [user.id, page, selected, reload]);
  function history(vehicleId: string) {
    setHistoryVehicle(vehicleId);
    onNavigate("Historial de servicios");
  }
  if (selected)
    return (
      <OrderDetail
        key={selected}
        orderId={selected}
        user={user}
        mechanics={[]}
        onBack={() => setSelected(null)}
      />
    );
  if (page === "Mis vehículos")
    return <VehiclesPage user={user} onHistory={history} />;
  const ongoing = orders.filter(
    (o) => !["DELIVERED", "CANCELLED"].includes(o.status),
  );
  return (
    <div className="role-portal">
      <article className="client-pass">
        <div>
          <p className="ws-overline">TU IDENTIFICADOR EN EL TALLER</p>
          <h2>
            Tu código de cliente:{" "}
            <span>{user.client_code || "Pendiente de configurar"}</span>
          </h2>
          <p>Compártelo con el mecánico al recibir tu vehículo.</p>
        </div>
        <span aria-hidden="true" className="pass-symbol">
          ▱
        </span>
      </article>
      <div className="role-welcome">
        <div>
          <p className="ws-overline">TU VEHÍCULO, PASO A PASO</p>
          <h2>Hola, {user.first_name}</h2>
          <p>
            Consulta el estado de tus servicios y las evidencias registradas por
            el taller.
          </p>
        </div>
        <button
          className="ws-secondary"
          disabled={loading}
          onClick={() => setReload((n) => n + 1)}
        >
          Actualizar seguimiento
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}{" "}
          {updated &&
            "La información visible corresponde a la última consulta correcta."}
        </p>
      )}
      {loading ? (
        <p role="status">Consultando tus vehículos…</p>
      ) : (
        <>
          {updated && (
            <p className="role-sync">
              Última consulta: {updated.toLocaleTimeString("es-SV")} · Se
              actualiza cada 30 segundos mientras esta vista está visible.
            </p>
          )}
          {!error || updated ? (
            <>
              {page === "Seguimiento" && <WorkflowGuide client />}
              <div className="ws-stats role-stats">
                <article className="ws-stat">
                  <div>Mis vehículos</div>
                  <strong>{vehicles.length}</strong>
                  <small>Registrados a tu nombre</small>
                </article>
                <article className="ws-stat">
                  <div>Servicios en el taller</div>
                  <strong>{ongoing.length}</strong>
                  <small>Incluye los pendientes de entrega</small>
                </article>
                <article className="ws-stat">
                  <div>Servicios finalizados</div>
                  <strong>{orders.filter(completed).length}</strong>
                  <small>Tu historial de mantenimiento</small>
                </article>
              </div>
              {page === "Historial de servicios" ? (
                <ServiceList
                  compactOnly
                  key={`history-${historyVehicle}`}
                  orders={orders.filter(closed)}
                  history
                  initialVehicle={historyVehicle}
                  onOpen={setSelected}
                />
              ) : page === "Mis servicios" ? (
                <ServiceList compactOnly orders={orders} onOpen={setSelected} />
              ) : (
                <section
                  className="role-tracking"
                  aria-label="Seguimiento de mis vehículos"
                >
                  <div className="ws-panel-title">
                    <h2>El estado de tus vehículos</h2>
                    <button
                      className="ws-primary"
                      onClick={() => onNavigate("Mis vehículos")}
                    >
                      Administrar mis vehículos
                    </button>
                  </div>
                  {!vehicles.length && (
                    <div className="ws-panel ws-empty">
                      <h3>Registra tu primer vehículo</h3>
                      <p>
                        Agrega su placa y sus datos. Cuando el taller abra una
                        orden, podrás seguirla desde aquí.
                      </p>
                      <button
                        className="ws-primary"
                        onClick={() => onNavigate("Mis vehículos")}
                      >
                        Ir a mis vehículos
                      </button>
                    </div>
                  )}
                  {vehicles.map((v) => {
                    const currentOrders = ongoing.filter(
                      (o) => o.vehicle_id === v.id,
                    );
                    return (
                      <article
                        className="ws-panel role-tracking-card"
                        key={v.id}
                      >
                        <div className="role-card-top">
                          <div>
                            <span className="role-plate">{v.plate}</span>
                            <h3>
                              {v.brand} {v.model}
                            </h3>
                            <p>
                              {v.vehicle_year || "Año sin indicar"} ·{" "}
                              {v.color || "Color sin indicar"}
                            </p>
                          </div>
                          <button
                            className="ws-secondary"
                            onClick={() => history(v.id)}
                          >
                            Ver historial
                          </button>
                        </div>
                        {currentOrders.length ? (
                          currentOrders.map((o) => (
                            <div className="role-current-service" key={o.id}>
                              <h4>
                                {o.service_type?.name || "Servicio por definir"}
                              </h4>
                              <ServiceProgress status={o.status} />
                              <button
                                className="ws-primary"
                                onClick={() => setSelected(o.id)}
                              >
                                Ver avances y fotografías
                              </button>
                            </div>
                          ))
                        ) : (
                          <p className="role-no-service">
                            No hay servicios en curso para este vehículo.
                          </p>
                        )}
                      </article>
                    );
                  })}
                </section>
              )}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
