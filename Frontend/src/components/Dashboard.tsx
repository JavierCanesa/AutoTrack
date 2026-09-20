import { useState } from 'react';
import type { AuthUser } from '../services/authService';
import '../styles/dashboard.css';

type Status = 'RECEIVED' | 'DIAGNOSIS' | 'WAITING_APPROVAL' | 'IN_REPAIR' | 'TESTING' | 'COMPLETED' | 'DELIVERED' | 'CANCELLED';
type Order = { id: string; plate: string; vehicle: string; client: string; mechanic: string; service: string; status: Status; date: string; diagnosis: string; updates: string[] };
const labels: Record<Status, string> = { RECEIVED: 'Recibido', DIAGNOSIS: 'En revisión', WAITING_APPROVAL: 'Esperando autorización', IN_REPAIR: 'En reparación', TESTING: 'En pruebas', COMPLETED: 'Reparado', DELIVERED: 'Entregado', CANCELLED: 'Cancelado' };
const examples: Order[] = [
  { id: 'DEMO-001', plate: 'P123456', vehicle: 'Toyota Corolla · 2019', client: 'Ana López', mechanic: 'Carlos Pérez', service: 'Sistema de frenos', status: 'IN_REPAIR', date: '2026-09-18', diagnosis: 'Desgaste de pastillas delanteras. Se recomienda reemplazo y revisión de discos.', updates: ['18/09 · Vehículo recibido', '18/09 · Revisión de frenos completada', '19/09 · Reemplazo de pastillas en curso'] },
  { id: 'DEMO-002', plate: 'P234567', vehicle: 'Honda Civic · 2020', client: 'Luis García', mechanic: 'Carlos Pérez', service: 'Mantenimiento', status: 'DIAGNOSIS', date: '2026-09-19', diagnosis: 'Inspección de niveles, filtros y sistema eléctrico en curso.', updates: ['19/09 · Vehículo recibido', '19/09 · Inspección general iniciada'] },
  { id: 'DEMO-003', plate: 'P345678', vehicle: 'Kia Rio · 2021', client: 'Marta Díaz', mechanic: 'María Rodríguez', service: 'Cambio de aceite', status: 'COMPLETED', date: '2026-09-19', diagnosis: 'Cambio de aceite y filtro realizado. Niveles verificados.', updates: ['19/09 · Servicio iniciado', '19/09 · Servicio completado'] },
  { id: 'DEMO-004', plate: 'P123456', vehicle: 'Toyota Corolla · 2019', client: 'Ana López', mechanic: 'Carlos Pérez', service: 'Mantenimiento', status: 'DELIVERED', date: '2026-08-10', diagnosis: 'Mantenimiento preventivo completado sin observaciones.', updates: ['10/08 · Revisión completada', '10/08 · Vehículo entregado'] },
];
const roleNames = { ADMIN: 'Administrador', MECHANIC: 'Mecánico', CLIENT: 'Cliente' };
const menu = {
  ADMIN: ['Resumen', 'Órdenes de trabajo', 'Mecánicos'],
  MECHANIC: ['Mis órdenes', 'Trabajos completados'],
  CLIENT: ['Mis vehículos', 'Historial de servicios'],
};
const finished = (o: Order) => o.status === 'COMPLETED' || o.status === 'DELIVERED';
const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('es-SV');

function Badge({ status }: { status: Status }) {
  return <span className={`ws-badge ws-${status.toLowerCase()}`}><span aria-hidden="true">●</span> {labels[status]}</span>;
}

