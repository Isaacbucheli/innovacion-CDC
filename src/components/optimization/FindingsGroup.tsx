import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { formatMoney } from "@/lib/costs";
import { cn } from "@/lib/utils";

/**
 * Grupo colapsable (Compute / Storage / Networking / AHB) al estilo del reporte FinOps.
 * Colapsado por defecto; el contenido (tabla) solo se monta al abrir.
 */
export default function FindingsGroup({
  label,
  count,
  savings,
  color,
  defaultOpen = false,
  children,
}: {
  label: string;
  count: number;
  savings: number;
  color: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/40 transition-colors"
      >
        <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-90")} />
        <span className="w-2.5 h-2.5 rounded-sm flex-none" style={{ background: color }} aria-hidden />
        <span className="font-semibold">{label}</span>
        <span className="text-xs text-muted-foreground">{count} hallazgo{count === 1 ? "" : "s"}</span>
        <span className="ml-auto font-bold tabular-nums text-[#5a7016] dark:text-[#a9c46a]">
          {savings > 0 ? `${formatMoney(savings)} /mes` : "—"}
        </span>
      </button>
      {open && <div className="border-t">{children}</div>}
    </div>
  );
}
