import { applyInboundEmployee, inboundEmployeeSchema, loadErpOverview } from "@/server/compliance/erp-ledger";
import { idempotentWrite, readRoute } from "@/server/compliance/route-support";

export const dynamic = "force-dynamic";

/**
 * ERP master sync.
 * GET  ERP connectors and the inbound sync log grouped per connection per day (payroll.accounting.read).
 * POST applies one ERP-pushed employee record (ERP-owned fields only; employee.write, Idempotency-Key
 *      required). The record and its outcome land in vp_erp_records; counts are never assumed.
 */
export function GET(request: Request) {
  return readRoute(request, "erp-sync", (access) => loadErpOverview(access));
}

export function POST(request: Request) {
  return idempotentWrite(request, {
    operation: "compliance.erp_inbound_employee",
    type: "erp-inbound-record",
    schema: inboundEmployeeSchema,
    message: "Check the ERP employee record.",
    handle: applyInboundEmployee,
  });
}
