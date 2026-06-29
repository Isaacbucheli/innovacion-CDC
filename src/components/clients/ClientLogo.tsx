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
 * Avatar cuadrado del cliente. Si tiene logo (logo_blob_name no nulo) lo descarga de forma
 * autenticada a un objectURL (revocado al desmontar / cambiar de cliente). Si no, muestra las
 * iniciales sobre un tinte de marca.
 */
export default function ClientLogo({
  clientId,
  name,
  hasLogo,
  size = 44,
  className = "",
}: {
  clientId: number;
  name: string;
  hasLogo: boolean;
  size?: number;
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

  const showImg = hasLogo && url;
  return (
    <div
      className={`flex items-center justify-center rounded-lg overflow-hidden shrink-0 ${showImg ? "bg-secondary" : ""} ${className}`}
      style={{
        width: size,
        height: size,
        background: showImg ? undefined : "#EAF3DE",
        color: "#3B6D11",
      }}
    >
      {showImg ? (
        <img src={url} alt={name} className="max-h-full max-w-full object-contain p-1" />
      ) : (
        <span className="font-semibold" style={{ fontSize: Math.round(size * 0.32) }}>
          {initials(name)}
        </span>
      )}
    </div>
  );
}
