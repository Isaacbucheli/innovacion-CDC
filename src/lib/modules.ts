import {
  Coins, Award, Sparkles, History, Wallet, FileText, CalendarClock, Bell,
  Building2, Users, Boxes, Radar, ShieldCheck, type LucideIcon,
} from "lucide-react";

import { azIcon } from "@/lib/azureIcons";

export interface ModuleItem {
  key: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  /** Icono oficial de Azure incrustado (data URI, ver lib/azureIcons). Si falta, se usa `icon` (lucide). */
  azureIcon?: string;
  adminOnly?: boolean;
}
const AZ = (n: string) => azIcon(n);
export interface ModuleGroup { group: string; items: ModuleItem[] }

// Catálogo de módulos navegables del piloto (espejo del menú), usado por la
// página de inicio y los accesos recientes.
export const MODULE_GROUPS: ModuleGroup[] = [
  { group: "Matriz costos Azure", items: [
    { key: "costos", label: "Optimización de costos", desc: "Matriz de costos y escenarios de ahorro.", icon: Coins, azureIcon: AZ("cost-management") },
    { key: "optimization", label: "Oportunidades de Optimización", desc: "Recomendaciones de costo y gobernanza del tenant.", icon: Radar, azureIcon: AZ("cost-analysis") },
    { key: "service-catalog", label: "Catálogo de servicios", desc: "Servicios Azure que alimentan el costeo.", icon: Boxes, azureIcon: AZ("resources") },
  ] },
  { group: "Matriz mejoras Azure", items: [
    { key: "waf", label: "Recomendaciones", desc: "Well-Architected por pilar.", icon: Award, azureIcon: AZ("advisor") },
    { key: "waf-validation", label: "Validación inteligente", desc: "Curación IA del catálogo.", icon: Sparkles, adminOnly: true, azureIcon: AZ("azure-openai") },
    { key: "waf-ingestions", label: "Historial de ingestas", desc: "Cargas de Advisor y Excel.", icon: History, azureIcon: AZ("data-factory") },
    { key: "waf-cost", label: "Costo referencial Azure", desc: "Estimación con tarifas públicas.", icon: Wallet, azureIcon: AZ("cost-analysis") },
  ] },
  { group: "Informes", items: [
    // Concepto interno (reportería): sin SVG oficial de Azure → icono lucide coherente.
    { key: "report", label: "Informe de gestión mensual", desc: "Resumen mensual de la plataforma.", icon: FileText },
  ] },
  { group: "Gestión CDC", items: [
    { key: "reservations", label: "Reservas por vencer", desc: "Reservas de capacidad Azure.", icon: CalendarClock, azureIcon: AZ("reservations") },
    { key: "alerts", label: "Catálogo de alertas", desc: "Alertas Azure Monitor y biblioteca KQL.", icon: Bell, azureIcon: AZ("monitor") },
    // No existe SVG "policy" en assets/azure-icons → se usa el de resource-groups (gobierno/gestión).
    { key: "policies", label: "Catálogo de políticas", desc: "Línea base de Azure Policy para gobierno, seguridad y FinOps.", icon: ShieldCheck, azureIcon: AZ("resource-groups") },
    { key: "consultants", label: "Asignación de consultores", desc: "Clientes por consultor, backups, carga y reasignación.", icon: Users, azureIcon: AZ("users") },
  ] },
  { group: "Administración", items: [
    { key: "clientes", label: "Clientes", desc: "Alta, credenciales Azure y datos de clientes.", icon: Building2, adminOnly: true },
    { key: "usuarios", label: "Usuarios y perfiles", desc: "Accesos internos de la plataforma.", icon: Users, adminOnly: true, azureIcon: AZ("users") },
  ] },
];

export const MODULE_BY_KEY: Record<string, ModuleItem> = Object.fromEntries(
  MODULE_GROUPS.flatMap((g) => g.items).map((it) => [it.key, it]),
);
