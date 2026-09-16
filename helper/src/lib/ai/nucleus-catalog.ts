import { humanize, permitted, workflowOperations, type Field, type WorkflowOperation } from "@/lib/workflow-catalog";

/**
 * Nucleus AI tool catalog.
 *
 * The platform already publishes every operation it can perform, with a typed
 * field tree and the permissions it needs, in `workflow-catalog.generated.json`.
 * A function declaration for the model is therefore a projection of that file,
 * not a second description of the same forms that could drift away from them.
 *
 * Two rules decide what appears here:
 *
 * 1. The action must be recoverable. A leave request can be rejected, a punch
 *    can be regularised, an announcement can be superseded. Payroll
 *    finalisation, bank disbursement release and settlement payment cannot be,
 *    so they are not on this list and cannot be reached by voice.
 * 2. The caller must already hold the permission. The list below is the ceiling;
 *    `nucleusActionsFor` intersects it with the caller's own grants, so a tool
 *    the user could not invoke through the UI is never declared to the model.
 *    Nothing is enforced here — the real check happens server-side in the route
 *    handler the browser eventually calls — but an undeclared tool cannot be
 *    hallucinated into existence, which keeps the conversation honest.
 *
 * This module is imported by the browser as well as the server: the client
 * dispatcher needs the path and method to issue the confirmed write. It holds
 * no secrets and performs no I/O.
 */

export type NucleusAction = {
  /** Function name exposed to the model. Snake case, verb first. */
  name: string;
  /** `${method} ${path}` of the catalog operation this drives. */
  operationId: string;
  /** One line the model reads to decide whether this is the right tool. */
  summary: string;
};

/**
 * Every action Nucleus AI may draft. Verified against the generated catalog by
 * `nucleus-catalog.test.ts`, which fails if an entry stops resolving.
 */
export const NUCLEUS_ACTIONS: readonly NucleusAction[] = [
  { name: "apply_leave", operationId: "POST /api/v1/leave-requests", summary: "Raise a leave request for an employee over a date range." },
  { name: "grant_compensatory_off", operationId: "POST /api/v1/coff-grants", summary: "Record a compensatory-off credit for a day the employee worked." },
  { name: "record_attendance_punches", operationId: "POST /api/v1/attendance/punches", summary: "Record in and out punches for an employee on one work date." },
  { name: "request_attendance_correction", operationId: "POST /api/v1/regularizations", summary: "Raise a correction against an attendance day that was recorded wrongly." },
  { name: "request_gate_pass", operationId: "POST /api/v1/gate-passes", summary: "Request a gate pass for an employee to leave the premises during a shift." },
  { name: "request_shift_swap", operationId: "POST /api/v1/shift-swaps", summary: "Request a shift swap between two employees on a date." },
  { name: "publish_announcement", operationId: "POST /api/v1/announcements", summary: "Compose an announcement for the workforce." },
  { name: "recognise_employee", operationId: "POST /api/v1/recognition-events", summary: "Record a recognition event for an employee." },
  { name: "give_feedback", operationId: "POST /api/v1/feedback", summary: "Record feedback about an employee." },
  { name: "record_checkin", operationId: "POST /api/v1/checkins", summary: "Record a performance check-in note for an employee." },
  { name: "create_objective", operationId: "POST /api/v1/objectives", summary: "Create a performance objective owned by an employee." },
  { name: "enrol_in_course", operationId: "POST /api/v1/enrollments", summary: "Enrol an employee on a course." },
  { name: "record_referral", operationId: "POST /api/v1/referrals", summary: "Record an employee referral against a requisition and candidate." },
  { name: "add_candidate", operationId: "POST /api/v1/candidates", summary: "Add a candidate to the talent pipeline." },
  { name: "raise_requisition", operationId: "POST /api/v1/requisitions", summary: "Raise a hiring requisition." },
] as const;

const operationIndex = new Map<string, WorkflowOperation>(
  workflowOperations.map((operation) => [`${operation.method} ${operation.path}`, operation]),
);

export function resolveOperation(action: NucleusAction): WorkflowOperation | undefined {
  return operationIndex.get(action.operationId);
}

