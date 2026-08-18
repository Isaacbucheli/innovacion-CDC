import { useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { etiquetaMes, hoyQuito, MESES_CORTOS } from "@/lib/informeValor";

/**
 * Elegir un mes calendario ("aaaa-MM") sin el control nativo del navegador.
 *
 * `<input type="month">` en Chrome con locale español escribe "septiembre de 2025" y pone el botón
 * del calendario al final del campo: en los 150 px de la fila del informe el año quedaba cortado y
 * el botón caía fuera de la caja, así que el campo se veía pero no había forma de abrirlo. Acá el
 * mes sale de una grilla propia, que además habla el mismo idioma que el resto del informe
 * ("sep 2025", igual que `etiquetaMes`).
 *
 * El año del panel se sincroniza con el valor cada vez que se abre: si el consultor navegó a 2023
 * y cerró sin elegir, la próxima apertura vuelve a mostrar el año del mes que sí está elegido.
 */
export default function MesPicker({ value, onChange, etiqueta, className, disabled }: {
  /** Mes elegido, "aaaa-MM". Vacío = todavía no hay ninguno. */
  value: string;
  onChange: (mes: string) => void;
  /** Nombre accesible del campo (el `<label>` visible queda afuera del control). */
  etiqueta: string;
  className?: string;
  disabled?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const anioDelValor = /^\d{4}-\d{2}$/.test(value)
    ? Number(value.slice(0, 4))
    : Number(hoyQuito().slice(0, 4));
  const [anio, setAnio] = useState(anioDelValor);

  useEffect(() => { if (abierto) setAnio(anioDelValor); }, [abierto, anioDelValor]);

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={etiqueta}
          disabled={disabled}
          className={cn(
            "flex h-9 items-center justify-between rounded-md border border-input bg-background px-3",
            "text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring",
            "focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span className={cn(!value && "text-muted-foreground")}>
            {value ? etiquetaMes(value) : "Elegir mes"}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-56 p-2">
        <div className="flex items-center justify-between pb-2">
          <button
            type="button"
            aria-label="Año anterior"
            onClick={() => setAnio((a) => a - 1)}
            className="rounded-md p-1 hover:bg-accent hover:text-accent-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium tabular-nums">{anio}</span>
          <button
            type="button"
            aria-label="Año siguiente"
            onClick={() => setAnio((a) => a + 1)}
            className="rounded-md p-1 hover:bg-accent hover:text-accent-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1">
          {MESES_CORTOS.map((m, i) => {
            const mes = `${anio}-${String(i + 1).padStart(2, "0")}`;
            const elegido = mes === value;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={elegido}
                onClick={() => { onChange(mes); setAbierto(false); }}
                className={cn(
                  "rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground",
                  elegido && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                )}
              >
                {m}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
