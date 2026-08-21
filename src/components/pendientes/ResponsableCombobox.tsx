import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Plus, UserX } from "lucide-react";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { claveNombre, nombreLimpio } from "@/lib/pendientes";

// El disparador se ve igual que los <select> del formulario (misma altura y borde).
const triggerClass =
  "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-2 text-sm hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70 disabled:pointer-events-none";

/** Tope de la columna Responsable en la BD del tablero: nvarchar(300). */
const MAX = 300;

/**
 * Selector de responsable con búsqueda. Mismo motor que el selector de cliente de costos (cmdk en un
 * popover propio, no Radix Popover: así vive dentro del diálogo sin pelear con su foco).
 *
 * La columna es texto libre y en el tablero siempre aparece alguien nuevo, así que además de la lista
 * se puede escribir un nombre y guardarlo tal cual ("Usar ...").
 */
export default function ResponsableCombobox({
  id, value, options, disabled, onChange,
}: {
  id?: string;
  value: string;
  options: string[];
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const seleccionado = nombreLimpio(value);
  const escrito = nombreLimpio(q);
  // Si lo escrito ya está en la lista no se ofrece aparte: saldría el mismo nombre dos veces.
  const esNuevo = escrito.length > 0 && !options.some((o) => claveNombre(o) === claveNombre(escrito));

  // Cerrar siempre limpia lo tecleado: si no, la búsqueda anterior seguía ahí al reabrir y el
  // siguiente nombre se escribía pegado al viejo.
  const cerrar = () => { setOpen(false); setQ(""); };

  // Si se deshabilita con el popover abierto, cerrarlo: su contenido seguiría montado y permitiría
  // re-disparar la selección (mismo cuidado que en el selector de cliente de costos).
  useEffect(() => { if (disabled) cerrar(); }, [disabled]);

  useEffect(() => {
    if (!open) return;
    // Enfocar el buscador al abrir: un clic y ya se puede escribir.
    const focusId = requestAnimationFrame(() => inputRef.current?.focus());
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cerrar();
    };
    // Escape se atrapa en `window` y en fase de captura: Radix escucha en `document` (también en
    // captura) y cerraría todo el diálogo, perdiendo lo que ya se escribió en el formulario.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      cerrar();
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey, true);
    return () => {
      cancelAnimationFrame(focusId);
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  function elegir(v: string) {
    onChange(nombreLimpio(v).slice(0, MAX));
    cerrar();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        id={id}
        onClick={() => (open ? cerrar() : setOpen(true))}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={triggerClass}
      >
        <span className={`truncate ${seleccionado ? "" : "text-muted-foreground"}`}>
          {seleccionado || "Sin asignar"}
        </span>
        <ChevronsUpDown className="w-4 h-4 ml-2 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <Command>
            <CommandInput
              ref={inputRef}
              autoFocus
              value={q}
              onValueChange={setQ}
              maxLength={MAX}
              placeholder="Buscar o escribir un nombre…"
            />
            <CommandList className="max-h-56">
              {!esNuevo && <CommandEmpty>Sin coincidencias.</CommandEmpty>}

              <CommandGroup>
                {options.map((o) => (
                  <CommandItem key={o} value={o} onSelect={() => elegir(o)}>
                    <Check className={`w-4 h-4 mr-2 ${claveNombre(o) === claveNombre(seleccionado) ? "opacity-100" : "opacity-0"}`} />
                    <span className="truncate">{o}</span>
                  </CommandItem>
                ))}
              </CommandGroup>

              {esNuevo && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    {/* `forceMount`: cmdk compara contra el valor recortado y escondería esta opción
                        justo cuando hace falta. Va al final para que Enter siga eligiendo un nombre
                        de la lista y no cree uno nuevo sin querer. */}
                    <CommandItem forceMount value={escrito} onSelect={() => elegir(escrito)}>
                      <Plus className="w-4 h-4 mr-2" />
                      <span className="truncate">Usar “{escrito}”</span>
                    </CommandItem>
                  </CommandGroup>
                </>
              )}

              {seleccionado && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem value="Sin asignar" onSelect={() => elegir("")}>
                      <UserX className="w-4 h-4 mr-2" />
                      Sin asignar
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}
