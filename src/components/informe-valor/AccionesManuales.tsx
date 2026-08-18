import { useCallback, useEffect, useState } from "react";
import { MoreHorizontal, Paperclip, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import SimpleTable, { type SimpleCol } from "@/components/reports/SimpleTable";
import ExtraerEvidenciaDialog from "./ExtraerEvidenciaDialog";
import {
  actualizarAccionManual, crearAccionManual, eliminarAccionManual, getAccionesManuales,
} from "@/lib/api";
import { etiquetaMes, fmtMonto } from "@/lib/informeValor";
import type { AccionManual, AccionManualBody } from "@/types";

const MES_VALIDO = /^\d{4}-(0[1-9]|1[0-2])$/;

interface Formulario {
  oportunidad: string;
  categoria: string;
  mes_ejecucion: string;
  mes_fin: string;
  monto_mensual: string;
  recurso: string;
  nota: string;
}

const FORM_VACIO: Formulario = {
  oportunidad: "", categoria: "", mes_ejecucion: "", mes_fin: "",
  monto_mensual: "", recurso: "", nota: "",
};

/** Las mismas reglas del backend, replicadas para el error inline (el backend revalida igual). */
function validar(f: Formulario): string | null {
  if (!f.oportunidad.trim()) return "La oportunidad es obligatoria: es el nombre de la acción ejecutada.";
  if (!MES_VALIDO.test(f.mes_ejecucion)) return "El mes de ejecución lleva la forma aaaa-MM (por ejemplo 2026-07).";
  if (f.mes_fin && !MES_VALIDO.test(f.mes_fin)) return "El mes de fin, si viene, lleva la forma aaaa-MM.";
  if (f.mes_fin && f.mes_fin < f.mes_ejecucion) return "El mes de fin no puede ser anterior al mes de ejecución.";
  if (f.monto_mensual !== "" && Number(f.monto_mensual) < 0) return "El ahorro mensual no puede ser negativo.";
  return null;
}

function cuerpoDe(f: Formulario, evidencia: string | null): AccionManualBody {
  return {
    oportunidad: f.oportunidad.trim(),
    categoria: f.categoria.trim() || null,
    mes_ejecucion: f.mes_ejecucion,
    mes_fin: f.mes_fin || null,
    monto_mensual: f.monto_mensual === "" ? null : Number(f.monto_mensual),
    recurso: f.recurso.trim() || null,
    nota: f.nota.trim() || null,
    evidencia,
  };
}

/**
 * El registro manual de acciones ejecutadas (entrega 8, pieza B): la unidad de la PPT de
 * referencia como CRUD del módulo. Estas filas entran al titular del informe con su monto
 * rotulado "declarado por el consultor" — el registro completo (barrido, matriz, reservas y
 * estas) se revisa en la pestaña Informe, sección "Lo ejecutado".
 */
export default function AccionesManuales({
  clientId, canEdit, onCambio,
}: {
  clientId: number;
  canEdit: boolean;
  onCambio: () => void;
}) {
  const [acciones, setAcciones] = useState<AccionManual[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [evidenciaAbierta, setEvidenciaAbierta] = useState(false);
  const [editando, setEditando] = useState<AccionManual | null>(null);
  const [form, setForm] = useState<Formulario>(FORM_VACIO);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setAcciones(await getAccionesManuales(clientId));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }, [clientId]);

  useEffect(() => { void cargar(); }, [cargar]);

  function abrirAlta() {
    setEditando(null);
    setForm(FORM_VACIO);
    setErrorForm(null);
    setAbierto(true);
  }

  function abrirEdicion(a: AccionManual) {
    setEditando(a);
    setForm({
      oportunidad: a.oportunidad,
      categoria: a.categoria ?? "",
      mes_ejecucion: a.mes_ejecucion,
      mes_fin: a.mes_fin ?? "",
      monto_mensual: a.monto_mensual === null ? "" : String(a.monto_mensual),
      recurso: a.recurso ?? "",
      nota: a.nota ?? "",
    });
    setErrorForm(null);
    setAbierto(true);
  }

  async function guardar() {
    const detalle = validar(form);
    if (detalle) {
      setErrorForm(detalle);
      return;
    }
    setErrorForm(null);
    setGuardando(true);
    try {
      if (editando) {
        await actualizarAccionManual(clientId, editando.accion_id, cuerpoDe(form, editando.evidencia));
        toast.success("Acción actualizada");
      } else {
        await crearAccionManual(clientId, cuerpoDe(form, null));
        toast.success("Acción registrada");
      }
      setAbierto(false);
      await cargar();
      onCambio();
    } catch (e) {
      setErrorForm(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(a: AccionManual) {
    try {
      await eliminarAccionManual(clientId, a.accion_id);
      toast.success("Acción eliminada del registro");
      await cargar();
      onCambio();
    } catch (e) {
      toast.error(`No se pudo eliminar: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const cols: SimpleCol<AccionManual>[] = [
    {
      key: "oportunidad", label: "Acción",
      render: (a) => (
        <>
          {a.oportunidad}
          {a.evidencia && (
            <Paperclip aria-label="Con evidencia adjunta" className="ml-1 inline h-3.5 w-3.5 text-muted-foreground" />
          )}
        </>
      ),
    },
    { key: "categoria", label: "Categoría", render: (a) => a.categoria ?? "—" },
    { key: "recurso", label: "Recurso", render: (a) => a.recurso ?? "—" },
    { key: "mes_ejecucion", label: "Mes", render: (a) => etiquetaMes(a.mes_ejecucion) },
    { key: "mes_fin", label: "Fin", render: (a) => (a.mes_fin ? etiquetaMes(a.mes_fin) : "—") },
    {
      key: "monto_mensual", label: "$/mes", align: "right",
      render: (a) => (a.monto_mensual === null
        ? <span className="text-muted-foreground">sin monto</span>
        : fmtMonto(a.monto_mensual)),
    },
    {
      key: "accion_id", label: "", align: "right",
      render: (a) => (canEdit ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Acciones de ${a.oportunidad}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => abrirEdicion(a)}>Editar</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onSelect={() => void eliminar(a)}>
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null),
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Acciones ejecutadas (registro manual)</CardTitle>
          <CardDescription>
            Lo que se ejecutó y ningún archivo ni barrido ve: entra al titular del informe con su
            monto rotulado “declarado por el consultor”. El registro completo se revisa en la
            pestaña Informe.
          </CardDescription>
        </div>
        {canEdit && (
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={() => setEvidenciaAbierta(true)}>
              <Sparkles className="mr-1 h-4 w-4" aria-hidden />
              Extraer desde evidencia
            </Button>
            <Button size="sm" onClick={abrirAlta}>
              <Plus className="mr-1 h-4 w-4" aria-hidden />
              Agregar acción
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-destructive">No se pudo leer el registro: {error}</p>}
        {cargando ? (
          <p className="text-sm text-muted-foreground">Cargando el registro…</p>
        ) : (
          <SimpleTable
            cols={cols}
            rows={acciones}
            empty="Ninguna acción registrada a mano para este cliente."
          />
        )}
      </CardContent>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? "Editar acción ejecutada" : "Agregar acción ejecutada"}</DialogTitle>
            <DialogDescription>
              La unidad del registro: qué se hizo, desde qué mes y cuánto ahorra por mes (si la
              cifra es defendible).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="acc-oportunidad">Oportunidad</Label>
              <Input
                id="acc-oportunidad"
                value={form.oportunidad}
                placeholder="Apagado de VMs de desarrollo"
                onChange={(e) => setForm({ ...form, oportunidad: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="acc-mes">Mes de ejecución</Label>
                <Input
                  id="acc-mes"
                  value={form.mes_ejecucion}
                  placeholder="2026-07"
                  onChange={(e) => setForm({ ...form, mes_ejecucion: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="acc-fin">Fin (opcional)</Label>
                <Input
                  id="acc-fin"
                  value={form.mes_fin}
                  placeholder="2029-07"
                  onChange={(e) => setForm({ ...form, mes_fin: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="acc-monto">Ahorro mensual (opcional)</Label>
                <Input
                  id="acc-monto"
                  type="number"
                  value={form.monto_mensual}
                  placeholder="450"
                  onChange={(e) => setForm({ ...form, monto_mensual: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="acc-categoria">Categoría (opcional)</Label>
                <Input
                  id="acc-categoria"
                  value={form.categoria}
                  placeholder="VMs (right-size / apagado)"
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="acc-recurso">Recurso (opcional)</Label>
              <Input
                id="acc-recurso"
                value={form.recurso}
                placeholder="vm-dev-01"
                onChange={(e) => setForm({ ...form, recurso: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="acc-nota">Nota (opcional)</Label>
              <Textarea
                id="acc-nota"
                value={form.nota}
                rows={2}
                placeholder="Acordado con el cliente en la reunión del 15 de julio."
                onChange={(e) => setForm({ ...form, nota: e.target.value })}
              />
            </div>
            {errorForm && <p className="text-sm text-destructive" role="alert">{errorForm}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbierto(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={() => void guardar()} disabled={guardando}>
              {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Registrar acción"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExtraerEvidenciaDialog
        clientId={clientId}
        open={evidenciaAbierta}
        onOpenChange={setEvidenciaAbierta}
        onConfirmadas={() => { void cargar(); onCambio(); }}
      />
    </Card>
  );
}
