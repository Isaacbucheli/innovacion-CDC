import { SEVERITY_META, severityKey } from "@/lib/severity";
import type { FindingState, OptFinding } from "@/types";

export const STATE_META: Record<FindingState, { label: string; badge: string }> = {
  abierto: { label: "Abierto", badge: "border border-primary text-[#5a7016] dark:text-[#a9c46a] bg-[#A3C243]/10" },
  en_progreso: { label: "En progreso", badge: "border border-amber-300 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40" },
  resuelto: { label: "Resuelto", badge: "border border-border text-muted-foreground bg-secondary" },
  ignorado: { label: "Ignorado", badge: "border border-border text-muted-foreground bg-secondary" },
};

export function SevBadge({ sev }: { sev: string | null }) {
  const m = SEVERITY_META[severityKey(sev)];
  return <span className={`inline-flex items-center text-xs px-2.5 py-0.5 rounded-md ${m.badge}`}>{m.label}</span>;
}

export function StateBadge({ state }: { state: FindingState }) {
  const m = STATE_META[state] ?? STATE_META.abierto;
  return <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-md ${m.badge}`}>{m.label}</span>;
}

/** Texto compacto de detalle a partir del dict `details` del hallazgo. */
export function detailText(f: OptFinding): string {
  const d = f.details ?? {};
  const s = (k: string) => (d[k] == null ? "" : String(d[k]));
  const parts: string[] = [];
  if (s("sku")) parts.push(s("sku"));
  if (s("vmSize")) parts.push(s("vmSize"));
  if (s("diskSizeGB")) parts.push(`${s("diskSizeGB")} GB`);
  if (s("powerState")) parts.push(s("powerState"));
  if (s("licenseType")) parts.push(s("licenseType"));
  if (parts.length === 0 && s("note")) return s("note");
  return parts.join(" · ") || (typeof d.note === "string" ? d.note : "");
}
