export interface ServiceType {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export async function getServiceTypes(): Promise<ServiceType[]> {
  let response: Response;
  try {
    response = await fetch('/api/service-types');
  } catch {
    throw new Error('No se pudo conectar. Comprueba que el frontend y FastAPI estén ejecutándose.');
  }
  if (!response.ok) {
    if (response.status === 503) {
      throw new Error('Configura SUPABASE_URL y SUPABASE_KEY en Backend/.env y reinicia FastAPI.');
    }
    throw new Error('No se pudieron cargar los servicios. Revisa FastAPI, la conexión y los permisos de Supabase.');
  }
  return response.json();
}
