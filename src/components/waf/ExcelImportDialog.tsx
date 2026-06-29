import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { previewWafExcel, applyWafExcel } from "@/lib/api";
import { excelRowAction, defaultApproved, buildApplyItem, excelSummary, EXCEL_STATUS_META } from "@/lib/waf";
import type { WafExcelPreview, WafExcelApplyItem } from "@/types";

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

export default function ExcelImportDialog({ open, clientId, onOpenChange, onChanged }: {
  open: boolean; clientId: number; onOpenChange: (o: boolean) => void; onChanged: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [useAi, setUseAi] = useState(true);
  const [preview, setPreview] = useState<WafExcelPreview | null>(null);
  const [approved, setApproved] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setFile(null); setUseAi(true); setPreview(null); setApproved({}); setBusy(false); }
  }, [open]);

  async function doPreview() {
    if (!file) return;
    setBusy(true);
    try {
      const p = await previewWafExcel(clientId, file, useAi);
      const init: Record<number, boolean> = {};
      for (const pr of p.rows) init[pr.row.row_number] = defaultApproved(pr);
      setPreview(p);
      setApproved(init);
    } catch (e) {
      toast.error(`Error generando preview: ${msg(e)}`);
    } finally { setBusy(false); }
  }

  async function doApply() {
    if (!preview) return;
    const items: WafExcelApplyItem[] = [];
    for (const pr of preview.rows) {
      if (!approved[pr.row.row_number]) continue;
      const item = buildApplyItem(pr, true);
      if (item) items.push(item);
    }
    if (items.length === 0) { toast.error("No hay filas seleccionadas aplicables."); return; }
    setBusy(true);
    try {
      const r = await applyWafExcel(clientId, { rows: items });
      toast.success(`Importación aplicada · ${excelSummary(r)}`);
      onChanged();
      onOpenChange(false);
    } catch (e) {
      toast.error(`Error aplicando: ${msg(e)}`);
    } finally { setBusy(false); }
  }

  const newCount = preview ? preview.rows.filter((p) => p.status === "new").length : 0;
  const selectedCount = preview ? preview.rows.filter((p) => approved[p.row.row_number] && excelRowAction(p)).length : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Importar matriz Excel</DialogTitle></DialogHeader>
        {!preview ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Sube la matriz WAF (.xlsx). Se cruza con el catálogo antes de aplicar.</p>
            <div className="space-y-1.5">
              <Label htmlFor="xlsx">Archivo Excel</Label>
              <input id="xlsx" type="file" accept=".xlsx" className="block w-full text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} /> Usar IA para el matching (Azure OpenAI)
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="button" disabled={!file || busy} onClick={doPreview}>{busy ? "Generando…" : "Generar preview"}</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap text-[11px]">
              <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200">{preview.rows_matched} match</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">{preview.rows_needs_review} revisar</span>
              <span className="px-2 py-0.5 rounded-full bg-accent text-accent-foreground">{newCount} nuevas</span>
            </div>
            <div className="border rounded-lg overflow-auto max-h-[50vh]">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="p-2 w-8"></th><th className="p-2">Fila</th><th className="p-2">Estado</th><th className="p-2">Acción</th>
                </tr></thead>
                <tbody>
                  {preview.rows.map((pr) => {
                    const action = excelRowAction(pr);
                    const meta = EXCEL_STATUS_META[pr.status];
                    return (
                      <tr key={pr.row.row_number} className="border-b">
                        <td className="p-2"><input type="checkbox" disabled={!action} checked={!!approved[pr.row.row_number]}
                          onChange={(e) => setApproved((m) => ({ ...m, [pr.row.row_number]: e.target.checked }))} /></td>
                        <td className="p-2"><div className="font-medium">{pr.row.excel_code || `Fila ${pr.row.row_number}`}</div>
                          <div className="text-[11px] text-muted-foreground truncate max-w-[220px]">{pr.row.title}</div></td>
                        <td className="p-2"><span className={`text-[11px] px-2 py-0.5 rounded-full ${meta.chip}`}>{meta.label}</span></td>
                        <td className="p-2 text-[12px]">
                          {action === "update" ? <>Actualizar <strong>#{pr.suggested_match?.matrix_code}</strong></>
                            : action === "create" ? `Crear nueva (pilar ${pr.row.pillar_number ?? "?"})`
                            : <span className="text-muted-foreground">no aplicable</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPreview(null)}>Atrás</Button>
              <Button type="button" disabled={busy || selectedCount === 0} onClick={doApply}>{busy ? "Aplicando…" : `Aplicar ${selectedCount} seleccionadas`}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
