import { useEffect, useRef, useState, type DragEvent, type ChangeEvent } from "react";

interface FileDropzoneProps {
  name: string;
  accept?: string;
  required?: boolean;
  disabled?: boolean;
  title?: string;
  hint?: string;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function FileDropzone({
  name,
  accept = "image/*,.heic,.heif",
  required = false,
  disabled = false,
  title = "Elige una fotografía o arrástrala aquí",
  hint = "JPEG, PNG, WebP o HEIC. Las fotos grandes se optimizan automáticamente.",
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped || !inputRef.current) return;

    const dt = new DataTransfer();
    dt.items.add(dropped);
    inputRef.current.files = dt.files;
    setFile(dropped);
  }

  function clearFile(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    setFile(null);
  }

  return (
    <div
      className={`at-dropzone ${isDragOver ? "is-dragover" : ""} ${disabled ? "is-disabled" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        className="at-dropzone-input"
        name={name}
        type="file"
        accept={accept}
        required={required}
        disabled={disabled}
        onChange={handleChange}
        aria-label={title}
      />

      {file ? (
        <div className="at-dropzone-preview">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Vista previa de la fotografía"
              className="at-dropzone-thumb"
            />
          ) : (
            <div className="at-dropzone-icon" style={{ width: 48, height: 48 }}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
          )}
          <div className="at-dropzone-meta">
            <span className="at-dropzone-filename">{file.name}</span>
            <span className="at-dropzone-size">{formatBytes(file.size)}</span>
          </div>
          <button
            type="button"
            className="at-dropzone-clear"
            onClick={clearFile}
            disabled={disabled}
          >
            Quitar
          </button>
        </div>
      ) : (
        <>
          <div className="at-dropzone-icon">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div className="at-dropzone-title">{title}</div>
          <div className="at-dropzone-hint">{hint}</div>
        </>
      )}
    </div>
  );
}
