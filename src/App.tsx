import { lazy, Suspense, useCallback, useState } from "react";
import AuthGate from "@/components/AuthGate";
import HomePage from "@/components/HomePage";
import BusyOverlay from "@/components/BusyOverlay";
import { Toaster } from "@/components/ui/sonner";

// Vistas por sección con carga diferida (code-splitting): cada una es un chunk
// aparte que se descarga solo al abrir esa sección. Así el bundle inicial (shell +
// home + login) no arrastra librerías pesadas como Recharts (informes) o cmdk
// (paleta del catálogo) hasta que hacen falta. HomePage queda eager (es el landing).
const CostsPage = lazy(() => import("@/components/costs/CostsPage"));
const OptimizationPage = lazy(() => import("@/components/optimization/OptimizationPage"));
const ClientsPage = lazy(() => import("@/components/clients/ClientsPage"));
const WafPage = lazy(() => import("@/components/waf/WafPage"));
const CostReferencePage = lazy(() => import("@/components/waf/CostReferencePage"));
const IngestionsPage = lazy(() => import("@/components/waf/IngestionsPage"));
const ValidationPage = lazy(() => import("@/components/waf/ValidationPage"));
const ReportPage = lazy(() => import("@/components/reports/ReportPage"));
const ReservationsPage = lazy(() => import("@/components/reservations/ReservationsPage"));
const UsersPage = lazy(() => import("@/components/users/UsersPage"));
const ServiceCatalogPage = lazy(() => import("@/components/services/ServiceCatalogPage"));
const CatalogPage = lazy(() => import("@/components/CatalogPage"));

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
        <Suspense fallback={<BusyOverlay show title="Cargando…" />}>
          {section === "costos" ? (
            <CostsPage onNavigate={navigate} />
          ) : section === "optimization" ? (
            <OptimizationPage onNavigate={navigate} />
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
          ) : section === "usuarios" ? (
            <UsersPage onNavigate={navigate} />
          ) : section === "service-catalog" ? (
            <ServiceCatalogPage onNavigate={navigate} />
          ) : section === "alerts" ? (
            <CatalogPage onNavigate={navigate} />
          ) : (
            <HomePage recent={recent} onNavigate={navigate} />
          )}
        </Suspense>
      </AuthGate>
      <Toaster position="top-right" />
    </>
  );
}
