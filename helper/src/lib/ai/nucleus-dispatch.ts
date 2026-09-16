import { findAction, type ResolvedAction } from "@/lib/ai/nucleus-catalog";
import { isServerTool, OPEN_SCREEN_TOOL } from "@/lib/ai/nucleus-tools";
import type { LiveFunctionCall, LiveFunctionResponse } from "@/lib/ai/nucleus-live";
import { humanize, normalizeValue, type Field } from "@/lib/workflow-catalog";

/**
 * Turns a function call from the model into something that happened.
 *
 * Reads are forwarded to the server under the caller's own session. Actions are
 * not performed: they are validated against the same field tree the manual form
 * uses and handed to the page as a draft. The model is told the draft is
 * awaiting confirmation, which is true, and is told so in words it cannot
 * mistake for a completion.
 *
 * Validation lives here rather than being left to the server because the point
 * of a conversation is to find out what is missing *before* anything is sent. A
 * missing field must come back as a question to ask, not as a 400.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type MissingField = {
  field: string;
  label: string;
  format?: string;
  options?: string[];
  /** Present when the catalog constrains the value, so the model can ask precisely. */
  range?: { min?: number; max?: number };
};

export type InvalidField = { field: string; label: string; issue: string };

export type DraftField = {
  name: string;
  label: string;
  value: unknown;
  optional: boolean;
  /** Whether the person supplied this, or the catalog did. Shown on the confirm card. */
  origin: "supplied" | "default";
};

export type ActionDraft = {
  action: ResolvedAction;
  fields: DraftField[];
  body: Record<string, unknown>;
};

export type ValidationResult = {
  missing: MissingField[];
  invalid: InvalidField[];
  fields: DraftField[];
  body: Record<string, unknown>;
};

function inputtableFields(action: ResolvedAction): Array<Field & { name: string }> {
  return (action.operation.body.fields ?? []).filter((field): field is Field & { name: string } =>
    Boolean(field.name) && field.derived !== true,
  );
}

function describeMissing(field: Field & { name: string }): MissingField {
  return {
    field: field.name,
    label: humanize(field.name),
    ...(field.format ? { format: field.format } : {}),
    ...(field.options ? { options: field.options.map((option) => String(option)) } : {}),
    ...(field.min !== undefined || field.max !== undefined ? { range: { min: field.min, max: field.max } } : {}),
  };
}

/**
 * Checks spoken values against the catalog without sending anything.
 *
 * The uuid check earns its place: a hallucinated identifier is well-formed
 * enough to pass a naive check, reaches the server, and comes back as a
 * not-found that reads like the record was deleted. Catching it here turns it
 * into "ask who you mean", which is the actual problem.
 */
export function validateDraft(action: ResolvedAction, values: Record<string, unknown>): ValidationResult {
  const missing: MissingField[] = [];
  const invalid: InvalidField[] = [];
  const fields: DraftField[] = [];
  const body: Record<string, unknown> = {};

  for (const field of inputtableFields(action)) {
    const raw = values[field.name];
    const supplied = raw !== undefined && raw !== null && raw !== "";
    const label = humanize(field.name);

    if (!supplied) {
      if (field.default !== undefined) {
        body[field.name] = field.default;
        fields.push({ name: field.name, label, value: field.default, optional: Boolean(field.optional), origin: "default" });
      } else if (!field.optional) {
        missing.push(describeMissing(field));
      }
      continue;
    }

    if (field.kind === "select" && field.options) {
      const allowed = field.options.map((option) => String(option));
      if (!allowed.includes(String(raw))) {
        invalid.push({ field: field.name, label, issue: `Must be one of: ${allowed.join(", ")}.` });
        continue;
      }
    }
    if (field.format === "date" && !DATE_PATTERN.test(String(raw))) {
      invalid.push({ field: field.name, label, issue: "Must be an exact calendar date in YYYY-MM-DD form." });
      continue;
    }
    if (field.format === "uuid" && !UUID_PATTERN.test(String(raw))) {
      invalid.push({ field: field.name, label, issue: "Is not a real identifier. Resolve the person with find_employee first." });
      continue;
    }

    let normalized: unknown;
    try {
      normalized = normalizeValue(field, raw);
    } catch (caught) {
      invalid.push({ field: field.name, label, issue: caught instanceof Error ? caught.message : "The value could not be read." });
      continue;
    }
    if (normalized === undefined) continue;
    body[field.name] = normalized;
    fields.push({ name: field.name, label, value: normalized, optional: Boolean(field.optional), origin: "supplied" });
  }

  return { missing, invalid, fields, body };
}

/* -------------------------------------------------------------------------- */
/* Dispatch                                                                    */
/* -------------------------------------------------------------------------- */

export type TraceEntry = { tool: string; outcome: "ok" | "needs_more_info" | "draft" | "error"; detail?: string; at: number };

