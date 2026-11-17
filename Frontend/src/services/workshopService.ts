import { authenticatedFetch, readResponse } from './authService';
import type { ManagedUser } from './userService';
export type Status = 'RECEIVED' | 'DIAGNOSIS' | 'WAITING_APPROVAL' | 'IN_REPAIR' | 'TESTING' | 'COMPLETED' | 'DELIVERED' | 'CANCELLED';
export const labels: Record<Status, string> = { RECEIVED: 'Recibido', DIAGNOSIS: 'En diagnóstico', WAITING_APPROVAL: 'Esperando autorización', IN_REPAIR: 'En reparación', TESTING: 'En pruebas', COMPLETED: 'Reparado', DELIVERED: 'Entregado', CANCELLED: 'Cancelado' };
export interface Vehicle { vehicle_type?: string | null; id: string; client_id: string; plate: string; brand: string; model: string; vehicle_year: number | null; color: string | null; vin: string | null }
export interface Order { quote_status?: string | null; id: string; vehicle_id: string; mechanic_id: string | null; service_type_id: string | null; status: Status; entry_date: string; description: string | null; completion_date: string | null; vehicle: Vehicle; service_type: { id: string; name: string } | null }
export function orderLabel(order: Order) { return order.status === 'WAITING_APPROVAL' && order.quote_status === 'ACCEPTED' ? 'Cotización aceptada — Comenzar reparación' : order.status === 'WAITING_APPROVAL' && order.quote_status === 'REJECTED' ? 'Cotización rechazada' : labels[order.status]; }
export interface Update { id: string; status: Status; comment: string | null; created_at: string }
export interface Photo { id: string; file_name: string; service_update_id: string }
export interface Detail extends Order { client: {first_name: string; last_name: string; client_code: string}; quote_status: string | null; diagnoses: { id: string; description: string; symptoms?: string; created_at: string }[]; parts: { id: string; part_name: string; action: 'REPAIR' | 'REPLACE'; priority: 'HIGH' | 'MEDIUM' | 'LOW'; notes: string | null }[]; updates: Update[]; photos: Photo[]; allowed_statuses: Status[] }
export interface Report { total_clients: number; total_mechanics: number; pending_quotes: number; unassigned_orders: number; by_brand: Record<string, number>; total_orders: number; active_orders: number; total_vehicles: number; by_status: Partial<Record<Status, number>>; by_mechanic: { id: string; first_name: string; last_name: string; active_orders: number }[] }
export async function api<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const response = await authenticatedFetch(`/api${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
  return readResponse<T>(response);
}

const PHOTO_UPLOAD_LIMIT = 5 * 1024 * 1024;
const PHOTO_SOURCE_LIMIT = 30 * 1024 * 1024;
const DIRECT_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la fotografía. En iPhone selecciona una foto compatible o una captura de pantalla.'));
    };
    image.src = url;
  });
}

function jpegBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('No se pudo preparar la fotografía.')),
      'image/jpeg',
      quality,
    ),
  );
}

async function preparePhoto(file: File) {
  if (!file.size) throw new Error('Selecciona una fotografía.');
  if (file.size > PHOTO_SOURCE_LIMIT)
    throw new Error('La fotografía original debe pesar como máximo 30 MB.');
  if (DIRECT_PHOTO_TYPES.has(file.type) && file.size <= PHOTO_UPLOAD_LIMIT)
    return file;

  const image = await loadImage(file);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  if (!longestSide) throw new Error('La fotografía no contiene una imagen válida.');

  for (const maximumSide of [2560, 2048, 1600, 1280]) {
    const scale = Math.min(1, maximumSide / longestSide);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('El navegador no pudo preparar la fotografía.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.88, 0.75, 0.62]) {
      const blob = await jpegBlob(canvas, quality);
      if (blob.size <= PHOTO_UPLOAD_LIMIT) {
        const baseName = file.name.replace(/\.[^/.]+$/, '').trim().slice(0, 120) || 'foto';
        return new File([blob], `${baseName}.jpg`, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
      }
    }
  }
  throw new Error('No se pudo reducir la fotografía a 5 MB. Selecciona otra imagen.');
}

export async function uploadPhoto(orderId: string, updateId: string, file: File) {
  const prepared = await preparePhoto(file);
  const form = new FormData(); form.append('file', prepared);
  return readResponse<Photo>(await authenticatedFetch(`/api/work-orders/${orderId}/updates/${updateId}/photos`, { method: 'POST', body: form }));
}
export async function loadPhoto(orderId: string, photoId: string) {
  const response = await authenticatedFetch(`/api/work-orders/${orderId}/photos/${photoId}`);
  if (!response.ok) await readResponse(response);
  return URL.createObjectURL(await response.blob());
}

export async function people(): Promise<ManagedUser[]> {
  const result: ManagedUser[] = [];
  for (let page = 1; ; page++) {
    const data = await api<{ users: ManagedUser[] }>(`/users?page=${page}&per_page=100`);
    result.push(...data.users.filter(person => !person.deleted && person.profile_exists));
    if (data.users.length < 100) return result;
  }
}
