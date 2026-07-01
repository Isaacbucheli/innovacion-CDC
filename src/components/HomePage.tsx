import { ArrowRight, LayoutGrid } from "lucide-react";
import AppShell from "@/components/AppShell";
import { getName, getRole } from "@/lib/auth";
import { MODULE_GROUPS, MODULE_BY_KEY, type ModuleItem } from "@/lib/modules";

function firstName(name: string) { return (name || "").trim().split(/\s+/)[0] || ""; }

// Acento de color por área (comunica la sección sin encabezados). Funciona en claro y oscuro.
const AREA_COLOR: Record<string, string> = {
  "Matriz costos Azure": "#639922",
  "Matriz mejoras Azure": "#378add",
  "Informes": "#ba7517",
  "Gestión CDC": "#1d9e75",
  "Administración": "#7f77dd",
};
// Módulos destacados (ocupan más espacio en el bento).
const FEATURED = new Set(["costos", "waf", "report"]);

type Tile = ModuleItem & { area: string; color: string; featured: boolean };

export default function HomePage({ recent, onNavigate }: {
  recent: string[];
  onNavigate: (key: string) => void;
}) {
  const isAdmin = getRole() === "admin";
  const name = firstName(getName());
  const todayRaw = new Date().toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" });
  const today = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1);

  const tiles: Tile[] = MODULE_GROUPS.flatMap((g) =>
    g.items
      .filter((it) => !it.adminOnly || isAdmin)
      .map((it) => ({ ...it, area: g.group, color: AREA_COLOR[g.group] ?? "#639922", featured: FEATURED.has(it.key) })),
  );
  const total = tiles.length;

  // Accesos recientes filtrados por rol.
  const recentItems = recent
    .map((k) => MODULE_BY_KEY[k])
    .filter((it): it is ModuleItem => !!it && (!it.adminOnly || isAdmin))
    .slice(0, 5);

  return (
    <AppShell title="Inicio" subtitle="Plataforma de optimización Azure" active="home" onNavigate={onNavigate}>
      <div className="space-y-6">
        {/* Hero de bienvenida */}
        <div className="rounded-2xl border bg-primary/10 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 shrink-0 rounded-xl grid place-items-center bg-primary text-primary-foreground">
              <LayoutGrid className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-semibold leading-tight">Hola{name ? `, ${name}` : ""}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{total} módulo{total === 1 ? "" : "s"} disponible{total === 1 ? "" : "s"} · plataforma de optimización Azure</p>
            </div>
            <span className="hidden sm:block text-xs text-muted-foreground self-start">{today}</span>
          </div>
          {recentItems.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <span className="text-xs text-muted-foreground">Recientes:</span>
              {recentItems.map((it) => (
                <button key={it.key} type="button" onClick={() => onNavigate(it.key)}
                  className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm hover:border-primary/50 hover:bg-accent/40 transition-colors">
                  {it.azureIcon ? <img src={it.azureIcon} alt="" aria-hidden className="w-4 h-4 object-contain" /> : <it.icon className="w-4 h-4 text-primary" />}
                  {it.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bento de módulos */}
        <div className="grid grid-cols-2 lg:grid-cols-4 auto-rows-[112px] gap-3 [grid-auto-flow:dense]">
          {tiles.map((it) => (
            <button
              key={it.key}
              type="button"
              onClick={() => onNavigate(it.key)}
              className={`group relative text-left rounded-xl border p-4 flex flex-col justify-between transition-colors hover:bg-accent/40 ${
                it.featured ? "col-span-2 row-span-2" : "col-span-1"
              }`}
              style={it.featured ? { background: `${it.color}14`, borderColor: `${it.color}55` } : undefined}
            >
              <div className="w-10 h-10 rounded-lg grid place-items-center" style={{ background: `${it.color}22`, color: it.color }}>
                {it.azureIcon
                  ? <img src={it.azureIcon} alt="" aria-hidden className={`object-contain ${it.featured ? "w-6 h-6" : "w-5 h-5"}`} />
                  : <it.icon className={it.featured ? "w-6 h-6" : "w-5 h-5"} />}
              </div>
              <div>
                <div className="flex items-center gap-1 font-medium leading-tight">
                  {it.label}
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                </div>
                {it.featured && <p className="text-xs text-muted-foreground mt-1 leading-snug">{it.desc}</p>}
                <span className="mt-1 inline-block text-[11px] text-muted-foreground/80">{it.area}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
