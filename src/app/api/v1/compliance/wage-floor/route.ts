import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, requestIdFrom } from "@/server/platform/http";
import { getWageFloorConfiguration, simulateWageFloor, wageFloorInputSchema } from "@/server/compliance/wage-floor";

export const dynamic = "force-dynamic";

/** The stored rule pack: its code, version, effective date, floor and rates. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const configuration = await getWageFloorConfiguration(access);
    return NextResponse.json(
      { data: { ...configuration, configured: configuration.floorPercent !== null }, meta: { requestId } },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}

/**
 * Simulates one salary structure against the stored pack. When no wage-floor
 * percentage is configured the route returns no result at all rather than
 * computing against an assumed statutory figure.
 */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = wageFloorInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "The wage-floor payload is invalid.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const configuration = await getWageFloorConfiguration(access);
    const result =
      configuration.floorPercent === null
        ? null
        : simulateWageFloor(parsed.data, configuration.rates, configuration.floorPercent);
    return NextResponse.json(
      {
        data: {
          configured: configuration.floorPercent !== null,
          packCode: configuration.packCode,
          packVersion: configuration.packVersion,
          effectiveFrom: configuration.effectiveFrom,
          floorPercent: configuration.floorPercent,
          input: parsed.data,
          result,
        },
        meta: { requestId },
      },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}
