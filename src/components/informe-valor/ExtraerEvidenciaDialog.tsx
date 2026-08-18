import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { crearAccionManual, extraerAccionesEvidencia } from "@/lib/api";
import type { AccionCandidata } from "@/types";

/** Una candidata en edición: lo que la IA propuso más la decisión del consultor. */
interface CandidataEditable extends AccionCandidata {
  incluir: boolean;
}

/**
 * La captura asistida del registro manual (entrega 8, pieza B): el consultor pega la evidencia
 * (correo, chat de Teams, minuta), la IA propone las acciones ejecutadas que encuentra —con su
 * cita textual y sin inventar montos ni fechas— y solo las que el consultor revisa y confirma se
 * registran, una por una, por el mismo alta del CRUD. La evidencia pegada queda guardada en cada
 * fila confirmada como respaldo (interno: jamás sale al informe).
 */
export default function ExtraerEvidenciaDialog({
  clientId, open, onOpenChange, onConfirmadas,
}: {
  clientId: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirmadas: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [analizando, setAnalizando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [candidatas, setCandidatas] = useState<CandidataEditable[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function cerrar(v: boolean) {
    if (!v) {
      setTexto("");
      setCandidatas(null);
      setError(null);
    }
    onOpenChange(v);
  }

  async function analizar() {
    if (!texto.trim()) {
      setError("Pega la evidencia (correo, chat o minuta) antes de analizar.");
      return;
    }
    setError(null);
    setAnalizando(true);
    try {
      const acciones = await extraerAccionesEvidencia(clientId, texto.trim());
      setCandidatas(acciones.map((a) => ({ ...a, incluir: true })));
      if (acciones.length === 0) {
        setError("La evidencia no menciona acciones ya ejecutadas. Puedes registrarla a mano con \"Agregar acción\".");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalizando(false);
    }
  }

  function editar(i: number, cambio: Partial<CandidataEditable>) {
    setCandidatas((prev) => prev?.map((c, j) => (j === i ? { ...c, ...cambio } : c)) ?? null);
  }

  async function confirmar() {
    const seleccionadas = (candidatas ?? []).filter((c) => c.incluir);
    if (seleccionadas.length === 0) return;
    const sinMes = seleccionadas.filter((c) => !/^\d{4}-(0[1-9]|1[0-2])$/.test(c.mes ?? ""));
    if (sinMes.length > 0) {
      setError(`Completa el mes (aaaa-MM) de: ${sinMes.map((c) => c.oportunidad).join(", ")}.`);
      return;
    }
    setError(null);
    setConfirmando(true);
    let creadas = 0;
    const fallidas: string[] = [];
    for (const c of seleccionadas) {
      try {
        await crearAccionManual(clientId, {
          oportunidad: c.oportunidad,
          categoria: null,
          mes_ejecucion: c.mes!,
          mes_fin: null,
          monto_mensual: c.monto,
          recurso: c.recurso,
          nota: c.cita ? `Cita: "${c.cita}"` : null,
          evidencia: texto.trim(),
        });
        creadas += 1;
      } catch (e) {
        fallidas.push(`${c.oportunidad}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setConfirmando(false);
    if (creadas > 0) toast.success(`${creadas} acción(es) registradas con su evidencia.`);
    if (fallidas.length > 0) {
      setError(`No se pudieron registrar: ${fallidas.join(" · ")}`);
    } else {
      cerrar(false);
    }
    if (creadas > 0) onConfirmadas();
  }

  const seleccionadas = (candidatas ?? []).filter((c) => c.incluir).length;

  return (
    <Dialog open={open} onOpenChange={cerrar}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Extraer desde evidencia</DialogTitle>
          <DialogDescription>
            Pega el correo, chat o minuta donde consta lo ejecutado. La IA propone las acciones con
            su cita textual —sin inventar montos ni fechas— y solo se registra lo que confirmes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={"De: cliente@…\n\"…confirmamos que el 15 de julio se apagaron las 3 VMs del ambiente de desarrollo…\""}
            rows={6}
            disabled={analizando || confirmando}
          />
          <div className="flex justify-end">
            <Button onClick={() => void analizar()} disabled={analizando || confirmando}>
              {analizando ? "Analizando…" : "Analizar evidencia"}
            </Button>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">{error}</p>
          )}

          {candidatas && candidatas.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {candidatas.length} acción(es) propuestas — revisa, corrige y confirma
              </p>
              {candidatas.map((c, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                  <input
                    type="checkbox"
                    className="mt-1.5"
                    checked={c.incluir}
                    onChange={(e) => editar(i, { incluir: e.target.checked })}
                    aria-label={`Incluir ${c.oportunidad}`}
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Input
                      value={c.oportunidad}
                      onChange={(e) => editar(i, { oportunidad: e.target.value })}
                      aria-label="Oportunidad"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Input
                        className="w-32"
                        value={c.mes ?? ""}
                        placeholder="aaaa-MM"
                        onChange={(e) => editar(i, { mes: e.target.value || null })}
                        aria-label="Mes de ejecución"
                      />
                      <Input
                        className="w-36"
                        type="number"
                        value={c.monto ?? ""}
                        placeholder="$/mes (opcional)"
                        onChange={(e) => editar(i, { monto: e.target.value === "" ? null : Number(e.target.value) })}
                        aria-label="Ahorro mensual"
                      />
                      <Input
                        className="min-w-40 flex-1"
                        value={c.recurso ?? ""}
                        placeholder="Recurso (opcional)"
                        onChange={(e) => editar(i, { recurso: e.target.value || null })}
                        aria-label="Recurso"
                      />
                    </div>
                    {c.cita && (
                      <p className="text-xs text-muted-foreground">
                        “{c.cita}”{c.monto === null && " — la evidencia no menciona cifra: el monto queda vacío salvo que lo declares tú"}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => cerrar(false)} disabled={confirmando}>
            Descartar
          </Button>
          <Button
            onClick={() => void confirmar()}
            disabled={confirmando || seleccionadas === 0}
          >
            {confirmando ? "Registrando…" : `Confirmar ${seleccionadas} acción(es)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
