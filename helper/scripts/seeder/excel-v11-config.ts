import { hashPassword } from "better-auth/crypto";
import { SeedContext, uuid } from "./types";
import { readSheetData } from "./load-excel-dataset";

/**
 * Loads the v1.1 "configuration" sheets (38, 39+40, 41+42, 43+44, 45, 47, 48) of the
 * client demo workbook into the live tenant. Every sheet here maps onto tables that
 * already exist and are already used by `load-excel-dataset.ts` / the domain0*
 * seeders — this file only adds rows or merges jsonb attributes into them.
 *
 * House rules followed throughout (see task brief):
 *  - No new table, no new column. Only `attributes jsonb` on generic tables, or
 *    existing typed columns already in use elsewhere in the seeder.
 *  - Every insert is idempotent: guarded by an existence check keyed on a natural
 *    code, so running this twice does not duplicate rows.
 *  - No invented business values. Where a sheet gives no resolvable value, the row
 *    is skipped and a `console.warn` explains why, rather than guessing.
 */

// ---------------------------------------------------------------------------
// Small local helpers
// ---------------------------------------------------------------------------

/** Y/N (or Y (...)/N (...)) style workbook flags, tri-state so "not stated" stays null. */
function yn(value: unknown): boolean | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toUpperCase();
  if (v.startsWith("Y")) return true;
  if (v.startsWith("N")) return false;
  return null;
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function splitList(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value.split(",").map((v) => v.trim()).filter((v) => v !== "");
}

export async function loadExcelV11Config(ctx: SeedContext): Promise<void> {
  const { client } = ctx;
  console.log("\n========================================================");
  console.log("== LOADING EXCEL v1.1 CONFIGURATION SHEETS (38-48) ==");
  console.log("========================================================\n");

  await client`SELECT set_config('app.platform_admin', 'true', false)`;

  await loadWorkerCategoriesFromSheet38(ctx);
  await loadLeaveSchemesAndRules(ctx);
  await loadGraceAndNightExtension(ctx);
  await publishGraceAndNightExtensionRecords(ctx);
  await loadRolesAndDemoUsers(ctx);
  await loadVendorsContractors(ctx);
  await loadPayComponents(ctx);
  await loadPtSlabs(ctx);

  console.log("\n✓ Excel v1.1 configuration sheets loaded.\n");
}

// ---------------------------------------------------------------------------
// Sheet 38: Employment Categories -> worker_categories
// ---------------------------------------------------------------------------
//
// `worker_categories` already holds sheet 06's "Worker Classes" (codes WC-*),
// loaded by load-excel-dataset.ts. Sheet 38's "Employment Categories" (codes
// CAT-*) are a distinct, more detailed classification per the workbook's own
// v1.1 changelog note on the sheet ("Load this before 12_Employees" / F-EMP-02).
// They share the same generic table but never share a code prefix, so there is
// no collision. Two rows can carry the same "Category code" with a different
// "Sub-category code" (CAT-3P/SUB-EMP vs CAT-3P/SUB-HLP, CAT-TRN/SUB-GET vs
// CAT-TRN/SUB-DET) — the natural key is the (code, sub-code) pair.
async function loadWorkerCategoriesFromSheet38(ctx: SeedContext): Promise<void> {
  const { client, tenantId } = ctx;
  console.log("--> Loading 38_Employment_Categories -> worker_categories...");
  const rows = readSheetData("38_employment_categories.json").filter(
    (r) => typeof r["Category code"] === "string" && r["Category code"].startsWith("CAT-"),
  );

  const existing = await client`
    SELECT attributes->>'code' as code, coalesce(attributes->>'sub_category_code', '') as sub_code
    FROM worker_categories WHERE tenant_id = ${tenantId}
  `;
  const existingKeys = new Set((existing as any[]).map((r) => `${r.code}|${r.sub_code}`));

  // Map "Resolves to worker class" (a real WC-* code from sheet 06, already loaded)
  // to its worker_categories row id, so the category can point at a real record.
  const wcRows = await client`
    SELECT id, attributes->>'code' as code FROM worker_categories
    WHERE tenant_id = ${tenantId} AND attributes->>'code' LIKE 'WC-%'
  `;
  const wcIdByCode = new Map((wcRows as any[]).map((r) => [r.code, r.id]));

  let inserted = 0;
  for (const row of rows) {
    const code = row["Category code"] as string;
    const subCode = textOrNull(row["Sub-category code"]);
    const key = `${code}|${subCode ?? ""}`;
    if (existingKeys.has(key)) continue;

    const wageBasis = textOrNull(row["Wage basis"]);
    const wageType = wageBasis === "Monthly" ? "monthly" : wageBasis === "Daily" ? "daily" : null;

    const restDayPattern =
      row["Rest day pattern"] === "Sunday weekly off"
        ? "fixed_sunday"
        : row["Rest day applicable"] === "N"
          ? "none"
          : null;

    const otBasis = textOrNull(row["Default OT eligibility basis"]);
    const otEligibility =
      otBasis === "All days" ? "all"
      : otBasis === "Rest days and holidays only" ? "restday_holiday_only"
      : otBasis === "Not eligible" ? "none"
      : null;

    const resolvesToWc = textOrNull(row["Resolves to worker class"]);

    await client`
      INSERT INTO worker_categories (id, tenant_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${JSON.stringify({
        // Fields matching src/lib/operational-catalog.ts "worker-categories" resource
        // (code, label, wageType, restDayPattern, otEligibility), so the existing
        // catalog UI reads this the same shape it already expects.
        code,
        label: row["Category name"],
        wageType,
        restDayPattern,
        otEligibility,
        // Raw sheet fields kept for provenance / anything the catalog form doesn't cover.
        sub_category_code: subCode,
        sub_category_name: textOrNull(row["Sub-category name"]),
        is_third_party: yn(row["Is third party"]),
        rest_day_applicable: yn(row["Rest day applicable"]),
        default_leave_scheme: textOrNull(row["Default leave scheme"]),
        resolves_to_worker_class: resolvesToWc,
        resolves_to_worker_category_id: resolvesToWc ? wcIdByCode.get(resolvesToWc) ?? null : null,
        employees_on_this_row: row["Employees on this row"],
        demo_point: textOrNull(row["Demo point"]),
      })}::jsonb)
    `;
    existingKeys.add(key);
    inserted++;
  }
  console.log(`    inserted ${inserted} worker_categories row(s) from sheet 38.`);
}

