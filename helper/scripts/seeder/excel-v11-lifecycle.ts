import { createHash } from "node:crypto";
import { SeedContext, uuid } from "./types";
import { readSheetData } from "./load-excel-dataset";
import { stageFromText } from "./talent-vocabulary";

/**
 * Loads Excel v1.1 sheets 59-64 (recruitment/onboarding/documents/helpdesk/approval-workflow)
 * into the live tenant, on top of the original 37-sheet load (`load-excel-dataset.ts`) and
 * domain06's synthetic talent/onboarding seed (`domain06-talent-onboarding.ts`).
 *
 * Every row is matched by the sheet's own natural-key code (CN-..., REQ-..., OF-..., CF-...,
 * PB-..., DOC-..., TK-...) so this is additive to, and never collides with, domain06's
 * synthetic MK-xxx-keyed data. Only existing tables/columns are used — nothing here touches
 * schema.sql or a migration.
 */
export async function loadExcelV11Lifecycle(ctx: SeedContext): Promise<void> {
  const { client, tenantId } = ctx;
  console.log("\n========================================================");
  console.log("== LOADING EXCEL v1.1 LIFECYCLE SHEETS (59-64) ==");
  console.log("========================================================\n");

  await client`SELECT set_config('app.platform_admin', 'true', false)`;

  /** An employee row by its Excel "Exxxx" code. Every real employee has one row. */
  async function employeeByCode(code: string | null | undefined): Promise<{ id: string; person_id: string } | null> {
    if (!code) return null;
    const rows = await client`select id, person_id from employees where tenant_id = ${tenantId} and employee_code = ${code} limit 1`;
    return (rows as Array<{ id: string; person_id: string }>)[0] ?? null;
  }

  async function employmentIdForEmployee(employeeId: string): Promise<string | null> {
    const rows = await client`select id from employments where tenant_id = ${tenantId} and employee_id = ${employeeId} order by created_at desc limit 1`;
    return (rows as Array<{ id: string }>)[0]?.id ?? null;
  }

  /**
   * `load-excel-dataset.ts` gives each of the 68 Excel employees a `user` row whose email is
   * `<name>.<empcode>@vindhya.demo`, and a membership with no `employee_id` set on it (that
   * column is only populated for the unrelated domain02 roster). The email suffix is the one
   * stable, deterministic link back to a membership id for these employees, so it is used here
   * instead of guessing at `memberships.employee_id`.
   */
  async function membershipIdForEmployeeCode(code: string | null | undefined): Promise<string | null> {
    if (!code) return null;
    const rows = await client`
      select m.id from memberships m
      join "user" u on u.id = m.user_id
      where m.tenant_id = ${tenantId} and u.email ilike ${"%." + code.toLowerCase() + "@vindhya.demo"}
      limit 1
    `;
    return (rows as Array<{ id: string }>)[0]?.id ?? null;
  }

  const picklistValue = (label: unknown): string => String(label ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const slugCode = (label: string): string => label.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  // -------------------------------------------------------------
  // Sheet 59: Candidates & Offers -> candidates, applications, offers, candidate_employee_links
  // -------------------------------------------------------------
  console.log("--> Loading 59_Candidates_and_Offers...");
  const raw59 = readSheetData("59_candidates_and_offers.json");

  const candidateIdByCode: Record<string, string> = {};
  for (const r of (await client`select id, attributes->>'candidate_code' as code from candidates where tenant_id = ${tenantId} and attributes ? 'candidate_code'`) as Array<{ id: string; code: string | null }>) {
    if (r.code) candidateIdByCode[r.code] = r.id;
  }
  const applicationIdByCandidateCode: Record<string, string> = {};
  for (const r of (await client`select a.id, a.attributes->>'candidate_code' as code from applications a where a.tenant_id = ${tenantId} and a.attributes ? 'candidate_code'`) as Array<{ id: string; code: string | null }>) {
    if (r.code) applicationIdByCandidateCode[r.code] = r.id;
  }
  const offerIdByCode: Record<string, string> = {};
  for (const r of (await client`select id, attributes->>'offer_code' as code from offers where tenant_id = ${tenantId} and attributes ? 'offer_code'`) as Array<{ id: string; code: string | null }>) {
    if (r.code) offerIdByCode[r.code] = r.id;
  }

  for (const row of raw59) {
    const candCode = row["Candidate"];
    if (typeof candCode !== "string" || !candCode.startsWith("CN-")) continue; // skips the trailing narrative row

    const reqCode = row["Requisition"];
    const reqRow = reqCode
      ? ((await client`select id, position_id, attributes from requisitions where tenant_id = ${tenantId} and attributes->>'requisition_code' = ${reqCode} limit 1`) as Array<{ id: string; position_id: string | null; attributes: Record<string, unknown> }>)[0]
      : undefined;
    if (!reqRow) {
      console.warn(`  [SKIP] candidate ${candCode}: requisition ${String(reqCode)} was not found (expected from sheet 37, already loaded).`);
      continue;
    }

    let candId = candidateIdByCode[candCode];
    if (!candId) {
      candId = uuid();
      await client`
        insert into candidates (id, tenant_id, attributes)
        values (${candId}, ${tenantId}, ${JSON.stringify({
          candidate_code: candCode,
          full_name: row["Name"],
          source: row["Source"],
          referred_by: row["Referred by"],
          stage: row["Stage"],
          rounds_completed: row["Rounds completed"],
          verdict: row["Verdict"],
          demo_point: row["Demo point"],
        })}::jsonb)
      `;
      candidateIdByCode[candCode] = candId;
    }

    let appId = applicationIdByCandidateCode[candCode];
    if (!appId) {
      appId = uuid();
      await client`
        insert into applications (id, tenant_id, candidate_id, requisition_id, attributes)
        values (${appId}, ${tenantId}, ${candId}, ${reqRow.id}, ${JSON.stringify({
          candidate_code: candCode,
          requisition_code: reqCode,
          // The sheet states a stage in its own words ("Interview complete"); the column
          // advanceApplication reads holds STAGE_FLOW values, so it is translated here and
          // the sheet's wording is kept beside it. A stage the map does not know is left
          // unset rather than guessed: the screen then says the stage is unrecorded.
          ...(stageFromText(row["Stage"]) ? { stage: stageFromText(row["Stage"]) } : {}),
          stage_label: row["Stage"] ?? null,
          rounds_completed: row["Rounds completed"],
          verdict: row["Verdict"],
        })}::jsonb)
      `;
      applicationIdByCandidateCode[candCode] = appId;
    }

    const offerCode = row["Offer"];
    let offerId: string | null = typeof offerCode === "string" ? (offerIdByCode[offerCode] ?? null) : null;

    if (typeof offerCode === "string" && !offerId) {
      // offers.position_id is NOT NULL. A "Replacement" requisition names the vacated position
      // in `against_position`; an "Addition" requisition (REQ-2026-0033, REQ-2026-0041 here)
      // does not reference any position at all, and requisitions.position_id is null for every
      // sheet-37 row too — there is no real position to point the offer at without inventing
      // one, so that offer (and any candidate_employee_links row that needs it) is skipped.
      const againstPosition = reqRow.attributes?.against_position as string | undefined;
      const positionId =
        reqRow.position_id ??
        (againstPosition
          ? ((await client`select id from positions where tenant_id = ${tenantId} and attributes->>'code' = ${againstPosition} limit 1`) as Array<{ id: string }>)[0]?.id ?? null
          : null);

      if (!positionId) {
        console.warn(`  [SKIP] offer ${offerCode} for ${candCode}: requisition ${reqCode} (type=${String(reqRow.attributes?.type)}) names no position, and offers.position_id is NOT NULL.`);
      } else {
        offerId = uuid();
        await client`
          insert into offers (id, tenant_id, application_id, position_id, attributes)
          values (${offerId}, ${tenantId}, ${appId}, ${positionId}, ${JSON.stringify({
            offer_code: offerCode,
            offered_ctc_minor: row["Offered CTC (INR pa)"] != null ? Math.round(Number(row["Offered CTC (INR pa)"]) * 100) : null,
            offer_status: row["Offer status"],
            proposed_joining_date: row["Proposed joining date"],
            resulting_employee_code: row["Becomes employee"],
            demo_point: row["Demo point"],
          })}::jsonb)
        `;
        offerIdByCode[offerCode] = offerId;
      }
    }

    // candidate_employee_links needs application_id, candidate_id, employee_id, offer_id and
    // person_id all NOT NULL, so it can only be written once the candidate has both a real
    // employee (an already-loaded Excel employee) and a real offer (see the skip above).
    const becomesCode = row["Becomes employee"];
    if (offerId && typeof becomesCode === "string" && becomesCode) {
      const emp = await employeeByCode(becomesCode);
      if (!emp) {
        console.warn(`  [SKIP] candidate_employee_links for ${candCode}: employee ${becomesCode} was not found.`);
      } else {
        const already = await client`select 1 from candidate_employee_links where tenant_id = ${tenantId} and candidate_id = ${candId} and employee_id = ${emp.id} limit 1`;
        if (already.length === 0) {
          await client`
            insert into candidate_employee_links (id, tenant_id, application_id, candidate_id, employee_id, offer_id, person_id, attributes)
            values (${uuid()}, ${tenantId}, ${appId}, ${candId}, ${emp.id}, ${offerId}, ${emp.person_id}, ${JSON.stringify({ candidate_code: candCode, offer_code: offerCode })}::jsonb)
          `;
        }
      }
    } else if (typeof becomesCode === "string" && becomesCode && !offerId) {
      console.warn(`  [SKIP] candidate_employee_links for ${candCode}: no offer row exists to satisfy offers_id NOT NULL (see the offer skip above).`);
    }
  }

  // -------------------------------------------------------------
  // Sheet 60: Confirmations -> employee_changes
  // -------------------------------------------------------------
  console.log("--> Loading 60_Confirmations...");
  const raw60 = readSheetData("60_confirmations.json");

  // No code under src/server reads or writes `employee_changes` at all: the live confirmation
  // feature (src/server/lifecycle/confirmation.ts, FRM-LCY-02) models a confirmation review as a
  // `lifecycle_events` row with attributes.kind = 'confirmation_review', not as an
  // `employee_changes` row. The only real convention on this table found in the tenant's own
  // data is `attributes.change_type` / `attributes.effective_date` (used by "initial_appointment"
  // rows elsewhere), which is mirrored here; there is no confirmation-specific convention to copy
  // beyond that, so the remaining keys are self-describing rather than invented to look official.
  const existingChangeCodes = new Set(
    ((await client`select attributes->>'confirmation_record' as code from employee_changes where tenant_id = ${tenantId} and attributes ? 'confirmation_record'`) as Array<{ code: string | null }>)
      .map((r) => r.code)
      .filter((c): c is string => Boolean(c)),
  );

  for (const row of raw60) {
    const recordCode = row["Record"];
    const empCode = row["Employee code"];
    if (typeof recordCode !== "string" || typeof empCode !== "string") continue; // skips the trailing narrative row
    if (existingChangeCodes.has(recordCode)) continue;

    const emp = await employeeByCode(empCode);
    if (!emp) {
      console.warn(`  [SKIP] employee_changes ${recordCode}: employee ${empCode} was not found.`);
      continue;
    }
    const statusText = String(row["Status"] ?? "");
    const confirmedOn = statusText.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;

    await client`
      insert into employee_changes (id, tenant_id, employee_id, attributes)
      values (${uuid()}, ${tenantId}, ${emp.id}, ${JSON.stringify({
        change_type: "confirmation",
        effective_date: confirmedOn,
        confirmation_record: recordCode,
        date_of_joining: row["Date of joining"],
        probation_months: row["Probation months"],
        confirmation_due: row["Confirmation due"],
        mandatory_induction_complete: row["Mandatory induction complete"] === "Y",
        manager_recommendation: row["Manager recommendation"],
        action: row["Action"],
        status: row["Status"],
        blocked_by: row["Blocked by"],
        letter_issued_code: row["Letter issued"],
        demo_point: row["Demo point"],
      })}::jsonb)
    `;
  }

  // -------------------------------------------------------------
  // Sheet 61: Preboarding Chain -> onboarding_instances + onboarding_tasks
  // -------------------------------------------------------------
  console.log("--> Loading 61_Preboarding_Chain...");
  const raw61 = readSheetData("61_preboarding_chain.json");

  const chains = new Map<string, Array<Record<string, unknown>>>();
  for (const row of raw61) {
    const record = row["Record"];
    if (typeof record !== "string" || !row["Candidate"]) continue; // skips the trailing narrative row
    if (!chains.has(record)) chains.set(record, []);
    chains.get(record)!.push(row);
  }

  // Reuse the tenant's existing onboarding template (domain06 already creates one) rather than
  // seeding a second one.
  const onboardingTemplateId = ((await client`select id from onboarding_templates where tenant_id = ${tenantId} limit 1`) as Array<{ id: string }>)[0]?.id ?? null;

  const instanceIdByChainRecord: Record<string, string> = {};
  for (const r of (await client`select id, attributes->>'chain_record' as code from onboarding_instances where tenant_id = ${tenantId} and attributes ? 'chain_record'`) as Array<{ id: string; code: string | null }>) {
    if (r.code) instanceIdByChainRecord[r.code] = r.id;
  }

  for (const [record, steps] of chains) {
    if (instanceIdByChainRecord[record]) continue; // instance + its tasks already loaded
    const first = steps[0];
    const candCode = first["Candidate"] as string;

    const candRow = (await client`select id from candidates where tenant_id = ${tenantId} and attributes->>'candidate_code' = ${candCode} limit 1`) as Array<{ id: string }>;
    const candId = candRow[0]?.id ?? null;
    const link = candId
      ? ((await client`select employee_id from candidate_employee_links where tenant_id = ${tenantId} and candidate_id = ${candId} limit 1`) as Array<{ employee_id: string }>)[0]
      : undefined;
    const employeeId = link?.employee_id ?? null;

    // onboarding_instances.employee_id and .employment_id are both NOT NULL. Basanti Naik
    // (CN-2026-0211, record PB-2026-0071) never becomes an employee in this dataset — her offer
    // is held by the sanctioned-strength block — so there is no employee/employment row to hang
    // an instance off without fabricating one. Per instructions that case is skipped and reported
    // rather than invented; only Abhinav Rastogi's completed chain (PB-2026-0066 -> E1066) gets a
    // real instance.
    if (!employeeId) {
      console.warn(`  [SKIP] onboarding chain ${record} (${candCode}, ${steps.length} step(s)): candidate has no resulting employee — onboarding_instances.employee_id/employment_id are NOT NULL and a fabricated employee would violate "no invented values".`);
      continue;
    }
    const employmentId = await employmentIdForEmployee(employeeId);
    if (!employmentId || !onboardingTemplateId) {
      console.warn(`  [SKIP] onboarding chain ${record}: missing employment record or tenant onboarding_template.`);
      continue;
    }

    const instanceId = uuid();
    await client`
      insert into onboarding_instances (id, tenant_id, employee_id, employment_id, onboarding_template_id, attributes)
      values (${instanceId}, ${tenantId}, ${employeeId}, ${employmentId}, ${onboardingTemplateId}, ${JSON.stringify({
        chain_record: record,
        candidate_code: candCode,
        offer_code: first["Offer"],
        joining_date: first["Joining date"],
        location: first["Location"],
      })}::jsonb)
    `;
    instanceIdByChainRecord[record] = instanceId;

    for (const step of steps) {
      const ownerCode = step["Owner"] as string | null;
      const assignedMembershipId = ownerCode && ownerCode !== "System" ? await membershipIdForEmployeeCode(ownerCode) : null;
      await client`
        insert into onboarding_tasks (id, tenant_id, onboarding_instance_id, assigned_membership_id, attributes)
        values (${uuid()}, ${tenantId}, ${instanceId}, ${assignedMembershipId}, ${JSON.stringify({
          chain_step: step["Chain step"],
          owner_code: ownerCode,
          due: step["Due"],
          status: step["Status"],
          blocks_joining: step["Blocks joining"] === "Y",
          demo_point: step["Demo point"],
        })}::jsonb)
      `;
    }
  }

  // -------------------------------------------------------------
  // Sheet 62: Documents -> documents + document_types
  // -------------------------------------------------------------
  console.log("--> Loading 62_Documents...");
  const raw62 = readSheetData("62_documents.json");

  const docTypeIdByCode: Record<string, string> = {};
  for (const r of (await client`select id, attributes->>'code' as code from document_types where tenant_id = ${tenantId}`) as Array<{ id: string; code: string | null }>) {
    if (r.code) docTypeIdByCode[r.code] = r.id;
  }
  const existingDocCodes = new Set(
    ((await client`select attributes->>'document_code' as code from documents where tenant_id = ${tenantId} and attributes ? 'document_code'`) as Array<{ code: string | null }>)
      .map((r) => r.code)
      .filter((c): c is string => Boolean(c)),
  );

  for (const row of raw62) {
    const docCode = row["Document"];
    const docClass = row["Document class"];
    if (typeof docCode !== "string" || typeof docClass !== "string") continue; // skips the trailing narrative row
    if (existingDocCodes.has(docCode)) continue;

    // The tenant's 7 existing document_types (POLICY, OFFER, APPOINT, ID_PROOF, CERT, LETTER,
    // PAYSLIP) are generic buckets that don't correspond 1:1 to this sheet's document classes
    // (Aadhaar, PAN, Medical fitness certificate, ...), so a type is created per distinct class
    // actually present in the sheet, coded as a slug of the class name, and reused across rows.
    const typeCode = slugCode(docClass);
    let typeId = docTypeIdByCode[typeCode];
    if (!typeId) {
      typeId = uuid();
      await client`insert into document_types (id, tenant_id, attributes) values (${typeId}, ${tenantId}, ${JSON.stringify({ code: typeCode, name: docClass })}::jsonb)`;
      docTypeIdByCode[typeCode] = typeId;
    }

    const empCode = row["Employee code"];
    const emp = typeof empCode === "string" ? await employeeByCode(empCode) : null;
    if (typeof empCode === "string" && !emp) {
      console.warn(`  [WARN] document ${docCode}: employee ${empCode} was not found; storing without employee_id.`);
    }
    // Every row in this sheet names an "Employee code", so candidate_id stays null throughout —
    // the candidate_id fallback described in the brief has no row to exercise here.

    await client`
      insert into documents (id, tenant_id, document_type_id, employee_id, attributes)
      values (${uuid()}, ${tenantId}, ${typeId}, ${emp?.id ?? null}, ${JSON.stringify({
        document_code: docCode,
        employee_code: empCode,
        reference_masked: row["Reference (masked)"],
        uploaded_on: row["Uploaded on"],
        verified_by: row["Verified by"],
        verification_status: row["Verification status"],
        expires_on: row["Expires on"],
        mandatory: row["Mandatory"] === "Y",
        blocks: row["Blocks"],
        demo_point: row["Demo point"],
      })}::jsonb)
    `;
  }

  // -------------------------------------------------------------
  // Sheet 63: Helpdesk Tickets -> hrms_operation_records + hrms_operation_events
  // -------------------------------------------------------------
  console.log("--> Loading 63_Helpdesk_Tickets...");
  const raw63 = readSheetData("63_helpdesk_tickets.json");

  // The `tickets` operational-catalog resource (src/lib/operational-catalog.ts) is not backed by
  // workflow_instances/step_instances; mutateOperationalRecord (src/server/workflows/
  // operational-service.ts) writes it as a row in the generic `hrms_operation_records` table plus
  // one `hrms_operation_events` row per transition, gated by an Access object, an idempotency key
  // and a pg advisory lock that only make sense inside a live HTTP request. That path cannot be
  // called from a standalone seed script, so this inserts directly into the same two tables in
  // the same shape it would have produced, per the documented fallback.
  const existingTicketCodes = new Set(
    ((await client`select data->>'ticketCode' as code from hrms_operation_records where tenant_id = ${tenantId} and resource = 'tickets' and data ? 'ticketCode'`) as Array<{ code: string | null }>)
      .map((r) => r.code)
      .filter((c): c is string => Boolean(c)),
  );

  for (const row of raw63) {
    const ticketCode = row["Ticket"];
    const raisedByCode = row["Raised by"];
    if (typeof ticketCode !== "string" || typeof raisedByCode !== "string") continue; // skips the trailing narrative row
    if (existingTicketCodes.has(ticketCode)) continue;

    const raiser = await employeeByCode(raisedByCode);
    const raiserMembershipId = await membershipIdForEmployeeCode(raisedByCode);
    if (!raiser || !raiserMembershipId) {
      console.warn(`  [SKIP] ticket ${ticketCode}: raiser ${raisedByCode} has no resolvable employee/membership.`);
      continue;
    }
    const assignedToCode = row["Assigned to"];
    const assignee = typeof assignedToCode === "string" ? await employeeByCode(assignedToCode) : null;
    const assigneeMembershipId = typeof assignedToCode === "string" ? await membershipIdForEmployeeCode(assignedToCode) : null;

    // PL_TICKET_CATEGORY/PL_PRIORITY/PL_TICKET_STATUS values (src/lib/picklists.ts) are all a
    // single lower-cased, underscore-joined word for exactly the labels this sheet uses
    // ("Attendance" -> attendance, "Awaiting employee" -> awaiting_employee), so one transform
    // covers category, priority and status without a hand-built lookup table.
    const status = picklistValue(row["Status"]);
    const recordId = uuid();
    // `subCategory` is a required field on the real create form, but the sheet carries no such
    // value and one is not invented for it; this record is written directly to storage, bypassing
    // that validation, so its absence here is a deliberate, reported gap rather than a bug.
    const data: Record<string, unknown> = {
      ticketCode, // seed-only tracking key so reruns are idempotent; not a declared catalog field
      employeeId: raiser.id,
      category: picklistValue(row["Category"]),
      priority: picklistValue(row["Priority"]),
      subject: row["Subject"],
      description: row["Subject"],
      isConfidential: false,
      dueDate: row["SLA due"] ?? null,
      ...(assignee ? { ownerEmployeeId: assignee.id } : {}),
    };

    await client`
      insert into hrms_operation_records (id, tenant_id, resource, employee_id, status, data, created_by_membership_id)
      values (${recordId}, ${tenantId}, 'tickets', ${raiser.id}, ${status}, ${JSON.stringify(data)}::jsonb, ${raiserMembershipId})
    `;

    if (row["Resolution"]) {
      const action = status === "resolved" ? "resolve" : status === "closed" ? "close" : status === "awaiting_employee" ? "awaitEmployee" : "reply";
      const idempotencyKey = `seed-v1.1-ticket-${ticketCode}`;
      const response = { ...data, id: recordId, status, version: 1, createdByMembershipId: raiserMembershipId };
      const fingerprint = createHash("sha256").update(JSON.stringify({ resource: "tickets", id: recordId, action, data })).digest("hex");
      await client`
        insert into hrms_operation_events (id, tenant_id, record_id, actor_membership_id, action, reason, idempotency_key, fingerprint, response)
        values (${uuid()}, ${tenantId}, ${recordId}, ${assigneeMembershipId ?? raiserMembershipId}, ${action}, ${row["Resolution"]}, ${idempotencyKey}, ${fingerprint}, ${JSON.stringify(response)}::jsonb)
        on conflict (tenant_id, idempotency_key) do nothing
      `;
    }
  }

  // -------------------------------------------------------------
  // Sheet 64: Approval Workflows -> nothing written
  // -------------------------------------------------------------
  console.log("--> Reviewing 64_Approval_Workflows (documentation only, no rows expected)...");
  const raw64 = readSheetData("64_approval_workflows.json");
  for (const row of raw64) {
    const code = row["Workflow"];
    if (typeof code !== "string") continue; // skips the trailing narrative row
    // Every one of W-01..W-10 documents the approval chain of a feature that already has its own
    // dedicated implementation and its own live demo record loaded by an earlier sheet (leave
    // requests, overtime, gate passes, loans, full & final settlement, manpower requisitions,
    // attendance regularisation) — none of it runs through workflow_definitions/workflow_instances,
    // and none of it is a chain the app does not already enforce in code. Creating a
    // workflow_definitions row here would model a chain the engine never reads, so nothing is
    // written for this sheet; each row is only acknowledged in the log for the audit trail.
    console.log(`    [DOC] ${code} ${String(row["Name"])}: ${String(row["Live demo record"])}`);
  }

  console.log("\n✓ Excel v1.1 lifecycle sheets (59-64) processed.\n");
}
