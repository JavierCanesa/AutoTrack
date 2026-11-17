import { people } from "../services/workshopService";
import ConfirmDialog from "../components/ConfirmDialog";
import Modal from "../components/Modal";
import { TableSkeleton } from "../components/Skeleton";
import EmptyState from "../components/EmptyState";
import { useEffect, useState, type FormEvent } from "react";
import {
  createUser,
  deleteUser,
  listUsers,
  updateUser,
  type ManagedUser,
  type UserInput,
} from "../services/userService";
import { PERSON_NAME_PATTERN, PHONE_PATTERN } from "../validation";

type Props = { token: string; currentUserId: string; initialRole?: string };
const empty: UserInput = {
  first_name: "",
  last_name: "",
  phone: "",
  role: "CLIENT",
  email: "",
  password: "",
};

const roleLabels: Record<string, string> = {
  ADMIN: "Administrador",
  MECHANIC: "Mecánico",
  CLIENT: "Cliente",
};

export default function UsersPage({
  token,
  currentUserId,
  initialRole,
}: Props) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [input, setInput] = useState<UserInput>(empty);
  const [deleting, setDeleting] = useState<ManagedUser | null>(null);
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    (initialRole
      ? people().then((users) => ({
          users: users.filter((user) => user.role === initialRole),
        }))
      : listUsers(token, page)
    )
      .then((result) => {
        if (!cancelled) setUsers(result.users);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, page, reload, initialRole]);

  function openForm(user: ManagedUser | null) {
    setEditing(user);
    setInput(
      user
        ? {
            first_name: user.first_name,
            last_name: user.last_name,
            phone: user.phone || "",
            role: user.role || "CLIENT",
            email: user.email || "",
            password: "",
          }
        : {
            ...empty,
            role: (initialRole as UserInput["role"]) || "CLIENT",
          },
    );
    setShowForm(true);
    setDeleting(null);
    setError("");
    setNotice("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const normalized = {
        ...input,
        first_name: input.first_name.trim(),
        last_name: input.last_name.trim(),
        phone: input.phone?.trim() || null,
        email: input.email.trim().toLowerCase(),
      };
      if (editing) await updateUser(token, editing.id, normalized);
      else await createUser(token, normalized);
      setShowForm(false);
      setInput({ ...empty });
      setNotice(
        editing
          ? "Perfil actualizado con éxito."
          : "Cuenta creada. El UUID de Auth y del perfil es el mismo.",
      );
      setReload((value) => value + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await deleteUser(token, deleting.id);
      setDeleting(null);
      setNotice(
        "Cuenta eliminada de forma lógica. Se conservan su perfil y el historial del taller.",
      );
      setReload((value) => value + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar.");
    } finally {
      setBusy(false);
    }
  }

  const filtered = users.filter((u) => {
    const matchesRole = !roleFilter || u.role === roleFilter;
    const matchesQuery =
      `${u.first_name} ${u.last_name} ${u.email || ""} ${u.id}`
        .toLowerCase()
        .includes(query.toLowerCase());
    return matchesRole && matchesQuery;
  });

  const hasFilters = !!(query || roleFilter);
  const isMechanicsView = initialRole === "MECHANIC";

  return (
    <article className="ws-panel">
      <div className="ws-panel-title">
        <div>
          <h2>
            {isMechanicsView ? "Mecánicos del taller" : "Usuarios del sistema"}
          </h2>
          <p>
            {isMechanicsView
              ? "Personal técnico registrado para diagnóstico y reparación de órdenes."
              : "Datos reales de Supabase. Crea la cuenta una sola vez; su perfil usa el mismo ID."}
          </p>
        </div>
        <button
          className="ws-primary"
          disabled={busy}
          onClick={() => openForm(null)}
        >
          {isMechanicsView ? "Registrar mecánico" : "Crear usuario"}
        </button>
      </div>

      {error && !showForm && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && (
        <div className="at-notice-banner" role="status">
          {notice}
        </div>
      )}

      {/* Modal Reutilizable para Crear / Editar Usuario */}
      <Modal
        isOpen={showForm}
        onClose={() => {
          if (!busy) {
            setShowForm(false);
            setInput({ ...empty });
            setError("");
          }
        }}
        title={editing ? "Editar perfil" : "Crear nuevo usuario"}
        subtitle={
          editing ? (
            <>
              <div>
                ID: <code>{editing.id}</code>
              </div>
              <div>
                Correo: <strong>{editing.email}</strong>. El correo y la
                contraseña se gestionan en Authentication.
              </div>
            </>
          ) : (
            "Registra un nuevo usuario para otorgarle acceso a AutoTrack."
          )
        }
        icon={
          editing ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
          )
        }
        onSubmit={save}
        primaryLabel={editing ? "Guardar" : "Crear usuario"}
        secondaryLabel="Cancelar"
        busy={busy}
        error={error}
      >
        <div className="at-modal-grid-2">
          <div className="at-form-field">
            <label className="at-form-label" htmlFor="user-first-name">
              Nombre <span className="at-required-star">*</span>
            </label>
            <input
              id="user-first-name"
              className="at-form-input"
              required
              pattern={PERSON_NAME_PATTERN}
              title="Usa letras, espacios, puntos, apóstrofes o guiones."
              maxLength={100}
              placeholder="Ej. Juan"
              value={input.first_name}
              onChange={(e) =>
                setInput({ ...input, first_name: e.target.value })
              }
            />
          </div>

          <div className="at-form-field">
            <label className="at-form-label" htmlFor="user-last-name">
              Apellido <span className="at-required-star">*</span>
            </label>
            <input
              id="user-last-name"
              className="at-form-input"
              required
              pattern={PERSON_NAME_PATTERN}
              title="Usa letras, espacios, puntos, apóstrofes o guiones."
              maxLength={100}
              placeholder="Ej. Pérez"
              value={input.last_name}
              onChange={(e) =>
                setInput({ ...input, last_name: e.target.value })
              }
            />
          </div>
        </div>

        <div className="at-modal-grid-2">
          <div className="at-form-field">
            <label className="at-form-label" htmlFor="user-phone">
              Teléfono
            </label>
            <input
              id="user-phone"
              className="at-form-input"
              type="tel"
              pattern={PHONE_PATTERN}
              title="Escribe de 8 a 15 dígitos; puedes usar espacios, paréntesis, guiones o un + inicial."
              maxLength={30}
              placeholder="Ej. +502 1234 5678"
              value={input.phone || ""}
              onChange={(e) => setInput({ ...input, phone: e.target.value })}
            />
          </div>

          <div className="at-form-field">
            <label className="at-form-label" htmlFor="user-role">
              Rol
            </label>
            <select
              id="user-role"
              className="at-form-select"
              value={input.role}
              disabled={editing?.role === "ADMIN"}
              onChange={(e) =>
                setInput({
                  ...input,
                  role: e.target.value as UserInput["role"],
                })
              }
            >
              <option value="CLIENT">Cliente</option>
              <option value="MECHANIC">Mecánico</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>
        </div>

        {!editing && (
          <>
            <div className="at-modal-grid-2">
              <div className="at-form-field">
                <label className="at-form-label" htmlFor="user-email">
                  Correo <span className="at-required-star">*</span>
                </label>
                <input
                  id="user-email"
                  className="at-form-input"
                  required
                  type="email"
                  maxLength={254}
                  autoComplete="off"
                  placeholder="usuario@ejemplo.com"
                  value={input.email}
                  onChange={(e) =>
                    setInput({ ...input, email: e.target.value })
                  }
                />
              </div>

              <div className="at-form-field">
                <label className="at-form-label" htmlFor="user-password">
                  Contraseña inicial <span className="at-required-star">*</span>
                </label>
                <input
                  id="user-password"
                  className="at-form-input"
                  required
                  type="password"
                  minLength={8}
                  maxLength={4096}
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  value={input.password}
                  onChange={(e) =>
                    setInput({ ...input, password: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="at-modal-info-box">
              Cuenta creada por el administrador con el correo confirmado. La
              contraseña se envía solo a Auth.
            </div>
          </>
        )}
      </Modal>

      {deleting && (
        <ConfirmDialog
          busy={busy}
          onAccept={confirmDelete}
          onCancel={() => setDeleting(null)}
        >
          <p>
            ¿Eliminar la cuenta de {deleting.first_name || deleting.email}? Se
            conservará su historial.
          </p>
          {error && <p role="alert">{error}</p>}
        </ConfirmDialog>
      )}

      <div className="ws-filters">
        <label>
          {isMechanicsView ? "Buscar mecánico" : "Buscar usuario"}
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
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nombre, apellido, correo o ID…"
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
            {filtered.length} de {users.length}{" "}
            {isMechanicsView ? "mecánicos" : "usuarios"}
          </span>
        )}
      </div>

      {!initialRole && !loading && users.length > 0 && (
        <div
          className="at-status-chips"
          role="group"
          aria-label="Filtrar por rol"
        >
          <button
            type="button"
            className={`at-chip ${roleFilter === "" ? "is-active" : ""}`}
            onClick={() => setRoleFilter("")}
          >
            Todos <span className="at-chip-count">{users.length}</span>
          </button>
          {(
            [
              ["ADMIN", "Administradores"],
              ["MECHANIC", "Mecánicos"],
              ["CLIENT", "Clientes"],
            ] as const
          ).map(([key, label]) => {
            const count = users.filter((u) => u.role === key).length;
            if (!count && roleFilter !== key) return null;
            return (
              <button
                key={key}
                type="button"
                className={`at-chip ${roleFilter === key ? "is-active" : ""}`}
                onClick={() => setRoleFilter(roleFilter === key ? "" : key)}
              >
                {label} <span className="at-chip-count">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={5} columns={4} />
      ) : (
        <>
          {filtered.length === 0 ? (
            <EmptyState
              title={
                hasFilters
                  ? "Sin coincidencias"
                  : isMechanicsView
                    ? "No hay mecánicos registrados"
                    : "No hay usuarios en esta página"
              }
              description={
                hasFilters
                  ? "Prueba ajustando tu búsqueda o quitando el filtro de rol."
                  : "Crea una nueva cuenta o cambia de página para ver otros registros."
              }
              action={
                hasFilters ? (
                  <button
                    className="ws-secondary"
                    onClick={() => {
                      setQuery("");
                      setRoleFilter("");
                    }}
                  >
                    Limpiar filtros
                  </button>
                ) : (
                  <button
                    className="ws-primary"
                    disabled={busy}
                    onClick={() => openForm(null)}
                  >
                    {isMechanicsView ? "Registrar mecánico" : "Crear usuario"}
                  </button>
                )
              }
            />
          ) : (
            <div className="ws-table-wrap">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Nombre / Correo</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => {
                    const statusText = user.deleted
                      ? "Eliminado"
                      : !user.profile_exists
                        ? "Falta perfil"
                        : !user.email_confirmed
                          ? "Sin confirmar"
                          : "Activo";
                    const statusClass = user.deleted
                      ? "ws-cancelled"
                      : !user.profile_exists || !user.email_confirmed
                        ? "ws-waiting_approval"
                        : "ws-completed";
                    return (
                      <tr key={user.id}>
                        <td>
                          <strong>
                            {user.first_name} {user.last_name}
                          </strong>
                          <small>{user.email || "Correo no disponible"}</small>
                          <small>{user.id}</small>
                        </td>
                        <td>
                          <span
                            className={`at-role-pill ${
                              user.role === "ADMIN"
                                ? "is-admin"
                                : user.role === "MECHANIC"
                                  ? "is-mechanic"
                                  : ""
                            }`}
                          >
                            {roleLabels[user.role || ""] ||
                              user.role ||
                              "Sin perfil"}
                          </span>
                        </td>
                        <td>
                          <span className={`ws-badge ${statusClass}`}>
                            {statusText}
                          </span>
                        </td>
                        <td>
                          <button
                            className="at-table-action-btn"
                            disabled={user.deleted || busy}
                            onClick={() => openForm(user)}
                          >
                            Editar
                          </button>{" "}
                          <button
                            className="ws-text-button"
                            disabled={
                              user.deleted ||
                              user.id === currentUserId ||
                              user.role === "ADMIN" ||
                              busy
                            }
                            onClick={() => {
                              setDeleting(user);
                              setShowForm(false);
                              setError("");
                            }}
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="at-pagination">
            <div className="at-pagination-controls">
              <button
                className="ws-secondary"
                disabled={!!initialRole || page === 1 || busy}
                onClick={() => setPage((value) => value - 1)}
              >
                Anterior
              </button>
              <span className="at-page-indicator">Página {page}</span>
              <button
                className="ws-secondary"
                disabled={!!initialRole || users.length < 20 || busy}
                onClick={() => setPage((value) => value + 1)}
              >
                Siguiente
              </button>
            </div>
            <button
              className="ws-secondary"
              disabled={busy}
              onClick={() => setReload((value) => value + 1)}
            >
              Actualizar lista
            </button>
          </div>
        </>
      )}
    </article>
  );
}
