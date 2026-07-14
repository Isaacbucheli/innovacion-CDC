import { lazy, Suspense, useCallback, useState } from "react";
import AuthGate from "@/components/AuthGate";
import HomePage from "@/components/HomePage";
import BusyOverlay from "@/components/BusyOverlay";
import AdvisorSyncGuard from "@/components/waf/AdvisorSyncGuard";
import { Toaster } from "@/components/ui/sonner";
import { canViewModule, getRole } from "@/lib/auth";

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
const PolicyCatalogPage = lazy(() => import("@/components/PolicyCatalogPage"));
const ConsultantsPage = lazy(() => import("@/components/ConsultantsPage"));
const NoAccessPage = lazy(() => import("@/components/NoAccessPage"));

const SECTION_KEY = "innovacion_cdc_section";
const RECENT_KEY = "innovacion_cdc_recent";
function loadRecent(): string[] {
  try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); return Array.isArray(v) ? v : []; }
  catch { return []; }
}

// Guard central: si fuerzan la sección por localStorage sin permiso, se muestra
// el fallback (la API igual respondería 403; esto evita la pantalla rota).
const ADMIN_SECTIONS = new Set(["clientes", "usuarios", "waf-validation"]);
// Matriz de módulos (11 secciones): costos, optimization, service-catalog, waf,
// waf-ingestions, waf-cost, report, reservations, alerts, policies, consultants
function allowedSection(key: string): boolean {
  if (key === "home") return true;
  if (ADMIN_SECTIONS.has(key)) return getRole() === "admin";
  // Fail-closed: toda sección no listada se trata como módulo de la matriz
  // (una clave desconocida queda denegada para no-admin en vez de abierta).
  return canViewModule(key);
}

// El guard debe evaluarse al RENDER de este componente (ya con la sesión resuelta
// por AuthGate), no al construir el árbol de App: leer localStorage antes de que
// AuthGate escriba rol/permisos congelaba una decisión stale (admin veía "Sin acceso").
function SectionView({ section, recent, onNavigate }: {
  section: string;
  recent: string[];
  onNavigate: (key: string) => void;
}) {
  if (!allowedSection(section)) return <NoAccessPage onNavigate={onNavigate} />;
  return section === "costos" ? (
    <CostsPage onNavigate={onNavigate} />
  ) : section === "optimization" ? (
    <OptimizationPage onNavigate={onNavigate} />
  ) : section === "clientes" ? (
    <ClientsPage onNavigate={onNavigate} />
  ) : section === "waf" ? (
    <WafPage onNavigate={onNavigate} />
  ) : section === "waf-cost" ? (
    <CostReferencePage onNavigate={onNavigate} />
  ) : section === "waf-ingestions" ? (
    <IngestionsPage onNavigate={onNavigate} />
  ) : section === "waf-validation" ? (
    <ValidationPage onNavigate={onNavigate} />
  ) : section === "report" ? (
    <ReportPage onNavigate={onNavigate} />
  ) : section === "reservations" ? (
    <ReservationsPage onNavigate={onNavigate} />
  ) : section === "usuarios" ? (
    <UsersPage onNavigate={onNavigate} />
  ) : section === "service-catalog" ? (
    <ServiceCatalogPage onNavigate={onNavigate} />
  ) : section === "alerts" ? (
    <CatalogPage onNavigate={onNavigate} />
  ) : section === "policies" ? (
    <PolicyCatalogPage onNavigate={onNavigate} />
  ) : section === "consultants" ? (
    <ConsultantsPage onNavigate={onNavigate} />
  ) : (
    <HomePage recent={recent} onNavigate={onNavigate} />
  );
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
        <>
          {/* Guard global de sincronización Advisor (feature paralela) + vista de sección. */}
          <AdvisorSyncGuard />
          <Suspense fallback={<BusyOverlay show title="Cargando…" />}>
            <SectionView section={section} recent={recent} onNavigate={navigate} />
          </Suspense>
        </>
      </AuthGate>
      <Toaster position="top-right" />
    </>
  );
}
