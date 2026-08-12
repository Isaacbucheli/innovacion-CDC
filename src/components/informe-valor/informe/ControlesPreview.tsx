import { CalendarRange, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { etiquetaMes, mesesDelRango, type ParametrosInforme } from "@/lib/informeValor";

/**
 * Lo que hay que elegir antes de calcular: el período, la fecha de corte y qué meses son parciales.
 *
 * Los meses parciales son un tri-estado del contrato con la API, y acá se ofrecen los tres:
 * automático (la heurística del backend decide), o manual con una lista -- que puede quedar vacía,
 * y eso significa "declaro que ningún mes es parcial", no "no elegí". El último mes de un export de
 * facturación casi siempre está incompleto, y contarlo como mes normal hace que el informe reporte
 * una caída del gasto que no existe.
 *
 * La fecha de corte no es cosmética: contra ella se clasifican los retiros de Azure (vencido, menos
 * de tres meses, menos de un año). Queda congelada en el cálculo, así que el mismo informe dice lo
 * mismo dentro de seis meses.
 */
export default function ControlesPreview({ params, onChange, onGenerar, cargando }: {
  params: ParametrosInforme;
  onChange: (p: ParametrosInforme) => void;
  onGenerar: () => void;
  cargando: boolean;
}) {
  const meses = mesesDelRango(params.desde, params.hasta);
  const rangoInvalido = !params.desde || !params.hasta || params.hasta < params.desde;
  const set = (cambio: Partial<ParametrosInforme>) => onChange({ ...params, ...cambio });

  function alternarMes(mes: string, marcado: boolean) {
    const sinEl = params.parciales.filter((m) => m !== mes);
    set({ parciales: marcado ? [...sinEl, mes].sort() : sinEl });
  }

  const etiquetaParciales = params.parcialesAuto
    ? "Automático"
    : params.parciales.length === 0
      ? "Ninguno es parcial"
      : `${params.parciales.length} declarado(s)`;

  return (
    <div className="space-y-2 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted-foreground">
          Desde
          <Input type="month" className="mt-1 h-9 w-[150px]" value={params.desde}
            aria-label="Primer mes del período" onChange={(e) => set({ desde: e.target.value })} />
        </label>
        <label className="text-xs text-muted-foreground">
          Hasta
          <Input type="month" className="mt-1 h-9 w-[150px]" value={params.hasta}
            aria-label="Último mes del período" onChange={(e) => set({ hasta: e.target.value })} />
        </label>
        <label className="text-xs text-muted-foreground">
          Fecha de corte
          <Input type="date" className="mt-1 h-9 w-[160px]" value={params.corte}
            aria-label="Fecha de corte" onChange={(e) => set({ corte: e.target.value })} />
        </label>

        <div className="text-xs text-muted-foreground">
          Meses parciales
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="mt-1 h-9 w-[200px] justify-start font-normal">
                <CalendarRange className="mr-1 h-4 w-4" />{etiquetaParciales}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
              <DropdownMenuLabel>Cómo se deciden</DropdownMenuLabel>
              <DropdownMenuCheckboxItem checked={params.parcialesAuto}
                onCheckedChange={() => set({ parcialesAuto: true })}>
                Automático (lo decide la heurística)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={!params.parcialesAuto}
                onCheckedChange={() => set({ parcialesAuto: false })}>
                Los declaro yo
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>
                {params.parcialesAuto ? "Meses del período (declaración desactivada)" : "Marca los meses incompletos"}
              </DropdownMenuLabel>
              {meses.map((m) => (
                <DropdownMenuCheckboxItem
                  key={m}
                  disabled={params.parcialesAuto}
                  checked={params.parciales.includes(m)}
                  onCheckedChange={(v) => alternarMes(m, !!v)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {etiquetaMes(m)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Button onClick={onGenerar} disabled={cargando || rangoInvalido} className="h-9">
          {cargando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />}
          {cargando ? "Calculando…" : "Ver el informe"}
        </Button>
      </div>

      {rangoInvalido && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          El rango está invertido: el mes final es anterior al inicial.
        </p>
      )}
      {!params.parcialesAuto && params.parciales.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Estás declarando que <strong>ningún</strong> mes del período está incompleto. Es una
          declaración, no una omisión: la heurística no va a corregirla.
        </p>
      )}
    </div>
  );
}
