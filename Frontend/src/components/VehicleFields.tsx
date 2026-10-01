import { useState } from "react";
import type { Vehicle } from "../services/workshopService";
import { NON_BLANK_PATTERN } from "../validation";
const brands = [
  "TOYOTA",
  "NISSAN",
  "HONDA",
  "HYUNDAI",
  "KIA",
  "MAZDA",
  "MITSUBISHI",
  "SUZUKI",
  "FORD",
  "CHEVROLET",
  "VOLKSWAGEN",
  "BMW",
  "MERCEDES-BENZ",
  "ISUZU",
  "YAMAHA",
  "BAJAJ",
];
export default function VehicleFields({
  vehicle,
}: {
  vehicle?: Vehicle | null;
}) {
  const match = vehicle?.plate.replace(/[\s-]/g, "").match(/^([PMC])(\w{6})$/);
  const [prefix, setPrefix] = useState(match?.[1] || "P");
  const [number, setNumber] = useState(
    match ? `${match[2].slice(0, 3)}-${match[2].slice(3)}` : "",
  );
  const [brand, setBrand] = useState(vehicle?.brand?.toUpperCase() || "");
  const [other, setOther] = useState(!!brand && !brands.includes(brand));
  return (
    <>
      {vehicle && !match && (
        <p>
          Placa anterior: {vehicle.plate}. Ingresa el formato P, M o C para
          guardar.
        </p>
      )}
      <label>
        Placa
        <div className="plate-input">
          <select
            aria-label="Categoría de placa"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
          >
            <option value="P">P · Particular</option>
            <option value="M">M · Moto</option>
            <option value="C">C · Camión</option>
          </select>
          <input
            aria-label="Número de placa"
            required
            value={number}
            maxLength={7}
            pattern={
              prefix === "P" ? "[0-9]{3}-[A-Z0-9]{3}" : "[0-9]{3}-[0-9]{3}"
            }
            placeholder={prefix === "P" ? "123-A4F" : "123-456"}
            onChange={(e) => {
              const raw = e.target.value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "")
                .slice(0, 6);
              setNumber(
                raw.length > 3 ? `${raw.slice(0, 3)}-${raw.slice(3)}` : raw,
              );
            }}
          />
        </div>
        <input type="hidden" name="plate" value={`${prefix} ${number}`} />
      </label>
      <label>
        Marca
        <select
          aria-label="Marca"
          required
          value={other ? "OTHER" : brand}
          onChange={(e) => {
            setOther(e.target.value === "OTHER");
            setBrand(e.target.value === "OTHER" ? "" : e.target.value);
          }}
        >
          <option value="">Selecciona una marca</option>
          {brands.map((b) => (
            <option key={b}>{b}</option>
          ))}
          <option value="OTHER">Otra</option>
        </select>
      </label>
      {other && (
        <label>
          Escribe la marca
          <input
            required
            maxLength={80}
            pattern={NON_BLANK_PATTERN}
            title="Escribe una marca válida."
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
          />
        </label>
      )}
      <input type="hidden" name="brand" value={brand} />
      <label>
        Tipo de vehículo
        <select
          aria-label="Tipo de vehículo"
          name="vehicle_type"
          required
          defaultValue={vehicle?.vehicle_type || ""}
        >
          <option value="">Seleccionar tipo</option>
          <option value="SEDAN">Sedán</option>
          <option value="SUV">Camioneta</option>
          <option value="MOTORCYCLE">Moto</option>
          <option value="PICKUP">Pickup</option>
          <option value="SPORT">Deportivo</option>
        </select>
      </label>
      <label>
        Modelo
        <input
          name="model"
          required
          maxLength={80}
          pattern={NON_BLANK_PATTERN}
          title="Escribe un modelo válido."
          defaultValue={vehicle?.model}
        />
      </label>
      <label>
        Año
        <input
          name="vehicle_year"
          type="number"
          min={1900}
          max={new Date().getFullYear() + 1}
          defaultValue={vehicle?.vehicle_year || ""}
        />
      </label>
      <label>
        Color
        <input
          name="color"
          maxLength={40}
          defaultValue={vehicle?.color || ""}
        />
      </label>
      <label>
        VIN <span className="auth-optional">(opcional)</span>
        <input
          name="vin"
          maxLength={17}
          minLength={17}
          pattern="[A-HJ-NPR-Z0-9]{17}"
          title="El VIN debe tener 17 caracteres y no puede incluir I, O ni Q."
          defaultValue={vehicle?.vin || ""}
          onInput={(event) => {
            event.currentTarget.value = event.currentTarget.value
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "");
          }}
        />
      </label>
    </>
  );
}
