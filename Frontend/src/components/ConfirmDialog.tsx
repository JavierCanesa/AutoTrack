import { useEffect, useRef, type ReactNode } from "react";
export default function ConfirmDialog({
  children,
  busy,
  onAccept,
  onCancel,
  title = "Confirmar eliminación",
  acceptLabel = "Aceptar",
  hideCancel = false,
}: {
  title?: string;
  acceptLabel?: string;
  hideCancel?: boolean;
  children: ReactNode;
  busy: boolean;
  onAccept: () => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="confirm-dialog"
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <h2 id="confirm-title">{title}</h2>
      {children}
      <div className="ws-actions">
        <button
          className="ws-primary"
          disabled={busy}
          onClick={onAccept}
          autoFocus={hideCancel}
        >
          {acceptLabel}
        </button>
        {!hideCancel && (
          <button
            autoFocus
            className="ws-secondary"
            disabled={busy}
            onClick={onCancel}
          >
            Cancelar
          </button>
        )}
      </div>
    </dialog>
  );
}
