import { useCallback } from "react";
import useSWR from "swr";
import {
  CalendarCheck, CalendarDays, ClipboardCheck, Clock, FileText, GraduationCap, Heart, Inbox, LifeBuoy, Megaphone,
  MessagesSquare, Receipt, Settings, ShieldCheck, Upload, UserPlus, Users, Wallet, type LucideIcon,
} from "lucide-react";
import { launchAction } from "@/lib/action-launcher";

/**
 * Quick actions: shortcuts to existing screens (`nav`, a navigation item id from
 * navigation.catalog.json) or existing action forms (`form`, an ActionFormModal id). Each is
 * offered to the personas listed; access to the target is still checked by navigation and the API.
 */

export type Persona = "SUPER_ADMIN" | "ADMIN" | "HR_MANAGER" | "FINANCE_MANAGER" | "MANAGER" | "EMPLOYEE";

export type QuickAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  personas: readonly Persona[];
  nav?: string;
  form?: string;
};

const EVERYONE: readonly Persona[] = ["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "FINANCE_MANAGER", "MANAGER", "EMPLOYEE"];
const LEADS: readonly Persona[] = ["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "MANAGER"];
const HR: readonly Persona[] = ["SUPER_ADMIN", "ADMIN", "HR_MANAGER"];

export const QUICK_ACTIONS: readonly QuickAction[] = [
  { id: "punch", label: "Check in or out", icon: Clock, personas: EVERYONE, nav: "check_in_out" },
  { id: "apply_leave", label: "Apply for leave", icon: CalendarDays, personas: EVERYONE, nav: "leave_requests" },
  { id: "my_attendance", label: "My attendance", icon: CalendarCheck, personas: EVERYONE, nav: "my_attendance" },
  { id: "payslips", label: "My payslips", icon: Wallet, personas: EVERYONE, nav: "payslips" },
  { id: "claim", label: "Claim a reimbursement", icon: Receipt, personas: EVERYONE, nav: "reimbursement_claim" },
  { id: "ticket", label: "Raise a helpdesk ticket", icon: LifeBuoy, personas: EVERYONE, form: "ticket" },
  { id: "my_learning", label: "My learning", icon: GraduationCap, personas: EVERYONE, nav: "learning_paths" },
  { id: "approvals", label: "Approvals inbox", icon: Inbox, personas: [...LEADS, "FINANCE_MANAGER"], nav: "approval_inbox" },
  { id: "team_attendance", label: "Team attendance", icon: Users, personas: LEADS, nav: "team_history" },
  { id: "one_on_one", label: "Schedule a 1:1", icon: MessagesSquare, personas: LEADS, form: "oneOnOne" },
  { id: "kudos", label: "Give recognition", icon: Heart, personas: EVERYONE, form: "kudos" },
  { id: "add_employee", label: "Add an employee", icon: UserPlus, personas: HR, nav: "core_people" },
  { id: "import_people", label: "Import employees", icon: Upload, personas: HR, nav: "core_people" },
  { id: "attendance_exceptions", label: "Attendance exceptions", icon: ClipboardCheck, personas: HR, nav: "attendance_exceptions" },
  { id: "documents", label: "Documents", icon: FileText, personas: EVERYONE, nav: "document_vault" },
  { id: "payroll_runs", label: "Payroll runs", icon: Wallet, personas: ["SUPER_ADMIN", "ADMIN", "FINANCE_MANAGER"], nav: "payroll_runs" },
  { id: "announcements", label: "Announcements", icon: Megaphone, personas: HR, nav: "announcement_management" },
  { id: "access", label: "Roles and access", icon: ShieldCheck, personas: ["SUPER_ADMIN", "ADMIN"], nav: "platform_roles" },
  { id: "settings", label: "Organisation settings", icon: Settings, personas: ["SUPER_ADMIN", "ADMIN"], nav: "platform_settings" },
];

/** What a persona starts with before choosing their own (at most 6). */
export const DEFAULT_PINS: Record<Persona, readonly string[]> = {
  EMPLOYEE: ["punch", "apply_leave", "payslips", "claim", "ticket", "my_learning"],
  MANAGER: ["approvals", "team_attendance", "apply_leave", "one_on_one", "punch", "kudos"],
  FINANCE_MANAGER: ["payroll_runs", "approvals", "payslips", "apply_leave", "punch"],
  HR_MANAGER: ["add_employee", "approvals", "attendance_exceptions", "documents", "announcements", "apply_leave"],
  ADMIN: ["add_employee", "access", "settings", "approvals", "payroll_runs", "documents"],
  SUPER_ADMIN: ["add_employee", "access", "settings", "approvals", "payroll_runs", "documents"],
};

export const MAX_PINS = 8;

export function normalisePersona(role: string | null | undefined): Persona {
  const value = String(role ?? "").toUpperCase();
  return (EVERYONE as readonly string[]).includes(value) ? (value as Persona) : "EMPLOYEE";
}

/** Actions offered to a persona, filtered by a visibility check on their navigation target. */
export function availableActions(persona: Persona, canOpenNav: (navId: string) => boolean): QuickAction[] {
  return QUICK_ACTIONS.filter((action) => action.personas.includes(persona) && (!action.nav || canOpenNav(action.nav)));
}

/** The pinned actions to show: the member's own list, or the persona default, kept to what they may open. */
export function pinnedActions(saved: readonly string[] | null | undefined, persona: Persona, available: QuickAction[]): QuickAction[] {
  const ids = saved ?? DEFAULT_PINS[persona];
  const byId = new Map(available.map((action) => [action.id, action]));
  return ids.map((id) => byId.get(id)).filter((action): action is QuickAction => Boolean(action)).slice(0, MAX_PINS);
}

export function runQuickAction(action: QuickAction, openNav: (navId: string) => void) {
  if (action.form) launchAction(action.form);
  else if (action.nav) openNav(action.nav);
}

/* ------------------------------------------------------------------ */
/* The member's own preferences (server, per organisation)             */
/* ------------------------------------------------------------------ */

async function readPreference(url: string) {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) return null;
  const body = await response.json().catch(() => null);
  return body?.data?.value ?? null;
}

export function usePreference<T>(key: "quick_actions" | "default_dashboard" | "rail_items") {
  const url = `/api/v1/me/preferences/${key}`;
  const { data, isLoading, mutate } = useSWR<T | null>(url, readPreference, { revalidateOnFocus: false });
  const save = useCallback(async (value: T) => {
    await mutate(value, { revalidate: false });
    const response = await fetch(url, { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value }) });
    if (!response.ok) {
      await mutate();
      const body = await response.json().catch(() => null);
      throw new Error(body?.error?.message ?? "Your preference could not be saved.");
    }
  }, [mutate, url]);
  return { value: data ?? null, loaded: !isLoading, save };
}
