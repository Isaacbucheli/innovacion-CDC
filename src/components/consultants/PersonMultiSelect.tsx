import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import type { Person } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Multi-select de personas para el formulario de asignación (principales/backups).
 * Mismo patrón que SubscriptionFilter (costs): popover propio con buscador y
 * checkboxes; los seleccionados se muestran como chips removibles bajo el botón.
 */
export default function PersonMultiSelect({
  label,
  people,
  selected,
  onChange,
}: {
  label: string;
  people: Person[];
  selected: number[];
  onChange: (ids: number[]) => void;
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

  const set = new Set(selected);
  const chosen = people.filter((p) => set.has(p.person_id));
  const filtered = people.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));

  const toggle = (id: number) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  return (
    <div className="relative" ref={ref}>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between font-normal"
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={chosen.length ? "" : "text-muted-foreground"}>
          {chosen.length ? `${chosen.length} seleccionado(s)` : label}
        </span>
        <ChevronDown className="w-4 h-4 ml-1 shrink-0" />
      </Button>
      {chosen.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {chosen.map((p) => (
            <Badge key={p.person_id} variant="outline" className="font-normal gap-1">
              {p.name}
              <button
                type="button"
                aria-label={`Quitar ${p.name}`}
                className="rounded-sm text-muted-foreground hover:text-foreground"
                onClick={() => toggle(p.person_id)}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 rounded-md border bg-popover p-2 shadow-md">
          <Input
            className="h-8 mb-2"
            placeholder="Filtrar personas…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="max-h-56 overflow-y-auto">
            {filtered.map((p) => (
              <label
                key={p.person_id}
                className="flex items-center gap-2 px-1 py-1 text-sm cursor-pointer hover:bg-secondary rounded"
              >
                <input type="checkbox" checked={set.has(p.person_id)} onChange={() => toggle(p.person_id)} className="accent-primary h-4 w-4" />
                <span className="truncate">{p.name}</span>
              </label>
            ))}
            {filtered.length === 0 && <p className="text-xs text-muted-foreground px-1 py-2">Sin coincidencias.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
