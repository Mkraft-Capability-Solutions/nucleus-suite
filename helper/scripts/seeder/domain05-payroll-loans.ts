import { SeedContext, uuid, hasData } from "./types";

export async function seedDomain05(ctx: SeedContext) {
  const { client, tenantId, legalEntityId } = ctx;
  console.log("--> Seeding Domain 05: Payroll, Loans, Statutory Compliance & Banking...");

  // 1. Statutory Rule Packs & Rule Pack Versions (Global)
  let rulePackId = "";
  if (await hasData(client, "statutory_rule_packs", false)) {
    console.log("  [CHECK] statutory_rule_packs has data. Fetching existing ID.");
    const rows = await client`SELECT id FROM statutory_rule_packs LIMIT 1`;
    rulePackId = rows[0]?.id;
  } else {
    console.log("  [SEED] statutory_rule_packs is empty. Inserting record.");
    rulePackId = uuid();
    await client`
      INSERT INTO statutory_rule_packs (id, country_id, attributes)
      VALUES (${rulePackId}, ${ctx.countryId}, ${JSON.stringify({ code: "IN-STAT-2024", name: "India Central Labour & Tax Code", applicable_from: "2024-04-01" })}::jsonb)
    `;
  }
  ctx.statutoryRulePackId = rulePackId;

  let ruleVerId = "";
  if (await hasData(client, "rule_pack_versions", false)) {
    console.log("  [CHECK] rule_pack_versions has data. Fetching existing ID.");
    const rows = await client`SELECT id FROM rule_pack_versions LIMIT 1`;
    ruleVerId = rows[0]?.id;
  } else {
    console.log("  [SEED] rule_pack_versions is empty. Inserting record.");
    ruleVerId = uuid();
    await client`
      INSERT INTO rule_pack_versions (id, statutory_rule_pack_id, attributes)
      VALUES (${ruleVerId}, ${rulePackId}, ${JSON.stringify({ version_tag: "v2024.1", pf_rate: 0.12, esi_rate: 0.0075, max_bonus_rate: 0.20 })}::jsonb)
    `;
  }
  ctx.rulePackVersionId = ruleVerId;

  if (!(await hasData(client, "rule_pack_assignments"))) {
    console.log("  [SEED] rule_pack_assignments is empty. Inserting assignment.");
    await client`
      INSERT INTO rule_pack_assignments (id, tenant_id, legal_entity_id, rule_pack_version_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${legalEntityId}, ${ruleVerId}, ${JSON.stringify({ effective_from: "2024-04-01" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK] rule_pack_assignments already has data. Skipping.");
  }

  // Statutory Registrations (PF, ESI)
  if (!(await hasData(client, "statutory_registrations"))) {
    console.log("  [SEED] statutory_registrations is empty. Inserting registrations.");
    await client`
      INSERT INTO statutory_registrations (id, tenant_id, legal_entity_id, statutory_rule_pack_id, attributes)
      VALUES 
        (${uuid()}, ${tenantId}, ${legalEntityId}, ${rulePackId}, ${JSON.stringify({ code: "EPFO", registration_number: "MH/BAN/0012345/000", registered_on: "2024-04-01" })}::jsonb),
        (${uuid()}, ${tenantId}, ${legalEntityId}, ${rulePackId}, ${JSON.stringify({ code: "ESIC", registration_number: "31000123450000101", registered_on: "2024-04-01" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK] statutory_registrations already has data. Skipping.");
  }

  // Statutory Forms (PF Form 5, ESI Monthly, 24Q)
  let formPfId = "";
  let formEsiId = "";
  if (await hasData(client, "statutory_forms", false)) {
    console.log("  [CHECK] statutory_forms has data. Fetching existing form IDs.");
    const rows = await client`SELECT id FROM statutory_forms LIMIT 2`;
    formPfId = rows[0]?.id;
    formEsiId = rows[1]?.id || rows[0]?.id;
  } else {
    console.log("  [SEED] statutory_forms is empty. Inserting forms.");
    formPfId = uuid();
    formEsiId = uuid();
    await client`
      INSERT INTO statutory_forms (id, jurisdiction_id, statutory_rule_pack_id, attributes)
      VALUES 
        (${formPfId}, ${ctx.jurisdictionId}, ${rulePackId}, ${JSON.stringify({ form_code: "ECR-PF", name: "Electronic Challan cum Return (PF)" })}::jsonb),
        (${formEsiId}, ${ctx.jurisdictionId}, ${rulePackId}, ${JSON.stringify({ form_code: "ESI-MONTHLY", name: "Monthly ESI Return" })}::jsonb)
    `;
  }

  // Statutory Returns across 2024, 2025, 2026
  if (!(await hasData(client, "statutory_returns"))) {
    console.log("  [SEED] statutory_returns is empty. Inserting returns and lines.");
    for (const [period, retDate, status] of [["2024-11", "2024-12-15", "filed"], ["2025-06", "2025-07-15", "filed"], ["2026-08", "2026-09-15", "prepared"]] as Array<[string, string, string]>) {
      const retId = uuid();
      await client`
        INSERT INTO statutory_returns (id, tenant_id, legal_entity_id, statutory_form_id, attributes)
        VALUES (${retId}, ${tenantId}, ${legalEntityId}, ${formPfId}, ${JSON.stringify({ period, filed_on: retDate, challan_ack_number: `ACK-${period}-8877`, status })}::jsonb)
      `;
      if (!(await hasData(client, "statutory_return_lines"))) {
        await client`
          INSERT INTO statutory_return_lines (id, tenant_id, statutory_return_id, attributes)
          VALUES (${uuid()}, ${tenantId}, ${retId}, ${JSON.stringify({ headcount: ctx.roster.length, gross_wages_minor: 120000000, epf_wages_minor: 95000000, total_contribution_minor: 22800000 })}::jsonb)
        `;
      }
    }
  } else {
    console.log("  [CHECK] statutory_returns already has data. Skipping.");
  }

  // 2. Pay Groups & Salary Structures
  let payGroupId = "";
  if (await hasData(client, "pay_groups")) {
    console.log("  [CHECK] pay_groups has data. Fetching existing ID.");
    const rows = await client`SELECT id FROM pay_groups WHERE tenant_id = ${tenantId} LIMIT 1`;
    payGroupId = rows[0]?.id;
  } else {
    console.log("  [SEED] pay_groups is empty. Inserting standard pay group.");
    payGroupId = uuid();
    await client`
      INSERT INTO pay_groups (id, tenant_id, legal_entity_id, attributes)
      VALUES (${payGroupId}, ${tenantId}, ${legalEntityId}, ${JSON.stringify({ code: "PG-IN-MONTHLY", name: "India Monthly Standard Payroll", pay_frequency: "monthly", currency: "INR" })}::jsonb)
    `;
  }
  ctx.payGroupId = payGroupId;

  let structId = "";
  if (await hasData(client, "salary_structures")) {
    console.log("  [CHECK] salary_structures has data. Fetching existing ID.");
    const rows = await client`SELECT id FROM salary_structures WHERE tenant_id = ${tenantId} LIMIT 1`;
    structId = rows[0]?.id;
  } else {
    console.log("  [SEED] salary_structures is empty. Inserting salary structure.");
    structId = uuid();
    await client`
      INSERT INTO salary_structures (id, tenant_id, pay_group_id, attributes)
      VALUES (${structId}, ${tenantId}, ${payGroupId}, ${JSON.stringify({ code: "SAL-IND-2024", name: "Standard Manufacturing Salary Structure", effective_from: "2024-04-01" })}::jsonb)
    `;
  }
  ctx.salaryStructureId = structId;

  // Pay Components
  if (await hasData(client, "pay_components")) {
    console.log("  [CHECK] pay_components has data. Fetching existing components.");
    const rows = await client`SELECT id, attributes->>'code' as code FROM pay_components WHERE tenant_id = ${tenantId}`;
    for (const r of rows as Array<{ id: string; code: string | null }>) {
      if (r.code) ctx.payComponentIds[r.code] = r.id;
    }
  } else {
    console.log("  [SEED] pay_components is empty. Inserting components.");
    const components = [
      { code: "BASIC", name: "Basic Salary", type: "earning", taxable: true },
      { code: "HRA", name: "House Rent Allowance", type: "earning", taxable: true },
      { code: "CONV", name: "Conveyance Allowance", type: "earning", taxable: false },
      { code: "SPECIAL", name: "Special Allowance", type: "earning", taxable: true },
      { code: "PF_EE", name: "Provident Fund (Employee)", type: "deduction", taxable: false },
      { code: "ESI_EE", name: "ESIC (Employee)", type: "deduction", taxable: false },
      { code: "PT", name: "Professional Tax", type: "deduction", taxable: false },
      { code: "TDS", name: "Income Tax (TDS)", type: "deduction", taxable: false }
    ];
    for (const c of components) {
      const id = uuid();
      await client`
        INSERT INTO pay_components (id, tenant_id, attributes)
        VALUES (${id}, ${tenantId}, ${JSON.stringify({ code: c.code, name: c.name, type: c.type, is_taxable: c.taxable })}::jsonb)
      `;
      ctx.payComponentIds[c.code] = id;
    }
  }

  // Salary Structure Components
  if (!(await hasData(client, "salary_structure_components"))) {
    console.log("  [SEED] salary_structure_components is empty. Inserting mappings.");
    for (const [code, compId] of Object.entries(ctx.payComponentIds)) {
      await client`
        INSERT INTO salary_structure_components (id, tenant_id, salary_structure_id, pay_component_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${structId}, ${compId}, ${JSON.stringify({ formula: code === "BASIC" ? "0.50 * CTC" : code === "HRA" ? "0.20 * CTC" : "fixed" })}::jsonb)
      `;
    }
  } else {
    console.log("  [CHECK] salary_structure_components already has data. Skipping.");
  }

  // 3. Employee Salary Assignments, Bank Accounts & Tax Profiles
  const salaryAssignmentIds: Record<string, string> = {};
  if (!(await hasData(client, "employee_salary_assignments"))) {
    console.log("  [SEED] employee_salary_assignments is empty. Inserting assignments.");
    for (const emp of ctx.roster) {
      const assignId = uuid();
      await client`
        INSERT INTO employee_salary_assignments (id, tenant_id, employee_id, pay_group_id, salary_structure_id, attributes)
        VALUES (${assignId}, ${tenantId}, ${emp.employeeId}, ${payGroupId}, ${structId}, ${JSON.stringify({ ctc_annual_minor: emp.salaryMinor * 12, effective_from: emp.joiningDate, active: true })}::jsonb)
      `;
      salaryAssignmentIds[emp.code] = assignId;
    }
  } else {
    console.log("  [CHECK] employee_salary_assignments already has data. Fetching IDs.");
    const rows = await client`SELECT id, employee_id FROM employee_salary_assignments WHERE tenant_id = ${tenantId}`;
    for (const r of rows as Array<{ id: string; employee_id: string }>) {
      for (const emp of ctx.roster) {
        if (emp.employeeId === r.employee_id) salaryAssignmentIds[emp.code] = r.id;
      }
    }
  }

  if (!(await hasData(client, "bank_accounts"))) {
    console.log("  [SEED] bank_accounts is empty. Inserting accounts.");
    for (const emp of ctx.roster) {
      await client`
        INSERT INTO bank_accounts (id, tenant_id, employee_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${emp.employeeId}, ${JSON.stringify({ bank_name: "HDFC Bank Ltd", account_number: `50100234567${emp.code.slice(-3)}`, ifsc_code: "HDFC0000123", is_primary: true })}::jsonb)
      `;
    }
  } else {
    console.log("  [CHECK] bank_accounts already has data. Skipping.");
  }

  if (!(await hasData(client, "tax_profiles"))) {
    console.log("  [SEED] tax_profiles is empty. Inserting tax profiles.");
    for (const emp of ctx.roster) {
      await client`
        INSERT INTO tax_profiles (id, tenant_id, employee_id, jurisdiction_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${emp.employeeId}, ${ctx.jurisdictionId}, ${JSON.stringify({ regime: "new_regime", pan: `ABCDE${emp.code.slice(-3)}1F`, declared_deductions_minor: 15000000 })}::jsonb)
      `;
    }
  } else {
    console.log("  [CHECK] tax_profiles already has data. Skipping.");
  }

  // 4. GL Accounts & GL Mappings
  let glSalaryId = "";
  let glBankId = "";
  if (await hasData(client, "gl_accounts")) {
    console.log("  [CHECK] gl_accounts has data. Fetching existing IDs.");
    const rows = await client`SELECT id FROM gl_accounts WHERE tenant_id = ${tenantId} LIMIT 2`;
    glSalaryId = rows[0]?.id;
    glBankId = rows[1]?.id || rows[0]?.id;
  } else {
    console.log("  [SEED] gl_accounts is empty. Inserting GL accounts.");
    glSalaryId = uuid();
    glBankId = uuid();
    await client`
      INSERT INTO gl_accounts (id, tenant_id, legal_entity_id, attributes)
      VALUES 
        (${glSalaryId}, ${tenantId}, ${legalEntityId}, ${JSON.stringify({ account_code: "5100-SALARY", account_name: "Wages & Salaries Expense", account_type: "expense" })}::jsonb),
        (${glBankId}, ${tenantId}, ${legalEntityId}, ${JSON.stringify({ account_code: "1100-BANK", account_name: "HDFC Operating Bank Account", account_type: "asset" })}::jsonb)
    `;
  }

  if (!(await hasData(client, "gl_mappings"))) {
    console.log("  [SEED] gl_mappings is empty. Inserting mapping.");
    const basicCompId = ctx.payComponentIds["BASIC"] || (await client`SELECT id FROM pay_components WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
    await client`
      INSERT INTO gl_mappings (id, tenant_id, legal_entity_id, pay_component_id, debit_account_id, credit_account_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${legalEntityId}, ${basicCompId}, ${glSalaryId}, ${glBankId}, ${JSON.stringify({ posting_rule: "standard_monthly" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK] gl_mappings already has data. Skipping.");
  }

  // 5. Pay Periods, Payroll Runs across 2024, 2025, 2026
  let lastRunId = "";
  if (!(await hasData(client, "pay_periods"))) {
    console.log("  [SEED] pay_periods & payroll_runs empty. Inserting multi-year records.");
    const payrollPeriods = [
      { period: "2024-10", start: "2024-10-01", end: "2024-10-31", payDate: "2024-11-01" },
      { period: "2024-11", start: "2024-11-01", end: "2024-11-30", payDate: "2024-12-01" },
      { period: "2024-12", start: "2024-12-01", end: "2024-12-31", payDate: "2025-01-01" },
      { period: "2025-03", start: "2025-03-01", end: "2025-03-31", payDate: "2025-04-01" },
      { period: "2025-06", start: "2025-06-01", end: "2025-06-30", payDate: "2025-07-01" },
      { period: "2025-09", start: "2025-09-01", end: "2025-09-30", payDate: "2025-10-01" },
      { period: "2025-12", start: "2025-12-01", end: "2025-12-31", payDate: "2026-01-01" },
      { period: "2026-06", start: "2026-06-01", end: "2026-06-30", payDate: "2026-07-01" },
      { period: "2026-07", start: "2026-07-01", end: "2026-07-31", payDate: "2026-08-01" },
      { period: "2026-08", start: "2026-08-01", end: "2026-08-31", payDate: "2026-09-01" }
    ];

    for (const pp of payrollPeriods) {
      const periodId = uuid();
      await client`
        INSERT INTO pay_periods (id, tenant_id, pay_group_id, attributes)
        VALUES (${periodId}, ${tenantId}, ${payGroupId}, ${JSON.stringify({ code: pp.period, start_date: pp.start, end_date: pp.end, pay_date: pp.payDate, status: "closed" })}::jsonb)
      `;

      const runId = uuid();
      lastRunId = runId;
      await client`
        INSERT INTO payroll_runs (
          id, tenant_id, pay_group_id, pay_period_id, rule_pack_version_id, 
          period, scope, status, currency, gross_minor, deductions_minor, net_minor, employee_count
        )
        VALUES (
          ${runId}, ${tenantId}, ${payGroupId}, ${periodId}, ${ruleVerId},
          ${pp.period}, 'all_employees', 'paid', 'INR', 120000000, 3500000, 116500000, ${ctx.roster.length}
        )
      `;

      // Payroll Approvals
      await client`
        INSERT INTO payroll_approvals (id, tenant_id, payroll_run_id, membership_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${runId}, ${ctx.membershipByCode["MK-103"] || (await client`SELECT id FROM memberships WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id}, ${JSON.stringify({ role: "finance_controller", approved_at: `${pp.payDate}T09:30:00Z` })}::jsonb)
      `;

      // Payroll Exports & Lines
      const exportId = uuid();
      await client`
        INSERT INTO payroll_exports (id, tenant_id, payroll_run_id, attributes)
        VALUES (${exportId}, ${tenantId}, ${runId}, ${JSON.stringify({ export_format: "NEFT_BANK_FORMAT", record_count: ctx.roster.length })}::jsonb)
      `;
      await client`
        INSERT INTO payroll_export_lines (id, tenant_id, payroll_export_id, gl_account_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${exportId}, ${glSalaryId}, ${JSON.stringify({ line_amount_minor: 120000000, description: `Net salary payout for ${pp.period}` })}::jsonb)
      `;

      // Disbursement Batches & Items
      const batchId = uuid();
      await client`
        INSERT INTO disbursement_batches (id, tenant_id, attributes)
        VALUES (${batchId}, ${tenantId}, ${JSON.stringify({ batch_reference: `DISB-${pp.period}`, status: "completed", processed_at: pp.payDate })}::jsonb)
      `;

      const basicId = ctx.payComponentIds["BASIC"] || (await client`SELECT id FROM pay_components WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
      const pfId = ctx.payComponentIds["PF_EE"] || basicId;

      for (const emp of ctx.roster.slice(0, 6)) {
        if (emp.joiningDate > pp.end) continue;

        await client`
          INSERT INTO payroll_inputs (id, tenant_id, employee_id, pay_component_id, pay_period_id, attributes)
          VALUES (${uuid()}, ${tenantId}, ${emp.employeeId}, ${basicId}, ${periodId}, ${JSON.stringify({ input_type: "base", units: 30, amount_minor: emp.salaryMinor })}::jsonb)
        `;

        const runEmpId = uuid();
        const assignId = salaryAssignmentIds[emp.code] || (await client`SELECT id FROM employee_salary_assignments WHERE tenant_id = ${tenantId} AND employee_id = ${emp.employeeId} LIMIT 1`)[0]?.id;
        if (assignId) {
          await client`
            INSERT INTO payroll_run_employees (id, tenant_id, payroll_run_id, employee_id, salary_assignment_id, attributes)
            VALUES (${runEmpId}, ${tenantId}, ${runId}, ${emp.employeeId}, ${assignId}, ${JSON.stringify({ net_minor: emp.salaryMinor - 350000, status: "paid" })}::jsonb)
          `;

          await client`
            INSERT INTO payroll_calculations (id, tenant_id, payroll_run_employee_id, attributes)
            VALUES (${uuid()}, ${tenantId}, ${runEmpId}, ${JSON.stringify({ gross_minor: emp.salaryMinor, deductions_minor: 350000, net_minor: emp.salaryMinor - 350000 })}::jsonb)
          `;

          await client`
            INSERT INTO payroll_lines (id, tenant_id, payroll_run_employee_id, pay_component_id, attributes)
            VALUES 
              (${uuid()}, ${tenantId}, ${runEmpId}, ${basicId}, ${JSON.stringify({ amount_minor: Math.round(emp.salaryMinor * 0.5), line_type: "earning" })}::jsonb),
              (${uuid()}, ${tenantId}, ${runEmpId}, ${pfId}, ${JSON.stringify({ amount_minor: 250000, line_type: "deduction" })}::jsonb)
          `;

          const docId = ctx.documentIds["DOC-HANDBOOK-24"] || (await client`SELECT id FROM documents WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
          if (docId) {
            await client`
              INSERT INTO payslips (id, tenant_id, payroll_run_employee_id, document_id, attributes)
              VALUES (${uuid()}, ${tenantId}, ${runEmpId}, ${docId}, ${JSON.stringify({ slip_number: `SLIP-${pp.period}-${emp.code}`, generated_on: pp.payDate })}::jsonb)
            `;
          }

          const [bankRow] = await client`SELECT id FROM bank_accounts WHERE employee_id = ${emp.employeeId} LIMIT 1`;
          if (bankRow) {
            await client`
              INSERT INTO disbursement_items (id, tenant_id, disbursement_batch_id, employee_id, bank_account_id, attributes)
              VALUES (${uuid()}, ${tenantId}, ${batchId}, ${emp.employeeId}, ${bankRow.id}, ${JSON.stringify({ amount_minor: emp.salaryMinor - 350000, status: "success", utr_reference: `UTR${pp.period.replace("-", "")}991827` })}::jsonb)
            `;
          }
        }
      }
    }
  } else {
    console.log("  [CHECK] pay_periods already has data. Skipping payroll runs generation.");
    lastRunId = (await client`SELECT id FROM payroll_runs WHERE tenant_id = ${tenantId} ORDER BY created_at DESC LIMIT 1`)[0]?.id;
  }

  // Payroll Anomalies
  if (!(await hasData(client, "payroll_anomalies")) && lastRunId) {
    console.log("  [SEED] payroll_anomalies is empty. Inserting anomaly.");
    await client`
      INSERT INTO payroll_anomalies (id, tenant_id, payroll_run_id, employee_id, rule_code, severity, facts, status)
      VALUES (
        ${uuid()}, ${tenantId}, ${lastRunId},
        ${ctx.employeeByCode["MK-107"].employeeId}, 'OVERTIME_SPIKE_CHECK', 'warning',
        ${JSON.stringify({ message: "Overtime exceeds 20% of standard basic monthly hours" })}::jsonb,
        'resolved'
      )
    `;
  } else {
    console.log("  [CHECK] payroll_anomalies already has data. Skipping.");
  }

  // 6. Loan Products, Employee Loans, Schedules, Guarantors, Transactions & Exceptions
  let loanProdId = "";
  if (await hasData(client, "loan_products")) {
    console.log("  [CHECK] loan_products has data. Fetching existing ID.");
    const rows = await client`SELECT id FROM loan_products WHERE tenant_id = ${tenantId} LIMIT 1`;
    loanProdId = rows[0]?.id;
  } else {
    console.log("  [SEED] loan_products is empty. Inserting loan product.");
    loanProdId = uuid();
    await client`
      INSERT INTO loan_products (id, tenant_id, attributes)
      VALUES (${loanProdId}, ${tenantId}, ${JSON.stringify({ code: "PERSONAL-01", name: "Staff Welfare Loan", max_amount_minor: 50000000, interest_rate_annual: 0.06, max_tenure_months: 24 })}::jsonb)
    `;
  }
  ctx.loanProductId = loanProdId;

  let empLoanId = "";
  const loanEmp = ctx.employeeByCode["MK-107"];
  if (!(await hasData(client, "employee_loans"))) {
    console.log("  [SEED] employee_loans is empty. Inserting loan for MK-107.");
    empLoanId = uuid();
    await client`
      INSERT INTO employee_loans (id, tenant_id, employee_id, loan_product_id, attributes)
      VALUES (${empLoanId}, ${tenantId}, ${loanEmp.employeeId}, ${loanProdId}, ${JSON.stringify({ principal_minor: 6000000, outstanding_minor: 2500000, interest_rate: 0.06, tenure_months: 12, status: "active", disbursed_on: "2025-06-15" })}::jsonb)
    `;

    // Legacy loans table row
    const legacyLoanId = uuid();
    if (!(await hasData(client, "loans"))) {
      await client`
        INSERT INTO loans (id, tenant_id, employee_id, principal_minor, outstanding_minor, currency, status)
        VALUES (${legacyLoanId}, ${tenantId}, ${loanEmp.employeeId}, 6000000, 2500000, 'INR', 'disbursed')
      `;
    }

    // Loan schedules & transactions (2025 and 2026)
    if (!(await hasData(client, "loan_schedules"))) {
      for (let m = 7; m <= 12; m++) {
        await client`
          INSERT INTO loan_schedules (id, tenant_id, employee_loan_id, attributes)
          VALUES (${uuid()}, ${tenantId}, ${empLoanId}, ${JSON.stringify({ installment_number: m - 6, due_date: `2025-${String(m).padStart(2, "0")}-30`, emi_minor: 550000, status: "paid" })}::jsonb)
        `;
        if (!(await hasData(client, "loan_transactions"))) {
          await client`
            INSERT INTO loan_transactions (id, tenant_id, employee_loan_id, attributes)
            VALUES (${uuid()}, ${tenantId}, ${empLoanId}, ${JSON.stringify({ payment_date: `2025-${String(m).padStart(2, "0")}-30`, amount_minor: 550000, transaction_type: "payroll_deduction" })}::jsonb)
          `;
        }
      }
      for (let m = 1; m <= 6; m++) {
        await client`
          INSERT INTO loan_schedules (id, tenant_id, employee_loan_id, attributes)
          VALUES (${uuid()}, ${tenantId}, ${empLoanId}, ${JSON.stringify({ installment_number: m + 6, due_date: `2026-${String(m).padStart(2, "0")}-30`, emi_minor: 550000, status: m <= 3 ? "paid" : "pending" })}::jsonb)
        `;
      }
    }

    if (!(await hasData(client, "loan_guarantors"))) {
      await client`
        INSERT INTO loan_guarantors (id, tenant_id, loan_id, employee_loan_id, guarantor_employee_id, sequence, status)
        VALUES (${uuid()}, ${tenantId}, ${legacyLoanId}, ${empLoanId}, ${ctx.employeeByCode["MK-104"].employeeId}, 1, 'active')
      `;
    }

    if (!(await hasData(client, "loan_exceptions"))) {
      const wfInst = (await client`SELECT id FROM workflow_instances WHERE tenant_id = ${tenantId} LIMIT 1`)[0];
      if (wfInst) {
        await client`
          INSERT INTO loan_exceptions (id, tenant_id, employee_id, approved_by_membership_id, workflow_instance_id, attributes)
          VALUES (${uuid()}, ${tenantId}, ${loanEmp.employeeId}, ${ctx.membershipByCode["MK-101"]}, ${wfInst.id}, ${JSON.stringify({ exception_type: "tenure_extension", reason: "Family medical hardship", approved_at: "2025-06-12" })}::jsonb)
        `;
      }
    }
  } else {
    console.log("  [CHECK] employee_loans already has data. Skipping.");
  }

  // Salary Advances (2025 and 2026)
  if (!(await hasData(client, "salary_advances"))) {
    console.log("  [SEED] salary_advances is empty. Inserting advances.");
    await client`
      INSERT INTO salary_advances (id, tenant_id, employee_id, attributes)
      VALUES 
        (${uuid()}, ${tenantId}, ${ctx.employeeByCode["MK-111"].employeeId}, ${JSON.stringify({ amount_minor: 1500000, advance_date: "2025-10-15", reason: "Diwali festival advance", status: "recovered" })}::jsonb),
        (${uuid()}, ${tenantId}, ${ctx.employeeByCode["MK-112"].employeeId}, ${JSON.stringify({ amount_minor: 2000000, advance_date: "2026-08-10", reason: "School fees payment", status: "disbursed" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK] salary_advances already has data. Skipping.");
  }

  // Wage Base Simulations & Reconciliation Items
  if (!(await hasData(client, "wage_base_simulations"))) {
    console.log("  [SEED] wage_base_simulations is empty. Inserting simulation.");
    const simId = uuid();
    await client`
      INSERT INTO wage_base_simulations (id, tenant_id, salary_structure_id, rule_pack_version_id, requested_by_membership_id, attributes)
      VALUES (${simId}, ${tenantId}, ${structId}, ${ruleVerId}, ${ctx.membershipByCode["MK-103"] || (await client`SELECT id FROM memberships WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id}, ${JSON.stringify({ scenario_name: "FY26 Minimum Wage Impact Assessment", baseline_cost_minor: 1500000000, projected_cost_minor: 1650000000 })}::jsonb)
    `;
    if (!(await hasData(client, "wage_base_simulation_lines"))) {
      const basicId = ctx.payComponentIds["BASIC"] || (await client`SELECT id FROM pay_components WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
      await client`
        INSERT INTO wage_base_simulation_lines (id, tenant_id, wage_base_simulation_id, pay_component_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${simId}, ${basicId}, ${JSON.stringify({ old_rate_minor: 1500000, simulated_rate_minor: 1750000, delta_minor: 250000 })}::jsonb)
      `;
    }
  } else {
    console.log("  [CHECK] wage_base_simulations already has data. Skipping.");
  }

  if (!(await hasData(client, "reconciliation_items"))) {
    console.log("  [SEED] reconciliation_items is empty. Inserting items.");
    await client`
      INSERT INTO reconciliation_items (id, tenant_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${JSON.stringify({ run_period: "2026-08", bank_total_minor: 120000000, ledger_total_minor: 120000000, variance_minor: 0, status: "reconciled" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK] reconciliation_items already has data. Skipping.");
  }

  console.log("✓ Domain 05 seeded successfully.");
}
