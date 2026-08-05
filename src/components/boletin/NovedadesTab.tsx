import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import NovedadesTriage from "@/components/boletin/NovedadesTriage";
import { getNovedades, ingestarNovedades, evaluarNovedades, decidirNovedad } from "@/lib/api";
import { fmtDate as fmtDateQuito } from "@/lib/dates";
import {
  fmtDate, novedadDescripcion, novedadTitle, NOVEDAD_CATEGORIA_META,
  NOVEDAD_ESTADO_PILL_LABEL, NOVEDAD_ESTADO_PILL_CLASS, resolveNovedadIcon,
} from "@/components/boletin/boletinMeta";
import type { NovedadCliente, NovedadesClienteView } from "@/types";

const CATEGORIAS = Object.keys(NOVEDAD_CATEGORIA_META) as NovedadCliente["categoria_bit"][];
const MS_DIA = 24 * 60 * 60 * 1000;
const DIAS_ESTA_SEMANA = 7;

/** `published_at` es un timestamp real (pubDate del RSS, con hora + "Z"), a diferencia de
 *  `retirement_date`/`end_of_support` que el backend ya manda como "yyyy-MM-dd". El `fmtDate` de
 *  este módulo espera fecha pura: nos quedamos solo con la parte de fecha (día calendario del
 *  anuncio) en vez de la hora exacta, que no aporta nada en esta vista. */
function publishedDate(n: NovedadCliente): string {
  return fmtDate(n.published_at.slice(0, 10));
}

/** `decidido_at` es la marca de una ACCIÓN del consultor (no una fecha del feed): se muestra como
 *  día de Quito vía lib/dates — cortar el día UTC mostraría "mañana" para decisiones tomadas
 *  después de las ~19:00 locales (regla dura de fechas del proyecto; review final E5). */
function decididoDate(n: NovedadCliente): string | null {
  return n.decidido_at ? fmtDateQuito(n.decidido_at) : null;
}

/** Días completos transcurridos entre `iso` y `ahora` (null si `iso` es null o inválido). */
function diasDesde(iso: string | null, ahora: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((ahora.getTime() - t) / MS_DIA);
}

/** Etiqueta relativa en español para un timestamp ISO ("nunca" si es null). Usada tanto para
 *  "Última evaluación" como para el subtítulo "feed actualizado <relativo>". */
function relativoDesde(iso: string | null, ahora: Date): string {
  const dias = diasDesde(iso, ahora);
  if (dias === null) return "nunca";
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < DIAS_ESTA_SEMANA) return `hace ${dias} días`;
  if (dias < 30) {
    const semanas = Math.floor(dias / 7);
    return `hace ${semanas} semana${semanas === 1 ? "" : "s"}`;
  }
  if (dias < 365) {
    const meses = Math.floor(dias / 30);
    return `hace ${meses} mes${meses === 1 ? "" : "es"}`;
  }
  const anios = Math.floor(dias / 365);
  return `hace ${anios} año${anios === 1 ? "" : "s"}`;
}

