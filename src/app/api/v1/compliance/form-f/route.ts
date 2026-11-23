import { z } from "zod";
import { loadFormF, registerFormF, registerFormFSchema } from "@/server/compliance/form-f";
import { idempotentWrite, parseOrThrow, readRoute } from "@/server/compliance/route-support";

export const dynamic = "force-dynamic";

/**
 * Gratuity Form F nomination.
 * GET  ?employeeId= returns the particulars, nominees on record and the current registration (compliance.filing.read).
 * POST registers a nomination; shares must total 100 % (compliance.filing.write, Idempotency-Key required).
 */
export function GET(request: Request) {
  return readRoute(request, "form-f", (access, params) =>
    loadFormF(access, parseOrThrow(z.string().uuid("Choose an employee."), params.get("employeeId") ?? "", "Choose an employee.")),
  );
}

export function POST(request: Request) {
  return idempotentWrite(request, {
    operation: "compliance.form_f_register",
    type: "form-f-registration",
    schema: registerFormFSchema,
    message: "Check the nomination.",
    handle: registerFormF,
  });
}