// ---------------------------------------------------------------------------
// Sheets 39 (Leave Schemes) + 40 (Leave Rules Matrix) -> the ONE existing
// leave_policies row's attributes, plus leave_policy_assignments.
// ---------------------------------------------------------------------------
//
// CORRECTED per coordinator note: `load-excel-dataset.ts` (sheet 14-16 section)
// already does `SELECT id FROM leave_policies WHERE tenant_id = ... LIMIT 1` to
// find THE policy every accrual_rules row links to. Creating extra leave_policies
// rows here would make that SELECT non-deterministic and could silently break the
// existing accrual_rules linkage. So: resolve (or, only if truly absent, create
// with the exact same shape) the single existing row, and merge a `schemes` array
// into its attributes instead of creating new policy rows.
async function loadLeaveSchemesAndRules(ctx: SeedContext): Promise<void> {
  const { client, tenantId } = ctx;
  console.log("--> Loading 39_Leave_Schemes + 40_Leave_Rules_Matrix -> leave_policies (merge) + leave_policy_assignments...");

  const schemeRows = readSheetData("39_leave_schemes.json").filter(
    (r) => typeof r["Scheme code"] === "string" && r["Scheme code"].startsWith("LS-"),
  );
  const ruleRows = readSheetData("40_leave_rules_matrix.json").filter(
    (r) => typeof r["Rule code"] === "string" && r["Rule code"].startsWith("LR-"),
  );

  // 1. Resolve the tenant's single leave_policies row (create only if genuinely absent).
  let leavePolId: string | undefined = (
    await client`SELECT id FROM leave_policies WHERE tenant_id = ${tenantId} LIMIT 1`
  )[0]?.id;
  if (!leavePolId) {
    leavePolId = uuid();
    console.log("    no existing leave_policies row found — creating it (same shape as load-excel-dataset.ts).");
    await client`
      INSERT INTO leave_policies (id, tenant_id, attributes)
      VALUES (${leavePolId}, ${tenantId}, ${JSON.stringify({ code: "POL-LEAVE-2026", name: "Standard Factory & Office Leave Policy 2026" })}::jsonb)
    `;
  }
  ctx.leavePolicyId = leavePolId;

  // 2. Build the schemes array (each scheme + its own matrix rules nested under it),
  // plus the "All schemes" universal rules (LR-09 / LOP) kept once, separately.
  const universalRules = ruleRows.filter((r) => r["Scheme"] === "All schemes");
  const schemes = schemeRows.map((s) => {
    const code = s["Scheme code"] as string;
    const rules = ruleRows
      .filter((r) => r["Scheme"] === code)
      .map((r) => ({
        rule_code: r["Rule code"],
        leave_type: r["Leave type"],
        cannot_combine_with: splitList(r["Cannot be combined with"]),
        checked_across_contiguous_absence: yn(r["Checked across contiguous absence"]),
        max_availed_per_calendar_month: r["Max availed per calendar month"],
        min_service_months_before_accrual: r["Min service months before accrual"],
        catch_up_on_completion: r["Catch-up on completion"],
        half_day_permitted: yn(r["Half day permitted"]),
        encashable: yn(r["Encashable"]),
        display_unit: r["Display unit"],
        blocked_at: r["Blocked at"],
      }));
    return {
      scheme_code: code,
      scheme_name: s["Scheme name"],
      applies_from_grade_rank: s["Applies from grade rank"],
      applies_to_trainees: yn(s["Applies to trainees"]),
      el_at_year_end: s["EL at year end"],
      cl_at_year_end: s["CL at year end"],
      sl_at_year_end: s["SL at year end"],
      el_carry_forward_cap_days: s["EL carry forward cap (days)"],
      coff_lapse_days: s["COFF lapse days"],
      birthday_leave: yn(s["Birthday leave"]),
      accrual_policies_in_scheme: splitList(s["Accrual policies in this scheme"]),
      employees_mapped: s["Employees mapped"],
      rules,
    };
  });

  await client`
    UPDATE leave_policies
    SET attributes = coalesce(attributes, '{}'::jsonb) || ${JSON.stringify({
      schemes,
      universal_rules: universalRules.map((r) => ({
        rule_code: r["Rule code"],
        leave_type: r["Leave type"],
        blocked_at: r["Blocked at"],
      })),
    })}::jsonb,
    updated_at = now()
    WHERE id = ${leavePolId}
  `;
  console.log(`    merged ${schemes.length} scheme(s) / ${ruleRows.length - universalRules.length} scheme-rule row(s) into leave_policies ${leavePolId}.`);

  // 3. leave_policy_assignments: one row per Excel-sourced employee (E1xxx), each
  // carrying the resolved scheme code in its own attributes (since every row shares
  // the same leave_policy_id, the scheme code is what actually distinguishes them).
  const employees = (await client`
    SELECT id, employee_code, designation FROM employees
    WHERE tenant_id = ${tenantId} AND employee_code ~ '^E1[0-9]{3}$'
  `) as Array<{ id: string; employee_code: string; designation: string | null }>;

  const existingAssignments = await client`
    SELECT employee_id FROM leave_policy_assignments WHERE tenant_id = ${tenantId} AND leave_policy_id = ${leavePolId}
  `;
  const assignedEmployeeIds = new Set((existingAssignments as any[]).map((r) => r.employee_id));

  const validSchemeCodes = new Set(schemes.map((s) => s.scheme_code));
  const fallbackSchemeCode = validSchemeCodes.has("LS-STD")
    ? "LS-STD"
    : schemes.find((s) => (s.applies_from_grade_rank ?? 0) === 0)?.scheme_code ?? null;

  // Primary source: 12_Employees.json carries a "Leave scheme" column directly on
  // every employee row (more direct/reliable than resolving through designation,
  // and equally sheet-sourced — no invention either way). Secondary fallback: the
  // employee's designation's own "Default leave scheme" (05_Designations.json,
  // a column added in this dataset revision).
  const employeeRows = readSheetData("12_employees.json").filter(
    (r) => typeof r["Employee code"] === "string" && /^E1[0-9]{3}$/.test(r["Employee code"]),
  );
  const schemeByEmployeeCode = new Map<string, string | null>(
    employeeRows.map((r) => [r["Employee code"], textOrNull(r["Leave scheme"])]),
  );
  const designationRows = readSheetData("05_designations.json").filter(
    (r) => typeof r["Designation code"] === "string" && r["Designation code"].startsWith("DES-"),
  );
  const defaultSchemeByDesignation = new Map<string, string | null>(
    designationRows.map((r) => [r["Designation code"], textOrNull(r["Default leave scheme"])]),
  );

  let created = 0;
  let skipped = 0;
  for (const emp of employees) {
    if (assignedEmployeeIds.has(emp.id)) continue;

    let schemeCode = schemeByEmployeeCode.get(emp.employee_code) ?? null;
    let source = "employee_leave_scheme";
    if (!schemeCode || !validSchemeCodes.has(schemeCode)) {
      schemeCode = emp.designation ? defaultSchemeByDesignation.get(emp.designation) ?? null : null;
      source = "designation_default_leave_scheme";
    }
    if (!schemeCode || !validSchemeCodes.has(schemeCode)) {
      if (fallbackSchemeCode) {
        schemeCode = fallbackSchemeCode;
        source = "fallback_rank_0";
      } else {
        console.warn(
          `[WARN] sheet 39/40: no resolvable leave scheme for employee ${emp.employee_code} (designation ${emp.designation ?? "none"}) — skipping leave_policy_assignments row.`,
        );
        skipped++;
        continue;
      }
    }

    await client`
      INSERT INTO leave_policy_assignments (id, tenant_id, leave_policy_id, employee_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${leavePolId}, ${emp.id}, ${JSON.stringify({ scheme_code: schemeCode, resolved_via: source })}::jsonb)
    `;
    created++;
  }
  console.log(`    leave_policy_assignments: created ${created}, skipped ${skipped} (unresolvable scheme).`);
}