function AprobadaCard({ n, english, canEdit, busy, onQuitar }: {
  n: NovedadCliente; english: boolean; canEdit: boolean; busy: boolean; onQuitar: () => void;
}) {
  const icon = resolveNovedadIcon(n);
  const pillLabel = NOVEDAD_ESTADO_PILL_LABEL[n.estado_feed];
  const pillClass = NOVEDAD_ESTADO_PILL_CLASS[n.estado_feed];
  return (
    <li className="flex gap-3 px-4 py-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
        {"src" in icon
          ? <img src={icon.src} alt="" className="h-4 w-4" />
          : <icon.Icon className="h-4 w-4 text-muted-foreground" />}
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium">{novedadTitle(n, english)}</span>
          {pillLabel ? (
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${pillClass}`}>
              {pillLabel}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{novedadDescripcion(n, english)}</p>
        <p className="rounded-md bg-muted/50 px-2.5 py-1.5 text-xs font-medium text-foreground">{n.por_que}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="tabular-nums">{publishedDate(n)}</span>
          <span className="flex items-center gap-3">
            <a
              href={n.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Ver anuncio <ExternalLink className="h-3 w-3" />
            </a>
            {canEdit ? (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-muted-foreground"
                disabled={busy}
                onClick={onQuitar}
              >
                Quitar
              </Button>
            ) : null}
          </span>
        </div>
      </div>
    </li>
  );
}

/** Fila compacta de una novedad rechazada: título, categoría, fecha/autor de la decisión (cuando
 *  existen) y "Restaurar" para volver a pendiente sin tocar el `por_que` ya guardado por la IA. */
function RechazadaRow({ n, english, busy, onRestaurar }: {
  n: NovedadCliente; english: boolean; busy: boolean; onRestaurar: () => void;
}) {
  const fecha = decididoDate(n);
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{novedadTitle(n, english)}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span>{NOVEDAD_CATEGORIA_META[n.categoria_bit].label}</span>
          {fecha ? <span>{fecha}</span> : null}
          {n.decidido_por ? <span>{n.decidido_por}</span> : null}
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onRestaurar}>
        Restaurar
      </Button>
    </li>
  );
}

function ResumenKpi({ label, value, sub, valueClassName }: {
  label: string; value: string; sub: string; valueClassName?: string;
}) {
  return (
    <div className="px-4 py-3">
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-2xl font-bold tabular-nums ${valueClassName ?? ""}`}>{value}</div>
      <div className="text-[11.5px] text-muted-foreground">{sub}</div>
    </div>
  );
}

/** Pestaña "Novedades" del Boletín Azure: franja de resumen (KPIs) + tabla compacta de triage
 *  (solo canEdit) sobre las candidatas evaluadas por IA + tarjetas por categoría BIT de las ya
 *  aprobadas para el cliente. */
export default function NovedadesTab({ clientId, english, canEdit }: {
  clientId: number;
  english: boolean;
  canEdit: boolean;
}) {
  const [view, setView] = useState<NovedadesClienteView | null>(null);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [busyActualizar, setBusyActualizar] = useState<null | "ingest" | "eval">(null);
  const [rechazadasOpen, setRechazadasOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      // La franja de Rechazadas solo existe para canEdit: la vista de solo lectura no necesita
      // esos datos, así que ni se piden (el backend acepta el flag, pero no hay motivo para
      // pagar esa consulta extra si nadie la va a ver).
      const v = canEdit
        ? await getNovedades(clientId, { includeRechazadas: true })
        : await getNovedades(clientId);
      setView(v);
      // Merge, NO reemplazo: aprobar/rechazar UNA fila (o traer/evaluar) recarga la lista, y un
      // reemplazo total revertía en silencio los por_que editados y aún sin guardar de las DEMÁS
      // filas al texto de la IA. El draft vigente gana; filas nuevas arrancan con el texto del
      // servidor; filas que ya no están pendientes se descartan (los id son únicos entre clientes,
      // así que el cambio de cliente no arrastra drafts ajenos).
      setDrafts((prev) => Object.fromEntries(v.pendientes.map((n) => [n.id, prev[n.id] ?? n.por_que ?? ""])));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron cargar las novedades.");
    } finally {
      setLoading(false);
    }
  }, [clientId, canEdit]);

  useEffect(() => { void reload(); }, [reload]);

  const handleActualizar = async () => {
    setBusyActualizar("ingest");
    let ingestResult;
    try {
      ingestResult = await ingestarNovedades();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo traer el feed de novedades.");
      setBusyActualizar(null);
      return;
    }

    setBusyActualizar("eval");
    try {
      const evalResult = await evaluarNovedades(clientId);
      toast.success(
        `Novedades actualizadas · ${ingestResult.nuevas} nueva(s) del feed, `
        + `${evalResult.candidatas} candidata(s) de ${evalResult.evaluadas} evaluada(s) para este cliente.`,
      );
      await reload();
    } catch (e) {
      const detalle = e instanceof Error ? e.message : "No se pudo evaluar las novedades para este cliente.";
      toast.error(`El feed se actualizó, pero la evaluación falló: ${detalle}`);
    } finally {
      setBusyActualizar(null);
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

  const handleBulkReject = async (ids: number[]) => {
    let ok = 0;
    for (const id of ids) {
      try {
        await decidirNovedad(id, { estado: "rechazada" });
        ok += 1;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : `No se pudo rechazar la novedad ${id}.`);
      }
    }
    if (ok > 0) toast.success(`${ok} novedad(es) rechazada(s).`);
    await reload();
  };

  // Restaurar (desde Rechazadas) y Quitar (desde una tarjeta aprobada) hacen lo mismo en el
  // backend: PUT estado=pendiente SIN por_que, así se preserva el texto ya generado por la IA
  // (o editado por un consultor) en vez de perderlo al volver a revisión.
  const restaurar = async (id: number) => {
    setBusyId(id);
    try {
      await decidirNovedad(id, { estado: "pendiente" });
      toast.success("La novedad vuelve a pendientes de revisión.");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo restaurar la novedad.");
    } finally {
      setBusyId(null);
    }
  };

  const quitar = async (id: number) => {
    if (!window.confirm("¿Quitar esta novedad de las aprobadas? Vuelve a pendientes de revisión.")) return;
    await restaurar(id);
  };

  const pendientes = view?.pendientes ?? [];
  const rechazadas = view?.rechazadas ?? [];
  const aprobadas = view?.aprobadas ?? [];
  const porCategoria = new Map<NovedadCliente["categoria_bit"], NovedadCliente[]>();
  for (const n of aprobadas) {
    const list = porCategoria.get(n.categoria_bit) ?? [];
    list.push(n);
    porCategoria.set(n.categoria_bit, list);
  }
  const categoriasConDatos = CATEGORIAS.filter((c) => (porCategoria.get(c)?.length ?? 0) > 0);

  const ahora = new Date();
  const nuevosEstaSemana = pendientes.filter((n) => {
    const dias = diasDesde(n.published_at, ahora);
    return dias !== null && dias >= 0 && dias <= DIAS_ESTA_SEMANA;
  }).length;
  const rechazadasCount = rechazadas.length;
  const ultimaEvaluacionLabel = relativoDesde(view?.ultima_evaluacion ?? null, ahora);
  const feedActualizadoLabel = relativoDesde(view?.feed_actualizado ?? null, ahora);

  return (
    <div className="space-y-4">
      <div className="flex flex-col rounded-xl border bg-card sm:flex-row sm:items-stretch">
        <div className="grid flex-1 grid-cols-2 divide-y divide-border sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          <ResumenKpi
            label="Pendientes de revisión"
            value={String(pendientes.length)}
            sub={`${nuevosEstaSemana} llegaron esta semana`}
            valueClassName="text-amber-700 dark:text-amber-400"
          />
          <ResumenKpi
            label="Aprobadas visibles"
            value={String(aprobadas.length)}
            sub={`en ${categoriasConDatos.length} categoría${categoriasConDatos.length === 1 ? "" : "s"}`}
          />
          <ResumenKpi label="Rechazadas" value={String(rechazadasCount)} sub="recuperables" />
          <ResumenKpi
            label="Última evaluación"
            value={ultimaEvaluacionLabel}
            sub={`feed actualizado ${feedActualizadoLabel}`}
          />
        </div>
        {canEdit ? (
          <div className="flex flex-col justify-center gap-1 border-t px-4 py-3 sm:border-l sm:border-t-0">
            <Button size="sm" disabled={busyActualizar !== null} onClick={() => void handleActualizar()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              {busyActualizar === "ingest" ? "Trayendo feed…" : busyActualizar === "eval" ? "Evaluando…" : "Actualizar novedades"}
            </Button>
            <span className="text-[11px] text-muted-foreground">Trae el feed y evalúa para este cliente en un paso</span>
          </div>
        ) : null}
      </div>

      {canEdit ? (
        <NovedadesTriage
          pendientes={pendientes}
          english={english}
          drafts={drafts}
          onDraftChange={(id, v) => setDrafts((prev) => ({ ...prev, [id]: v }))}
          busyId={busyId}
          onDecidir={(n, estado) => void decidir(n, estado)}
          onBulkReject={handleBulkReject}
        />
      ) : null}

      {canEdit ? (
        <div className="rounded-xl border bg-card">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold"
            onClick={() => setRechazadasOpen((v) => !v)}
          >
            {rechazadasOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <span>{`Rechazadas (${rechazadasCount})`}</span>
            <span className="ml-auto text-xs font-normal text-muted-foreground">se pueden restaurar a pendiente</span>
          </button>
          {rechazadasOpen ? (
            rechazadas.length === 0 ? (
              <div className="border-t px-4 py-3 text-sm text-muted-foreground">Sin novedades rechazadas.</div>
            ) : (
              <ul className="divide-y border-t">
                {rechazadas.map((n) => (
                  <RechazadaRow
                    key={n.id}
                    n={n}
                    english={english}
                    busy={busyId === n.id}
                    onRestaurar={() => void restaurar(n.id)}
                  />
                ))}
              </ul>
            )
          ) : null}
        </div>
      ) : null}

      {loading && !view ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">Cargando…</div>
      ) : aprobadas.length === 0 ? (
        <div className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          Sin novedades aprobadas para este cliente.
          {canEdit
            ? (pendientes.length > 0
              ? ` Hay ${pendientes.length} novedades pendientes de revisión arriba.`
              : " Trae el feed y evalúa para generar candidatas.")
            : ""}
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
                    <AprobadaCard
                      key={n.id}
                      n={n}
                      english={english}
                      canEdit={canEdit}
                      busy={busyId === n.id}
                      onQuitar={() => void quitar(n.id)}
                    />
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
