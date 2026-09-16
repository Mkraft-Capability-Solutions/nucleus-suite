/**
 * Repairs talent rows that were seeded in a vocabulary the application does not read.
 *
 * Three seeders wrote the same tables three different ways. `src/server/talent/service.ts`
 * is the one that counts: it is what the endpoints read and write. Rows written by the
 * Excel loader (`scripts/seeder/load-excel-dataset.ts`) carry the workbook's own column
 * text instead. The endpoints are not broken; they are refusing data that never spoke
 * their language:
 *
 * - `courses.attributes.code` is how every course is referenced. Loader rows have none, so
 *   the Learning screen disables Enroll on them, `POST /api/v1/enrollments` can never
 *   resolve one, and `define_certification` answers "No course carries this code."
 * - `enrollments.attributes.course_code` keys an enrollment to its course. Loader rows key
 *   it by `item` (the course title) and carry a title-case `status`.
 * - `applications.attributes.stage` must hold a value in advanceApplication's STAGE_FLOW.
 *   Prose like "Interview complete" is in none of them, so Advance refuses with
 *   "Stages advance one step at a time by human decision."
 * - `requisitions.attributes.status` must hold the approval vocabulary. Prose like
 *   "Open - screening" means referCandidate refuses: "Referrals need an open requisition."
 * - `referrals.attributes.status` drives award maturity and is missing on loader rows.
 *
 * Every mapping below is derived from a value already in the row. Nothing is invented: a
 * field with no source in the data is left unset and reported, and the original text is
 * preserved alongside the canonical value (`status_label`, `stage_label`) so the demo
 * narrative is not lost.
 *
 * Dry run by default - it prints what it would change and writes nothing:
 *
 *   npx tsx scripts/repair-talent-vocabulary.ts
 *   npx tsx scripts/repair-talent-vocabulary.ts --apply
 *
 * Idempotent: a row already in the canonical vocabulary is skipped, so re-running is safe.
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

import {
  KNOWN_STAGES,
  courseCodeFromTitle,
  enrollmentStatusFromText,
  looksLikeCode,
  requisitionStatusFromText,
  stageFromText,
} from "./seeder/talent-vocabulary";

config({ path: [".env.local", ".env"], quiet: true });

const TENANT_SLUG = process.env.REPAIR_TENANT_SLUG ?? "mkraft";
const APPLY = process.argv.includes("--apply");
const connectionString = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL (or MIGRATION_DATABASE_URL) is required.");
const client = neon(connectionString);

type Row = { id: string; attributes: Record<string, unknown> };

const planned: string[] = [];
const skipped: string[] = [];

function note(table: string, id: string, change: string) {
  planned.push(`${table.padEnd(14)} ${id.slice(0, 8)}  ${change}`);
}

function skip(table: string, id: string, reason: string) {
  skipped.push(`${table.padEnd(14)} ${id.slice(0, 8)}  ${reason}`);
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function repairCourses(tenantId: string): Promise<Map<string, string>> {
  const courses = (await client`select id, attributes from courses where tenant_id = ${tenantId}`) as Row[];
  const codeByTitle = new Map<string, string>();
  const taken = new Set(courses.map((course) => text(course.attributes.code)).filter(Boolean));
  for (const course of courses) {
    const title = text(course.attributes.title);
    const existing = text(course.attributes.code);
    if (existing) {
      if (title) codeByTitle.set(title, existing);
      skip("courses", course.id, `already coded ${existing}`);
      continue;
    }
    if (!title) {
      skip("courses", course.id, "no title to derive a code from - LEFT UNSET");
      continue;
    }
    let code = courseCodeFromTitle(title);
    let suffix = 2;
    while (taken.has(code)) code = `${courseCodeFromTitle(title).slice(0, 37)}-${suffix++}`;
    taken.add(code);
    codeByTitle.set(title, code);
    note("courses", course.id, `code := ${code}  (from "${title}")`);
    if (APPLY) {
      await client`update courses set attributes = attributes || ${JSON.stringify({ code })}::jsonb where id = ${course.id} and tenant_id = ${tenantId}`;
    }
  }
  return codeByTitle;
}

async function repairEnrollments(tenantId: string, codeByTitle: Map<string, string>): Promise<void> {
  const enrollments = (await client`select id, attributes from enrollments where tenant_id = ${tenantId}`) as Row[];
  for (const enrollment of enrollments) {
    const patch: Record<string, unknown> = {};
    if (!text(enrollment.attributes.course_code)) {
      const item = text(enrollment.attributes.item);
      const code = codeByTitle.get(item);
      if (code) patch.course_code = code;
      else skip("enrollments", enrollment.id, `no course matches "${item}" - LEFT UNSET`);
    }
    const status = text(enrollment.attributes.status);
    const canonical = enrollmentStatusFromText(status);
    if (canonical && canonical !== status) {
      patch.status = canonical;
      patch.status_label = status;
    }
    if (Object.keys(patch).length === 0) {
      skip("enrollments", enrollment.id, "already canonical");
      continue;
    }
    note("enrollments", enrollment.id, JSON.stringify(patch));
    if (APPLY) {
      await client`update enrollments set attributes = attributes || ${JSON.stringify(patch)}::jsonb where id = ${enrollment.id} and tenant_id = ${tenantId}`;
    }
  }
}

async function repairApplications(tenantId: string): Promise<void> {
  const applications = (await client`select id, attributes from applications where tenant_id = ${tenantId}`) as Row[];
  for (const application of applications) {
    const current = text(application.attributes.stage);
    const legacy = text(application.attributes.current_stage);
    if (current && KNOWN_STAGES.has(current)) {
      skip("applications", application.id, `already ${current}`);
      continue;
    }
    const source = current || legacy;
    const patch: Record<string, unknown> = {};
    if (!source) {
      // No stage was ever recorded. An application that exists has been applied for, which
      // is the first step of the flow and the one createApplication itself writes.
      patch.stage = "applied";
    } else {
      const mapped = stageFromText(source);
      if (!mapped) {
        skip("applications", application.id, `"${source}" maps to no stage - LEFT UNSET`);
        continue;
      }
      patch.stage = mapped;
      patch.stage_label = source;
    }
    note("applications", application.id, `stage := ${String(patch.stage)}${patch.stage_label ? `  (was "${String(patch.stage_label)}")` : "  (was unset)"}`);
    if (APPLY) {
      await client`update applications set attributes = (attributes - 'current_stage') || ${JSON.stringify(patch)}::jsonb where id = ${application.id} and tenant_id = ${tenantId}`;
    }
  }
}

async function repairRequisitions(tenantId: string): Promise<void> {
  const requisitions = (await client`select id, attributes from requisitions where tenant_id = ${tenantId}`) as Row[];
  for (const requisition of requisitions) {
    const patch: Record<string, unknown> = {};
    const status = typeof requisition.attributes.status === "string" ? requisition.attributes.status : null;
    const mapped = status === null ? "draft" : requisitionStatusFromText(status);
    if (mapped && mapped !== status) {
      patch.status = mapped;
      if (status) patch.status_label = status;
    }
    // `requisition_code` is not always a code: one loader row holds a paragraph of demo
    // narrative in it. Only a value shaped like a reference is copied across; anything
    // else is reported and left where it is rather than written in as an identifier.
    const workbookCode = text(requisition.attributes.requisition_code).trim();
    if (!text(requisition.attributes.code) && workbookCode) {
      if (looksLikeCode(workbookCode)) patch.code = workbookCode;
      else skip("requisitions", requisition.id, `requisition_code is not a code ("${workbookCode.slice(0, 40)}...") - LEFT UNSET`);
    }
    if (Object.keys(patch).length === 0) {
      skip("requisitions", requisition.id, "already canonical");
      continue;
    }
    note("requisitions", requisition.id, JSON.stringify(patch));
    if (APPLY) {
      await client`update requisitions set attributes = attributes || ${JSON.stringify(patch)}::jsonb where id = ${requisition.id} and tenant_id = ${tenantId}`;
    }
  }
}

async function repairReferrals(tenantId: string): Promise<void> {
  // A referral that exists has been referred. The relationship is NOT inferred: the
  // workbook rows carry no such column, and guessing one would put a picklist value in
  // the record that nobody chose.
  const referrals = (await client`select id, attributes from referrals where tenant_id = ${tenantId}`) as Row[];
  for (const referral of referrals) {
    const status = text(referral.attributes.status);
    if (status) {
      skip("referrals", referral.id, `already ${status}`);
      continue;
    }
    note("referrals", referral.id, "status := referred");
    if (APPLY) {
      await client`update referrals set attributes = attributes || ${JSON.stringify({ status: "referred" })}::jsonb where id = ${referral.id} and tenant_id = ${tenantId}`;
    }
  }
}

async function main(): Promise<void> {
  const tenants = (await client`select id from tenants where slug = ${TENANT_SLUG} limit 1`) as Array<{ id: string }>;
  const tenantId = tenants[0]?.id;
  if (!tenantId) throw new Error(`Tenant "${TENANT_SLUG}" does not exist.`);
  console.log(`${APPLY ? "APPLYING to" : "Dry run against"} tenant ${TENANT_SLUG} (${tenantId})\n`);

  const codeByTitle = await repairCourses(tenantId);
  await repairEnrollments(tenantId, codeByTitle);
  await repairApplications(tenantId);
  await repairRequisitions(tenantId);
  await repairReferrals(tenantId);

  console.log("Changes:");
  if (planned.length === 0) console.log("  (none - every row is already in the canonical vocabulary)");
  for (const line of planned) console.log(`  ${line}`);

  const unset = skipped.filter((entry) => entry.includes("LEFT UNSET"));
  console.log(`\nLeft alone: ${skipped.length}${unset.length > 0 ? `, of which ${unset.length} could not be derived from the row:` : ""}`);
  for (const line of unset) console.log(`  ${line}`);

  console.log(APPLY
    ? `\nApplied ${planned.length} change(s).`
    : `\nDry run: nothing was written. Re-run with --apply to write these ${planned.length} change(s).`);
}

void main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