// ---------------------------------------------------------------------------
// Sheets 41 (Grace & Late Policy) + 42 (Night Extension Rule) -> merged into the
// tenant's existing attendance_policies row's attributes.
// ---------------------------------------------------------------------------
//
// NOTE on where this data is actually read from: `src/server/attendance/
// attendance-policy.ts` (`loadAttendancePolicy` / `nightExtensionForShift`) reads
// its live grace-late and night-extension configuration from published
// `hrms_operation_records` rows (resources `grace-late-policies` /
// `night-extension-rules`) or from approved `vp_rule_sets` — NOT from
// `attendance_policies.attributes`. That table is a separate, older store read by
// `engine-console.ts` / `regularizations.ts` with its own key names (e.g.
// `grace_in_min`, `grace_minutes`). The task brief explicitly assigns this sheet
// pair to `attendance_policies.attributes` (no new table allowed), so that is
// where this merge goes; the field names below still mirror the exact camelCase
// keys `graceLateFromPublished` / `nightExtensionFromPublished` read, so the data
// is at least shaped correctly if it is ever promoted into an operational record.
// A console.warn below flags this gap explicitly rather than silently presenting
// the merge as "live".
async function loadGraceAndNightExtension(ctx: SeedContext): Promise<void> {
  const { client, tenantId } = ctx;
  console.log("--> Loading 41_Grace_Late_Policy + 42_Night_Extension_Rule -> attendance_policies (merge)...");

  const graceRows = readSheetData("41_grace_late_policy.json").filter(
    (r) => typeof r["Policy code"] === "string" && r["Policy code"].startsWith("GP-"),
  );
  const nightRows = readSheetData("42_night_extension_rule.json").filter(
    (r) => typeof r["Rule code"] === "string" && r["Rule code"].startsWith("NE-"),
  );

  const existing = await client`
    SELECT id FROM attendance_policies WHERE tenant_id = ${tenantId} ORDER BY created_at ASC LIMIT 1
  `;
  let policyId: string | undefined = (existing as any[])[0]?.id;
  if (!policyId) {
    policyId = uuid();
    console.log("    no existing attendance_policies row found — creating one to merge into.");
    await client`INSERT INTO attendance_policies (id, tenant_id, attributes) VALUES (${policyId}, ${tenantId}, '{}'::jsonb)`;
  }

  const graceLatePolicies = graceRows.map((r) => ({
    policyCode: r["Policy code"],
    appliesTo: r["Applies to"],
    graceInMinutes: r["Grace minutes on arrival"],
    graceOutMinutes: r["Grace minutes on departure"],
    latesAllowedPerMonth: r["Lates allowed per month"],
    consequenceBeyondAllowance: r["Consequence beyond the allowance"],
    counterResetBasis:
      r["Counter reset basis"] === "Calendar month" ? "calendar_month" : textOrNull(r["Counter reset basis"]),
    exemptFromGradeRank: r["Exempt from grade rank"],
    exemptDesignations: r["Exempt designations"],
    effectiveFrom: r["Effective from"],
  }));

  const nightExtensionRules = nightRows.map((r) => ({
    ruleCode: r["Rule code"],
    appliesToShiftCode: r["Applies to shift"],
    triggerAfterTime: r["Previous session ends after"],
    permittedArrivalUntil: r["Permitted arrival until"],
    minimumDepartureTime: r["Minimum departure to qualify"],
    resultingDayStatus: r["Resulting day status"],
    lateMarkSuppressed: yn(r["Late mark suppressed"]),
    graceDeductionSuppressed: yn(r["Grace deduction suppressed"]),
    maxUsesPerMonth: r["Maximum uses per month"],
    effectiveFrom: r["Effective from"],
  }));

  await client`
    UPDATE attendance_policies
    SET attributes = coalesce(attributes, '{}'::jsonb) || ${JSON.stringify({ grace_late_policies: graceLatePolicies, night_extension_rules: nightExtensionRules })}::jsonb,
        updated_at = now()
    WHERE id = ${policyId}
  `;
  console.log(`    merged ${graceLatePolicies.length} grace-late row(s) + ${nightExtensionRules.length} night-extension row(s) into attendance_policies ${policyId}.`);
  console.warn(
    "[WARN] sheet 41/42: the live attendance engine (loadAttendancePolicy in src/server/attendance/attendance-policy.ts) reads grace/night-extension settings from published hrms_operation_records or approved vp_rule_sets, not from attendance_policies.attributes. This merge is reference/staging data only — publish the equivalent grace-late-policies / night-extension-rules operational records for these values to actually govern attendance processing.",
  );
}

