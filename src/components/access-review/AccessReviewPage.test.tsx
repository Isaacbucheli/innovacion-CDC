import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { beforeEach, expect, test, vi } from "vitest";
import type { AccessAssignment, AccessReviewResponse, ClientAdmin } from "@/types";

const clients: ClientAdmin[] = [{
  client_id: 4, client_name: "BANCO DELTA", tax_id: null, contact_name: null,
  contact_email: null, is_active: true, created_at: null, has_logo: false,
}];

const A = (over: Partial<AccessAssignment>): AccessAssignment => ({
  subscription_id: "s1", subscription_name: "Sub Uno", scope: "/subscriptions/s1",
  scope_level: "subscription", role_name: "Reader", principal_object_id: "u1",
  principal_type: "User", display_name: "Ana", login: "ana@x.com", user_type: "Member",
  via_group_id: null, via_group_name: null, account_enabled: true,
  last_sign_in: "2026-07-20T10:00:00Z", mfa_status: "enabled", ...over,
});

const baseResp: AccessReviewResponse = {
  status: "ok", run_id: 7, started_at: null, finished_at: "2026-07-24T17:07:00Z",
  inactivity_days: 90,
  kpis: {
    total_asignaciones: 3, global_admins: 0, global_admins_sin_mfa: 0, internos_sin_mfa: 0,
    cuentas_deshabilitadas: 0, cuentas_inactivas: 0, guests_total: 0, guests_inactivos: 0,
    guests_inactivos_con_permisos: 0, service_principals: 0,
  },
  credentials: [{ credential_id: 1, credential_name: "cred", arm_status: "ok", graph_status: "ok", detail: null }],
  assignments: [
    A({}),
    // Huérfana: grupo borrado de Entra ID → sin display_name con Graph completo.
    A({ principal_object_id: "22222222-2222-2222-2222-222222222222", principal_type: "Group", display_name: null, login: null, user_type: null, account_enabled: null, last_sign_in: null, mfa_status: null }),
    A({ principal_object_id: "g-vivo", principal_type: "Group", display_name: "Grupo Vivo", login: null, user_type: null, account_enabled: null, last_sign_in: null, mfa_status: null }),
  ],
  guests: [], global_admins: [],
};

let resp: AccessReviewResponse;

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listClientsAdmin: () => Promise.resolve(clients),
  getAccessReview: () => Promise.resolve(resp),
  listAccessReviewRuns: () => Promise.resolve([]),
  syncAccessReview: vi.fn(),
  downloadFromApi: vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  resp = structuredClone(baseResp);
});

async function renderPage() {
  const { default: AccessReviewPage } = await import("@/components/access-review/AccessReviewPage");
  return render(
    <ThemeProvider attribute="class">
      <AccessReviewPage />
    </ThemeProvider>,
  );
}

test("marca como 'Eliminado de Entra ID' solo la asignación huérfana con Graph completo", async () => {
  await renderPage();
  const chips = await screen.findAllByText("Eliminado de Entra ID");
  expect(chips).toHaveLength(1);
  // La huérfana muestra su GUID pelado; el grupo resuelto no lleva chip.
  expect(screen.getByText("22222222-2222-2222-2222-222222222222")).toBeInTheDocument();
  expect(screen.getByText("Grupo Vivo")).toBeInTheDocument();
});

test("con Graph incompleto no afirma 'eliminado' (nombre vacío = no resuelto)", async () => {
  resp.status = "partial";
  resp.credentials = [{ credential_id: 1, credential_name: "cred", arm_status: "ok", graph_status: "sin_consent", detail: null }];
  await renderPage();
  await screen.findByText("22222222-2222-2222-2222-222222222222");
  expect(screen.queryByText("Eliminado de Entra ID")).toBeNull();
});
