import { SeedContext, uuid, hasData } from "./types";

export async function fillRemaining51(ctx: SeedContext) {
  const { client, tenantId } = ctx;
  console.log("\n========================================================");
  console.log("== FILLING REMAINING 51 CANONICAL & COMPATIBILITY TABLES ==");
  console.log("========================================================");

  // 1. Fetch valid operational employees & memberships (strictly NOT demo/admin)
  const validEmps = await client`
    SELECT e.id as employee_id, e.employee_code, e.person_id 
    FROM employees e 
    JOIN memberships m ON m.employee_id = e.id AND m.tenant_id = ${tenantId}
    JOIN "user" u ON u.id = m.user_id
    WHERE e.tenant_id = ${tenantId} 
    AND u.email NOT IN ('demo@mkraft.local', 'admin@mkraft.local', 'admin@brigtenz.tech', 'superadmin@brigtenz.tech')
    AND e.employee_code NOT IN ('demo', 'admin', 'superadmin')
    LIMIT 20
  `;
  if (validEmps.length === 0) {
    throw new Error("No valid operational employees found for tenant!");
  }
  const emp1 = (validEmps as any[])[0];
  const emp2 = (validEmps as any[])[1] || emp1;
  const emp3 = (validEmps as any[])[2] || emp1;

  const validMems = await client`
    SELECT m.id as membership_id, m.user_id 
    FROM memberships m
    JOIN "user" u ON u.id = m.user_id
    WHERE m.tenant_id = ${tenantId}
    AND u.email NOT IN ('demo@mkraft.local', 'admin@mkraft.local', 'admin@brigtenz.tech', 'superadmin@brigtenz.tech')
    LIMIT 5
  `;
  const mem1 = (validMems as any[])[0]?.membership_id;
  const user1 = (validMems as any[])[0]?.user_id;

  // =========================================================================
  // GROUP 1: ATTENDANCE & LEAVE COMPATIBILITY
  // =========================================================================

  // 1. attendance_sessions
  if (!(await hasData(client, "attendance_sessions"))) {
    console.log("  [SEED 1/51] attendance_sessions is empty. Inserting sessions.");
    const events = await client`
      SELECT id, employee_id FROM attendance_events 
      WHERE tenant_id = ${tenantId} AND employee_id IS NOT NULL 
      LIMIT 5
    `;
    const shiftRow = (await client`SELECT id FROM shifts WHERE tenant_id = ${tenantId} LIMIT 1`)[0];
    for (const ev of events as any[]) {
      await client`
        INSERT INTO attendance_sessions (id, tenant_id, employee_id, in_event_id, shift_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${ev.employee_id}, ${ev.id}, ${shiftRow?.id || null}, ${JSON.stringify({ status: "completed", work_duration_minutes: 480, terminal_id: "ZK-PORTAL-01" })}::jsonb)
      `;
    }
  } else {
    console.log("  [CHECK 1/51] attendance_sessions already has data. Skipping.");
  }

  // 2. attendance_breaks
  if (!(await hasData(client, "attendance_breaks"))) {
    console.log("  [SEED 2/51] attendance_breaks is empty. Inserting breaks.");
    const sessRows = await client`SELECT id FROM attendance_sessions WHERE tenant_id = ${tenantId} LIMIT 3`;
    for (const s of sessRows as any[]) {
      await client`
        INSERT INTO attendance_breaks (id, tenant_id, attendance_session_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${s.id}, ${JSON.stringify({ break_type: "meal_break", duration_minutes: 45, start_time: "13:00", end_time: "13:45" })}::jsonb)
      `;
    }
  } else {
    console.log("  [CHECK 2/51] attendance_breaks already has data. Skipping.");
  }

  // 3. attendance_regularizations
  if (!(await hasData(client, "attendance_regularizations"))) {
    console.log("  [SEED 3/51] attendance_regularizations is empty. Inserting regularizations.");
    const entryRows = await client`SELECT id FROM attendance_entries WHERE tenant_id = ${tenantId} LIMIT 3`;
    const wfRow = (await client`SELECT id FROM workflow_instances WHERE tenant_id = ${tenantId} LIMIT 1`)[0];
    for (const en of entryRows as any[]) {
      await client`
        INSERT INTO attendance_regularizations (id, tenant_id, attendance_entry_id, workflow_instance_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${en.id}, ${wfRow?.id || null}, ${JSON.stringify({ reason: "Biometric reader sync delay at Plant Gate 1", requested_punch_in: "08:30:00", status: "approved" })}::jsonb)
      `;
    }
  } else {
    console.log("  [CHECK 3/51] attendance_regularizations already has data. Skipping.");
  }

  // 4. leave_approvals (legacy compatibility table)
  if (!(await hasData(client, "leave_approvals"))) {
    console.log("  [SEED 4/51] leave_approvals is empty. Inserting approvals.");
    const leaveReqs = await client`SELECT id FROM leave_requests WHERE tenant_id = ${tenantId} LIMIT 5`;
    for (const lr of leaveReqs as any[]) {
      await client`
        INSERT INTO leave_approvals (id, tenant_id, leave_request_id, level, approver_user_id, status, comment)
        VALUES (${uuid()}, ${tenantId}, ${lr.id}, 'L1', ${user1 || null}, 'approved', 'Approved in accordance with shift production schedule')
      `;
    }
  } else {
    console.log("  [CHECK 4/51] leave_approvals already has data. Skipping.");
  }

  // =========================================================================
  // GROUP 2: RECRUITMENT & TALENT ACQUISITION
  // =========================================================================

  // 5. applications
  let candidateRow = (await client`SELECT id FROM candidates WHERE tenant_id = ${tenantId} LIMIT 1`)[0];
  if (!candidateRow) {
    const candId = uuid();
    await client`
      INSERT INTO candidates (id, tenant_id, attributes)
      VALUES (${candId}, ${tenantId}, ${JSON.stringify({ full_name: "Gaurav Bhattacharya", email: "gaurav.b@example.test", phone: "+91-98200-55441" })}::jsonb)
    `;
    candidateRow = { id: candId };
  }

  const reqRow = (await client`SELECT id FROM requisitions WHERE tenant_id = ${tenantId} LIMIT 1`)[0];

  if (!(await hasData(client, "applications"))) {
    console.log("  [SEED 5/51] applications is empty. Inserting applications.");
    await client`
      INSERT INTO applications (id, tenant_id, candidate_id, requisition_id, attributes)
      VALUES 
        (${uuid()}, ${tenantId}, ${candidateRow.id}, ${reqRow.id}, ${JSON.stringify({ applied_on: "2025-05-15", stage: "interview", rating: 4.6 })}::jsonb),
        (${uuid()}, ${tenantId}, ${candidateRow.id}, ${reqRow.id}, ${JSON.stringify({ applied_on: "2025-06-01", stage: "offered", rating: 4.8 })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 5/51] applications already has data. Skipping.");
  }

  const appRow = (await client`SELECT id FROM applications WHERE tenant_id = ${tenantId} LIMIT 1`)[0];

  // 6. application_stage_history
  if (!(await hasData(client, "application_stage_history"))) {
    console.log("  [SEED 6/51] application_stage_history is empty. Inserting stage history.");
    await client`
      INSERT INTO application_stage_history (id, tenant_id, application_id, actor_membership_id, attributes)
      VALUES 
        (${uuid()}, ${tenantId}, ${appRow.id}, ${mem1 || null}, ${JSON.stringify({ stage: "applied", transition_date: "2025-05-15" })}::jsonb),
        (${uuid()}, ${tenantId}, ${appRow.id}, ${mem1 || null}, ${JSON.stringify({ stage: "interview_scheduled", transition_date: "2025-05-20" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 6/51] application_stage_history already has data. Skipping.");
  }

  // 7. candidate_consents
  if (!(await hasData(client, "candidate_consents"))) {
    console.log("  [SEED 7/51] candidate_consents is empty. Inserting consents.");
    await client`
      INSERT INTO candidate_consents (id, tenant_id, candidate_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${candidateRow.id}, ${JSON.stringify({ consent_type: "data_privacy_and_background_check", consented_at: "2025-05-15T09:00:00Z" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 7/51] candidate_consents already has data. Skipping.");
  }

  // 8. candidate_documents
  if (!(await hasData(client, "candidate_documents"))) {
    console.log("  [SEED 8/51] candidate_documents is empty. Inserting candidate documents.");
    const docRow = (await client`SELECT id FROM documents WHERE tenant_id = ${tenantId} LIMIT 1`)[0];
    if (docRow) {
      await client`
        INSERT INTO candidate_documents (id, tenant_id, candidate_id, document_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${candidateRow.id}, ${docRow.id}, ${JSON.stringify({ doc_type: "resume", file_name: "gaurav_bhattacharya_resume.pdf" })}::jsonb)
      `;
    }
  } else {
    console.log("  [CHECK 8/51] candidate_documents already has data. Skipping.");
  }

  // 9. candidate_skills
  if (!(await hasData(client, "candidate_skills"))) {
    console.log("  [SEED 9/51] candidate_skills is empty. Inserting candidate skills.");
    const skillRow = (await client`SELECT id FROM skills WHERE tenant_id = ${tenantId} LIMIT 1`)[0];
    const ontoVerRow = (await client`SELECT id FROM skill_ontology_versions WHERE tenant_id = ${tenantId} LIMIT 1`)[0];
    if (skillRow && ontoVerRow) {
      await client`
        INSERT INTO candidate_skills (id, tenant_id, candidate_id, skill_id, skill_ontology_version_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${candidateRow.id}, ${skillRow.id}, ${ontoVerRow.id}, ${JSON.stringify({ proficiency_rating: 4, years_experience: 5 })}::jsonb)
      `;
    }
  } else {
    console.log("  [CHECK 9/51] candidate_skills already has data. Skipping.");
  }

  // 10. background_checks
  if (!(await hasData(client, "background_checks"))) {
    console.log("  [SEED 10/51] background_checks is empty. Inserting background checks.");
    await client`
      INSERT INTO background_checks (id, tenant_id, candidate_id, application_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${candidateRow.id}, ${appRow.id}, ${JSON.stringify({ agency: "AuthBridge Verifications", status: "completed", result: "clear", verified_at: "2025-05-25" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 10/51] background_checks already has data. Skipping.");
  }

  // 11. interview_sessions
  if (!(await hasData(client, "interview_sessions"))) {
    console.log("  [SEED 11/51] interview_sessions is empty. Inserting interview sessions.");
    const planRow = (await client`SELECT id FROM interview_plans WHERE tenant_id = ${tenantId} LIMIT 1`)[0];
    await client`
      INSERT INTO interview_sessions (id, tenant_id, application_id, interview_plan_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${appRow.id}, ${planRow?.id || null}, ${JSON.stringify({ round: "Technical Loom Assessment", scheduled_at: "2025-05-22T11:00:00Z", mode: "in_person" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 11/51] interview_sessions already has data. Skipping.");
  }

  const sessRow = (await client`SELECT id FROM interview_sessions WHERE tenant_id = ${tenantId} LIMIT 1`)[0];

  // 12. interview_panel_members
  if (!(await hasData(client, "interview_panel_members"))) {
    console.log("  [SEED 12/51] interview_panel_members is empty. Inserting panel members.");
    await client`
      INSERT INTO interview_panel_members (id, tenant_id, interview_session_id, membership_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${sessRow.id}, ${mem1}, ${JSON.stringify({ role: "lead_interviewer" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 12/51] interview_panel_members already has data. Skipping.");
  }

  const panelRow = (await client`SELECT id FROM interview_panel_members WHERE tenant_id = ${tenantId} LIMIT 1`)[0];

  // 13. interview_scores
  if (!(await hasData(client, "interview_scores"))) {
    console.log("  [SEED 13/51] interview_scores is empty. Inserting scores.");
    const scRow = (await client`SELECT id FROM scorecards WHERE tenant_id = ${tenantId} LIMIT 1`)[0];
    await client`
      INSERT INTO interview_scores (id, tenant_id, interview_session_id, panel_member_id, scorecard_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${sessRow.id}, ${panelRow.id}, ${scRow?.id || null}, ${JSON.stringify({ technical_score: 92, culture_score: 88, feedback: "Demonstrated strong knowledge of Rapier and Airjet looms" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 13/51] interview_scores already has data. Skipping.");
  }

  // 14. offers
  if (!(await hasData(client, "offers"))) {
    console.log("  [SEED 14/51] offers is empty. Inserting offers.");
    const posRow = (await client`SELECT id FROM positions WHERE tenant_id = ${tenantId} LIMIT 1`)[0];
    await client`
      INSERT INTO offers (id, tenant_id, application_id, position_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${appRow.id}, ${posRow.id}, ${JSON.stringify({ ctc_offered_minor: 3800000, status: "accepted", offered_on: "2025-06-05" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 14/51] offers already has data. Skipping.");
  }

  const offerRow = (await client`SELECT id FROM offers WHERE tenant_id = ${tenantId} LIMIT 1`)[0];

  // 15. candidate_employee_links
  if (!(await hasData(client, "candidate_employee_links"))) {
    console.log("  [SEED 15/51] candidate_employee_links is empty. Linking candidate to employee.");
    await client`
      INSERT INTO candidate_employee_links (id, tenant_id, application_id, candidate_id, employee_id, offer_id, person_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${appRow.id}, ${candidateRow.id}, ${emp1.employee_id}, ${offerRow.id}, ${emp1.person_id}, ${JSON.stringify({ converted_at: "2025-06-15" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 15/51] candidate_employee_links already has data. Skipping.");
  }

  // =========================================================================
  // GROUP 3: AI MATCHING & WORKFORCE PLANNING
  // =========================================================================

  // 16. candidate_match_runs
  if (!(await hasData(client, "candidate_match_runs"))) {
    console.log("  [SEED 16/51] candidate_match_runs is empty. Inserting AI match run.");
    const rubricRow = (await client`SELECT id FROM candidate_match_rubric_versions WHERE tenant_id = ${tenantId} LIMIT 1`)[0];
    const jdRow = (await client`SELECT id FROM job_descriptions WHERE tenant_id = ${tenantId} LIMIT 1`)[0];
    const modelRow = (await client`SELECT id FROM model_configs WHERE tenant_id = ${tenantId} LIMIT 1`)[0];
    const promptRow = (await client`SELECT id FROM prompt_versions WHERE tenant_id = ${tenantId} LIMIT 1`)[0];
    const docExtRow = (await client`SELECT id FROM document_extractions WHERE tenant_id = ${tenantId} LIMIT 1`)[0];
    const ontoVerRow = (await client`SELECT id FROM skill_ontology_versions WHERE tenant_id = ${tenantId} LIMIT 1`)[0];

    await client`
      INSERT INTO candidate_match_runs (
        id, tenant_id, application_id, candidate_match_rubric_version_id,
        job_description_id, model_config_id, prompt_version_id,
        resume_document_extraction_id, skill_ontology_version_id, attributes
      )
      VALUES (
        ${uuid()}, ${tenantId}, ${appRow.id}, ${rubricRow.id},
        ${jdRow.id}, ${modelRow.id}, ${promptRow.id},
        ${docExtRow.id}, ${ontoVerRow.id},
        ${JSON.stringify({ match_score: 91.5, evaluation_status: "completed" })}::jsonb
      )
    `;
  } else {
    console.log("  [CHECK 16/51] candidate_match_runs already has data. Skipping.");
  }

  const matchRunRow = (await client`SELECT id FROM candidate_match_runs WHERE tenant_id = ${tenantId} LIMIT 1`)[0];

  // 17. candidate_match_results
  if (!(await hasData(client, "candidate_match_results"))) {
    console.log("  [SEED 17/51] candidate_match_results is empty. Inserting results.");
    await client`
      INSERT INTO candidate_match_results (id, tenant_id, candidate_match_run_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${matchRunRow.id}, ${JSON.stringify({ overall_score: 91.5, skills_score: 95.0, experience_score: 88.0, recommendation: "strong_hire" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 17/51] candidate_match_results already has data. Skipping.");
  }

  const matchResultRow = (await client`SELECT id FROM candidate_match_results WHERE tenant_id = ${tenantId} LIMIT 1`)[0];

  // 18. candidate_match_dispositions
  if (!(await hasData(client, "candidate_match_dispositions"))) {
    console.log("  [SEED 18/51] candidate_match_dispositions is empty. Inserting dispositions.");
    await client`
      INSERT INTO candidate_match_dispositions (id, tenant_id, candidate_match_result_id, reviewer_membership_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${matchResultRow.id}, ${mem1}, ${JSON.stringify({ status: "accepted", notes: "Candidate aligns with plant operational safety standards" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 18/51] candidate_match_dispositions already has data. Skipping.");
  }

  // 19. match_evidence
  if (!(await hasData(client, "match_evidence"))) {
    console.log("  [SEED 19/51] match_evidence is empty. Inserting match evidence.");
    await client`
      INSERT INTO match_evidence (id, tenant_id, candidate_match_result_id, candidate_match_run_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${matchResultRow.id}, ${matchRunRow.id}, ${JSON.stringify({ text_excerpt: "Operated 12 Sulzer rapier looms at 98% efficiency", confidence_score: 0.96 })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 19/51] match_evidence already has data. Skipping.");
  }

  // 20. workforce_scenarios
  if (!(await hasData(client, "workforce_scenarios"))) {
    console.log("  [SEED 20/51] workforce_scenarios is empty. Inserting scenarios.");
    const leRow = (await client`SELECT id FROM legal_entities WHERE tenant_id = ${tenantId} LIMIT 1`)[0];
    await client`
      INSERT INTO workforce_scenarios (id, tenant_id, legal_entity_id, owner_membership_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${leRow.id}, ${mem1}, ${JSON.stringify({ scenario_name: "FY26 Expansion - Loom Capacity Increase", projected_cost_minor: 45000000, status: "draft" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 20/51] workforce_scenarios already has data. Skipping.");
  }

  const scenarioRow = (await client`SELECT id FROM workforce_scenarios WHERE tenant_id = ${tenantId} LIMIT 1`)[0];

  // 21. workforce_scenario_lines
  if (!(await hasData(client, "workforce_scenario_lines"))) {
    console.log("  [SEED 21/51] workforce_scenario_lines is empty. Inserting scenario lines.");
    const deptRow = (await client`SELECT id FROM departments WHERE tenant_id = ${tenantId} LIMIT 1`)[0];
    const jpRow = (await client`SELECT id FROM job_profiles WHERE tenant_id = ${tenantId} LIMIT 1`)[0];
    await client`
      INSERT INTO workforce_scenario_lines (id, tenant_id, workforce_scenario_id, department_id, job_profile_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${scenarioRow.id}, ${deptRow?.id || null}, ${jpRow?.id || null}, ${JSON.stringify({ target_headcount: 12, added_budget_minor: 12000000 })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 21/51] workforce_scenario_lines already has data. Skipping.");
  }

  // =========================================================================
  // GROUP 4: PAYROLL, DISBURSEMENTS, LOANS & WAGE BASE
  // =========================================================================

  const payrollRunRow = (await client`SELECT id FROM payroll_runs WHERE tenant_id = ${tenantId} LIMIT 1`)[0];
  const salaryAssignRows = await client`
    SELECT id, employee_id FROM employee_salary_assignments 
    WHERE tenant_id = ${tenantId} 
    LIMIT 10
  `;
  const payCompRows = await client`SELECT id FROM pay_components WHERE tenant_id = ${tenantId} LIMIT 5`;
  const glAccRow = (await client`SELECT id FROM gl_accounts WHERE tenant_id = ${tenantId} LIMIT 1`)[0];
  const docRow = (await client`SELECT id FROM documents WHERE tenant_id = ${tenantId} LIMIT 1`)[0];

  // 22. payroll_run_employees
  if (!(await hasData(client, "payroll_run_employees"))) {
    console.log("  [SEED 22/51] payroll_run_employees is empty. Inserting payroll run employees.");
    for (const sa of salaryAssignRows as any[]) {
      await client`
        INSERT INTO payroll_run_employees (id, tenant_id, employee_id, payroll_run_id, salary_assignment_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${sa.employee_id}, ${payrollRunRow.id}, ${sa.id}, ${JSON.stringify({ gross_pay_minor: 4800000, net_pay_minor: 4200000, status: "calculated" })}::jsonb)
      `;
    }
  } else {
    console.log("  [CHECK 22/51] payroll_run_employees already has data. Skipping.");
  }

  const prEmpRow = (await client`SELECT id FROM payroll_run_employees WHERE tenant_id = ${tenantId} LIMIT 1`)[0];

  // 23. payroll_inputs
  if (!(await hasData(client, "payroll_inputs"))) {
    console.log("  [SEED 23/51] payroll_inputs is empty. Inserting payroll inputs.");
    const ppRow = (await client`SELECT id FROM pay_periods WHERE tenant_id = ${tenantId} LIMIT 1`)[0];
    await client`
      INSERT INTO payroll_inputs (id, tenant_id, employee_id, pay_component_id, pay_period_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${emp1.employee_id}, ${payCompRows[0].id}, ${ppRow.id}, ${JSON.stringify({ input_type: "production_bonus", amount_minor: 250000 })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 23/51] payroll_inputs already has data. Skipping.");
  }

  // 24. payroll_calculations
  if (!(await hasData(client, "payroll_calculations"))) {
    console.log("  [SEED 24/51] payroll_calculations is empty. Inserting calculations.");
    await client`
      INSERT INTO payroll_calculations (id, tenant_id, payroll_run_employee_id, pay_component_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${prEmpRow.id}, ${payCompRows[0]?.id || null}, ${JSON.stringify({ formula_name: "standard_statutory_deductions", calculated_value_minor: 4200000 })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 24/51] payroll_calculations already has data. Skipping.");
  }

  // 25. payroll_lines
  if (!(await hasData(client, "payroll_lines"))) {
    console.log("  [SEED 25/51] payroll_lines is empty. Inserting payroll lines.");
    await client`
      INSERT INTO payroll_lines (id, tenant_id, pay_component_id, payroll_run_employee_id, attributes)
      VALUES 
        (${uuid()}, ${tenantId}, ${payCompRows[0].id}, ${prEmpRow.id}, ${JSON.stringify({ line_type: "earning", amount_minor: 2800000, component_code: "BASIC" })}::jsonb),
        (${uuid()}, ${tenantId}, ${payCompRows[1]?.id || payCompRows[0].id}, ${prEmpRow.id}, ${JSON.stringify({ line_type: "earning", amount_minor: 1400000, component_code: "HRA" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 25/51] payroll_lines already has data. Skipping.");
  }

  // 26. payslips
  if (!(await hasData(client, "payslips"))) {
    console.log("  [SEED 26/51] payslips is empty. Inserting payslips.");
    await client`
      INSERT INTO payslips (id, tenant_id, document_id, payroll_run_employee_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${docRow.id}, ${prEmpRow.id}, ${JSON.stringify({ payslip_month: "2025-06", net_pay_minor: 4200000, downloaded: false })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 26/51] payslips already has data. Skipping.");
  }

  // 27. payroll_approvals
  if (!(await hasData(client, "payroll_approvals"))) {
    console.log("  [SEED 27/51] payroll_approvals is empty. Inserting payroll approvals.");
    await client`
      INSERT INTO payroll_approvals (id, tenant_id, membership_id, payroll_run_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${mem1}, ${payrollRunRow.id}, ${JSON.stringify({ approval_level: 1, role: "finance_approver", approved_at: "2025-07-01T12:00:00Z" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 27/51] payroll_approvals already has data. Skipping.");
  }

  // 28. payroll_exports
  if (!(await hasData(client, "payroll_exports"))) {
    console.log("  [SEED 28/51] payroll_exports is empty. Inserting payroll exports.");
    await client`
      INSERT INTO payroll_exports (id, tenant_id, payroll_run_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${payrollRunRow.id}, ${JSON.stringify({ export_type: "bank_neft_file", file_name: "NEFT_SALARY_2025_06.txt", generated_at: "2025-07-02T10:00:00Z" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 28/51] payroll_exports already has data. Skipping.");
  }

  const exportRow = (await client`SELECT id FROM payroll_exports WHERE tenant_id = ${tenantId} LIMIT 1`)[0];

  // 29. payroll_export_lines
  if (!(await hasData(client, "payroll_export_lines"))) {
    console.log("  [SEED 29/51] payroll_export_lines is empty. Inserting export lines.");
    await client`
      INSERT INTO payroll_export_lines (id, tenant_id, gl_account_id, payroll_export_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${glAccRow.id}, ${exportRow.id}, ${JSON.stringify({ line_amount_minor: 4200000, narration: "Salary NEFT transfer" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 29/51] payroll_export_lines already has data. Skipping.");
  }

  // 30. disbursement_batches
  if (!(await hasData(client, "disbursement_batches"))) {
    console.log("  [SEED 30/51] disbursement_batches is empty. Inserting batches.");
    await client`
      INSERT INTO disbursement_batches (id, tenant_id, payroll_run_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${payrollRunRow.id}, ${JSON.stringify({ batch_code: "DISB-2025-06-A", total_amount_minor: 42000000, status: "completed" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 30/51] disbursement_batches already has data. Skipping.");
  }

  const disbBatchRow = (await client`SELECT id FROM disbursement_batches WHERE tenant_id = ${tenantId} LIMIT 1`)[0];

  // 31. disbursement_items
  if (!(await hasData(client, "disbursement_items"))) {
    console.log("  [SEED 31/51] disbursement_items is empty. Inserting items.");
    const bankRow = (await client`SELECT id FROM bank_accounts WHERE tenant_id = ${tenantId} LIMIT 1`)[0];
    await client`
      INSERT INTO disbursement_items (id, tenant_id, bank_account_id, disbursement_batch_id, employee_id, payroll_run_employee_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${bankRow.id}, ${disbBatchRow.id}, ${emp1.employee_id}, ${prEmpRow.id}, ${JSON.stringify({ amount_minor: 4200000, payment_mode: "NEFT", utr_number: "UTR99281726" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 31/51] disbursement_items already has data. Skipping.");
  }

  // 32. loan_schedules
  const loanRow = (await client`SELECT id FROM employee_loans WHERE tenant_id = ${tenantId} LIMIT 1`)[0];
  if (!(await hasData(client, "loan_schedules"))) {
    console.log("  [SEED 32/51] loan_schedules is empty. Inserting loan schedules.");
    await client`
      INSERT INTO loan_schedules (id, tenant_id, employee_loan_id, attributes)
      VALUES 
        (${uuid()}, ${tenantId}, ${loanRow.id}, ${JSON.stringify({ installment_number: 1, due_date: "2025-07-05", principal_minor: 500000, interest_minor: 25000, status: "paid" })}::jsonb),
        (${uuid()}, ${tenantId}, ${loanRow.id}, ${JSON.stringify({ installment_number: 2, due_date: "2025-08-05", principal_minor: 500000, interest_minor: 25000, status: "pending" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 32/51] loan_schedules already has data. Skipping.");
  }

  // 33. loan_transactions
  if (!(await hasData(client, "loan_transactions"))) {
    console.log("  [SEED 33/51] loan_transactions is empty. Inserting loan transactions.");
    await client`
      INSERT INTO loan_transactions (id, tenant_id, employee_loan_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${loanRow.id}, ${JSON.stringify({ transaction_type: "repayment", amount_minor: 525000, processed_date: "2025-07-05" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 33/51] loan_transactions already has data. Skipping.");
  }

  // 34. loan_exceptions
  if (!(await hasData(client, "loan_exceptions"))) {
    console.log("  [SEED 34/51] loan_exceptions is empty. Inserting loan exceptions.");
    const wfRow = (await client`SELECT id FROM workflow_instances WHERE tenant_id = ${tenantId} LIMIT 1`)[0];
    await client`
      INSERT INTO loan_exceptions (id, tenant_id, approved_by_membership_id, employee_id, workflow_instance_id, employee_loan_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${mem1}, ${emp1.employee_id}, ${wfRow.id}, ${loanRow.id}, ${JSON.stringify({ exception_type: "emi_waiver_month", reason: "Medical emergency request approved by HR Head" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 34/51] loan_exceptions already has data. Skipping.");
  }

  // 35. wage_base_simulation_lines
  if (!(await hasData(client, "wage_base_simulation_lines"))) {
    console.log("  [SEED 35/51] wage_base_simulation_lines is empty. Inserting simulation lines.");
    const simRow = (await client`SELECT id FROM wage_base_simulations WHERE tenant_id = ${tenantId} LIMIT 1`)[0];
    await client`
      INSERT INTO wage_base_simulation_lines (id, tenant_id, pay_component_id, wage_base_simulation_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${payCompRows[0].id}, ${simRow.id}, ${JSON.stringify({ component_code: "BASIC", current_weight: 0.5, simulated_weight: 0.52, simulated_variance_minor: 1200000 })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 35/51] wage_base_simulation_lines already has data. Skipping.");
  }

  // =========================================================================
  // GROUP 5: PERFORMANCE, OKRS & REVIEWS
  // =========================================================================

  const goalCycleRow = (await client`SELECT id FROM goal_cycles WHERE tenant_id = ${tenantId} LIMIT 1`)[0];

  // 36. objectives
  if (!(await hasData(client, "objectives"))) {
    console.log("  [SEED 36/51] objectives is empty. Inserting objectives.");
    await client`
      INSERT INTO objectives (id, tenant_id, goal_cycle_id, attributes)
      VALUES 
        (${uuid()}, ${tenantId}, ${goalCycleRow.id}, ${JSON.stringify({ title: "Plant North Operational Efficiency & Zero Breakdown", target_progress: 100, current_progress: 88, category: "operations" })}::jsonb),
        (${uuid()}, ${tenantId}, ${goalCycleRow.id}, ${JSON.stringify({ title: "Reduce Loom Weft Tension Failures to < 0.5%", target_progress: 100, current_progress: 92, category: "quality" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 36/51] objectives already has data. Skipping.");
  }

  const objRows = await client`SELECT id FROM objectives WHERE tenant_id = ${tenantId} LIMIT 2`;

  // 37. key_results
  if (!(await hasData(client, "key_results"))) {
    console.log("  [SEED 37/51] key_results is empty. Inserting key results.");
    await client`
      INSERT INTO key_results (id, tenant_id, objective_id, attributes)
      VALUES 
        (${uuid()}, ${tenantId}, ${objRows[0].id}, ${JSON.stringify({ metric_name: "OEE Percentage", start_val: 78.0, current_val: 86.5, target_val: 90.0, uom: "pct" })}::jsonb),
        (${uuid()}, ${tenantId}, ${objRows[1]?.id || objRows[0].id}, ${JSON.stringify({ metric_name: "Defect Spools / 1000m", start_val: 12, current_val: 4, target_val: 2, uom: "count" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 37/51] key_results already has data. Skipping.");
  }

  // 38. goal_links
  if (!(await hasData(client, "goal_links"))) {
    console.log("  [SEED 38/51] goal_links is empty. Inserting goal links.");
    if (objRows.length >= 2) {
      await client`
        INSERT INTO goal_links (id, tenant_id, child_objective_id, parent_objective_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${objRows[1].id}, ${objRows[0].id}, ${JSON.stringify({ alignment_weight: 0.5, relationship: "cascaded_goal" })}::jsonb)
      `;
    }
  } else {
    console.log("  [CHECK 38/51] goal_links already has data. Skipping.");
  }

  const reviewCycleRow = (await client`SELECT id FROM review_cycles WHERE tenant_id = ${tenantId} LIMIT 1`)[0];
  const reviewTmplRow = (await client`SELECT id FROM review_templates WHERE tenant_id = ${tenantId} LIMIT 1`)[0];

  // 39. review_participants
  if (!(await hasData(client, "review_participants"))) {
    console.log("  [SEED 39/51] review_participants is empty. Inserting participants.");
    await client`
      INSERT INTO review_participants (id, tenant_id, employee_id, review_cycle_id, review_template_id, attributes)
      VALUES 
        (${uuid()}, ${tenantId}, ${emp1.employee_id}, ${reviewCycleRow.id}, ${reviewTmplRow.id}, ${JSON.stringify({ self_submitted: true, manager_submitted: true, final_score: 4.5 })}::jsonb),
        (${uuid()}, ${tenantId}, ${emp2.employee_id}, ${reviewCycleRow.id}, ${reviewTmplRow.id}, ${JSON.stringify({ self_submitted: true, manager_submitted: true, final_score: 4.2 })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 39/51] review_participants already has data. Skipping.");
  }

  const participantRows = await client`SELECT id FROM review_participants WHERE tenant_id = ${tenantId} LIMIT 2`;

  // 40. review_responses
  if (!(await hasData(client, "review_responses"))) {
    console.log("  [SEED 40/51] review_responses is empty. Inserting responses.");
    await client`
      INSERT INTO review_responses (id, tenant_id, rater_employee_id, review_participant_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${emp2.employee_id}, ${participantRows[0].id}, ${JSON.stringify({ feedback: "Consistently delivers highest quality yarn output. Excellent team player.", rating: 5 })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 40/51] review_responses already has data. Skipping.");
  }

  // 41. review_summaries
  if (!(await hasData(client, "review_summaries"))) {
    console.log("  [SEED 41/51] review_summaries is empty. Inserting summaries.");
    await client`
      INSERT INTO review_summaries (id, tenant_id, review_participant_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${participantRows[0].id}, ${JSON.stringify({ performance_rating: "Exceeds Expectations", potential_rating: "High", final_increment_pct: 12.0 })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 41/51] review_summaries already has data. Skipping.");
  }

  const reviewSummaryRow = (await client`SELECT id FROM review_summaries WHERE tenant_id = ${tenantId} LIMIT 1`)[0];

  // 42. calibration_sessions
  if (!(await hasData(client, "calibration_sessions"))) {
    console.log("  [SEED 42/51] calibration_sessions is empty. Inserting calibration session.");
    await client`
      INSERT INTO calibration_sessions (id, tenant_id, facilitator_membership_id, review_cycle_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${mem1}, ${reviewCycleRow.id}, ${JSON.stringify({ title: "Plant North H1 FY25 Bell Curve Calibration", status: "completed", date: "2025-04-15" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 42/51] calibration_sessions already has data. Skipping.");
  }

  const calibSessionRow = (await client`SELECT id FROM calibration_sessions WHERE tenant_id = ${tenantId} LIMIT 1`)[0];

  // 43. talent_placements
  if (!(await hasData(client, "talent_placements"))) {
    console.log("  [SEED 43/51] talent_placements is empty. Inserting talent placements.");
    await client`
      INSERT INTO talent_placements (id, tenant_id, calibration_session_id, employee_id, review_summary_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${calibSessionRow.id}, ${emp1.employee_id}, ${reviewSummaryRow.id}, ${JSON.stringify({ nine_box_grid: "Top Talent / Star", retention_risk: "low" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 43/51] talent_placements already has data. Skipping.");
  }

  // =========================================================================
  // GROUP 6: OFFBOARDING, SETTLEMENTS & ALUMNI
  // =========================================================================

  const offbRow = (await client`
    SELECT oc.id as offboarding_case_id, em.employee_id, oc.employment_id 
    FROM offboarding_cases oc
    JOIN employments em ON em.id = oc.employment_id
    WHERE oc.tenant_id = ${tenantId}
    LIMIT 1
  `)[0];

  // 44. full_final_settlements
  if (!(await hasData(client, "full_final_settlements"))) {
    console.log("  [SEED 44/51] full_final_settlements is empty. Inserting settlements.");
    await client`
      INSERT INTO full_final_settlements (id, tenant_id, employment_id, offboarding_case_id, payroll_run_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${offbRow.employment_id}, ${offbRow.offboarding_case_id}, ${payrollRunRow.id}, ${JSON.stringify({ gratuity_minor: 12500000, leave_encashment_minor: 3200000, net_payable_minor: 15700000, status: "approved" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 44/51] full_final_settlements already has data. Skipping.");
  }

  const fnfRow = (await client`SELECT id FROM full_final_settlements WHERE tenant_id = ${tenantId} LIMIT 1`)[0];

  // 45. full_final_lines
  if (!(await hasData(client, "full_final_lines"))) {
    console.log("  [SEED 45/51] full_final_lines is empty. Inserting lines.");
    await client`
      INSERT INTO full_final_lines (id, tenant_id, full_final_settlement_id, pay_component_id, attributes)
      VALUES 
        (${uuid()}, ${tenantId}, ${fnfRow.id}, ${payCompRows[0].id}, ${JSON.stringify({ component_name: "Gratuity Pay", amount_minor: 12500000, type: "earning" })}::jsonb),
        (${uuid()}, ${tenantId}, ${fnfRow.id}, ${payCompRows[1]?.id || payCompRows[0].id}, ${JSON.stringify({ component_name: "Leave Encashment", amount_minor: 3200000, type: "earning" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 45/51] full_final_lines already has data. Skipping.");
  }

  // 46. exit_interviews
  if (!(await hasData(client, "exit_interviews"))) {
    console.log("  [SEED 46/51] exit_interviews is empty. Inserting exit interview.");
    await client`
      INSERT INTO exit_interviews (id, tenant_id, offboarding_case_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${offbRow.offboarding_case_id}, ${JSON.stringify({ reason: "Higher Education / Relocation", company_culture_rating: 4.5, remarks: "Thankful for the strong training environment at MKraft" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 46/51] exit_interviews already has data. Skipping.");
  }

  // 47. alumni_records
  if (!(await hasData(client, "alumni_records"))) {
    console.log("  [SEED 47/51] alumni_records is empty. Inserting alumni records.");
    await client`
      INSERT INTO alumni_records (id, tenant_id, employee_id, offboarding_case_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${offbRow.employee_id}, ${offbRow.offboarding_case_id}, ${JSON.stringify({ personal_email: "alumni.contact@example.test", eligible_for_rehire: true, separation_date: "2026-04-15" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 47/51] alumni_records already has data. Skipping.");
  }

  // =========================================================================
  // GROUP 7: SOCIAL, REWARDS & COMPLIANCE
  // =========================================================================

  const feedPostRow = (await client`SELECT id FROM feed_posts WHERE tenant_id = ${tenantId} LIMIT 1`)[0];

  // 48. post_comments
  if (!(await hasData(client, "post_comments"))) {
    console.log("  [SEED 48/51] post_comments is empty. Inserting comments.");
    await client`
      INSERT INTO post_comments (id, tenant_id, author_employee_id, feed_post_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${emp1.employee_id}, ${feedPostRow.id}, ${JSON.stringify({ content: "Proud to be part of the MKraft plant operations team! Congratulations everyone.", created_at: "2025-08-16T12:00:00Z" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 48/51] post_comments already has data. Skipping.");
  }

  // 49. post_reactions
  if (!(await hasData(client, "post_reactions"))) {
    console.log("  [SEED 49/51] post_reactions is empty. Inserting reactions.");
    await client`
      INSERT INTO post_reactions (id, tenant_id, employee_id, feed_post_id, attributes)
      VALUES 
        (${uuid()}, ${tenantId}, ${emp1.employee_id}, ${feedPostRow.id}, ${JSON.stringify({ reaction_type: "celebrate" })}::jsonb),
        (${uuid()}, ${tenantId}, ${emp2.employee_id}, ${feedPostRow.id}, ${JSON.stringify({ reaction_type: "like" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 49/51] post_reactions already has data. Skipping.");
  }

  // 50. reward_transactions
  if (!(await hasData(client, "reward_transactions"))) {
    console.log("  [SEED 50/51] reward_transactions is empty. Inserting reward transactions.");
    const recEventRow = (await client`SELECT id FROM recognition_events WHERE tenant_id = ${tenantId} LIMIT 1`)[0];
    await client`
      INSERT INTO reward_transactions (id, tenant_id, employee_id, recognition_event_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${emp1.employee_id}, ${recEventRow?.id || null}, ${JSON.stringify({ points: 500, transaction_type: "credit", reason: "Quarterly Safety Excellence Award" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 50/51] reward_transactions already has data. Skipping.");
  }

  // 51. compliance_evidence
  if (!(await hasData(client, "compliance_evidence"))) {
    console.log("  [SEED 51/51] compliance_evidence is empty. Inserting compliance evidence.");
    const compCalRow = (await client`SELECT id FROM compliance_calendar_items WHERE tenant_id = ${tenantId} LIMIT 1`)[0];
    await client`
      INSERT INTO compliance_evidence (id, tenant_id, compliance_calendar_item_id, document_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${compCalRow?.id || null}, ${docRow?.id || null}, ${JSON.stringify({ evidence_title: "EPF Monthly Electronic Challan Receipt (ECR)", verified_by: "Internal Auditor", verified_at: "2025-07-20" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK 51/51] compliance_evidence already has data. Skipping.");
  }

  console.log("\n✓ ALL 51 REMAINING TABLES PROCESSED SUCCESSFULLY!");
}