export type ResolvedAction = NucleusAction & { operation: WorkflowOperation };

/** The actions this caller both may perform and the catalog still publishes. */
export function nucleusActionsFor(permissions: readonly string[]): ResolvedAction[] {
  const held = [...permissions];
  const resolved: ResolvedAction[] = [];
  for (const action of NUCLEUS_ACTIONS) {
    const operation = resolveOperation(action);
    if (!operation || !permitted(operation, held)) continue;
    resolved.push({ ...action, operation });
  }
  return resolved;
}

export function findAction(name: string): ResolvedAction | undefined {
  const action = NUCLEUS_ACTIONS.find((candidate) => candidate.name === name);
  if (!action) return undefined;
  const operation = resolveOperation(action);
  return operation ? { ...action, operation } : undefined;
}

/* -------------------------------------------------------------------------- */
/* Catalog field tree to the OpenAPI subset Gemini accepts                     */
/* -------------------------------------------------------------------------- */

export type GeminiSchema = {
  type: "STRING" | "NUMBER" | "INTEGER" | "BOOLEAN" | "ARRAY" | "OBJECT";
  description?: string;
  enum?: string[];
  items?: GeminiSchema;
  properties?: Record<string, GeminiSchema>;
  required?: string[];
};

/**
 * A derived field is computed by the service and shown read-only on the manual
 * form. Offering it to the model would invite a spoken value that the server
 * then overwrites, so it is dropped from the parameter schema entirely.
 */
function inputtable(field: Field): field is Field & { name: string } {
  return Boolean(field.name) && field.derived !== true;
}

function describe(field: Field): string {
  const label = field.name ? humanize(field.name) : "Value";
  const hints: string[] = [];
  if (field.format) hints.push(`${field.format} format`);
  if (field.min !== undefined) hints.push(`minimum ${field.min}`);
  if (field.max !== undefined) hints.push(`maximum ${field.max}`);
  return hints.length > 0 ? `${label} (${hints.join(", ")})` : label;
}

export function fieldToSchema(field: Field): GeminiSchema {
  const description = describe(field);
  switch (field.kind) {
    case "select":
      return { type: "STRING", description, enum: (field.options ?? []).map((option) => String(option)) };
    case "number":
      return { type: field.integer ? "INTEGER" : "NUMBER", description };
    case "boolean":
      return { type: "BOOLEAN", description };
    case "array":
      return { type: "ARRAY", description, items: fieldToSchema(field.item ?? { kind: "text" }) };
    case "object": {
      const children = (field.fields ?? []).filter(inputtable);
      const required = children.filter((child) => !child.optional).map((child) => child.name);
      return {
        type: "OBJECT",
        description,
        properties: Object.fromEntries(children.map((child) => [child.name, fieldToSchema(child)])),
        ...(required.length > 0 ? { required } : {}),
      };
    }
    case "text":
      return {
        type: "STRING",
        description: field.format === "uuid"
          // An invented uuid is the one failure mode that looks like success to
          // the model, so the instruction travels with the field itself.
          ? `${description}. Obtain this from find_employee — never invent an identifier.`
          : description,
      };
    default:
      // record, union, null and anything the generator adds later: carry it as
      // a JSON string rather than guess a shape the service will reject.
      return { type: "STRING", description: `${description}. Supply a JSON value encoded as a string.` };
  }
}

export type FunctionDeclaration = {
  name: string;
  description: string;
  parameters?: GeminiSchema;
};

export function actionDeclaration(action: ResolvedAction): FunctionDeclaration {
  const parameters = fieldToSchema(action.operation.body);
  const empty = !parameters.properties || Object.keys(parameters.properties).length === 0;
  return {
    name: action.name,
    description: `${action.summary} Nothing is written until the person confirms the draft on screen.`,
    ...(empty ? {} : { parameters }),
  };
}

/** Required field names for an action, in catalog order. Used by the dispatcher. */
export function requiredFields(action: ResolvedAction): string[] {
  return (action.operation.body.fields ?? [])
    .filter(inputtable)
    .filter((field) => !field.optional && field.default === undefined)
    .map((field) => field.name);
}
