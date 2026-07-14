import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import AppShell from "@/components/AppShell";
import PoliciesView from "@/components/policies/PoliciesView";
import PolicyDetailSheet from "@/components/policies/PolicyDetailSheet";
import PolicyFormDialog from "@/components/policies/PolicyFormDialog";
import ConfirmDelete from "@/components/ConfirmDelete";
import LeyendaPoliciesView from "@/components/policies/LeyendaPoliciesView";
import PolicyCommandPalette, { type PolicyTabKey } from "@/components/policies/PolicyCommandPalette";
import { usePolicyCatalog } from "@/hooks/usePolicyCatalog";
import { canEditModule } from "@/lib/auth";
import { deletePolicy } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import type { Policy } from "@/types";

// El equipo usa Windows: mostrar "Ctrl K" (en Mac, ⌘K). El atajo funciona con
// Ctrl o ⌘ en ambos (ver listener: metaKey || ctrlKey).
const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || "");
const SHORTCUT_LABEL = IS_MAC ? "⌘K" : "Ctrl K";

// undefined = diálogo cerrado, null = crear nueva, objeto = editar
export default function PolicyCatalogPage({ onNavigate }: { onNavigate?: (s: string) => void }) {
  const { policies, loading, error, reload } = usePolicyCatalog();
  const editable = canEditModule("policies");
  const [tab, setTab] = useState<PolicyTabKey>("policies");
  const [cmdOpen, setCmdOpen] = useState(false);
  const [detail, setDetail] = useState<Policy | null>(null);
  const [editPolicy, setEditPolicy] = useState<Policy | null | undefined>(undefined);
  const [delPolicy, setDelPolicy] = useState<Policy | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const handleDelPolicy = useCallback(async () => {
    if (!editable || !delPolicy) return;
    try {
      await deletePolicy(delPolicy.policy_id);
      setDelPolicy(null);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al eliminar la política");
    }
  }, [editable, delPolicy, reload]);

  return (
    <AppShell
      title="Catálogo de políticas"
      subtitle="Línea base de Azure Policy para gobierno, seguridad y FinOps. Centralizada para el equipo."
      active="policies"
      onNavigate={onNavigate}
      headerRight={
        <Button variant="outline" size="sm" className="text-muted-foreground" onClick={() => setCmdOpen(true)}>
          <Search className="w-4 h-4 mr-2" />
          Buscar
          <kbd className="ml-2 text-[11px] font-medium border rounded px-1.5 py-0.5 bg-secondary">{SHORTCUT_LABEL}</kbd>
        </Button>
      }
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as PolicyTabKey)}>
        <TabsList>
          <TabsTrigger value="policies">Políticas</TabsTrigger>
          <TabsTrigger value="leyenda">Leyenda</TabsTrigger>
        </TabsList>
        <TabsContent value="policies">
          {loading ? <Skeleton className="h-40 w-full mt-4" />
            : error ? <p className="text-destructive py-6">{error}</p>
            : <PoliciesView policies={policies} canEdit={editable}
                onOpen={(p) => setDetail(p)}
                onNew={() => { if (editable) setEditPolicy(null); }}
                onEdit={(p) => { if (editable) setEditPolicy(p); }}
                onDelete={(p) => { if (editable) setDelPolicy(p); }} />}
        </TabsContent>
        <TabsContent value="leyenda"><LeyendaPoliciesView /></TabsContent>
      </Tabs>

      <PolicyDetailSheet policy={detail} open={!!detail} onOpenChange={(o) => !o && setDetail(null)} />

      <PolicyFormDialog
        open={editPolicy !== undefined}
        policy={editPolicy ?? null}
        onOpenChange={(o) => !o && setEditPolicy(undefined)}
        onSaved={reload} />

      <ConfirmDelete
        open={!!delPolicy}
        label={delPolicy?.name ?? ""}
        onOpenChange={(o) => !o && setDelPolicy(null)}
        onConfirm={handleDelPolicy} />

      <PolicyCommandPalette
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        policies={policies}
        onOpenPolicy={(p) => setDetail(p)}
        onGoTab={setTab} />
    </AppShell>
  );
}
