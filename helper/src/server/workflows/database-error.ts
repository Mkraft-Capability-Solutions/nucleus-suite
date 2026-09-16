import { HttpError } from "@/server/platform/http";

export function workflowDatabaseError(error: unknown): never {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  if (code === "23503") throw new HttpError({ status: 422, code: "INVALID_REFERENCE", message: "One of the linked records is unavailable in this workspace. Refresh the reference choices." });
  if (code === "23505") throw new HttpError({ status: 409, code: "DUPLICATE_RECORD", message: "A record with this code or reference already exists." });
  if (code === "23514") throw new HttpError({ status: 422, code: "INVALID_RECORD", message: "The record violates a data constraint. Review the dates, amounts and status." });
  throw error;
}
