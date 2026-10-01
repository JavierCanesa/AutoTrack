import { useEffect, useState, type SubmitEvent } from "react";
import { type AuthUser, refreshSession } from "../services/authService";
import { api } from "../services/workshopService";
import { PERSON_NAME_PATTERN, PHONE_PATTERN } from "../validation";
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
  async function save(e: SubmitEvent<HTMLFormElement>) {
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
      setNotice("Perfil guardado.");
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
  return (
    <section className="ws-panel ws-progress">
      <h2>Mis datos personales</h2>
      <p>{user.email}</p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {profile && (
        <form onSubmit={save}>
          <fieldset disabled={busy}>
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
            <label>
              Teléfono
              <input
                name="phone"
                type="tel"
                pattern={PHONE_PATTERN}
                title="Escribe de 8 a 15 dígitos; puedes usar espacios, paréntesis, guiones o un + inicial."
                maxLength={30}
                defaultValue={profile.phone || ""}
              />
            </label>
            <button className="ws-primary">Guardar mi perfil</button>
          </fieldset>
        </form>
      )}
    </section>
  );
}
