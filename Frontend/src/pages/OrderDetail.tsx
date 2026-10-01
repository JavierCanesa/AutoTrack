import MechanicWorkflow from "../components/MechanicWorkflow";
import Evidence from "../components/Evidence";
import QuotesPanel from "./QuotesPanel";
import { useEffect, useState, type SubmitEvent } from "react";
import type { AuthUser } from "../services/authService";
import type { ManagedUser } from "../services/userService";
import ServiceProgress from "../components/ServiceProgress";
import { api, labels, type Detail } from "../services/workshopService";
import { requiredText } from "../validation";

export default function OrderDetail({
  orderId,
  user,
  mechanics,
  onBack,
  initialTab,
}: {
  orderId: string;
  user: AuthUser;
  mechanics: ManagedUser[];
  onBack: () => void;
  initialTab?: string;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState(
    initialTab || (user.role === "CLIENT" ? "updates" : "diagnoses"),
  );
  const [updated, setUpdated] = useState<Date | null>(null);
  useEffect(() => {
    let active = true;
    let inFlight = false;
    function load() {
      if (inFlight) return;
      inFlight = true;
      api<Detail>(`/work-orders/${orderId}`)
        .then((value) => {
          if (active) {
            setDetail(value);
            setUpdated(new Date());
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          inFlight = false;
        });
    }
    load();
    const refresh = () => {
      if (document.visibilityState === "visible") load();
    };
    const timer = window.setInterval(refresh, 15000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [orderId, reload, user.role]);
  async function save(event: SubmitEvent<HTMLFormElement>, kind: string) {
    event.preventDefault();
    if (busy) return;
    const element = event.currentTarget;
    const form = new FormData(element);
    const comment =
      kind === "updates"
        ? requiredText(
            element,
            "comment",
            "Escribe la razón de esta acción antes de continuar.",
          )
        : null;
    if (kind === "updates" && comment === null) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data =
        kind === "assignment"
          ? { mechanic_id: form.get("mechanic_id") || null }
          : { status: form.get("status"), comment };
      await api(
        `/work-orders/${orderId}/${kind}`,
        kind === "assignment" ? "PATCH" : "POST",
        data,
      );
      element.reset();
      setNotice("Cambios guardados.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      try {
        setDetail(await api<Detail>(`/work-orders/${orderId}`));
        setUpdated(new Date());
      } catch {
        setError(
          (previous) =>
            `${previous ? `${previous} ` : ""}No se pudo actualizar el detalle. Se reintentará automáticamente.`,
        );
      }
      setBusy(false);
    }
  }
  return (
    <>
      <div className="ws-actions">
        <button className="ws-secondary" disabled={busy} onClick={onBack}>
          ← Volver
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!detail ? (
        <p role="status">
          {error ? "No se pudo cargar la orden." : "Cargando orden…"}
        </p>
      ) : (
        <>
          <article className="ws-panel ws-progress">
            <h2>
              {detail.vehicle.plate} · {detail.vehicle.brand}{" "}
              {detail.vehicle.model}
            </h2>
            <span className={`ws-badge ws-${detail.status.toLowerCase()}`}>
              {detail.status === "WAITING_APPROVAL" &&
              detail.quote_status === "ACCEPTED"
                ? "Cotización aceptada — Comenzar reparación"
                : detail.status === "WAITING_APPROVAL" &&
                    detail.quote_status === "REJECTED"
                  ? "Cotización rechazada"
                  : labels[detail.status]}
            </span>
            <p>{detail.service_type?.name || "Servicio por definir"}</p>
            <p>
              Cliente: {detail.client?.first_name} {detail.client?.last_name} ·
              Código: {detail.client?.client_code}
            </p>
            <p>{detail.description || "Sin descripción inicial."}</p>
            {!(
              detail.status === "WAITING_APPROVAL" &&
              ["ACCEPTED", "REJECTED"].includes(detail.quote_status || "")
            ) && <ServiceProgress status={detail.status} />}
            <small>
              Ingreso: {new Date(detail.entry_date).toLocaleString("es-SV")}
            </small>
            {detail.completion_date && (
              <p>
                Finalizado:{" "}
                {new Date(detail.completion_date).toLocaleString("es-SV")}
              </p>
            )}
          </article>
          {user.role === "MECHANIC" ? (
            <MechanicWorkflow
              key={orderId + detail.status}
              detail={detail}
              onChange={() => setReload((n) => n + 1)}
            />
          ) : (
            <>
              {user.role === "CLIENT" && updated && (
                <p className="role-sync">
                  Última consulta: {updated.toLocaleTimeString("es-SV")} ·
                  Actualización automática cada 15 segundos.
                </p>
              )}
              {user.role === "ADMIN" &&
                !["DELIVERED", "CANCELLED"].includes(detail.status) && (
                  <form
                    className="ws-panel ws-progress"
                    onSubmit={(e) => save(e, "assignment")}
                  >
                    <h2>Asignación de mecánico</h2>
                    <fieldset disabled={busy}>
                      <label>
                        Mecánico
                        <select
                          key={detail.mechanic_id || "none"}
                          name="mechanic_id"
                          defaultValue={detail.mechanic_id || ""}
                        >
                          <option value="">Sin asignar</option>
                          {mechanics.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.first_name} {p.last_name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button className="ws-primary">Guardar asignación</button>
                    </fieldset>
                  </form>
                )}
              {user.role === "ADMIN" &&
                !["DELIVERED", "CANCELLED"].includes(detail.status) && (
                  <form
                    className="ws-panel ws-progress"
                    onSubmit={(e) => save(e, "updates")}
                  >
                    <h2>Cierre de la orden</h2>
                    <fieldset disabled={busy}>
                      <label>
                        Acción
                        <select name="status">
                          {detail.status === "COMPLETED" ? (
                            <option value="DELIVERED">Entregar vehículo</option>
                          ) : (
                            <option value="CANCELLED">Cancelar orden</option>
                          )}
                        </select>
                      </label>
                      <label>
                        Observación
                        <textarea name="comment" required maxLength={2000} />
                      </label>
                      <button className="ws-primary">Confirmar acción</button>
                    </fieldset>
                  </form>
                )}
              <nav
                className="role-detail-tabs"
                aria-label="Secciones del servicio"
              >
                {[
                  ["diagnoses", "Diagnóstico y piezas"],
                  ["updates", "Avances"],
                  ["photos", "Fotografías"],
                  ["quotes", "Cotización"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    disabled={busy}
                    aria-current={tab === value ? "page" : undefined}
                    className={tab === value ? "is-selected" : ""}
                    onClick={() => setTab(value)}
                  >
                    {label}
                  </button>
                ))}
              </nav>
              {tab === "quotes" && (
                <QuotesPanel
                  hasDiagnosis={detail.diagnoses.length > 0}
                  hasParts={detail.parts.length > 0}
                  orderId={orderId}
                  user={user}
                  status={detail.status}
                  onChange={() => setReload((n) => n + 1)}
                />
              )}
              <div hidden={tab !== "diagnoses"}>
                <div className="ws-detail-grid">
                  <article className="ws-panel">
                    <h2>Diagnósticos</h2>
                    {detail.diagnoses.length ? (
                      detail.diagnoses.map((d) => (
                        <div className="ws-entry" key={d.id}>
                          {d.symptoms && <p>Síntomas: {d.symptoms}</p>}
                          <p>{d.description}</p>
                          <small>
                            {new Date(d.created_at).toLocaleString("es-SV")}
                          </small>
                        </div>
                      ))
                    ) : (
                      <p>Sin diagnósticos registrados.</p>
                    )}
                  </article>
                  <article className="ws-panel">
                    <h2>Piezas involucradas</h2>
                    {detail.parts.length ? (
                      detail.parts.map((p) => (
                        <div className="ws-entry" key={p.id}>
                          <strong>{p.part_name}</strong>
                          <p
                            className={`priority priority-${p.priority.toLowerCase()}`}
                          >
                            Prioridad:{" "}
                            {{ HIGH: "Alta", MEDIUM: "Media", LOW: "Baja" }[
                              p.priority
                            ] || "Media"}
                          </p>
                          <p>
                            {p.action === "REPAIR" ? "Reparar" : "Reemplazar"} ·{" "}
                            {p.notes || "Sin notas"}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p>Sin piezas registradas.</p>
                    )}
                  </article>
                </div>
              </div>
              <div hidden={tab !== "updates"}>
                <article className="ws-panel ws-progress">
                  <h2>Avances del servicio</h2>
                  {detail.updates.length ? (
                    <ol className="ws-timeline">
                      {detail.updates.map((u) => (
                        <li key={u.id}>
                          <strong>{labels[u.status]}</strong>
                          <p>{u.comment}</p>
                          <small>
                            {new Date(u.created_at).toLocaleString("es-SV")}
                          </small>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p>Sin avances registrados.</p>
                  )}
                </article>
              </div>
              <div hidden={tab !== "photos"}>
                <article className="ws-panel ws-progress">
                  <h2>Evidencia fotográfica</h2>
                  <div className="ws-photos">
                    {tab === "photos" &&
                      detail.photos.map((p) => {
                        const advance = detail.updates.find(
                          (update) => update.id === p.service_update_id,
                        );
                        return (
                          <div key={p.id}>
                            {advance && (
                              <p>
                                {labels[advance.status]} ·{" "}
                                {new Date(advance.created_at).toLocaleString(
                                  "es-SV",
                                )}
                              </p>
                            )}
                            <Evidence orderId={orderId} photo={p} />
                          </div>
                        );
                      })}
                  </div>
                  {!detail.photos.length && <p>No hay fotografías.</p>}
                </article>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
