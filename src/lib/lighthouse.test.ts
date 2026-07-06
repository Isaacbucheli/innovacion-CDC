import { describe, expect, it, vi } from "vitest";
import {
  filterGroups, pollSession, selectedCount, toggleGroup, toggleSubscription,
} from "./lighthouse";
import type { AzureUserSession, LighthouseClientGroup } from "@/types";

const groups: LighthouseClientGroup[] = [
  {
    tenant_id: "t-a", client_name: "SG CONSULTING GROUP",
    subscriptions: [{ subscription_id: "s1", display_name: "Microsoft Azure" }],
  },
  {
    tenant_id: "t-b", client_name: "Banco Delta",
    subscriptions: [
      { subscription_id: "s2", display_name: "PROD" },
      { subscription_id: "s3", display_name: "DEV" },
    ],
  },
];

describe("filterGroups", () => {
  it("filtra por nombre de cliente o de suscripción, case-insensitive", () => {
    expect(filterGroups(groups, "sg consulting")).toHaveLength(1);
    expect(filterGroups(groups, "prod")).toHaveLength(1);
    expect(filterGroups(groups, "prod")[0].client_name).toBe("Banco Delta");
    expect(filterGroups(groups, "")).toHaveLength(2);
    expect(filterGroups(groups, "zzz")).toHaveLength(0);
  });
});

describe("selección", () => {
  it("toggleSubscription agrega y quita", () => {
    let sel = new Set<string>();
    sel = toggleSubscription(sel, "s1");
    expect(sel.has("s1")).toBe(true);
    sel = toggleSubscription(sel, "s1");
    expect(sel.has("s1")).toBe(false);
  });

  it("toggleGroup marca todas; si ya están todas, las desmarca", () => {
    let sel = new Set<string>(["s2"]);
    sel = toggleGroup(sel, groups[1]); // completa el grupo
    expect(selectedCount(sel)).toBe(2);
    sel = toggleGroup(sel, groups[1]); // todas marcadas → desmarca
    expect(selectedCount(sel)).toBe(0);
  });
});

describe("pollSession", () => {
  it("resuelve cuando el status llega a authenticated", async () => {
    vi.useFakeTimers();
    const estados: AzureUserSession[] = [
      { status: "pending_device", user_code: "ABC" },
      { status: "pending_device", user_code: "ABC" },
      { status: "authenticated", azure_upn: "isaac@grupobusiness.it" },
    ];
    let i = 0;
    const fetchStatus = vi.fn(async () => estados[Math.min(i++, estados.length - 1)]);

    const promise = pollSession(fetchStatus, { intervalMs: 1000, maxAttempts: 10 });
    await vi.advanceTimersByTimeAsync(3500);
    const final = await promise;

    expect(final.status).toBe("authenticated");
    vi.useRealTimers();
  });

  it("corta en failed y al agotar intentos lanza", async () => {
    vi.useFakeTimers();
    const failed = vi.fn(async (): Promise<AzureUserSession> => ({ status: "failed", error: "boom" }));
    const p1 = pollSession(failed, { intervalMs: 100, maxAttempts: 5 });
    await vi.advanceTimersByTimeAsync(200);
    expect((await p1).status).toBe("failed");

    const pending = vi.fn(async (): Promise<AzureUserSession> => ({ status: "pending_device" }));
    const p2 = pollSession(pending, { intervalMs: 100, maxAttempts: 3 }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await p2).toBeInstanceOf(Error);
    vi.useRealTimers();
  });
});
