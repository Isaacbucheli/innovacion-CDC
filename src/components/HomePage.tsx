import { ArrowRight, ChevronDown } from "lucide-react";
import AppShell from "@/components/AppShell";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { canViewModule, getName, getRole } from "@/lib/auth";
import { MODULE_GROUPS, MODULE_BY_KEY, type ModuleItem } from "@/lib/modules";
import { azIcon } from "@/lib/azureIcons";

// Portal de servicios: cada tarjeta representa un ÁREA. Las "direct" saltan a su
// página principal; las que tienen `groupKey` despliegan un popup con los módulos
// de ese grupo (los mismos del menú lateral). Los íconos son los oficiales de
// Azure ya incrustados en el bundle (azIcon) — mismos que usa el sidebar por grupo.
type Area = {
  key: string;
  label: string;
  desc: string;
  icon: string;
  to?: string;        // tarjeta directa → onNavigate(to)
  groupKey?: string;  // grupo de MODULE_GROUPS a desplegar en el popup
};

const AREAS: Area[] = [
  { key: "costos", label: "Matriz de costos", desc: "Costos PAYG y escenarios de ahorro. Abre Optimización de costos.", icon: azIcon("cost-management"), to: "costos" },
  { key: "mejoras", label: "Matriz Mejoras Azure", desc: "Well-Architected por pilar. Abre Recomendaciones.", icon: azIcon("advisor"), to: "waf" },
  { key: "informes", label: "Informes", desc: "Informe de gestión mensual, Boletín Azure e informe de valor del servicio.", icon: azIcon("waf-performance"), groupKey: "Informes" },
  { key: "cdc", label: "Gestión CDC", desc: "Reservas, alertas, políticas y consultores.", icon: azIcon("subscriptions"), groupKey: "Gestión CDC" },
  { key: "admin", label: "Administración", desc: "Clientes y usuarios de la plataforma.", icon: azIcon("resource-groups"), groupKey: "Administración" },
];

// Cara común de la tarjeta (directa y con popup comparten estilo).
const FACE =
  "group flex w-full flex-col justify-between gap-3.5 min-h-[168px] rounded-2xl border border-transparent " +
  "bg-muted p-5 text-left transition-all hover:bg-card hover:border-primary/50 hover:-translate-y-0.5 " +
  "hover:shadow-[0_8px_24px_-14px_rgba(0,0,0,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "data-[state=open]:bg-card data-[state=open]:border-primary/60";

function Badge({ icon }: { icon: string }) {
  return (
    <div className="w-[52px] h-[52px] shrink-0 rounded-[14px] border bg-card grid place-items-center">
      <img src={icon} alt="" aria-hidden className="w-[30px] h-[30px] object-contain" />
    </div>
  );
}

function Body({ label, desc, meta }: { label: string; desc: string; meta: React.ReactNode }) {
  return (
    <div>
      <div className="font-bold text-[1.05rem] leading-tight">{label}</div>
      <p className="text-[13px] text-muted-foreground leading-snug mt-1">{desc}</p>
      <div className="mt-2 min-h-6 flex items-center">{meta}</div>
    </div>
  );
}

export default function HomePage({ recent = [], onNavigate }: {
  recent?: string[];
  onNavigate: (key: string) => void;
}) {
  const isAdmin = getRole() === "admin";
  const name = (getName() || "").trim();

  // Accesos recientes (filtrados por rol, máx. 5).
  const recentItems = recent
    .map((k) => MODULE_BY_KEY[k])
    .filter((it): it is ModuleItem => !!it && (it.adminOnly ? isAdmin : canViewModule(it.key)))
    .slice(0, 5);

  // Resuelve los ítems visibles de las tarjetas con popup y descarta las que
  // quedan sin opciones para el rol (p. ej. Administración para un no-admin).
  const cards = AREAS.map((a) => {
    if (!a.groupKey) return { area: a, items: [] as ModuleItem[] };
    const group = MODULE_GROUPS.find((g) => g.group === a.groupKey);
    const items = (group?.items ?? []).filter((it) => (it.adminOnly ? isAdmin : canViewModule(it.key)));
    return { area: a, items };
  }).filter(({ area, items }) => area.to || items.length > 0);

  return (
    <AppShell title="Inicio" subtitle="Plataforma de optimización Azure" active="home" onNavigate={onNavigate}>
      <div className="space-y-7">
        <div className="space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">Hola{name ? `, ${name}` : ""}</h2>
          {recentItems.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Recientes:</span>
              {recentItems.map((it) => (
                <button
                  key={it.key}
                  type="button"
                  onClick={() => onNavigate(it.key)}
                  className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary/50 hover:bg-accent"
                >
                  {it.azureIcon
                    ? <img src={it.azureIcon} alt="" aria-hidden className="w-4 h-4 object-contain" />
                    : <it.icon className="w-4 h-4 text-primary" />}
                  {it.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-sm font-semibold mb-3.5">Todos los servicios</p>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
            {cards.map(({ area, items }) =>
              area.to ? (
                <button key={area.key} type="button" onClick={() => onNavigate(area.to!)} className={FACE}>
                  <Badge icon={area.icon} />
                  <Body
                    label={area.label}
                    desc={area.desc}
                    meta={
                      <ArrowRight className="ml-auto w-4 h-4 text-primary opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                    }
                  />
                </button>
              ) : (
                <DropdownMenu key={area.key}>
                  <DropdownMenuTrigger className={FACE}>
                    <Badge icon={area.icon} />
                    <Body
                      label={area.label}
                      desc={area.desc}
                      meta={
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent text-primary text-[11px] font-bold px-2.5 py-1">
                          <ChevronDown className="w-3.5 h-3.5 transition-transform group-data-[state=open]:rotate-180" />
                          {items.length} {items.length === 1 ? "opción" : "opciones"}
                        </span>
                      }
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={8} className="w-64">
                    <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {area.label}
                    </DropdownMenuLabel>
                    {items.map((it) => (
                      <DropdownMenuItem
                        key={it.key}
                        onSelect={() => onNavigate(it.key)}
                        className="gap-2.5 py-2 cursor-pointer"
                      >
                        {it.azureIcon
                          ? <img src={it.azureIcon} alt="" aria-hidden className="w-4 h-4 object-contain" />
                          : <it.icon className="w-4 h-4 text-primary" />}
                        {it.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ),
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
