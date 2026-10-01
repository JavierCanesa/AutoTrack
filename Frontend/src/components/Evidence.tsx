import { useEffect, useState } from "react";
import { loadPhoto, type Photo } from "../services/workshopService";
export default function Evidence({ orderId, photo }: { orderId: string; photo: Photo }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let disposed = false;
    let objectUrl = "";
    loadPhoto(orderId, photo.id)
      .then((value) => {
        objectUrl = value;
        if (disposed) URL.revokeObjectURL(value);
        else setUrl(value);
      })
      .catch((e) => {
        if (!disposed) setError(e.message);
      });
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [orderId, photo.id]);
  return (
    <figure>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={photo.file_name} />
        </a>
      ) : (
        <p>{error || "Cargando fotografía…"}</p>
      )}
      <figcaption>{photo.file_name}</figcaption>
    </figure>
  );
}
