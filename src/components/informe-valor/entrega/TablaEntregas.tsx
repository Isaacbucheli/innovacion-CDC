import { Download } from "lucide-react";
import DataTablePagination from "@/components/DataTablePagination";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePagedRows } from "@/hooks/usePagedRows";
import { fmtDateOnly, fmtDateTime } from "@/lib/dates";
import { bloquesPublicadosTexto, etiquetaMes } from "@/lib/informeValor";
import type { InformeValorEntrega } from "@/types";

const COLS = 7;

/** "2026-01-01" -> "ene 2026": la fila guarda el primer día del mes, el período es de meses. */
function periodo(e: InformeValorEntrega): string {
  return `${etiquetaMes(e.period_start.slice(0, 7))} a ${etiquetaMes(e.period_end.slice(0, 7))}`;
}

function tamano(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(0)} kB`;
}

/**
 * El archivo de entregas: qué se le mandó al cliente, cuándo y con qué publicado.
 *
 * Reemitir el mismo período es legítimo y por eso no hay unicidad: dos filas con el mismo período son
 * dos emisiones, y se distinguen por fecha, autor y bloques. De ahí que el período y el corte estén
 * en la tabla y no solo la fecha de generación.
 *
 * La columna de bloques nunca queda vacía. Una entrega sin ningún bloque aprobado dice
 * "Ninguno: sin montos", que es una entrega válida; una celda en blanco se leería como "no se sabe",
 * y un "0" como si el informe hubiera publicado ceros.
 */
export default function TablaEntregas({ entregas, cargando, error, onDescargar }: {
  entregas: InformeValorEntrega[];
  cargando: boolean;
  /** Falla de lectura. Manda sobre la lista: una lista vacía por error no es "sin entregas". */
  error: string | null;
  onDescargar: (e: InformeValorEntrega) => void;
}) {
  const { table, pageRows } = usePagedRows(entregas);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
        No se pudo leer el historial de entregas: {error}. La lista de abajo no se muestra porque
        estaría vacía por la falla, no porque este cliente no tenga entregas.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Generado</TableHead>
              <TableHead>Autor</TableHead>
              <TableHead>Variante</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Corte</TableHead>
              <TableHead>Bloques publicados</TableHead>
              <TableHead className="text-right">Descarga</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLS} className="py-8 text-center text-muted-foreground">
                  {cargando
                    ? "Cargando el historial…"
                    : "Este cliente todavía no tiene ninguna entrega generada."}
                </TableCell>
              </TableRow>
            ) : pageRows.map((e) => {
              const bloques = bloquesPublicadosTexto(e.bloques_publicados);
              return (
                <TableRow key={e.entrega_id}>
                  <TableCell className="text-xs">{fmtDateTime(e.generated_at)}</TableCell>
                  <TableCell className="text-xs">
                    {e.generated_by ?? (
                      <span className="text-muted-foreground" title="La entrega quedó archivada sin autor.">
                        Sin autor registrado
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{e.variante}</TableCell>
                  <TableCell className="text-xs">{periodo(e)}</TableCell>
                  <TableCell className="text-xs">{fmtDateOnly(e.corte)}</TableCell>
                  <TableCell className="text-xs">
                    <span title={bloques.etiquetas.concat(
                      bloques.desconocidas.map((d) => `${d} (bloque que esta versión no conoce)`),
                    ).join(" · ")}>
                      {bloques.texto}
                    </span>
                    {bloques.desconocidas.length > 0 && (
                      <span className="ml-1 text-amber-700 dark:text-amber-400">
                        (incluye {bloques.desconocidas.length} bloque(s) desconocido(s))
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" className="h-7" onClick={() => onDescargar(e)}
                      title={`${e.file_name} · ${tamano(e.blob_size_bytes)}`}>
                      <Download className="mr-1 h-3.5 w-3.5" />
                      Descargar
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
