import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { beforeEach, expect, test, vi } from "vitest";
import type { AccessAccount, AccessAssignment, AccessReviewResponse, ClientAdmin } from "@/types";

const clients: ClientAdmin[] = [{
  client_id: 4, client_name: "Cliente Demo", tax_id: null, contact_name: null,
  contact_email: null, is_active: true, created_at: null, has_logo: false,
}];

const A = (over: Partial<AccessAssignment>): AccessAssignment => ({
  subscription_id: "s1", subscription_name: "Sub Uno", scope: "/subscriptions/s1",
  scope_level: "subscription", role_name: "Reader", role_definition_id: "def-1",
  role_class: "lectura", is_custom_role: false, is_elevated: false, is_external: false,
  principal_object_id: "u1",
  principal_type: "User", display_name: "Ana", login: "ana@x.com", user_type: "Member",
  via_group_id: null, via_group_name: null, account_enabled: true,
  last_sign_in: "2026-07-20T10:00:00Z", mfa_status: "enabled", ...over,
});

const C = (over: Partial<AccessAccount>): AccessAccount => ({
  principal_object_id: "u1", principal_type: "User", display_name: "Ana", login: "ana@x.com",
  user_type: "Member", is_external: false, total_assignments: 1, owner: 0, otorga_accesos: 0,
  escritura_total: 0, escritura_servicio: 0, lectura: 1, sin_clasificar: 0, subscriptions: 1,
  broadest_scope_level: "subscription", via: "directo", account_enabled: true,
  last_sign_in: "2026-07-20T10:00:00Z", mfa_status: "enabled", orphan: false, ...over,
});

