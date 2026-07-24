// Helpers de presentación del módulo Revisión de accesos.

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
