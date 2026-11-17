import { useEffect, useState, type FormEvent } from "react";
import { type AuthUser, refreshSession } from "../services/authService";
import { api } from "../services/workshopService";
import { PERSON_NAME_PATTERN, PHONE_PATTERN } from "../validation";
import { CardGridSkeleton } from "../components/Skeleton";

const roleLabels: Record<string, string> = {
  ADMIN: "Administrador",
  MECHANIC: "Mecánico",
  CLIENT: "Cliente",
};

export default function ProfilePage({ user }: { user: AuthUser }) {
  const [profile, setProfile] = useState<{
    first_name: string;
    last_name: string;
    phone: string | null;
  } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    api<typeof profile>("/auth/profile")
      .then((value) => {
        if (active) setProfile(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [user.id]);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = await api<typeof profile>("/auth/profile", "PATCH", {
        first_name: String(form.get("first_name") || "").trim(),
        last_name: String(form.get("last_name") || "").trim(),
        phone: String(form.get("phone") || "").trim() || null,
      });
      setProfile(saved);
      setNotice("Perfil guardado correctamente.");
      try {
        await refreshSession();
      } catch {
        setError(
          "El perfil se guardó, pero el nombre del menú se actualizará al volver a iniciar sesión.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  const initials = profile
    ? `${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`.toUpperCase() ||
      user.email?.[0]?.toUpperCase() ||
      "U"
    : user.email?.[0]?.toUpperCase() || "U";

  return (
    <section className="ws-panel ws-progress">
      <div className="at-profile-header">
        <div className="at-profile-avatar" aria-hidden="true">
          {initials}
        </div>
        <div className="at-profile-info">
          <h2>
            {profile
              ? `${profile.first_name} ${profile.last_name}`
              : "Mis datos personales"}
          </h2>
          <div className="at-profile-meta">
            <span>{user.email}</span>
            <span
              className={`at-role-pill ${
                user.role === "ADMIN"
                  ? "is-admin"
                  : user.role === "MECHANIC"
                    ? "is-mechanic"
                    : ""
              }`}
            >
              {roleLabels[user.role] || user.role}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && (
        <div className="at-notice-banner" role="status">
          {notice}
        </div>
      )}

      {!profile && !error ? (
        <CardGridSkeleton count={1} />
      ) : (
        profile && (
          <form onSubmit={save}>
            <fieldset disabled={busy}>
              <div className="at-profile-grid">
                <label>
                  Nombres
                  <input
                    name="first_name"
                    required
                    pattern={PERSON_NAME_PATTERN}
                    title="Usa letras, espacios, puntos, apóstrofes o guiones."
                    maxLength={100}
                    defaultValue={profile.first_name}
                  />
                </label>
                <label>
                  Apellidos
                  <input
                    name="last_name"
                    required
                    pattern={PERSON_NAME_PATTERN}
                    title="Usa letras, espacios, puntos, apóstrofes o guiones."
                    maxLength={100}
                    defaultValue={profile.last_name}
                  />
                </label>
              </div>
              <label>
                Teléfono
                <input
                  name="phone"
                  type="tel"
                  pattern={PHONE_PATTERN}
                  title="Escribe de 8 a 15 dígitos; puedes usar espacios, paréntesis, guiones o un + inicial."
                  maxLength={30}
                  placeholder="Ej. +502 1234 5678"
                  defaultValue={profile.phone || ""}
                />
              </label>
              <div style={{ marginTop: 18 }}>
                <button className="ws-primary" disabled={busy}>
                  {busy ? "Guardando…" : "Guardar mi perfil"}
                </button>
              </div>
            </fieldset>
          </form>
        )
      )}
    </section>
  );
}
