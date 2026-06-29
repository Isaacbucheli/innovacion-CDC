import { useEffect, useState } from "react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import BusyOverlay from "@/components/BusyOverlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CanonicalEditDialog from "@/components/waf/CanonicalEditDialog";
import { getWafAiConfig, getWafCatalog, analyzeAllWafCanonicals } from "@/lib/api";
import { reviewStatusMeta, filterCatalog } from "@/lib/waf";
import { getRole } from "@/lib/auth";
import type { WafAiConfig, WafCanonical } from "@/types";

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

export default function ValidationPage({ onNavigate }: { onNavigate?: (key: string) => void }) {
  const isAdmin = getRole() === "admin";
  const [config, setConfig] = useState<WafAiConfig | null>(null);
  const [rows, setRows] = useState<WafCanonical[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [excludedFilter, setExcludedFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busyMsg, setBusyMsg] = useState("");
  const [editing, setEditing] = useState<WafCanonical | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  function load() {
    setLoading(true);
    const params: { review_status?: string; excluded?: boolean } = {};
    if (statusFilter !== "all") params.review_status = statusFilter;
    if (excludedFilter !== "all") params.excluded = excludedFilter === "excluded";
    getWafCatalog(params).then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }
  useEffect(() => { if (isAdmin) getWafAiConfig().then(setConfig).catch(() => setConfig(null)); }, [isAdmin]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (isAdmin) load(); }, [statusFilter, excludedFilter, isAdmin]);

  async function runBatch() {
    // Lotes PEQUEÑOS por petición: cada análisis llama a Azure OpenAI (varios seg.);
    // un lote grande (50) excede el timeout ~230s de App Service → 502/"Failed to fetch".
    // Con limit bajo cada request termina rápido y el front itera hasta drenar (tope alto anti-loop).
    let applied = 0;
    setBusyMsg("Analizando y aplicando pendientes…");
    try {
      for (let i = 0; i < 100; i++) {
        const r = await analyzeAllWafCanonicals({ limit: 10, apply: true });
        applied += r.applied;
        setBusyMsg(`Analizando y aplicando pendientes… (${applied} aplicadas)`);
        if (r.total === 0 || r.processed === 0) break;
      }
      toast.success(`Curación IA: ${applied} aplicada${applied === 1 ? "" : "s"}`);
      load();
    } catch (e) { toast.error(`Error en la curación: ${msg(e)}`); }
    finally { setBusyMsg(""); }
  }

  function openEditor(c: WafCanonical) { setEditing(c); setDialogOpen(true); }

  if (!isAdmin) {
    return (
      <AppShell title="Validación inteligente" subtitle="Matriz mejoras Azure" active="waf-validation" onNavigate={onNavigate}>
        <p className="text-sm text-muted-foreground">Esta sección es solo para administradores.</p>
      </AppShell>
    );
  }

  const filtered = filterCatalog(rows, q);
  return (
    <AppShell title="Validación inteligente" subtitle="Matriz mejoras Azure · curación IA del catálogo"
      active="waf-validation" onNavigate={onNavigate}
      headerRight={<Button size="sm" disabled={!!busyMsg} onClick={runBatch}>Analizar y aplicar pendientes</Button>}>
      <BusyOverlay show={loading || !!busyMsg} title={busyMsg || "Cargando catálogo"} />
      <div className="space-y-5">
        <div className="rounded-xl bg-secondary p-4 text-sm flex flex-wrap gap-x-6 gap-y-1">
          <span className="text-muted-foreground">Azure OpenAI: <span className={config?.configured ? "text-[#5a7016] dark:text-[#a9c46a]" : "text-destructive"}>{config?.configured ? "configurado" : "no configurado"}</span></span>
          {config?.deployment && <span className="text-muted-foreground">Deployment: <span className="text-foreground">{config.deployment}</span></span>}
          {config?.api_version && <span className="text-muted-foreground">API: <span className="text-foreground">{config.api_version}</span></span>}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} className="w-[220px]" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="reviewed">Revisada</SelectItem>
              <SelectItem value="applied">Aplicada</SelectItem>
              <SelectItem value="requires_review">Requiere revisión</SelectItem>
              <SelectItem value="excluded">Excluida</SelectItem>
            </SelectContent>
          </Select>
          <Select value={excludedFilter} onValueChange={setExcludedFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Activas + excluidas</SelectItem>
              <SelectItem value="active">Solo activas</SelectItem>
              <SelectItem value="excluded">Solo excluidas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader><TableRow>
              <TableHead>ID</TableHead><TableHead>Nombre Advisor</TableHead><TableHead>Categoría</TableHead>
              <TableHead>Pilar</TableHead><TableHead>Estado</TableHead><TableHead>Costo</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin canónicas.</TableCell></TableRow>
              ) : filtered.map((c) => {
                const m = reviewStatusMeta(c.ai_review_status);
                return (
                  <TableRow key={c.canonical_id}>
                    <TableCell className="tabular-nums">{c.canonical_id}</TableCell>
                    <TableCell className="max-w-[260px] truncate">{c.advisor_name}{c.is_excluded && <span className="ml-2 text-[11px] text-red-600 dark:text-red-400">excluida</span>}</TableCell>
                    <TableCell className="text-muted-foreground">{c.advisor_category}</TableCell>
                    <TableCell className="tabular-nums">{c.pillar_number}</TableCell>
                    <TableCell><span className={`text-xs px-2.5 py-0.5 rounded-full ${m.chip}`}>{m.label}</span></TableCell>
                    <TableCell>{c.ai_possible_additional_cost ? <span className="text-[11px] text-amber-600 dark:text-amber-400">posible</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => openEditor(c)}>Revisar</Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
      <CanonicalEditDialog open={dialogOpen} canonical={editing} onOpenChange={setDialogOpen} onSaved={load} />
    </AppShell>
  );
}
