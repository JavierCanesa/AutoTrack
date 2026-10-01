import { useEffect, useState, type SubmitEvent } from "react";
import {
  api,
  labels,
  uploadPhoto,
  type Detail,
  type Status,
} from "../services/workshopService";
import {
  getWorkshopServiceTypes,
  type ServiceType,
} from "../services/serviceTypeService";
import Evidence from "./Evidence";
import { optionalText, requiredText } from "../validation";

type Quote = {
  status: string;
  items: { kind: string; description: string; quantity: string }[];
};
export default function MechanicWorkflow({
  detail,
  onChange,
}: {
  detail: Detail;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [services, setServices] = useState<ServiceType[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [checked, setChecked] = useState<number[]>([]);
  const path = `/work-orders/${detail.id}`;
  useEffect(() => {
    let active = true;
    if (detail.status === "DIAGNOSIS")
      getWorkshopServiceTypes()
        .then((s) => {
          if (active) setServices(s);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    if (detail.status === "IN_REPAIR")
      api<Quote[]>(`${path}/quotes`)
        .then((q) => {
          if (active) setQuote(q[0]?.status === "ACCEPTED" ? q[0] : null);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [path, detail.status]);
  const symptoms =
    detail.updates
      .find((u) => u.comment?.startsWith("Síntomas reportados: "))
      ?.comment?.replace("Síntomas reportados: ", "") ||
    detail.diagnoses.find((d) => d.symptoms)?.symptoms;
  async function submit(
    event: SubmitEvent<HTMLFormElement>,
    kind: string,
    status?: Status,
  ) {
    event.preventDefault();
    if (busy) return;
    const element = event.currentTarget,
      form = new FormData(element);
    let text: string | null = null;
    if (kind === "diagnoses")
      text = requiredText(
        element,
        "description",
        "Describe las fallas comprobadas.",
      );
    if (kind === "parts")
      text = requiredText(element, "part_name", "Escribe el nombre de la pieza.");
    if (kind === "updates")
      text = requiredText(element, "comment", "Describe esta etapa del trabajo.");
    if (["diagnoses", "parts", "updates"].includes(kind) && text === null)
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (kind === "photos") {
        const file = form.get("photo") as File;
        const update =
          detail.updates.find((u) => u.status === "DIAGNOSIS") ||
          detail.updates.at(-1);
        if (!update)
          throw new Error(
            "No se encontró el avance del diagnóstico. Vuelve a abrir la orden.",
          );
        if (!file?.size || file.size > 5 * 1024 * 1024)
          throw new Error("Selecciona una imagen de hasta 5 MB.");
        await uploadPhoto(detail.id, update.id, file);
      } else {
        const payload =
          kind === "diagnoses"
            ? {
                description: text,
                service_type_id: form.get("service_type_id"),
              }
            : kind === "parts"
              ? {
                  part_name: text,
                  action: form.get("action"),
                  priority: form.get("priority"),
                  notes: optionalText(form.get("notes")),
                }
              : {
                  status,
                  comment: text,
                  ...(status === "TESTING" ? { completed_items: checked } : {}),
                };
        await api(`${path}/${kind}`, "POST", payload);
      }
      element.reset();
      setNotice("Guardado correctamente.");
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }
  const parts =
    quote?.items
      .map((item, index) => ({ ...item, index }))
      .filter((item) => item.kind === "PART") || [];
  return (
    <section className="mechanic-workflow">
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {detail.status === "RECEIVED" && (
        <form
          className="ws-panel ws-progress"
          onSubmit={(e) => submit(e, "updates", "DIAGNOSIS")}
        >
          <h2>Síntomas del vehículo</h2>
          <p>
            Escribe lo que el cliente comunica. Las fallas comprobadas se
            registran en el siguiente paso.
          </p>
          <fieldset disabled={busy}>
            <label>
              Síntomas reportados por el cliente
              <textarea name="comment" required maxLength={2000} rows={4} />
            </label>
            <button className="ws-primary">
              Recibido · Iniciar diagnóstico
            </button>
          </fieldset>
        </form>
      )}
      {detail.status === "DIAGNOSIS" && (
        <>
          <article className="ws-panel">
            <h2>Síntomas del cliente</h2>
            <p className="preserve-lines">
              {symptoms || "Esta orden anterior no tiene síntomas registrados."}
            </p>
          </article>
          <form
            className="ws-panel ws-progress"
            onSubmit={(e) => submit(e, "diagnoses")}
          >
            <h2>Fallas encontradas</h2>
            {detail.diagnoses.map((d) => (
              <p className="preserve-lines" key={d.id}>
                {d.description}
              </p>
            ))}
            <fieldset disabled={busy}>
              <label>
                Fallas reales comprobadas
                <textarea
                  name="description"
                  required
                  maxLength={4000}
                  rows={4}
                />
              </label>
              <label>
                Tipo de servicio
                <select
                  aria-label="Tipo de servicio"
                  name="service_type_id"
                  required
                  defaultValue={detail.service_type_id || ""}
                >
                  <option value="">Selecciona el servicio</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="ws-primary">Guardar fallas</button>
            </fieldset>
          </form>
          <form
            className="ws-panel ws-progress"
            onSubmit={(e) => submit(e, "photos")}
          >
            <h2>Comprobante fotográfico</h2>
            <div className="ws-photos">
              {detail.photos.map((p) => (
                <Evidence key={p.id} orderId={detail.id} photo={p} />
              ))}
            </div>
            <fieldset disabled={busy}>
              <label>
                Foto de las fallas
                <input
                  name="photo"
                  type="file"
                  required
                  accept="image/jpeg,image/png,image/webp"
                />
              </label>
              <small>JPEG, PNG o WebP, hasta 5 MB.</small>
              <button className="ws-primary">Adjuntar fotografía</button>
            </fieldset>
          </form>
          <form
            className="ws-panel ws-progress"
            onSubmit={(e) => submit(e, "parts")}
          >
            <h2>Piezas para cotizar</h2>
            <p>
              Agrega las piezas necesarias. Si el trabajo no requiere piezas,
              puedes continuar sin agregarlas.
            </p>
            {detail.parts.map((p) => (
              <div className="ws-entry" key={p.id}>
                <strong>{p.part_name}</strong>
                <p>
                  {p.action === "REPLACE" ? "Reemplazar" : "Reparar"} ·{" "}
                  {p.notes}
                </p>
                <span
                  className={`priority priority-${p.priority.toLowerCase()}`}
                >
                  {{ HIGH: "Alta", MEDIUM: "Media", LOW: "Baja" }[p.priority]}
                </span>
              </div>
            ))}
            <fieldset disabled={busy}>
              <label>
                Pieza
                <input name="part_name" required maxLength={150} />
              </label>
              <label>
                Trabajo necesario
                <select name="action">
                  <option value="REPLACE">Reemplazar</option>
                  <option value="REPAIR">Reparar</option>
                </select>
              </label>
              <label>
                Prioridad
                <select name="priority" defaultValue="MEDIUM">
                  <option value="HIGH">Alta</option>
                  <option value="MEDIUM">Media</option>
                  <option value="LOW">Baja</option>
                </select>
              </label>
              <label>
                Observaciones
                <textarea name="notes" maxLength={2000} />
              </label>
              <button className="ws-secondary">Agregar pieza</button>
            </fieldset>
          </form>
          <form
            className="ws-panel"
            onSubmit={(e) => submit(e, "updates", "WAITING_APPROVAL")}
          >
            <input
              type="hidden"
              name="comment"
              value="Diagnóstico y piezas enviados al administrador para cotización."
            />
            <p>
              Guarda las fallas y adjunta al menos una fotografía antes de
              enviar.
            </p>
            <button
              className="ws-primary"
              disabled={
                busy || !detail.diagnoses.length || !detail.photos.length
              }
            >
              Enviar a cotización
            </button>
          </form>
        </>
      )}
      {detail.status === "WAITING_APPROVAL" && (
        <article className="ws-panel">
          <h2>
            {detail.quote_status === "ACCEPTED"
              ? "Cotización aceptada"
              : detail.quote_status === "REJECTED"
                ? "Cotización rechazada"
                : "En espera de cotización o aprobación"}
          </h2>
          <p>
            {detail.quote_status === "REJECTED"
              ? "El administrador revisará la cotización con el cliente."
              : detail.quote_status === "ACCEPTED"
                ? "El cliente autorizó el trabajo. Puedes comenzar."
                : "El administrador prepara y envía la cotización. La reparación comienza cuando el cliente la acepte."}
          </p>
          {detail.quote_status === "ACCEPTED" && (
            <form onSubmit={(e) => submit(e, "updates", "IN_REPAIR")}>
              <input
                type="hidden"
                name="comment"
                value="Reparación iniciada tras la aprobación del cliente."
              />
              <button disabled={busy} className="ws-primary">
                Comenzar reparación
              </button>
            </form>
          )}
        </article>
      )}
      {detail.status === "IN_REPAIR" && (
        <form
          className="ws-panel ws-progress"
          onSubmit={(e) => submit(e, "updates", "TESTING")}
        >
          <h2>Trabajo realizado</h2>
          <p>
            Marca cada pieza de la cotización aceptada cuando hayas realizado el
            trabajo autorizado.
          </p>
          <fieldset disabled={busy || !quote}>
            {parts.map((p) => (
              <label className="repair-check" key={p.index}>
                <input
                  type="checkbox"
                  checked={checked.includes(p.index)}
                  onChange={(e) =>
                    setChecked((previous) =>
                      e.target.checked
                        ? [...previous, p.index]
                        : previous.filter((i) => i !== p.index),
                    )
                  }
                />
                {p.description} · Cantidad: {p.quantity}
              </label>
            ))}
            {quote && !parts.length && (
              <p>
                La cotización no incluye piezas; describe el servicio realizado.
              </p>
            )}
            <label>
              Descripción breve del trabajo
              <textarea name="comment" required maxLength={2000} rows={3} />
            </label>
            <button
              disabled={busy || !quote || checked.length !== parts.length}
              className="ws-primary"
            >
              Reparación lista · Pasar a pruebas
            </button>
          </fieldset>
          {!quote && (
            <p>Se necesita consultar la cotización aceptada para continuar.</p>
          )}
        </form>
      )}
      {detail.status === "TESTING" && (
        <form
          className="ws-panel ws-progress"
          onSubmit={(e) => submit(e, "updates", "COMPLETED")}
        >
          <h2>Comprobación final</h2>
          <fieldset disabled={busy}>
            <label>
              Resultado de las pruebas
              <textarea name="comment" required maxLength={2000} rows={3} />
            </label>
            <label className="repair-check">
              <input type="checkbox" required />
              Confirmo que el vehículo funciona correctamente y está listo para
              entregar.
            </label>
            <button className="ws-primary">
              Finalizar · Listo para entregar
            </button>
          </fieldset>
        </form>
      )}
      {["COMPLETED", "DELIVERED", "CANCELLED"].includes(detail.status) && (
        <article className="ws-panel">
          <h2>{labels[detail.status]}</h2>
          <p>
            {detail.status === "COMPLETED"
              ? "Trabajo finalizado. El administrador registrará la entrega al cliente."
              : "Consulta el trabajo realizado en el historial."}
          </p>
        </article>
      )}
      {detail.status !== "RECEIVED" && (
        <details className="ws-panel">
          <summary>Consultar diagnóstico e historial</summary>
          {symptoms && <p className="preserve-lines">Síntomas: {symptoms}</p>}
          {detail.diagnoses.map((d) => (
            <p className="preserve-lines" key={d.id}>
              {d.description}
            </p>
          ))}
          {detail.parts.map((p) => (
            <p key={p.id}>
              {p.part_name} ·{" "}
              {p.action === "REPLACE" ? "Reemplazar" : "Reparar"}
            </p>
          ))}
          <ol className="ws-timeline">
            {detail.updates.map((u) => (
              <li key={u.id}>
                <strong>{labels[u.status]}</strong>
                <p className="preserve-lines">{u.comment}</p>
              </li>
            ))}
          </ol>
          <div className="ws-photos">
            {detail.photos.map((p) => (
              <Evidence key={p.id} orderId={detail.id} photo={p} />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
