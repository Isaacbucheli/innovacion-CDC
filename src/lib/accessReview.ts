// Helpers de presentación del módulo Revisión de accesos.

import type {
  AccessAccount, AccessAssignment, AccessDecisionValue, AccessFinding, AccessFindingSeverity,
  AccessPrincipalType, AccessRoleClass,
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

/** Ambiente de la suscripción. Lo clasifica el backend a partir del nombre (es una inferencia):
 *  acá solo se etiqueta. "Sin identificar" es honesto — el nombre no permitió deducirlo. */
export function environmentLabel(env: string): string {
  switch (env) {
    case "produccion": return "Producción";
    case "preproduccion": return "Preproducción";
    case "desarrollo": return "Desarrollo";
    default: return "Sin identificar";
  }
}

/** Producción en rojo tenue (un permiso ahí pesa más), preproducción en ámbar, desarrollo neutro
 *  y sin identificar en gris. */
export function environmentChip(env: string): string {
  switch (env) {
    case "produccion": return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
    case "preproduccion": return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
    case "desarrollo": return "bg-muted text-foreground";
    default: return "bg-muted/50 text-muted-foreground";
  }
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

/** Un hallazgo "vive" si se pudo evaluar, no está aceptado y encontró algo. Los evaluados sin
 *  hallazgos también son información (se agrupan aparte), y los no evaluables no son cero: es dato
 *  que falta. Un hallazgo aceptado (umbral con justificación) deja de ser trabajo pendiente. */
export function findingIsOpen(f: AccessFinding): boolean {
  return f.evaluable && !f.accepted && (f.affected_accounts > 0 || f.affected_assignments > 0);
}

// ── Decisión por acceso (bloque 3) ─────────────────────────
// La decisión la calcula y persiste el backend; acá solo se presenta.

export function decisionLabel(d: AccessDecisionValue | null): string {
  switch (d) {
    case "mantener": return "Mantener";
    case "revocar": return "Revocar";
    case "justificado": return "Justificado";
    default: return "Pendiente";
  }
}

/** `revocar` en rojo (promesa sin cumplir), `justificado` en ámbar (riesgo aceptado, visible),
 *  `mantener` neutro y sin decisión en gris tenue. */
export function decisionChip(d: AccessDecisionValue | null): string {
  switch (d) {
    case "revocar": return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
    case "justificado": return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
    case "mantener": return "bg-muted text-foreground";
    default: return "bg-muted/50 text-muted-foreground";
  }
}

/** Detalle de la decisión para el `title` del chip: responsable, fecha, nota y —el punto del
 *  bloque— el arrastre de un `revocar` que sigue vivo desde corridas anteriores. */
export function decisionTitle(a: Pick<AccessAssignment,
  "decision" | "decision_note" | "decision_decided_by" | "decision_decided_at" | "decision_runs_since">): string {
  if (!a.decision) return "Sin decisión registrada.";
  const parts: string[] = [decisionLabel(a.decision)];
  if (a.decision_decided_by) parts.push(`por ${a.decision_decided_by}`);
  if (a.decision_decided_at) parts.push(`el ${new Date(a.decision_decided_at).toLocaleString("es-EC")}`);
  const lines = [parts.join(" ")];
  if (a.decision === "revocar" && a.decision_runs_since !== null && a.decision_runs_since > 0) {
    lines.push(a.decision_runs_since === 1
      ? "Sigue vivo desde hace 1 corrida."
      : `Sigue vivo desde hace ${a.decision_runs_since} corridas.`);
  }
  if (a.decision_note) lines.push(a.decision_note);
  return lines.join(" ");
}

/** Resumen compacto por cuenta: "3 pendientes · 1 justificado" (omite los que están en cero). */
export function decisionSummary(a: Pick<AccessAccount,
  "decision_pendientes" | "decision_mantener" | "decision_revocar" | "decision_justificado">): string {
  const parts: string[] = [];
  if (a.decision_pendientes > 0) parts.push(`${a.decision_pendientes} pendientes`);
  if (a.decision_mantener > 0) parts.push(`${a.decision_mantener} mantener`);
  if (a.decision_revocar > 0) parts.push(`${a.decision_revocar} revocar`);
  if (a.decision_justificado > 0) parts.push(`${a.decision_justificado} justificado`);
  return parts.length > 0 ? parts.join(" · ") : "—";
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
