import { HttpError } from "@/server/platform/http";
import { createObjectiveSchema } from "@/server/performance/service";
import type { z } from "zod";

/**
 * Validates a POST /api/v1/objectives body. The title and the owner are both
 * required: nothing is defaulted and no owner is picked on the caller's behalf.
 */
export function parseObjectivePayload(body: unknown): z.infer<typeof createObjectiveSchema> {
  const parsed = createObjectiveSchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new HttpError({
      status: 400,
      code: "BAD_REQUEST",
      message: "The objective payload is invalid.",
      details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
    });
  }
  return parsed.data;
}
