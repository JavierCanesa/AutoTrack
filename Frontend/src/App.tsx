import AuthPage from './pages/AuthPage';
import ServiceTypesPage from './pages/ServiceTypesPage';
import { useEffect, useState } from 'react';
import type { Session } from './services/authService';
import Dashboard from './components/Dashboard';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(() => {
      setSession(null);
      setExpired(true);
    }, session.expires_in * 1000);
    return () => window.clearTimeout(timer);
  }, [session]);

  if (window.location.pathname === '/servicios') return <ServiceTypesPage />;
  if (!session) return <>
    {expired && <p role="status">Tu sesión venció. Inicia sesión nuevamente.</p>}
    <AuthPage onLogin={value => { setExpired(false); setSession(value); }} />
  </>;
  return <Dashboard key={session.user.id} user={session.user} onLogout={() => setSession(null)} />;
}
