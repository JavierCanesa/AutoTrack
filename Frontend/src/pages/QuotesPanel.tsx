import ConfirmDialog from "../components/ConfirmDialog";
import { CardGridSkeleton } from "../components/Skeleton";
import EmptyState from "../components/EmptyState";
import { useEffect, useState, type SubmitEvent } from "react";
import {
  authenticatedFetch,
  readResponse,
  type AuthUser,
} from "../services/authService";
import { api, type Status } from "../services/workshopService";
import {
  localDateInput,
  NON_BLANK_PATTERN,
  optionalText,
} from "../validation";
interface Item {
  description: string;
  kind: string;
  quantity: string;
  unit_price: string;
}
interface Quote {
  id: string;
  version: number;
  status: string;
  items: Item[];
  total: string;
  notes: string | null;
  valid_until: string;
  decided_at: string | null;
}
const names: Record<string, string> = {
  DRAFT: "Borrador",
  SENT: "Pendiente de respuesta",
  ACCEPTED: "Aceptada",
  REJECTED: "Rechazada",
  SUPERSEDED: "Sustituida",
};
const blank = (): Item => ({
  description: "",
  kind: "PART",
  quantity: "1",
  unit_price: "0",
});
export default function QuotesPanel({
  orderId,
  user,
  status,
  hasDiagnosis,
  hasParts,
  onChange,
}: {
  orderId: string;
  user: AuthUser;
  status: Status;
  hasDiagnosis: boolean;
  hasParts: boolean;
  onChange: () => void;
}) {
  const [missingDiagnosis, setMissingDiagnosis] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: "accept" | "reject";
    quote: Quote;
  } | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [items, setItems] = useState<Item[]>([blank()]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const path = `/work-orders/${orderId}/quotes`;
  useEffect(() => {
    let active = true;
    let inFlight = false;
    async function load() {
      if (inFlight) return;
      inFlight = true;
      try {
        const result = await api<Quote[]>(path);
        if (active) {
          setQuotes(result);
          setError("");
        }
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "No se pudo consultar.");
      } finally {
        inFlight = false;
        if (active) setLoading(false);
      }
    }
    void load();
    const timer =
      user.role === "CLIENT"
        ? window.setInterval(() => {
            if (document.visibilityState === "visible") void load();
          }, 30000)
        : undefined;
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [path, reload, user.role]);
  async function write(suffix: string, body?: unknown) {
    if (busy) return false;
    setBusy(true);
    setError("");
    try {
      await api(path + suffix, "POST", body);
      onChange();
      try {
        setQuotes(await api<Quote[]>(path));
      } catch {
        setError(
          "La acción se guardó, pero no se pudo actualizar la lista. Pulsa «Actualizar cotizaciones».",
        );
      }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function create(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!hasDiagnosis) {
      setError("");
      setMissingDiagnosis(true);
      return;
    }
    const element = e.currentTarget;
    const form = new FormData(element);
    const saved = await write("", {
      items: items.map((item) => ({
        ...item,
        description: item.description.trim(),
      })),
      valid_until: form.get("valid_until"),
      notes: optionalText(form.get("notes")),
    });
    if (saved) {
      setItems([blank()]);
      element.reset();
    }
  }
  async function download(q: Quote) {
    setBusy(true);
    setError("");
    try {
      const response = await authenticatedFetch(`/api${path}/${q.id}/pdf`);
      if (!response.ok) await readResponse(response);
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `cotizacion-v${q.version}.pdf`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo descargar.");
    } finally {
      setBusy(false);
    }
  }
  function change(index: number, key: keyof Item, value: string) {
    setItems((previous) =>
      previous.map((item, i) =>
        i === index ? { ...item, [key]: value } : item,
      ),
    );
  }
  return (
    <section className="ws-panel ws-progress">
      <div className="ws-panel-title">
        <h2>Cotizaciones</h2>
        <button
          className="ws-primary"
          disabled={busy}
          onClick={() => setReload((n) => n + 1)}
        >
          Actualizar cotizaciones
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {loading && <CardGridSkeleton count={2} />}
      {missingDiagnosis && (
        <ConfirmDialog
          title="No se puede crear la cotización"
          acceptLabel="Entendido"
          hideCancel
          busy={false}
          onAccept={() => setMissingDiagnosis(false)}
          onCancel={() => setMissingDiagnosis(false)}
        >
          <p>
            {hasParts
              ? "El mecánico todavía no ha guardado el diagnóstico de este vehículo."
              : "No hay diagnóstico ni piezas registradas para cotizar."}
          </p>
          <p>
            El mecánico debe guardar las fallas encontradas y agregar las piezas
            necesarias antes de solicitar la cotización. Si el servicio solo
            requiere mano de obra, basta con el diagnóstico.
          </p>
        </ConfirmDialog>
      )}
      {confirmAction && (
        <ConfirmDialog
          title={
            confirmAction.type === "accept"
              ? "Confirmar aceptación de cotización"
              : "Rechazar cotización"
          }
          acceptLabel={
            confirmAction.type === "accept"
              ? "Sí, aceptar cotización"
              : "Sí, rechazar"
          }
          busy={busy}
          onAccept={async () => {
            const target = confirmAction;
            setConfirmAction(null);
            await write(`/${target.quote.id}/${target.type}`);
          }}
          onCancel={() => setConfirmAction(null)}
        >
          {confirmAction.type === "accept" ? (
            <p>
              ¿Confirmas que aceptas la versión{" "}
              <strong>{confirmAction.quote.version}</strong> por un total de{" "}
              <strong>
                ${Number(confirmAction.quote.total).toFixed(2)} USD
              </strong>
              ? El taller procederá con la reparación.
            </p>
          ) : (
            <p>
              ¿Rechazar la cotización versión{" "}
              <strong>{confirmAction.quote.version}</strong>? La orden
              permanecerá en espera para ajustes.
            </p>
          )}
        </ConfirmDialog>
      )}
      {!loading && !quotes.length && (
        <EmptyState
          title="Aún no hay cotizaciones"
          description="Cuando se registre el diagnóstico y se genere una cotización para esta orden, aparecerá aquí."
        />
      )}
      {quotes.map((q, index) => (
        <article className="at-quote-card" key={q.id}>
          <div className="at-quote-card-head">
            <div>
              <h3>
                Versión {q.version} · {names[q.status]}
              </h3>
              <small style={{ color: "var(--ink-soft)" }}>
                Válida hasta {q.valid_until}
              </small>
            </div>
            <span className="at-quote-total-pill">
              Total: ${Number(q.total).toFixed(2)} USD
            </span>
          </div>
          <div className="at-quote-items">
            {q.items.map((item, i) => (
              <div className="at-quote-item-row" key={i}>
                <span>
                  <span className="at-quote-item-kind">
                    {item.kind === "LABOR" ? "Mano de obra" : "Pieza"}
                  </span>
                  {item.description}
                </span>
                <strong>
                  {item.quantity} × ${Number(item.unit_price).toFixed(2)}
                </strong>
              </div>
            ))}
          </div>
          {q.notes && <p>{q.notes}</p>}
          {q.decided_at && (
            <p>Respuesta: {new Date(q.decided_at).toLocaleString("es-SV")}</p>
          )}
          <div className="ws-actions">
            <button
              className="ws-primary"
              disabled={busy}
              onClick={() => download(q)}
            >
              Descargar PDF
            </button>
            {index === 0 &&
              ["DIAGNOSIS", "WAITING_APPROVAL"].includes(status) && (
                <>
                  {user.role === "ADMIN" && q.status === "DRAFT" && (
                    <button
                      className="ws-primary"
                      disabled={busy}
                      onClick={() => write(`/${q.id}/send`)}
                    >
                      Enviar al cliente
                    </button>
                  )}
                  {user.role === "CLIENT" && q.status === "SENT" && (
                    <>
                      <button
                        className="ws-primary"
                        disabled={busy}
                        onClick={() => setConfirmAction({ type: "accept", quote: q })}
                      >
                        Aceptar cotización
                      </button>
                      <button
                        className="ws-secondary"
                        disabled={busy}
                        onClick={() => setConfirmAction({ type: "reject", quote: q })}
                      >
                        Rechazar
                      </button>
                    </>
                  )}
                </>
              )}
          </div>
        </article>
      ))}
      {user.role === "ADMIN" &&
        ["DIAGNOSIS", "WAITING_APPROVAL"].includes(status) && (
          <form onSubmit={create}>
            <h3>Preparar nueva versión</h3>
            <p>
              Incluye piezas y mano de obra con sus precios finales. La nueva
              versión requerirá aprobación del cliente.
            </p>
            <fieldset disabled={busy || loading}>
              {items.map((item, index) => (
                <div className="quote-line" key={index}>
                  <label>
                    Concepto
                    <input
                      required
                      maxLength={200}
                      pattern={NON_BLANK_PATTERN}
                      title="Escribe el concepto de la cotización."
                      value={item.description}
                      onChange={(e) =>
                        change(index, "description", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Tipo
                    <select
                      value={item.kind}
                      onChange={(e) => change(index, "kind", e.target.value)}
                    >
                      <option value="PART">Pieza</option>
                      <option value="LABOR">Mano de obra</option>
                    </select>
                  </label>
                  <label>
                    Cantidad
                    <input
                      required
                      type="number"
                      min="0.01"
                      max="10000"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) =>
                        change(index, "quantity", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Precio USD
                    <input
                      required
                      type="number"
                      min="0"
                      max="1000000"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) =>
                        change(index, "unit_price", e.target.value)
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="ws-secondary"
                    disabled={items.length === 1}
                    onClick={() =>
                      setItems((previous) =>
                        previous.filter((_, i) => i !== index),
                      )
                    }
                  >
                    Quitar
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="ws-secondary"
                disabled={items.length >= 100}
                onClick={() => setItems((previous) => [...previous, blank()])}
              >
                Agregar concepto
              </button>
              <label>
                Válida hasta
                <input
                  required
                  name="valid_until"
                  type="date"
                  min={localDateInput()}
                />
              </label>
              <label>
                Alcance y condiciones
                <textarea name="notes" maxLength={2000} />
              </label>
              <div className="at-quote-total-bar">
                <span>Total estimado del borrador</span>
                <strong>
                  $
                  {items
                    .reduce(
                      (sum, it) =>
                        sum +
                        (Number(it.quantity) || 0) *
                          (Number(it.unit_price) || 0),
                      0,
                    )
                    .toFixed(2)}{" "}
                  USD
                </strong>
              </div>
              <button
                className="ws-primary"
                onClick={(e) => {
                  if (!hasDiagnosis) {
                    e.preventDefault();
                    setError("");
                    setMissingDiagnosis(true);
                  }
                }}
              >
                Guardar borrador
              </button>
            </fieldset>
          </form>
        )}
    </section>
  );
}
