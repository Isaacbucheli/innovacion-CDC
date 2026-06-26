import type { Role } from "@/types";

const TOKEN_KEY = "innovacion_cdc_token";
const ROLE_KEY = "innovacion_cdc_role";
const NAME_KEY = "innovacion_cdc_name";

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
}
export function canEdit(): boolean {
  return getRole() === "admin" || getRole() === "consultor";
}
