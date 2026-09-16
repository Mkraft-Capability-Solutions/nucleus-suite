import { SeedContext, uuid, hasData } from "./types";

export async function seedDomain09(ctx: SeedContext) {
  const { client, tenantId } = ctx;
  const legalEntityId = (ctx.legalEntityId && ctx.legalEntityId !== "")
    ? ctx.legalEntityId
    : (await client`SELECT id FROM legal_entities WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;

  const hrMemId = ctx.membershipByCode["MK-102"] || (await client`SELECT m.id FROM memberships m JOIN "user" u ON u.id = m.user_id WHERE m.tenant_id = ${tenantId} AND (u.email = 'hr@brigtenz.tech' OR u.email = 'sunita.verma@mkraft.demo') LIMIT 1`)[0]?.id || (await client`SELECT id FROM memberships WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
  const hrRoleId = ctx.roleIds["hr-manager"] || (await client`SELECT id FROM roles WHERE tenant_id = ${tenantId} AND code = 'hr-manager' LIMIT 1`)[0]?.id || (await client`SELECT id FROM roles WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
  const skillOntVerId = ctx.skillOntologyVersionId || (await client`SELECT id FROM skill_ontology_versions WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;

  if (ctx.roster.length === 0) {
    const emps = await client`SELECT id as employee_id, employee_code as code FROM employees WHERE tenant_id = ${tenantId} LIMIT 16`;
    for (const e of emps as any[]) {
      const item = { employeeId: e.employee_id, code: e.code };
      ctx.roster.push(item as any);
      ctx.employeeByCode[e.code] = item as any;
    }
  }
  console.log("--> Seeding Domain 09: Engagement, Analytics & AI Systems...");

  // 1. Metric Definitions & Snapshots
  let metricDefId = "";
  if (await hasData(client, "metric_definitions")) {
    console.log("  [CHECK] metric_definitions has data. Fetching existing ID.");
    const rows = await client`SELECT id FROM metric_definitions WHERE tenant_id = ${tenantId} LIMIT 1`;
    metricDefId = rows[0]?.id;
  } else {
    console.log("  [SEED] metric_definitions is empty. Inserting records.");
    metricDefId = uuid();
    await client`
      INSERT INTO metric_definitions (id, tenant_id, attributes)
      VALUES (${metricDefId}, ${tenantId}, ${JSON.stringify({ code: "TURNOVER_RATE", name: "Plant Annualized Attrition Rate", unit: "percentage", target_value: 5.0 })}::jsonb)
    `;
  }

  if (!(await hasData(client, "metric_snapshots"))) {
    console.log("  [SEED] metric_snapshots is empty. Inserting records.");
    for (const [date, val] of [["2024-12-31", 4.2], ["2025-12-31", 3.8], ["2026-08-31", 3.5]] as Array<[string, number]>) {
      await client`
        INSERT INTO metric_snapshots (id, tenant_id, metric_definition_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${metricDefId}, ${JSON.stringify({ snapshot_date: date, value: val, status: "within_target" })}::jsonb)
      `;
    }
  }

  // 2. Engagement Surveys, Questions, Runs, Responses, Answers & Aggregate Results
  let surveyId = "";
  if (await hasData(client, "surveys")) {
    const s = await client`SELECT id FROM surveys WHERE tenant_id = ${tenantId} LIMIT 1`;
    surveyId = s[0]?.id;
  } else {
    surveyId = uuid();
    console.log("  [SEED] surveys is empty. Inserting survey structure.");
    await client`
      INSERT INTO surveys (id, tenant_id, attributes)
      VALUES (${surveyId}, ${tenantId}, ${JSON.stringify({ title: "Plant Safety & Work Environment Survey 2024-2026", category: "workplace_safety", frequency: "annual" })}::jsonb)
    `;
  }

  let q1Id = "";
  let q2Id = "";
  if (await hasData(client, "survey_questions")) {
    const qs = await client`SELECT id FROM survey_questions WHERE tenant_id = ${tenantId} LIMIT 2`;
    q1Id = qs[0]?.id;
    q2Id = qs[1]?.id || q1Id;
  } else {
    q1Id = uuid();
    q2Id = uuid();
    await client`
      INSERT INTO survey_questions (id, tenant_id, survey_id, attributes)
      VALUES 
        (${q1Id}, ${tenantId}, ${surveyId}, ${JSON.stringify({ question_text: "Do you feel adequately protected with safety PPE on your shift?", response_type: "rating_1_to_5" })}::jsonb),
        (${q2Id}, ${tenantId}, ${surveyId}, ${JSON.stringify({ question_text: "Does your supervisor address equipment maintenance issues promptly?", response_type: "rating_1_to_5" })}::jsonb)
    `;
  }

  let runId = "";
  if (await hasData(client, "survey_runs")) {
    const r = await client`SELECT id FROM survey_runs WHERE tenant_id = ${tenantId} LIMIT 1`;
    runId = r[0]?.id;
  } else {
    for (const [year, status] of [[2024, "closed"], [2025, "closed"], [2026, "active"]] as Array<[number, string]>) {
      const rId = uuid();
      if (!runId) runId = rId;
      await client`
        INSERT INTO survey_runs (id, tenant_id, survey_id, attributes)
        VALUES (${rId}, ${tenantId}, ${surveyId}, ${JSON.stringify({ run_label: `Annual Run ${year}`, start_date: `${year}-09-01`, end_date: `${year}-09-30`, status })}::jsonb)
      `;
    }
  }

  if (!(await hasData(client, "aggregate_results")) && runId) {
    await client`
      INSERT INTO aggregate_results (id, tenant_id, survey_run_id, department_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${runId}, ${ctx.departmentIds["Weaving"] || Object.values(ctx.departmentIds)[0]}, ${JSON.stringify({ respondent_count: 12, overall_satisfaction_score: 4.6, participation_rate: 94 })}::jsonb)
    `;
  }

  if (!(await hasData(client, "survey_responses")) && runId) {
    console.log("  [SEED] survey_responses is empty. Inserting employee responses.");
    for (const emp of ctx.roster.slice(0, 4)) {
      const respId = uuid();
      await client`
        INSERT INTO survey_responses (id, tenant_id, survey_run_id, employee_id, attributes)
        VALUES (${respId}, ${tenantId}, ${runId}, ${emp.employeeId}, ${JSON.stringify({ submitted_by_employee_id: emp.employeeId, submitted_at: "2026-08-15T14:30:00Z" })}::jsonb)
      `;

      await client`
        INSERT INTO survey_answers (id, tenant_id, survey_response_id, survey_question_id, attributes)
        VALUES 
          (${uuid()}, ${tenantId}, ${respId}, ${q1Id}, ${JSON.stringify({ score: 5, feedback: "Excellent quality safety boots and goggles provided." })}::jsonb),
          (${uuid()}, ${tenantId}, ${respId}, ${q2Id}, ${JSON.stringify({ score: 4, feedback: "Maintenance team is generally quick to respond." })}::jsonb)
      `;
    }
  } else if (!(await hasData(client, "survey_answers"))) {
    console.log("  [SEED] survey_answers is empty. Inserting answers for existing responses.");
    const responses = await client`SELECT id FROM survey_responses WHERE tenant_id = ${tenantId} LIMIT 5`;
    for (const r of responses) {
      await client`
        INSERT INTO survey_answers (id, tenant_id, survey_response_id, survey_question_id, attributes)
        VALUES 
          (${uuid()}, ${tenantId}, ${r.id}, ${q1Id}, ${JSON.stringify({ score: 5, feedback: "Excellent quality safety boots and goggles provided." })}::jsonb),
          (${uuid()}, ${tenantId}, ${r.id}, ${q2Id}, ${JSON.stringify({ score: 4, feedback: "Maintenance team is generally quick to respond." })}::jsonb)
      `;
    }
  }

  // 3. Social Feed Posts, Audiences, Comments & Reactions
  if (!(await hasData(client, "feed_posts"))) {
    console.log("  [SEED] feed_posts is empty. Inserting feed updates.");
    const post1 = uuid();
    const post2 = uuid();

    await client`
      INSERT INTO feed_posts (id, tenant_id, attributes)
      VALUES 
        (${post1}, ${tenantId}, ${JSON.stringify({ title: "Plant North Celebrates 500 Days Without Lost Time Injury!", body: "Congratulations to the entire Weaving and Dyeing production crew for maintaining strict safety discipline.", published_by_email: "rajesh.sharma@mkraft.demo", category: "safety_milestone", published_at: "2025-06-15T09:00:00Z" })}::jsonb),
        (${post2}, ${tenantId}, ${JSON.stringify({ title: "Diwali Bonus & Production Incentives Announced", body: "Management is pleased to announce festive incentives for all shopfloor operators.", published_by_email: "amit.patel@mkraft.demo", category: "management_notice", published_at: "2025-10-18T10:30:00Z" })}::jsonb)
    `;

    for (const pId of [post1, post2]) {
      await client`
        INSERT INTO feed_audiences (id, tenant_id, feed_post_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${pId}, ${JSON.stringify({ audience_type: "all_hands" })}::jsonb)
      `;
    }

    // Comments & Reactions from operators
    for (const emp of ctx.roster.slice(3, 7)) {
      await client`
        INSERT INTO post_comments (id, tenant_id, feed_post_id, author_employee_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${post1}, ${emp.employeeId}, ${JSON.stringify({ comment_text: "Proud to be part of Plant North team!", posted_at: "2025-06-15T11:20:00Z" })}::jsonb)
      `;
      await client`
        INSERT INTO post_reactions (id, tenant_id, feed_post_id, employee_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${post1}, ${emp.employeeId}, ${JSON.stringify({ reaction_type: "thumbs_up" })}::jsonb)
      `;
    }
  }

  // 4. Recognition Programs, Events & Reward Transactions
  let recProgId = "";
  if (await hasData(client, "recognition_programs")) {
    const rows = await client`SELECT id FROM recognition_programs WHERE tenant_id = ${tenantId} LIMIT 1`;
    recProgId = rows[0]?.id;
  } else {
    recProgId = uuid();
    await client`
      INSERT INTO recognition_programs (id, tenant_id, attributes)
      VALUES (${recProgId}, ${tenantId}, ${JSON.stringify({ name: "Operator of the Month Award", reward_points: 5000, category: "excellence" })}::jsonb)
    `;
  }

  if (!(await hasData(client, "recognition_events"))) {
    console.log("  [SEED] recognition_events is empty. Inserting awards.");
    for (const empCode of ["MK-107", "MK-109", "MK-111"]) {
      const emp = ctx.employeeByCode[empCode];
      await client`
        INSERT INTO recognition_events (id, tenant_id, recognition_program_id, recipient_employee_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${recProgId}, ${emp.employeeId}, ${JSON.stringify({ awarded_on: "2025-11-30", title: "Spotlight on Quality", reason: "Zero loom downtime during peak festival run." })}::jsonb)
      `;
      await client`
        INSERT INTO reward_transactions (id, tenant_id, employee_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${emp.employeeId}, ${JSON.stringify({ points_awarded: 5000, currency_value_minor: 500000, status: "credited" })}::jsonb)
      `;
    }
  }

  // 5. Wellbeing Check-ins, Attrition Scores, Manager Effectiveness
  if (!(await hasData(client, "wellbeing_checkins"))) {
    console.log("  [SEED] wellbeing_checkins is empty. Inserting records.");
    for (const emp of ctx.roster.slice(0, 5)) {
      await client`
        INSERT INTO wellbeing_checkins (id, tenant_id, employee_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${emp.employeeId}, ${JSON.stringify({ checkin_date: "2026-08-25", energy_score: 4, stress_score: 2, comments: "Shift schedule is comfortable." })}::jsonb)
      `;
    }
  }

  // Model config for AI analytics
  let modelConfId = "";
  if (await hasData(client, "model_configs")) {
    const rows = await client`SELECT id FROM model_configs WHERE tenant_id = ${tenantId} LIMIT 1`;
    modelConfId = rows[0]?.id;
  } else {
    modelConfId = uuid();
    await client`
      INSERT INTO model_configs (id, tenant_id, attributes)
      VALUES (${modelConfId}, ${tenantId}, ${JSON.stringify({ provider: "openai", model_name: "gpt-4o-mini", temperature: 0.2 })}::jsonb)
    `;
  }
  ctx.modelConfigId = modelConfId;

  if (!(await hasData(client, "attrition_scores"))) {
    console.log("  [SEED] attrition_scores is empty. Inserting ML risk assessments.");
    for (const emp of ctx.roster.slice(0, 5)) {
      await client`
        INSERT INTO attrition_scores (id, tenant_id, employee_id, model_config_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${emp.employeeId}, ${modelConfId}, ${JSON.stringify({ risk_score: 0.12, risk_tier: "low", primary_driver: "Competitive compensation and tenure stability" })}::jsonb)
      `;
    }
  }

  if (!(await hasData(client, "manager_effectiveness_scores"))) {
    console.log("  [SEED] manager_effectiveness_scores is empty. Inserting scores.");
    const mgrEmpId = ctx.employeeByCode["MK-104"]?.employeeId || (await client`SELECT id FROM employees WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
    if (mgrEmpId) {
      await client`
        INSERT INTO manager_effectiveness_scores (id, tenant_id, manager_employee_id, metric_definition_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${mgrEmpId}, ${metricDefId}, ${JSON.stringify({ effectiveness_percentage: 91.5, team_retention_rate: 98.0, cycle: "FY25" })}::jsonb)
      `;
    }
  }

  // 6. Manpower Plans, Lines, Workforce Scenarios & Scenario Lines
  if (!(await hasData(client, "manpower_plans"))) {
    console.log("  [SEED] manpower_plans is empty. Inserting staffing plans.");
    const mpId = uuid();
    await client`
      INSERT INTO manpower_plans (id, tenant_id, legal_entity_id, attributes)
      VALUES (${mpId}, ${tenantId}, ${legalEntityId}, ${JSON.stringify({ plan_year: 2026, status: "approved", approved_by: "amit.patel@mkraft.demo" })}::jsonb)
    `;

    const deptId = ctx.departmentIds["Weaving"] || (await client`SELECT id FROM departments WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
    const gradeId = ctx.gradeIds["G-STAFF"] || (await client`SELECT id FROM grades WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
    const profId = ctx.jobProfileIds["P-OP"] || (await client`SELECT id FROM job_profiles WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;

    if (deptId && gradeId && profId) {
      await client`
        INSERT INTO manpower_plan_lines (id, tenant_id, manpower_plan_id, department_id, grade_id, job_profile_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${mpId}, ${deptId}, ${gradeId}, ${profId}, ${JSON.stringify({ sanctioned_headcount: 25, current_headcount: 18, planned_hires: 7 })}::jsonb)
      `;
    }

    const wfScenId = uuid();
    const ownerMemId = ctx.membershipByCode["MK-102"] || (await client`SELECT id FROM memberships WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
    if (ownerMemId) {
      await client`
        INSERT INTO workforce_scenarios (id, tenant_id, legal_entity_id, owner_membership_id, attributes)
        VALUES (${wfScenId}, ${tenantId}, ${legalEntityId}, ${ownerMemId}, ${JSON.stringify({ scenario_name: "Plant North Shift C Addition Simulation", horizon_months: 6 })}::jsonb)
      `;

      await client`
        INSERT INTO workforce_scenario_lines (id, tenant_id, workforce_scenario_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${wfScenId}, ${JSON.stringify({ department: "Weaving", additional_operators: 8, estimated_cost_minor: 25000000 })}::jsonb)
      `;
    }
  }

  // 7. Prompt Versions, AI Workflows, AI Runs, Steps, Artifacts, Feedback & Graphs
  let promptVerId = "";
  if (await hasData(client, "prompt_versions")) {
    const rows = await client`SELECT id FROM prompt_versions WHERE tenant_id = ${tenantId} LIMIT 1`;
    promptVerId = rows[0]?.id;
  } else {
    promptVerId = uuid();
    await client`
      INSERT INTO prompt_versions (id, tenant_id, attributes)
      VALUES (${promptVerId}, ${tenantId}, ${JSON.stringify({ prompt_key: "hr_talent_assistant", version: 1, template: "You are MKraft Talent Assistant. Help employees understand company policies." })}::jsonb)
    `;
  }
  ctx.promptVersionId = promptVerId;

  let aiWfId = "";
  if (await hasData(client, "ai_workflow_definitions")) {
    const rows = await client`SELECT id FROM ai_workflow_definitions WHERE tenant_id = ${tenantId} LIMIT 1`;
    aiWfId = rows[0]?.id;
  } else {
    aiWfId = uuid();
    await client`
      INSERT INTO ai_workflow_definitions (id, tenant_id, default_model_config_id, attributes)
      VALUES (${aiWfId}, ${tenantId}, ${modelConfId}, ${JSON.stringify({ workflow_name: "Policy Q&A Assistant", active: true })}::jsonb)
    `;
  }

  // AI Graph Threads, Checkpoints, Writes, Blobs
  if (!(await hasData(client, "ai_graph_threads"))) {
    console.log("  [SEED] ai_graph_threads is empty. Inserting state checkpoints.");
    const threadId = uuid();
    await client`
      INSERT INTO ai_graph_threads (id, tenant_id, ai_workflow_definition_id, attributes)
      VALUES (${threadId}, ${tenantId}, ${aiWfId}, ${JSON.stringify({ thread_title: "Leave Policy Inquiry - Sunita Verma", created_at: "2026-08-10" })}::jsonb)
    `;

    const chkId = uuid();
    await client`
      INSERT INTO ai_graph_checkpoints (id, tenant_id, ai_graph_thread_id, attributes)
      VALUES (${chkId}, ${tenantId}, ${threadId}, ${JSON.stringify({ checkpoint_ns: "conversation", step: 3 })}::jsonb)
    `;

    await client`
      INSERT INTO ai_graph_checkpoint_blobs (id, tenant_id, ai_graph_checkpoint_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${chkId}, ${JSON.stringify({ state_data: "User asked: How many casual leaves are allowed per year?" })}::jsonb)
    `;

    await client`
      INSERT INTO ai_graph_checkpoint_writes (id, tenant_id, ai_graph_checkpoint_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${chkId}, ${JSON.stringify({ write_channel: "messages", write_value: "12 Casual Leaves per financial year." })}::jsonb)
    `;
  }

  // AI Runs, Steps, Artifacts, Feedback & Safety Evaluations
  if (!(await hasData(client, "ai_runs"))) {
    console.log("  [SEED] ai_runs is empty. Inserting run telemetry.");
    const runId = uuid();
    await client`
      INSERT INTO ai_runs (id, tenant_id, ai_workflow_definition_id, model_config_id, attributes)
      VALUES (${runId}, ${tenantId}, ${aiWfId}, ${modelConfId}, ${JSON.stringify({ status: "success", tokens_used: 420, latency_ms: 850 })}::jsonb)
    `;

    const stepId = uuid();
    await client`
      INSERT INTO ai_run_steps (id, tenant_id, ai_run_id, attributes)
      VALUES (${stepId}, ${tenantId}, ${runId}, ${JSON.stringify({ step_name: "vector_search_rag", status: "completed", duration_ms: 120 })}::jsonb)
    `;

    if (!(await hasData(client, "tool_invocations"))) {
      await client`
        INSERT INTO tool_invocations (id, tenant_id, ai_run_step_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${stepId}, ${JSON.stringify({ tool_name: "search_handbook", status: "success", execution_time_ms: 45 })}::jsonb)
      `;
    }

    await client`
      INSERT INTO ai_artifacts (id, tenant_id, ai_run_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${runId}, ${JSON.stringify({ artifact_type: "markdown_response", title: "Casual Leave Rules Summary" })}::jsonb)
    `;

    await client`
      INSERT INTO ai_feedback (id, tenant_id, ai_run_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${runId}, ${JSON.stringify({ rating: 5, user_comment: "Clear, direct, and cited the handbook correctly." })}::jsonb)
    `;

    await client`
      INSERT INTO safety_evaluations (id, tenant_id, ai_run_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${runId}, ${JSON.stringify({ passed: true, score: 0.99, flagged_categories: [] })}::jsonb)
    `;
  }

  // 7b. Human Review Requests & Decisions
  let revReqId = "";
  if (await hasData(client, "human_review_requests")) {
    const hr = await client`SELECT id FROM human_review_requests WHERE tenant_id = ${tenantId} LIMIT 1`;
    revReqId = hr[0]?.id;
  } else {
    const anyAiRun = (await client`SELECT id FROM ai_runs WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
    if (anyAiRun) {
      revReqId = uuid();
      await client`
        INSERT INTO human_review_requests (id, tenant_id, ai_run_id, attributes)
        VALUES (${revReqId}, ${tenantId}, ${anyAiRun}, ${JSON.stringify({ trigger_reason: "High stakes policy query", status: "reviewed" })}::jsonb)
      `;
    }
  }

  if (!(await hasData(client, "human_review_decisions")) && revReqId) {
    console.log("  [SEED] human_review_decisions is empty. Inserting decision record.");
    await client`
      INSERT INTO human_review_decisions (id, tenant_id, human_review_request_id, reviewer_membership_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${revReqId}, ${hrMemId}, ${JSON.stringify({ decision: "approved_without_changes", reviewed_at: "2026-08-11" })}::jsonb)
    `;
  }

  // 8. Knowledge Sources, Documents, Chunks & Retrieval Logs
  let knSourceId = "";
  if (await hasData(client, "knowledge_sources")) {
    const rows = await client`SELECT id FROM knowledge_sources WHERE tenant_id = ${tenantId} LIMIT 1`;
    knSourceId = rows[0]?.id;
  } else {
    knSourceId = uuid();
    await client`
      INSERT INTO knowledge_sources (id, tenant_id, attributes)
      VALUES (${knSourceId}, ${tenantId}, ${JSON.stringify({ source_name: "MKraft Standard Operating Procedures", connector: "file_pdf" })}::jsonb)
    `;
  }

  if (!(await hasData(client, "knowledge_documents"))) {
    console.log("  [SEED] knowledge_documents is empty. Inserting embeddings.");
    const [docRow] = await client`SELECT id FROM documents WHERE tenant_id = ${tenantId} LIMIT 1`;
    const [verRow] = await client`SELECT id FROM document_versions WHERE tenant_id = ${tenantId} LIMIT 1`;
    if (docRow && verRow) {
      const knDocId = uuid();
      await client`
        INSERT INTO knowledge_documents (id, tenant_id, knowledge_source_id, document_id, document_version_id, attributes)
        VALUES (${knDocId}, ${tenantId}, ${knSourceId}, ${docRow.id}, ${verRow.id}, ${JSON.stringify({ status: "indexed", chunk_count: 5 })}::jsonb)
      `;

      const chunkId = uuid();
      await client`
        INSERT INTO knowledge_chunks (id, tenant_id, knowledge_document_id, attributes)
        VALUES (${chunkId}, ${tenantId}, ${knDocId}, ${JSON.stringify({ chunk_index: 0, content_preview: "Casual leave allocation for plant employees is 12 days per annum.", embedding_dim: 1536 })}::jsonb)
      `;

      const [stepRow] = await client`SELECT id FROM ai_run_steps WHERE tenant_id = ${tenantId} LIMIT 1`;
      if (stepRow) {
        await client`
          INSERT INTO retrieval_logs (id, tenant_id, ai_run_step_id, knowledge_chunk_id, attributes)
          VALUES (${uuid()}, ${tenantId}, ${stepRow.id}, ${chunkId}, ${JSON.stringify({ cosine_similarity: 0.89, rank: 1 })}::jsonb)
        `;
      }
    }
  }

  // 9. Agent Principals, Tools, Actions, Policy Versions, Rules, Simulations & Reversals
  let agentToolId = "";
  if (await hasData(client, "agent_tools", false)) {
    const rows = await client`SELECT id FROM agent_tools LIMIT 1`;
    agentToolId = rows[0]?.id;
  } else {
    agentToolId = uuid();
    await client`
      INSERT INTO agent_tools (id, attributes)
      VALUES (${agentToolId}, ${JSON.stringify({ tool_name: "query_attendance_balance", description: "Fetch remaining leave days for employee" })}::jsonb)
    `;
  }

  if (!(await hasData(client, "agent_principals"))) {
    console.log("  [SEED] agent_principals is empty. Inserting autonomous agent definitions.");
    const principalId = uuid();
    await client`
      INSERT INTO agent_principals (id, tenant_id, owner_membership_id, role_id, attributes)
      VALUES (${principalId}, ${tenantId}, ${hrMemId}, ${hrRoleId}, ${JSON.stringify({ agent_name: "HR Operations Autopilot", active: true })}::jsonb)
    `;

    const polVerId = uuid();
    await client`
      INSERT INTO agent_policy_versions (id, tenant_id, agent_principal_id, attributes)
      VALUES (${polVerId}, ${tenantId}, ${principalId}, ${JSON.stringify({ version_tag: "v1.0", max_budget_usd: 10.0 })}::jsonb)
    `;

    await client`
      INSERT INTO agent_policy_rules (id, tenant_id, agent_policy_version_id, agent_tool_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${polVerId}, ${agentToolId}, ${JSON.stringify({ permission_level: "read_only", require_human_review: false })}::jsonb)
    `;

    // Agent Action
    const actionId = uuid();
    await client`
      INSERT INTO agent_actions (id, tenant_id, agent_principal_id, agent_tool_id, human_principal_membership_id, attributes)
      VALUES (${actionId}, ${tenantId}, ${principalId}, ${agentToolId}, ${hrMemId}, ${JSON.stringify({ tool_name: "query_attendance_balance", execution_status: "executed", result: "Balance: 10 CL" })}::jsonb)
    `;

    await client`
      INSERT INTO agent_action_outcomes (id, tenant_id, agent_action_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${actionId}, ${JSON.stringify({ status: "success", executed_at: "2026-08-15T12:00:00Z" })}::jsonb)
    `;

    await client`
      INSERT INTO agent_action_simulations (id, tenant_id, agent_action_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${actionId}, ${JSON.stringify({ simulation_passed: true, safety_confidence: 0.98 })}::jsonb)
    `;

    await client`
      INSERT INTO agent_action_reversals (id, tenant_id, original_agent_action_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${actionId}, ${JSON.stringify({ reversible: true, reversal_executed: false })}::jsonb)
    `;
  }

  // 10. Candidate Match Rubric Versions, Runs, Results, Dispositions & Match Evidence
  let rubricId = "";
  if (await hasData(client, "candidate_match_rubric_versions")) {
    const rows = await client`SELECT id FROM candidate_match_rubric_versions WHERE tenant_id = ${tenantId} LIMIT 1`;
    rubricId = rows[0]?.id;
  } else {
    rubricId = uuid();
    await client`
      INSERT INTO candidate_match_rubric_versions (id, tenant_id, attributes)
      VALUES (${rubricId}, ${tenantId}, ${JSON.stringify({ rubric_name: "Textile Operator Skills Matching Model", skill_weight: 0.5, experience_weight: 0.3, education_weight: 0.2 })}::jsonb)
    `;
  }

  if (!(await hasData(client, "candidate_match_runs"))) {
    console.log("  [SEED] candidate_match_runs is empty. Inserting candidate AI scoring.");
    const [appRow] = await client`SELECT id FROM applications WHERE tenant_id = ${tenantId} LIMIT 1`;
    const [jdRow] = await client`SELECT id FROM job_descriptions WHERE tenant_id = ${tenantId} LIMIT 1`;
    const [extRow] = await client`SELECT id FROM document_extractions WHERE tenant_id = ${tenantId} LIMIT 1`;

    if (appRow && jdRow && extRow) {
      const matchRunId = uuid();
      await client`
        INSERT INTO candidate_match_runs (
          id, tenant_id, application_id, candidate_match_rubric_version_id,
          job_description_id, model_config_id, prompt_version_id,
          resume_document_extraction_id, skill_ontology_version_id, attributes
        )
        VALUES (
          ${matchRunId}, ${tenantId}, ${appRow.id}, ${rubricId},
          ${jdRow.id}, ${modelConfId}, ${promptVerId},
          ${extRow.id}, ${skillOntVerId},
          ${JSON.stringify({ match_score: 91.2, evaluated_at: "2026-08-20" })}::jsonb
        )
      `;

      const matchResId = uuid();
      await client`
        INSERT INTO candidate_match_results (id, tenant_id, candidate_match_run_id, attributes)
        VALUES (${matchResId}, ${tenantId}, ${matchRunId}, ${JSON.stringify({ overall_match: "strong_fit", match_percentage: 91.2 })}::jsonb)
      `;

      await client`
        INSERT INTO candidate_match_dispositions (id, tenant_id, candidate_match_result_id, reviewer_membership_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${matchResId}, ${ctx.membershipByCode["MK-104"]}, ${JSON.stringify({ disposition: "advance_to_interview", reviewed_on: "2026-08-21" })}::jsonb)
      `;

      await client`
        INSERT INTO match_evidence (id, tenant_id, candidate_match_run_id, candidate_match_result_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${matchRunId}, ${matchResId}, ${JSON.stringify({ matched_skill: "Rapier Loom Operation", evidence_snippet: "Operated 48 Picanol Rapier looms for 5 years." })}::jsonb)
      `;
    }
  }

  console.log("✓ Domain 09 seeded successfully.");
}
