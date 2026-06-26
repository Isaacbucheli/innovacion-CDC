import { Bell, BookOpen, FileCode, ListChecks } from "lucide-react";
import type { Alert, KqlQuery } from "@/types";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export type TabKey = "alerts" | "kql" | "leyenda";

export default function CommandPalette({
  open,
  onOpenChange,
  alerts,
  kql,
  onOpenAlert,
  onOpenKql,
  onGoTab,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  alerts: Alert[];
  kql: KqlQuery[];
  onOpenAlert: (a: Alert) => void;
  onOpenKql: (k: KqlQuery) => void;
  onGoTab: (t: TabKey) => void;
}) {
  const run = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar alertas, consultas KQL, o ir a…" />
      <CommandList>
        <CommandEmpty>Sin resultados.</CommandEmpty>

        <CommandGroup heading="Ir a">
          <CommandItem value="ir alertas" onSelect={() => run(() => onGoTab("alerts"))}>
            <Bell className="mr-2 h-4 w-4" />
            Alertas
          </CommandItem>
          <CommandItem value="ir biblioteca kql" onSelect={() => run(() => onGoTab("kql"))}>
            <FileCode className="mr-2 h-4 w-4" />
            Biblioteca KQL
          </CommandItem>
          <CommandItem value="ir leyenda" onSelect={() => run(() => onGoTab("leyenda"))}>
            <BookOpen className="mr-2 h-4 w-4" />
            Leyenda
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Alertas">
          {alerts.map((a) => (
            <CommandItem
              key={"a" + a.alert_id}
              value={`alerta ${a.name} ${a.resource ?? ""} ${a.alert_type ?? ""} ${a.severity ?? ""}`}
              onSelect={() => run(() => onOpenAlert(a))}
            >
              <ListChecks className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="truncate">{a.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Biblioteca KQL">
          {kql.map((k) => (
            <CommandItem
              key={"k" + k.kql_id}
              value={`kql ${k.name} ${k.description ?? ""}`}
              onSelect={() => run(() => onOpenKql(k))}
            >
              <FileCode className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="truncate">{k.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
