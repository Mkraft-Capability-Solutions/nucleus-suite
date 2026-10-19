#!/usr/bin/env node
/**
 * generate-er.mjs — read-only schema introspection -> Mermaid ER docs.
 *
 * Writes docs/architecture/database/er/<domain>.md (one file per domain).
 * docs/architecture/database/er/NEW_README.md is hand-written and is NOT touched.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/docs/generate-er.mjs [--out <dir>] [--source "live schema"]
 *                                                      [--date YYYY-MM-DD] [--summary] [--generic-list]
 *   DATABASE_URL must come from the environment; the script never reads env files.
 *   Use a read-only or owner role; the script only reads catalogs, so any role that can see the schema works.
 *
 * Safety:
 *   - Runs every query inside `BEGIN READ ONLY` and only reads pg_catalog / information_schema.
 *   - Never prints the connection string or any row data; only schema metadata is emitted.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// ---------- args ----------
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const OUT_DIR = path.resolve(repoRoot, opt("--out", "docs/architecture/database/er"));
const SOURCE_LABEL = opt("--source", "live schema");
const GEN_DATE = opt("--date", new Date().toISOString().slice(0, 10));
const MAX_PER_DIAGRAM = 25;

// The script deliberately does not read env files itself (project rule: tools never open real env files).
// Supply DATABASE_URL from the shell, e.g. the local compose database or `node --env-file=<file> ...`.
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Export it (preferably the local compose database) and re-run. Aborting.");
  process.exit(2);
}

// ---------- domain model ----------
// Ordered: first matching subgroup wins. `t` = exact names, `p` = name prefixes.
const DOMAINS = [
  {
    file: "identity-platform",
    title: "Identity, tenancy and platform integration",
    purpose:
      "Authentication (Better Auth tables), tenants, memberships, roles and permissions, tenant settings, API clients and integration/webhook plumbing. These tables decide who a principal is and which tenant context a transaction runs in.",
    groups: [
      {
        name: "Identity and tenancy",
        t: ["user", "session", "account", "verification", "auth_security_events", "tenants", "tenant_domains",
          "tenant_features", "tenant_settings", "memberships", "membership_roles", "roles", "role_permissions",
          "permissions", "resource_grants", "invitations", "delegation_windows", "vp_location_grants"],
      },
      {
        name: "API clients and integrations",
        t: ["api_clients", "api_keys", "external_id_mappings", "inbound_events"],
        p: ["integration_", "webhook_"],
      },
    ],
  },
  {
    file: "organization-people",
    title: "Organization and people",
    purpose:
      "Legal entities, establishments, org units, positions, the employee record and its satellites (contacts, dependants, bank accounts, assignments), workforce planning and contract workforce.",
    groups: [
      {
        name: "Organization structure",
        t: ["legal_entities", "establishments", "business_units", "departments", "teams", "locations", "location_master",
          "cost_centers", "grades", "job_families", "job_profiles", "positions", "position_relationships", "worker_categories"],
      },
      {
        name: "Employee record",
        t: ["employees", "people", "employments", "employee_assignments", "employee_changes", "employee_contacts",
          "emergency_contacts", "dependants", "bank_accounts", "lifecycle_events", "custom_field_definitions",
          "custom_field_values"],
      },
      {
        name: "Workforce planning and contract workforce",
        t: ["manpower_plans", "manpower_plan_lines", "vp_manpower_lines", "workforce_scenarios", "workforce_scenario_lines",
          "contract_worker_assignments", "contractor_workforce", "project_workforce"],
        p: ["contractor_"],
      },
    ],
  },
  {
    file: "attendance-time",
    title: "Attendance and time",
    purpose:
      "Punches, sessions, attendance days and exceptions, shifts and rosters, work schedules, devices, gate passes, overtime, holiday calendars.",
    groups: [
      { name: "Attendance capture and results", p: ["attendance_"], t: ["biometric_devices", "vp_attendance_results"] },
      {
        name: "Shifts, rosters, holidays, gate passes and overtime",
        t: ["shifts", "shift_master", "roster_schedule", "work_schedules", "holiday_calendars", "holidays", "ot_requests"],
        p: ["shift_", "gate_pass", "overtime_"],
      },
    ],
  },
  {
    file: "leave",
    title: "Leave",
    purpose: "Leave types and policies, accrual rules, requests, day breakdown, approvals, balances, ledger, comp-off and encashment.",
    groups: [{ name: "Leave", p: ["leave_"], t: ["comp_off_grants", "accrual_rules"] }],
  },
  {
    file: "payroll-compensation",
    title: "Payroll, compensation and benefits",
    purpose:
      "Pay groups and periods, salary structures, payroll runs/inputs/lines/payslips, statutory profiles, disbursement, GL posting and ERP export, compensation cycles and benefits, full and final settlement.",
    groups: [
      {
        name: "Payroll processing",
        p: ["payroll_", "pay_"],
        t: ["payslips", "tax_profiles", "wage_base_simulations", "wage_base_simulation_lines"],
      },
      {
        name: "Salary structures, disbursement, GL and settlement",
        p: ["salary_structure", "disbursement_", "gl_", "vp_gl_", "full_final_"],
        t: ["employee_salary_assignments", "employee_compensation_snapshots", "vp_erp_records", "reconciliation_items",
          "exchange_rate_snapshots", "fnf_settlements"],
      },
      {
        name: "Compensation and benefits",
        p: ["compensation_", "benefit_"],
        t: ["market_benchmarks", "enrollment_windows"],
      },
    ],
  },
  {
    file: "loans-advances",
    title: "Loans and advances",
    purpose: "Loan products, employee loans, schedules, transactions, guarantors, exceptions and salary advances.",
    groups: [{ name: "Loans and advances", p: ["loan"], t: ["employee_loans", "salary_advances"] }],
  },
  {
    file: "recruitment-onboarding",
    title: "Recruitment, onboarding and offboarding",
    purpose:
      "Requisitions, job descriptions and postings, candidates and matching, interviews, offers, referrals, onboarding and induction, offboarding, clearance and alumni.",
    groups: [
      {
        name: "Requisitions, candidates and interviews",
        t: ["requisitions", "job_requisitions", "job_descriptions", "job_postings", "applications",
          "application_stage_history", "offers", "background_checks", "referrals", "referral_awards", "talent_placements"],
        p: ["interview_"],
      },
      { name: "Candidate matching", p: ["candidate"], t: ["match_evidence"] },
      {
        name: "Onboarding, induction and offboarding",
        p: ["onboarding_", "induction_"],
        t: ["buddy_assignments", "offboarding_cases", "clearance_items", "exit_interviews", "alumni_records"],
      },
    ],
  },
  {
    file: "performance-learning",
    title: "Performance, learning and skills",
    purpose:
      "Review cycles, goals/OKRs, check-ins, feedback, calibration and succession; courses, paths, enrollments and certifications; the skills ontology and capability index.",
    groups: [
      {
        name: "Performance and goals",
        p: ["review_", "goal_", "feedback_", "succession_", "manager_"],
        t: ["objectives", "key_results", "checkins", "calibration_sessions", "performance_reviews", "scorecards",
          "attrition_scores"],
      },
      {
        name: "Learning, skills and capability",
        p: ["course", "learning_", "skill", "capability_"],
        t: ["enrollments", "certifications", "employee_certifications", "employee_skills", "job_skill_requirements",
          "role_skill_requirements"],
      },
    ],
  },
  {
    file: "engagement-helpdesk",
    title: "Engagement, communication and helpdesk",
    purpose: "Feed, posts and reactions, announcements, recognition and rewards, surveys, wellbeing, notifications and HR helpdesk.",
    groups: [
      {
        name: "Engagement and helpdesk",
        p: ["feed_", "post_", "recognition_", "survey", "notification"],
        t: ["announcements", "reward_transactions", "wellbeing_checkins", "helpdesk_tickets"],
      },
    ],
  },
  {
    file: "compliance-statutory",
    title: "Compliance, statutory and privacy governance",
    purpose:
      "Statutory registrations, returns, forms and rule packs, compliance calendar and evidence, regulatory change tracking, and privacy governance (consent, privacy requests, legal holds, retention policies).",
    groups: [
      {
        name: "Statutory and compliance",
        p: ["statutory_", "compliance_", "rule_pack", "vp_statutory_"],
        t: ["regulatory_change_statuses", "vp_rule_sets"],
      },
      {
        name: "Privacy governance",
        t: ["consent_records", "privacy_requests", "legal_holds", "legal_hold_items", "retention_policies"],
      },
    ],
  },
  {
    file: "assets-documents",
    title: "Assets, documents and letters",
    purpose: "Asset catalog and assignments, document vault and versions, document policies/extractions, letter templates and generated letters, file import/export jobs.",
    groups: [
      {
        name: "Assets, documents and letters",
        p: ["asset_", "document"],
        t: ["hardware_assets", "generated_letters", "letter_templates", "hr_letters", "file_imports", "import_rows",
          "export_jobs"],
      },
    ],
  },
  {
    file: "workflow-jobs-audit",
    title: "Workflow, jobs, idempotency and audit",
    purpose: "Workflow definitions and instances, approvals and tasks, scheduled tasks, the transactional outbox, idempotency keys and the audit/access trail.",
    groups: [
      {
        name: "Workflow, jobs and audit",
        p: ["workflow_"],
        t: ["step_instances", "task_assignments", "task_attempts", "approvals", "scheduled_tasks", "transactional_outbox",
          "idempotency_keys", "audit_events", "audit_event_changes", "access_events"],
      },
    ],
  },
  {
    file: "ai-assistant",
    title: "AI assistant and agents",
    purpose: "Agent principals, tools and policies, AI runs and graph checkpoints, knowledge sources/chunks for retrieval, prompts, model configuration, safety evaluations and human review.",
    groups: [
      {
        name: "AI assistant and agents",
        p: ["agent_", "ai_", "knowledge_", "human_review_"],
        t: ["model_configs", "prompt_versions", "retrieval_logs", "tool_invocations", "safety_evaluations"],
      },
    ],
  },
  {
    file: "reference-data",
    title: "Reference data and configuration",
    purpose: "Global reference tables (countries, currencies, jurisdictions), system enums, configuration definitions/values and the UI translation catalog tables.",
    groups: [
      {
        name: "Reference data and configuration",
        p: ["ui_"],
        t: ["countries", "currencies", "jurisdictions", "payroll_jurisdictions", "payroll_country_configuration",
          "system_enums", "configuration_definitions", "system_configuration_values", "tenant_configuration_values"],
      },
    ],
  },
  {
    file: "other",
    title: "Analytics and unclassified",
    purpose: "Metric definitions/snapshots, aggregate results, feature records, and any table the domain map does not yet classify. New tables landing here should be classified in scripts/docs/generate-er.mjs.",
    groups: [{ name: "Analytics and unclassified", p: [""] }],
  },
];
// reference-data must win over payroll_ prefix for the two global payroll tables
const PRIORITY_EXACT = new Map();
for (const d of DOMAINS) for (const g of d.groups) for (const n of g.t ?? []) PRIORITY_EXACT.set(n, [d, g]);

function classify(table) {
  if (PRIORITY_EXACT.has(table)) return PRIORITY_EXACT.get(table);
  for (const d of DOMAINS) for (const g of d.groups) for (const pre of g.p ?? []) if (table.startsWith(pre)) return [d, g];
  throw new Error("unreachable");
}

const GENERIC_BASE = new Set(["id", "record_status", "attributes", "version", "created_at", "updated_at", "tenant_id"]);

// ---------- introspection (read-only) ----------
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, application_name: "generate-er (read-only)" });
const redact = (m) => String(m).replace(/postgres(ql)?:\/\/\S+/gi, "<redacted>");

async function introspect() {
  await client.connect();
  await client.query("BEGIN READ ONLY");
  try {
    const tables = (
      await client.query(`
        SELECT c.oid, c.relname::text AS name, c.relrowsecurity AS rls, c.relforcerowsecurity AS force,
               obj_description(c.oid, 'pg_class') AS comment,
               (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid)::int AS policies
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
        ORDER BY c.relname`)
    ).rows;
    const columns = (
      await client.query(`
        SELECT table_name::text AS t, column_name::text AS c, udt_name::text AS udt, data_type::text AS dt,
               is_nullable = 'YES' AS nullable, ordinal_position AS pos
        FROM information_schema.columns WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position`)
    ).rows;
    const constraints = (
      await client.query(`
        SELECT c.contype::text AS type, c.conname::text AS name, rel.relname::text AS t, frel.relname::text AS ft,
               fns.nspname::text AS fschema,
               ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(n, o)
                     JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.n ORDER BY k.o) AS cols,
               ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(n, o)
                     JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.n ORDER BY k.o) AS fcols
        FROM pg_constraint c
        JOIN pg_class rel ON rel.oid = c.conrelid
        JOIN pg_namespace ns ON ns.oid = rel.relnamespace
        LEFT JOIN pg_class frel ON frel.oid = c.confrelid
        LEFT JOIN pg_namespace fns ON fns.oid = frel.relnamespace
        WHERE ns.nspname = 'public' AND c.contype IN ('p','f')
        ORDER BY rel.relname, c.conname`)
    ).rows;
    return { tables, columns, constraints };
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }
}

// ---------- model ----------
function buildModel({ tables, columns, constraints }) {
  const byName = new Map();
  for (const t of tables) {
    byName.set(t.name, { ...t, cols: [], pk: new Set(), fkCols: new Set(), fksOut: [], fksIn: 0 });
  }
  for (const c of columns) byName.get(c.t)?.cols.push(c);
  let fkTotal = 0;
  for (const k of constraints) {
    const t = byName.get(k.t);
    if (!t) continue;
    if (k.type === "p") k.cols.forEach((c) => t.pk.add(c));
    if (k.type === "f") {
      fkTotal++;
      k.cols.forEach((c) => t.fkCols.add(c));
      t.fksOut.push({ name: k.name, parent: k.ft, parentSchema: k.fschema, cols: k.cols, pcols: k.fcols });
      const p = byName.get(k.ft);
      if (p && k.fschema === "public") p.fksIn++;
    }
  }
  for (const t of byName.values()) {
    const names = t.cols.map((c) => c.c);
    const hasGenericShape = names.includes("attributes") && names.includes("record_status") && names.includes("version");
    const extras = names.filter((n) => !GENERIC_BASE.has(n) && !t.fkCols.has(n));
    t.kind = hasGenericShape ? (extras.length === 0 ? "generic" : "hybrid") : "typed";
    t.extraTypedCols = hasGenericShape ? extras : [];
    t.hasTenant = names.includes("tenant_id");
    [t.domain, t.group] = classify(t.name);
  }
  return { byName, fkTotal };
}

// ---------- rendering ----------
const mType = (c) => {
  let u = c.udt || c.dt;
  if (u.startsWith("_")) u = u.slice(1) + "_array";
  return u.replace(/[^A-Za-z0-9_]/g, "_");
};

function entityBlock(t) {
  const label = t.kind === "generic" ? `"${t.name} «generic»"` : t.kind === "hybrid" ? `"${t.name} «hybrid»"` : null;
  const head = label ? `  ${t.name}[${label}] {` : `  ${t.name} {`;
  const lines = [head];
  for (const c of t.cols) {
    const keys = [t.pk.has(c.c) ? "PK" : null, t.fkCols.has(c.c) ? "FK" : null].filter(Boolean).join(", ");
    const comment = c.nullable ? ' "nullable"' : "";
    lines.push(`    ${mType(c)} ${c.c}${keys ? " " + keys : ""}${comment}`);
  }
  lines.push("  }");
  return lines.join("\n");
}

function relLabel(fk) {
  const own = fk.cols.filter((c) => c !== "tenant_id");
  return (own.length ? own : fk.cols).join("+");
}

function diagram(tablesInDiagram, byName) {
  const inSet = new Set(tablesInDiagram.map((t) => t.name));
  const stubs = new Set();
  const rels = [];
  for (const t of tablesInDiagram) {
    for (const fk of t.fksOut) {
      if (fk.parentSchema !== "public") continue;
      if (fk.parent === "tenants" && t.name !== "tenants" && fk.cols.length === 1 && fk.cols[0] === "tenant_id") continue;
      if (!inSet.has(fk.parent)) stubs.add(fk.parent);
      const nullable = fk.cols.some((c) => t.cols.find((x) => x.c === c)?.nullable);
      const left = nullable ? "|o" : "||";
      rels.push(`  ${fk.parent} ${left}--o{ ${t.name} : "${relLabel(fk)}"`);
    }
  }
  const out = ["```mermaid", "erDiagram"];
  for (const t of tablesInDiagram) out.push(entityBlock(t));
  for (const s of [...stubs].sort()) {
    const p = byName.get(s);
    out.push(`  ${s}["${s} (${p ? p.domain.file : "external"})"] {`, `    uuid id PK`, `  }`);
  }
  out.push(...[...new Set(rels)]);
  out.push("```");
  return { text: out.join("\n"), stubs: [...stubs].sort(), relCount: new Set(rels).size };
}

function rlsCell(t) {
  if (!t.rls) return "disabled";
  return t.force ? "enabled + forced" : "enabled (not forced)";
}

function notes(t) {
  const n = [];
  if (!t.hasTenant) n.push("no tenant_id (global/identity)");
  if (t.hasTenant && !t.rls) n.push("**tenant_id without RLS**");
  if (t.hasTenant && t.rls && !t.force) n.push("**RLS not forced**");
  if (t.rls && t.policies === 0) n.push("**RLS on, 0 policies (deny-all)**");
  if (t.kind === "hybrid") n.push(`typed extras: ${t.extraTypedCols.join(", ")}`);
  n.push(`${t.cols.length} cols, ${t.fksOut.length} FK out, ${t.fksIn} FK in`);
  return n.join("; ");
}

function chunk(arr, size) {
  if (arr.length <= size) return [arr];
  const parts = Math.ceil(arr.length / size);
  const per = Math.ceil(arr.length / parts);
  const res = [];
  for (let i = 0; i < arr.length; i += per) res.push(arr.slice(i, i + per));
  return res;
}

function renderDomain(domain, tables, byName) {
  const fm = [
    "---",
    `title: ER — ${domain.title}`,
    "status: draft",
    "owner: platform-architecture",
    `last_reviewed: ${GEN_DATE}`,
    "related: [NEW_README.md, ../NEW_DATA-ARCHITECTURE.md, ../NEW_RLS-ROLES.md, ../../../plans/NEW_DATABASE-NORMALIZATION.md]",
    "---",
    "",
    `# ER — ${domain.title}`,
    "",
    `> Generated by scripts/docs/generate-er.mjs from the ${SOURCE_LABEL} on ${GEN_DATE} — regenerate, don't hand-edit.`,
    "",
    `**Purpose.** ${domain.purpose} This file is the current-state entity map for the domain; the target-state rules are in [data-architecture.md](../data-architecture.md) and the typed-column plan is in [database-normalization.md](../../../plans/database-normalization.md).`,
    "",
  ];
  const generic = tables.filter((t) => t.kind === "generic").length;
  const hybrid = tables.filter((t) => t.kind === "hybrid").length;
  const forced = tables.filter((t) => t.rls && t.force).length;
  const fkOut = tables.reduce((s, t) => s + t.fksOut.length, 0);
  fm.push(
    `**Counts.** ${tables.length} tables (${tables.length - generic - hybrid} typed, ${generic} generic, ${hybrid} hybrid); ${fkOut} outgoing foreign keys; RLS enabled + forced on ${forced}/${tables.length}.`,
    "",
    "**Legend.** «generic» = created by the loop in `db/migrations/0008_canonical_304_topology.sql` (`id, record_status, attributes jsonb, version, created_at, updated_at, tenant_id` plus FK columns only); «hybrid» = generic shape plus later typed columns; unmarked = typed table. FK edges to `tenants` via `tenant_id` are omitted for readability (every tenant-scoped table has one). Entities labelled `(other-domain)` are stubs for parents defined in another ER file.",
    "",
    "## Tables",
    "",
    "| Table | Shape | RLS | Policies | Notes |",
    "|---|---|---|---|---|"
  );
  for (const t of tables) fm.push(`| \`${t.name}\` | ${t.kind} | ${rlsCell(t)} | ${t.policies} | ${notes(t)} |`);
  fm.push("", "## Diagrams", "");
  for (const g of domain.groups) {
    const gt = tables.filter((t) => t.group === g);
    if (!gt.length) continue;
    const parts = chunk(gt, MAX_PER_DIAGRAM);
    parts.forEach((part, i) => {
      const suffix = parts.length > 1 ? ` (part ${i + 1} of ${parts.length})` : "";
      const d = diagram(part, byName);
      fm.push(`### ${g.name}${suffix}`, "", `${part.length} entities, ${d.relCount} relationships${d.stubs.length ? `, ${d.stubs.length} external stubs` : ""}.`, "", d.text, "");
    });
  }
  return fm.join("\n");
}

// ---------- main ----------
try {
  const raw = await introspect();
  const { byName, fkTotal } = buildModel(raw);
  const all = [...byName.values()];
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const summary = [];
  for (const d of DOMAINS) {
    const tables = all.filter((t) => t.domain === d).sort((a, b) => a.name.localeCompare(b.name));
    if (!tables.length) continue;
    fs.writeFileSync(path.join(OUT_DIR, `NEW_${d.file.toUpperCase()}.md`), renderDomain(d, tables, byName) + "\n");
    summary.push({
      file: `NEW_${d.file.toUpperCase()}.md`,
      tables: tables.length,
      typed: tables.filter((t) => t.kind === "typed").length,
      generic: tables.filter((t) => t.kind === "generic").length,
      hybrid: tables.filter((t) => t.kind === "hybrid").length,
      fksOut: tables.reduce((s, t) => s + t.fksOut.length, 0),
      rlsForced: tables.filter((t) => t.rls && t.force).length,
      rlsNotForced: tables.filter((t) => t.rls && !t.force).length,
      noRls: tables.filter((t) => !t.rls).length,
    });
  }
  const tot = (k) => summary.reduce((s, r) => s + r[k], 0);
  console.log(`tables=${all.length} fks=${fkTotal} typed=${tot("typed")} generic=${tot("generic")} hybrid=${tot("hybrid")} rlsForced=${tot("rlsForced")} rlsNotForced=${tot("rlsNotForced")} noRls=${tot("noRls")} policies=${all.reduce((s, t) => s + t.policies, 0)}`);
  if (flag("--summary")) {
    for (const r of summary) console.log(Object.values(r).join(" | "));
    const gaps = all.filter((t) => (t.hasTenant && (!t.rls || !t.force)) || (t.rls && t.policies === 0));
    console.log("rls-gaps: " + gaps.map((t) => `${t.name}(${rlsCell(t)},p=${t.policies},tenant=${t.hasTenant})`).join(", "));
    const noTenantNoRls = all.filter((t) => !t.hasTenant && !t.rls).map((t) => t.name);
    console.log("global-no-rls: " + noTenantNoRls.join(", "));
  }
  if (flag("--generic-list")) {
    for (const d of DOMAINS) {
      const g = all.filter((t) => t.domain === d && t.kind !== "typed").sort((a, b) => a.name.localeCompare(b.name));
      if (g.length) console.log(`${d.file}: ${g.map((t) => t.name + (t.kind === "hybrid" ? "*" : "")).join(", ")}`);
    }
  }
} catch (e) {
  console.error("generate-er failed:", redact(e.message));
  process.exit(1);
}