export default function Dashboard({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const role = user.role;
  const [page, setPage] = useState(menu[role][0]);
  const [openMenu, setOpenMenu] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [orders, setOrders] = useState(examples);
  const [notice, setNotice] = useState('');
  const [comment, setComment] = useState('');
  const [nextStatus, setNextStatus] = useState<Status>('IN_REPAIR');
  const visible = orders.filter(o => role === 'ADMIN' || (role === 'MECHANIC' ? o.mechanic === 'Carlos Pérez' : o.client === 'Ana López'));
  const isHistory = page === 'Historial de servicios' || page === 'Trabajos completados';
  const rows = visible.filter(o => (!isHistory || finished(o)) && (!status || o.status === status) && `${o.id} ${o.plate} ${o.vehicle} ${o.service} ${o.client}`.toLowerCase().includes(query.toLowerCase()));
  const detail = visible.find(o => o.id === selected);
  const active = visible.filter(o => !finished(o) && o.status !== 'CANCELLED');

  function navigate(next: string) { setPage(next); setSelected(null); setQuery(''); setStatus(''); setNotice(''); setOpenMenu(false); }
  function inspect(order: Order) { setSelected(order.id); setNextStatus(order.status); setComment(''); setNotice(''); }
  function saveProgress() {
    if (!detail || !comment.trim()) return;
    setOrders(current => current.map(o => o.id === detail.id ? { ...o, status: nextStatus, updates: [...o.updates, `Demostración · ${comment.trim()}`] } : o));
    setComment('');
    setNotice('Avance actualizado solo en esta demostración. No se guardó en Supabase.');
  }

  return <div className="workspace">
    <aside className={`ws-sidebar ${openMenu ? 'ws-open' : ''}`}>
      <div className="ws-logo"><span>AT</span>AutoTrack</div>
      <p className="ws-nav-caption">ESPACIO DE {roleNames[role].toUpperCase()}</p>
      <nav aria-label="Menú principal">{menu[role].map((item, index) => <button key={item} className={page === item ? 'ws-nav-active' : ''} aria-current={page === item ? 'page' : undefined} onClick={() => navigate(item)}><span aria-hidden="true">{['▦', '▤', '◉'][index]}</span>{item}</button>)}</nav>
      <div className="ws-sidebar-bottom"><div className="ws-person"><span className="ws-avatar">{user.first_name.slice(0, 1)}{user.last_name.slice(0, 1)}</span><div><strong>{user.first_name} {user.last_name}</strong><small>{roleNames[role]}</small></div></div><button className="ws-logout" onClick={onLogout}>Cerrar sesión ↗</button></div>
    </aside>
    <div className="ws-body">
      <header className="ws-header"><div><button className="ws-menu" aria-label="Mostrar menú" aria-expanded={openMenu} onClick={() => setOpenMenu(!openMenu)}>☰</button><span>Mi taller <span className="ws-separator">/</span> {page}</span></div><span className="ws-role">{roleNames[role]}</span></header>
      <main className="ws-main">
        <div className="ws-demo"><span aria-hidden="true">ⓘ</span><div><strong>Vista de demostración</strong> · Los vehículos y trabajos son ficticios. Los cambios se pierden al salir o recargar; tu cuenta de acceso sí es real.</div></div>
        <div className="ws-title"><div><p className="ws-overline">{role === 'CLIENT' ? 'EL CUIDADO DE TU VEHÍCULO' : 'GESTIÓN DEL TALLER'}</p><h1>{detail ? detail.vehicle : page === 'Resumen' ? `Hola, ${user.first_name}` : page}</h1><p>{detail ? `${detail.id} · ${detail.plate}` : role === 'ADMIN' ? 'Una vista clara del trabajo y del equipo de tu taller.' : role === 'MECHANIC' ? 'Organiza tus trabajos y documenta cada avance.' : 'Consulta el progreso y el historial de tus servicios.'}</p></div>{detail && <button className="ws-secondary" onClick={() => { setSelected(null); setNotice(''); }}>← Volver</button>}</div>

        {detail ? <>
          <div className="ws-detail-heading"><Badge status={detail.status} /><span>Ingreso: {dateLabel(detail.date)}</span></div>
          <div className="ws-detail-grid"><article className="ws-panel"><h2>Información del servicio</h2><dl><div><dt>Servicio</dt><dd>{detail.service}</dd></div><div><dt>Cliente de ejemplo</dt><dd>{detail.client}</dd></div><div><dt>Mecánico de ejemplo</dt><dd>{detail.mechanic}</dd></div></dl><h3>Diagnóstico</h3><p>{detail.diagnosis}</p>{detail.service === 'Sistema de frenos' && <><h3>Piezas involucradas</h3><div className="ws-part"><span>Pastillas delanteras</span><span className="ws-badge">Reemplazar</span></div></>}<h3>Evidencia fotográfica</h3><div className="ws-empty-small">No hay fotografías en esta demostración.</div></article>
          <article className="ws-panel"><h2>Seguimiento del trabajo</h2><ol className="ws-timeline">{detail.updates.map((update, i) => <li key={`${i}-${update}`}><span aria-hidden="true" />{update}</li>)}</ol></article></div>
          {role === 'MECHANIC' && <form className="ws-panel ws-progress" onSubmit={e => { e.preventDefault(); saveProgress(); }}><h2>Registrar avance</h2><p>Prueba el formulario. Esta edición solo afecta los datos de ejemplo.</p><label htmlFor="progress-status">Estado<select id="progress-status" value={nextStatus} onChange={e => setNextStatus(e.target.value as Status)}>{Object.entries(labels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label><label htmlFor="progress-comment">Comentario<textarea id="progress-comment" value={comment} onChange={e => setComment(e.target.value)} placeholder="Describe el trabajo realizado…" required maxLength={2000} rows={3} /></label><button className="ws-primary" type="submit">Guardar avance de ejemplo</button><p role="status">{notice}</p></form>}
        </> : <>
          <div className="ws-stats">{(role === 'CLIENT' ? [ ['Mis vehículos', new Set(visible.map(o => o.plate)).size, 'Vehículos de ejemplo'], ['En el taller', active.length, 'Servicios en curso'], ['Historial', visible.filter(finished).length, 'Servicios finalizados'] ] : [ ['Órdenes activas', active.length, 'Trabajo en el taller'], ['En revisión', visible.filter(o => o.status === 'DIAGNOSIS').length, 'Diagnóstico en curso'], ['En reparación', visible.filter(o => o.status === 'IN_REPAIR').length, 'Trabajos en proceso'], ['Reparados', visible.filter(o => o.status === 'COMPLETED').length, 'Pendientes de entrega'] ]).map(([label, value, caption], index) => <article className="ws-stat" key={label}><div><span>{label}</span><span className={`ws-stat-icon ws-icon-${index}`} aria-hidden="true">{['▣', '◷', '⚒', '✓'][index]}</span></div><strong>{value}</strong><small>{caption}</small></article>)}</div>

          {page === 'Mecánicos' ? <div className="ws-mechanics">{['Carlos Pérez', 'María Rodríguez'].map(name => { const assigned = orders.filter(o => o.mechanic === name); return <article className="ws-panel" key={name}><span className="ws-avatar">{name.slice(0, 1)}</span><h2>{name}</h2><p>Mecánico de demostración</p><div className="ws-part"><span>Órdenes activas</span><strong>{assigned.filter(o => !finished(o) && o.status !== 'CANCELLED').length}</strong></div><h3>Trabajos asignados</h3>{assigned.map(o => <button className="ws-job-link" key={o.id} onClick={() => inspect(o)}><span>{o.vehicle}<small>{o.service}</small></span><span aria-hidden="true">→</span></button>)}</article>; })}</div> : <article className="ws-panel ws-orders">
            <div className="ws-panel-title"><div><h2>{isHistory ? 'Servicios finalizados' : role === 'CLIENT' ? 'Tus vehículos' : 'Órdenes de trabajo'}</h2><p>{rows.length} registros de demostración</p></div></div>
            <div className="ws-filters"><label><span className="ws-sr-only">Buscar por vehículo, placa o servicio</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar vehículo, placa o servicio…" /></label><label><span className="ws-sr-only">Filtrar por estado</span><select value={status} onChange={e => setStatus(e.target.value)}><option value="">Todos los estados</option>{Object.entries(labels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label></div>
            {rows.length === 0 ? <div className="ws-empty"><h3>No hay resultados</h3><p>Prueba con otra búsqueda o cambia el estado.</p><button className="ws-secondary" onClick={() => { setQuery(''); setStatus(''); }}>Limpiar filtros</button></div> : role === 'CLIENT' && !isHistory ? <div className="ws-vehicles">{Array.from(new Set(rows.map(o => o.plate))).map(plate => { const o = rows.filter(item => item.plate === plate).sort((a,b) => b.date.localeCompare(a.date))[0]; return <article className="ws-vehicle" key={plate}><div className="ws-car" aria-hidden="true">▰</div><div className="ws-vehicle-title"><h3>{o.vehicle}</h3><span>{o.plate}</span></div><Badge status={o.status} /><p>{o.service}</p><p className="ws-muted">Mecánico: {o.mechanic}</p><button className="ws-primary" onClick={() => inspect(o)}>Ver seguimiento →</button></article>; })}</div> : <div className="ws-table-wrap"><table><thead><tr><th>Vehículo / Orden</th>{role === 'ADMIN' && <th>Cliente</th>}<th>Servicio</th><th>Ingreso</th><th>Estado</th><th><span className="ws-sr-only">Acciones</span></th></tr></thead><tbody>{rows.map(o => <tr key={o.id}><td><strong>{o.vehicle}</strong><small>{o.plate} · {o.id}</small></td>{role === 'ADMIN' && <td>{o.client}<small>{o.mechanic}</small></td>}<td>{o.service}</td><td>{dateLabel(o.date)}</td><td><Badge status={o.status} /></td><td><button className="ws-text-button" aria-label={`Ver orden ${o.id}`} onClick={() => inspect(o)}>Ver detalle →</button></td></tr>)}</tbody></table></div>}
          </article>}
          {page === 'Resumen' && <div className="ws-summary"><article className="ws-panel"><h2>Carga de trabajo</h2>{['Carlos Pérez', 'María Rodríguez'].map(name => { const count = active.filter(o => o.mechanic === name).length; return <div className="ws-workload" key={name}><div><span>{name}</span><strong>{count} activas</strong></div><progress max={Math.max(active.length, 1)} value={count} aria-label={`Órdenes activas de ${name}`} /></div>; })}</article><article className="ws-panel"><h2>Actividad de ejemplo</h2><p className="ws-activity">● <strong>Reparación en curso</strong><br />Toyota Corolla · Sistema de frenos</p><p className="ws-activity">● <strong>Servicio finalizado</strong><br />Kia Rio · Cambio de aceite</p></article></div>}
        </>}
        <footer className="ws-footer">AutoTrack · Gestión y seguimiento vehicular</footer>
      </main>
    </div>
  </div>;
}
