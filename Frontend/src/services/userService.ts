import { authenticatedFetch } from './authService';

export interface ManagedUser {
  id: string;
  email: string | null;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: 'ADMIN' | 'MECHANIC' | 'CLIENT' | null;
  profile_exists: boolean;
  deleted: boolean;
  email_confirmed: boolean;
}
export interface UserInput {
  first_name: string;
  last_name: string;
  phone: string | null;
  role: 'ADMIN' | 'MECHANIC' | 'CLIENT';
  email: string;
  password: string;
}
async function api<T>(token: string, path: string, method = 'GET', body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await authenticatedFetch(`/api/users${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch { throw new Error('No se pudo conectar con FastAPI.'); }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof data?.detail === 'string' ? data.detail : 'No se pudo completar la operación. Revisa los campos.');
  return data;
}
export const listUsers = (token: string, page: number) => api<{ users: ManagedUser[] }>(token, `?page=${page}&per_page=20`);
export const createUser = (token: string, input: UserInput) => api<ManagedUser>(token, '', 'POST', input);
export const updateUser = (token: string, id: string, input: UserInput) => {
  const { first_name, last_name, phone, role } = input;
  return api<ManagedUser>(token, `/${id}`, 'PUT', { first_name, last_name, phone, role });
};
export const deleteUser = (token: string, id: string) => api<void>(token, `/${id}`, 'DELETE');
