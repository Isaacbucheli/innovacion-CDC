import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, ExternalLink, Settings2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sugerirMigracion } from "@/lib/api";
import { fmtDate, URGENCY_META } from "@/components/boletin/boletinMeta";
import MigracionCatalogDialog from "@/components/boletin/MigracionCatalogDialog";
import type { MigracionAnnouncement, MigracionEntry, MigracionRuta, MigracionSection, MigracionSugerencia } from "@/types";

/** El backend manda `urgency` como string libre (misma forma que BoletinGroup.urgency, pero sin
 *  acotar el tipo); si llega algo fuera del catálogo cae a "sin_fecha" en vez de romper. */
function urgencyMeta(urgency: string) {
  return URGENCY_META[urgency as keyof typeof URGENCY_META] ?? URGENCY_META.sin_fecha;
}

/** Título del anuncio según idioma: ES por defecto (title_es), EN con el toggle del boletín. */
function announcementTitle(a: MigracionAnnouncement, english: boolean): string {
  return english ? a.title : (a.title_es ?? a.title);
}

/** El anuncio de la ruta cuya fecha coincide con `nearest_date` (ya calculado por el backend);
 *  se usa solo para pintar la pill de urgencia junto a la fecha límite de la fila. */
function nearestAnnouncement(ruta: MigracionRuta): MigracionAnnouncement | undefined {
  if (!ruta.nearest_date) return undefined;
  return ruta.announcements.find((a) => a.retirement_date === ruta.nearest_date);
}

function RutaRow({ ruta, english }: { ruta: MigracionRuta; english: boolean }) {
  const nearest = nearestAnnouncement(ruta);
  return (
    <tr className="border-b align-top last:border-b-0">
      <td className="px-4 py-2.5 font-medium">
        <div className="flex items-center gap-1.5">
          <span>{ruta.desde}</span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{ruta.hacia}</span>
        </div>
      </td>
      <td className="px-4 py-2.5 text-xs text-muted-foreground">
        <ul className="space-y-0.5">
          {ruta.announcements.map((a) => (
            <li key={`${a.source}:${a.announcement_key}`}>{announcementTitle(a, english)}</li>
          ))}
        </ul>
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">{ruta.total_resources}</td>
      <td className="px-4 py-2.5 tabular-nums">
        <div className="flex items-center gap-2">
          <span>{fmtDate(ruta.nearest_date)}</span>
          {nearest ? (
            <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${urgencyMeta(nearest.urgency).cls}`}>
              {urgencyMeta(nearest.urgency).label}
            </span>
          ) : null}
        </div>
      </td>
      <td className="max-w-72 px-4 py-2.5 text-xs text-muted-foreground">
        {ruta.notas ? <span className="line-clamp-2" title={ruta.notas}>{ruta.notas}</span> : null}
        {ruta.learn_more_url ? (
          <a href={ruta.learn_more_url} target="_blank" rel="noopener noreferrer"
            className="mt-0.5 inline-flex items-center gap-1 text-primary hover:underline">
            Más información <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </td>
    </tr>
  );
}

/** Pestaña "Migración" del Boletín Azure: rutas desde → hacia que agrupan anuncios de retiro/EOL
 *  con impacto en el cliente, sugerencia de rutas por IA para los anuncios sin match y catálogo
 *  global editable (solo Edit del módulo boletin). El contenido de las rutas es SIEMPRE en
 *  español (BIT); el toggle `english` solo afecta el título de los anuncios de Azure. */
export default function MigracionTab({ clientId, section, english, canEdit, onChanged }: {
  clientId: number;
  section: MigracionSection;
  english: boolean;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<MigracionEntry> | undefined>(undefined);
  const [sugiriendo, setSugiriendo] = useState(false);
  const [sugerencias, setSugerencias] = useState<MigracionSugerencia[]>([]);
  const [sinSugerencia, setSinSugerencia] = useState<string[]>([]);

  const sinRuta = section.sin_ruta;

  const handleSugerir = async () => {
    setSugiriendo(true);
    try {
      const r = await sugerirMigracion(clientId);
      setSugerencias(r.sugerencias);
      setSinSugerencia(r.sin_sugerencia);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron sugerir rutas de migración.");
    } finally {
      setSugiriendo(false);
    }
  };

  const openCatalogo = () => { setDraft(undefined); setCatalogOpen(true); };
  const revisarSugerencia = (s: MigracionSugerencia) => {
    setDraft({
      clave: s.clave, desde: s.desde, hacia: s.hacia, notas: s.notas,
      match_pattern: s.match_pattern, learn_more_url: s.learn_more_url,
    });
    setCatalogOpen(true);
  };

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={openCatalogo}>
            <Settings2 className="mr-1.5 h-3.5 w-3.5" />
            Catálogo de rutas
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2.5 font-semibold">Desde → Hacia</th>
              <th className="px-4 py-2.5 font-semibold">Anuncios</th>
              <th className="px-4 py-2.5 text-right font-semibold">Recursos</th>
              <th className="px-4 py-2.5 font-semibold">Fecha límite</th>
              <th className="px-4 py-2.5 font-semibold">Notas</th>
            </tr>
          </thead>
          <tbody>
            {section.rutas.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                Sin rutas de migración con anuncios asociados a este cliente.
              </td></tr>
            ) : section.rutas.map((ruta) => <RutaRow key={ruta.id} ruta={ruta} english={english} />)}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <span className="text-sm font-semibold">Sin ruta definida ({sinRuta.length})</span>
          {canEdit ? (
            <Button variant="outline" size="sm" disabled={sinRuta.length === 0 || sugiriendo} onClick={() => void handleSugerir()}>
              <Wand2 className={`mr-1.5 h-3.5 w-3.5 ${sugiriendo ? "animate-spin" : ""}`} />
              {sugiriendo ? "Sugiriendo…" : "Sugerir con IA"}
            </Button>
          ) : null}
        </div>
        {sinRuta.length === 0 ? (
          <div className="px-4 py-4 text-sm text-muted-foreground">
            Todos los anuncios con impacto en este cliente tienen una ruta de migración asociada.
          </div>
        ) : (
          <ul className="divide-y">
            {sinRuta.map((a) => (
              <li key={`${a.source}:${a.announcement_key}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="min-w-0 flex-1 truncate">{announcementTitle(a, english)}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{fmtDate(a.retirement_date)}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{a.resource_count} recursos</span>
              </li>
            ))}
          </ul>
        )}
        {sugerencias.length > 0 || sinSugerencia.length > 0 ? (
          <div className="space-y-2 border-t p-4">
            {sugerencias.map((s) => (
              <div key={s.clave} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <span>{s.desde}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{s.hacia}</span>
                  </div>
                  <Button size="sm" onClick={() => revisarSugerencia(s)}>Revisar y guardar</Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{s.notas}</p>
                <p className="mt-1 text-xs text-muted-foreground">Anuncio: {s.announcement_title}</p>
              </div>
            ))}
            {sinSugerencia.map((title) => (
              <p key={title} className="text-xs text-muted-foreground">
                La IA no encontró ruta en el texto de: {title}
              </p>
            ))}
          </div>
        ) : null}
      </div>

      {canEdit ? (
        <MigracionCatalogDialog
          open={catalogOpen}
          onOpenChange={(o) => { setCatalogOpen(o); if (!o) setDraft(undefined); }}
          onChanged={onChanged}
          draft={draft}
        />
      ) : null}
    </div>
  );
}
