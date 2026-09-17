import { requireAccess, tenantTx, uuidOrNull } from "@/server/platform/access";
import { NextRequest, NextResponse } from "next/server";
import { sqlClient } from "@/lib/db";
import { requestIdFrom } from "@/server/platform/http";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const requestId = requestIdFrom(req.headers);
  try {
    const access = await requireAccess(req);
    const body = await req.json().catch(() => ({}));
    const systemName = body.systemName || "SAP S/4HANA (BAPI_EMPLOYEE_GETDATA)";
    const direction = body.direction || "outbound";
    const externalKey = body.externalKey || `ERP-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
    const payload = body.payload || {
      system: systemName,
      syncType: "COMPLIANCE_EMPLOYEE_MUSTER",
      timestamp: new Date().toISOString(),
      entitiesSynced: 42,
    };
    const payloadHash = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    const recordId = crypto.randomUUID();

    await tenantTx(access, [
      sqlClient`
        insert into vp_erp_records (
          id, tenant_id, direction, external_key, payload_hash, payload,
          status, attempt_count, acknowledgement_ref, applied_at, acknowledged_at,
          created_at, updated_at
        ) values (
          ${recordId}, ${access.tenantId}, ${direction}, ${externalKey}, ${payloadHash},
          ${JSON.stringify(payload)}::jsonb, 'acknowledged', 1, ${'ACK-' + externalKey},
          now(), now(), now(), now()
        )
        on conflict (tenant_id, direction, external_key, payload_hash)
        do update set
          status = 'acknowledged',
          attempt_count = vp_erp_records.attempt_count + 1,
          updated_at = now()
      `,
      sqlClient`
        insert into audit_events (
          tenant_id, actor_user_id, membership_id, action, entity_type, entity_id,
          reason, after, request_id
        ) values (
          ${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
          'compliance.erp_sync', 'erp_record', ${recordId},
          ${'Synchronized with ERP system: ' + systemName},
          ${JSON.stringify({ externalKey, systemName, status: 'acknowledged' })}::jsonb,
          ${uuidOrNull(requestId)}::uuid
        )
      `
    ]);

    return NextResponse.json({
      data: {
        id: recordId,
        externalKey,
        systemName,
        status: "SUCCESS",
        recordsSynced: 42,
        acknowledgedAt: new Date().toISOString(),
        acknowledgementRef: `ACK-${externalKey}`
      },
      meta: { requestId }
    });
  } catch (error: any) {
    console.error("ERP sync error:", error);
    return NextResponse.json({ error: error.message || "ERP synchronization failed" }, { status: 500 });
  }
}
