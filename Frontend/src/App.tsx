import { useEffect, useState } from 'react';
import AuthPage from './pages/AuthPage';
import ServiceTypesPage from './pages/ServiceTypesPage';
import { ApiError, logout, refreshSession, subscribeSession, type Session } from './services/authService';
import Dashboard from './components/Dashboard';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const unsubscribe = subscribeSession(value => { setSession(value); setError(''); });
    refreshSession().catch(e => { if (!(e instanceof ApiError && e.status === 401)) setError(e.message); })
      .finally(() => setStarting(false));
    return unsubscribe;
  }, []);
  useEffect(() => {
    if (!session) return;
    let timer: number;
    let disposed = false;
    const renew = () => { refreshSession().catch(e => {
      if (disposed) return;
      setError(e.message);
      if (!(e instanceof ApiError && [401, 403].includes(e.status))) timer = window.setTimeout(renew, 15000);
    }); };
    timer = window.setTimeout(renew, Math.max(1000, (session.expires_in - 60) * 1000));
    return () => { disposed = true; window.clearTimeout(timer); };
  }, [session]);
  async function signOut() { try { await logout(); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cerrar sesión.'); } }
  if (window.location.pathname === '/servicios') return <ServiceTypesPage />;
  if (starting) return <main><p role="status">Comprobando sesión…</p></main>;
  return <>{error && <p className="error" role="alert">{error}</p>}{session
    ? <Dashboard key={session.user.id} user={session.user} token={session.access_token} onLogout={signOut} />
    : <AuthPage onLogin={setSession} />}</>;
}
