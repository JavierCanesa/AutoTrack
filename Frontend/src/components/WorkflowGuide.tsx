export default function WorkflowGuide({
  client = false,
}: {
  client?: boolean;
}) {
  const steps = client
    ? [
        "Comparte tu código",
        "Consulta el diagnóstico",
        "Aprueba la cotización",
        "Sigue la reparación",
      ]
    : [
        "Recibe el vehículo",
        "Diagnostica y documenta",
        "Espera la aprobación",
        "Repara y registra pruebas",
      ];
  return (
    <div className="workflow-guide" aria-label="Etapas del trabajo">
      {steps.map((step, i) => (
        <div key={step}>
          <span>{String(i + 1).padStart(2, "0")}</span>
          <strong>{step}</strong>
        </div>
      ))}
    </div>
  );
}