// ---------------------------------------------------------------------------
// Follow-up to sheets 41+42: publish the actual `hrms_operation_records` rows
// the live attendance engine reads (see the console.warn above). The merge
// into attendance_policies.attributes is kept as-is (matches the task brief's
// literal table assignment); this additionally makes the values genuinely
// govern attendance processing, closing the gap flagged during review.
//
// Only GP-01 (the base grace/late policy) is published — GP-01-EX restates
// the same grade-rank exemption from a second angle with a different
// "consequence" for documentation purposes; the engine's GraceLatePolicy
// type has one exemptFromGradeRank and one consequence, and
// effectivePublished takes only the single latest row per resource, so
// publishing both would make which one "wins" ambiguous rather than richer.
// Both night-extension rules (NE-01/SH-A, NE-02/SH-B) are genuinely distinct
// per-shift rules and are both published, matching nightExtensionForShift's
// own per-shift lookup.
// ---------------------------------------------------------------------------
async function publishGraceAndNightExtensionRecords(ctx: SeedContext): Promise<void> {
  const { client, tenantId } = ctx;
  console.log("--> Publishing grace-late-policies / night-extension-rules hrms_operation_records...");

  const membershipRows = await client`
    SELECT m.id FROM memberships m
    JOIN membership_roles mr ON mr.membership_id = m.id
    JOIN roles r ON r.id = mr.role_id AND r.code = 'owner'
    WHERE m.tenant_id = ${tenantId} LIMIT 1
  `;
  const membershipId =
    (membershipRows as any[])[0]?.id ??
    (await client`SELECT id FROM memberships WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
  if (!membershipId) {
    console.warn("[WARN] sheet 41/42: no membership exists yet to attribute a published record to — skipping publish.");
    return;
  }

  // `ACC-GRACE` is residue: scripts/seed-acceptance-demo.ts published it under that code
  // until commit ea7f338 renamed it to ACC-GRACE-V1, and nothing has written it since.
  // It is still published and dated 2024-01-01, so it wins the resolution order for every
  // day between then and the client's own policy taking effect — with a threshold nobody
  // maintains. Retire rather than delete: `retire` is the register's own transition out of
  // `published`, loadAttendancePolicy filters on status, and the row stays auditable.
  const retired = await client`
    UPDATE hrms_operation_records
    SET status = 'retired', updated_at = now()
    WHERE tenant_id = ${tenantId} AND resource = 'grace-late-policies'
      AND status = 'published' AND data->>'policyCode' = 'ACC-GRACE'
    RETURNING id
  `;
  if ((retired as any[]).length > 0) {
    console.log(`    retired ${(retired as any[]).length} orphaned ACC-GRACE grace-late record(s).`);
  }

  const graceRow = readSheetData("41_grace_late_policy.json").find((r) => r["Policy code"] === "GP-01");
  if (graceRow) {
    // Sheet 41 has two rows. GP-01-EX is not a second policy: the sheet says it restates
    // the same rank "as a separate row so it is visible", and its consequence ("No
    // action") is just what GP-01's exemption already means for rank 50 and above. The
    // engine holds one grace policy with one exempt rank, so publishing both would make
    // two records compete and, if GP-01-EX won, exempt everyone. GP-01 alone is complete.
    const policyCode = graceRow["Policy code"] as string;
    const data = {
      policyCode,
      graceInMinutes: graceRow["Grace minutes on arrival"],
      graceOutMinutes: graceRow["Grace minutes on departure"],
      latesAllowedPerMonth: graceRow["Lates allowed per month"],
      // The register stores this as a PL_ATTENDANCE_STATUS value, which is what the form
      // writes; attendance-policy.ts accepts either that or the sheet's own wording. Map
      // the one value this sheet uses and pass anything else through unchanged, so an
      // unexpected wording reaches the reader's own "unsupported published value" error
      // instead of being silently nulled here.
      consequenceBeyondAllowance:
        graceRow["Consequence beyond the allowance"] === "Half day"
          ? "half_day"
          : graceRow["Consequence beyond the allowance"],
      counterResetBasis: graceRow["Counter reset basis"] === "Calendar month" ? "calendar_month" : null,
      exemptFromGradeRank: graceRow["Exempt from grade rank"],
      effectiveFrom: graceRow["Effective from"],
    };
    // Keyed on the register's own key field (operational-catalog.ts gives this resource
    // `policyCode` as its first field), not on "does any published row exist" — that
    // earlier guard meant an unrelated record, such as the acceptance fixture's, kept the
    // client's actual policy from ever being written.
    const existing = await client`
      SELECT id FROM hrms_operation_records
      WHERE tenant_id = ${tenantId} AND resource = 'grace-late-policies' AND data->>'policyCode' = ${policyCode}
      LIMIT 1
    `;
    if ((existing as any[]).length === 0) {
      await client`
        INSERT INTO hrms_operation_records (id, tenant_id, resource, status, data, created_by_membership_id, version)
        VALUES (${uuid()}, ${tenantId}, 'grace-late-policies', 'published', ${JSON.stringify(data)}::jsonb, ${membershipId}, 1)
      `;
      console.log(`    published grace-late-policies (${policyCode}).`);
    } else {
      await client`
        UPDATE hrms_operation_records
        SET data = data || ${JSON.stringify(data)}::jsonb, updated_at = now()
        WHERE tenant_id = ${tenantId} AND id = ${(existing as any[])[0].id}
      `;
      console.log(`    refreshed grace-late-policies (${policyCode}) from sheet 41.`);
    }
  }

  const nightRows = readSheetData("42_night_extension_rule.json").filter(
    (r) => typeof r["Rule code"] === "string" && r["Rule code"].startsWith("NE-"),
  );
  for (const row of nightRows) {
    const shiftCode = row["Applies to shift"] as string;
    const existing = await client`
      SELECT id FROM hrms_operation_records
      WHERE tenant_id = ${tenantId} AND resource = 'night-extension-rules' AND status = 'published' AND data->>'appliesToShiftCode' = ${shiftCode}
      LIMIT 1
    `;
    if ((existing as any[]).length > 0) continue;
    const data = {
      appliesToShiftCode: shiftCode,
      triggerAfterTime: row["Previous session ends after"],
      permittedArrivalUntil: row["Permitted arrival until"],
      minimumDepartureTime: row["Minimum departure to qualify"],
      resultingDayStatus: row["Resulting day status"],
      maxUsesPerMonth: row["Maximum uses per month"] ?? null,
      effectiveFrom: row["Effective from"],
    };
    await client`
      INSERT INTO hrms_operation_records (id, tenant_id, resource, status, data, created_by_membership_id, version)
      VALUES (${uuid()}, ${tenantId}, 'night-extension-rules', 'published', ${JSON.stringify(data)}::jsonb, ${membershipId}, 1)
    `;
    console.log(`    published night-extension-rules (${row["Rule code"]}, shift ${shiftCode}).`);
  }
}

// ---------------------------------------------------------------------------
// Sheets 43 (Roles & Data Scope) + 44 (Demo Users) -> roles, role_permissions,
// tenant_settings (dataScopes key, via the exact shape data-scopes.ts reads),
// "user", account, memberships, membership_roles.
// ---------------------------------------------------------------------------
async function loadRolesAndDemoUsers(ctx: SeedContext): Promise<void> {
  const { client, tenantId } = ctx;
  console.log("--> Loading 43_Roles_and_Data_Scope + 44_Demo_Users...");

  const roleRows = readSheetData("43_roles_and_data_scope.json").filter(
    (r) => typeof r["Role code"] === "string" && r["Role code"].startsWith("R-"),
  );
  const userRows = readSheetData("44_demo_users.json").filter((r) => typeof r["Login"] === "string" && r["Login"]);

  // Real, already-seeded permission_key values only — never invented.
  const permRows = await client`SELECT permission_key FROM permissions`;
  const knownPermissions = new Set((permRows as any[]).map((r) => r.permission_key as string));
  const pick = (...keys: string[]) => keys.filter((k) => knownPermissions.has(k));

  // Group sheet rows by role code: the same code can appear twice with different
  // scope values (R-PLANT-HR: Chennai and Peenya) — one role, several scope values.
  type RoleAgg = {
    name: string;
    scopeDimensionRaw: string;
    scopeValues: Set<string>;
    canViewSalary: boolean;
    canViewRate: boolean;
    canViewAttendance: boolean;
    canEditAttendance: boolean;
    canRunPayroll: boolean;
    canApprove: string[];
  };
  const byCode = new Map<string, RoleAgg>();
  for (const r of roleRows) {
    const code = r["Role code"] as string;
    const agg = byCode.get(code) ?? {
      name: r["Role name"],
      scopeDimensionRaw: r["Scope dimension"],
      scopeValues: new Set<string>(),
      canViewSalary: false,
      canViewRate: false,
      canViewAttendance: false,
      canEditAttendance: false,
      canRunPayroll: false,
      canApprove: [] as string[],
    };
    if (yn(r["Can view salary structure"])) agg.canViewSalary = true;
    if (yn(r["Can view rate structure"])) agg.canViewRate = true;
    if (yn(r["Can view attendance"])) agg.canViewAttendance = true;
    if (yn(r["Can edit attendance"])) agg.canEditAttendance = true;
    if (yn(r["Can run payroll"])) agg.canRunPayroll = true;
    const scopeValue = textOrNull(r["Scope value"]);
    if (scopeValue) {
      // Keep only the leading code-looking token (e.g. "LOC-CHN" out of
      // "LOC-CHN (payroll group PLANT-CHN)") — the parenthetical is commentary.
      const cleaned = scopeValue.replace(/\s*\(.*\)\s*$/, "").trim();
      for (const v of cleaned.split(/\s+and\s+|,\s*/)) {
        if (v) agg.scopeValues.add(v);
      }
    }
    const approve = textOrNull(r["Can approve"]);
    if (approve && approve !== "None") agg.canApprove.push(approve);
    byCode.set(code, agg);
  }

  // The dimension vocabulary DATA_SCOPE_DIMENSIONS only knows "attendance_location"
  // and "payroll_location" (src/server/identity/authorization.ts). The sheet's own
  // "Scope dimension" text is richer (Reporting line, Legal entity, Establishment,
  // Self) but has no matching engine-enforced dimension yet, so it is kept as
  // reference on the role's own attributes and only mapped to a real dimension
  // when it is unambiguous.
  function mapScopeDimension(raw: string): "attendance_location" | "payroll_location" | null {
    const v = raw.trim().toLowerCase();
    if (v === "attendance location") return "attendance_location";
    if (v === "payroll processing location") return "payroll_location";
    return null;
  }

  const roleIdByCode = new Map<string, string>();
  for (const [code, agg] of byCode) {
    let roleId = (await client`SELECT id FROM roles WHERE tenant_id = ${tenantId} AND code = ${code} LIMIT 1`)[0]?.id;
    if (!roleId) {
      roleId = uuid();
      await client`
        INSERT INTO roles (id, tenant_id, code, name, system_managed)
        VALUES (${roleId}, ${tenantId}, ${code}, ${agg.name}, false)
      `;
    }
    roleIdByCode.set(code, roleId);

    // Permission mapping: only ever onto permission_key values that already exist.
    const perms = new Set<string>([...pick("tenant.read", "employee.read")]);
    if (agg.canViewAttendance) for (const p of pick("attendance.read")) perms.add(p);
    if (agg.canEditAttendance) for (const p of pick("attendance.write")) perms.add(p);
    if (agg.canViewSalary) for (const p of pick("payroll.read")) perms.add(p);
    if (agg.canViewRate) for (const p of pick("payroll.rate.read")) perms.add(p);
    if (agg.canRunPayroll) for (const p of pick("payroll.write", "payroll.run")) perms.add(p);
    for (const approval of agg.canApprove) {
      const a = approval.toLowerCase();
      if (a.includes("leave")) for (const p of pick("leave.read", "leave.approve")) perms.add(p);
      if (a.includes("attendance regularisation") || a.includes("ot") || a.includes("gate pass"))
        for (const p of pick("attendance.write")) perms.add(p);
      if (a.includes("payroll run")) for (const p of pick("payroll.run")) perms.add(p);
      if (a.includes("requisition")) for (const p of pick("recruitment.read")) perms.add(p);
      if (a.includes("statutory filing")) for (const p of pick("compliance.read", "compliance.write")) perms.add(p);
      if (a.includes("gl posting")) for (const p of pick("payroll.write")) perms.add(p);
      if (a.includes("f&f") || a.includes("loan")) {
        console.warn(
          `[WARN] sheet 43: role ${code} approves "${approval}" but no seeded permission_key covers F&F/loan approval — left unmapped rather than inventing one.`,
        );
      }
    }
    if (perms.size > 0) {
      await client`
        INSERT INTO role_permissions (tenant_id, role_id, permission_id)
        SELECT ${tenantId}, ${roleId}, id FROM permissions
        WHERE permission_key = ANY(${Array.from(perms)})
        ON CONFLICT DO NOTHING
      `;
    }

    // Data scope: stored in tenant_settings.settings.dataScopes.<roleCode>, the
    // exact shape src/server/access-scopes/data-scopes.ts / data-scope-settings.ts
    // read (StoredRoleScope: scopeDimension, scopeValues, canViewSalaryStructure,
    // canViewRateStructure).
    const dimension = mapScopeDimension(agg.scopeDimensionRaw);
    if (dimension) {
      const stored = {
        scopeDimension: dimension,
        scopeValues: Array.from(agg.scopeValues),
        canViewSalaryStructure: agg.canViewSalary,
        canViewRateStructure: agg.canViewRate,
      };
      await client`
        INSERT INTO tenant_settings (tenant_id, settings)
        VALUES (${tenantId}, jsonb_build_object('dataScopes', ${JSON.stringify({ [code]: stored })}::jsonb))
        ON CONFLICT (tenant_id) DO UPDATE
        SET settings = jsonb_set(
              coalesce(tenant_settings.settings, '{}'::jsonb),
              array['dataScopes'],
              coalesce(tenant_settings.settings->'dataScopes', '{}'::jsonb) || ${JSON.stringify({ [code]: stored })}::jsonb,
              true
            ),
            updated_at = now()
      `;
    } else {
      // `roles` is a fully-typed table (id, tenant_id, code, name, system_managed,
      // status) with no attributes/jsonb column to fall back to, so a scope
      // dimension the engine doesn't recognize genuinely has nowhere to land —
      // reported here rather than written somewhere the app will never read.
      console.warn(
        `[WARN] sheet 43: role ${code}'s scope dimension "${agg.scopeDimensionRaw}" has no matching entry in DATA_SCOPE_DIMENSIONS (attendance_location, payroll_location) — scope values [${Array.from(agg.scopeValues).join(", ")}] and "Can approve" [${agg.canApprove.join("; ") || "none"}] were not persisted anywhere; the role and its resolvable permissions above are still created.`,
      );
    }
  }
  console.log(`    roles: ${byCode.size} distinct role code(s) from sheet 43 ensured.`);

  // 44: Demo Users. New, separate credential-bearing accounts (not the employee's
  // own auto-generated user row from 12_Employees), per task brief.
  const demoPasswordHash = await hashPassword("Brightenz@2026!");
  const employeesByCode = new Map(
    (
      (await client`SELECT id, employee_code FROM employees WHERE tenant_id = ${tenantId} AND employee_code ~ '^E1[0-9]{3}$'`) as Array<{
        id: string;
        employee_code: string;
      }>
    ).map((r) => [r.employee_code, r.id]),
  );

  let usersCreated = 0;
  for (const row of userRows) {
    const login = row["Login"] as string;
    const email = `${login}@vindhya.demo`;
    const roleCode = row["Role"] as string;
    const roleId = roleIdByCode.get(roleCode);
    if (!roleId) {
      console.warn(`[WARN] sheet 44: user ${login} references role ${roleCode}, which was not found among sheet 43's roles — skipping.`);
      continue;
    }
    const linkedEmployeeId = employeesByCode.get(row["Linked employee"] as string) ?? null;
    if (!linkedEmployeeId) {
      console.warn(`[WARN] sheet 44: user ${login}'s linked employee ${row["Linked employee"]} was not found in employees — creating the login anyway (no employee link column exists on memberships).`);
    }

    let userId = (await client`SELECT id FROM "user" WHERE lower(email) = ${email.toLowerCase()} LIMIT 1`)[0]?.id;
    if (!userId) {
      userId = uuid();
      await client`
        INSERT INTO "user" (id, name, email, email_verified, status)
        VALUES (${userId}, ${row["Full name"]}, ${email.toLowerCase()}, true, 'active')
      `;
      usersCreated++;
    }
    await client`
      INSERT INTO account (id, account_id, provider_id, user_id, password)
      VALUES (${uuid()}, ${userId}, 'credential', ${userId}, ${demoPasswordHash})
      ON CONFLICT (provider_id, account_id) DO UPDATE SET password = ${demoPasswordHash}
    `;

    let memId = (await client`SELECT id FROM memberships WHERE tenant_id = ${tenantId} AND user_id = ${userId} LIMIT 1`)[0]?.id;
    if (!memId) {
      memId = uuid();
      // Coarse category column, same convention as domain01-identity.ts: only the
      // three literal built-in strings get their own bucket, everything else is
      // "employee" — the real permission set lives in membership_roles below.
      const coarseRole = roleCode === "R-MANAGER" ? "manager" : roleCode === "R-HRHEAD" ? "hr-manager" : "employee";
      await client`
        INSERT INTO memberships (id, tenant_id, user_id, role, status)
        VALUES (${memId}, ${tenantId}, ${userId}, ${coarseRole}, 'active')
      `;
    }
    await client`
      INSERT INTO membership_roles (tenant_id, membership_id, role_id)
      VALUES (${tenantId}, ${memId}, ${roleId})
      ON CONFLICT DO NOTHING
    `;
  }
  console.log(`    demo users: ${usersCreated} new "user" row(s) created (of ${userRows.length} sheet rows), memberships/membership_roles ensured for all resolvable rows.`);
}

