import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, ExternalLink, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getNovedades, ingestarNovedades, evaluarNovedades, decidirNovedad } from "@/lib/api";
import { fmtDate, novedadDescripcion, novedadTitle, NOVEDAD_CATEGORIA_META } from "@/components/boletin/boletinMeta";
import type { NovedadCliente, NovedadesClienteView } from "@/types";

const CATEGORIAS = Object.keys(NOVEDAD_CATEGORIA_META) as NovedadCliente["categoria_bit"][];

/** `published_at` es un timestamp real (pubDate del RSS, con hora + "Z"), a diferencia de
 *  `retirement_date`/`end_of_support` que el backend ya manda como "yyyy-MM-dd". El `fmtDate` de
 *  este módulo espera fecha pura: nos quedamos solo con la parte de fecha (día calendario del
 *  anuncio) en vez de la hora exacta, que no aporta nada en esta vista. */
function publishedDate(n: NovedadCliente): string {
  return fmtDate(n.published_at.slice(0, 10));
}

function PendienteRow({ n, english, draft, onDraftChange, busy, onDecidir }: {
  n: NovedadCliente;
  english: boolean;
  draft: string;
  onDraftChange: (v: string) => void;
  busy: boolean;
  onDecidir: (estado: "aprobada" | "rechazada") => void;
}) {
  const titulo = novedadTitle(n, english);
  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{titulo}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{NOVEDAD_CATEGORIA_META[n.categoria_bit].label}</span>
      </div>
      <p className="text-xs text-muted-foreground">{novedadDescripcion(n, english)}</p>
      <Textarea
        aria-label={`Por qué le sirve a este cliente: ${titulo}`}
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        rows={2}
        placeholder="¿Por qué le sirve esto a este cliente?"
      />
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={() => onDecidir("rechazada")}>Rechazar</Button>
        <Button size="sm" disabled={busy} onClick={() => onDecidir("aprobada")}>Aprobar</Button>
      </div>
    </li>
  );
}

function AprobadaCard({ n, english }: { n: NovedadCliente; english: boolean }) {
  return (
    <li className="space-y-1.5 px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium">{novedadTitle(n, english)}</span>
        {n.estado_feed === "in_preview" ? (
          <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            Preview
          </span>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{novedadDescripcion(n, english)}</p>
      <p className="rounded-md bg-muted/50 px-2.5 py-1.5 text-xs font-medium text-foreground">{n.por_que}</p>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="tabular-nums">{publishedDate(n)}</span>
        <a
          href={n.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          Ver anuncio <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </li>
  );
}

/** Pestaña "Novedades" del Boletín Azure: revisión del consultor (solo canEdit) sobre las
 *  candidatas evaluadas por IA + tarjetas por categoría BIT de las ya aprobadas para el cliente. */
export default function NovedadesTab({ clientId, english, canEdit }: {
  clientId: number;
  english: boolean;
  canEdit: boolean;
}) {
  const [view, setView] = useState<NovedadesClienteView | null>(null);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [busyIngest, setBusyIngest] = useState(false);
  const [busyEval, setBusyEval] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const v = await getNovedades(clientId);
      setView(v);
      setDrafts(Object.fromEntries(v.pendientes.map((n) => [n.id, n.por_que ?? ""])));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron cargar las novedades.");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { void reload(); }, [reload]);

  const handleIngest = async () => {
    setBusyIngest(true);
    try {
      const r = await ingestarNovedades();
      toast.success(`Feed de novedades actualizado · ${r.nuevas} nueva(s), ${r.traducidas} traducida(s) de ${r.total_activas} activas.`);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo traer el feed de novedades.");
    } finally {
      setBusyIngest(false);
    }
  };

  const handleEvaluate = async () => {
    setBusyEval(true);
    try {
      const r = await evaluarNovedades(clientId);
      toast.success(`Evaluación completada · ${r.candidatas} candidata(s) de ${r.evaluadas} novedad(es) evaluada(s).`);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo evaluar las novedades para este cliente.");
    } finally {
      setBusyEval(false);
    }
  };

  const decidir = async (n: NovedadCliente, estado: "aprobada" | "rechazada") => {
    setBusyId(n.id);
    try {
      await decidirNovedad(n.id, estado === "aprobada" ? { estado, por_que: drafts[n.id] ?? "" } : { estado });
      toast.success(estado === "aprobada" ? "Novedad aprobada." : "Novedad rechazada.");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar la novedad.");
    } finally {
      setBusyId(null);
    }
  };

  const pendientes = view?.pendientes ?? [];
  const aprobadas = view?.aprobadas ?? [];
  const porCategoria = new Map<NovedadCliente["categoria_bit"], NovedadCliente[]>();
  for (const n of aprobadas) {
    const list = porCategoria.get(n.categoria_bit) ?? [];
    list.push(n);
    porCategoria.set(n.categoria_bit, list);
  }
  const categoriasConDatos = CATEGORIAS.filter((c) => (porCategoria.get(c)?.length ?? 0) > 0);

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="rounded-xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
            <span className="text-sm font-semibold">Pendientes de revisión ({pendientes.length})</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={busyIngest} onClick={() => void handleIngest()}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                {busyIngest ? "Trayendo…" : "Traer novedades"}
              </Button>
              <Button variant="outline" size="sm" disabled={busyEval} onClick={() => void handleEvaluate()}>
                <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                {busyEval ? "Evaluando…" : "Evaluar para este cliente"}
              </Button>
            </div>
          </div>
          {pendientes.length === 0 ? (
            <div className="px-4 py-4 text-sm text-muted-foreground">
              Sin novedades pendientes de revisión para este cliente.
            </div>
          ) : (
            <ul className="divide-y">
              {pendientes.map((n) => (
                <PendienteRow
                  key={n.id}
                  n={n}
                  english={english}
                  draft={drafts[n.id] ?? ""}
                  onDraftChange={(v) => setDrafts((prev) => ({ ...prev, [n.id]: v }))}
                  busy={busyId === n.id}
                  onDecidir={(estado) => void decidir(n, estado)}
                />
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {loading && !view ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">Cargando…</div>
      ) : aprobadas.length === 0 ? (
        <div className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          Sin novedades aprobadas para este cliente.
          {canEdit ? " Trae el feed y evalúa para generar candidatas." : ""}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {categoriasConDatos.map((cat) => {
            const meta = NOVEDAD_CATEGORIA_META[cat];
            const Icon = meta.icon;
            return (
              <div key={cat} className="rounded-xl border bg-card">
                <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {meta.label}
                </div>
                <ul className="divide-y">
                  {(porCategoria.get(cat) ?? []).map((n) => (
                    <AprobadaCard key={n.id} n={n} english={english} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
