import { beforeEach, expect, test } from "vitest";
import {
  canEdit, canEditModule, canViewModule, clearSession, getEmail, getModulePerms,
  getRole, getToken, setEmail, setModulePerms, setSession,
} from "@/lib/auth";

beforeEach(() => localStorage.clear());

test("setSession/getToken/getRole y clearSession", () => {
  setSession("tok123", "consultor", "Isaac");
  expect(getToken()).toBe("tok123");
  expect(getRole()).toBe("consultor");
  clearSession();
  expect(getToken()).toBe("");
  expect(getRole()).toBe("lector");
});

test("canEdit solo admin/consultor", () => {
  setSession("t", "lector", "x");
  expect(canEdit()).toBe(false);
  setSession("t", "admin", "x");
  expect(canEdit()).toBe(true);
  setSession("t", "consultor", "x");
  expect(canEdit()).toBe(true);
});

test("canViewModule/canEditModule según la matriz del rol", () => {
  setSession("t", "consultor", "x");
  setModulePerms({ alerts: { can_view: true, can_edit: false }, costos: { can_view: true, can_edit: true } });
  expect(canViewModule("alerts")).toBe(true);
  expect(canEditModule("alerts")).toBe(false);
  expect(canEditModule("costos")).toBe(true);
  expect(canViewModule("policies")).toBe(false); // ausente = denegado
});

test("admin siempre ve y edita sin matriz", () => {
  setSession("t", "admin", "x");
  setModulePerms({});
  expect(canViewModule("alerts")).toBe(true);
  expect(canEditModule("alerts")).toBe(true);
});

test("lector nunca edita aunque la matriz diga que sí", () => {
  setSession("t", "lector", "x");
  setModulePerms({ alerts: { can_view: true, can_edit: true } });
  expect(canViewModule("alerts")).toBe(true);
  expect(canEditModule("alerts")).toBe(false);
});

test("clearSession limpia los permisos", () => {
  setModulePerms({ alerts: { can_view: true, can_edit: true } });
  clearSession();
  expect(getModulePerms()).toEqual({});
});

test("getEmail/setEmail y clearSession", () => {
  expect(getEmail()).toBe("");
  setEmail("isaac@bit.ec");
  expect(getEmail()).toBe("isaac@bit.ec");
  clearSession();
  expect(getEmail()).toBe("");
});

test("clearSession limpia también el contexto de negocio y respeta las preferencias de dispositivo", () => {
  setSession("tok", "consultor", "Nombre");
  localStorage.setItem("innovacion_cdc_waf_client", "42");
  localStorage.setItem("innovacion_cdc_advisor_sync_job", '{"clientId":1}');
  localStorage.setItem("innovacion_cdc_section", "waf");
  localStorage.setItem("innovacion_cdc_recent", '["waf"]');
  localStorage.setItem("innovacion_cdc_sidebar_collapsed", "1");

  clearSession();

  expect(localStorage.getItem("innovacion_cdc_waf_client")).toBeNull();
  expect(localStorage.getItem("innovacion_cdc_advisor_sync_job")).toBeNull();
  expect(localStorage.getItem("innovacion_cdc_section")).toBeNull();
  expect(localStorage.getItem("innovacion_cdc_recent")).toBeNull();
  // Preferencia de dispositivo, no contexto del usuario: se queda.
  expect(localStorage.getItem("innovacion_cdc_sidebar_collapsed")).toBe("1");
});
