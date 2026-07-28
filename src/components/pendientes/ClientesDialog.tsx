import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import type { PendienteCliente, PendienteClienteWrite } from "@/types";
import {
  createPendienteCliente,
  deletePendienteCliente,
  updatePendienteCliente,
} from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import ConfirmDelete from "@/components/ConfirmDelete";

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const VACIO: PendienteClienteWrite = {
  cliente: "", servicio: "", categoria: "", pais: "", coordinador: "", consultor: "",
};

/**
 * Catálogo de clientes del tablero. Es propio de esta base: no es la tabla de clientes de la
 * plataforma ni la de Asignación de consultores (decisión del usuario, 2026-07-28).
 *
 * El borrado se niega cuando el cliente tiene pendientes: el backend responde 409 y acá se muestra
 * ese mensaje. Nunca hay cascada.
 */
export default function ClientesDialog({
  area, open, clientes, canEdit, onOpenChange, onChanged,
}: {
  area: string;
  open: boolean;
  clientes: PendienteCliente[];
  canEdit: boolean;
  onOpenChange: (o: boolean) => void;
  onChanged: () => void;
}) {
  // undefined = formulario cerrado, null = alta, número = editando ese Num
  const [editing, setEditing] = useState<number | null | undefined>(undefined);
  const [form, setForm] = useState<PendienteClienteWrite>(VACIO);
  const [saving, setSaving] = useState(false);
  const [borrar, setBorrar] = useState<PendienteCliente | null>(null);

  useEffect(() => { if (!open) { setEditing(undefined); setForm(VACIO); } }, [open]);

  function abrirAlta() { setEditing(null); setForm(VACIO); }

  function abrirEdicion(c: PendienteCliente) {
    setEditing(c.num);
    setForm({
      cliente: c.cliente,
      servicio: c.servicio ?? "",
      categoria: c.categoria ?? "",
      pais: c.pais ?? "",
      coordinador: c.coordinador ?? "",
      consultor: c.consultor ?? "",
    });
  }

  async function guardar() {
    if (!form.cliente.trim()) { toast.error("El nombre del cliente es obligatorio"); return; }
    setSaving(true);
    try {
      const body: PendienteClienteWrite = {
        cliente: form.cliente.trim(),
        servicio: form.servicio || null,
        categoria: form.categoria || null,
        pais: form.pais || null,
        coordinador: form.coordinador || null,
        consultor: form.consultor || null,
      };
      if (editing === null) await createPendienteCliente(area, body);
      else if (typeof editing === "number") await updatePendienteCliente(area, editing, body);
      toast.success("Cliente guardado.");
      setEditing(undefined);
      onChanged();
    } catch (e) { toast.error(msg(e)); }
    finally { setSaving(false); }
  }

  async function confirmarBorrado() {
    if (!borrar) return;
    try {
      await deletePendienteCliente(area, borrar.num);
      toast.success(`Cliente "${borrar.cliente}" eliminado.`);
      setBorrar(null);
      onChanged();
    } catch (e) { toast.error(msg(e)); }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Clientes del tablero</DialogTitle>
          </DialogHeader>

          {canEdit && (
            <div className="flex justify-end">
              {editing === undefined ? (
                <Button size="sm" variant="outline" onClick={abrirAlta}>
                  <Plus className="w-4 h-4 mr-1" /> Nuevo cliente
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setEditing(undefined)}>
                  <X className="w-4 h-4 mr-1" /> Cerrar formulario
                </Button>
              )}
            </div>
          )}

          {editing !== undefined && (
            <div className="rounded-lg border bg-background p-3 grid gap-2 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="cli-nombre">Cliente</Label>
                <Input id="cli-nombre" value={form.cliente}
                  onChange={(e) => setForm({ ...form, cliente: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="cli-servicio">Servicio</Label>
                <Input id="cli-servicio" value={form.servicio ?? ""}
                  onChange={(e) => setForm({ ...form, servicio: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="cli-categoria">Categoría</Label>
                <select id="cli-categoria" className={selectClass} value={form.categoria ?? ""}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                  <option value="">—</option>
                  {["ALTO", "MEDIO", "BAJO"].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="cli-pais">País</Label>
                <Input id="cli-pais" value={form.pais ?? ""}
                  onChange={(e) => setForm({ ...form, pais: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="cli-coord">Coordinador</Label>
                <Input id="cli-coord" value={form.coordinador ?? ""}
                  onChange={(e) => setForm({ ...form, coordinador: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="cli-consultor">Consultor</Label>
                <Input id="cli-consultor" value={form.consultor ?? ""}
                  onChange={(e) => setForm({ ...form, consultor: e.target.value })} />
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button size="sm" onClick={guardar} disabled={saving}>Guardar cliente</Button>
              </div>
            </div>
          )}

          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader className="bg-secondary">
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>País</TableHead>
                  <TableHead>Consultor</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Todavía no hay clientes en esta área.
                    </TableCell>
                  </TableRow>
                ) : (
                  clientes.map((c) => (
                    <TableRow key={c.num}>
                      <TableCell className="text-muted-foreground">{c.num}</TableCell>
                      <TableCell className="font-medium">{c.cliente}</TableCell>
                      <TableCell>{c.servicio ?? "—"}</TableCell>
                      <TableCell>{c.categoria ?? ""}</TableCell>
                      <TableCell>{c.pais ?? "—"}</TableCell>
                      <TableCell>{c.consultor ?? "—"}</TableCell>
                      <TableCell>
                        {canEdit && (
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Editar ${c.cliente}`}
                              onClick={() => abrirEdicion(c)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Eliminar ${c.cliente}`}
                              onClick={() => setBorrar(c)}>
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDelete
        open={!!borrar}
        label={borrar?.cliente ?? ""}
        onOpenChange={(o) => !o && setBorrar(null)}
        onConfirm={confirmarBorrado} />
    </>
  );
}
