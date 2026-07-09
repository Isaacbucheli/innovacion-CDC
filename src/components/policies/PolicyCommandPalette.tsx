import { BookOpen, ShieldCheck } from "lucide-react";
import type { Policy } from "@/types";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export type PolicyTabKey = "policies" | "leyenda";

export default function PolicyCommandPalette({
  open,
  onOpenChange,
  policies,
  onOpenPolicy,
  onGoTab,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  policies: Policy[];
  onOpenPolicy: (p: Policy) => void;
  onGoTab: (t: PolicyTabKey) => void;
}) {
  const run = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar políticas o ir a…" />
      <CommandList>
        <CommandEmpty>Sin resultados.</CommandEmpty>

        <CommandGroup heading="Ir a">
          <CommandItem value="ir politicas" onSelect={() => run(() => onGoTab("policies"))}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            Políticas
          </CommandItem>
          <CommandItem value="ir leyenda" onSelect={() => run(() => onGoTab("leyenda"))}>
            <BookOpen className="mr-2 h-4 w-4" />
            Leyenda
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Políticas">
          {policies.map((p) => (
            <CommandItem
              key={"p" + p.policy_id}
              value={`politica ${p.name} ${p.category ?? ""} ${p.recommended_effect ?? ""}`}
              onSelect={() => run(() => onOpenPolicy(p))}
            >
              <ShieldCheck className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="truncate">{p.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
