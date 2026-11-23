import { z } from "zod";
import type { ConfigField, ConfigValues } from "./types";

/** Zod schema for one config field; used both to validate writes and to read stored values. */
export function fieldSchema(field: ConfigField): z.ZodType {
  switch (field.type) {
    case "boolean":
      return z.boolean();
    case "number":
      return z.number().int().min(field.min).max(field.max);
    case "select":
      return z.enum(field.options.map((option) => option.value) as [string, ...string[]]);
    case "multiselect": {
      const values = z.enum(field.options.map((option) => option.value) as [string, ...string[]]);
      return z
        .array(values)
        .min(field.minItems ?? 0)
        .transform((list) => [...new Set(list)]);
    }
  }
}

/** Strict schema for a write: unknown keys are rejected, every key is optional (partial update). */
export function configWriteSchema(fields: readonly ConfigField[]) {
  return z.strictObject(Object.fromEntries(fields.map((field) => [field.key, fieldSchema(field).optional()])));
}

export function defaultConfig(fields: readonly ConfigField[] = []): ConfigValues {
  return Object.fromEntries(
    fields.map((field) => [field.key, Array.isArray(field.default) ? [...field.default] : field.default]),
  ) as ConfigValues;
}

/**
 * Stored config merged over defaults, field by field. A stored value that no longer fits the field
 * (an option was removed, a range narrowed) falls back to the default instead of breaking the page.
 */
export function readConfig(fields: readonly ConfigField[] = [], stored: unknown): ConfigValues {
  const source = stored && typeof stored === "object" && !Array.isArray(stored) ? (stored as Record<string, unknown>) : {};
  const result = defaultConfig(fields);
  for (const field of fields) {
    if (!(field.key in source)) continue;
    const parsed = fieldSchema(field).safeParse(source[field.key]);
    if (parsed.success) result[field.key] = parsed.data as ConfigValues[string];
  }
  return result;
}

/** Human-readable problems for a rejected config write, keyed by field. */
export function describeConfigErrors(fields: readonly ConfigField[], error: z.ZodError) {
  return error.issues.map((issue) => {
    const key = String(issue.path[0] ?? "");
    const field = fields.find((candidate) => candidate.key === key);
    if (!field) return { field: key, issue: "This setting does not exist." };
    if (field.type === "number") return { field: key, issue: `Enter a whole number from ${field.min} to ${field.max}.` };
    if (field.type === "multiselect") return { field: key, issue: `Choose at least ${field.minItems ?? 0} of the listed options.` };
    if (field.type === "select") return { field: key, issue: "Choose one of the listed options." };
    return { field: key, issue: "Choose on or off." };
  });
}
