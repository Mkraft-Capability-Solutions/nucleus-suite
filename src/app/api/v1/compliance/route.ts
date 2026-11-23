import { executeFactoryRegisterCommand, factoryRegisterCommandSchema, listFactoryRegisters } from "@/server/compliance/factory-registers";
import { idempotentWrite, readRoute } from "@/server/compliance/route-support";

export const dynamic = "force-dynamic";

/**
 * Factories Act registers (Form 18 accident notices, Form 36 inspection book).
 * GET  lists both registers (compliance.filing.read).
 * POST records one entry (compliance.filing.write, Idempotency-Key required), discriminated by `action`:
 *      `accident` (Form 18), `inspector` (Form 36 visit, also the workspace "Record inspector entry" action)
 *      or `close_inspection` (certify the inspector's directions as complied).
 */
export function GET(request: Request) {
  return readRoute(request, "factory-registers", (access) => listFactoryRegisters(access));
}

export function POST(request: Request) {
  return idempotentWrite(request, {
    operation: "compliance.factory_register",
    type: "factory-register-entry",
    schema: factoryRegisterCommandSchema,
    message: "Check the register entry.",
    handle: executeFactoryRegisterCommand,
  });
}
