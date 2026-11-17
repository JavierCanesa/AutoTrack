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
    <div className="at-workflow-stepper" aria-label="Etapas del trabajo">
      {steps.map((step, i) => (
        <div className="at-workflow-step" key={step}>
          <span className="at-workflow-step-num">
            {String(i + 1).padStart(2, "0")}
          </span>
          <strong className="at-workflow-step-title">{step}</strong>
        </div>
      ))}
    </div>
  );
}
