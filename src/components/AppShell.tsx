import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, ChevronsLeft, ChevronsRight, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import { canViewModule, clearSession, getName, getRole } from "@/lib/auth";
import { logout } from "@/lib/api";
import { azIcon } from "@/lib/azureIcons";

// Menú espejo del sidebar de PRD (sidebar.js): mismos grupos, orden, etiquetas
// e iconos. Todos los ítems ya existen como vista React y navegan. `adminOnly`
// replica el data-admin-only de PRD. El grupo gated "Optimización Azure" se omite
// (igual que en PRD, solo aparece con la feature habilitada).
type Item = { label: string; section: string; adminOnly?: boolean };
type Group = { label: string; icon: string; items: Item[] };

const MENU: Group[] = [
  {
    label: "Matriz costos Azure",
    icon: azIcon("cost-management"),
    items: [
      { label: "Optimización de costos", section: "costos" },
      // Convive con la matriz de costos. El acceso lo gatea el backend (rol + lista blanca de
      // emails); la propia vista muestra "módulo no disponible" si el usuario no está autorizado.
      { label: "Oportunidades de Optimización", section: "optimization" },
      { label: "Catálogo de servicios", section: "service-catalog" },
    ],
  },
  {
    label: "Matriz mejoras Azure",
    icon: azIcon("advisor"),
    items: [
      { label: "Recomendaciones", section: "waf" },
      { label: "Validación inteligente", adminOnly: true, section: "waf-validation" },
      { label: "Historial de ingestas", section: "waf-ingestions" },
      { label: "Costo referencial Azure", section: "waf-cost" },
    ],
  },
  {
    label: "Informes",
    icon: azIcon("waf-performance"),
    items: [
      { label: "Informe de gestión mensual", section: "report" },
      { label: "Boletín Azure", section: "boletin" },
      { label: "Informe de valor del servicio", section: "informe-valor" },
    ],
  },
  {
    label: "Gestión CDC",
    icon: azIcon("subscriptions"),
    items: [
      { label: "Reservas por vencer", section: "reservations" },
      { label: "Catálogo de alertas", section: "alerts" },
      { label: "Catálogo de políticas", section: "policies" },
      { label: "Asignación de consultores", section: "consultants" },
      { label: "Revisión de accesos", section: "access-review" },
      { label: "Pendientes CDC", section: "pendientes-cdc" },
      { label: "Pendientes Infra & SSAA", section: "pendientes-infra" },
    ],
  },
  {
    label: "Administración",
    icon: azIcon("resource-groups"),
    items: [
      { label: "Clientes", section: "clientes", adminOnly: true },
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

// Preferencia de menú contraído: se recuerda entre sesiones (como el tema).
const COLLAPSED_KEY = "innovacion_cdc_sidebar_collapsed";
function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Iniciales del usuario para el avatar del rail contraído ("Nombre Apellido" → "NA"). */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

// Estilos compartidos por los ítems de submenú (acordeón expandido y flyout del rail).
function itemClass(isActive: boolean): string {
  return `flex items-center gap-2 min-h-9 px-2.5 rounded-[10px] text-[13px] text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
    isActive
      ? "bg-primary text-primary-foreground font-medium"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
  }`;
}

/**
 * Panel flotante del rail contraído (estilo Azure): título del grupo + sus ítems.
 * Se posiciona `fixed` junto al icono para que no lo recorte el scroll del nav, y
 * se sube si no cabe hasta el borde inferior de la ventana. El `pl-2` del
 * contenedor es el "puente" invisible que permite mover el mouse del icono al
 * panel sin que se cierre (además es un descendiente del grupo, así que el
 * mouseleave del grupo no dispara mientras el puntero está sobre el panel).
 */
function RailFlyout({
  group,
  items,
  active,
  anchor,
  autoFocus,
  onNavigate,
  onClose,
  onEscape,
}: {
  group: Group;
  items: Item[];
  active?: string;
  anchor: { top: number; left: number };
  autoFocus: boolean;
  onNavigate?: (key: string) => void;
  onClose: () => void;
  onEscape: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(anchor.top);

  // Antes de pintar: alinea con el icono y sube el panel si se sale por abajo
  // (si ni así cabe, el propio panel hace scroll: max-h de la clase). Se
  // recalcula cuando cambia el ancla —incluido el reposicionamiento por scroll
  // del rail—; un cambio de tamaño de ventana cierra el flyout, así que no hay
  // posición obsoleta que corregir.
  useLayoutEffect(() => {
    const height = panel.current?.offsetHeight ?? 0;
    const limit = Math.max(8, window.innerHeight - 8 - height);
    setTop(Math.min(Math.max(8, anchor.top - 8), limit));
  }, [anchor.top]);

  // Abierto con teclado (flechas) → el foco entra al primer ítem.
  useEffect(() => {
    if (autoFocus) panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [autoFocus]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      onEscape();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    if (buttons.length === 0) return;
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "ArrowDown" ? (i + 1) % buttons.length : i <= 0 ? buttons.length - 1 : i - 1;
    buttons[next].focus();
  };

  return (
    <div className="fixed z-50 pl-2" style={{ top, left: anchor.left }} onKeyDown={onKeyDown}>
      <div
        ref={panel}
        role="group"
        aria-label={group.label}
        className="bit-flyout min-w-[228px] max-w-[288px] max-h-[calc(100vh-16px)] overflow-y-auto rounded-2xl border border-border bg-popover p-2 text-popover-foreground shadow-lg"
      >
        <div className="mb-1.5 flex items-center gap-2 border-b border-border px-2 pb-2 pt-1">
          <img src={group.icon} alt="" aria-hidden className="w-[18px] h-[18px] shrink-0 object-contain" />
          <span className="text-sm font-extrabold text-foreground">{group.label}</span>
        </div>
        <div className="grid gap-0.5">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              onClick={() => {
                onNavigate?.(it.section);
                onClose();
              }}
              className={itemClass(it.section === active)}
            >
              {it.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
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
  // Título de la pestaña según la vista activa.
  useEffect(() => { document.title = `Business IT · ${title}`; }, [title]);
  const [open, setOpen] = useState<Set<number>>(() => new Set([groupOfSection(active)]));
  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  // --- Menú contraído (rail de iconos) + flyout al pasar el mouse ---
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const [flyout, setFlyout] = useState<{ index: number; top: number; left: number; autoFocus: boolean } | null>(null);
  const triggers = useRef<(HTMLButtonElement | null)[]>([]);
  const closeTimer = useRef<number | null>(null);
  const navRef = useRef<HTMLElement>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);
  const closeFlyout = useCallback(() => {
    cancelClose();
    setFlyout(null);
  }, [cancelClose]);
  // Cierre con gracia: da tiempo a que el puntero llegue al panel.
  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setFlyout(null), 140);
  }, [cancelClose]);
  const openFlyout = useCallback(
    (index: number, autoFocus = false) => {
      cancelClose();
      const rect = triggers.current[index]?.getBoundingClientRect();
      setFlyout({ index, top: rect?.top ?? 0, left: rect?.right ?? 0, autoFocus });
    },
    [cancelClose],
  );
  useEffect(() => cancelClose, [cancelClose]);

  // Escape cierra desde cualquier parte; un resize invalidaría la posición fija.
  // El clic/toque fuera del menú también cierra: en pantallas táctiles no hay
  // "salir con el mouse", así que sin esto el panel quedaría pegado.
  useEffect(() => {
    if (!flyout) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") closeFlyout(); };
    const onPointerDown = (event: Event) => {
      const target = event.target as Node | null;
      if (target && navRef.current?.contains(target)) return;
      closeFlyout();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", closeFlyout);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", closeFlyout);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [flyout, closeFlyout]);

  const toggleCollapsed = () => {
    closeFlyout();
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0"); } catch { /* modo privado: solo se pierde la preferencia */ }
      return next;
    });
  };

  // adminOnly → solo admin; el resto son módulos de la matriz → según permiso del
  // rol. Se conserva el índice original (`gi`) porque es la clave del acordeón.
  const groups = MENU.map((group, gi) => ({
    ...group,
    gi,
    items: group.items.filter((it) => (it.adminOnly ? isAdmin : canViewModule(it.section))),
  })).filter((group) => group.items.length > 0);

  const collapseButton = (
    <button
      type="button"
      onClick={toggleCollapsed}
      aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
      title={collapsed ? "Expandir menú" : "Contraer menú"}
      // Contraído ocupa todo el ancho del rail: así se lee como un control y no
      // como un glifo suelto debajo del logo.
      className={`inline-flex h-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        collapsed ? "w-full" : "w-8 shrink-0"
      }`}
    >
      {collapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
    </button>
  );

  return (
    <div
      className={`min-h-screen grid bg-secondary transition-[grid-template-columns] duration-200 ease-out motion-reduce:transition-none ${
        collapsed ? "grid-cols-[80px_1fr]" : "grid-cols-[260px_1fr]"
      }`}
    >
      {/* Ancho del rail contraído: 80px = 1px de borde + 2×12px de padding + 48px
          del icono + 6px de holgura. Sin esa holgura el icono desborda por
          fracciones de píxel y, como `overflow-y: auto` obliga a `overflow-x:
          auto`, Chrome dibuja una barra de desplazamiento horizontal en el nav. */}
      {/* z-30 es OBLIGATORIO, no cosmético: `position: sticky` hace que el aside
          cree su propio contexto de apilamiento, así que el z-50 del flyout solo
          compite DENTRO del menú. Sin un z positivo aquí, el aside entero se
          pinta en la capa "z-index: auto" y cualquier elemento posicionado con z
          positivo del contenido (p. ej. la barra `sticky z-10` del informe) tapa
          el flyout. 30 lo deja sobre el contenido y debajo de los overlays que se
          montan en <body> (diálogos z-50, BusyOverlay z-100). */}
      <aside
        className={`sticky top-0 z-30 h-screen flex flex-col gap-4 bg-card text-card-foreground border-r border-border py-6 ${
          collapsed ? "px-3" : "px-4"
        }`}
      >
        {/* Logo que conmuta con el tema: oscuro sobre claro / blanco-verde sobre oscuro.
            Tamaño por ALTURA (ambos assets recortados al contenido) → mismo tamaño en los dos modos.
            Contraído usa el isotipo (la "b") para que quepa en el rail. Clic en el logo → inicio. */}
        {collapsed ? (
          <div className="grid justify-items-center gap-2.5">
            <button type="button" onClick={() => onNavigate?.("home")} className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Ir al inicio">
              <img src="/business-it-mark.webp" alt="Business IT" className="h-9 w-9 object-contain" />
            </button>
            {collapseButton}
          </div>
        ) : (
          <div>
            <div className="flex items-start gap-2">
              <button type="button" onClick={() => onNavigate?.("home")} className="block min-w-0 flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Ir al inicio">
                <img src="/business-it-logo.webp" alt="Business IT" className="h-10 w-auto max-w-full object-contain dark:hidden" />
                <img src="/business-it-logo-white-green.webp" alt="" aria-hidden className="h-10 w-auto max-w-full object-contain hidden dark:block" />
              </button>
              {collapseButton}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Plataforma de optimización Azure</p>
          </div>
        )}

        <nav
          ref={navRef}
          aria-label="Menú principal"
          // El cierre por mouse vive aquí, no en cada icono: el trayecto diagonal
          // del icono al panel sale por el borde INFERIOR del icono y pasa un
          // instante sobre el nav. Cerrando solo al salir del nav (el panel es
          // descendiente suyo) no hay zona muerta ni parpadeo, ni siquiera con el
          // mouse muy lento. Verificado punto por punto en navegador.
          onMouseLeave={scheduleClose}
          // Si el rail se desplaza con un flyout abierto (ventanas muy bajas), se
          // recalcula el ancla para que el panel siga junto a su icono.
          onScroll={() => { if (flyout) openFlyout(flyout.index); }}
          // overflow-x-hidden: red de seguridad para que un redondeo de píxel no
          // vuelva a sacar la barra horizontal (no recorta el flyout: al ser
          // `fixed`, el nav no es su bloque contenedor).
          className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden grid content-start ${
            collapsed ? "bit-nav-rail gap-2 justify-items-center" : "bit-nav gap-1.5"
          }`}
        >
          {groups.map((group) => {
            const hasActive = group.items.some((it) => it.section === active);

            // Rail contraído: solo el icono; las opciones salen en el flyout.
            if (collapsed) {
              const isOpen = flyout?.index === group.gi;
              return (
                <div
                  key={group.label}
                  className="relative"
                  // Entrar al icono (o volver al panel, que es su descendiente)
                  // abre/mantiene el flyout y cancela un cierre pendiente.
                  onMouseEnter={() => openFlyout(group.gi)}
                >
                  <button
                    ref={(el) => { triggers.current[group.gi] = el; }}
                    type="button"
                    aria-label={group.label}
                    aria-haspopup="true"
                    aria-expanded={isOpen}
                    // Abrir, nunca alternar: con el mouse encima el panel ya está
                    // abierto y cerrarlo dejaría un callejón sin salida (el
                    // mouseenter no vuelve a disparar sin salir del icono). Se
                    // cierra al salir con el mouse, con Escape o al tocar fuera.
                    onClick={() => openFlyout(group.gi)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                        event.preventDefault();
                        openFlyout(group.gi, true);
                      }
                    }}
                    className={`relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      isOpen || hasActive
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    <img src={group.icon} alt="" aria-hidden className="w-[26px] h-[26px] shrink-0 object-contain bg-foreground/5 rounded-md p-[3px]" />
                    {hasActive && <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-primary" />}
                  </button>
                  {isOpen && flyout && (
                    <RailFlyout
                      group={group}
                      items={group.items}
                      active={active}
                      anchor={{ top: flyout.top, left: flyout.left }}
                      autoFocus={flyout.autoFocus}
                      onNavigate={onNavigate}
                      onClose={closeFlyout}
                      onEscape={() => {
                        closeFlyout();
                        triggers.current[group.gi]?.focus();
                      }}
                    />
                  )}
                </div>
              );
            }

            const isOpen = open.has(group.gi);
            return (
              <div key={group.label}>
                <button
                  type="button"
                  onClick={() => toggle(group.gi)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center gap-3 min-h-[48px] px-3.5 rounded-2xl text-base font-extrabold text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <img src={group.icon} alt="" aria-hidden className="w-[22px] h-[22px] shrink-0 object-contain bg-foreground/5 rounded-md p-[3px]" />
                  <span className="flex-1 text-left">{group.label}</span>
                  <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="grid gap-1 my-1.5 ml-9">
                    {group.items.map((it) => (
                      <button
                        key={it.label}
                        type="button"
                        onClick={() => onNavigate?.(it.section)}
                        className={itemClass(it.section === active)}
                      >
                        {it.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div
          className={`pt-4 border-t border-border text-xs text-muted-foreground ${
            collapsed ? "grid justify-items-center gap-1" : "flex items-center gap-2"
          }`}
        >
          {collapsed ? (
            <span
              title={getName()}
              className="grid h-8 w-8 place-items-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground"
            >
              {initials(getName())}
            </span>
          ) : (
            <span className="flex-1 truncate">{getName()}</span>
          )}
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            onClick={() => { void logout().catch(() => undefined).finally(() => { clearSession(); if (typeof location !== "undefined") location.reload(); }); }}
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
