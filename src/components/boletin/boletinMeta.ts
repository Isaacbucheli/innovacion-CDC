import { Sparkles, ShieldCheck, Layers, Coins, type LucideIcon } from "lucide-react";
import type { BoletinGroup, NovedadCliente } from "@/types";

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
  eol: "Catálogo BIT",
};

/** Metadata de las 4 categorías BIT de Novedades (tarjetas del tab homónimo). Orden fijo de
 *  presentación: se recorre con Object.keys/for..of sobre este mismo objeto, así que el orden
 *  de declaración importa (coincide con el mockup original). */
export const NOVEDAD_CATEGORIA_META: Record<NovedadCliente["categoria_bit"], { label: string; icon: LucideIcon }> = {
  productividad_ia: { label: "Productividad e IA", icon: Sparkles },
  seguridad_identidad: { label: "Seguridad e identidad", icon: ShieldCheck },
  resiliencia_plataforma: { label: "Resiliencia y plataforma", icon: Layers },
  costo_operacion: { label: "Costo y operación", icon: Coins },
};

/** Título de una novedad según idioma: ES por defecto (traducción persistida), EN con el toggle. */
export function novedadTitle(n: NovedadCliente, english: boolean): string {
  return english ? n.titulo : (n.titulo_es ?? n.titulo);
}

/** Descripción de una novedad según idioma. Ya llega texto plano (sin HTML) desde el feed. */
export function novedadDescripcion(n: NovedadCliente, english: boolean): string {
  return english ? n.descripcion : (n.descripcion_es ?? n.descripcion);
}

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

/** Textos del grupo según idioma. ES por defecto (traducción fiel persistida);
 *  fallback al original EN cuando la traducción aún no existe. */
export function groupTexts(g: BoletinGroup, english: boolean): {
  title: string; summary: string | null; action: string | null;
} {
  if (english) return { title: g.title, summary: g.summary, action: g.recommended_action };
  return {
    title: g.title_es ?? g.title,
    summary: g.summary_es ?? g.summary,
    action: g.recommended_action_es ?? g.recommended_action,
  };
}
