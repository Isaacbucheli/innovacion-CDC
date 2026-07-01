import { ArrowRight } from "lucide-react";
import AppShell from "@/components/AppShell";
import { getName, getRole } from "@/lib/auth";
import { MODULE_GROUPS, MODULE_BY_KEY, type ModuleItem } from "@/lib/modules";

function firstName(name: string) { return (name || "").trim().split(/\s+/)[0] || ""; }

export default function HomePage({ recent, onNavigate }: {
  recent: string[];
  onNavigate: (key: string) => void;
}) {
  const isAdmin = getRole() === "admin";
  const name = firstName(getName());
  const visible = MODULE_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((it) => !it.adminOnly || isAdmin) }))
    .filter((g) => g.items.length > 0);
  const total = visible.reduce((s, g) => s + g.items.length, 0);
  const recentItems = recent.map((k) => MODULE_BY_KEY[k]).filter(Boolean).slice(0, 5) as ModuleItem[];

  const Card = ({ it }: { it: ModuleItem }) => (
    <button
      type="button"
      onClick={() => onNavigate(it.key)}
      className="group text-left rounded-xl border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/40"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 shrink-0 rounded-lg grid place-items-center bg-primary/15 text-primary">
          <it.icon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 font-medium">{it.label}
            <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{it.desc}</p>
        </div>
      </div>
    </button>
  );

  return (
    <AppShell title="Inicio" subtitle="Plataforma de optimización Azure" active="home" onNavigate={onNavigate}>
      <div className="space-y-8">
        {/* Saludo + resumen */}
        <div>
          <h2 className="text-2xl font-semibold">Hola{name ? `, ${name}` : ""} 👋</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Tienes {total} módulo{total === 1 ? "" : "s"} disponible{total === 1 ? "" : "s"}. Elige uno para empezar.
          </p>
        </div>

        {/* Accesos recientes */}
        {recentItems.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Accesos recientes</h3>
            <div className="flex flex-wrap gap-2">
              {recentItems.map((it) => (
                <button key={it.key} type="button" onClick={() => onNavigate(it.key)}
                  className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm hover:border-primary/50 hover:bg-accent/40 transition-colors">
                  <it.icon className="w-4 h-4 text-primary" />{it.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tarjetas por área */}
        {visible.map((g) => (
          <div key={g.group} className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">{g.group}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {g.items.map((it) => <Card key={it.key} it={it} />)}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
