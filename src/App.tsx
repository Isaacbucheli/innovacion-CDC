import { useState } from "react";
import AuthGate from "@/components/AuthGate";
import CatalogPage from "@/components/CatalogPage";
import CostsPage from "@/components/costs/CostsPage";
import ClientsPage from "@/components/clients/ClientsPage";
import WafPage from "@/components/waf/WafPage";
import CostReferencePage from "@/components/waf/CostReferencePage";
import IngestionsPage from "@/components/waf/IngestionsPage";
import ValidationPage from "@/components/waf/ValidationPage";
import ReportPage from "@/components/reports/ReportPage";
import ReservationsPage from "@/components/reservations/ReservationsPage";
import CredentialsPage from "@/components/credentials/CredentialsPage";
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
        ) : section === "waf-ingestions" ? (
          <IngestionsPage onNavigate={setSection} />
        ) : section === "waf-validation" ? (
          <ValidationPage onNavigate={setSection} />
        ) : section === "report" ? (
          <ReportPage onNavigate={setSection} />
        ) : section === "reservations" ? (
          <ReservationsPage onNavigate={setSection} />
        ) : section === "credenciales" ? (
          <CredentialsPage onNavigate={setSection} />
        ) : (
          <CatalogPage onNavigate={setSection} />
        )}
      </AuthGate>
      <Toaster position="top-right" />
    </>
  );
}
