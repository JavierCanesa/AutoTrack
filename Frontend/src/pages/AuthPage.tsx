import { useState, type SubmitEvent } from "react";
import "../styles/auth.css";
import { login, register, type Session } from "../services/authService";
import {
  PERSON_NAME_PATTERN,
  PHONE_PATTERN,
  passwordValidationError,
} from "../validation";

type AuthMode = "login" | "register";

export default function AuthPage({
  onLogin,
}: {
  onLogin: (session: Session) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const registering = mode === "register";

  function changeMode(next: AuthMode) {
    if (loading) return;
    setMode(next);
    setVisible(false);
    setMessage("");
    setError("");
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const form = event.currentTarget;
    setMessage("");
    setError("");
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password"));
    if (
      registering &&
      (!String(data.get("first_name")).trim() ||
        !String(data.get("last_name")).trim())
    ) {
      setError("Escribe tu nombre y apellido.");
      return;
    }
    const passwordError = registering
      ? passwordValidationError(password)
      : null;
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (registering && password !== data.get("confirmation")) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      if (registering) {
        const result = await register({
          first_name: String(data.get("first_name")).trim(),
          last_name: String(data.get("last_name")).trim(),
          phone: String(data.get("phone") || "").trim() || null,
          email: String(data.get("email")).trim(),
          password,
        });
        form.reset();
        setMessage(result.message);
        return;
      }
      const session = await login(
        String(data.get("email")).trim(),
        String(data.get("password")),
      );
      form.reset();
      onLogin(session);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "No se pudo iniciar sesión.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-stage">
      <div className="auth-shell">
        <aside className="auth-intro">
          <a href="/" className="auth-brand" aria-label="AutoTrack, inicio">
            <img className="auth-logo" src="/img/AutoTrackLogo.png" alt="" />{" "}
            AutoTrack
          </a>
          <div className="auth-intro-content">
            <span className="auth-kicker">TU TALLER, MÁS CERCA</span>
            <h1>
              Tu vehículo.
              <br />
              Cada avance.
              <br />
              <em>En un solo lugar.</em>
            </h1>
            <p>
              Conoce qué está pasando con tu vehículo y acompaña cada etapa de
              su reparación.
            </p>
            <div className="auth-features">
              <div>
                <span aria-hidden="true">01</span>
                <div>
                  <strong>Seguimiento del servicio</strong>
                  <p>Consulta el estado de cada trabajo.</p>
                </div>
              </div>
              <div>
                <span aria-hidden="true">02</span>
                <div>
                  <strong>Evidencia del progreso</strong>
                  <p>Diagnósticos y fotografías del taller.</p>
                </div>
              </div>
              <div>
                <span aria-hidden="true">03</span>
                <div>
                  <strong>Tu historial, organizado</strong>
                  <p>Todos tus servicios a mano.</p>
                </div>
              </div>
            </div>
          </div>
          <p className="auth-intro-footer">GESTIÓN Y SEGUIMIENTO VEHICULAR</p>
        </aside>
        <main className="auth-main">
          <div className="auth-card">
            <div
              className="auth-mode"
              role="group"
              aria-label="Acceso a tu cuenta"
            >
              <button
                type="button"
                aria-pressed={!registering}
                onClick={() => changeMode("login")}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                aria-pressed={registering}
                onClick={() => changeMode("register")}
              >
                Registrarse
              </button>
            </div>
            <div className="auth-heading">
              <p className="auth-overline">BIENVENIDO A AUTOTRACK</p>
              <h2>
                {registering ? "Crea tu cuenta" : "Qué gusto verte de nuevo"}
              </h2>
              <p>
                {registering
                  ? "Regístrate como cliente y sigue el cuidado de tu vehículo."
                  : "Ingresa para continuar con el seguimiento de tu vehículo."}
              </p>
            </div>
            <form key={mode} onSubmit={submit} className="auth-form">
              {registering && (
                <div className="auth-name-row">
                  <label htmlFor="first-name">
                    Nombre
                    <input
                      id="first-name"
                      name="first_name"
                      autoComplete="given-name"
                      placeholder="Tu nombre"
                      pattern={PERSON_NAME_PATTERN}
                      title="Usa letras, espacios, puntos, apóstrofes o guiones."
                      maxLength={100}
                      required
                    />
                  </label>
                  <label htmlFor="last-name">
                    Apellido
                    <input
                      id="last-name"
                      name="last_name"
                      autoComplete="family-name"
                      placeholder="Tu apellido"
                      pattern={PERSON_NAME_PATTERN}
                      title="Usa letras, espacios, puntos, apóstrofes o guiones."
                      maxLength={100}
                      required
                    />
                  </label>
                </div>
              )}
              <label htmlFor="email">
                Correo electrónico
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="nombre@correo.com"
                  required
                  maxLength={254}
                />
              </label>
              {registering && (
                <label htmlFor="phone">
                  Teléfono <span className="auth-optional">(opcional)</span>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="Ej. 7000 0000"
                    pattern={PHONE_PATTERN}
                    title="Escribe de 8 a 15 dígitos; puedes usar espacios, paréntesis, guiones o un + inicial."
                    maxLength={30}
                  />
                </label>
              )}
              <label htmlFor="password">Contraseña</label>
              <div className="auth-password">
                <input
                  id="password"
                  name="password"
                  type={visible ? "text" : "password"}
                  autoComplete={
                    registering ? "new-password" : "current-password"
                  }
                  placeholder={
                    registering
                      ? "Mayúscula, minúscula, número y símbolo"
                      : "Ingresa tu contraseña"
                  }
                  minLength={registering ? 8 : undefined}
                  maxLength={4096}
                  required
                  aria-describedby={registering ? "password-hint" : undefined}
                />
                <button
                  type="button"
                  onClick={() => setVisible(!visible)}
                  aria-label={
                    visible ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  aria-pressed={visible}
                >
                  {visible ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              {registering && (
                <>
                  <small id="password-hint">
                    Usa 8 o más caracteres con mayúscula, minúscula, número y
                    símbolo.
                  </small>
                  <label htmlFor="confirmation">
                    Confirmar contraseña
                    <input
                      id="confirmation"
                      name="confirmation"
                      type={visible ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Repite tu contraseña"
                      minLength={8}
                      maxLength={4096}
                      required
                    />
                  </label>
                </>
              )}
              {error && (
                <p className="auth-feedback auth-error" role="alert">
                  {error}
                </p>
              )}
              {message && (
                <p className="auth-feedback" role="status">
                  {message}
                </p>
              )}
              <button className="auth-submit" type="submit" disabled={loading}>
                {loading
                  ? "Procesando…"
                  : registering
                    ? "Crear mi cuenta"
                    : "Iniciar sesión"}{" "}
                <span aria-hidden="true">→</span>
              </button>
            </form>
            <p className="auth-switch">
              {registering
                ? "¿Ya tienes una cuenta?"
                : "¿Es tu primera visita?"}{" "}
              <button
                type="button"
                onClick={() => changeMode(registering ? "login" : "register")}
              >
                {registering ? "Inicia sesión" : "Crea tu cuenta"}
              </button>
            </p>
            <p className="auth-preview">
              {registering
                ? "Las cuentas registradas aquí son de clientes. El taller asigna los demás roles."
                : "Accede con el correo y la contraseña de tu cuenta."}
            </p>
          </div>
          <footer className="auth-footer">
            AutoTrack <span>Una mejor experiencia para tu vehículo.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
