import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createService, updateService } from "@/lib/api";
import { fmtDateTime } from "@/lib/dates";
import type { ServiceCatalogItem } from "@/types";

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

type Form = {
  service_key: string; display_name: string; azure_resource_type: string; service_category: string;
  inserter_key: string; calculator_key: string; kql_query: string; detail_table_name: string;
  excel_sheet_name: string; display_order: string; notes: string;
  ri_filter_field: string; ri_filter_values: string; ri_exclude_values: string;
  ri_applicable: boolean; ahb_applicable: boolean; requires_manual_cost: boolean; is_active: boolean;
};
const EMPTY: Form = {
  service_key: "", display_name: "", azure_resource_type: "", service_category: "", inserter_key: "",
  calculator_key: "", kql_query: "", detail_table_name: "", excel_sheet_name: "", display_order: "100",
  notes: "", ri_filter_field: "", ri_filter_values: "", ri_exclude_values: "",
  ri_applicable: false, ahb_applicable: false, requires_manual_cost: false, is_active: true,
};

function fromItem(it: ServiceCatalogItem): Form {
  return {
    service_key: it.service_key, display_name: it.display_name, azure_resource_type: it.azure_resource_type,
    service_category: it.service_category, inserter_key: it.inserter_key, calculator_key: it.calculator_key,
    kql_query: it.kql_query, detail_table_name: it.detail_table_name ?? "", excel_sheet_name: it.excel_sheet_name ?? "",
    display_order: String(it.display_order ?? 100), notes: it.notes ?? "",
    ri_filter_field: it.ri_filter_field ?? "", ri_filter_values: it.ri_filter_values ?? "", ri_exclude_values: it.ri_exclude_values ?? "",
    ri_applicable: !!it.ri_applicable, ahb_applicable: !!it.ahb_applicable, requires_manual_cost: !!it.requires_manual_cost, is_active: !!it.is_active,
  };
}

export default function ServiceFormDialog({ item, inserterKeys, open, onOpenChange, onSaved }: {
  item: ServiceCatalogItem | null; // null = crear
  inserterKeys: string[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const editing = item != null;
  const [f, setF] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => { if (open) setF(item ? fromItem(item) : EMPTY); }, [open, item]);

  async function save() {
    const req = [f.service_key, f.display_name, f.azure_resource_type, f.service_category, f.inserter_key, f.calculator_key, f.kql_query];
    if (!editing && !/^[a-z0-9_]+$/.test(f.service_key.trim())) { toast.error("service_key debe ser snake_case (a-z, 0-9, _)."); return; }
    if (req.some((v) => !v.trim())) { toast.error("Faltan campos obligatorios (key, nombre, tipo, categoría, inserter, calculadora, KQL)."); return; }
    setSaving(true);
    const body = {
      display_name: f.display_name.trim(), azure_resource_type: f.azure_resource_type.trim(), service_category: f.service_category.trim(),
      inserter_key: f.inserter_key, calculator_key: f.calculator_key.trim(), kql_query: f.kql_query,
      detail_table_name: f.detail_table_name.trim() || null, excel_sheet_name: f.excel_sheet_name.trim() || null,
      display_order: Number(f.display_order) || 0, notes: f.notes.trim() || null,
      ri_filter_field: f.ri_filter_field.trim() || null, ri_filter_values: f.ri_filter_values.trim() || null, ri_exclude_values: f.ri_exclude_values.trim() || null,
      ri_applicable: f.ri_applicable, ahb_applicable: f.ahb_applicable, requires_manual_cost: f.requires_manual_cost, is_active: f.is_active,
    };
    try {
      if (editing) { await updateService(item!.service_key, body); toast.success("Servicio actualizado."); }
      else { await createService({ ...body, service_key: f.service_key.trim() }); toast.success("Servicio creado."); }
      onOpenChange(false); onSaved();
    } catch (e) { toast.error(msg(e)); }
    finally { setSaving(false); }
  }

  const field = (label: string, node: React.ReactNode) => (
    <div className="space-y-1"><Label>{label}</Label>{node}</div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? `Editar servicio · ${item!.service_key}` : "Nuevo servicio"}</DialogTitle></DialogHeader>
        {editing && item!.is_internal && (
          <p className="text-xs rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 px-3 py-2">
            Servicio interno del motor de costos. Edítalo con cuidado: cambia cómo se costea a todos los clientes.
          </p>
        )}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {field("service_key", <Input value={f.service_key} disabled={editing} onChange={(e) => set("service_key", e.target.value)} placeholder="p. ej. synapse_dw" />)}
            {field("Nombre visible", <Input value={f.display_name} onChange={(e) => set("display_name", e.target.value)} placeholder="Synapse Dedicated SQL Pool" />)}
            {field("Azure resource type", <Input value={f.azure_resource_type} onChange={(e) => set("azure_resource_type", e.target.value)} placeholder="microsoft.sql/servers/databases" />)}
            {field("Categoría", <Input value={f.service_category} onChange={(e) => set("service_category", e.target.value)} placeholder="compute / database / storage…" />)}
            {field("Inserter", (
              <Select value={f.inserter_key} onValueChange={(v) => set("inserter_key", v)}>
                <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                <SelectContent>{inserterKeys.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
              </Select>
            ))}
            {field("Calculadora (calculator_key)", <Input value={f.calculator_key} onChange={(e) => set("calculator_key", e.target.value)} placeholder="compute_vm, managed_disk, sql_database…" />)}
          </div>
          {field("Consulta KQL", <Textarea rows={5} value={f.kql_query} onChange={(e) => set("kql_query", e.target.value)} className="font-mono text-xs" placeholder="Resources | where type =~ '…'" />)}

          <div className="border-t pt-3">
            <h4 className="text-sm font-medium mb-2">Opciones de costeo</h4>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {([["ri_applicable", "Aplica RI"], ["ahb_applicable", "Aplica AHB"], ["requires_manual_cost", "Costo manual"], ["is_active", "Activo"]] as const).map(([k, lbl]) => (
                <label key={k} className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={f[k]} onChange={(e) => set(k, e.target.checked)} className="accent-primary h-4 w-4" />{lbl}
                </label>
              ))}
            </div>
          </div>

          <div className="border-t pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {field("Tabla de detalle", <Input value={f.detail_table_name} onChange={(e) => set("detail_table_name", e.target.value)} placeholder="vm_details" />)}
            {field("Hoja Excel", <Input value={f.excel_sheet_name} onChange={(e) => set("excel_sheet_name", e.target.value)} maxLength={31} placeholder="Optimizacion VMs" />)}
            {field("Orden", <Input type="number" value={f.display_order} onChange={(e) => set("display_order", e.target.value)} />)}
            {field("RI: campo filtro", <Input value={f.ri_filter_field} onChange={(e) => set("ri_filter_field", e.target.value)} placeholder="opcional" />)}
            {field("RI: valores incluidos", <Input value={f.ri_filter_values} onChange={(e) => set("ri_filter_values", e.target.value)} placeholder="opcional (coma)" />)}
            {field("RI: valores excluidos", <Input value={f.ri_exclude_values} onChange={(e) => set("ri_exclude_values", e.target.value)} placeholder="opcional (coma)" />)}
          </div>
          {field("Notas", <Textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Observaciones de costeo…" />)}
          {editing && <p className="text-xs text-muted-foreground">Creado: {fmtDateTime(item!.created_at)}{item!.updated_at ? ` · Actualizado: ${fmtDateTime(item!.updated_at)}` : ""}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Guardando…" : editing ? "Guardar" : "Crear servicio"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
