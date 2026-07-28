import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { beforeEach, expect, test, vi } from "vitest";
import { setSession } from "@/lib/auth";
import type {
  AccessAccount, AccessAssignment, AccessDecisionItem, AccessFinding, AccessReviewResponse, ClientAdmin,
} from "@/types";

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
  last_sign_in: "2026-07-20T10:00:00Z", mfa_status: "enabled",
  decision: null, decision_note: null, decision_decided_by: null, decision_decided_at: null,
  decision_runs_since: null,
  // Bloque 4: los dos los decide el backend (ambiente inferido del nombre de la suscripción, y
  // "nuevo" según el delta contra la corrida anterior).
  environment: "desconocido", is_new: false, ...over,
});

const C = (over: Partial<AccessAccount>): AccessAccount => ({
  principal_object_id: "u1", principal_type: "User", display_name: "Ana", login: "ana@x.com",
  user_type: "Member", is_external: false, total_assignments: 1, owner: 0, otorga_accesos: 0,
  escritura_total: 0, escritura_servicio: 0, lectura: 1, sin_clasificar: 0, subscriptions: 1,
  broadest_scope_level: "subscription", via: "directo", account_enabled: true,
  last_sign_in: "2026-07-20T10:00:00Z", mfa_status: "enabled", orphan: false,
  decision_pendientes: 1, decision_mantener: 0, decision_revocar: 0, decision_justificado: 0, ...over,
});

const F = (over: Partial<AccessFinding>): AccessFinding => ({
  key: "regla", severity: "media", title: "Regla de prueba", detail: "Detalle con cifras.",
  recommendation: "Hacer algo concreto.", evaluable: true, not_evaluable_reason: null,
  affected_accounts: 1, affected_assignments: 1, affected_principals: ["u1"],
  accepted: false, accepted_note: null, accepted_by: null, accepted_at: null,
  coverage_pct: null, ...over,
});

const baseResp: AccessReviewResponse = {
  status: "ok", run_id: 7, started_at: null, finished_at: "2026-07-24T17:07:00Z",
  inactivity_days: 90, graph_complete: true,
  delta: {
    has_previous: true, previous_run_id: 6, previous_finished_at: "2026-06-24T17:07:00Z",
    nuevos_accesos: 2, accesos_removidos: 1,
    nuevos_global_admins: [], global_admins_removidos: [],
    nuevos_guests: 0, guests_removidos: 0, nuevos_principals: ["u1"],
  },
  kpis: {
    total_asignaciones: 3, global_admins: 0, global_admins_sin_mfa: 0, internos_sin_mfa: 0,
    cuentas_deshabilitadas: 0, cuentas_inactivas: 0, guests_total: 0, guests_inactivos: 0,
    guests_inactivos_con_permisos: 0, service_principals: 0,
    cuentas_unicas: 3, asignaciones_elevadas: 0, pct_elevadas: 0, owners: 0,
    cuentas_externas: 0, owners_externos: 0, roles_personalizados: 0, pendientes_de_revisar: 0,
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

const saveAccessDecisions = vi.fn(
  (_clientId: number, _items: AccessDecisionItem[]) => Promise.resolve({ saved: _items.length }));
const acceptAccessFinding = vi.fn(
  (_clientId: number, _findingKey: string, _note: string) => Promise.resolve({ saved: 1 }));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listClientsAdmin: () => Promise.resolve(clients),
  getAccessReview: () => Promise.resolve(resp),
  listAccessReviewRuns: () => Promise.resolve([]),
  syncAccessReview: vi.fn(),
  downloadFromApi: vi.fn(),
  // Envueltos en lambdas: la factoría del mock se evalúa al primer import de @/lib/api, que ocurre
  // dentro de renderPage (los vi.fn ya están inicializados, pero así no dependemos de ese orden).
  saveAccessDecisions: (...args: Parameters<typeof saveAccessDecisions>) => saveAccessDecisions(...args),
  acceptAccessFinding: (...args: Parameters<typeof acceptAccessFinding>) => acceptAccessFinding(...args),
}));

beforeEach(() => {
  localStorage.clear();
  saveAccessDecisions.mockClear();
  acceptAccessFinding.mockClear();
  resp = structuredClone(baseResp);
});

/** Sesión con permiso de edición del módulo: sin ella no hay checkbox ni barra de decisión. */
function asEditor() {
  setSession("tok", "admin", "Consultor BIT");
}

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

/** Abre el menú "Decidir" del lote y elige una acción. Radix abre en pointerdown, no en click
 *  (mismo patrón que los tests de WafActions con el menú Opciones). */
async function decidir(accion: RegExp) {
  const trigger = await screen.findByRole("button", { name: /decidir/i });
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
  fireEvent.click(trigger);
  fireEvent.click(await screen.findByText(accion));
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
  // Queda un solo contador que depende del eje de origen: los de riesgo se movieron a los hallazgos.
  const externas = screen.getAllByTitle(/el origen interna\/externa sale del UPN/i);
  expect(externas).toHaveLength(1);
  for (const c of externas) expect(c).toHaveTextContent("n/d");
});

