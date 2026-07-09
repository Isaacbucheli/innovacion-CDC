import type { Policy } from "@/types";
import { normalizeEffect } from "@/lib/effect";
import { useCountUp } from "@/lib/useCountUp";

function Stat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  const n = useCountUp(value);
  return (
    <div className="rounded-lg bg-background border p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${danger ? "text-destructive" : ""}`}>{n}</div>
    </div>
  );
}

export default function Kpis({ policies }: { policies: Policy[] }) {
  const deny = policies.filter((p) => normalizeEffect(p.recommended_effect) === "deny").length;
  const categories = new Set(policies.map((p) => p.category).filter(Boolean)).size;
  const builtIn = policies.filter((p) => (p.policy_type ?? "").toLowerCase().includes("built-in")).length;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      <Stat label="Total políticas" value={policies.length} />
      <Stat label="Deny recomendado" value={deny} danger />
      <Stat label="Categorías" value={categories} />
      <Stat label="Built-in" value={builtIn} />
    </div>
  );
}
