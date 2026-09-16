import { getClient, createEmptyContext, getCount } from "./types";
import { loadExcelDataset, buildGlMappingsFromSheet35 } from "./load-excel-dataset";
import { loadExcelV11Config } from "./excel-v11-config";
import { loadExcelV11PayrollAttendance } from "./excel-v11-payroll-attendance";
import { loadExcelV11Lifecycle } from "./excel-v11-lifecycle";
import { seedDomain01 } from "./domain01-identity";
import { seedDomain02 } from "./domain02-org-people";
import { seedDomain03 } from "./domain03-workflows";
import { seedDomain04 } from "./domain04-attendance-leave";
import { seedDomain05 } from "./domain05-payroll-loans";
import { seedDomain06 } from "./domain06-talent-onboarding";
import { seedDomain07 } from "./domain07-performance-learning";
import { seedDomain08 } from "./domain08-compensation-benefits";
import { seedDomain09 } from "./domain09-engagement-ai";
import { seedDomain10 } from "./domain10-integrations-audit";
import { fillRemaining51 } from "./fill-remaining-51";
import { seedDomain11 } from "./domain11-vp-readiness";
import * as fs from "node:fs";
import * as path from "node:path";

async function main() {
  const client = getClient();
  const ctx = createEmptyContext(client);

  console.log("==================================================================");
  console.log("== STARTING MASTER SEEDER RUN: ALL 304 CANONICAL + EXCEL DATASET ==");
  console.log("==================================================================");
  console.log(`Target Tenant: ${ctx.tenantId}`);

  // 1. Identity, Tenant Features, Domains, API Keys
  await seedDomain01(ctx);

  // 2. Foundational Org & Roster
  await seedDomain02(ctx);

  // 3. Official Demo Dataset from Excel (All 37 Sheets)
  await loadExcelDataset(ctx);

  // 3b. Excel v1.1: configuration sheets (38-48) — worker categories, leave schemes,
  // grace/night-extension policy, roles & demo users, vendors, pay components, PT
  // slabs. Runs after loadExcelDataset (not before, despite the workbook's own "load
  // before 12_Employees" note): every FK this merges — worker classes, employees,
  // shifts — is created by loadExcelDataset itself, and this step only adds to /
  // merges onto rows that already exist. Running it first would leave every lookup
  // empty on a from-scratch run.
  await loadExcelV11Config(ctx);

  // 3b-ii. gl_mappings needs pay_components (just loaded in 3b) to resolve a real
  // pay_component_id — see buildGlMappingsFromSheet35's own doc comment for why this
  // couldn't stay inside loadExcelDataset's sheet-35 section.
  await buildGlMappingsFromSheet35(ctx);

  // 3c. Excel v1.1: payroll & attendance transactional sheets (46, 49-58) — break
  // register, regularisations, exceptions, shift roster, payroll register, GL
  // journal, bank file, full & final settlement. Depends on 3b's vendors/pay
  // components, so runs after it.
  await loadExcelV11PayrollAttendance(ctx);

  // 3d. Excel v1.1: recruitment/onboarding/documents/helpdesk sheets (59-64).
  await loadExcelV11Lifecycle(ctx);

  // 4. Workflows, Approvals, Activity & Notifications
  await seedDomain03(ctx);

  // 5. Complementary Attendance & Leave Details
  await seedDomain04(ctx);

  // 6. Complementary Payroll, Statutory & Banking
  await seedDomain05(ctx);

  // 7. Complementary Talent, Candidates & Onboarding
  await seedDomain06(ctx);

  // 8. Performance Appraisals, OKRs, Skills & Capability Index
  await seedDomain07(ctx);

  // 9. Compensation Bands, Budgets, Pay Equity & Benefits
  await seedDomain08(ctx);

  // 10. Surveys, Metrics, AI Graph Checkpoints, Tool Invocations
  await seedDomain09(ctx);

  // 11. Integrations, Webhooks, Outbox, Scheduled Tasks, Audit & Retention
  await seedDomain10(ctx);

  // 12. Decoupled Seeding for All Remaining Canonical Tables
  await fillRemaining51(ctx);

  // 13. VP Readiness & 26-Feature Extended Controls
  await seedDomain11(ctx);

  console.log("\n==================================================================");
  console.log("== MASTER SEEDING COMPLETE! RUNNING COMPREHENSIVE VERIFICATION ==");
  console.log("==================================================================\n");

  // Read manifest
  const manifestPath = path.resolve(__dirname, "../../db/schema/canonical-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const canonicalTables: string[] = manifest.tables.map((t: any) => t.physical);

  const legacyTables = [
    "attendance_days",
    "attendance_punches",
    "leave_balances",
    "leave_approvals",
    "loans",
    "auth_security_events",
    "verification"
  ];

  const vpTables = [
    "vp_rule_sets",
    "vp_location_grants",
    "vp_attendance_results",
    "vp_erp_records",
    "vp_gl_batches",
    "vp_gl_lines",
    "vp_statutory_instances",
    "vp_manpower_lines",
    "vp_feature_records"
  ];

  const allTables = Array.from(new Set([...canonicalTables, ...legacyTables, ...vpTables])).sort();

  // Check counts
  const empty: string[] = [];
  let populatedCount = 0;

  for (const table of allTables) {
    try {
      const isTenant = !["tenants", "user", "session", "account", "verification", "permissions", "countries", "currencies", "jurisdictions", "statutory_rule_packs", "rule_pack_versions", "statutory_forms", "integration_catalog", "agent_tools", "auth_security_events"].includes(table);
      const count = await getCount(client, table, isTenant);
      if (count === 0) {
        empty.push(table);
      } else {
        populatedCount++;
      }
    } catch (err: any) {
      console.warn(`[CHECK ERROR] ${table}:`, err.message);
      empty.push(table);
    }
  }

  console.log(`\nVerification Results:`);
  console.log(`Total Tables Checked: ${allTables.length}`);
  console.log(`Populated Tables: ${populatedCount}`);
  console.log(`Empty Tables: ${empty.length}`);

  if (empty.length > 0) {
    console.log(`\nTables needing fill (${empty.length}):`);
    console.log(empty.join(", "));
  } else {
    console.log("\n★★★ ALL 320 TABLES (304 CANONICAL + 7 COMPATIBILITY + 9 VP READINESS) ARE POPULATED! ★★★");
  }

  // Safety check on excluded emails
  const forbiddenRows = await client`
    SELECT count(*)::int as count FROM employees 
    WHERE tenant_id = ${ctx.tenantId} 
    AND (
      employee_code IN ('admin', 'demo', 'superadmin') 
      OR first_name ILIKE '%demo%' 
      OR first_name ILIKE '%administrator%'
      OR first_name ILIKE '%superadmin%'
    )
  `;
  console.log(`Forbidden operational employee records for demo/admin accounts: ${(forbiddenRows as any)[0]?.count ?? 0} (Must be 0)`);
}

main().catch((err) => {
  console.error("FATAL ERROR IN RUN-ALL:", err);
  process.exit(1);
});
