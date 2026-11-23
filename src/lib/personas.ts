/**
 * Workspace persona (the UI's role key) derived from a member's tenant role codes.
 *
 * The workspace UI groups screens and dashboards by persona (SUPER_ADMIN, ADMIN, HR_MANAGER, …).
 * The persona is decided by the roles the member holds in the active organisation — never by the
 * email address — so the same person can be an administrator in one organisation and an employee
 * in another. Server-side checks always use the role permissions, not the persona.
 */
export type Persona = "SUPER_ADMIN" | "ADMIN" | "HR_MANAGER" | "FINANCE_MANAGER" | "MANAGER" | "EMPLOYEE";

const ORDER: Array<[Persona, (code: string) => boolean]> = [
  ["ADMIN", (code) => code === "owner" || code === "admin" || code === "super_admin"],
  ["HR_MANAGER", (code) => code.startsWith("hr")],
  ["FINANCE_MANAGER", (code) => code.includes("payroll") || code.includes("finance")],
  ["MANAGER", (code) => code === "manager" || code.includes("team_lead") || code.includes("project_manager")],
];

export function personaForRoles(roleCodes: readonly string[], options: { platformAdmin?: boolean } = {}): Persona {
  const codes = roleCodes.map((code) => code.toLowerCase().replace(/-/g, "_"));
  for (const [persona, test] of ORDER) {
    if (codes.some(test)) return persona === "ADMIN" && options.platformAdmin ? "SUPER_ADMIN" : persona;
  }
  return "EMPLOYEE";
}

export const DEFAULT_CONSOLE: Record<Persona, string> = {
  SUPER_ADMIN: "S1",
  ADMIN: "S1",
  HR_MANAGER: "S2",
  FINANCE_MANAGER: "S5",
  MANAGER: "S7",
  EMPLOYEE: "S8",
};
