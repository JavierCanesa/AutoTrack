import ProfilePage from "../pages/ProfilePage";
import { useState } from "react";
import type { AuthUser } from "../services/authService";
import UsersPage from "../pages/UsersPage";
import VehiclesPage from "../pages/VehiclesPage";
import OrdersPage from "../pages/OrdersPage";
import ReportsPage from "../pages/ReportsPage";
import MechanicPage from "../pages/MechanicPage";
import WorkflowPage from "../pages/WorkflowPage";
import ClientPage from "../pages/ClientPage";

const roleNames = {
  ADMIN: "Administrador",
  MECHANIC: "Mecánico",
  CLIENT: "Cliente",
};
const menu = {
  ADMIN: [
    "Resumen",
    "Vehículos",
    "Órdenes de trabajo",
    "Cotizaciones",
    "Historial de servicios",
    "Mecánicos",
    "Usuarios",
  ],
  MECHANIC: ["Mi jornada", "Recibir vehículo", "Historial de trabajos"],
  CLIENT: [
    "Seguimiento",
    "Cotizaciones",
    "Mis vehículos",
    "Mis servicios",
    "Historial de servicios",
  ],
};
const menuIcons: Record<string, string> = {
  Resumen: "⌂",
  Vehículos: "◇",
  "Mis vehículos": "◇",
  "Órdenes de trabajo": "≡",
  Cotizaciones: "$",
  "Historial de servicios": "◷",
  "Historial de trabajos": "◷",
  "Mis servicios": "▤",
  Mecánicos: "◉",
  Usuarios: "◎",
  "Mi jornada": "↗",
  "Recibir vehículo": "+",
  Seguimiento: "⌁",
  "Mi perfil": "○",
};
export default function Dashboard({
  user,
  token,
  onLogout,
}: {
  user: AuthUser;
  token: string;
  onLogout: () => void;
}) {
  const [page, setPage] = useState(menu[user.role][0]);
  const [open, setOpen] = useState(false);
  const [navigation, setNavigation] = useState(0);
  const [orderFilter, setOrderFilter] = useState<{
    status?: string;
    brand?: string;
    mechanic?: string;
    active?: boolean;
    role?: string;
  }>({});
  const navigateReport = (target: string, filter = {}) => {
    setPage(target);
    setOrderFilter(filter);
    setNavigation((n) => n + 1);
  };
  const [historyVehicle, setHistoryVehicle] = useState("");
  return (
    <div
      className={`workspace ${user.role === "ADMIN" ? "workspace-admin" : ""}`}
    >
      <aside className={`ws-sidebar ${open ? "ws-open" : ""}`}>
        <div className="ws-logo">
          <img src="/img/AutoTrackLogo.png" alt="" width={44} height={44} />
          AutoTrack
          <button
            className="ws-close"
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
          >
            ×
          </button>
        </div>
        <p className="ws-nav-caption">
          ESPACIO DE {roleNames[user.role].toUpperCase()}
        </p>
        <nav aria-label="Menú principal">
          {[...menu[user.role], "Mi perfil"].map((item) => (
            <button
              key={item}
              className={page === item ? "ws-nav-active" : ""}
              aria-current={page === item ? "page" : undefined}
              onClick={() => {
                setPage(item);
                setHistoryVehicle("");
                setOrderFilter({});
                setNavigation((value) => value + 1);
                setOpen(false);
              }}
            >
              <span className="nav-mark" aria-hidden="true">
                {menuIcons[item] || "·"}
              </span>
              <span>{item}</span>
            </button>
          ))}
        </nav>
        <div className="ws-sidebar-bottom">
          <div className="ws-person">
            <span className="ws-avatar">
              {user.first_name.slice(0, 1)}
              {user.last_name.slice(0, 1)}
            </span>
            <div>
              <strong>
                {user.first_name} {user.last_name}
              </strong>
              <small>{roleNames[user.role]}</small>
            </div>
          </div>
          <button className="ws-logout" onClick={onLogout}>
            Cerrar sesión ↗
          </button>
        </div>
      </aside>
      {open && (
        <button
          className="ws-scrim"
          aria-label="Cerrar menú"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="ws-body">
        <header className="ws-header">
          <div>
            <button
              className="ws-menu"
              aria-label="Mostrar menú"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              <span aria-hidden="true">☰</span>
            </button>
            <span className="ws-mobile-brand">AutoTrack</span>
            <span className="ws-breadcrumb">
              Mi taller <b>/</b> {page}
            </span>
          </div>
          <time className="dashboard-date">
            {new Date().toLocaleDateString("es-SV", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </time>
          <span className="ws-role">{roleNames[user.role]}</span>
        </header>
        <main className="ws-main">
          <div className="ws-title">
            <h1>{page}</h1>
          </div>
          {page === "Mi perfil" ? (
            <ProfilePage user={user} />
          ) : page === "Cotizaciones" ? (
            <WorkflowPage key={`${user.id}-${navigation}`} user={user} />
          ) : user.role === "MECHANIC" ? (
            <MechanicPage
              user={user}
              page={page}
              navigation={navigation}
              onNavigate={setPage}
            />
          ) : user.role === "CLIENT" ? (
            <ClientPage
              user={user}
              page={page}
              navigation={navigation}
              onNavigate={setPage}
            />
          ) : page === "Usuarios" ? (
            <UsersPage
              key={navigation}
              initialRole={orderFilter.role}
              token={token}
              currentUserId={user.id}
            />
          ) : page === "Resumen" || page === "Mecánicos" ? (
            <ReportsPage
              onNavigate={navigateReport}
              key={page}
              mechanicsOnly={page === "Mecánicos"}
            />
          ) : page === "Vehículos" || page === "Mis vehículos" ? (
            <VehiclesPage
              user={user}
              onHistory={(id) => {
                setHistoryVehicle(id);
                setPage("Historial de servicios");
              }}
            />
          ) : (
            <OrdersPage
              key={`${page}-${navigation}`}
              user={user}
              initialVehicle={historyVehicle}
              filter={orderFilter}
              history={
                page === "Trabajos completados" ||
                page === "Historial de servicios"
              }
            />
          )}
          <footer className="ws-footer">
            AutoTrack · Gestión y seguimiento vehicular
          </footer>
        </main>
      </div>
    </div>
  );
}
