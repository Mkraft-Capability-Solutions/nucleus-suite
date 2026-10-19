import { NUCLEUS_ACTIONS, type NucleusAction } from "@/lib/ai/nucleus-catalog";

/**
 * The non-action half of the Nucleus AI tool surface: reads that the server
 * executes, and the one navigation affordance the browser executes.
 */

export type FunctionDeclaration = {
  name: string;
  description: string;
  parameters?: {
    type: "OBJECT" | "STRING" | "NUMBER" | "BOOLEAN" | "ARRAY";
    description?: string;
    properties?: Record<string, unknown>;
    required?: string[];
    enum?: string[];
  };
};

/** Tools whose work happens server-side, behind `POST /api/v1/ai/nucleus/analyze`. */
export const SERVER_TOOLS = [
  "workforce_analysis",
  "attendance_analysis",
  "leave_analysis",
  "payroll_analysis",
  "capability_analysis",
  "focus_areas",
  "find_employee",
  "list_employees",
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
      "Search the employee directory by name, code, designation or department. Returns identifiers and employee records. If no query is provided, returns active staff.",
    parameters: {
      type: "OBJECT",
      properties: { query: { type: "STRING", description: "Optional name, employee code, designation or department to search for." } },
    },
  },
  {
    name: "list_employees",
    description:
      "Returns the complete active company employee directory and staff roster with full names, codes, designations, departments, and status.",
    parameters: {
      type: "OBJECT",
      properties: {
        department: { type: "STRING", description: "Optional department filter." },
        limit: { type: "INTEGER", description: "Maximum number of employees to return (default 50)." },
      },
    },
  },
];

export const OPEN_SCREEN_DECLARATION: FunctionDeclaration = {
  name: OPEN_SCREEN_TOOL,
  description: "Open a screen in the workspace behind this conversation, so the person can see what is being discussed.",
  parameters: {
    type: "OBJECT",
    properties: { moduleId: { type: "STRING", description: "Workspace module identifier, for example leave, attendance, payroll, people, requisitions, recruitment or settings." } },
    required: ["moduleId"],
  },
};

export function actionDeclaration(action: NucleusAction): FunctionDeclaration {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const field of action.requiredFields) {
    properties[field.name] = {
      type: field.kind === "number" ? "NUMBER" : field.kind === "boolean" ? "BOOLEAN" : "STRING",
      description: field.hint ? `${field.label} (${field.hint})` : field.label,
      ...(field.options ? { enum: field.options } : {}),
    };
    if (!field.optional) required.push(field.name);
  }

  return {
    name: action.name,
    description: `${action.summary} Nothing is written until the person confirms the draft on screen.`,
    parameters: {
      type: "OBJECT",
      properties,
      required,
    },
  };
}

export function declarationsFor(): FunctionDeclaration[] {
  return [
    ...ANALYSIS_DECLARATIONS,
    OPEN_SCREEN_DECLARATION,
    ...NUCLEUS_ACTIONS.map(actionDeclaration),
  ];
}
