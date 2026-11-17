import { useEffect, useState } from "react";
import {
  api,
  labels,
  type Report,
  type Status,
} from "../services/workshopService";
import { CardGridSkeleton, TableSkeleton } from "../components/Skeleton";
import EmptyState from "../components/EmptyState";

export default function ReportsPage({
  mechanicsOnly,
  onNavigate,
}: {
  mechanicsOnly: boolean;
  onNavigate: (
    page: string,
    filter?: {
      status?: string;
      brand?: string;
      mechanic?: string;
      active?: boolean;
      role?: string;
    },
  ) => void;
}) {
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    api<Report>("/reports/summary")
      .then((value) => {
        if (active) setData(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [reload]);

  if (error)
    return (
      <article className="ws-panel">
        <EmptyState
          title="No se pudo cargar el resumen"
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
    );

  if (!data)
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <CardGridSkeleton count={4} />
        <TableSkeleton rows={4} columns={3} />
      </div>
    );

  const maxMechanicLoad = Math.max(
    1,
    ...data.by_mechanic.map((m) => m.active_orders || 0),
  );

  return (
    <>
      {!mechanicsOnly && (
        <>
          <div className="admin-welcome">
            <div>
              <p className="ws-overline">EL TALLER, EN UN VISTAZO</p>
              <h2>Cada detalle bajo control.</h2>
              <p>
                Organiza el trabajo, revisa las cotizaciones y acompaña a tu
                equipo.
              </p>
            </div>
            <button
              className="ws-primary"
              onClick={() => onNavigate("Cotizaciones")}
            >
              Revisar cotizaciones <span aria-hidden="true">↗</span>
            </button>
          </div>

          <div className="ws-stats">
            {[
              ["Vehículos", data.total_vehicles],
              ["Clientes", data.total_clients],
              ["Mecánicos", data.total_mechanics],
              ["Órdenes activas", data.active_orders],
            ].map(([label, value]) => (
              <button
                className="ws-stat"
                key={label}
                onClick={() =>
                  label === "Vehículos"
                    ? onNavigate("Vehículos")
                    : label === "Clientes"
                      ? onNavigate("Usuarios", { role: "CLIENT" })
                      : label === "Mecánicos"
                        ? onNavigate("Mecánicos")
                        : onNavigate("Órdenes de trabajo", { active: true })
                }
              >
                <div>{label}</div>
                <strong>{value}</strong>
                <small>
                  Explorar registros <span aria-hidden="true">↗</span>
                </small>
              </button>
            ))}
          </div>

          <div className="report-strip">
            <button
              type="button"
              className="at-report-pill"
              onClick={() => onNavigate("Cotizaciones")}
            >
              <strong>{data.pending_quotes}</strong> cotizaciones pendientes
            </button>
            <button
              type="button"
              className="at-report-pill"
              onClick={() => onNavigate("Órdenes de trabajo", { active: true })}
            >
              <strong>{data.unassigned_orders}</strong> órdenes sin asignar
            </button>
            <button
              type="button"
              className="at-report-pill"
              onClick={() => onNavigate("Órdenes de trabajo")}
            >
              <strong>{data.total_orders}</strong> órdenes registradas
            </button>
          </div>

          <div className="analytics-grid">
            <article className="ws-panel">
              <div className="panel-heading">
                <p className="ws-overline">ACTIVIDAD DEL TALLER</p>
                <h2>Distribución de órdenes</h2>
                <p>Estados registrados en el sistema</p>
              </div>
              <div className="status-chart">
                {Object.entries(labels).map(([status, label]) => {
                  const count = data.by_status[status as Status] || 0;
                  const maximum = Math.max(
                    1,
                    ...Object.values(data.by_status).map((v) => v || 0),
                  );
                  return (
                    <button
                      className="chart-row"
                      key={status}
                      onClick={() =>
                        onNavigate("Órdenes de trabajo", { status })
                      }
                    >
                      <span>{label}</span>
                      <div className="chart-track">
                        <div style={{ width: `${(count / maximum) * 100}%` }} />
                      </div>
                      <strong>{count}</strong>
                    </button>
                  );
                })}
              </div>
            </article>

            <article className="ws-panel">
              <div className="panel-heading">
                <p className="ws-overline">VEHÍCULOS PRESENTES</p>
                <h2>Marcas en el taller</h2>
                <p>Incluye vehículos listos para entregar</p>
              </div>
              {Object.entries(data.by_brand).length ? (
                Object.entries(data.by_brand).map(([brand, count]) => (
                  <button
                    className="brand-row"
                    key={brand}
                    onClick={() => onNavigate("Órdenes de trabajo", { brand })}
                  >
                    <span className="brand-initial">{brand.slice(0, 1)}</span>
                    <strong>{brand}</strong>
                    <span>{count} vehículos</span>
                  </button>
                ))
              ) : (
                <EmptyState
                  title="Sin vehículos presentes"
                  description="No hay vehículos activos en el taller en este momento."
                />
              )}
            </article>
          </div>
        </>
      )}

      <article className="ws-panel ws-progress">
        <div className="panel-heading">
          <p className="ws-overline">EQUIPO TÉCNICO</p>
          <h2>Carga por mecánico</h2>
        </div>
        {data.by_mechanic.length === 0 ? (
          <EmptyState
            title="Sin mecánicos registrados"
            description="Registra mecánicos en el sistema para asignarles órdenes de trabajo."
          />
        ) : (
          <div className="at-mechanic-list">
            {data.by_mechanic.map((person) => {
              const initials =
                `${person.first_name?.[0] || ""}${person.last_name?.[0] || ""}`.toUpperCase() ||
                "M";
              const pct = Math.round(
                ((person.active_orders || 0) / maxMechanicLoad) * 100,
              );
              return (
                <button
                  className="at-mechanic-row"
                  key={person.id}
                  onClick={() =>
                    onNavigate("Órdenes de trabajo", {
                      mechanic: person.id,
                      active: true,
                    })
                  }
                >
                  <span className="at-mechanic-avatar" aria-hidden="true">
                    {initials}
                  </span>
                  <span className="at-mechanic-name">
                    {person.first_name} {person.last_name}
                  </span>
                  <div className="at-mechanic-bar" aria-hidden="true">
                    <div
                      className="at-mechanic-bar-fill"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <strong className="at-mechanic-count">
                    {person.active_orders} activas
                  </strong>
                </button>
              );
            })}
          </div>
        )}
      </article>

      <div className="at-panel-footer">
        <button
          className="ws-secondary"
          onClick={() => setReload((n) => n + 1)}
        >
          Actualizar
        </button>
      </div>
    </>
  );
}
