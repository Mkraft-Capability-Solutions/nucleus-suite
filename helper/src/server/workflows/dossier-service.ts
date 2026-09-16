import "server-only";
import { workflowDatabaseError } from "./database-error";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { dossierResources } from "@/lib/dossier-catalog";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { HttpError, parsePagination } from "@/server/platform/http";
import { validator } from "./operational-validation";
import { decryptFields, encryptFields } from "./field-encryption";

function definitionFor(access: Access, resource: string, write = false) {
  if (!Object.hasOwn(dossierResources, resource)) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "Unknown employee dossier section." });
  const definition = dossierResources[resource];
  enforce(access.context, "employee.dossier." + (write ? "write" : "read"), { tenantId: access.tenantId, sensitivity: definition.sensitive ? [definition.sensitive] : [] });
  return definition;
}

export async function listDossier(access: Access, resource: string, params: URLSearchParams) {
  const definition = definitionFor(access, resource);
  const { page, pageSize } = parsePagination(params);
  const reference = params.get(resource === "assignments" ? "employmentId" : "employeeId");
  if (reference && !z.string().uuid().safeParse(reference).success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Choose a valid employee or employment reference." });
  const column = resource === "assignments" ? "employment_id" : "employee_id";
  const [result, counted] = await tenantTx(access, [
    sqlClient.query('select id,version,attributes,record_status from "' + definition.table + '" where tenant_id=$1 and ($2::uuid is null or "' + column + '"=$2::uuid) order by created_at desc,id desc limit $3 offset $4', [access.tenantId, reference, pageSize + 1, (page - 1) * pageSize]),
    sqlClient.query('select count(*)::int as total from "' + definition.table + '" where tenant_id=$1 and ($2::uuid is null or "' + column + '"=$2::uuid)', [access.tenantId, reference]),
  ]);
  const rows = result as Array<{ id: string; version: number; attributes: Record<string, unknown>; record_status: string }>;
  const total = (counted as Array<{ total: number }>)[0]?.total ?? rows.length;
  const items = rows.slice(0, pageSize).map(row => ({ ...(definition.sensitive && row.attributes.format === "aes-256-gcm-v1" ? decryptFields(row.attributes, access.tenantId + ":" + resource + ":" + row.id) : row.attributes), id: row.id, version: row.version, status: row.record_status }));
  return { items, total, nextCursor: rows.length > pageSize ? Buffer.from(JSON.stringify({ page: page + 1 })).toString("base64url") : null };
}

export async function saveDossier(access: Access, resource: string, args: { id?: string; version?: number; input: unknown; key: string }) {
  const definition = definitionFor(access, resource, true);
  const schema = z.object(Object.fromEntries(definition.fields.map(field => [field.name!, validator(field)]))).strict();
  const parsed = schema.safeParse(args.input);
  if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Check the employee details.", details: parsed.error.issues.map(issue => ({ field: issue.path.join("."), issue: issue.message })) });
  const data = parsed.data;
  if (data.effectiveTo && String(data.effectiveTo) < String(data.effectiveFrom)) throw new HttpError({ status: 422, code: "INVALID_DATES", message: "The effective end date cannot precede the start date." });
  if (data.birthDate && String(data.birthDate) > new Date().toISOString().slice(0, 10)) throw new HttpError({ status: 422, code: "INVALID_BIRTH_DATE", message: "Birth date cannot be in the future." });
  const id = args.id ?? randomUUID();
  const fingerprint = createHash("sha256").update(JSON.stringify({ resource, id: args.id, version: args.version, data })).digest("hex");
  const encoded = definition.sensitive ? encryptFields(data, access.tenantId + ":" + resource + ":" + id) : data;
  const columns = Object.entries(definition.columns);
  // FRM-PPL-02 derives the band from the designation rather than asking for it, so `gradeId`
  // is optional on the form. `employee_assignments.grade_id` is still NOT NULL, so an omitted
  // grade is resolved from the position it is being assigned to — its own grade, else its job
  // profile's default. Deriving it is the workbook's rule; defaulting to "any grade" would not be.
  if (resource === "assignments" && !data.gradeId && typeof data.positionId === "string") {
    const [gradeRows] = await tenantTx(access, [
      sqlClient`select coalesce(p.grade_id, jp.default_grade_id) as grade_id
        from positions p left join job_profiles jp on jp.tenant_id = p.tenant_id and jp.id = p.job_profile_id
        where p.tenant_id = ${access.tenantId} and p.id = ${data.positionId as string} limit 1`,
    ]);
    const derived = (gradeRows as Array<{ grade_id: string | null }>)[0]?.grade_id ?? null;
    if (!derived) {
      throw new HttpError({
        status: 422,
        code: "GRADE_UNRESOLVED",
        message: "This assignment has no grade, and the position it names carries none to derive it from.",
        details: [{ field: "gradeId", issue: "Set a grade on the position or its job profile, or name the grade on the assignment." }],
      });
    }
    data.gradeId = derived;
  }
  const values: unknown[] = [access.tenantId, access.context.membershipId, resource, id, JSON.stringify(encoded), args.version ?? 0, args.key, fingerprint, JSON.stringify(data), access.context.actorUserId];
  columns.forEach(([name]) => values.push(data[name] ?? null));
  const bindings = columns.map((_, i) => "$" + (11 + i) + "::uuid");
  const table = '"' + definition.table + '"';
  const overlap = resource === "assignments" ? `and not exists(select 1 from employee_assignments a where a.tenant_id=$1::uuid and a.employment_id=($9::jsonb->>'employmentId')::uuid and a.id<>$4::uuid and a.record_status='active'
    and coalesce(a.attributes->>'effectiveTo','9999-12-31') >= $9::jsonb->>'effectiveFrom' and coalesce($9::jsonb->>'effectiveTo','9999-12-31') >= a.attributes->>'effectiveFrom')` : "";
  const write = args.id
    ? `update ${table} set attributes=$5::jsonb, version=version+1, updated_at=now(), ${columns.map(([, column], i) => '"' + column + '"=' + bindings[i]).join(",")}
       where tenant_id=$1::uuid and id=$4::uuid and version=$6::int and not exists(select 1 from prior) ${overlap} returning id,version,attributes`
    : `insert into ${table}(tenant_id,id,attributes,${columns.map(([, column]) => '"' + column + '"').join(",")}) select $1::uuid,$4::uuid,$5::jsonb,${bindings.join(",")} where not exists(select 1 from prior) ${overlap} returning id,version,attributes`;
  const results = await tenantTx(access, [
    sqlClient`select pg_advisory_xact_lock(hashtextextended(${"hrms.dossier:" + access.tenantId}, 0))`,
    sqlClient.query(`with typed as (select $6::int, $9::jsonb), prior as (select fingerprint,response,actor_membership_id from hrms_dossier_receipts where tenant_id=$1::uuid and idempotency_key=$7),
      changed as (${write}),
      receipted as (insert into hrms_dossier_receipts(tenant_id,actor_membership_id,idempotency_key,fingerprint,response) select $1::uuid,$2::uuid,$7,$8,jsonb_build_object('id',id,'version',version,'attributes',attributes) from changed returning response),
      audited as (insert into audit_events(tenant_id,actor_user_id,membership_id,action,entity_type,entity_id,reason,after)
        select $1::uuid,$10,$2::uuid,'dossier.' || $3,'employee_dossier',id,'Employee dossier maintained',jsonb_build_object('version',version,'section',$3) from changed)
      select response,false conflict from receipted union all select response,(fingerprint<>$8 or actor_membership_id<>$2::uuid) conflict from prior`, values),
  ]).catch(workflowDatabaseError);
  const result = (results[1] as Array<{ response: { id: string; version: number; attributes: Record<string, unknown> }; conflict: boolean }>)[0];
  if (result?.conflict) throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This request key belongs to a different request." });
  if (!result) throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "The record changed or the assignment overlaps an existing effective period. Refresh and review the history." });
  const row = result.response;
  return { ...(definition.sensitive ? decryptFields(row.attributes, access.tenantId + ":" + resource + ":" + row.id) : row.attributes), id: row.id, version: row.version };
}
