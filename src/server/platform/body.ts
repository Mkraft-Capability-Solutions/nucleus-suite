import "server-only";

import type { z } from "zod";
import { HttpError } from "./http";

/** Parses a JSON body against a schema; a malformed body or invalid field is a 400 listing each problem. */
export async function parseJsonBody<S extends z.ZodTypeAny>(request: Request, schema: S, what: string): Promise<z.infer<S>> {
  const raw = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError({
      status: 400,
      code: "BAD_REQUEST",
      message: `The ${what} is invalid: ${parsed.error.issues.map((issue) => `${issue.path.join(".") || "body"} — ${issue.message}`).join("; ")}`,
      details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
    });
  }
  return parsed.data;
}
