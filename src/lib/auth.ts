import type { Role } from "@/types";

let role: Role = "lector";
let name = "Usuario BIT";
let email = "";
let csrfToken = "";
let modulePerms: Record<string, ModulePerm> = {};
let legacyTestToken = "";

export interface ModulePerm { can_view: boolean; can_edit: boolean }

export function getRole(): Role {
  return role;
}
export function getName(): string {
  return name;
}
/** Correo del usuario en sesión (para detectar "soy yo" en la gestión de usuarios). */
export function getEmail(): string {
  return email;
}
export function setEmail(nextEmail: string): void {
  email = nextEmail || "";
}
export function getToken(): string { return legacyTestToken; }
export function setSession(nextRole: Role, nextName: string): void;
export function setSession(legacyToken: string, nextRole: Role, nextName: string): void;
export function setSession(first: string, second: Role | string, third?: string): void {
  if (third !== undefined) { legacyTestToken = first; role = second as Role; name = third || "Usuario BIT"; modulePerms = {}; return; }
  role = first as Role; name = second || "Usuario BIT"; modulePerms = {};
}
export function setCsrfToken(token: string | undefined): void { csrfToken = token || ""; }
export function getCsrfToken(): string { return csrfToken; }
export function clearSession(): void {
  role = "lector"; name = "Usuario BIT"; email = ""; csrfToken = ""; modulePerms = {}; legacyTestToken = "";
}
export function canEdit(): boolean {
  return getRole() === "admin" || getRole() === "consultor";
}
export function setModulePerms(perms: Record<string, ModulePerm>): void {
  modulePerms = perms;
}
export function getModulePerms(): Record<string, ModulePerm> {
  return modulePerms;
}
/** Visibilidad del módulo según la matriz del rol. Admin ve todo; ausente = denegado. */
export function canViewModule(key: string): boolean {
  if (getRole() === "admin") return true;
  return getModulePerms()[key]?.can_view === true;
}
/** Edición del módulo. Admin edita todo; lector jamás edita (candado, espejo del backend). */
export function canEditModule(key: string): boolean {
  const role = getRole();
  if (role === "admin") return true;
  if (role === "lector") return false;
  return getModulePerms()[key]?.can_edit === true;
}
