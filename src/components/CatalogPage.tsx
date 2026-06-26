import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AppShell from "@/components/AppShell";
import AlertsView from "@/components/alerts/AlertsView";
import AlertDetailSheet from "@/components/alerts/AlertDetailSheet";
import KqlView from "@/components/KqlView";
import LeyendaView from "@/components/LeyendaView";
import { useCatalog } from "@/hooks/useCatalog";
import { canEdit } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import type { Alert } from "@/types";

export default function CatalogPage() {
  const { alerts, kql, loading, error } = useCatalog();
  const editable = canEdit();
  const [detail, setDetail] = useState<Alert | null>(null);
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
                onOpen={(a) => setDetail(a)} onEdit={() => {}} onDelete={() => {}} />}
        </TabsContent>
        <TabsContent value="kql">
          {loading ? <Skeleton className="h-40 w-full mt-4" />
            : error ? <p className="text-destructive py-6">{error}</p>
            : <KqlView kql={kql} canEdit={editable} onNew={() => {}} onEdit={() => {}} onDelete={() => {}} />}
        </TabsContent>
        <TabsContent value="leyenda"><LeyendaView /></TabsContent>
      </Tabs>
      <AlertDetailSheet alert={detail} open={!!detail} onOpenChange={(o) => !o && setDetail(null)} />
    </AppShell>
  );
}
