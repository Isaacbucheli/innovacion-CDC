import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { ClientSummary } from "@/types";

/**
 * Selector de cliente con búsqueda (combobox). Usa cmdk (mismo motor que el command
 * palette del Catálogo) dentro de un popover propio: búsqueda, navegación por teclado,
 * click-outside y Escape para cerrar. Renovado y alineado al estilo del piloto.
 */
export default function ClientCombobox({
  clients,
  value,
  onChange,
}: {
  clients: ClientSummary[];
  value: number | null;
  onChange: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = clients.find((c) => c.client_id === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative w-[260px]" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-secondary/40 focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <span className={`truncate ${selected ? "" : "text-muted-foreground"}`}>
          {selected ? selected.client_name : "Seleccione cliente"}
        </span>
        <ChevronsUpDown className="w-4 h-4 ml-2 shrink-0 opacity-50" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <Command>
            <CommandInput placeholder="Buscar cliente…" />
            <CommandList>
              <CommandEmpty>Sin coincidencias.</CommandEmpty>
              <CommandGroup>
                {clients.map((c) => (
                  <CommandItem
                    key={c.client_id}
                    value={c.client_name}
                    onSelect={() => {
                      onChange(c.client_id);
                      setOpen(false);
                    }}
                  >
                    <Check className={`w-4 h-4 mr-2 ${c.client_id === value ? "opacity-100" : "opacity-0"}`} />
                    <span className="truncate">{c.client_name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}
