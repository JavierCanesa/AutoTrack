import { useEffect, useRef, type ReactNode, type FormEvent } from "react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;

  // Acciones y estados
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  onPrimaryClick?: () => void;
  primaryLabel?: string;
  secondaryLabel?: string;
  extraAction?: ReactNode;
  busy?: boolean;
  primaryDisabled?: boolean;
  maxWidth?: string;
  error?: string;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  onSubmit,
  onPrimaryClick,
  primaryLabel = "Guardar",
  secondaryLabel = "Cancelar",
  extraAction,
  busy = false,
  primaryDisabled = false,
  maxWidth,
  error,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Sincronización del estado isOpen con el elemento <dialog> nativo
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  // Manejo de la tecla Escape nativa de <dialog>
  function handleCancel(e: React.SyntheticEvent<HTMLDialogElement, Event>) {
    e.preventDefault();
    if (!busy) {
      onClose();
    }
  }

  // Cierre al hacer clic sobre el backdrop
  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current && !busy) {
      onClose();
    }
  }

  if (!isOpen) return null;

  const content = (
    <div className="at-modal-card" style={maxWidth ? { maxWidth } : undefined}>
      {/* Cabecera del Modal con Icono Squircle, Títulos y Botón Cerrar */}
      <div className="at-modal-header">
        <div className="at-modal-header-left">
          {icon && <div className="at-modal-icon-badge">{icon}</div>}
          <div className="at-modal-titles">
            <h3 id="at-modal-title" className="at-modal-title">
              {title}
            </h3>
            {subtitle && (
              <div id="at-modal-desc" className="at-modal-subtitle">
                {subtitle}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          className="at-modal-close-btn"
          onClick={onClose}
          disabled={busy}
          aria-label="Cerrar ventana"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Cuerpo del Modal con scroll y manejo de errores */}
      <div className="at-modal-body">
        {error && (
          <div className="at-modal-alert at-modal-alert-error" role="alert">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}
        <fieldset className="at-modal-fieldset" disabled={busy}>
          {children}
        </fieldset>
      </div>

      {/* Pie de acción (Footer) */}
      <div className="at-modal-footer">
        <div className="at-modal-footer-left">
          <button
            type="button"
            className="at-btn at-btn-secondary"
            onClick={onClose}
            disabled={busy}
          >
            {secondaryLabel}
          </button>
        </div>

        <div className="at-modal-footer-right">
          {extraAction}
          <button
            type={onSubmit ? "submit" : "button"}
            className="at-btn at-btn-primary"
            onClick={!onSubmit ? onPrimaryClick : undefined}
            disabled={busy || primaryDisabled}
          >
            {busy && <span className="at-spinner" aria-hidden="true" />}
            <span>{busy ? "Guardando…" : primaryLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <dialog
      ref={dialogRef}
      className="at-modal-dialog"
      aria-labelledby="at-modal-title"
      aria-describedby={subtitle ? "at-modal-desc" : undefined}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
    >
      {onSubmit ? (
        <form className="at-modal-form" onSubmit={onSubmit}>
          {content}
        </form>
      ) : (
        content
      )}
    </dialog>
  );
}
