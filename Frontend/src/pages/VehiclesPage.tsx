import VehicleFields from "../components/VehicleFields";
import ConfirmDialog from "../components/ConfirmDialog";
import { useEffect, useState, type SubmitEvent } from "react";
import type { AuthUser } from "../services/authService";
import type { ManagedUser } from "../services/userService";
import { api, people, type Vehicle } from "../services/workshopService";

export default function VehiclesPage({
  user,
  onHistory,
}: {
  user: AuthUser;
  onHistory: (vehicleId: string) => void;
}) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [clients, setClients] = useState<ManagedUser[]>([]);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const [deleting, setDeleting] = useState<Vehicle | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      api<Vehicle[]>("/vehicles"),
      user.role === "ADMIN" ? people() : Promise.resolve([]),
    ])
      .then(([v, p]) => {
        if (active) {
          setVehicles(v);
          setClients(p.filter((person) => person.role === "CLIENT"));
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
  }, [reload, user.role]);
  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const data = {
      client_id: user.role === "CLIENT" ? user.id : form.get("client_id"),
      plate: form.get("plate"),
      brand: form.get("brand"),
      model: form.get("model"),
      vehicle_year: form.get("vehicle_year")
        ? Number(form.get("vehicle_year"))
        : null,
      color: form.get("color") || null,
      vin: String(form.get("vin") || "").trim().toUpperCase() || null,
      vehicle_type: form.get("vehicle_type"),
    };
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(
        `/vehicles${editing ? `/${editing.id}` : ""}`,
        editing ? "PUT" : "POST",
        data,
      );
      setShow(false);
      setReload((n) => n + 1);
      setNotice("Vehículo guardado.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!deleting || busy) return;
    setBusy(true);
    setError("");
    try {
      await api(`/vehicles/${deleting.id}`, "DELETE");
      setDeleting(null);
      setReload((n) => n + 1);
      setNotice("Vehículo eliminado.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar.");
    } finally {
      setBusy(false);
    }
  }
  const filtered = vehicles.filter((v) =>
    `${v.plate} ${v.brand} ${v.model}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <article className="ws-panel">
      <div className="ws-panel-title">
        <h2>
          {user.role === "ADMIN" ? "Vehículos del taller" : "Mis vehículos"}
        </h2>
        {(user.role === "ADMIN" || user.role === "CLIENT") && (
          <button
            className="ws-primary"
            disabled={busy || loading}
            onClick={() => {
              setEditing(null);
              setShow(true);
              setDeleting(null);
            }}
          >
            {user.role === "CLIENT"
              ? "Registrar mi vehículo"
              : "Crear vehículo"}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {show && (
        <form
          key={editing?.id || "new"}
          className="ws-progress"
          onSubmit={save}
        >
          <h3>{editing ? "Editar vehículo" : "Nuevo vehículo"}</h3>
          <fieldset disabled={busy}>
            {user.role === "ADMIN" && (
              <label>
                Cliente
                <select
                  name="client_id"
                  required
                  defaultValue={editing?.client_id || ""}
                >
                  <option value="">Selecciona un cliente</option>
                  {clients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.first_name} {p.last_name} · {p.email}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <VehicleFields vehicle={editing} />
            <div className="ws-actions">
              <button type="submit" className="ws-primary">
                {busy ? "Guardando…" : "Guardar vehículo"}
              </button>
              <button
                type="button"
                className="ws-secondary"
                onClick={() => setShow(false)}
              >
                Cancelar
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {deleting && (
        <ConfirmDialog
          busy={busy}
          onAccept={remove}
          onCancel={() => setDeleting(null)}
        >
          <p>
            ¿Eliminar el vehículo {deleting.plate}? Solo se permite si no tiene
            órdenes.
          </p>
          {error && <p role="alert">{error}</p>}
        </ConfirmDialog>
      )}
      <div className="ws-filters">
        <label>
          Buscar vehículo
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      {loading ? (
        <p role="status">Cargando vehículos…</p>
      ) : (
        <div className="ws-vehicles">
          {filtered.map((v) => (
            <article className="ws-vehicle" key={v.id}>
              <h3>
                {v.brand} {v.model}
              </h3>
              <strong>{v.plate}</strong>
              <p>
                {v.vehicle_year || "Año sin indicar"} ·{" "}
                {v.color || "Color sin indicar"}
              </p>
              {(user.role === "ADMIN" || user.role === "CLIENT") && (
                <div className="ws-actions">
                  <button
                    disabled={busy}
                    className="ws-secondary"
                    onClick={() => {
                      setEditing(v);
                      setShow(true);
                      setDeleting(null);
                    }}
                  >
                    Editar
                  </button>
                  <button
                    disabled={busy}
                    className="ws-text-button"
                    onClick={() => {
                      setDeleting(v);
                      setShow(false);
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              )}
              {user.role === "CLIENT" && (
                <button className="ws-primary" onClick={() => onHistory(v.id)}>
                  Ver historial de este vehículo
                </button>
              )}
            </article>
          ))}
        </div>
      )}
      {!loading && !filtered.length && <p>No hay vehículos para mostrar.</p>}
      <button
        className="ws-secondary"
        disabled={busy || loading}
        onClick={() => setReload((n) => n + 1)}
      >
        Actualizar
      </button>
    </article>
  );
}
