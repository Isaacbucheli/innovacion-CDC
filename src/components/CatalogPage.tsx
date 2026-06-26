import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AppShell from "@/components/AppShell";
import AlertsView from "@/components/alerts/AlertsView";
import { useCatalog } from "@/hooks/useCatalog";
import { canEdit } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";

export default function CatalogPage() {
  const { alerts, kql, loading, error } = useCatalog();
  const editable = canEdit();
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
                onOpen={() => {}} onEdit={() => {}} onDelete={() => {}} />}
        </TabsContent>
        <TabsContent value="kql"><div className="py-6 text-muted-foreground">Biblioteca KQL (próximo)</div></TabsContent>
        <TabsContent value="leyenda"><div className="py-6 text-muted-foreground">Leyenda (próximo)</div></TabsContent>
      </Tabs>
    </AppShell>
  );
}