const baseResp: AccessReviewResponse = {
  status: "ok", run_id: 7, started_at: null, finished_at: "2026-07-24T17:07:00Z",
  inactivity_days: 90, graph_complete: true,
  kpis: {
    total_asignaciones: 3, global_admins: 0, global_admins_sin_mfa: 0, internos_sin_mfa: 0,
    cuentas_deshabilitadas: 0, cuentas_inactivas: 0, guests_total: 0, guests_inactivos: 0,
    guests_inactivos_con_permisos: 0, service_principals: 0,
    cuentas_unicas: 3, asignaciones_elevadas: 0, pct_elevadas: 0, owners: 0,
    cuentas_externas: 0, owners_externos: 0, roles_personalizados: 0,
  },
  credentials: [{ credential_id: 1, credential_name: "cred", arm_status: "ok", graph_status: "ok", detail: null }],
  accounts: [
    C({}),
    C({ principal_object_id: "22222222-2222-2222-2222-222222222222", principal_type: "Group", display_name: null, login: null, user_type: null, orphan: true }),
    C({ principal_object_id: "g-vivo", principal_type: "Group", display_name: "Grupo Vivo", login: null, user_type: null }),
  ],
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

/** Cambia de pestaña. Radix desmonta el contenido inactivo, y su trigger reacciona a mouseDown
 *  (no a click), así que un fireEvent.click no cambia de pestaña. */
async function openTab(name: RegExp) {
  fireEvent.mouseDown(await screen.findByRole("tab", { name }));
}

test("la vista por defecto es Cuentas, no Asignaciones", async () => {
  await renderPage();
  // "Accesos" es la columna de la tabla de cuentas; "Vía grupo" solo existe en Asignaciones.
  expect(await screen.findByText("Accesos")).toBeInTheDocument();
  expect(screen.queryByText("Vía grupo")).toBeNull();
});

test("marca como 'Eliminado de Entra ID' solo la cuenta huérfana con Graph completo", async () => {
  await renderPage();
  const chips = await screen.findAllByText("Eliminado de Entra ID");
  expect(chips).toHaveLength(1);
  // La huérfana muestra su GUID pelado; el grupo resuelto no lleva chip.
  expect(screen.getByText("22222222-2222-2222-2222-222222222222")).toBeInTheDocument();
  expect(screen.getByText("Grupo Vivo")).toBeInTheDocument();
});

test("con Graph incompleto no afirma 'eliminado' (nombre vacío = no resuelto)", async () => {
  resp.status = "partial";
  resp.graph_complete = false;
  resp.credentials = [{ credential_id: 1, credential_name: "cred", arm_status: "ok", graph_status: "sin_consent", detail: null }];
  // Con Graph incompleto el backend no marca huérfanas ni resuelve el eje de origen.
  resp.accounts = resp.accounts!.map((a) => ({ ...a, orphan: false, is_external: null }));
  await renderPage();
  await screen.findByText("22222222-2222-2222-2222-222222222222");
  expect(screen.queryByText("Eliminado de Entra ID")).toBeNull();
});

test("un ForeignGroup sin nombre no se marca como eliminado de Entra ID", async () => {
  // Vive en el tenant de otro: no tener nombre es lo esperado, no un acceso residual.
  resp.accounts = [C({
    principal_object_id: "fg-1", principal_type: "ForeignGroup", display_name: null, login: null,
    user_type: null, is_external: true, orphan: false,
  })];
  resp.assignments = [A({
    principal_object_id: "fg-1", principal_type: "ForeignGroup", display_name: null, login: null,
    user_type: null, is_external: true, role_class: "owner", is_elevated: true,
    account_enabled: null, last_sign_in: null, mfa_status: null,
  })];
  await renderPage();
  await screen.findByText("fg-1");
  expect(screen.queryByText("Eliminado de Entra ID")).toBeNull();
  expect(screen.getByText("Grupo externo (otro tenant)")).toBeInTheDocument();
  expect(screen.getByText("Externa")).toBeInTheDocument();
});

test("los contadores de privilegio siguen medidos sin Graph, los de origen no", async () => {
  resp.graph_complete = false;
  resp.credentials = [{ credential_id: 1, credential_name: "cred", arm_status: "ok", graph_status: "no_aplica", detail: null }];
  resp.kpis = { ...resp.kpis!, pct_elevadas: 40, owners: 2, cuentas_externas: 0 };
  await renderPage();

  // El eje de privilegio solo depende de ARM: se muestra con valor real.
  expect(await screen.findByText("40%")).toBeInTheDocument();
  // Los dos contadores de origen (Externas y Externas con Owner) comparten el motivo de "no medido".
  const externas = screen.getAllByTitle(/el origen interna\/externa sale del UPN/i);
  expect(externas).toHaveLength(2);
  for (const c of externas) expect(c).toHaveTextContent("n/d");
});

test("avisa cuando la corrida es anterior a la clasificación de privilegio", async () => {
  resp.assignments = resp.assignments!.map((a) => ({ ...a, role_class: null, is_elevated: false }));
  await renderPage();
  expect(await screen.findByText(/anterior a la clasificación de privilegio/i)).toBeInTheDocument();
});

test("expandir una cuenta lista sus asignaciones", async () => {
  await renderPage();
  fireEvent.click((await screen.findAllByRole("button", { name: "Ver asignaciones" }))[0]);
  expect(await screen.findByText("Asignaciones de esta cuenta")).toBeInTheDocument();
});

test("en Asignaciones, un ForeignGroup sin nombre tampoco se marca como eliminado", async () => {
  // Guardián de la regla del front (isOrphanAssignment): solo los tipos que viven en el directorio
  // del cliente pueden estar "eliminados". Antes, cualquier fila sin nombre se marcaba.
  resp.assignments = [
    A({ principal_object_id: "fg-1", principal_type: "ForeignGroup", display_name: null, login: null, user_type: null, account_enabled: null, last_sign_in: null, mfa_status: null }),
    A({ principal_object_id: "grp-borrado", principal_type: "Group", display_name: null, login: null, user_type: null, account_enabled: null, last_sign_in: null, mfa_status: null }),
  ];
  resp.accounts = [];
  await renderPage();
  await openTab(/asignaciones/i);

  await screen.findByText("fg-1");
  // Solo el grupo del tenant (grp-borrado) lleva el chip.
  const chips = await screen.findAllByText("Eliminado de Entra ID");
  expect(chips).toHaveLength(1);
});

test("la pestaña Asignaciones muestra la clase de rol", async () => {
  resp.assignments = [A({ role_class: "owner", is_elevated: true, role_name: "Owner" })];
  await renderPage();
  await openTab(/asignaciones/i);
  expect(await screen.findByText("Owner (otorga accesos)")).toBeInTheDocument();
});

test("el filtro 'Solo elevados' descarta las asignaciones de lectura", async () => {
  resp.assignments = [
    A({ principal_object_id: "u1", display_name: "Ana Elevada", role_class: "owner", is_elevated: true }),
    A({ principal_object_id: "u2", display_name: "Beto Lector", role_class: "lectura", is_elevated: false }),
  ];
  await renderPage();
  await openTab(/asignaciones/i);
  await screen.findByText("Beto Lector");

  fireEvent.click(screen.getByLabelText("Solo elevados", { selector: "input" }));

  expect(screen.getByText("Ana Elevada")).toBeInTheDocument();
  expect(screen.queryByText("Beto Lector")).toBeNull();
});
