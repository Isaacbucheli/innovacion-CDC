import { useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import { clearSession, getName, getRole } from "@/lib/auth";

// Menú espejo del sidebar de PRD (sidebar.js): mismos grupos, orden, etiquetas
// e iconos. Los ítems con `section` ya existen como vista React y navegan; los
// `soon` son placeholders ("pronto") aún no migrados. `adminOnly` replica el
// data-admin-only de PRD. El grupo gated "Optimización Azure" se omite (igual
// que en PRD, solo aparece con la feature habilitada).
type Item = { label: string; section?: string; adminOnly?: boolean; soon?: boolean };
type Group = { label: string; icon: string; items: Item[] };

const MENU: Group[] = [
  {
    label: "Matriz costos Azure",
    icon: "/assets/azure-icons/cost-management.svg",
    items: [
      { label: "Optimización de costos", section: "costos" },
      { label: "Catálogo de servicios", soon: true },
    ],
  },
  {
    label: "Matriz mejoras Azure",
    icon: "/assets/azure-icons/advisor.svg",
    items: [
      { label: "Recomendaciones", section: "waf" },
      { label: "Validación inteligente", adminOnly: true, section: "waf-validation" },
      { label: "Historial de ingestas", section: "waf-ingestions" },
      { label: "Costo referencial Azure", section: "waf-cost" },
    ],
  },
  {
    label: "Informes",
    icon: "/assets/azure-icons/waf-performance.svg",
    items: [{ label: "Informe de gestión mensual", section: "report" }],
  },
  {
    label: "Gestión CDC",
    icon: "/assets/azure-icons/subscriptions.svg",
    items: [
      { label: "Reservas por vencer", section: "reservations" },
      { label: "Catálogo de alertas", section: "alerts" },
    ],
  },
  {
    label: "Administración",
    icon: "/assets/azure-icons/subscriptions.svg",
    items: [
      { label: "Clientes", section: "clientes", adminOnly: true },
      { label: "Credenciales Azure", section: "credenciales", adminOnly: true },
      { label: "Usuarios y perfiles", adminOnly: true, section: "usuarios" },
    ],
  },
];

// Índice del grupo que contiene la sección activa (para abrirlo por defecto).
function groupOfSection(section?: string): number {
  if (!section) return 0;
  const i = MENU.findIndex((g) => g.items.some((it) => it.section === section));
  return i < 0 ? 0 : i;
}

export default function AppShell({
  title,
  subtitle,
  active,
  headerRight,
  onNavigate,
  children,
}: {
  title: string;
  subtitle?: string;
  active?: string;
  headerRight?: React.ReactNode;
  onNavigate?: (key: string) => void;
  children: React.ReactNode;
}) {
  const isAdmin = getRole() === "admin";
  const [open, setOpen] = useState<Set<number>>(() => new Set([groupOfSection(active)]));
  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className="min-h-screen grid grid-cols-[260px_1fr] bg-secondary">
      <aside className="sticky top-0 h-screen flex flex-col gap-4 bg-card text-card-foreground border-r border-border px-4 py-6">
        <div>
          {/* Logo que conmuta con el tema: oscuro sobre claro / blanco-verde sobre oscuro.
              Tamaño por ALTURA (ambos assets recortados al contenido) → mismo tamaño en los dos modos. */}
          <img src="/business-it-logo.webp" alt="Business IT" className="h-10 w-auto max-w-full object-contain dark:hidden" />
          <img src="/business-it-logo-white-green.webp" alt="" aria-hidden className="h-10 w-auto max-w-full object-contain hidden dark:block" />
          <p className="mt-3 text-sm text-muted-foreground">Plataforma de optimización Azure</p>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto grid content-start gap-1.5">
          {MENU.map((group, gi) => {
            const items = group.items.filter((it) => !it.adminOnly || isAdmin);
            if (items.length === 0) return null;
            const isOpen = open.has(gi);
            return (
              <div key={group.label}>
                <button
                  type="button"
                  onClick={() => toggle(gi)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center gap-3 min-h-[48px] px-3.5 rounded-2xl text-base font-extrabold text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <img src={group.icon} alt="" aria-hidden className="w-[22px] h-[22px] shrink-0 object-contain bg-foreground/5 rounded-md p-[3px]" />
                  <span className="flex-1 text-left">{group.label}</span>
                  <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="grid gap-1 my-1.5 ml-9">
                    {items.map((it) => {
                      const isActive = !!it.section && it.section === active;
                      if (it.soon || !it.section) {
                        return (
                          <span
                            key={it.label}
                            aria-disabled
                            className="flex items-center gap-2 min-h-9 px-2.5 rounded-[10px] text-[13px] text-muted-foreground/70 cursor-not-allowed select-none"
                          >
                            <span className="flex-1">{it.label}</span>
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted rounded px-1.5 py-0.5">pronto</span>
                          </span>
                        );
                      }
                      return (
                        <button
                          key={it.label}
                          type="button"
                          onClick={() => onNavigate?.(it.section!)}
                          className={`flex items-center gap-2 min-h-9 px-2.5 rounded-[10px] text-[13px] text-left transition-colors ${
                            isActive
                              ? "bg-primary text-primary-foreground font-medium"
                              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                          }`}
                        >
                          {it.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="pt-4 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex-1 truncate">{getName()}</span>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            onClick={() => { clearSession(); if (typeof location !== "undefined") location.reload(); }}
            aria-label="Salir"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </aside>

      <main className="overflow-y-auto">
        <header className="px-8 py-5 border-b bg-background flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {headerRight}
        </header>
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
