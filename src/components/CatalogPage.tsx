import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AppShell from "@/components/AppShell";

export default function CatalogPage() {
  return (
    <AppShell title="Catálogo de alertas">
      <Tabs defaultValue="alerts">
        <TabsList>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
          <TabsTrigger value="kql">Biblioteca KQL</TabsTrigger>
          <TabsTrigger value="leyenda">Leyenda</TabsTrigger>
        </TabsList>
        <TabsContent value="alerts"><div className="py-6 text-muted-foreground">Alertas (próximo)</div></TabsContent>
        <TabsContent value="kql"><div className="py-6 text-muted-foreground">Biblioteca KQL (próximo)</div></TabsContent>
        <TabsContent value="leyenda"><div className="py-6 text-muted-foreground">Leyenda (próximo)</div></TabsContent>
      </Tabs>
    </AppShell>
  );
}
