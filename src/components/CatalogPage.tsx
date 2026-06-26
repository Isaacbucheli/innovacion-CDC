import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import AppShell from "@/components/AppShell";
import AlertsView from "@/components/alerts/AlertsView";
import AlertDetailSheet from "@/components/alerts/AlertDetailSheet";
import AlertFormDialog from "@/components/alerts/AlertFormDialog";
import KqlView from "@/components/KqlView";
import KqlDetailSheet from "@/components/KqlDetailSheet";
import KqlFormDialog from "@/components/KqlFormDialog";
import ConfirmDelete from "@/components/ConfirmDelete";
import LeyendaView from "@/components/LeyendaView";
import CommandPalette, { type TabKey } from "@/components/CommandPalette";
import { useCatalog } from "@/hooks/useCatalog";
import { canEdit } from "@/lib/auth";
import { deleteAlert, deleteKql } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import type { Alert, KqlQuery } from "@/types";

// El equipo usa Windows: mostrar "Ctrl K" (en Mac, ⌘K). El atajo funciona con
// Ctrl o ⌘ en ambos (ver listener: metaKey || ctrlKey).
const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || "");
const SHORTCUT_LABEL = IS_MAC ? "⌘K" : "Ctrl K";

// undefined = diálogo cerrado, null = crear nuevo, objeto = editar
export default function CatalogPage() {
  const { alerts, kql, loading, error, reload } = useCatalog();
  const editable = canEdit();
  const [tab, setTab] = useState<TabKey>("alerts");
  const [cmdOpen, setCmdOpen] = useState(false);
  const [detail, setDetail] = useState<Alert | null>(null);
  const [kqlDetail, setKqlDetail] = useState<KqlQuery | null>(null);
  const [editAlert, setEditAlert] = useState<Alert | null | undefined>(undefined);
  const [delAlert, setDelAlert] = useState<Alert | null>(null);
  const [editKql, setEditKql] = useState<KqlQuery | null | undefined>(undefined);
  const [delKql, setDelKql] = useState<KqlQuery | null>(null);

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

  const handleDelAlert = useCallback(async () => {
    if (!editable || !delAlert) return;
    try {
      await deleteAlert(delAlert.alert_id);
      setDelAlert(null);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al eliminar la alerta");
    }
  }, [editable, delAlert, reload]);

  const handleDelKql = useCallback(async () => {
    if (!editable || !delKql) return;
    try {
      await deleteKql(delKql.kql_id);
      setDelKql(null);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al eliminar la consulta KQL");
    }
  }, [editable, delKql, reload]);

  return (
    <AppShell
      title="Catálogo de alertas"
      active="alerts"
      headerRight={
        <Button variant="outline" size="sm" className="text-muted-foreground" onClick={() => setCmdOpen(true)}>
          <Search className="w-4 h-4 mr-2" />
          Buscar
          <kbd className="ml-2 text-[11px] font-medium border rounded px-1.5 py-0.5 bg-secondary">{SHORTCUT_LABEL}</kbd>
        </Button>
      }
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
          <TabsTrigger value="kql">Biblioteca KQL</TabsTrigger>
          <TabsTrigger value="leyenda">Leyenda</TabsTrigger>
        </TabsList>
        <TabsContent value="alerts">
          {loading ? <Skeleton className="h-40 w-full mt-4" />
            : error ? <p className="text-destructive py-6">{error}</p>
            : <AlertsView alerts={alerts} kqlCount={kql.length} canEdit={editable}
                onOpen={(a) => setDetail(a)}
                onNew={() => { if (editable) setEditAlert(null); }}
                onEdit={(a) => { if (editable) setEditAlert(a); }}
                onDelete={(a) => { if (editable) setDelAlert(a); }} />}
        </TabsContent>
        <TabsContent value="kql">
          {loading ? <Skeleton className="h-40 w-full mt-4" />
            : error ? <p className="text-destructive py-6">{error}</p>
            : <KqlView kql={kql} canEdit={editable}
                onOpen={(k) => setKqlDetail(k)}
                onNew={() => { if (editable) setEditKql(null); }}
                onEdit={(k) => { if (editable) setEditKql(k); }}
                onDelete={(k) => { if (editable) setDelKql(k); }} />}
        </TabsContent>
        <TabsContent value="leyenda"><LeyendaView /></TabsContent>
      </Tabs>

      <AlertDetailSheet alert={detail} open={!!detail} onOpenChange={(o) => !o && setDetail(null)} />
      <KqlDetailSheet kql={kqlDetail} open={!!kqlDetail} onOpenChange={(o) => !o && setKqlDetail(null)} />

      <AlertFormDialog
        open={editAlert !== undefined}
        alert={editAlert ?? null}
        onOpenChange={(o) => !o && setEditAlert(undefined)}
        onSaved={reload} />

      <KqlFormDialog
        open={editKql !== undefined}
        item={editKql ?? null}
        onOpenChange={(o) => !o && setEditKql(undefined)}
        onSaved={reload} />

      <ConfirmDelete
        open={!!delAlert}
        label={delAlert?.name ?? ""}
        onOpenChange={(o) => !o && setDelAlert(null)}
        onConfirm={handleDelAlert} />

      <ConfirmDelete
        open={!!delKql}
        label={delKql?.name ?? ""}
        onOpenChange={(o) => !o && setDelKql(null)}
        onConfirm={handleDelKql} />

      <CommandPalette
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        alerts={alerts}
        kql={kql}
        onOpenAlert={(a) => setDetail(a)}
        onOpenKql={(k) => setKqlDetail(k)}
        onGoTab={setTab} />
    </AppShell>
  );
}