export type DispatchContext = {
  /** Runs a server-side read. Injected so the dispatcher can be tested without a network. */
  analyze: (tool: string, args: Record<string, unknown>) => Promise<unknown>;
  /** Hands a validated draft to the page, which asks the person to confirm it. */
  onDraft: (draft: ActionDraft) => void;
  onNavigate: (moduleId: string) => void;
  onTrace?: (entry: TraceEntry) => void;
};

/** Wording the model is given when a draft is waiting. Kept in one place so it cannot drift. */
export const AWAITING_CONFIRMATION =
  "The draft is on screen and is waiting for the person to confirm it. Nothing has been submitted. Tell them what the draft says and ask them to confirm or cancel.";

export function createDispatcher(context: DispatchContext) {
  return async function dispatch(calls: LiveFunctionCall[]): Promise<LiveFunctionResponse[]> {
    const responses: LiveFunctionResponse[] = [];
    for (const call of calls) {
      const args = (call.args ?? {}) as Record<string, unknown>;
      try {
        responses.push({ id: call.id, name: call.name, response: await route(context, call.name, args) });
      } catch (caught) {
        const detail = caught instanceof Error ? caught.message : "The tool failed.";
        context.onTrace?.({ tool: call.name, outcome: "error", detail, at: Date.now() });
        responses.push({ id: call.id, name: call.name, response: { error: detail } });
      }
    }
    return responses;
  };
}

async function route(context: DispatchContext, name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (isServerTool(name)) {
    const result = await context.analyze(name, args);
    context.onTrace?.({ tool: name, outcome: "ok", at: Date.now() });
    return { result };
  }

  if (name === OPEN_SCREEN_TOOL) {
    const moduleId = String(args.moduleId ?? "").trim();
    if (!moduleId) return { error: "No screen was named." };
    context.onNavigate(moduleId);
    context.onTrace?.({ tool: name, outcome: "ok", detail: moduleId, at: Date.now() });
    return { opened: moduleId };
  }

  const action = findAction(name);
  if (!action) {
    return { error: `There is no tool called ${name}. Do not try again with a different spelling; tell the person this is not something you can do here.` };
  }

  const validation = validateDraft(action, args);
  if (validation.missing.length > 0 || validation.invalid.length > 0) {
    context.onTrace?.({
      tool: name,
      outcome: "needs_more_info",
      detail: [...validation.missing.map((item) => item.label), ...validation.invalid.map((item) => item.label)].join(", "),
      at: Date.now(),
    });
    return {
      status: "needs_more_info",
      missing: validation.missing,
      invalid: validation.invalid,
      instruction: "Ask the person for these values in plain language. Do not guess any of them, and do not call this tool again until you have them.",
    };
  }

  context.onDraft({ action, fields: validation.fields, body: validation.body });
  context.onTrace?.({ tool: name, outcome: "draft", at: Date.now() });
  return {
    status: "awaiting_confirmation",
    draft: Object.fromEntries(validation.fields.map((field) => [field.label, field.value])),
    instruction: AWAITING_CONFIRMATION,
  };
}

/* -------------------------------------------------------------------------- */
/* Network helpers used by the page                                            */
/* -------------------------------------------------------------------------- */

type Envelope = { data?: { result?: unknown }; error?: { message?: string } };

/** Runs a read tool through the authenticated API. */
export async function analyzeViaApi(tool: string, args: Record<string, unknown>, runId: string | null): Promise<unknown> {
  const response = await fetch("/api/v1/ai/nucleus/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tool, args, ...(runId ? { runId } : {}) }),
  });
  const payload = (await response.json().catch(() => null)) as Envelope | null;
  if (!response.ok) throw new Error(payload?.error?.message ?? `The ${tool} tool failed (${response.status}).`);
  return payload?.data?.result ?? null;
}

/**
 * Performs a confirmed draft against the real endpoint.
 *
 * This is the same request the manual form issues: same path, same cookie, same
 * permission check, same audit trail. The assistant gains no authority here —
 * it only saved the person the typing.
 */
export async function submitDraft(draft: ActionDraft): Promise<{ ok: boolean; message: string }> {
  const response = await fetch(draft.action.operation.path, {
    method: draft.action.operation.method,
    headers: {
      "content-type": "application/json",
      // Consequential POSTs in this API require an idempotency key; a retry of
      // a confirmed draft must not create a second record.
      "idempotency-key": crypto.randomUUID(),
    },
    body: JSON.stringify(draft.body),
  });
  const payload = (await response.json().catch(() => null)) as { error?: { message?: string }; data?: { id?: string } } | null;
  if (!response.ok) {
    return { ok: false, message: payload?.error?.message ?? `The request was refused (${response.status}).` };
  }
  return { ok: true, message: payload?.data?.id ? `Recorded as ${payload.data.id}.` : "Recorded." };
}