// ---------------------------------------------------------------------------
// Sheet 45: Vendors / Contractors -> contractor_organizations
// ---------------------------------------------------------------------------
async function loadVendorsContractors(ctx: SeedContext): Promise<void> {
  const { client, tenantId } = ctx;
  console.log("--> Loading 45_Vendors_Contractors -> contractor_organizations...");

  const rows = readSheetData("45_vendors_contractors.json").filter(
    (r) => typeof r["Vendor code"] === "string" && r["Vendor code"].startsWith("VN-"),
  );

  const existing = await client`
    SELECT attributes->>'code' as code FROM contractor_organizations WHERE tenant_id = ${tenantId}
  `;
  const existingCodes = new Set((existing as any[]).map((r) => r.code).filter(Boolean));

  let inserted = 0;
  for (const row of rows) {
    const code = row["Vendor code"] as string;
    if (existingCodes.has(code)) continue;

    await client`
      INSERT INTO contractor_organizations (id, tenant_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${JSON.stringify({
        code,
        name: row["Vendor name"],
        engagement_type: row["Engagement type"],
        sites_served: splitList(row["Sites served"]),
        contract_from: row["Contract from"],
        contract_to: row["Contract to"],
        clra_licence: row["CLRA licence"],
        pf_code: row["PF code"],
        esi_code: row["ESI code"],
        workers_deployed: row["Workers deployed"],
        worker_classes: splitList(row["Worker classes"]),
        invoice_basis: row["Invoice basis"],
        pf_esi_verification: row["PF / ESI verification"],
        demo_point: textOrNull(row["Demo point"]),
      })}::jsonb)
    `;
    existingCodes.add(code);
    inserted++;
  }
  console.log(`    inserted ${inserted} contractor_organizations row(s) from sheet 45.`);
}

