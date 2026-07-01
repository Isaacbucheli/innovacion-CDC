import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Plus } from "lucide-react";
import AppShell from "@/components/AppShell";
import BusyOverlay from "@/components/BusyOverlay";
import SimpleTable, { type SimpleCol } from "@/components/reports/SimpleTable";
import ServiceFormDialog from "@/components/services/ServiceFormDialog";
import ConfirmDelete from "@/components/ConfirmDelete";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { listAllServices, listInserterKeys, updateService, deleteService } from "@/lib/api";
import { serviceIcon } from "@/lib/costs";
import { getRole } from "@/lib/auth";
import type { ServiceCatalogItem } from "@/types";

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }
const chip = (cls: string, text: React.ReactNode) => <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{text}</span>;
const OK = "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200";
const NEUTRAL = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
const TAG = "bg-primary/15 text-primary";

export default function ServiceCatalogPage({ onNavigate }: { onNavigate?: (key: string) => void }) {
  const isAdmin = getRole() === "admin";
  const [rows, setRows] = useState<ServiceCatalogItem[]>([]);
  const [inserterKeys, setInserterKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formItem, setFormItem] = useState<ServiceCatalogItem | null | undefined>(undefined); // undefined=cerrado, null=crear
  const [toDelete, setToDelete] = useState<ServiceCatalogItem | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([listAllServices(), listInserterKeys()])
      .then(([s, k]) => { if (mounted.current) { setRows([...s].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))); setInserterKeys(k); } })
      .catch((e) => toast.error(msg(e)))
      .finally(() => { if (mounted.current) setLoading(false); });
  }, []);
  useEffect(() => { reload(); }, [reload]);

  async function toggleActive(s: ServiceCatalogItem) {
    setBusy(true);
    try { await updateService(s.service_key, { is_active: !s.is_active }); toast.success(s.is_active ? "Servicio desactivado." : "Servicio activado."); reload(); }
    catch (e) { toast.error(msg(e)); }
    finally { setBusy(false); }
  }
  async function confirmDelete() {
    if (!toDelete) return;
    try { await deleteService(toDelete.service_key); toast.success(`Servicio "${toDelete.service_key}" desactivado.`); setToDelete(null); reload(); }
    catch (e) { toast.error(msg(e)); setToDelete(null); }
  }

  const cols: SimpleCol<ServiceCatalogItem>[] = [
    { key: "service_key", label: "Key", render: (s) => <span className="font-mono text-xs">{s.service_key}</span> },
    { key: "display_name", label: "Nombre", render: (s) => (
      <span className="inline-flex items-center gap-2 font-medium">
        <img src={serviceIcon(s.service_key)} alt="" aria-hidden className="w-5 h-5 object-contain shrink-0" />
        {s.display_name}
      </span>
    ) },
    { key: "service_category", label: "Categoría" },
    { key: "inserter_key", label: "Inserter", render: (s) => <span className="font-mono text-xs">{s.inserter_key}</span> },
    { key: "calculator_key", label: "Calculadora", render: (s) => <span className="font-mono text-xs">{s.calculator_key}</span> },
    { key: "flags", label: "Costeo", render: (s) => (
      <span className="flex flex-wrap gap-1">
        {s.ri_applicable && chip(TAG, "RI")}
        {s.ahb_applicable && chip(TAG, "AHB")}
        {s.requires_manual_cost && chip(NEUTRAL, "Manual")}
      </span>
    ) },
    { key: "estado", label: "Estado", render: (s) => (
      <span className="flex flex-wrap gap-1">
        {chip(s.is_active ? OK : NEUTRAL, s.is_active ? "Activo" : "Inactivo")}
        {s.is_internal && chip(NEUTRAL, "Interno")}
      </span>
    ) },
    ...(isAdmin ? [{ key: "acc", label: "", render: (s: ServiceCatalogItem) => (
      <div className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Acciones"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setFormItem(s)}>Editar</DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleActive(s)}>{s.is_active ? "Desactivar" : "Activar"}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setToDelete(s)} disabled={s.is_internal} className="text-destructive focus:text-destructive">Eliminar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ) }] : []),
  ];

  return (
    <AppShell title="Catálogo de servicios" subtitle="Matriz costos Azure · servicios que alimentan el motor de costos"
      active="service-catalog" onNavigate={onNavigate}
      headerRight={isAdmin ? <Button size="sm" onClick={() => setFormItem(null)}><Plus className="w-4 h-4 mr-1" />Nuevo servicio</Button> : undefined}>
      <BusyOverlay show={loading || busy} title={busy ? "Actualizando servicio" : "Cargando catálogo"} />
      <div className="space-y-3">
        <SimpleTable cols={cols} rows={rows} empty="No hay servicios registrados." />
        <p className="text-xs text-muted-foreground border-l-2 border-border pl-3">
          Este catálogo define qué recursos de Azure se importan y cómo se costean. Cambiarlo afecta el costeo de todos los clientes; solo los administradores pueden editarlo.
        </p>
      </div>
      <ServiceFormDialog
        item={formItem ?? null}
        inserterKeys={inserterKeys}
        open={formItem !== undefined}
        onOpenChange={(o) => !o && setFormItem(undefined)}
        onSaved={reload}
      />
      <ConfirmDelete open={toDelete != null} label={toDelete?.service_key ?? ""} onOpenChange={(o) => !o && setToDelete(null)} onConfirm={confirmDelete} />
    </AppShell>
  );
}
