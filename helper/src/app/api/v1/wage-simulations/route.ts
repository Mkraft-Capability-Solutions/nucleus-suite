import { createHash } from "node:crypto";
import { z } from "zod";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { collection, fail, HttpError, ok, parsePagination, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { simulateWageBase } from "@/server/payroll/service";
import {
  adoptSimulation,
  listSimulations,
  getSimulation,
  simulateStructure,
  simulateStructureSchema,
  simulationActionSchema,
  submitSimulation,
  SIMULATION_STATES,
  type SimulationState,
} from "@/server/payroll/simulator";

export const dynamic = "force-dynamic";

/**
 * Wage simulations.
 *
 * SCR-052 adds the salary-structure simulator (`simulate` / `submit` / `adopt`)
 * alongside the original wage-base simulation, which is NOT superseded: a body
 * carrying `basicMinor` + `dearnessMinor` still runs `wage-base/v1` with exactly the
 * request and response it always had, including its lack of an Idempotency-Key
 * requirement. The SCR-052 actions are new consequential writes and do require one.
 *
 * There is no `/wage-simulations/:id` route, so a single record is read through
 * `?simulationId=`, and the state transitions are actions on this collection.
 */

/** Unchanged SCR-050 contract: basic + dearness, `wage-base/v1`, non-posting. */
const wageBaseSchema = z.object({
  basicMinor: z.number().int().min(0),
  dearnessMinor: z.number().int().min(0),
  scenario: z.string().trim().min(1).max(120),
});

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;

    const simulationId = params.get("simulationId");
    if (simulationId) {
      const detail = await getSimulation(access, simulationId);
      const { id, ...attributes } = detail;
      return ok({
        type: "wage-simulation",
        id,
        version: 1,
        attributes,
        requestId,
        self: `/api/v1/wage-simulations?simulationId=${encodeURIComponent(id)}`,
      });
    }

    const rawState = params.get("state");
    if (rawState && !(SIMULATION_STATES as readonly string[]).includes(rawState)) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: `Unknown simulation state "${rawState}".`,
        details: [{ field: "state", issue: `Expected one of ${SIMULATION_STATES.join(", ")}.` }],
      });
    }
    const { page, pageSize } = parsePagination(params);
    const { items, total } = await listSimulations(access, { state: (rawState as SimulationState | null) ?? null, page, pageSize });
    return collection({
      type: "wage-simulation",
      items: items.map(({ id, ...rest }) => ({ id, version: 1, ...rest })),
      requestId,
      self: "/api/v1/wage-simulations",
      total,
      nextCursor: page * pageSize < total ? Buffer.from(JSON.stringify({ page: page + 1 }), "utf8").toString("base64url") : null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const body: unknown = await request.json().catch(() => null);
    const shape = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};

    // Legacy wage-base simulation: same request, same response, same lack of an
    // Idempotency-Key requirement it shipped with. Recognised by its own fields.
    if (shape.dearnessMinor !== undefined && shape.lines === undefined && shape.action === undefined) {
      const parsed = wageBaseSchema.safeParse(body);
      if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Wage inputs and a scenario name are required." });
      const result = await simulateWageBase(access, parsed.data, requestId);
      return ok({ type: "wage-simulation", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/wage-simulations/${result.id}` });
    }

    const key = requireIdempotencyKey(request.headers);

    if (shape.action === "submit" || shape.action === "adopt") {
      const parsed = simulationActionSchema.safeParse(body);
      if (!parsed.success) {
        throw new HttpError({
          status: 400,
          code: "BAD_REQUEST",
          message: "A simulation id and an action (submit or adopt) are required.",
          details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
        });
      }
      const operation = parsed.data.action === "submit" ? "payroll.structure_simulation_submit" : "payroll.structure_simulation_adopt";
      const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
      const prior = await checkIdempotency(access, operation, key, fingerprint);
      if (prior.outcome === "conflict") {
        throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
      }
      const detail = parsed.data.action === "submit"
        ? await submitSimulation(access, parsed.data, requestId)
        : await adoptSimulation(access, parsed.data, requestId);
      await storeIdempotency(access, operation, key, fingerprint, 200, detail.id);
      const { id, ...attributes } = detail;
      return ok({
        type: "wage-simulation",
        id,
        version: 1,
        attributes,
        requestId,
        self: `/api/v1/wage-simulations?simulationId=${encodeURIComponent(id)}`,
      });
    }

    const parsed = simulateStructureSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "A scenario name and at least one proposed component line are required.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, "payroll.structure_simulate", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    const detail = await simulateStructure(access, parsed.data, requestId);
    await storeIdempotency(access, "payroll.structure_simulate", key, fingerprint, 201, detail.id);
    const { id, ...attributes } = detail;
    return ok({
      type: "wage-simulation",
      id,
      version: 1,
      attributes,
      requestId,
      self: `/api/v1/wage-simulations?simulationId=${encodeURIComponent(id)}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
