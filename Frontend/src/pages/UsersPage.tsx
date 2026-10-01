import { people } from "../services/workshopService";
import ConfirmDialog from "../components/ConfirmDialog";
import { useEffect, useState, type SubmitEvent } from "react";
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
        : { ...empty },
    );
    setShowForm(true);
    setDeleting(null);
    setError("");
    setNotice("");
  }

  async function save(event: SubmitEvent<HTMLFormElement>) {
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
          ? "Perfil actualizado."
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

  return (
    <article className="ws-panel">
      <div className="ws-panel-title">
        <div>
          <h2>Usuarios del sistema</h2>
          <p>
            Datos reales de Supabase. Crea la cuenta una sola vez; su perfil usa
            el mismo ID.
          </p>
        </div>
        <button
          className="ws-primary"
          disabled={busy}
          onClick={() => openForm(null)}
        >
          Crear usuario
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {showForm && (
        <form className="ws-progress" onSubmit={save}>
          <h3>{editing ? "Editar perfil" : "Crear cuenta y perfil"}</h3>
          {editing && (
            <p>
              ID: {editing.id}
              <br />
              Correo: {editing.email}. El correo y la contraseña se gestionan en
              Authentication.
            </p>
          )}
          <fieldset disabled={busy}>
            <label>
              Nombre
              <input
                required
                pattern={PERSON_NAME_PATTERN}
                title="Usa letras, espacios, puntos, apóstrofes o guiones."
                maxLength={100}
                value={input.first_name}
                onChange={(e) =>
                  setInput({ ...input, first_name: e.target.value })
                }
              />
            </label>
            <label>
              Apellido
              <input
                required
                pattern={PERSON_NAME_PATTERN}
                title="Usa letras, espacios, puntos, apóstrofes o guiones."
                maxLength={100}
                value={input.last_name}
                onChange={(e) =>
                  setInput({ ...input, last_name: e.target.value })
                }
              />
            </label>
            <label>
              Teléfono
              <input
                type="tel"
                pattern={PHONE_PATTERN}
                title="Escribe de 8 a 15 dígitos; puedes usar espacios, paréntesis, guiones o un + inicial."
                maxLength={30}
                value={input.phone || ""}
                onChange={(e) => setInput({ ...input, phone: e.target.value })}
              />
            </label>
            <label>
              Rol
              <select
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
            </label>
            {!editing && (
              <>
                <label>
                  Correo
                  <input
                    required
                    type="email"
                    maxLength={254}
                    autoComplete="off"
                    value={input.email}
                    onChange={(e) =>
                      setInput({ ...input, email: e.target.value })
                    }
                  />
                </label>
                <label>
                  Contraseña inicial
                  <input
                    required
                    type="password"
                    minLength={8}
                    maxLength={4096}
                    autoComplete="new-password"
                    value={input.password}
                    onChange={(e) =>
                      setInput({ ...input, password: e.target.value })
                    }
                  />
                </label>
                <p>
                  Cuenta creada por el administrador con el correo confirmado.
                  La contraseña se envía solo a Auth.
                </p>
              </>
            )}
            <button className="ws-primary" type="submit">
              {busy ? "Guardando…" : "Guardar"}
            </button>{" "}
            <button
              className="ws-secondary"
              type="button"
              onClick={() => {
                setShowForm(false);
                setInput({ ...empty });
              }}
            >
              Cancelar
            </button>
          </fieldset>
        </form>
      )}
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
      {loading ? (
        <p role="status">Cargando usuarios…</p>
      ) : (
        <>
          <div className="ws-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre / Correo</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>
                        {user.first_name} {user.last_name}
                      </strong>
                      <small>{user.email || "Correo no disponible"}</small>
                      <small>{user.id}</small>
                    </td>
                    <td>{user.role || "Sin perfil"}</td>
                    <td>
                      {user.deleted
                        ? "Eliminado"
                        : !user.profile_exists
                          ? "Falta perfil"
                          : !user.email_confirmed
                            ? "Correo sin confirmar"
                            : "Activo"}
                    </td>
                    <td>
                      <button
                        className="ws-text-button"
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
                ))}
              </tbody>
            </table>
          </div>
          {users.length === 0 && <p>No hay usuarios en esta página.</p>}
          <button
            className="ws-secondary"
            disabled={!!initialRole || page === 1 || busy}
            onClick={() => setPage((value) => value - 1)}
          >
            Anterior
          </button>{" "}
          <span>Página {page}</span>{" "}
          <button
            className="ws-secondary"
            disabled={!!initialRole || users.length < 20 || busy}
            onClick={() => setPage((value) => value + 1)}
          >
            Siguiente
          </button>{" "}
          <button
            className="ws-secondary"
            disabled={busy}
            onClick={() => setReload((value) => value + 1)}
          >
            Actualizar lista
          </button>
        </>
      )}
    </article>
  );
}
