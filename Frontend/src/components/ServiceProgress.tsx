import type { Status } from "../services/workshopService";
import { labels } from "../services/workshopService";

const phases = ["Recepción", "Diagnóstico", "Reparación", "Pruebas", "Listo"];
const phase: Record<Status, number> = {
  RECEIVED: 0,
  DIAGNOSIS: 1,
  WAITING_APPROVAL: 1,
  IN_REPAIR: 2,
  TESTING: 3,
  COMPLETED: 4,
  DELIVERED: 4,
  CANCELLED: -1,
};
const descriptions: Record<Status, string> = {
  RECEIVED: "El taller recibió el vehículo. Está pendiente de revisión.",
  DIAGNOSIS:
    "El mecánico está identificando el problema y el trabajo necesario.",
  WAITING_APPROVAL:
    "El trabajo está en espera de autorización. Consulta con el taller.",
  IN_REPAIR: "El mecánico está realizando las reparaciones indicadas.",
  TESTING: "Se está comprobando el funcionamiento del vehículo.",
  COMPLETED: "El trabajo está terminado. Coordina la entrega con el taller.",
  DELIVERED:
    "El vehículo fue entregado. Puedes consultar el historial del servicio.",
  CANCELLED:
    "La orden fue cancelada. Su información se conserva para consulta.",
};
export default function ServiceProgress({ status }: { status: Status }) {
  const current = phase[status];
  return (
    <div className="role-progress">
      <p className="role-progress-caption">
        <strong>{labels[status]}</strong> · {descriptions[status]}
      </p>
      {status !== "CANCELLED" && (
        <ol aria-label="Fases del servicio">
          {phases.map((label, index) => (
            <li
              key={label}
              className={
                current === index
                  ? "is-current"
                  : index < current
                    ? "is-complete"
                    : ""
              }
              aria-current={current === index ? "step" : undefined}
            >
              <span aria-hidden="true">
                {index < current ? "✓" : index + 1}
              </span>
              <span>{label}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
