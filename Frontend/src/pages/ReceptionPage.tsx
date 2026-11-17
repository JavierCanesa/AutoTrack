import VehicleFields from "../components/VehicleFields";
import { useState, type FormEvent } from "react";
import { api, type Vehicle } from "../services/workshopService";

interface Customer {
  profile: { id: string; first_name: string; last_name: string };
  vehicles: Vehicle[];
  open_orders: { id: string; vehicle_id: string; mechanic_id: string }[];
}

export default function ReceptionPage({
  onReceived,
  onBack,
  mechanicId,
}: {
  onReceived: (id: string) => void;
  onBack: () => void;
  mechanicId: string;
}) {
  const [code, setCode] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicle, setVehicle] = useState("new");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const openOrder = customer?.open_orders.find(
    (order) => order.vehicle_id === vehicle,
  );

  async function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const normalizedCode = code.trim().toUpperCase();
    setBusy(true);
    setError("");
    setCustomer(null);
    try {
      const found = await api<Customer>(
        `/work-orders/reception/client?code=${encodeURIComponent(normalizedCode)}`,
      );
      setCustomer(found);
      setVehicle(
        found.vehicles.find(
          (v) => !found.open_orders.some((o) => o.vehicle_id === v.id),
        )?.id || "new",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se encontró al cliente.");
    } finally {
      setBusy(false);
    }
  }

  async function receive(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!customer || busy) return;
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const result = await api<{ id: string }>(
        "/work-orders/reception",
        "POST",
        {
          client_code: code.trim().toUpperCase(),
          vehicle_id: vehicle === "new" ? null : vehicle,
          new_vehicle:
            vehicle === "new"
              ? {
                  client_id: customer.profile.id,
                  plate: form.get("plate"),
                  brand: form.get("brand"),
                  model: form.get("model"),
                  vehicle_year: form.get("vehicle_year")
                    ? Number(form.get("vehicle_year"))
                    : null,
                  color: form.get("color") || null,
                  vin:
                    String(form.get("vin") || "")
                      .trim()
                      .toUpperCase() || null,
                  vehicle_type: form.get("vehicle_type"),
                }
              : null,
        },
      );
      onReceived(result.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo recibir.");
    } finally {
      setBusy(false);
    }
  }

  const customerInitials = customer
    ? `${customer.profile.first_name?.[0] || ""}${customer.profile.last_name?.[0] || ""}`.toUpperCase() ||
      "C"
    : "";

  return (
    <article className="ws-panel ws-progress">
      <div className="ws-panel-title">
        <div>
          <p className="ws-overline">INGRESO AL TALLER</p>
          <h2>Recibir vehículo</h2>
          <p>
            Ingresa el código del cliente (8 caracteres) para identificar su
            perfil y seleccionar o registrar el vehículo.
          </p>
        </div>
        <button className="ws-secondary" onClick={onBack} disabled={busy}>
          ← Volver
        </button>
      </div>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <form className="at-reception-search" onSubmit={search}>
        <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="at-reception-search-row">
            <label>
              Código del cliente
              <input
                className="at-code-input"
                required
                minLength={8}
                maxLength={8}
                pattern="[A-Z0-9]{8}"
                placeholder="Ej. A1B2C3D4"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setCustomer(null);
                }}
              />
            </label>
            <button className="ws-primary" style={{ height: 44 }}>
              {busy && !customer ? "Buscando…" : "Buscar cliente"}
            </button>
          </div>
        </fieldset>
      </form>

      {customer && (
        <form onSubmit={receive}>
          <div className="at-customer-card">
            <div className="at-customer-info">
              <div className="at-customer-avatar" aria-hidden="true">
                {customerInitials}
              </div>
              <div>
                <h3>
                  {customer.profile.first_name} {customer.profile.last_name}
                </h3>
                <small>
                  Cliente verificado · Código: <code>{code}</code>
                </small>
              </div>
            </div>
            <span className="at-filter-count">
              {customer.vehicles.length}{" "}
              {customer.vehicles.length === 1 ? "vehículo" : "vehículos"}
            </span>
          </div>

          <fieldset disabled={busy}>
            <label style={{ marginBottom: 4 }}>
              Selecciona el vehículo a recibir
            </label>
            <div className="at-vehicle-picker">
              {customer.vehicles.map((v) => {
                const hasOpen = customer.open_orders.some(
                  (o) => o.vehicle_id === v.id,
                );
                const isSelected = vehicle === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    className={`at-vehicle-pick-card ${isSelected ? "is-selected" : ""}`}
                    onClick={() => setVehicle(v.id)}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        width: "100%",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <span className="at-plate-badge">{v.plate}</span>
                      {hasOpen && (
                        <span className="ws-badge ws-waiting_approval">
                          Orden abierta
                        </span>
                      )}
                    </div>
                    <strong>
                      {v.brand} {v.model}
                    </strong>
                    <small style={{ color: "var(--ink-soft)" }}>
                      {v.vehicle_year || "Año s/i"} · {v.color || "Color s/i"}
                    </small>
                  </button>
                );
              })}

              <button
                type="button"
                className={`at-vehicle-pick-card is-new ${vehicle === "new" ? "is-selected" : ""}`}
                onClick={() => setVehicle("new")}
              >
                <span>+ Registrar vehículo nuevo</span>
                <small style={{ fontWeight: 400, color: "var(--ink-soft)" }}>
                  Completa placa, marca y modelo
                </small>
              </button>
            </div>

            {vehicle === "new" && (
              <div className="at-new-vehicle-box">
                <h4>Datos del nuevo vehículo</h4>
                <VehicleFields />
              </div>
            )}

            {openOrder && (
              <div className="at-open-order-banner" role="status">
                <p>
                  <strong>Este vehículo ya tiene una orden abierta.</strong>{" "}
                  {openOrder.mechanic_id === mechanicId
                    ? "Está asignada a tu usuario; puedes continuar el trabajo directamente."
                    : "La orden está asignada a otro mecánico o sin asignación. Solicita al administrador revisar la asignación."}
                </p>
                {openOrder.mechanic_id === mechanicId && (
                  <button
                    type="button"
                    className="ws-primary"
                    onClick={() => onReceived(openOrder.id)}
                  >
                    Continuar trabajo →
                  </button>
                )}
              </div>
            )}

            <p style={{ color: "var(--ink-soft)", fontSize: 13 }}>
              La orden quedará asignada a tu usuario para registrar síntomas y
              diagnóstico. Un vehículo solo puede tener una orden abierta.
            </p>
            <button className="ws-primary" disabled={!!openOrder}>
              {busy ? "Guardando recepción…" : "Confirmar recepción"}
            </button>
          </fieldset>
        </form>
      )}
    </article>
  );
}