// D5: el aviso de cobertura se arma de lo que realmente faltó. El texto único anterior mentía en los
// dos sentidos, y el caso de ARM parcial —el más grave, porque deja la tabla corta— no se avisaba.
test("sin licencia P1 avisa por la inactividad, no por el directorio", async () => {
  resp.status = "partial";
  resp.graph_complete = true;   // el directorio se leyó completo: solo falta el último login
  resp.credentials = [{ credential_id: 1, credential_name: "cred", arm_status: "ok", graph_status: "sin_licencia_p1", detail: null }];
  await renderPage();

  expect(await screen.findByText(/no tiene licencia Entra ID P1\/P2/)).toBeInTheDocument();
  expect(screen.queryByText(/No se pudo leer el directorio de Entra ID/)).toBeNull();
  expect(screen.queryByText(/No se pudo listar las asignaciones/)).toBeNull();
});

test("con una credencial que falló en ARM avisa que los conteos son un piso", async () => {
  resp.status = "partial";
  resp.credentials = [
    { credential_id: 1, credential_name: "cred A", arm_status: "ok", graph_status: "ok", detail: null },
    { credential_id: 2, credential_name: "cred B", arm_status: "error", graph_status: "ok", detail: "403" },
  ];
  await renderPage();

  expect(await screen.findByText(/la tabla y los conteos de asignaciones son un piso/)).toBeInTheDocument();
  // El total deja de presentarse como el total del tenant.
  expect(screen.getByTitle(/Piso, no el total.*Clic para ver las que sí se leyeron/)).toHaveTextContent("≥3");
});

