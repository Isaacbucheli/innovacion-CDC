import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Buscador reusable: icono de lupa a la izquierda + botón ✕ para limpiar de un
 * clic cuando hay texto (antes había que borrar letra por letra en toda la app).
 * `className` dimensiona el contenedor (ancho/alto); `inputClassName` es para
 * estilos extra del input en sí.
 */
export default function SearchInput({
  value,
  onChange,
  placeholder,
  className,
  inputClassName,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  "aria-label"?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn("pl-9", value && "pr-9", inputClassName)}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpiar búsqueda"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
