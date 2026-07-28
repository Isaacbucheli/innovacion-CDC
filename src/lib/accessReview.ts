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

/** Etiqueta corta para la columna Privilegio de la tabla de Cuentas: "Owner (otorga accesos)" en una
 *  celda parte el texto en tres líneas. La etiqueta larga sigue usándose en Asignaciones y en el
 *  panel de detalle, donde hay ancho. */
export function roleClassShortLabel(c: AccessRoleClass): string {
  return c === "owner" ? "Owner" : roleClassLabel(c);
}

/** Techo de privilegio de una cuenta: la clase más grave con al menos una asignación. Los conteos por
 *  clase los agrega el backend; acá solo se elige el mayor para no mostrar cuatro columnas numéricas
 *  que casi siempre están en cero. `null` = sin clasificar (corrida anterior a la clasificación). */
export function accountPrivilege(a: Pick<AccessAccount,
  "owner" | "otorga_accesos" | "escritura_total" | "escritura_servicio" | "lectura">): AccessRoleClass {
  if (a.owner > 0) return "owner";
  if (a.otorga_accesos > 0) return "otorga_accesos";
  if (a.escritura_total > 0) return "escritura_total";
  if (a.escritura_servicio > 0) return "escritura_servicio";
  if (a.lectura > 0) return "lectura";
  return null;
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
    case "transversal": return "Varios ambientes";
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
    // Cruza ambientes: pesa como producción, porque producción está adentro.
    case "transversal": return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
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

/** Dos especies de hallazgo que el panel presenta con pesos distintos, y el discriminador ya viene en
 *  el payload: con principals afectados hay culpables concretos que se arreglan hoy ("Cuenta externa
 *  con privilegio elevado"); con la lista vacía es una propiedad estructural del tenant, medida contra
 *  un umbral ("2968 asignaciones a nivel de recurso"), que es un proyecto de meses. Mostrarlas con el
 *  mismo peso afirma que son igual de urgentes. */
export function findingIsActionable(f: AccessFinding): boolean {
  return f.affected_principals.length > 0;
}

/** Concordancia de número: el panel decía "1 cuentas · 1 asignaciones". */
export function cuentasLabel(n: number): string {
  return n === 1 ? "1 cuenta" : `${n} cuentas`;
}

export function asignacionesLabel(n: number): string {
  return n === 1 ? "1 asignación" : `${n} asignaciones`;
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
  // "1 pendientes" / "2 justificado": una cuenta con un solo acceso es el caso más común, así que el
  // error de concordancia se ve casi siempre. "mantener" y "revocar" son infinitivos y no varían.
  if (a.decision_pendientes > 0)
    parts.push(`${a.decision_pendientes} ${a.decision_pendientes === 1 ? "pendiente" : "pendientes"}`);
  if (a.decision_mantener > 0) parts.push(`${a.decision_mantener} mantener`);
  if (a.decision_revocar > 0) parts.push(`${a.decision_revocar} revocar`);
  if (a.decision_justificado > 0)
    parts.push(`${a.decision_justificado} ${a.decision_justificado === 1 ? "justificado" : "justificados"}`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

/** Avance de la revisión de una cuenta: "3 de 8". Cuando nadie decidió nada devuelve "—" y no
 *  "8 pendientes": si ninguna cuenta está decidida, esa columna repite el mismo texto en cada fila y
 *  el ruido queda con formato de dato. El desglose completo va al panel de detalle. */
export function decisionProgress(a: Pick<AccessAccount,
  "decision_pendientes" | "decision_mantener" | "decision_revocar" | "decision_justificado">): string {
  const decididas = a.decision_mantener + a.decision_revocar + a.decision_justificado;
  const total = decididas + a.decision_pendientes;
  if (decididas === 0 || total === 0) return "—";
  return `${decididas} de ${total}`;
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
/**
 * Qué mostrar en la columna "Suscripción". Para una asignación heredada (management group o root) la
 * suscripción es un dato arbitrario: ARM la reporta una vez por cada suscripción consultada y al
 * colapsar las repeticiones se conserva la primera, que no significa nada. Lo honesto es decir de
 * dónde viene el acceso y a cuántas suscripciones llega.
 */
export function subscriptionLabel(a: {
  subscription_name: string | null; subscription_id: string;
  scope: string; scope_level: string; subscriptions_reached?: number;
}): string {
  if (a.scope_level === "root") return "Todo el tenant";
  if (a.scope_level === "management_group") {
    const mg = a.scope.split("/").pop() || "management group";
    // Azure nombra el management group raíz con el GUID del tenant: mostrar ese GUID no le dice nada
    // a nadie, y es justo el scope más amplio que existe debajo de root.
    const nombre = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mg)
      ? "Management group raíz"
      : mg;
    const n = a.subscriptions_reached ?? 0;
    return n > 1 ? `${nombre} · ${n} suscripciones` : nombre;
  }
  return a.subscription_name || a.subscription_id;
}

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
