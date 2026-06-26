import { useCallback, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AppShell from "@/components/AppShell";
import AlertsView from "@/components/alerts/AlertsView";
import AlertDetailSheet from "@/components/alerts/AlertDetailSheet";
import AlertFormDialog from "@/components/alerts/AlertFormDialog";
import KqlView from "@/components/KqlView";
import KqlFormDialog from "@/components/KqlFormDialog";
import ConfirmDelete from "@/components/ConfirmDelete";
import LeyendaView from "@/components/LeyendaView";
import { useCatalog } from "@/hooks/useCatalog";
import { canEdit } from "@/lib/auth";
import { deleteAlert, deleteKql } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import type { Alert, KqlQuery } from "@/types";

// undefined = diálogo cerrado, null = crear nuevo, objeto = editar
export default function CatalogPage() {
  const { alerts, kql, loading, error, reload } = useCatalog();
  const editable = canEdit();
  const [detail, setDetail] = useState<Alert | null>(null);
  const [editAlert, setEditAlert] = useState<Alert | null | undefined>(undefined);
  const [delAlert, setDelAlert] = useState<Alert | null>(null);
  const [editKql, setEditKql] = useState<KqlQuery | null | undefined>(undefined);
  const [delKql, setDelKql] = useState<KqlQuery | null>(null);

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
    <AppShell title="Catálogo de alertas" active="alerts">
      <Tabs defaultValue="alerts">
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
                onNew={() => { if (editable) setEditKql(null); }}
                onEdit={(k) => { if (editable) setEditKql(k); }}
                onDelete={(k) => { if (editable) setDelKql(k); }} />}
        </TabsContent>
        <TabsContent value="leyenda"><LeyendaView /></TabsContent>
      </Tabs>

      <AlertDetailSheet alert={detail} open={!!detail} onOpenChange={(o) => !o && setDetail(null)} />

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
    </AppShell>
  );
}
