import VehicleFields from "../components/VehicleFields";
import { useState, type SubmitEvent } from "react";
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
  async function search(e: SubmitEvent<HTMLFormElement>) {
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
  async function receive(e: SubmitEvent<HTMLFormElement>) {
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
                    String(form.get("vin") || "").trim().toUpperCase() ||
                    null,
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
  return (
    <article className="ws-panel ws-progress">
      <button className="ws-secondary" onClick={onBack} disabled={busy}>
        Volver
      </button>
      <h2>Recibir vehículo</h2>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <form onSubmit={search}>
        <fieldset disabled={busy}>
          <label>
            Código del cliente
            <input
              required
              minLength={8}
              maxLength={8}
              pattern="[A-Z0-9]{8}"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setCustomer(null);
              }}
            />
          </label>
          <button className="ws-primary">Buscar cliente</button>
        </fieldset>
      </form>
      {customer && (
        <form onSubmit={receive}>
          <h3>
            {customer.profile.first_name} {customer.profile.last_name}
          </h3>
          <p>
            Para un vehículo nuevo completa placa, marca y modelo. Después de
            confirmar registrarás los síntomas del cliente y comenzarás el
            diagnóstico.
          </p>
          <fieldset disabled={busy}>
            <div className="ws-actions">
              <button
                type="button"
                className="ws-secondary"
                aria-pressed={vehicle === "new"}
                onClick={() => setVehicle("new")}
              >
                Registrar un vehículo nuevo
              </button>
            </div>
            <label>
              Vehículos del cliente
              <select
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
              >
                {customer.vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate} · {v.brand} {v.model}
                  </option>
                ))}
                <option value="new">Registrar otro vehículo</option>
              </select>
            </label>
            {vehicle === "new" && <VehicleFields />}
            {openOrder && (
              <div role="status">
                <p>
                  Este vehículo ya fue recibido y tiene una orden abierta. Abre
                  su orden para continuar con la etapa actual.
                </p>
                {openOrder.mechanic_id === mechanicId ? (
                  <button
                    type="button"
                    className="ws-secondary"
                    onClick={() => onReceived(openOrder.id)}
                  >
                    Continuar trabajo
                  </button>
                ) : (
                  <p>
                    La orden está asignada a otro mecánico o no tiene
                    asignación. Solicita al administrador que revise la
                    asignación.
                  </p>
                )}
              </div>
            )}
            <p>
              La orden quedará asignada a tu usuario. Un vehículo solo puede
              tener una orden abierta.
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
