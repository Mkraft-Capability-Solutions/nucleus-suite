import { actionDeclaration, nucleusActionsFor, type FunctionDeclaration } from "@/lib/ai/nucleus-catalog";

/**
 * The non-action half of the Nucleus AI tool surface: reads that the server
 * executes, and the one navigation affordance the browser executes.
 *
 * Every analysis tool answers with the platform's `Source<T>` envelope, so a
 * feed that did not resolve arrives as `available: false` carrying the reason
 * rather than as a zero. The system instruction tells the model to read that
 * envelope literally; these descriptions repeat the rule at the point of use,
 * because a tool description is the only part of the contract the model sees
 * again on every turn.
 */

/** Tools whose work happens server-side, behind `POST /api/v1/ai/nucleus/analyze`. */
export const SERVER_TOOLS = [
  "workforce_analysis",
  "attendance_analysis",
  "leave_analysis",
  "payroll_analysis",
  "capability_analysis",
  "focus_areas",
  "find_employee",
] as const;

export type ServerTool = (typeof SERVER_TOOLS)[number];

export function isServerTool(name: string): name is ServerTool {
  return (SERVER_TOOLS as readonly string[]).includes(name);
}

/** The one client-side tool that is not an action: move the screen behind the conversation. */
export const OPEN_SCREEN_TOOL = "open_screen";

const MONTHS_PARAMETER = {
  type: "INTEGER" as const,
  description: "How many whole months back from today to measure. 6 means the last six months. Between 1 and 24.",
};

const UNAVAILABLE_NOTE =
  "Any figure may come back as unavailable with a reason attached. Say the reason; never substitute zero for a figure the platform does not hold.";

export const ANALYSIS_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "workforce_analysis",
    description: `Headcount, joiners, leavers, separation rate and departmental spread over a trailing window. ${UNAVAILABLE_NOTE}`,
    parameters: { type: "OBJECT", properties: { months: MONTHS_PARAMETER }, required: ["months"] },
  },
  {
    name: "attendance_analysis",
    description: `Recorded attendance days, present, half day, absent, productive minutes and payable overtime over a trailing window, for the caller's visible scope or one employee. ${UNAVAILABLE_NOTE}`,
    parameters: {
      type: "OBJECT",
      properties: {
        months: MONTHS_PARAMETER,
        employeeId: { type: "STRING", description: "Optional employee identifier from find_employee. Omit for the whole visible scope." },
      },
      required: ["months"],
    },
  },
  {
    name: "leave_analysis",
    description: `Leave requests by type and status over a trailing window, plus current balances when one employee is named. ${UNAVAILABLE_NOTE}`,
    parameters: {
      type: "OBJECT",
      properties: {
        months: MONTHS_PARAMETER,
        employeeId: { type: "STRING", description: "Optional employee identifier from find_employee. Omit for the whole tenant." },
      },
      required: ["months"],
    },
  },
  {
    name: "payroll_analysis",
    description: `Payroll runs by state and period over a trailing window, with the open anomalies on the most recent run. ${UNAVAILABLE_NOTE}`,
    parameters: { type: "OBJECT", properties: { months: MONTHS_PARAMETER }, required: ["months"] },
  },
  {
    name: "capability_analysis",
    description: `Verified skill evidence per department. ${UNAVAILABLE_NOTE}`,
  },
  {
    name: "focus_areas",
    description:
      "Ranked areas needing attention, assembled from the other analyses. Every item names the recorded signal it rests on and how many records that is. Areas the platform cannot measure are returned separately as gaps, not as healthy.",
    parameters: { type: "OBJECT", properties: { months: MONTHS_PARAMETER }, required: ["months"] },
  },
  {
    name: "find_employee",
    description:
      "Search the employee directory by name, code, designation or department. Returns identifiers. Call this before any action that needs an employee identifier; if the search returns several people, ask which one rather than choosing.",
    parameters: {
      type: "OBJECT",
      properties: { query: { type: "STRING", description: "Name, employee code, designation or department to search for." } },
      required: ["query"],
    },
  },
];

export const OPEN_SCREEN_DECLARATION: FunctionDeclaration = {
  name: OPEN_SCREEN_TOOL,
  description: "Open a screen in the workspace behind this conversation, so the person can see what is being discussed.",
  parameters: {
    type: "OBJECT",
    properties: { moduleId: { type: "STRING", description: "Workspace module identifier, for example leave, attendance, payroll, people or insights." } },
    required: ["moduleId"],
  },
};

/**
 * The complete declaration list for a caller, in the order the model sees it.
 * Actions come last so a read is the cheaper-looking option when both fit.
 */
export function declarationsFor(permissions: readonly string[]): FunctionDeclaration[] {
  return [
    ...ANALYSIS_DECLARATIONS,
    OPEN_SCREEN_DECLARATION,
    ...nucleusActionsFor(permissions).map(actionDeclaration),
  ];
}
