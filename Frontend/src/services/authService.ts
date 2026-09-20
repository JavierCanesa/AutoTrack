export interface AuthUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'ADMIN' | 'MECHANIC' | 'CLIENT';
}

export interface Session {
  access_token: string;
  expires_in: number;
  user: AuthUser;
}

export async function login(email: string, password: string): Promise<Session> {
  let response: Response;
  try {
    response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error('No se pudo conectar. Comprueba que FastAPI esté ejecutándose.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof data?.detail === 'string' ? data.detail : 'No se pudo iniciar sesión. Revisa los datos e intenta nuevamente.');
  }
  return data;
}