// ---------------------------------------------------------------------------
// Sheet 47: Pay Components -> pay_components
// ---------------------------------------------------------------------------
//
// src/server/payroll/components.ts reads pay_components.attributes with a fixed
// snake_case vocabulary (kind, calculation_method, percentage_of, percentage_value,
// taxable, part_of_pf_wage, part_of_esi_wage, counts_toward_wage_floor,
// proration_basis, slab_table_ref, gl_debit_account, ...). This sheet's own codes
// (PC-BASIC, PC-DA, ...) are a distinct vocabulary from the lowercase
// STANDARD_COMPONENTS codes (basic, da, ...) that ensureComponentCatalog seeds
// elsewhere; they do not collide and are additive rows.
function mapCalculation(calcText: string | null): {
  method: string | null;
  percentageOf: string | null;
  percentageValue: number | null;
  formulaExpression: string | null;
  slabTableRef: string | null;
} {
  if (!calcText) return { method: null, percentageOf: null, percentageValue: null, formulaExpression: null, slabTableRef: null };
  const pct = /^(\d+(?:\.\d+)?)%\s*of\s*(\w+)/i.exec(calcText);
  if (pct) {
    const base = pct[2].toLowerCase();
    return {
      method: "percentage_of_component",
      percentageOf: base === "basic" ? "PC-BASIC" : null,
      percentageValue: Number(pct[1]) / 100,
      formulaExpression: null,
      slabTableRef: null,
    };
  }
  if (/^fixed/i.test(calcText)) {
    return { method: "fixed_amount", percentageOf: null, percentageValue: null, formulaExpression: null, slabTableRef: null };
  }
  if (/slab/i.test(calcText)) {
    return { method: "slab_table", percentageOf: null, percentageValue: null, formulaExpression: null, slabTableRef: calcText };
  }
  if (/multiplied by/i.test(calcText)) {
    return { method: "rate_x_quantity", percentageOf: null, percentageValue: null, formulaExpression: calcText, slabTableRef: null };
  }
  // Narrative / derived calculations with no closer enum match (e.g. "Balancing
  // figure to gross", "Projected annual liability spread over remaining months").
  return { method: "formula", percentageOf: null, percentageValue: null, formulaExpression: calcText, slabTableRef: null };
}

