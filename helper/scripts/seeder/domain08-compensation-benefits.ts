import { SeedContext, uuid, hasData } from "./types";

export async function seedDomain08(ctx: SeedContext) {
  const { client, tenantId } = ctx;
  const legalEntityId = (ctx.legalEntityId && ctx.legalEntityId !== "")
    ? ctx.legalEntityId
    : (await client`SELECT id FROM legal_entities WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
  console.log("--> Seeding Domain 08: Compensation, Benefits, Offboarding & Contractors...");

  // 1. Metric Definition & Pay Equity Snapshot
  let metricDefId = "";
  if (await hasData(client, "metric_definitions")) {
    const rows = await client`SELECT id FROM metric_definitions WHERE tenant_id = ${tenantId} LIMIT 1`;
    metricDefId = rows[0]?.id;
  } else {
    metricDefId = uuid();
    await client`
      INSERT INTO metric_definitions (id, tenant_id, attributes)
      VALUES (${metricDefId}, ${tenantId}, ${JSON.stringify({ code: "PAY_EQUITY_RATIO", name: "Gender & Grade Pay Equity Parity Index", unit: "ratio", benchmark_target: 1.0 })}::jsonb)
    `;
  }

  if (metricDefId && !(await hasData(client, "pay_equity_snapshots"))) {
    await client`
      INSERT INTO pay_equity_snapshots (id, tenant_id, legal_entity_id, metric_definition_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${legalEntityId}, ${metricDefId}, ${JSON.stringify({ snapshot_date: "2025-12-31", overall_ratio: 0.98, status: "healthy" })}::jsonb)
    `;
  }

  if (!(await hasData(client, "market_benchmarks"))) {
    await client`
      INSERT INTO market_benchmarks (id, tenant_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${JSON.stringify({ industry: "Textile & Manufacturing", benchmark_year: 2025, median_salary_minor: 4800000, "75th_percentile_minor": 6500000 })}::jsonb)
    `;
  }

  // 2. Compensation Cycles, Bands, Budgets, Proposals & Snapshots
  if (!(await hasData(client, "compensation_bands"))) {
    for (const gradeCode of ["G-EXEC", "G-MGR", "G-SUP", "G-STAFF"]) {
      const gId = ctx.gradeIds[gradeCode] || (await client`SELECT id FROM grades WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
      if (gId) {
        await client`
          INSERT INTO compensation_bands (id, tenant_id, grade_id, attributes)
          VALUES (${uuid()}, ${tenantId}, ${gId}, ${JSON.stringify({ min_salary_minor: 2500000, mid_salary_minor: 5000000, max_salary_minor: 12000000, currency: "INR" })}::jsonb)
        `;
      }
    }
  }

  let compCycleId = "";
  if (await hasData(client, "compensation_cycles")) {
    const rows = await client`SELECT id FROM compensation_cycles WHERE tenant_id = ${tenantId} LIMIT 1`;
    compCycleId = rows[0]?.id;
  } else {
    compCycleId = uuid();
    await client`
      INSERT INTO compensation_cycles (id, tenant_id, legal_entity_id, attributes)
      VALUES (${compCycleId}, ${tenantId}, ${legalEntityId}, ${JSON.stringify({ code: "COMP-FY25-26", name: "Annual Compensation & Merit Review 2025", effective_date: "2025-04-01", status: "completed" })}::jsonb)
    `;
  }

  if (compCycleId && !(await hasData(client, "compensation_budgets"))) {
    await client`
      INSERT INTO compensation_budgets (id, tenant_id, compensation_cycle_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${compCycleId}, ${JSON.stringify({ department: "Manufacturing", allocated_minor: 25000000, utilized_minor: 22000000 })}::jsonb)
    `;
  }

  if (compCycleId && !(await hasData(client, "compensation_proposals"))) {
    const [firstAssign] = await client`SELECT id, employee_id FROM employee_salary_assignments WHERE tenant_id = ${tenantId} LIMIT 1`;
    if (firstAssign) {
      const propId = uuid();
      await client`
        INSERT INTO compensation_proposals (id, tenant_id, compensation_cycle_id, employee_id, current_salary_assignment_id, attributes)
        VALUES (${propId}, ${tenantId}, ${compCycleId}, ${firstAssign.employee_id}, ${firstAssign.id}, ${JSON.stringify({ current_ctc_minor: 3800000, proposed_ctc_minor: 4200000, hike_percentage: 10.5, merit_rating: "Exceeds" })}::jsonb)
      `;

      if (!(await hasData(client, "compensation_approvals"))) {
        const approverMem = ctx.membershipByCode["MK-101"] || (await client`SELECT id FROM memberships WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
        if (approverMem) {
          await client`
            INSERT INTO compensation_approvals (id, tenant_id, compensation_proposal_id, membership_id, attributes)
            VALUES (${uuid()}, ${tenantId}, ${propId}, ${approverMem}, ${JSON.stringify({ approved_at: "2025-03-25", decision: "approved", remarks: "Solid performance contribution in FY25." })}::jsonb)
          `;
        }
      }
    }
  }

  if (!(await hasData(client, "employee_compensation_snapshots"))) {
    for (const emp of ctx.roster.slice(0, 6)) {
      await client`
        INSERT INTO employee_compensation_snapshots (id, tenant_id, employee_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${emp.employeeId}, ${JSON.stringify({ as_of_date: "2025-04-01", fixed_base_minor: emp.salaryMinor, allowances_minor: 500000, annual_variable_minor: 2000000 })}::jsonb)
      `;
    }
  }

  // 3. Benefit Plans, Options, Windows, Enrollments & Claims
  let benPlanId = "";
  if (await hasData(client, "benefit_plans")) {
    const rows = await client`SELECT id FROM benefit_plans WHERE tenant_id = ${tenantId} LIMIT 1`;
    benPlanId = rows[0]?.id;
  } else {
    benPlanId = uuid();
    await client`
      INSERT INTO benefit_plans (id, tenant_id, legal_entity_id, attributes)
      VALUES (${benPlanId}, ${tenantId}, ${legalEntityId}, ${JSON.stringify({ code: "GMC-PLANT-2025", name: "Group Mediclaim Insurance Policy", provider: "New India Assurance", sum_insured_minor: 50000000 })}::jsonb)
    `;
  }

  let benOptId = "";
  if (await hasData(client, "benefit_options")) {
    const rows = await client`SELECT id FROM benefit_options WHERE tenant_id = ${tenantId} LIMIT 1`;
    benOptId = rows[0]?.id;
  } else {
    benOptId = uuid();
    await client`
      INSERT INTO benefit_options (id, tenant_id, benefit_plan_id, attributes)
      VALUES (${benOptId}, ${tenantId}, ${benPlanId}, ${JSON.stringify({ option_code: "FAMILY_FLOATER", coverage_tier: "Employee + Spouse + 2 Children", premium_employee_minor: 50000 })}::jsonb)
    `;
  }

  if (!(await hasData(client, "enrollment_windows"))) {
    await client`
      INSERT INTO enrollment_windows (id, tenant_id, benefit_plan_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${benPlanId}, ${JSON.stringify({ window_name: "Annual Open Enrollment FY25-26", opens_on: "2025-04-01", closes_on: "2025-04-30", status: "closed" })}::jsonb)
    `;
  }

  if (!(await hasData(client, "benefit_enrollments"))) {
    for (const emp of ctx.roster.slice(0, 6)) {
      const enrollId = uuid();
      await client`
        INSERT INTO benefit_enrollments (id, tenant_id, employee_id, benefit_plan_id, benefit_option_id, attributes)
        VALUES (${enrollId}, ${tenantId}, ${emp.employeeId}, ${benPlanId}, ${benOptId}, ${JSON.stringify({ enrolled_on: "2025-04-10", status: "active", card_number: `GMC-${emp.code}-2025` })}::jsonb)
      `;

      if (emp.code === "MK-104" && !(await hasData(client, "benefit_claims"))) {
        await client`
          INSERT INTO benefit_claims (id, tenant_id, benefit_enrollment_id, attributes)
          VALUES (${uuid()}, ${tenantId}, ${enrollId}, ${JSON.stringify({ claim_number: "CLM-2025-9988", hospital_name: "Jupiter Hospital Thane", claim_amount_minor: 4500000, approved_amount_minor: 4200000, status: "settled", settled_on: "2025-08-15" })}::jsonb)
        `;
      }
    }
  }

  // 4. Offboarding Cases, Full & Final Settlements, Clearance, Exit Interviews & Alumni
  if (!(await hasData(client, "offboarding_cases"))) {
    console.log("  [SEED] offboarding_cases is empty. Inserting offboarded employee & settlement.");
    const pastEmpId = uuid();
    const pastPersonId = uuid();
    const pastEmploymentId = uuid();
    const pastUserId = uuid();

    await client`
      INSERT INTO "user" (id, name, email, email_verified, status)
      VALUES (${pastUserId}, 'Harish Solanki', 'harish.solanki@mkraft.demo', true, 'inactive')
      ON CONFLICT (email) DO NOTHING
    `;
    await client`INSERT INTO people (id, tenant_id) VALUES (${pastPersonId}, ${tenantId})`;
    await client`
      INSERT INTO employees (
        id, tenant_id, person_id, employee_code, first_name, last_name, 
        designation, department, location, joining_date, basic_salary_minor, status
      )
      VALUES (
        ${pastEmpId}, ${tenantId}, ${pastPersonId}, 'MK-099', 'Harish', 'Solanki',
        'Junior Dyeing Chemist', 'Dyeing', 'Plant North', '2024-04-10', 3200000, 'inactive'
      )
    `;

    const wkCatId = (await client`SELECT id FROM worker_categories WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
    await client`
      INSERT INTO employments (id, tenant_id, employee_id, legal_entity_id, worker_category_id, attributes)
      VALUES (${pastEmploymentId}, ${tenantId}, ${pastEmpId}, ${legalEntityId}, ${wkCatId}, ${JSON.stringify({ start_date: "2024-04-10", end_date: "2025-12-15", status: "terminated" })}::jsonb)
    `;

    const offbCaseId = uuid();
    await client`
      INSERT INTO offboarding_cases (id, tenant_id, employment_id, attributes)
      VALUES (${offbCaseId}, ${tenantId}, ${pastEmploymentId}, ${JSON.stringify({ separation_type: "resignation", resignation_date: "2025-11-15", last_working_day: "2025-12-15", status: "completed" })}::jsonb)
    `;

    if (!(await hasData(client, "clearance_items"))) {
      for (const dept of ["IT Equipment Clearance", "Plant Safety Kit Return", "Finance Loan Settlement", "HR ID Card Surrender"]) {
        await client`
          INSERT INTO clearance_items (id, tenant_id, offboarding_case_id, attributes)
          VALUES (${uuid()}, ${tenantId}, ${offbCaseId}, ${JSON.stringify({ item_name: dept, cleared: true, cleared_at: "2025-12-14" })}::jsonb)
        `;
      }
    }

    const fnfId = uuid();
    if (!(await hasData(client, "full_final_settlements"))) {
      await client`
        INSERT INTO full_final_settlements (id, tenant_id, employment_id, attributes)
        VALUES (${fnfId}, ${tenantId}, ${pastEmploymentId}, ${JSON.stringify({ settlement_date: "2025-12-20", net_payable_minor: 4800000, status: "paid" })}::jsonb)
      `;

      if (!(await hasData(client, "full_final_lines"))) {
        const basicCompId = ctx.payComponentIds["BASIC"] || (await client`SELECT id FROM pay_components WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
        const specCompId = ctx.payComponentIds["SPECIAL"] || basicCompId;
        await client`
          INSERT INTO full_final_lines (id, tenant_id, full_final_settlement_id, pay_component_id, attributes)
          VALUES 
            (${uuid()}, ${tenantId}, ${fnfId}, ${basicCompId}, ${JSON.stringify({ description: "Salary arrears (15 days Dec 2025)", amount_minor: 1600000, line_type: "payable" })}::jsonb),
            (${uuid()}, ${tenantId}, ${fnfId}, ${specCompId}, ${JSON.stringify({ description: "Gratuity & Earned Leave Encashment", amount_minor: 3200000, line_type: "payable" })}::jsonb)
        `;
      }
    }

    if (!(await hasData(client, "exit_interviews"))) {
      await client`
        INSERT INTO exit_interviews (id, tenant_id, offboarding_case_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${offbCaseId}, ${JSON.stringify({ conducted_on: "2025-12-12", reason_for_leaving: "Relocation to hometown", experience_rating: 4, eligible_for_rehire: true })}::jsonb)
      `;
    }

    if (!(await hasData(client, "alumni_records"))) {
      await client`
        INSERT INTO alumni_records (id, tenant_id, employee_id, offboarding_case_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${pastEmpId}, ${offbCaseId}, ${JSON.stringify({ exit_date: "2025-12-15", personal_email: "harish.personal@example.test", consent_to_contact: true })}::jsonb)
      `;
    }
  } else {
    console.log("  [CHECK] offboarding_cases already has data. Skipping.");
  }

  // 5. Contractor Organizations, Contracts, Invoices, Lines, Workers & Statutory Evidence
  let contractorId = "";
  if (await hasData(client, "contractor_organizations")) {
    const rows = await client`SELECT id FROM contractor_organizations WHERE tenant_id = ${tenantId} LIMIT 1`;
    contractorId = rows[0]?.id;
  }
  if (!contractorId) {
    contractorId = uuid();
    await client`
      INSERT INTO contractor_organizations (id, tenant_id, attributes)
      VALUES (${contractorId}, ${tenantId}, ${JSON.stringify({ code: "SHREE-FAB", name: "Shree Powerloom Mechanical Services", pan: "AAACS9988G", contact_person: "Kailash Sharma", contact_phone: "+91-98200-55443" })}::jsonb)
    `;
  }

  let contractId = "";
  if (await hasData(client, "contractor_contracts")) {
    const rows = await client`SELECT id FROM contractor_contracts WHERE tenant_id = ${tenantId} LIMIT 1`;
    contractId = rows[0]?.id;
  }
  if (!contractId) {
    contractId = uuid();
    await client`
      INSERT INTO contractor_contracts (id, tenant_id, contractor_organization_id, legal_entity_id, attributes)
      VALUES (${contractId}, ${tenantId}, ${contractorId}, ${legalEntityId}, ${JSON.stringify({ contract_number: "AMC-LOOM-2024-26", title: "Comprehensive Loom Maintenance Annual Contract", start_date: "2024-04-01", end_date: "2026-03-31", billing_frequency: "monthly", rate_monthly_minor: 12000000 })}::jsonb)
    `;
  }

  if (!(await hasData(client, "contractor_invoices"))) {
    for (const [invNum, period, date] of [["INV-2025-08", "2025-08", "2025-09-02"], ["INV-2026-07", "2026-07", "2026-08-05"]] as Array<[string, string, string]>) {
      const invId = uuid();
      await client`
        INSERT INTO contractor_invoices (id, tenant_id, contractor_contract_id, attributes)
        VALUES (${invId}, ${tenantId}, ${contractId}, ${JSON.stringify({ invoice_number: invNum, period, gross_amount_minor: 12000000, tds_deducted_minor: 240000, net_paid_minor: 11760000, status: "paid", paid_on: date })}::jsonb)
      `;

      if (!(await hasData(client, "contractor_invoice_lines"))) {
        await client`
          INSERT INTO contractor_invoice_lines (id, tenant_id, contractor_invoice_id, attributes)
          VALUES (${uuid()}, ${tenantId}, ${invId}, ${JSON.stringify({ service_description: "Loom preventive maintenance and oil filter changes", units: 1, amount_minor: 12000000 })}::jsonb)
        `;
      }
    }
  }

  if (!(await hasData(client, "contract_worker_assignments"))) {
    const contractWorkerPersonId = uuid();
    await client`INSERT INTO people (id, tenant_id) VALUES (${contractWorkerPersonId}, ${tenantId})`;
    await client`
      INSERT INTO contract_worker_assignments (id, tenant_id, contractor_contract_id, person_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${contractId}, ${contractWorkerPersonId}, ${JSON.stringify({ worker_name: "Santosh Yadav", trade: "Loom Fitter", gate_badge_number: "BADGE-CW-042", verified: true })}::jsonb)
    `;
  }

  if (!(await hasData(client, "contractor_statutory_evidence"))) {
    const rulePackId = ctx.statutoryRulePackId || (await client`SELECT id FROM statutory_rule_packs LIMIT 1`)[0]?.id;
    if (rulePackId) {
      await client`
        INSERT INTO contractor_statutory_evidence (id, tenant_id, contractor_organization_id, statutory_rule_pack_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${contractorId}, ${rulePackId}, ${JSON.stringify({ document_type: "PF_CHALLAN", period: "2025-08", ecr_challan_id: "MH/12345/CW/2025", verification_status: "verified" })}::jsonb)
      `;
    }
  }

  console.log("✓ Domain 08 seeded successfully.");
}
