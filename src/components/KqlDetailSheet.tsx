import type { KqlQuery } from "@/types";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import CodeBlock from "@/components/CodeBlock";

export default function KqlDetailSheet({
  kql,
  open,
  onOpenChange,
}: {
  kql: KqlQuery | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{kql?.name}</SheetTitle>
        </SheetHeader>
        {kql && (
          <div className="space-y-3 mt-4">
            {kql.description && <p className="text-sm text-muted-foreground">{kql.description}</p>}
            {kql.kql_query && <CodeBlock code={kql.kql_query} />}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
