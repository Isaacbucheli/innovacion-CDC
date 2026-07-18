import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Save, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getActionPlan, seedActionPlan, createActionItem, updateActionItem, deleteActionItem } from "@/lib/api";
import { STATE_COLORS } from "@/lib/executive";
import type { ActionPlanItem } from "@/types";

const PRIO_STATE: Record<string, string> = { Alta: "rojo", Media: "amarillo", Baja: "verde" };
function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

interface Row extends ActionPlanItem { _key: string }
let _seq = 0;
const withKey = (it: ActionPlanItem): Row => ({ ...it, _key: it.item_id != null ? `i${it.item_id}` : `n${_seq++}` });

function StatusDot({ estado }: { estado: string }) {
  return <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: STATE_COLORS[estado] ?? STATE_COLORS.verde }} />;
}

// Plan de acción priorizado del informe gerencial: hallazgos automáticos sembrados + criterio del
// consultor. Cambios por fila (crear/editar/borrar) contra el backend .NET.
export default function ExecutiveActionPlan({ clientId, year, month }: { clientId: number; year: number; month: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [estados, setEstados] = useState<string[]>([]);
  const [prioridades, setPrioridades] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [readonlyDefaults, setReadonlyDefaults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setEditing(false);
    (async () => {
      try {
        const data = await getActionPlan(clientId, year, month);
        if (!alive) return;
        setCanEdit(data.can_edit); setEstados(data.estados); setPrioridades(data.prioridades);
        let items = data.items;
        let ro = false;
        if (!items.length && data.can_edit && (data.defaults?.length ?? 0) > 0) {
          // Primer acceso de un editor: se siembran los hallazgos automáticos para partir de ahí.
          const seeded = await seedActionPlan(clientId, year, month);
          if (!alive) return;
          items = seeded.items;
        } else if (!items.length && !data.can_edit && (data.defaults?.length ?? 0) > 0) {
          items = data.defaults; ro = true;
        }
        setRows(items.map(withKey));
        setReadonlyDefaults(ro);
      } catch (e) {
        if (alive) toast.error(`No se pudo cargar el plan de acción: ${msg(e)}`);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [clientId, year, month]);

  function patch(key: string, field: keyof ActionPlanItem, value: string) {
    setRows((rs) => rs.map((r) => (r._key === key ? { ...r, [field]: value } : r)));
  }

  async function saveRow(row: Row, index: number) {
    if ((row.hallazgo ?? "").trim().length < 3) { toast.error("El hallazgo no puede estar vacío."); return; }
    const body = {
      prioridad: row.prioridad, hallazgo: row.hallazgo.trim(),
      accion: (row.accion ?? "").trim() || null, responsable: (row.responsable ?? "").trim() || null,
      estado: row.estado, orden: index,
    };
    setBusy(row._key);
    try {
      const res = row.item_id != null
        ? await updateActionItem(clientId, year, month, row.item_id, body)
        : await createActionItem(clientId, year, month, body);
      setRows(res.items.map(withKey));
      toast.success("Plan de acción guardado.");
    } catch (e) { toast.error(`No se pudo guardar: ${msg(e)}`); }
    finally { setBusy(null); }
  }

  async function removeRow(row: Row) {
    if (row.item_id == null) { setRows((rs) => rs.filter((r) => r._key !== row._key)); return; }
    setBusy(row._key);
    try {
      const res = await deleteActionItem(clientId, year, month, row.item_id);
      setRows(res.items.map(withKey));
    } catch (e) { toast.error(`No se pudo eliminar: ${msg(e)}`); }
    finally { setBusy(null); }
  }

  function addRow() {
    setRows((rs) => [...rs, withKey({ prioridad: "Media", hallazgo: "", accion: "", responsable: "", estado: estados[0] ?? "Pendiente" })]);
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">Plan de acción priorizado</h3>
          <p className="text-xs text-muted-foreground">Hallazgos automáticos del informe + criterio del consultor. Los cambios se guardan por fila.</p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>
              {editing ? <><Check className="w-4 h-4 mr-1" />Terminar edición</> : <><Pencil className="w-4 h-4 mr-1" />Editar plan</>}
            </Button>
            {editing && <Button size="sm" variant="outline" onClick={addRow}><Plus className="w-4 h-4 mr-1" />Agregar fila</Button>}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando plan…</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Prioridad</TableHead>
                <TableHead>Hallazgo</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead className="w-[150px]">Responsable</TableHead>
                <TableHead className="w-[130px]">Estado</TableHead>
                {editing && <TableHead className="w-[100px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={editing ? 6 : 5} className="text-center text-muted-foreground py-8">Sin hallazgos relevantes en el periodo.</TableCell></TableRow>
              ) : rows.map((row, i) => editing ? (
                <TableRow key={row._key} className="align-top">
                  <TableCell>
                    <Select value={row.prioridad} onValueChange={(v) => patch(row._key, "prioridad", v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{prioridades.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Textarea rows={2} value={row.hallazgo} onChange={(e) => patch(row._key, "hallazgo", e.target.value)} /></TableCell>
                  <TableCell><Textarea rows={2} value={row.accion ?? ""} onChange={(e) => patch(row._key, "accion", e.target.value)} /></TableCell>
                  <TableCell><Input value={row.responsable ?? ""} onChange={(e) => patch(row._key, "responsable", e.target.value)} /></TableCell>
                  <TableCell>
                    <Select value={row.estado} onValueChange={(v) => patch(row._key, "estado", v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{estados.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="outline" className="h-8 w-8" disabled={busy === row._key} onClick={() => saveRow(row, i)} aria-label="Guardar"><Save className="w-4 h-4" /></Button>
                      <Button size="icon" variant="outline" className="h-8 w-8 text-red-600" disabled={busy === row._key} onClick={() => removeRow(row)} aria-label="Eliminar"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={row._key}>
                  <TableCell><span className="text-xs"><StatusDot estado={PRIO_STATE[row.prioridad] ?? "verde"} />{row.prioridad}</span></TableCell>
                  <TableCell>
                    <span className="font-medium">{row.hallazgo}</span>
                    {row.updated_by && <span className="block text-[11px] text-muted-foreground mt-0.5">Editado por {row.updated_by}</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.accion || "—"}</TableCell>
                  <TableCell>{row.responsable || "—"}</TableCell>
                  <TableCell>{row.estado}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {readonlyDefaults && <p className="text-[11px] text-muted-foreground">Hallazgos automáticos del periodo (aún sin revisión del consultor).</p>}
    </div>
  );
}
