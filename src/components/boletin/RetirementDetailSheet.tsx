import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import SearchInput from "@/components/SearchInput";
import { URGENCY_META, SOURCE_LABEL, fmtDate, htmlToText } from "@/components/boletin/boletinMeta";
import type { BoletinGroup, BoletinSubscription } from "@/types";

function UrgencyPill({ urgency }: { urgency: BoletinGroup["urgency"] }) {
  const m = URGENCY_META[urgency];
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${m.cls}`}>{m.label}</span>;
}

/** A partir de cuántos recursos aparece el filtro local de la lista. */
const FILTER_THRESHOLD = 15;

export default function RetirementDetailSheet({ group, subscriptions, open, onOpenChange }: {
  group: BoletinGroup | null;
  /** view.subscriptions (BoletinPage): id -> nombre visible, para no mostrar el GUID crudo. */
  subscriptions?: BoletinSubscription[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [q, setQ] = useState("");

  // Lookup id -> nombre. Si una suscripción no está en la lista (p.ej. dejó de administrarse),
  // cae al propio GUID: nunca se deja la celda/lista en blanco.
  const subscriptionName = useMemo(() => {
    const byId = new Map((subscriptions ?? []).map((s) => [s.subscription_id, s.name]));
    return (id: string) => byId.get(id) ?? id;
  }, [subscriptions]);

  const resources = group?.resources ?? [];
  const needle = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    const list = group?.resources ?? [];
    if (needle === "") return list;
    return list.filter((r) =>
      r.resource_name.toLowerCase().includes(needle) ||
      r.resource_type.toLowerCase().includes(needle) ||
      (r.resource_id ?? "").toLowerCase().includes(needle));
  }, [group, needle]);

  const summaryText = htmlToText(group?.summary ?? null);

  return (
    <Sheet open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setQ(""); }}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        {group && (
          <>
            <SheetHeader>
              <SheetTitle>{group.retiring_feature || group.title}</SheetTitle>
            </SheetHeader>

            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <UrgencyPill urgency={group.urgency} />
                <span className="text-muted-foreground">Fecha límite: {fmtDate(group.retirement_date)}</span>
                <span className="rounded-full bg-secondary px-2.5 py-0.5 font-medium text-muted-foreground">
                  {SOURCE_LABEL[group.source]}
                </span>
              </div>

              {group.retiring_feature && group.title !== group.retiring_feature ? (
                <div className="text-sm text-muted-foreground">{group.title}</div>
              ) : null}

              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-primary">Acción recomendada</div>
                <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {group.recommended_action || "Sin acción recomendada registrada."}
                </div>
                {group.learn_more_url ? (
                  <a
                    href={group.learn_more_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    Más información <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>

              {summaryText ? (
                <div>
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-primary">Resumen del aviso</div>
                  <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
                    {summaryText}
                  </div>
                </div>
              ) : null}

              <div className="border-t pt-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-primary">
                    {resources.length > 0
                      ? `${resources.length} recurso${resources.length === 1 ? "" : "s"} impactado${resources.length === 1 ? "" : "s"}`
                      : "Recursos impactados"}
                  </div>
                  {resources.length > FILTER_THRESHOLD ? (
                    <SearchInput
                      value={q}
                      onChange={setQ}
                      placeholder="Filtrar por nombre, tipo o ID…"
                      aria-label="Filtrar recursos impactados"
                      className="w-64"
                    />
                  ) : null}
                </div>

                {resources.length === 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Aviso a nivel de suscripción — sin detalle de recursos.
                    </p>
                    {group.subscription_ids.length > 0 ? (
                      <ul className="space-y-1">
                        {group.subscription_ids.map((sid) => (
                          <li key={sid} className="truncate text-xs text-muted-foreground" title={sid}>
                            {subscriptionName(sid)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ningún recurso coincide con el filtro.</p>
                ) : (
                  <div className="max-h-96 overflow-y-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/60">
                        <tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                          <th className="px-3 py-2 font-semibold">Recurso</th>
                          <th className="px-3 py-2 font-semibold">Tipo</th>
                          <th className="px-3 py-2 font-semibold">Suscripción</th>
                          <th className="px-3 py-2 font-semibold">ID del recurso</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((r) => (
                          <tr key={r.fingerprint} className="border-b last:border-b-0 align-top">
                            <td className="max-w-48 truncate px-3 py-2 font-medium" title={r.resource_name}>
                              {r.resource_name}
                            </td>
                            <td className="max-w-32 truncate px-3 py-2 text-xs text-muted-foreground" title={r.resource_type}>
                              {r.resource_type}
                            </td>
                            <td className="max-w-32 truncate px-3 py-2 text-xs text-muted-foreground" title={r.subscription_id}>
                              {subscriptionName(r.subscription_id)}
                            </td>
                            <td className="max-w-64 truncate px-3 py-2 font-mono text-xs text-muted-foreground" title={r.resource_id ?? undefined}>
                              {r.resource_id ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
