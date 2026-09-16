import { SeedContext, uuid, hasData } from "./types";

export async function seedDomain06(ctx: SeedContext) {
  const { client, tenantId } = ctx;
  console.log("--> Seeding Domain 06: Talent Acquisition, Recruitment & Onboarding...");

  // 1. Skill Ontology & Version (Shared foundation for Talent & Skills)
  let ontoId = "";
  if (await hasData(client, "skill_ontologies")) {
    console.log("  [CHECK] skill_ontologies has data. Fetching existing ID.");
    const rows = await client`SELECT id FROM skill_ontologies WHERE tenant_id = ${tenantId} LIMIT 1`;
    ontoId = rows[0]?.id;
  } else {
    console.log("  [SEED] skill_ontologies is empty. Inserting ontology.");
    ontoId = uuid();
    await client`
      INSERT INTO skill_ontologies (id, tenant_id, attributes)
      VALUES (${ontoId}, ${tenantId}, ${JSON.stringify({ code: "TEXTILE-ONTOLOGY", name: "Textile & Industrial Operations Skill Framework" })}::jsonb)
    `;
  }
  ctx.skillOntologyId = ontoId;

  let ontoVerId = "";
  if (await hasData(client, "skill_ontology_versions")) {
    console.log("  [CHECK] skill_ontology_versions has data. Fetching existing ID.");
    const rows = await client`SELECT id FROM skill_ontology_versions WHERE tenant_id = ${tenantId} LIMIT 1`;
    ontoVerId = rows[0]?.id;
  } else {
    console.log("  [SEED] skill_ontology_versions is empty. Inserting ontology version.");
    ontoVerId = uuid();
    await client`
      INSERT INTO skill_ontology_versions (id, tenant_id, skill_ontology_id, attributes)
      VALUES (${ontoVerId}, ${tenantId}, ${ontoId}, ${JSON.stringify({ version_tag: "v2024.1", status: "active", published_at: "2024-04-01" })}::jsonb)
    `;
  }
  ctx.skillOntologyVersionId = ontoVerId;

  // Skills
  if (await hasData(client, "skills")) {
    console.log("  [CHECK] skills has data. Fetching existing skills.");
    const rows = await client`SELECT id, attributes->>'code' as code FROM skills WHERE tenant_id = ${tenantId}`;
    for (const r of rows as Array<{ id: string; code: string | null }>) {
      if (r.code) ctx.skillIds[r.code] = r.id;
    }
  } else {
    console.log("  [SEED] skills is empty. Inserting skills.");
    const coreSkills = [
      { code: "SK-LOOM-01", name: "Rapier & Airjet Loom Operation" },
      { code: "SK-DYE-01", name: "Chemical Dye Mixing & Shade Matching" },
      { code: "SK-QC-01", name: "Textile GSM & Tear Strength Testing" },
      { code: "SK-IND-01", name: "Industrial Electrical Automation" }
    ];
    for (const s of coreSkills) {
      const sId = uuid();
      await client`
        INSERT INTO skills (id, tenant_id, attributes)
        VALUES (${sId}, ${tenantId}, ${JSON.stringify({ code: s.code, name: s.name, category: "technical" })}::jsonb)
      `;
      ctx.skillIds[s.code] = sId;
    }
  }

  // 2. Requisitions, Job Descriptions & Postings (2024, 2025, 2026)
  let reqWeavingId = "";
  let reqQcId = "";
  let reqItId = "";

  if (!(await hasData(client, "requisitions"))) {
    console.log("  [SEED] requisitions is empty. Inserting requisitions across 2024, 2025, 2026.");
    reqWeavingId = uuid();
    reqQcId = uuid();
    reqItId = uuid();

    const mgrWeaving = ctx.employeeByCode["MK-104"]?.employeeId || (await client`SELECT id FROM employees WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
    const mgrQc = ctx.employeeByCode["MK-106"]?.employeeId || mgrWeaving;
    const mgrIt = ctx.employeeByCode["MK-101"]?.employeeId || mgrWeaving;

    const deptWeaving = ctx.departmentIds["Weaving"] || (await client`SELECT id FROM departments WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
    const deptProd = ctx.departmentIds["Production"] || deptWeaving;
    const deptIt = ctx.departmentIds["IT"] || deptWeaving;

    // 2024 Requisition
    await client`
      INSERT INTO requisitions (id, tenant_id, department_id, hiring_manager_employee_id, attributes)
      VALUES (${reqWeavingId}, ${tenantId}, ${deptWeaving}, ${mgrWeaving}, ${JSON.stringify({ requisition_code: "REQ-2024-01", title: "Senior Loom Technician", target_hire_date: "2024-07-31", openings: 2, status: "filled" })}::jsonb)
    `;

    // 2025 Requisition
    await client`
      INSERT INTO requisitions (id, tenant_id, department_id, hiring_manager_employee_id, attributes)
      VALUES (${reqQcId}, ${tenantId}, ${deptProd}, ${mgrQc}, ${JSON.stringify({ requisition_code: "REQ-2025-04", title: "Quality Control Technician", target_hire_date: "2025-09-30", openings: 1, status: "filled" })}::jsonb)
    `;

    // 2026 Active Open Requisition
    await client`
      INSERT INTO requisitions (id, tenant_id, department_id, hiring_manager_employee_id, attributes)
      VALUES (${reqItId}, ${tenantId}, ${deptIt}, ${mgrIt}, ${JSON.stringify({ requisition_code: "REQ-2026-08", title: "Industrial IoT & Automation Specialist", target_hire_date: "2026-10-31", openings: 1, status: "active" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK] requisitions already has data. Fetching IDs.");
    const rows = await client`SELECT id FROM requisitions WHERE tenant_id = ${tenantId} LIMIT 3`;
    reqWeavingId = rows[0]?.id;
    reqQcId = rows[1]?.id || rows[0]?.id;
    reqItId = rows[2]?.id || rows[0]?.id;
  }

  // Job Descriptions
  let jdWeavingId = "";
  if (await hasData(client, "job_descriptions")) {
    console.log("  [CHECK] job_descriptions has data. Fetching existing ID.");
    const rows = await client`SELECT id FROM job_descriptions WHERE tenant_id = ${tenantId} LIMIT 1`;
    jdWeavingId = rows[0]?.id;
  } else {
    console.log("  [SEED] job_descriptions is empty. Inserting job description.");
    jdWeavingId = uuid();
    const jpId = ctx.jobProfileIds["P-OP"] || (await client`SELECT id FROM job_profiles WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
    await client`
      INSERT INTO job_descriptions (id, tenant_id, job_profile_id, skill_ontology_version_id, attributes)
      VALUES (${jdWeavingId}, ${tenantId}, ${jpId}, ${ontoVerId}, ${JSON.stringify({ title: "Master Loom Operator Job Description", min_experience_years: 3, description: "Responsible for high-speed loom configuration and preventative maintenance." })}::jsonb)
    `;
  }

  // Job Postings
  if (!(await hasData(client, "job_postings"))) {
    console.log("  [SEED] job_postings is empty. Inserting postings.");
    await client`
      INSERT INTO job_postings (id, tenant_id, job_description_id, requisition_id, attributes)
      VALUES 
        (${uuid()}, ${tenantId}, ${jdWeavingId}, ${reqWeavingId}, ${JSON.stringify({ channel: "internal_portal", posted_on: "2024-06-01", status: "closed" })}::jsonb),
        (${uuid()}, ${tenantId}, ${jdWeavingId}, ${reqItId}, ${JSON.stringify({ channel: "linkedin_jobs", posted_on: "2026-08-15", status: "live" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK] job_postings already has data. Skipping.");
  }

  // 3. Candidates, Applications & Interview Lifecycle
  let scorecardId = "";
  if (await hasData(client, "scorecards")) {
    const rows = await client`SELECT id FROM scorecards WHERE tenant_id = ${tenantId} LIMIT 1`;
    scorecardId = rows[0]?.id;
  } else {
    scorecardId = uuid();
    await client`
      INSERT INTO scorecards (id, tenant_id, attributes)
      VALUES (${scorecardId}, ${tenantId}, ${JSON.stringify({ name: "Technical Trade & Punctuality Rubric", passing_score: 75, max_score: 100 })}::jsonb)
    `;
  }

  let planId = "";
  if (await hasData(client, "interview_plans")) {
    const rows = await client`SELECT id FROM interview_plans WHERE tenant_id = ${tenantId} LIMIT 1`;
    planId = rows[0]?.id;
  } else {
    planId = uuid();
    await client`
      INSERT INTO interview_plans (id, tenant_id, requisition_id, attributes)
      VALUES (${planId}, ${tenantId}, ${reqItId}, ${JSON.stringify({ plan_name: "Technical Specialist 2-Stage Evaluation", stages: ["Technical Trade Test", "HR Cultural Alignment"] })}::jsonb)
    `;
  }

  if (!(await hasData(client, "candidates"))) {
    console.log("  [SEED] candidates is empty. Inserting candidates and recruitment lifecycle records.");
    const candidateDefs = [
      { name: "Sanjay Tiwari", email: "sanjay.tiwari@example.test", phone: "+91-98111-22334", year: 2024, reqId: reqWeavingId, stage: "converted" },
      { name: "Pooja Nair", email: "pooja.nair@example.test", phone: "+91-98111-55667", year: 2025, reqId: reqQcId, stage: "converted" },
      { name: "Deepak Yadav", email: "deepak.yadav@example.test", phone: "+91-98111-88990", year: 2026, reqId: reqItId, stage: "interview" },
      { name: "Neha Sharma", email: "neha.sharma@example.test", phone: "+91-98111-33445", year: 2026, reqId: reqItId, stage: "screening" }
    ];

    const handbookDocId = ctx.documentIds["DOC-HANDBOOK-24"] || (await client`SELECT id FROM documents WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
    const loomSkillId = ctx.skillIds["SK-LOOM-01"] || (await client`SELECT id FROM skills WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
    const posWvoId = ctx.positionIds["POS-WVO"] || (await client`SELECT id FROM positions WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
    const memEvaluator = ctx.membershipByCode["MK-104"] || (await client`SELECT id FROM memberships WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;

    for (const c of candidateDefs) {
      const candId = uuid();
      await client`
        INSERT INTO candidates (id, tenant_id, attributes)
        VALUES (${candId}, ${tenantId}, ${JSON.stringify({ full_name: c.name, email: c.email, phone: c.phone, source: "employee_referral" })}::jsonb)
      `;

      if (handbookDocId && !(await hasData(client, "candidate_documents"))) {
        await client`
          INSERT INTO candidate_documents (id, tenant_id, candidate_id, document_id, attributes)
          VALUES (${uuid()}, ${tenantId}, ${candId}, ${handbookDocId}, ${JSON.stringify({ doc_type: "resume", file_name: `${c.name.toLowerCase().replace(/\s+/g, "_")}_resume.pdf` })}::jsonb)
        `;
      }

      await client`
        INSERT INTO candidate_consents (id, tenant_id, candidate_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${candId}, ${JSON.stringify({ consent_type: "data_privacy_consent", consented_at: `${c.year}-04-10T10:00:00Z` })}::jsonb)
      `;

      if (loomSkillId) {
        await client`
          INSERT INTO candidate_skills (id, tenant_id, candidate_id, skill_id, skill_ontology_version_id, attributes)
          VALUES (${uuid()}, ${tenantId}, ${candId}, ${loomSkillId}, ${ontoVerId}, ${JSON.stringify({ proficiency_rating: 4, years_experience: 5 })}::jsonb)
        `;
      }

      await client`
        INSERT INTO background_checks (id, tenant_id, candidate_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${candId}, ${JSON.stringify({ provider: "AuthBridge Background Verification", status: "cleared", completed_on: `${c.year}-05-01` })}::jsonb)
      `;

      const appId = uuid();
      await client`
        INSERT INTO applications (id, tenant_id, candidate_id, requisition_id, attributes)
        VALUES (${appId}, ${tenantId}, ${candId}, ${c.reqId}, ${JSON.stringify({ applied_on: `${c.year}-04-05`, stage: c.stage, rating: 4.5 })}::jsonb)
      `;

      await client`
        INSERT INTO application_stage_history (id, tenant_id, application_id, attributes)
        VALUES 
          (${uuid()}, ${tenantId}, ${appId}, ${JSON.stringify({ from: null, to: "applied", transition_date: `${c.year}-04-05` })}::jsonb),
          (${uuid()}, ${tenantId}, ${appId}, ${JSON.stringify({ from: "applied", to: c.stage, transition_date: `${c.year}-04-20` })}::jsonb)
      `;

      const sessId = uuid();
      await client`
        INSERT INTO interview_sessions (id, tenant_id, application_id, attributes)
        VALUES (${sessId}, ${tenantId}, ${appId}, ${JSON.stringify({ round_name: "Technical Practical Assessment", scheduled_at: `${c.year}-04-15T11:00:00Z`, mode: "in_person" })}::jsonb)
      `;

      const panelMemId = uuid();
      await client`
        INSERT INTO interview_panel_members (id, tenant_id, interview_session_id, membership_id, attributes)
        VALUES (${panelMemId}, ${tenantId}, ${sessId}, ${memEvaluator}, ${JSON.stringify({ role: "lead_evaluator" })}::jsonb)
      `;

      await client`
        INSERT INTO interview_scores (id, tenant_id, interview_session_id, panel_member_id, scorecard_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${sessId}, ${panelMemId}, ${scorecardId}, ${JSON.stringify({ score: 88, feedback: "Demonstrates strong understanding of loom tension and speed controls.", recommended: true })}::jsonb)
      `;

      if (c.stage === "converted" && posWvoId) {
        const offerId = uuid();
        await client`
          INSERT INTO offers (id, tenant_id, application_id, position_id, attributes)
          VALUES (${offerId}, ${tenantId}, ${appId}, ${posWvoId}, ${JSON.stringify({ ctc_offered_minor: 3800000, offered_on: `${c.year}-04-25`, accepted: true })}::jsonb)
        `;

        const hiredEmp = c.year === 2024 ? ctx.employeeByCode["MK-107"] : ctx.employeeByCode["MK-111"];
        if (hiredEmp) {
          const personId = hiredEmp.personId || (await client`SELECT person_id FROM employees WHERE id = ${hiredEmp.employeeId}`)[0]?.person_id;
          await client`
            INSERT INTO candidate_employee_links (
              id, tenant_id, candidate_id, application_id, offer_id, 
              employee_id, person_id, attributes
            )
            VALUES (
              ${uuid()}, ${tenantId}, ${candId}, ${appId}, ${offerId},
              ${hiredEmp.employeeId}, ${personId},
              ${JSON.stringify({ converted_on: hiredEmp.joiningDate })}::jsonb
            )
          `;
        }
      }
    }
  } else {
    console.log("  [CHECK] candidates already has data. Skipping.");
  }

  // Referrals & Referral Awards
  if (!(await hasData(client, "referrals"))) {
    console.log("  [SEED] referrals is empty. Inserting referral.");
    const refId = uuid();
    const referrerId = ctx.employeeByCode["MK-104"]?.employeeId || (await client`SELECT id FROM employees WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
    const candRow = (await client`SELECT id FROM candidates WHERE tenant_id = ${tenantId} LIMIT 1`)[0];
    if (referrerId && candRow) {
      await client`
        INSERT INTO referrals (id, tenant_id, referrer_employee_id, candidate_id, attributes)
        VALUES (${refId}, ${tenantId}, ${referrerId}, ${candRow.id}, ${JSON.stringify({ referral_bonus_eligible: true, referred_on: "2025-03-01" })}::jsonb)
      `;
      if (!(await hasData(client, "referral_awards"))) {
        await client`
          INSERT INTO referral_awards (id, tenant_id, referral_id, attributes)
          VALUES (${uuid()}, ${tenantId}, ${refId}, ${JSON.stringify({ award_amount_minor: 1500000, paid_in_payroll_period: "2025-06", status: "paid" })}::jsonb)
        `;
      }
    }
  } else {
    console.log("  [CHECK] referrals already has data. Skipping.");
  }

  // 4. Onboarding Templates, Instances, Tasks, Buddies & Induction
  let onbTmplId = "";
  if (await hasData(client, "onboarding_templates")) {
    console.log("  [CHECK] onboarding_templates has data. Fetching existing ID.");
    const rows = await client`SELECT id FROM onboarding_templates WHERE tenant_id = ${tenantId} LIMIT 1`;
    onbTmplId = rows[0]?.id;
  } else {
    console.log("  [SEED] onboarding_templates is empty. Inserting template.");
    onbTmplId = uuid();
    await client`
      INSERT INTO onboarding_templates (id, tenant_id, attributes)
      VALUES (${onbTmplId}, ${tenantId}, ${JSON.stringify({ template_name: "Textile Complex Operations Onboarding", duration_days: 14 })}::jsonb)
    `;
  }

  if (!(await hasData(client, "onboarding_instances"))) {
    console.log("  [SEED] onboarding_instances is empty. Inserting onboarding runs.");
    for (const empCode of ["MK-107", "MK-111", "MK-115"]) {
      const emp = ctx.employeeByCode[empCode];
      if (!emp || !emp.employeeId) continue;
      const employmentId = (emp.employmentId && emp.employmentId !== "") 
        ? emp.employmentId 
        : (await client`SELECT id FROM employments WHERE tenant_id = ${tenantId} AND employee_id = ${emp.employeeId} LIMIT 1`)[0]?.id;
      if (!employmentId || employmentId === "" || !onbTmplId || onbTmplId === "") continue;
      const onbInstId = uuid();
      await client`
        INSERT INTO onboarding_instances (id, tenant_id, employee_id, employment_id, onboarding_template_id, attributes)
        VALUES (${onbInstId}, ${tenantId}, ${emp.employeeId}, ${employmentId}, ${onbTmplId}, ${JSON.stringify({ status: "completed", start_date: emp.joiningDate })}::jsonb)
      `;

      if (!(await hasData(client, "onboarding_tasks"))) {
        const taskTitles = ["Submit statutory KYC and PF form", "Collect safety helmet, goggles and safety shoes", "Complete Loom Machine Safety Walkthrough", "Setup Biometric Access Profile"];
        for (const title of taskTitles) {
          await client`
            INSERT INTO onboarding_tasks (id, tenant_id, onboarding_instance_id, attributes)
            VALUES (${uuid()}, ${tenantId}, ${onbInstId}, ${JSON.stringify({ task_name: title, completed: true, completed_at: emp.joiningDate })}::jsonb)
          `;
        }
      }

      if (!(await hasData(client, "buddy_assignments"))) {
        const buddyId = ctx.employeeByCode["MK-104"]?.employeeId || emp.employeeId;
        if (buddyId && buddyId !== "") {
          await client`
            INSERT INTO buddy_assignments (id, tenant_id, onboarding_instance_id, buddy_employee_id, attributes)
            VALUES (${uuid()}, ${tenantId}, ${onbInstId}, ${buddyId}, ${JSON.stringify({ assigned_on: emp.joiningDate, notes: "Supervisor assigned as plant floor onboarding buddy" })}::jsonb)
          `;
        }
      }
    }
  } else {
    console.log("  [CHECK] onboarding_instances already has data. Skipping.");
  }

  // Induction Programs & Attendance
  let inductId = "";
  if (await hasData(client, "induction_programs")) {
    const rows = await client`SELECT id FROM induction_programs WHERE tenant_id = ${tenantId} LIMIT 1`;
    inductId = rows[0]?.id;
  } else {
    inductId = uuid();
    await client`
      INSERT INTO induction_programs (id, tenant_id, attributes)
      VALUES (${inductId}, ${tenantId}, ${JSON.stringify({ title: "Plant North Safety & Cultural Induction 2024-2026", venue: "Plant Auditorium", duration_hours: 6 })}::jsonb)
    `;
  }

  if (!(await hasData(client, "induction_attendance"))) {
    console.log("  [SEED] induction_attendance is empty. Inserting records.");
    for (const empCode of ["MK-107", "MK-111", "MK-115", "MK-116"]) {
      const emp = ctx.employeeByCode[empCode];
      if (!emp || !emp.employeeId || emp.employeeId === "" || !inductId || inductId === "") continue;
      await client`
        INSERT INTO induction_attendance (id, tenant_id, induction_program_id, employee_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${inductId}, ${emp.employeeId}, ${JSON.stringify({ attended_on: emp.joiningDate, status: "attended", score_percentage: 95 })}::jsonb)
      `;
    }
  } else {
    console.log("  [CHECK] induction_attendance already has data. Skipping.");
  }

  console.log("✓ Domain 06 seeded successfully.");
}
