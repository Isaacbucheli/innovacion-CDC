import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Filtro multi-suscripción (null = todas). Popover propio con buscador, "Seleccionar
 * todo" (con estado indeterminado) y checkboxes. Emite null cuando están todas.
 */
export default function SubscriptionFilter({
  names,
  selected,
  onChange,
}: {
  names: string[];
  selected: string[] | null;
  onChange: (s: string[] | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

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

  const set = new Set(selected === null ? names : selected);
  const count = set.size;
  const allChecked = count === names.length;
  const filtered = names.filter((n) => n.toLowerCase().includes(q.trim().toLowerCase()));

  const emit = (next: Set<string>) => onChange(next.size === names.length ? null : [...next]);
  const toggle = (name: string) => {
    const next = new Set(set);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    emit(next);
  };
  const toggleAll = () => (allChecked ? onChange([]) : onChange(null));

  return (
    <div className="relative" ref={ref}>
      <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
        Suscripciones ({count}/{names.length})
        <ChevronDown className="w-4 h-4 ml-1" />
      </Button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-64 rounded-md border bg-popover p-2 shadow-md">
          <Input
            className="h-8 mb-2"
            placeholder="Filtrar suscripciones…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <label className="flex items-center gap-2 px-1 py-1 text-sm font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={allChecked}
              ref={(el) => {
                if (el) el.indeterminate = count > 0 && count < names.length;
              }}
              onChange={toggleAll}
            />
            Seleccionar todo
          </label>
          <div className="max-h-56 overflow-y-auto mt-1">
            {filtered.map((name) => (
              <label
                key={name}
                className="flex items-center gap-2 px-1 py-1 text-sm cursor-pointer hover:bg-secondary rounded"
              >
                <input type="checkbox" checked={set.has(name)} onChange={() => toggle(name)} />
                <span className="truncate">{name}</span>
              </label>
            ))}
            {filtered.length === 0 && <p className="text-xs text-muted-foreground px-1 py-2">Sin coincidencias.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