function mapProrationBasis(text: string | null): string | null {
  if (!text) return null;
  const v = text.toLowerCase();
  if (v.includes("calendar days")) return "calendar_days";
  if (v.includes("days present")) return "payable_days";
  return null;
}

async function loadPayComponents(ctx: SeedContext): Promise<void> {
  const { client, tenantId } = ctx;
  console.log("--> Loading 47_Pay_Components -> pay_components...");

  const rows = readSheetData("47_pay_components.json").filter(
    (r) => typeof r["Component code"] === "string" && r["Component code"].startsWith("PC-"),
  );

  const existing = await client`
    SELECT attributes->>'code' as code FROM pay_components WHERE tenant_id = ${tenantId}
  `;
  const existingCodes = new Set((existing as any[]).map((r) => r.code).filter(Boolean));

  const glRows = await client`
    SELECT id, attributes->>'account_code' as code FROM gl_accounts WHERE tenant_id = ${tenantId}
  `;
  const glIdByCode = new Map((glRows as any[]).map((r) => [r.code, r.id]));

  let inserted = 0;
  for (const row of rows) {
    const code = row["Component code"] as string;
    if (existingCodes.has(code)) continue;

    const type = textOrNull(row["Type"]);
    const kind = type === "Earning" ? "earning" : type === "Deduction" ? "deduction" : type === "Employer contribution" ? "employer_contribution" : null;
    const calc = mapCalculation(textOrNull(row["Calculation"]));
    const glMappingRaw = textOrNull(row["GL mapping"]);
    const firstGlCode = glMappingRaw ? glMappingRaw.split("/")[0].trim() : null;

    const attributes: Record<string, unknown> = {
      code,
      name: row["Component name"],
      kind,
      calculation_method: calc.method,
      percentage_of: calc.percentageOf,
      percentage_value: calc.percentageValue,
      formula_expression: calc.formulaExpression,
      slab_table_ref: calc.slabTableRef,
      proration_basis: mapProrationBasis(textOrNull(row["Proration basis"])),
      gl_debit_account: firstGlCode ? glIdByCode.get(firstGlCode) ?? null : null,
      gl_mapping_raw: glMappingRaw,
      demo_point: textOrNull(row["Demo point"]),
    };
    const taxable = yn(row["Taxable"]);
    if (taxable !== null) attributes.taxable = taxable;
    const pfApplicable = yn(row["PF applicable"]);
    if (pfApplicable !== null) attributes.part_of_pf_wage = pfApplicable;
    const esiApplicable = yn(row["ESI applicable"]);
    if (esiApplicable !== null) attributes.part_of_esi_wage = esiApplicable;
    const ptApplicable = yn(row["PT applicable"]);
    if (ptApplicable !== null) attributes.pt_applicable = ptApplicable;
    const codeOnWagesBase = yn(row["In the Code on Wages base"]);
    if (codeOnWagesBase !== null) attributes.counts_toward_wage_floor = codeOnWagesBase;
    const showsOnPayslip = yn(row["Shows on payslip"]);
    if (showsOnPayslip !== null) attributes.shows_on_payslip = showsOnPayslip;

    await client`
      INSERT INTO pay_components (id, tenant_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${JSON.stringify(attributes)}::jsonb)
    `;
    existingCodes.add(code);
    inserted++;
  }
  console.log(`    inserted ${inserted} pay_components row(s) from sheet 47.`);
}

