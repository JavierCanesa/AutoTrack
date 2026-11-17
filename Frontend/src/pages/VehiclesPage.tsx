import VehicleFields from "../components/VehicleFields";
import ConfirmDialog from "../components/ConfirmDialog";
import Modal from "../components/Modal";
import { CardGridSkeleton } from "../components/Skeleton";
import EmptyState from "../components/EmptyState";
import { useEffect, useState, type FormEvent } from "react";
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
      user.role === "ADMIN"
        ? people().then((list) => list.filter((p) => p.role === "CLIENT"))
        : Promise.resolve([]),
    ])
      .then(([v, c]) => {
        if (active) {
          setVehicles(v);
          setClients(c);
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

  async function save(event: FormEvent<HTMLFormElement>) {
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
      vin:
        String(form.get("vin") || "")
          .trim()
          .toUpperCase() || null,
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
      setEditing(null);
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
              setError("");
            }}
          >
            {user.role === "CLIENT"
              ? "Registrar mi vehículo"
              : "Crear vehículo"}
          </button>
        )}
      </div>

      {error && !show && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}

      {/* Modal Reutilizable para Vehículos */}
      <Modal
        key={editing?.id || "new"}
        isOpen={show}
        onClose={() => {
          if (!busy) {
            setShow(false);
            setEditing(null);
            setError("");
          }
        }}
        title={
          editing
            ? "Editar vehículo"
            : user.role === "CLIENT"
              ? "Registrar mi vehículo"
              : "Nuevo vehículo"
        }
        subtitle={
          editing ? (
            <div>
              Placa: <code>{editing.plate}</code> · {editing.brand}{" "}
              {editing.model}
            </div>
          ) : (
            "Ingresa los datos del vehículo para registrarlo en el taller."
          )
        }
        icon={
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 11.2 2 11.6 2 12v4c0 .6.4 1 1 1h2" />
            <circle cx="7" cy="17" r="2" />
            <path d="M9 17h6" />
            <circle cx="17" cy="17" r="2" />
          </svg>
        }
        onSubmit={save}
        primaryLabel={editing ? "Guardar" : "Guardar vehículo"}
        secondaryLabel="Cancelar"
        busy={busy}
        error={error}
      >
        {user.role === "ADMIN" && (
          <div className="at-form-field">
            <label className="at-form-label" htmlFor="vehicle-client">
              Cliente <span className="at-required-star">*</span>
            </label>
            <select
              id="vehicle-client"
              name="client_id"
              className="at-form-select"
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
          </div>
        )}
        <VehicleFields vehicle={editing} />
      </Modal>

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
          <div className="at-search-wrap">
            <span className="at-search-icon" aria-hidden="true">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="search"
              className="at-search-input"
              placeholder="Buscar por placa, marca o modelo…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                className="at-search-clear"
                aria-label="Limpiar búsqueda"
                onClick={() => setQuery("")}
              >
                ✕
              </button>
            )}
          </div>
        </label>
        {!loading && (
          <span className="at-filter-count">
            {filtered.length} de {vehicles.length} vehículos
          </span>
        )}
      </div>

      {loading ? (
        <CardGridSkeleton count={3} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={
            query
              ? "Sin coincidencias para tu búsqueda"
              : "No hay vehículos registrados"
          }
          description={
            query
              ? `No se encontraron vehículos que coincidan con "${query}".`
              : "Registra un nuevo vehículo para comenzar a gestionar sus órdenes y servicios."
          }
          action={
            query ? (
              <button
                className="ws-secondary"
                onClick={() => setQuery("")}
              >
                Limpiar búsqueda
              </button>
            ) : (user.role === "ADMIN" || user.role === "CLIENT") ? (
              <button
                className="ws-primary"
                disabled={busy}
                onClick={() => {
                  setEditing(null);
                  setShow(true);
                  setDeleting(null);
                  setError("");
                }}
              >
                {user.role === "CLIENT"
                  ? "Registrar mi vehículo"
                  : "Crear vehículo"}
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="ws-vehicles">
          {filtered.map((v) => (
            <article className="ws-vehicle" key={v.id}>
              <div>
                <div className="at-vehicle-header">
                  <h3 className="at-vehicle-title">
                    {v.brand} {v.model}
                  </h3>
                  <span className="at-plate-badge">{v.plate}</span>
                </div>
                <div className="at-vehicle-meta" style={{ marginTop: 12 }}>
                  <span className="at-meta-pill">
                    Año: {v.vehicle_year || "Sin indicar"}
                  </span>
                  <span className="at-meta-pill">
                    Color: {v.color || "Sin indicar"}
                  </span>
                  {v.vehicle_type && (
                    <span className="at-meta-pill">{v.vehicle_type}</span>
                  )}
                </div>
              </div>

              {(user.role === "ADMIN" || user.role === "CLIENT") && (
                <div className="at-vehicle-footer">
                  <div className="ws-actions">
                    <button
                      disabled={busy}
                      className="ws-secondary"
                      onClick={() => {
                        setEditing(v);
                        setShow(true);
                        setDeleting(null);
                        setError("");
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
                  {user.role === "CLIENT" && (
                    <button
                      className="ws-primary"
                      onClick={() => onHistory(v.id)}
                    >
                      Ver historial de este vehículo
                    </button>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      <div className="at-panel-footer">
        <button
          className="ws-secondary"
          disabled={busy || loading}
          onClick={() => setReload((n) => n + 1)}
        >
          Actualizar
        </button>
      </div>
    </article>
  );
}
