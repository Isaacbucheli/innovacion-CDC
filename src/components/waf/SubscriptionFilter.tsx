import { useMemo, useState } from "react";
import { Check, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import SearchInput from "@/components/SearchInput";
import type { WafSubscriptionOption } from "@/types";

/** Casilla siempre visible (marcada o no), para que se lea de una que la selección es múltiple. */
function Box({ checked }: { checked: boolean }) {
  return (
    <span aria-hidden
      className={`shrink-0 w-4 h-4 rounded-[4px] border flex items-center justify-center ${
        checked ? "bg-primary border-primary text-primary-foreground" : "border-input"}`}>
      {checked && <Check className="w-3 h-3" />}
    </span>
  );
}

/**
 * Filtro por suscripción de la matriz WAF (equivalente al del portal de Advisor). Las opciones
 * salen de los hallazgos, así que también aparecen las suscripciones de la matriz histórica.
 * No se renderiza con una sola suscripción: ahí el filtro no aporta nada.
 */
export default function SubscriptionFilter({ options, selected, onChange, disabled = false }: {
  options: WafSubscriptionOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.subscription_name.toLowerCase().includes(q));
  }, [options, query]);

  if (options.length < 2) return null;

  const label = selected.length === 0
    ? `Suscripciones (${options.length})`
    : `Suscripciones (${selected.length}/${options.length})`;

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={selected.length > 0 ? "default" : "outline"} size="sm" disabled={disabled}
          aria-label="Filtrar por suscripción">
          <Layers className="w-4 h-4 mr-1" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[320px] max-h-[420px] overflow-y-auto">
        <DropdownMenuLabel className="pb-0">Suscripciones</DropdownMenuLabel>
        <p className="px-2 pb-1.5 text-xs font-normal text-muted-foreground">Marque una o varias.</p>
        {options.length > 6 && (
          <div className="px-2 pb-1.5">
            <SearchInput placeholder="Buscar suscripción…" value={query} onChange={setQuery}
              inputClassName="h-8" aria-label="Buscar suscripción" />
          </div>
        )}
        {/* "Todas" es el estado sin filtro: se muestra marcada cuando no hay selección. */}
        <DropdownMenuItem
          className="pl-2 gap-2"
          onSelect={(e) => { e.preventDefault(); onChange([]); }}
        >
          <Box checked={selected.length === 0} />
          <span className="flex-1">Todas</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {visible.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">Sin coincidencias.</p>
        ) : visible.map((o) => {
          const checked = selected.includes(o.subscription_id);
          return (
            <DropdownMenuCheckboxItem
              key={o.subscription_id}
              className="pl-2 gap-2"
              checked={checked}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => toggle(o.subscription_id)}
            >
              {/* Casilla propia: la de shadcn solo aparece al marcar, y así no se ve que es múltiple. */}
              <Box checked={checked} />
              <span className="flex-1 truncate">{o.subscription_name}</span>
              <span className="ml-2 shrink-0 text-xs text-muted-foreground tabular-nums">{o.recommendations}</span>
            </DropdownMenuCheckboxItem>
          );
        })}
        <DropdownMenuSeparator />
        {/* El seguimiento es por recomendación, no por suscripción: conviene decirlo donde se filtra. */}
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          El avance es por recomendación y no cambia con el filtro.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
