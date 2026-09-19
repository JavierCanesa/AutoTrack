import { useState } from 'react';
import { getServiceTypes, type ServiceType } from './services/serviceTypeService';

export default function App() {
  const [services, setServices] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  async function loadServices() {
    setLoading(true);
    setError('');
    setLoaded(false);
    try {
      setServices(await getServiceTypes());
      setLoaded(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ocurrió un error al consultar los servicios.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <header><span className="brand">AutoTrack</span><span>Gestión del taller</span></header>
      <section>
        <p className="eyebrow">CATÁLOGO DEL TALLER</p>
        <h1>Tipos de servicio</h1>
        <p>Consulta los servicios disponibles en el taller.</p>
        <button onClick={loadServices} disabled={loading}>
          {loading ? 'Consultando…' : 'Consultar servicios'}
        </button>
        <div aria-live="polite">
          {error && <p role="alert" className="error">{error}</p>}
          {loaded && services.length === 0 && <p>No hay servicios disponibles para mostrar.</p>}
          {loaded && <ul>{services.map(service => (
            <li key={service.id}><h2>{service.name}</h2><p>{service.description || 'Sin descripción.'}</p></li>
          ))}</ul>}
        </div>
      </section>
    </main>
  );
}
