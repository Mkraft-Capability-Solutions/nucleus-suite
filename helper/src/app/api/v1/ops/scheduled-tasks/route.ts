import { NextResponse } from "next/server";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, requireAccess, tenantTx } from "@/server/platform/access";
import { fail, HttpError, requestIdFrom } from "@/server/platform/http";
import { dedupeKey } from "@/server/jobs/worker";
import { isKnownTaskType } from "@/server/jobs/handlers";
import { listScheduledTasks } from "@/server/ops/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const tasks = await listScheduledTasks(access, new URL(request.url).searchParams.get("status"));
    return NextResponse.json({ data: tasks, meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}

const bodySchema = z.object({
  taskType: z.string().trim().min(1).max(80),
  payload: z.record(z.string(), z.unknown()).default({}),
  availableAt: z.string().datetime({ offset: true }).optional(),
  maxAttempts: z.number().int().min(1).max(20).default(10),
  dedupe: z.boolean().default(true),
});

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    enforce(access.context, "tenant.manage", { tenantId: access.tenantId });
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A task type and payload are required." });
    if (!isKnownTaskType(parsed.data.taskType)) {
      throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: `Unknown task type: ${parsed.data.taskType}.` });
    }
    const key = dedupeKey(parsed.data.taskType, parsed.data.payload);
    if (parsed.data.dedupe) {
      const [existing] = await tenantTx(access, [
        sqlClient`
          select id from scheduled_tasks where tenant_id = ${access.tenantId} and task_type = ${parsed.data.taskType}
            and status in ('pending', 'running') and payload = ${JSON.stringify(parsed.data.payload)}::jsonb limit 1
        `,
      ]);
      const duplicate = (existing as unknown[])[0];
      if (duplicate) {
        throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "An identical pending task already exists." });
      }
    }
    const id = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`
        insert into scheduled_tasks (id, tenant_id, task_type, payload, available_at, max_attempts)
        values (${id}, ${access.tenantId}, ${parsed.data.taskType}, ${JSON.stringify({ ...parsed.data.payload, _dedupe_key: key })}::jsonb,
          ${parsed.data.availableAt ?? new Date().toISOString()}, ${parsed.data.maxAttempts})
    `,
    ]);
    return NextResponse.json(
      { data: { type: "scheduled-task", id, taskType: parsed.data.taskType }, meta: { requestId } },
      { status: 201, headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}
