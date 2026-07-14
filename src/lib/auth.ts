import type { Role } from "@/types";

const TOKEN_KEY = "innovacion_cdc_token";
const ROLE_KEY = "innovacion_cdc_role";
const NAME_KEY = "innovacion_cdc_name";
const PERMS_KEY = "innovacion_cdc_perms";

export interface ModulePerm { can_view: boolean; can_edit: boolean }

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? "";
}
export function getRole(): Role {
  return (localStorage.getItem(ROLE_KEY) as Role) || "lector";
}
export function getName(): string {
  return localStorage.getItem(NAME_KEY) || "Usuario BIT";
}
export function setSession(token: string, role: Role, name: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ROLE_KEY, role || "lector");
  localStorage.setItem(NAME_KEY, name || "Usuario BIT");
}
export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(NAME_KEY);
  localStorage.removeItem(PERMS_KEY);
}
export function canEdit(): boolean {
  return getRole() === "admin" || getRole() === "consultor";
}
export function setModulePerms(perms: Record<string, ModulePerm>): void {
  localStorage.setItem(PERMS_KEY, JSON.stringify(perms));
}
export function getModulePerms(): Record<string, ModulePerm> {
  try {
    const v = JSON.parse(localStorage.getItem(PERMS_KEY) || "{}");
    return v && typeof v === "object" ? v : {};
  } catch { return {}; }
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
