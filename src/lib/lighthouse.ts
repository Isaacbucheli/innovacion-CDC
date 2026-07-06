import type { AzureUserSession, LighthouseClientGroup } from "@/types";

/** Polling del estado de la sesión hasta authenticated/failed/expired (o agotar intentos). */
export async function pollSession(
  fetchStatus: () => Promise<AzureUserSession>,
  opts: { intervalMs?: number; maxAttempts?: number } = {},
): Promise<AzureUserSession> {
  const intervalMs = opts.intervalMs ?? 3000;
  const maxAttempts = opts.maxAttempts ?? 320; // ~16 min a 3s
  for (let i = 0; i < maxAttempts; i++) {
    const s = await fetchStatus();
    if (s.status === "authenticated" || s.status === "failed" || s.status === "expired") return s;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Tiempo de espera agotado esperando la autenticación");
}

/** Filtra grupos por nombre de cliente o de suscripción (case-insensitive). */
export function filterGroups(groups: LighthouseClientGroup[], term: string): LighthouseClientGroup[] {
  const t = term.trim().toLowerCase();
  if (!t) return groups;
  return groups.filter(
    (g) =>
      g.client_name.toLowerCase().includes(t) ||
      g.subscriptions.some((s) => (s.display_name ?? s.subscription_id).toLowerCase().includes(t)),
  );
}

/** Alterna una suscripción en la selección (inmutable). */
export function toggleSubscription(sel: Set<string>, subId: string): Set<string> {
  const next = new Set(sel);
  if (next.has(subId)) next.delete(subId);
  else next.add(subId);
  return next;
}

/** Marca todas las subs del grupo; si ya estaban todas, las desmarca. */
export function toggleGroup(sel: Set<string>, group: LighthouseClientGroup): Set<string> {
  const ids = group.subscriptions.map((s) => s.subscription_id);
  const allSelected = ids.every((id) => sel.has(id));
  const next = new Set(sel);
  for (const id of ids) (allSelected ? next.delete(id) : next.add(id));
  return next;
}

export function selectedCount(sel: Set<string>): number {
  return sel.size;
}
