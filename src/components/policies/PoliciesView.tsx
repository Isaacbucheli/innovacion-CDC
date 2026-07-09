import { useMemo, useState } from "react";
import { Download, LayoutGrid, Plus, Table2 } from "lucide-react";
import type { Policy } from "@/types";
import { policiesToCsv } from "@/lib/csv";
import SearchInput from "@/components/SearchInput";
import { Button } from "@/components/ui/button";
import Kpis from "@/components/policies/Kpis";
import PolicyCard from "@/components/policies/PolicyCard";
import PoliciesDataTable from "@/components/policies/PoliciesDataTable";

function downloadCsv(csv: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "catalogo-politicas.csv";
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

function filterPolicies(policies: Policy[], q: string): Policy[] {
  const s = q.trim().toLowerCase();
  if (!s) return policies;
  return policies.filter((p) =>
    `${p.name ?? ""} ${p.category ?? ""} ${p.description ?? ""} ${p.objective ?? ""} ${p.recommended_effect ?? ""}`
      .toLowerCase()
      .includes(s));
}

export default function PoliciesView({ policies, canEdit, onOpen, onNew, onEdit, onDelete }: {
  policies: Policy[]; canEdit: boolean;
  onOpen: (p: Policy) => void; onNew: () => void; onEdit: (p: Policy) => void; onDelete: (p: Policy) => void;
}) {
  const [q, setQ] = useState("");
  const [view, setView] = useState<"table" | "cards">("table");
  const rows = useMemo(() => filterPolicies(policies, q), [policies, q]);

  return (
    <div>
      <Kpis policies={policies} />
      <div className="flex gap-2 flex-wrap items-center mb-4">
        <SearchInput
          className="flex-1 min-w-[200px] max-w-sm"
          placeholder="Buscar política…"
          value={q}
          onChange={setQ}
        />
        <span className="text-sm text-muted-foreground ml-auto">{rows.length} de {policies.length}</span>
        <div className="flex rounded-md border overflow-hidden">
          <button
            type="button"
            onClick={() => setView("table")}
            aria-label="Vista tabla"
            className={`px-2.5 py-1.5 inline-flex items-center ${view === "table" ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60"}`}
          >
            <Table2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("cards")}
            aria-label="Vista tarjetas"
            className={`px-2.5 py-1.5 inline-flex items-center border-l ${view === "cards" ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60"}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
        <Button variant="outline" size="sm" onClick={() => downloadCsv(policiesToCsv(rows))}>
          <Download className="w-4 h-4 mr-1" />Exportar CSV
        </Button>
        {canEdit && <Button size="sm" onClick={onNew}><Plus className="w-4 h-4 mr-1" />Nueva política</Button>}
      </div>
      {view === "table" ? (
        <PoliciesDataTable policies={rows} canEdit={canEdit} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} />
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">Sin políticas que coincidan.</p>}
          {rows.map((p) => <PolicyCard key={p.policy_id} policy={p} canEdit={canEdit} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} />)}
        </div>
      )}
    </div>
  );
}
