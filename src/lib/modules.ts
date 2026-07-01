import {
  Coins, Award, Sparkles, History, Wallet, FileText, CalendarClock, Bell,
  Building2, KeyRound, Users, type LucideIcon,
} from "lucide-react";

export interface ModuleItem {
  key: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}
export interface ModuleGroup { group: string; items: ModuleItem[] }

// Catálogo de módulos navegables del piloto (espejo del menú), usado por la
// página de inicio y los accesos recientes.
export const MODULE_GROUPS: ModuleGroup[] = [
  { group: "Matriz costos Azure", items: [
    { key: "costos", label: "Optimización de costos", desc: "Matriz de costos y escenarios de ahorro.", icon: Coins },
  ] },
  { group: "Matriz mejoras Azure", items: [
    { key: "waf", label: "Recomendaciones", desc: "Well-Architected por pilar.", icon: Award },
    { key: "waf-validation", label: "Validación inteligente", desc: "Curación IA del catálogo.", icon: Sparkles, adminOnly: true },
    { key: "waf-ingestions", label: "Historial de ingestas", desc: "Cargas de Advisor y Excel.", icon: History },
    { key: "waf-cost", label: "Costo referencial Azure", desc: "Estimación con tarifas públicas.", icon: Wallet },
  ] },
  { group: "Informes", items: [
    { key: "report", label: "Informe de gestión mensual", desc: "Resumen mensual de la plataforma.", icon: FileText },
  ] },
  { group: "Gestión CDC", items: [
    { key: "reservations", label: "Reservas por vencer", desc: "Reservas de capacidad Azure.", icon: CalendarClock },
    { key: "alerts", label: "Catálogo de alertas", desc: "Alertas Azure Monitor y biblioteca KQL.", icon: Bell },
  ] },
  { group: "Administración", items: [
    { key: "clientes", label: "Clientes", desc: "Alta y datos de clientes.", icon: Building2, adminOnly: true },
    { key: "credenciales", label: "Credenciales Azure", desc: "App Registrations y suscripciones.", icon: KeyRound, adminOnly: true },
    { key: "usuarios", label: "Usuarios y perfiles", desc: "Accesos internos de la plataforma.", icon: Users, adminOnly: true },
  ] },
];

export const MODULE_BY_KEY: Record<string, ModuleItem> = Object.fromEntries(
  MODULE_GROUPS.flatMap((g) => g.items).map((it) => [it.key, it]),
);
