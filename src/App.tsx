import { useCallback, useState } from "react";
import AuthGate from "@/components/AuthGate";
import HomePage from "@/components/HomePage";
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
import UsersPage from "@/components/users/UsersPage";
import { Toaster } from "@/components/ui/sonner";

const SECTION_KEY = "innovacion_cdc_section";
const RECENT_KEY = "innovacion_cdc_recent";
function loadRecent(): string[] {
  try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); return Array.isArray(v) ? v : []; }
  catch { return []; }
}

export default function App() {
  // Recuerda la última sección visitada; primer uso → inicio (home).
  const [section, setSection] = useState<string>(() => localStorage.getItem(SECTION_KEY) || "home");
  const [recent, setRecent] = useState<string[]>(loadRecent);

  const navigate = useCallback((key: string) => {
    setSection(key);
    localStorage.setItem(SECTION_KEY, key);
    if (key !== "home") {
      setRecent((prev) => {
        const next = [key, ...prev.filter((k) => k !== key)].slice(0, 5);
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
        return next;
      });
    }
  }, []);

  return (
    <>
      <AuthGate>
        {section === "costos" ? (
          <CostsPage onNavigate={navigate} />
        ) : section === "clientes" ? (
          <ClientsPage onNavigate={navigate} />
        ) : section === "waf" ? (
          <WafPage onNavigate={navigate} />
        ) : section === "waf-cost" ? (
          <CostReferencePage onNavigate={navigate} />
        ) : section === "waf-ingestions" ? (
          <IngestionsPage onNavigate={navigate} />
        ) : section === "waf-validation" ? (
          <ValidationPage onNavigate={navigate} />
        ) : section === "report" ? (
          <ReportPage onNavigate={navigate} />
        ) : section === "reservations" ? (
          <ReservationsPage onNavigate={navigate} />
        ) : section === "credenciales" ? (
          <CredentialsPage onNavigate={navigate} />
        ) : section === "usuarios" ? (
          <UsersPage onNavigate={navigate} />
        ) : section === "alerts" ? (
          <CatalogPage onNavigate={navigate} />
        ) : (
          <HomePage recent={recent} onNavigate={navigate} />
        )}
      </AuthGate>
      <Toaster position="top-right" />
    </>
  );
}
