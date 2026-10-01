export interface AuthUser {
  client_code?: string;
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: "ADMIN" | "MECHANIC" | "CLIENT";
}
export interface Session {
  access_token: string;
  expires_in: number;
  user: AuthUser;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
let current: Session | null = null;
let expiresAt = 0;
let generation = 0;
let refreshing: Promise<Session> | null = null;
const listeners = new Set<(session: Session | null) => void>();
export function subscribeSession(listener: (session: Session | null) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function publish(session: Session | null) {
  current = session;
  expiresAt = session ? Date.now() + session.expires_in * 1000 : 0;
  listeners.forEach((listener) => listener(session));
}
export async function readResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      typeof data?.detail === "string"
        ? data.detail
        : "No se pudo completar la solicitud.",
      response.status,
    );
  if (!data)
    throw new ApiError(
      "La API no devolvió datos válidos. Revisa la conexión con FastAPI.",
      502,
    );
  return data;
}
async function authRequest<T>(
  path: string,
  body?: unknown,
  token?: string,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/auth/${path}`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("No se pudo conectar con FastAPI.", 0);
  }
  return readResponse<T>(response);
}
export async function login(email: string, password: string): Promise<Session> {
  const result = await authRequest<Session>("login", { email, password });
  generation++;
  publish(result);
  return result;
}
export const register = (data: {
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string;
  password: string;
}) => authRequest<{ message: string }>("register", data);
export function refreshSession(): Promise<Session> {
  if (refreshing) return refreshing;
  const started = generation;
  const run = () => authRequest<Session>("refresh");
  // Las pestañas comparten la cookie; serializar evita renovar dos veces el mismo token.
  const operation = (async () =>
    navigator.locks
      ? await navigator.locks.request("autotrack-refresh", run)
      : await run())();
  refreshing = operation
    .then((result) => {
      if (generation === started) publish(result);
      return result;
    })
    .catch((error) => {
      if (
        generation === started &&
        error instanceof ApiError &&
        [401, 403].includes(error.status)
      )
        publish(null);
      throw error;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}
export async function logout() {
  if (refreshing) await refreshing.catch(() => undefined);
  await authRequest<void>("logout", undefined, current?.access_token);
  generation++;
  publish(null);
}
export async function authenticatedFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!current || Date.now() >= expiresAt - 15000) await refreshSession();
  const send = () =>
    fetch(path, {
      ...init,
      credentials: "same-origin",
      headers: {
        ...init.headers,
        Authorization: `Bearer ${current?.access_token}`,
      },
    });
  let response = await send();
  if (response.status === 401) {
    await refreshSession();
    response = await send();
  }
  return response;
}
