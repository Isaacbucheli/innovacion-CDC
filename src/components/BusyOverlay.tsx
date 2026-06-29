import { Loader2 } from "lucide-react";

/**
 * Overlay de carga que BLOQUEA la interacción mientras corre una operación
 * (evita que el usuario haga clics a lo loco / cambie de contexto a mitad).
 * Reutilizable en cualquier módulo. Estilo del piloto: flat, spinner de marca.
 */
export default function BusyOverlay({ show, title, detail }: { show: boolean; title: string; detail?: string }) {
  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-background/60 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-4 rounded-xl border bg-background px-6 py-5 shadow-xl max-w-sm mx-4">
        <Loader2 className="w-6 h-6 text-[#A3C243] animate-spin flex-none" />
        <div className="min-w-0">
          <div className="font-semibold leading-tight">{title}</div>
          {detail && <div className="text-sm text-muted-foreground mt-0.5">{detail}</div>}
        </div>
      </div>
    </div>
  );
}
