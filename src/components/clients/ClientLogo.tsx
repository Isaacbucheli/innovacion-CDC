import { useEffect, useState } from "react";
import { fetchClientLogoObjectUrl } from "@/lib/api";

/** Iniciales del nombre del cliente (1–2 letras). */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Zona de logo de la tarjeta de cliente. Si el cliente tiene logo (logo_blob_name no nulo),
 * lo descarga de forma autenticada a un objectURL (revocado al desmontar / cambiar de cliente).
 * Si no, muestra las iniciales sobre un tinte de marca.
 */
export default function ClientLogo({
  clientId,
  name,
  hasLogo,
  className = "",
}: {
  clientId: number;
  name: string;
  hasLogo: boolean;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!hasLogo) {
      setUrl(null);
      return;
    }
    let active = true;
    let objectUrl: string | null = null;
    fetchClientLogoObjectUrl(clientId)
      .then((u) => {
        if (!active) {
          if (u) URL.revokeObjectURL(u);
          return;
        }
        objectUrl = u;
        setUrl(u);
      })
      .catch(() => { if (active) setUrl(null); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [clientId, hasLogo]);

  return (
    <div
      className={`flex items-center justify-center rounded-lg bg-secondary overflow-hidden ${className}`}
      style={{ height: 62 }}
    >
      {hasLogo && url ? (
        <img src={url} alt={name} className="max-h-[54px] max-w-[80%] object-contain" />
      ) : (
        <span
          className="inline-flex items-center justify-center h-9 w-9 rounded-md text-sm font-semibold"
          style={{ background: "#EAF3DE", color: "#3B6D11" }}
        >
          {initials(name)}
        </span>
      )}
    </div>
  );
}
