import { beforeEach, expect, test } from "vitest";
import { canEdit, clearSession, getRole, getToken, setSession } from "@/lib/auth";

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
