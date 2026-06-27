import { useEffect, useState } from "react";

/**
 * Barra de progreso que crece desde 0 hasta `pct` al montar (micro-animación sutil).
 * Respeta prefers-reduced-motion (salta al valor final). Verde de marca como acento.
 */
export default function GrowBar({
  pct,
  height = "h-2",
  className = "",
}: {
  pct: number;
  height?: string;
  className?: string;
}) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setW(pct);
      return;
    }
    const id = requestAnimationFrame(() => setW(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  return (
    <div className={`${height} rounded-full bg-secondary overflow-hidden ${className}`}>
      <div
        className="h-full rounded-full bg-[#A3C243] transition-[width] duration-700 ease-out"
        style={{ width: `${Math.max(0, Math.min(100, w))}%` }}
      />
    </div>
  );
}
