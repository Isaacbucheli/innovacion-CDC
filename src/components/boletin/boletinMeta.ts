import type { BoletinGroup } from "@/types";

/** Pills de urgencia (desaturadas, patrón FindingBits/severity). Sin emojis. */
export const URGENCY_META: Record<BoletinGroup["urgency"], { label: string; cls: string }> = {
  retirado:   { label: "Retirado",     cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
  proximo:    { label: "Vence < 6 m",  cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  programado: { label: "Programado",   cls: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" },
  sin_fecha:  { label: "Sin fecha",    cls: "bg-muted text-muted-foreground" },
};

export const SOURCE_LABEL: Record<BoletinGroup["source"], string> = {
  advisor: "Advisor",
  service_health: "Service Health",
};

export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
}

/** El summary de Service Health llega como HTML: lo aplanamos a texto (nunca innerHTML). */
export function htmlToText(html: string | null): string {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}
