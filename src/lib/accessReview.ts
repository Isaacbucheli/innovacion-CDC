// Helpers de presentación del módulo Revisión de accesos.

import type {
  AccessAssignment, AccessFinding, AccessFindingSeverity, AccessPrincipalType, AccessRoleClass,
} from "@/types";

export function principalTypeLabel(t: AccessPrincipalType): string {
  switch (t) {
    case "User": return "Usuario";
    case "Group": return "Grupo";
    case "ServicePrincipal": return "Service principal";
    case "ForeignGroup": return "Grupo externo (otro tenant)";
    case "Device": return "Dispositivo";
    case "Unknown": return "Sin identificar";
    default: return t;
  }
}

export function roleClassLabel(c: AccessRoleClass): string {
  switch (c) {
    case "owner": return "Owner (otorga accesos)";
    case "otorga_accesos": return "Otorga accesos";
    case "escritura_total": return "Escritura total";
    case "escritura_servicio": return "Escritura de servicio";
    case "lectura": return "Lectura";
    default: return "Sin clasificar";
  }
}

/** Rojo para lo que puede otorgar accesos, ámbar para escritura amplia, neutro para el resto. */
export function roleClassChip(c: AccessRoleClass): string {
  switch (c) {
    case "owner":
    case "otorga_accesos":
      return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
    case "escritura_total":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
    case "escritura_servicio":
      return "bg-yellow-50 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300";
    case "lectura":
      return "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

/** "n/d" cuando el eje no se midió: nunca afirmar "Interna" sin dato de directorio. */
export function externalLabel(v: boolean | null): string {
  if (v === null) return "n/d";
  return v ? "Externa" : "Interna";
}

export function externalChip(v: boolean | null): string {
  if (v === null) return "bg-muted text-muted-foreground";
  return v
    ? "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300"
    : "bg-muted text-muted-foreground";
}

export function viaLabel(v: string): string {
  switch (v) {
    case "directo": return "Directo";
    case "grupo": return "Vía grupo";
    case "ambos": return "Directo y vía grupo";
    default: return v;
  }
}

/** Tipos que viven en el directorio del cliente: los únicos que pueden estar eliminados de Entra ID.
 * Para un ForeignGroup, un Device o un principal sin tipo, no tener nombre es lo esperado. */
export function livesInTenant(t: AccessPrincipalType): boolean {
  return t === "User" || t === "Group" || t === "ServicePrincipal";
}

export function severityLabel(s: AccessFindingSeverity): string {
  switch (s) {
    case "critica": return "Crítica";
    case "alta": return "Alta";
    case "media": return "Media";
    default: return "Informativa";
  }
}

export function severityChip(s: AccessFindingSeverity): string {
  switch (s) {
    case "critica": return "bg-red-600 text-white dark:bg-red-700";
    case "alta": return "bg-amber-500 text-white dark:bg-amber-600";
    case "media": return "bg-yellow-200 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-100";
    default: return "bg-muted text-muted-foreground";
  }
}

/** Un hallazgo "vive" si se pudo evaluar y encontró algo. Los evaluados sin hallazgos también son
 *  información (se agrupan aparte), y los no evaluables no son cero: es dato que falta. */
export function findingIsOpen(f: AccessFinding): boolean {
  return f.evaluable && (f.affected_accounts > 0 || f.affected_assignments > 0);
}

/** Roles presentes en la corrida, para el filtro por rol. */
export function distinctRoles(assignments: AccessAssignment[]): string[] {
  return [...new Set(assignments.map((a) => a.role_name))].sort((a, b) => a.localeCompare(b, "es"));
}

export function mfaChip(mfa: string | null): { cls: string; text: string } {
  switch (mfa) {
    case "enabled": return { cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300", text: "MFA" };
    case "disabled": return { cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300", text: "Sin MFA" };
    case "unavailable": return { cls: "bg-muted text-muted-foreground", text: "MFA n/d" };
    default: return { cls: "bg-muted text-muted-foreground", text: "—" };
  }
}

export function scopeLabel(level: string): string {
  switch (level) {
    case "management_group": return "Management group";
    case "subscription": return "Suscripción";
    case "resource_group": return "Resource group";
    case "resource": return "Recurso";
    case "root": return "Directorio (root)";
    default: return level;
  }
}

export function graphStatusLabel(s: string): string {
  switch (s) {
    case "ok": return "Graph OK";
    case "sin_consent": return "Sin consent Graph";
    case "sin_licencia_p1": return "Sin licencia Entra P1 (sin último login)";
    case "no_aplica": return "Lighthouse: solo ARM";
    default: return "Error Graph";
  }
}

/** Días desde la fecha, o null si no hay registro. */
export function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/** Cuenta con riesgo: deshabilitada, sin MFA o inactiva sobre el umbral. */
export function assignmentAlert(a: { account_enabled: boolean | null; mfa_status: string | null; last_sign_in: string | null },
  threshold: number): "deshabilitada" | "sin-mfa" | "inactiva" | null {
  if (a.account_enabled === false) return "deshabilitada";
  if (a.mfa_status === "disabled") return "sin-mfa";
  const d = daysSince(a.last_sign_in);
  if (d !== null && d > threshold) return "inactiva";
  return null;
}
