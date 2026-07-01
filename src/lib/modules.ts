import {
  Coins, Award, Sparkles, History, Wallet, FileText, CalendarClock, Bell,
  Building2, KeyRound, Users, Boxes, type LucideIcon,
} from "lucide-react";

export interface ModuleItem {
  key: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  /** Icono oficial de Azure (ruta a /assets/azure-icons/*.svg). Si falta, se usa `icon` (lucide). */
  azureIcon?: string;
  adminOnly?: boolean;
}
const AZ = (n: string) => `/assets/azure-icons/${n}.svg`;
export interface ModuleGroup { group: string; items: ModuleItem[] }

// Catálogo de módulos navegables del piloto (espejo del menú), usado por la
// página de inicio y los accesos recientes.
export const MODULE_GROUPS: ModuleGroup[] = [
  { group: "Matriz costos Azure", items: [
    { key: "costos", label: "Optimización de costos", desc: "Matriz de costos y escenarios de ahorro.", icon: Coins, azureIcon: AZ("cost-management") },
    { key: "service-catalog", label: "Catálogo de servicios", desc: "Servicios Azure que alimentan el costeo.", icon: Boxes, azureIcon: AZ("resources") },
  ] },
  { group: "Matriz mejoras Azure", items: [
    { key: "waf", label: "Recomendaciones", desc: "Well-Architected por pilar.", icon: Award, azureIcon: AZ("advisor") },
    { key: "waf-validation", label: "Validación inteligente", desc: "Curación IA del catálogo.", icon: Sparkles, adminOnly: true, azureIcon: AZ("advisor") },
    { key: "waf-ingestions", label: "Historial de ingestas", desc: "Cargas de Advisor y Excel.", icon: History, azureIcon: AZ("advisor") },
    { key: "waf-cost", label: "Costo referencial Azure", desc: "Estimación con tarifas públicas.", icon: Wallet, azureIcon: AZ("waf-cost") },
  ] },
  { group: "Informes", items: [
    // Concepto interno (reportería): sin SVG oficial de Azure → icono lucide coherente.
    { key: "report", label: "Informe de gestión mensual", desc: "Resumen mensual de la plataforma.", icon: FileText },
  ] },
  { group: "Gestión CDC", items: [
    // TODO: iconos oficiales de Azure Reservations / Azure Monitor (no están en el repo aún).
    { key: "reservations", label: "Reservas por vencer", desc: "Reservas de capacidad Azure.", icon: CalendarClock },
    { key: "alerts", label: "Catálogo de alertas", desc: "Alertas Azure Monitor y biblioteca KQL.", icon: Bell },
  ] },
  { group: "Administración", items: [
    { key: "clientes", label: "Clientes", desc: "Alta y datos de clientes.", icon: Building2, adminOnly: true },
    { key: "credenciales", label: "Credenciales Azure", desc: "App Registrations y suscripciones.", icon: KeyRound, adminOnly: true, azureIcon: AZ("app-registrations") },
    { key: "usuarios", label: "Usuarios y perfiles", desc: "Accesos internos de la plataforma.", icon: Users, adminOnly: true, azureIcon: AZ("users") },
  ] },
];

export const MODULE_BY_KEY: Record<string, ModuleItem> = Object.fromEntries(
  MODULE_GROUPS.flatMap((g) => g.items).map((it) => [it.key, it]),
);
