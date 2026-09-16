import { isAdminPrincipal } from "./cockpit-catalog";
import { getAuthorizedNavigation, type NavigationItem } from "./navigation-catalog";

/**
 * The employee's self-service navigation.
 *
 * The catalogue in `navigation-catalog.ts` is organised by enterprise DOMAIN —
 * "Core HR", "Payroll & Finance", "Workforce Operations". That vocabulary is
 * correct for an administrator, who reasons about the business function they
 * are administering, and wrong for an employee, who reasons about their own
 * record: my leave, my attendance, my pay.
 *
 * This module regroups the SAME destinations under self-service headings. It
 * introduces NO access of its own:
 *
 * - The authorised set still comes from `getAuthorizedNavigation`, which
 *   applies permissions and then the catalogue's default-deny audience rule.
 * - A group is only ever built from items that were already in that set. A
 *   member id naming something the reader may not open simply does not appear,
 *   and a group all of whose members are unreachable is dropped whole.
 *
 * So this file can narrow (by listing fewer members) but can never widen. If
 * you want an employee to see a new module, mark it `audience` in the
 * catalogue — adding it here alone does nothing.
 *
 * NO DIRECTORY GROUP. Every directory/people module is deliberately absent
 * from the employee allowlist because those endpoints return the whole tenant,
 * not the reader's own pod. The employee's own pod already renders on the S8
 * Employee Home surface. Do not add a "My Pod & Directory" group here to get
 * it back — that would need a scoped endpoint first, not a menu entry.
 */

export type EmployeeNavigationGroupId =
  | "home"
  | "my-attendance"
  | "my-leave"
  | "my-work"
  | "my-pay"
  | "my-growth"
  | "my-support"
  | "my-actions";

export type EmployeeNavigationGroupDefinition = {
  id: EmployeeNavigationGroupId;
  label: string;
  description: string;
  /** Lucide icon name; must already exist in components/hrms/navigation-icons.ts. */
  icon: string;
  /** Where the group opens when the reader clicks it. */
  href: string;
  /** Catalogue module ids this group speaks for, in the order they should read. */
  members: string[];
};

export type EmployeeNavigationGroup = Omit<EmployeeNavigationGroupDefinition, "members"> & {
  /** The members this particular reader is authorised to open, in declared order. */
  items: NavigationItem[];
};

/**
 * The self-service structure, in the order an employee reads it. Between them
 * these groups account for every module on the employee allowlist, so nothing
 * an employee may open is orphaned off the menu.
 *
 * Some members are permission-gated beyond the allowlist and will be absent for
 * a stock employee — `projects` needs `workforce.projects.*`, which a stock
 * employee does not hold, so "My Projects & Tasks" usually renders Timesheets
 * alone. That is the access rule doing its job, not a gap to paper over.
 */
export const employeeNavigationGroups: readonly EmployeeNavigationGroupDefinition[] = [
  {
    id: "home",
    label: "Home Dashboard",
    description: "Your workspace home and personal cockpit",
    icon: "home",
    href: "/",
    members: ["overview", "employee-home"],
  },
  {
    id: "my-attendance",
    label: "My Attendance & Shifts",
    description: "Punches, your attendance history and gate passes",
    icon: "clock-3",
    href: "/attendance",
    members: [
      "attendance",
      "check-in-out",
      "my-attendance-history",
      "attendance-day-detail",
      "gate-pass-register",
    ],
  },
  {
    id: "my-leave",
    label: "My Leaves & Time Off",
    description: "Requests, balances and your accrual ledger",
    icon: "calendar-days",
    href: "/leave",
    members: ["leave", "leave-requests", "leave-balance-ledger"],
  },
  {
    id: "my-work",
    label: "My Projects & Tasks",
    description: "Timesheets and the work assigned to you",
    icon: "briefcase",
    href: "/timesheets",
    members: ["timesheets", "projects"],
  },
  {
    id: "my-pay",
    label: "My Pay & Claims",
    description: "Payslips, reimbursements and travel claims",
    icon: "indian-rupee",
    href: "/payslips",
    members: ["payslips", "reimbursement-claims", "travel"],
  },
  {
    id: "my-growth",
    label: "My Growth & Goals",
    description: "Goals, learning and recognition",
    icon: "target",
    href: "/performance",
    members: ["performance", "learning", "engagement"],
  },
  {
    id: "my-support",
    label: "Policy & Helpdesk",
    description: "HR requests, policies to acknowledge and the assistant",
    icon: "book-open",
    href: "/helpdesk",
    members: ["helpdesk", "policy-acknowledgements", "assistant"],
  },
  {
    id: "my-actions",
    label: "My Inbox & Actions",
    description: "Approvals, exceptions and work waiting on you",
    icon: "inbox",
    href: "/inbox",
    members: ["inbox", "employee-home-actions"],
  },
];

/**
 * Regroup an already-authorised navigation set into the self-service groups.
 *
 * Pure: it reads nothing but its argument, and it can only ever return items
 * that were handed to it. Pass it the output of `getAuthorizedNavigation` —
 * passing it the raw catalogue would show a reader destinations they cannot
 * open, which is why nothing in this module reaches for the catalogue itself.
 *
 * A group with no authorised member is omitted entirely rather than rendered as
 * an empty heading. The group's `href` is its declared primary, unless that
 * destination is one the reader cannot open, in which case it falls back to the
 * first member they can — a group never links somewhere that would bounce them.
 */
export function buildEmployeeNavigationGroups(
  authorized: readonly NavigationItem[],
): EmployeeNavigationGroup[] {
  const byId = new Map(authorized.map((item) => [item.id, item]));
  return employeeNavigationGroups.flatMap<EmployeeNavigationGroup>((group) => {
    const items = group.members
      .map((id) => byId.get(id))
      .filter((item): item is NavigationItem => Boolean(item));
    if (items.length === 0) return [];
    const href = items.some((item) => item.href === group.href) ? group.href : items[0].href;
    return [
      {
        id: group.id,
        label: group.label,
        description: group.description,
        icon: group.icon,
        href,
        items,
      },
    ];
  });
}

/**
 * The self-service groups for a principal, or NOTHING for an administrative
 * one.
 *
 * Administrative principals keep the domain navigation: they are not offered a
 * self-service dock, and — deliberately — an employee is not offered a switch
 * into the administrative one. `isAdminPrincipal` is the single rule for that
 * split; this module does not write a second one.
 */
export function getEmployeeNavigationGroups(
  permissions: readonly string[],
  roles: readonly string[] = [],
): EmployeeNavigationGroup[] {
  if (isAdminPrincipal(permissions, roles)) return [];
  return buildEmployeeNavigationGroups(getAuthorizedNavigation([...permissions], [...roles]));
}

/** Whether the reader is standing on one of this group's destinations. */
export function isEmployeeGroupActive(group: EmployeeNavigationGroup, pathname: string): boolean {
  return group.items.some((item) =>
    item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}

/** The group the current path belongs to, if any. */
export function activeEmployeeNavigationGroup(
  groups: readonly EmployeeNavigationGroup[],
  pathname: string,
): EmployeeNavigationGroup | undefined {
  // Root last: "/" matches only itself, so ordinary destinations claim the path
  // first and Home never steals a match from them.
  const nonRoot = groups.filter((group) => group.id !== "home");
  return (
    nonRoot.find((group) => isEmployeeGroupActive(group, pathname)) ??
    groups.find((group) => isEmployeeGroupActive(group, pathname))
  );
}