// ---------------------------------------------------------------------------
// Sheet 48: PT Slabs -> merged into the existing (global) rule_pack_versions row
// ---------------------------------------------------------------------------
async function loadPtSlabs(ctx: SeedContext): Promise<void> {
  const { client } = ctx;
  console.log("--> Loading 48_PT_Slabs -> rule_pack_versions (merge)...");

  const rows = readSheetData("48_pt_slabs.json").filter(
    (r) => typeof r["Slab set"] === "string" && r["Slab set"].endsWith("-2026") && r["State"],
  );

  const existing = await client`SELECT id FROM rule_pack_versions LIMIT 1`;
  const ruleVerId: string | undefined = (existing as any[])[0]?.id;
  if (!ruleVerId) {
    console.warn("[WARN] sheet 48: no existing rule_pack_versions row found (expected one from load-excel-dataset.ts / domain05-payroll-loans.ts) — skipping PT slab merge entirely rather than creating a rule pack version out of band.");
    return;
  }

  const bySlabSet = new Map<string, { state: string; locations: string[]; slabs: Array<Record<string, unknown>> }>();
  for (const row of rows) {
    const slabSet = row["Slab set"] as string;
    const bucket = bySlabSet.get(slabSet) ?? { state: row["State"], locations: splitList(row["Applies to locations"]), slabs: [] as Array<Record<string, unknown>> };
    bucket.slabs.push({
      gross_from_inr: row["Monthly gross from (INR)"],
      gross_to_inr: row["Monthly gross to (INR)"],
      pt_per_month_inr: row["PT per month (INR)"],
      deduction_frequency: row["Deduction frequency"],
      special_rule: textOrNull(row["Special rule"]),
    });
    bySlabSet.set(slabSet, bucket);
  }
  const ptSlabs = Array.from(bySlabSet.entries()).map(([slabSet, v]) => ({
    slab_set: slabSet,
    state: v.state,
    applies_to_locations: v.locations,
    slabs: v.slabs,
  }));

  await client`
    UPDATE rule_pack_versions
    SET attributes = coalesce(attributes, '{}'::jsonb) || ${JSON.stringify({ pt_slabs: ptSlabs })}::jsonb
    WHERE id = ${ruleVerId}
  `;
  console.log(`    merged ${ptSlabs.length} PT slab set(s) into rule_pack_versions ${ruleVerId}.`);
  console.log(
    "[NOTE] sheet 48 states these PT figures are demo values and must be confirmed against the current state notifications before being relied on in front of a client (Tamil Nadu in particular is levied half-yearly by the local body, not monthly on gross).",
  );
}