test("una corrida que cubrió todo no muestra aviso de cobertura", async () => {
  await renderPage();
  await screen.findByText("Grupo Vivo");

  expect(screen.queryByText(/No se pudo listar las asignaciones/)).toBeNull();
  expect(screen.queryByText(/No se pudo leer el directorio/)).toBeNull();
  expect(screen.queryByText(/licencia Entra ID P1/)).toBeNull();
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

test("el panel de hallazgos abre el primero y muestra su recomendación", async () => {
  resp.findings = [
    F({ key: "critico", severity: "critica", title: "Privilegio en la raíz", recommendation: "Bajar el scope." }),
    F({ key: "medio", severity: "media", title: "Otra regla", recommendation: "Otra acción." }),
  ];
  await renderPage();

  expect(await screen.findByText("Privilegio en la raíz")).toBeInTheDocument();
  expect(screen.getByText(/Bajar el scope/)).toBeInTheDocument();
  // El segundo queda colapsado: su recomendación no está en el DOM.
  expect(screen.queryByText(/Otra acción/)).toBeNull();
});

test("un hallazgo no evaluable no ofrece drill-down y explica por qué", async () => {
  resp.findings = [
    F({ key: "sin_datos", title: "Cuentas sin MFA", evaluable: false, affected_accounts: 0,
        affected_assignments: 0, affected_principals: [], not_evaluable_reason: "No evaluable: falta leer el directorio." }),
  ];
  await renderPage();

  // Va al grupo colapsado, así que primero hay que abrirlo.
  fireEvent.click(await screen.findByText(/1 sin datos para evaluar/));
  expect(await screen.findByText(/falta leer el directorio/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Ver cuentas" })).toBeNull();
});

test("'Ver cuentas' filtra la tabla por las cuentas del hallazgo, y el chip lo quita", async () => {
  resp.accounts = [
    C({ principal_object_id: "u1", display_name: "Ana Afectada" }),
    C({ principal_object_id: "u2", display_name: "Beto Sano" }),
  ];
  resp.findings = [F({ key: "critico", severity: "critica", title: "Privilegio en la raíz", affected_principals: ["u1"] })];
  await renderPage();

  await screen.findByText("Beto Sano");
  // El drill-down pasa por el modal: ahí se ven las cuentas, y de ahí se salta a la tabla filtrada.
  fireEvent.click(screen.getByRole("button", { name: "Ver cuentas" }));
  const modal = await screen.findByRole("dialog");
  fireEvent.click(within(modal).getByRole("button", { name: /Abrir en la pestaña Cuentas/ }));

  expect(await screen.findByText("Ana Afectada")).toBeInTheDocument();
  expect(screen.queryByText("Beto Sano")).toBeNull();

  fireEvent.click(screen.getByLabelText(/Quitar filtro del hallazgo/));
  expect(screen.getByText("Beto Sano")).toBeInTheDocument();
});

test("una regla de práctica (porcentaje) no ofrece drill-down", async () => {
  // Sin principals afectados no hay a quién llevar: un umbral no tiene culpables individuales.
  resp.findings = [F({ key: "granularidad_recurso", title: "Granularidad", affected_accounts: 0,
                       affected_assignments: 2968, affected_principals: [] })];
  await renderPage();

  expect(await screen.findByText("Granularidad")).toBeInTheDocument();
  expect(screen.getByText(/2968 asignaciones/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Ver cuentas" })).toBeNull();
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

// ── Decisión por acceso (bloque 3) ─────────────────────────

test("Asignaciones muestra el chip de decisión, con el arrastre en el title", async () => {
  resp.accounts = [];
  resp.assignments = [
    A({ principal_object_id: "u1", display_name: "Ana Perez", decision: "revocar",
        decision_note: "Se pidió al cliente en junio.", decision_decided_by: "consultor@demo.local",
        decision_decided_at: "2026-06-30T10:00:00Z", decision_runs_since: 2 }),
    A({ principal_object_id: "u2", display_name: "Beto Sin Decidir" }),
  ];
  await renderPage();
  await openTab(/asignaciones/i);

  const revocar = await screen.findByText("Revocar");
  expect(screen.getByText("Pendiente")).toBeInTheDocument();
  // El punto del bloque: un "revocar" que sigue vivo desde corridas anteriores lo dice.
  expect(revocar.getAttribute("title")).toContain("hace 2 corridas");
});

test("Cuentas resume las decisiones y omite los ceros", async () => {
  resp.accounts = [C({
    principal_object_id: "u1", display_name: "Ana Perez",
    decision_pendientes: 3, decision_mantener: 0, decision_revocar: 0, decision_justificado: 1,
  })];
  resp.assignments = [];
  await renderPage();
  expect(await screen.findByText("3 pendientes · 1 justificado")).toBeInTheDocument();
});

test("con permiso de edición, seleccionar una fila permite marcarla para revocar", async () => {
  asEditor();
  resp.accounts = [];
  resp.assignments = [A({ principal_object_id: "u1", display_name: "Ana Perez" })];
  await renderPage();
  await openTab(/asignaciones/i);

  fireEvent.click(await screen.findByLabelText(/Seleccionar la asignación de Ana Perez/));
  expect(await screen.findByText("1 seleccionada")).toBeInTheDocument();

  await decidir(/^Revocar$/);
  await waitFor(() => expect(saveAccessDecisions).toHaveBeenCalledTimes(1));
  expect(saveAccessDecisions).toHaveBeenCalledWith(4, [{
    principal_object_id: "u1", role_definition_id: "def-1", scope: "/subscriptions/s1",
    decision: "revocar", note: null,
  }]);
});

test("sin permiso de edición no hay selección ni barra de decisión", async () => {
  resp.accounts = [];
  resp.assignments = [A({ principal_object_id: "u1", display_name: "Ana Perez" })];
  await renderPage();
  await openTab(/asignaciones/i);

  await screen.findByText("Ana Perez");
  expect(screen.queryByLabelText(/Seleccionar la asignación de/)).toBeNull();
  expect(screen.queryByRole("button", { name: /decidir/i })).toBeNull();
});

test("justificar no permite guardar sin nota", async () => {
  asEditor();
  resp.accounts = [];
  resp.assignments = [A({ principal_object_id: "u1", display_name: "Ana Perez" })];
  await renderPage();
  await openTab(/asignaciones/i);
  fireEvent.click(await screen.findByLabelText(/Seleccionar la asignación de Ana Perez/));
  await decidir(/^Justificar…$/);

  const guardar = await screen.findByRole("button", { name: "Guardar justificación" });
  expect(guardar).toBeDisabled();
  fireEvent.click(guardar);
  expect(saveAccessDecisions).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText("Nota de justificación"),
    { target: { value: "Cuenta break-glass aprobada por el cliente." } });
  fireEvent.click(await screen.findByRole("button", { name: "Guardar justificación" }));

  await waitFor(() => expect(saveAccessDecisions).toHaveBeenCalledTimes(1));
  expect(saveAccessDecisions.mock.calls[0][1][0]).toMatchObject({
    decision: "justificado", note: "Cuenta break-glass aprobada por el cliente.",
  });
});

test("el filtro de decisión 'Pendientes' deja solo las asignaciones sin decidir", async () => {
  resp.accounts = [];
  resp.assignments = [
    A({ principal_object_id: "u1", display_name: "Ana Perez" }),
    A({ principal_object_id: "u2", display_name: "Beto Decidido", decision: "mantener" }),
  ];
  await renderPage();
  await openTab(/asignaciones/i);
  await screen.findByText("Beto Decidido");

  // El contador de la tira se quitó (lo resuelven los hallazgos) y el popover también: los tres
  // filtros que quedaron están en línea, con su etiqueta visible.
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Filtrar por decisión" }), { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: "Pendientes" }));

  expect(screen.getByText("Ana Perez")).toBeInTheDocument();
  expect(screen.queryByText("Beto Decidido")).toBeNull();
});

test("'Ver cuentas' abre un modal con las cuentas, sin obligar a bajar a la tabla", async () => {
  // El efecto de la acción tiene que verse donde se hizo el clic: filtrar una tabla que está mucho
  // más abajo hacía que el botón pareciera no hacer nada.
  resp.accounts = [
    C({ principal_object_id: "u1", display_name: "Ana Afectada", is_external: true, owner: 2 }),
    C({ principal_object_id: "u2", display_name: "Beto Sano" }),
  ];
  resp.findings = [F({
    key: "externa_elevada", severity: "critica", title: "Cuenta externa con privilegio elevado",
    detail: "1 cuenta externa tiene privilegio elevado.", affected_principals: ["u1"],
  })];
  await renderPage();

  fireEvent.click(await screen.findByRole("button", { name: "Ver cuentas" }));

  const modal = await screen.findByRole("dialog");
  expect(within(modal).getByText("Ana Afectada")).toBeInTheDocument();
  expect(within(modal).getByText("Externa")).toBeInTheDocument();
  // La cuenta que el hallazgo no señala no aparece.
  expect(within(modal).queryByText("Beto Sano")).toBeNull();

  // Y desde el modal se puede pasar a la tabla ya filtrada, para trabajar con filtros y decisiones.
  fireEvent.click(within(modal).getByRole("button", { name: /Abrir en la pestaña Cuentas/ }));
  expect(await screen.findByLabelText(/Quitar filtro del hallazgo/)).toBeInTheDocument();
});

test("un hallazgo aceptado no aparece entre los abiertos", async () => {
  resp.findings = [F({
    key: "exceso_global_admins", severity: "alta", title: "Exceso de Global Admins",
    affected_accounts: 0, affected_assignments: 6, affected_principals: [],
    accepted: true, accepted_note: "Cuentas break-glass documentadas.", accepted_by: "Ana Perez",
    accepted_at: "2026-07-01T12:00:00Z",
  })];
  await renderPage();

  expect(await screen.findByText("Sin hallazgos abiertos en esta corrida")).toBeInTheDocument();
  fireEvent.click(screen.getByText(/1 aceptada con justificación/));
  expect(await screen.findByText(/aceptado por Ana Perez/)).toBeInTheDocument();
});

// ── Delta entre corridas y ambiente (bloque 4) ─────────────

const NUEVOS_HINT = /Accesos que no existían en la corrida anterior/;

test("la franja muestra los conteos del delta y la fecha de la corrida comparada", async () => {
  await renderPage();

  expect(await screen.findByText("Cambios desde la corrida anterior")).toBeInTheDocument();
  expect(screen.getByText("+2 accesos")).toBeInTheDocument();
  expect(screen.getByText("−1 acceso")).toBeInTheDocument();
  const fecha = new Date("2026-06-24T17:07:00Z").toLocaleDateString("es-EC");
  expect(screen.getByText(`Comparado con la corrida del ${fecha}`)).toBeInTheDocument();
  // Y la tira gana el contador "Nuevos".
  expect(screen.getByTitle(NUEVOS_HINT)).toHaveTextContent("2");
});

test("la franja destaca los Global Admins nuevos y removidos", async () => {
  resp.delta = { ...resp.delta!, nuevos_global_admins: ["Ana Perez"], global_admins_removidos: ["Beto Saliente"] };
  await renderPage();

  expect(await screen.findByText(/Global Admins nuevos: Ana Perez/)).toBeInTheDocument();
  expect(screen.getByText(/Global Admins removidos: Beto Saliente/)).toBeInTheDocument();
});

test("sin corrida anterior lo dice y no muestra el contador Nuevos", async () => {
  resp.delta = {
    has_previous: false, previous_run_id: null, previous_finished_at: null,
    nuevos_accesos: 0, accesos_removidos: 0, nuevos_global_admins: [], global_admins_removidos: [],
    nuevos_guests: 0, guests_removidos: 0, nuevos_principals: [],
  };
  await renderPage();

  expect(await screen.findByText(/Primera revisión de este cliente/)).toBeInTheDocument();
  // "+0 / −0" se leería como "no cambió nada", que es distinto de "no hay con qué comparar".
  expect(screen.queryByText("+0 accesos")).toBeNull();
  expect(screen.queryByText("Cambios desde la corrida anterior")).toBeNull();
  expect(screen.queryByTitle(NUEVOS_HINT)).toBeNull();
});

test("sin diferencias con la corrida anterior lo dice explícitamente", async () => {
  resp.delta = { ...resp.delta!, nuevos_accesos: 0, accesos_removidos: 0, nuevos_principals: [] };
  await renderPage();

  expect(await screen.findByText("Sin cambios respecto de la corrida anterior.")).toBeInTheDocument();
  expect(screen.queryByText("+0 accesos")).toBeNull();
});

// D2: el peor caso era la corrida ANTERIOR parcial con la actual completa. No había banner, nada
// quedaba en n/d, y la franja imprimía en rojo "Global Admins nuevos: <todos los del tenant>" cuando
// nadie recibió nada: el eje estaba vacío antes porque no se pudo leer el directorio.
test("un directorio no comparable no afirma Global Admins nuevos ni sin cambios", async () => {
  resp.delta = {
    ...resp.delta!, accesos_comparables: true, directorio_comparable: false,
    nuevos_global_admins: null, global_admins_removidos: null,
    nuevos_guests: null, guests_removidos: null,
  };
  await renderPage();

  expect(await screen.findByText(/Entra ID: n\/d/)).toBeInTheDocument();
  expect(screen.queryByText(/Global Admins nuevos/)).toBeNull();
  expect(screen.queryByText("Sin cambios respecto de la corrida anterior.")).toBeNull();
  // El eje de accesos sí se midió: sus conteos siguen a la vista.
  expect(screen.getByText("+2 accesos")).toBeInTheDocument();
});

test("un inventario no comparable deja Nuevos en n/d y retira el filtro solo nuevos", async () => {
  resp.delta = {
    ...resp.delta!, accesos_comparables: false, directorio_comparable: true,
    nuevos_accesos: null, accesos_removidos: null, nuevos_principals: [],
  };
  await renderPage();

  expect(await screen.findByText(/Accesos: n\/d/)).toBeInTheDocument();
  // El contador existe (hay corrida anterior) pero no afirma un número.
  expect(screen.getByTitle(/no leyó el inventario completo/)).toHaveTextContent("n/d");
  expect(screen.queryByTitle(NUEVOS_HINT)).toBeNull();
  await openTab(/asignaciones/i);
  expect(screen.queryByText("Solo nuevos")).toBeNull();
});

test("el chip Nuevo aparece solo en las asignaciones nuevas, junto al de decisión", async () => {
  resp.accounts = [];
  resp.assignments = [
    A({ principal_object_id: "u1", display_name: "Ana Perez", is_new: true }),
    A({ principal_object_id: "u2", display_name: "Beto Antiguo" }),
  ];
  await renderPage();
  await openTab(/asignaciones/i);

  await screen.findByText("Beto Antiguo");
  expect(screen.getAllByText("Nuevo")).toHaveLength(1);
  // Convive con el chip de decisión: las dos filas siguen mostrando la suya.
  expect(screen.getAllByText("Pendiente")).toHaveLength(2);
});

test("el filtro 'Solo nuevos' deja únicamente los accesos nuevos", async () => {
  resp.accounts = [];
  resp.assignments = [
    A({ principal_object_id: "u1", display_name: "Ana Perez", is_new: true }),
    A({ principal_object_id: "u2", display_name: "Beto Antiguo" }),
  ];
  await renderPage();
  await openTab(/asignaciones/i);
  await screen.findByText("Beto Antiguo");

  fireEvent.click(screen.getByLabelText("Solo nuevos", { selector: "input" }));

  expect(screen.getByText("Ana Perez")).toBeInTheDocument();
  expect(screen.queryByText("Beto Antiguo")).toBeNull();
});

test("el contador Nuevos lleva a Asignaciones filtradas por lo nuevo", async () => {
  resp.accounts = [];
  resp.assignments = [
    A({ principal_object_id: "u1", display_name: "Ana Perez", is_new: true }),
    A({ principal_object_id: "u2", display_name: "Beto Antiguo" }),
  ];
  await renderPage();

  fireEvent.click(await screen.findByTitle(NUEVOS_HINT));

  expect(await screen.findByText("Ana Perez")).toBeInTheDocument();
  expect(screen.queryByText("Beto Antiguo")).toBeNull();
});

test("el filtro por ambiente deja solo las asignaciones de ese ambiente", async () => {
  resp.accounts = [];
  resp.assignments = [
    A({ principal_object_id: "u1", display_name: "Ana Perez", subscription_name: "SAPPRD", environment: "produccion" }),
    A({ principal_object_id: "u2", display_name: "Beto Dev", subscription_name: "AnaliticaDEV", environment: "desarrollo" }),
  ];
  await renderPage();
  await openTab(/asignaciones/i);

  // La columna Ambiente muestra la etiqueta de cada uno (la clasificación viene del backend).
  expect(await screen.findByText("Producción")).toBeInTheDocument();
  expect(screen.getByText("Desarrollo")).toBeInTheDocument();

  fireEvent.keyDown(screen.getByRole("combobox", { name: "Filtrar por ambiente" }), { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: "Producción" }));

  expect(screen.getByText("Ana Perez")).toBeInTheDocument();
  expect(screen.queryByText("Beto Dev")).toBeNull();
});

// ── Los tres filtros que quedaron en línea, ejercitados de punta a punta ──────────

test("el filtro por clase de rol deja solo las asignaciones de esa clase", async () => {
  resp.accounts = [];
  resp.assignments = [
    A({ principal_object_id: "u1", display_name: "Ana Dueña", role_name: "Owner", role_class: "owner", is_elevated: true }),
    A({ principal_object_id: "u2", display_name: "Beto Lector", role_name: "Reader", role_class: "lectura" }),
    A({ principal_object_id: "u3", display_name: "Caro Sin Clase", role_name: "Rol viejo", role_class: null }),
  ];
  await renderPage();
  await openTab(/asignaciones/i);
  await screen.findByText("Ana Dueña");

  fireEvent.keyDown(screen.getByRole("combobox", { name: "Filtrar por clase de rol" }), { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: "Owner (otorga accesos)" }));

  expect(screen.getByText("Ana Dueña")).toBeInTheDocument();
  expect(screen.queryByText("Beto Lector")).toBeNull();
  expect(screen.queryByText("Caro Sin Clase")).toBeNull();
  expect(screen.getByText("1 de 3 asignaciones")).toBeInTheDocument();

  // "Sin clasificar" es una opción propia: las corridas viejas no quedan inalcanzables.
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Filtrar por clase de rol" }), { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: "Sin clasificar" }));

  expect(screen.getByText("Caro Sin Clase")).toBeInTheDocument();
  expect(screen.queryByText("Ana Dueña")).toBeNull();
});

test("los filtros se combinan en AND, y Limpiar los quita todos", async () => {
  resp.accounts = [];
  resp.assignments = [
    A({ principal_object_id: "u1", display_name: "Ana Dueña PRD", role_class: "owner", is_elevated: true, environment: "produccion" }),
    A({ principal_object_id: "u2", display_name: "Beto Dueño DEV", role_class: "owner", is_elevated: true, environment: "desarrollo" }),
    A({ principal_object_id: "u3", display_name: "Caro Lectora PRD", role_class: "lectura", environment: "produccion" }),
  ];
  await renderPage();
  await openTab(/asignaciones/i);
  await screen.findByText("Ana Dueña PRD");

  fireEvent.keyDown(screen.getByRole("combobox", { name: "Filtrar por clase de rol" }), { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: "Owner (otorga accesos)" }));
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Filtrar por ambiente" }), { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: "Producción" }));

  // Solo la que cumple LAS DOS condiciones.
  expect(screen.getByText("Ana Dueña PRD")).toBeInTheDocument();
  expect(screen.queryByText("Beto Dueño DEV")).toBeNull();
  expect(screen.queryByText("Caro Lectora PRD")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: /limpiar/i }));

  expect(await screen.findByText("Beto Dueño DEV")).toBeInTheDocument();
  expect(screen.getByText("Caro Lectora PRD")).toBeInTheDocument();
  expect(screen.getByText("3 de 3 asignaciones")).toBeInTheDocument();
});

test("la búsqueda alcanza la suscripción y el tipo de principal", async () => {
  // Los dos ejes perdieron su select propio: si la búsqueda no los cubriera, quedarían inalcanzables.
  resp.accounts = [];
  resp.assignments = [
    A({ principal_object_id: "u1", display_name: "Ana Perez", subscription_name: "SAP Producción" }),
    A({ principal_object_id: "sp-1", display_name: "App Backups", principal_type: "ServicePrincipal",
        subscription_name: "Analitica", account_enabled: null, last_sign_in: null, mfa_status: null, user_type: null }),
  ];
  await renderPage();
  await openTab(/asignaciones/i);
  const buscar = await screen.findByPlaceholderText(/buscar/i);

  fireEvent.change(buscar, { target: { value: "SAP" } });
  expect(screen.getByText("Ana Perez")).toBeInTheDocument();
  expect(screen.queryByText("App Backups")).toBeNull();

  // Por la etiqueta del tipo, que es lo que se ve en la columna (no por el valor crudo de la API).
  fireEvent.change(buscar, { target: { value: "service principal" } });
  expect(screen.getByText("App Backups")).toBeInTheDocument();
  expect(screen.queryByText("Ana Perez")).toBeNull();

  // Guardián del toLowerCase(): buscar el nombre en minúsculas tiene que encontrar "Ana Perez".
  fireEvent.change(buscar, { target: { value: "ana perez" } });
  expect(screen.getByText("Ana Perez")).toBeInTheDocument();
  expect(screen.queryByText("App Backups")).toBeNull();
});

test("cambiar de cliente no arrastra los filtros del anterior", async () => {
  // Un filtro vivo entre clientes mostraba una tabla recortada por un criterio del cliente anterior,
  // sin nada que lo explicara (y con la suscripción, un GUID de otro tenant, la dejaba en cero filas).
  clients.push({
    client_id: 9, client_name: "Otro Cliente", tax_id: null, contact_name: null,
    contact_email: null, is_active: true, created_at: null, has_logo: false,
  });
  try {
    resp.accounts = [];
    resp.assignments = [
      A({ principal_object_id: "u1", display_name: "Ana Dueña", role_class: "owner", is_elevated: true }),
      A({ principal_object_id: "u2", display_name: "Beto Lector", role_class: "lectura" }),
    ];
    await renderPage();
    await openTab(/asignaciones/i);
    await screen.findByText("Ana Dueña");

    fireEvent.keyDown(screen.getByRole("combobox", { name: "Filtrar por clase de rol" }), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Owner (otorga accesos)" }));
    expect(screen.queryByText("Beto Lector")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /cliente demo/i }));
    fireEvent.click(await screen.findByText("Otro Cliente"));

    // Mismo dataset (el mock no distingue cliente): el punto es que el filtro ya no recorta.
    await openTab(/asignaciones/i);
    expect(await screen.findByText("Beto Lector")).toBeInTheDocument();
    expect(screen.getByText("2 de 2 asignaciones")).toBeInTheDocument();
  } finally {
    clients.pop();
  }
});

test("un hallazgo de umbral se acepta con nota obligatoria", async () => {
  asEditor();
  resp.findings = [F({
    key: "exceso_global_admins", severity: "alta", title: "Exceso de Global Admins",
    affected_accounts: 0, affected_assignments: 6, affected_principals: [],
  })];
  await renderPage();

  fireEvent.click(await screen.findByRole("button", { name: "Aceptar" }));
  expect(await screen.findByRole("button", { name: "Aceptar hallazgo" })).toBeDisabled();

  fireEvent.change(screen.getByLabelText("Nota de aceptación"),
    { target: { value: "Son cuentas break-glass." } });
  fireEvent.click(screen.getByRole("button", { name: "Aceptar hallazgo" }));

  await waitFor(() => expect(acceptAccessFinding)
    .toHaveBeenCalledWith(4, "exceso_global_admins", "Son cuentas break-glass."));
});

// ── Presentación: dos especies de hallazgo y tabla de 6 columnas ────

test("el panel separa los hallazgos con cuentas de las prácticas de administración", async () => {
  resp.findings = [
    F({ key: "externa_elevada", severity: "critica", title: "Cuenta externa con privilegio elevado",
        affected_accounts: 1, affected_assignments: 1, affected_principals: ["u1"] }),
    F({ key: "granularidad_recurso", severity: "media", title: "Asignaciones a nivel de recurso individual",
        affected_accounts: 0, affected_assignments: 2968, affected_principals: [] }),
  ];
  await renderPage();

  const accion = await screen.findByRole("region", { name: "Requiere acción" });
  const practicas = screen.getByRole("region", { name: "Prácticas de administración" });

  expect(within(accion).getByText("Cuenta externa con privilegio elevado")).toBeInTheDocument();
  // El hallazgo de umbral NO es una alerta de hoy: es una propiedad del tenant, un proyecto de meses.
  expect(within(accion).queryByText("Asignaciones a nivel de recurso individual")).toBeNull();
  expect(within(practicas).getByText("Asignaciones a nivel de recurso individual")).toBeInTheDocument();
  expect(within(practicas).getByText("2968 asignaciones por corregir")).toBeInTheDocument();
  // Y no ofrece drill-down: un umbral no tiene cuentas a las que llevar.
  expect(within(practicas).queryByRole("button", { name: "Ver cuentas" })).toBeNull();
});

test("un hallazgo con pocas cuentas muestra los nombres en la propia fila", async () => {
  resp.accounts = [
    C({ principal_object_id: "u1", display_name: "Juan Pérez" }),
    C({ principal_object_id: "u2", display_name: "Ana Gómez" }),
  ];
  resp.findings = [F({
    key: "externa_elevada", severity: "critica", title: "Cuenta externa con privilegio elevado",
    affected_accounts: 2, affected_assignments: 2, affected_principals: ["u1", "u2"],
  })];
  await renderPage();

  const accion = await screen.findByRole("region", { name: "Requiere acción" });
  expect(within(accion).getByText("— Juan Pérez, Ana Gómez")).toBeInTheDocument();
});

test("con más cuentas que el máximo de la fila no se listan los nombres", async () => {
  resp.accounts = ["u1", "u2", "u3", "u4"].map((id, i) => C({ principal_object_id: id, display_name: `Cuenta ${i}` }));
  resp.findings = [F({
    key: "elevada_sin_mfa", severity: "alta", title: "Cuenta elevada sin MFA",
    affected_accounts: 4, affected_assignments: 4, affected_principals: ["u1", "u2", "u3", "u4"],
  })];
  await renderPage();

  const accion = await screen.findByRole("region", { name: "Requiere acción" });
  expect(within(accion).getByText("4 cuentas · 4 asignaciones")).toBeInTheDocument();
  expect(within(accion).queryByText(/— Cuenta 0/)).toBeNull();
});

test("el conteo del hallazgo concuerda en singular", async () => {
  resp.findings = [F({ affected_accounts: 1, affected_assignments: 1, affected_principals: ["u1"] })];
  await renderPage();
  // Antes decía "1 cuentas · 1 asignaciones".
  expect(await screen.findByText("1 cuenta · 1 asignación")).toBeInTheDocument();
});

test("el titular ejecutivo resume críticos, pendientes y cuentas", async () => {
  resp.kpis = { ...resp.kpis!, pendientes_de_revisar: 12, cuentas_unicas: 340 };
  resp.findings = [
    F({ key: "externa_elevada", severity: "critica", title: "Cuenta externa con privilegio elevado", affected_principals: ["u1"] }),
    F({ key: "elevada_sin_mfa", severity: "alta", title: "Cuenta elevada sin MFA", affected_principals: ["u1"] }),
    // La cobertura viene como CAMPO del backend (coverage_pct), no parseada del texto del detalle.
    F({ key: "sin_segregacion_ambientes", severity: "alta", title: "Mismo privilegio en producción y en no producción",
        detail: "14 cuentas cruzan ambientes.", coverage_pct: 23, affected_principals: ["u1"] }),
  ];
  await renderPage();

  // Dentro del titular: los mismos números que los contadores, pero con jerarquía de resumen.
  const resumen = await screen.findByRole("region", { name: "Resumen de la revisión" });
  expect(within(resumen).getByText("Hallazgos críticos")).toBeInTheDocument();
  expect(within(resumen).getByText("2 de severidad alta")).toBeInTheDocument();
  expect(within(resumen).getByText("Accesos sin decidir")).toBeInTheDocument();
  expect(within(resumen).getByText("12")).toBeInTheDocument();
  expect(within(resumen).getByText("340")).toBeInTheDocument();
  expect(within(resumen).getByText("Asignaciones con ambiente inferido")).toBeInTheDocument();
  expect(within(resumen).getByText("23%")).toBeInTheDocument();
});

test("las informativas no van en ninguno de los dos bloques", async () => {
  resp.findings = [F({
    key: "alcance_incompleto", severity: "informativa", title: "Alcance de la corrida",
    affected_accounts: 1, affected_assignments: 0, affected_principals: [],
  })];
  await renderPage();

  expect(await screen.findByText(/1 informativa/)).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Requiere acción" })).toBeNull();
  expect(screen.queryByRole("region", { name: "Prácticas de administración" })).toBeNull();
});

test("la tabla de Cuentas tiene seis columnas y ya no el desglose numérico", async () => {
  await renderPage();
  await screen.findByText("Accesos");

  const headers = screen.getAllByRole("columnheader").map((h) => h.textContent?.trim());
  // La séptima celda no tiene título: es el disparador del panel de detalle.
  expect(headers).toEqual(["Cuenta", "Origen", "Accesos", "Privilegio", "Decisión", "Último login", ""]);
  for (const fuera of ["Owner", "Otorga", "Escritura total", "Subs", "Scope más amplio", "Vía", "MFA", "Tipo", "Correo/Login"]) {
    expect(screen.queryByRole("columnheader", { name: fuera })).toBeNull();
  }
});

test("la columna Privilegio muestra el techo del privilegio, con etiqueta corta", async () => {
  resp.accounts = [
    C({ principal_object_id: "u1", display_name: "Ana Owner", owner: 1, lectura: 2, total_assignments: 3 }),
    C({ principal_object_id: "u2", display_name: "Beto Lector", lectura: 1, total_assignments: 1 }),
  ];
  resp.assignments = [];
  await renderPage();

  expect(await screen.findByText("Owner")).toBeInTheDocument();
  expect(screen.getByText("Lectura")).toBeInTheDocument();
  // En una celda, "Owner (otorga accesos)" se parte en tres líneas: la etiqueta larga queda en el panel.
  expect(screen.queryByText("Owner (otorga accesos)")).toBeNull();
});

test("la columna Decisión no repite el mismo texto: guion sin decisiones, avance con ellas", async () => {
  resp.accounts = [
    C({ principal_object_id: "u1", display_name: "Ana Sin Decidir", decision_pendientes: 8 }),
    C({ principal_object_id: "u2", display_name: "Beto Avanzado", decision_pendientes: 5, decision_mantener: 3 }),
  ];
  resp.assignments = [];
  await renderPage();

  const ana = (await screen.findByText("Ana Sin Decidir")).closest("tr")!;
  expect(within(ana).getByText("—")).toBeInTheDocument();
  // El desglose sigue disponible para lectores de pantalla y en el panel, pero no como texto visible.
  expect(within(ana).getByText("8 pendientes")).toHaveClass("sr-only");

  const beto = screen.getByText("Beto Avanzado").closest("tr")!;
  expect(within(beto).getByText("3 de 8")).toBeInTheDocument();
});

test("el panel de detalle de la cuenta trae lo que salió de la tabla", async () => {
  resp.accounts = [C({
    principal_object_id: "u1", display_name: "Ana Perez", login: "ana@x.com", subscriptions: 2,
    broadest_scope_level: "management_group", via: "ambos", mfa_status: "disabled",
    owner: 1, lectura: 2, total_assignments: 3, decision_pendientes: 3,
  })];
  resp.assignments = [A({ principal_object_id: "u1", display_name: "Ana Perez", role_name: "Contributor" })];
  await renderPage();

  fireEvent.click((await screen.findAllByRole("button", { name: "Ver asignaciones" }))[0]);

  const panel = await screen.findByRole("dialog");
  expect(within(panel).getByText("Management group")).toBeInTheDocument();
  expect(within(panel).getByText("Directo y vía grupo")).toBeInTheDocument();
  expect(within(panel).getByText("Sin MFA")).toBeInTheDocument();
  expect(within(panel).getByText("ana@x.com")).toBeInTheDocument();
  expect(within(panel).getByText("Usuario")).toBeInTheDocument();
  // El desglose por clase de rol y las asignaciones de la cuenta viven acá.
  expect(within(panel).getByText("Accesos por clase de rol")).toBeInTheDocument();
  expect(within(panel).getByText("Asignaciones de esta cuenta")).toBeInTheDocument();
  expect(within(panel).getByText("Contributor")).toBeInTheDocument();
  expect(within(panel).getByText("3 pendientes")).toBeInTheDocument();
});
