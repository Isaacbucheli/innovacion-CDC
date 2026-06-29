import { useState } from "react";
import AuthGate from "@/components/AuthGate";
import CatalogPage from "@/components/CatalogPage";
import CostsPage from "@/components/costs/CostsPage";
import ClientsPage from "@/components/clients/ClientsPage";
import WafPage from "@/components/waf/WafPage";
import CostReferencePage from "@/components/waf/CostReferencePage";
import { Toaster } from "@/components/ui/sonner";

export default function App() {
  const [section, setSection] = useState<string>("alerts");
  return (
    <>
      <AuthGate>
        {section === "costos" ? (
          <CostsPage onNavigate={setSection} />
        ) : section === "clientes" ? (
          <ClientsPage onNavigate={setSection} />
        ) : section === "waf" ? (
          <WafPage onNavigate={setSection} />
        ) : section === "waf-cost" ? (
          <CostReferencePage onNavigate={setSection} />
        ) : (
          <CatalogPage onNavigate={setSection} />
        )}
      </AuthGate>
      <Toaster position="top-right" />
    </>
  );
}
