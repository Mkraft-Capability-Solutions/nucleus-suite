import { SeedContext, uuid, hasData } from "./types";

export async function seedDomain07(ctx: SeedContext) {
  const { client, tenantId } = ctx;
  console.log("--> Seeding Domain 07: Performance, Goals, Skills & Learning...");

  const cycles = [
    { year: 2024, name: "FY 2024-25 Annual Goals", status: "closed", start: "2024-04-01", end: "2025-03-31" },
    { year: 2025, name: "FY 2025-26 Annual Goals", status: "closed", start: "2025-04-01", end: "2026-03-31" },
    { year: 2026, name: "FY 2026-27 Operational Objectives", status: "active", start: "2026-04-01", end: "2027-03-31" }
  ];

  // 1. Goal Cycles, Objectives & Key Results (2024, 2025, 2026)
  if (await hasData(client, "goal_cycles")) {
    console.log("  [CHECK] goal_cycles has data. Fetching IDs.");
    const rows = await client`SELECT id FROM goal_cycles WHERE tenant_id = ${tenantId} ORDER BY created_at ASC`;
    if (rows[0]) ctx.goalCycle2024Id = rows[0].id;
    if (rows[1]) ctx.goalCycle2025Id = rows[1].id;
    if (rows[2]) ctx.goalCycle2026Id = rows[2].id;
  } else {
    console.log("  [SEED] goal_cycles is empty. Inserting multi-year cycles.");
    for (const c of cycles) {
      const cycleId = uuid();
      await client`
        INSERT INTO goal_cycles (id, tenant_id, attributes)
        VALUES (${cycleId}, ${tenantId}, ${JSON.stringify({ name: c.name, start_date: c.start, end_date: c.end, status: c.status })}::jsonb)
      `;
      if (c.year === 2024) ctx.goalCycle2024Id = cycleId;
      if (c.year === 2025) ctx.goalCycle2025Id = cycleId;
      if (c.year === 2026) ctx.goalCycle2026Id = cycleId;

      if (!(await hasData(client, "objectives"))) {
        const objCorpId = uuid();
        const objDeptId = uuid();

        await client`
          INSERT INTO objectives (id, tenant_id, goal_cycle_id, attributes)
          VALUES 
            (${objCorpId}, ${tenantId}, ${cycleId}, ${JSON.stringify({ title: `Achieve 98% On-Time Loom Output (${c.year})`, level: "company", progress_percentage: c.year < 2026 ? 100 : 72 })}::jsonb),
            (${objDeptId}, ${tenantId}, ${cycleId}, ${JSON.stringify({ title: `Reduce Yarn Waste Below 1.5% (${c.year})`, level: "department", progress_percentage: c.year < 2026 ? 95 : 68 })}::jsonb)
        `;

        if (!(await hasData(client, "key_results"))) {
          await client`
            INSERT INTO key_results (id, tenant_id, objective_id, attributes)
            VALUES 
              (${uuid()}, ${tenantId}, ${objCorpId}, ${JSON.stringify({ metric: "Fabric meter output", target_value: 5000000, current_value: c.year < 2026 ? 5100000 : 3600000, unit: "meters" })}::jsonb),
              (${uuid()}, ${tenantId}, ${objDeptId}, ${JSON.stringify({ metric: "Waste percentage", target_value: 1.5, current_value: c.year < 2026 ? 1.4 : 1.7, unit: "percent" })}::jsonb)
          `;
        }

        if (!(await hasData(client, "goal_links"))) {
          await client`
            INSERT INTO goal_links (id, tenant_id, parent_objective_id, child_objective_id, attributes)
            VALUES (${uuid()}, ${tenantId}, ${objCorpId}, ${objDeptId}, ${JSON.stringify({ alignment_type: "contributes_to", weight: 0.5 })}::jsonb)
          `;
        }
      }
    }
  }

  // 2. Review Templates, Review Cycles & Appraisals
  let tmplId = "";
  if (await hasData(client, "review_templates")) {
    console.log("  [CHECK] review_templates has data. Fetching existing ID.");
    const rows = await client`SELECT id FROM review_templates WHERE tenant_id = ${tenantId} LIMIT 1`;
    tmplId = rows[0]?.id;
  } else {
    console.log("  [SEED] review_templates is empty. Inserting template.");
    tmplId = uuid();
    await client`
      INSERT INTO review_templates (id, tenant_id, attributes)
      VALUES (${tmplId}, ${tenantId}, ${JSON.stringify({ name: "Standard 360 Performance & Values Appraisal", rating_scale_max: 5, sections: ["Technical Deliverables", "Punctuality & Shift Discipline", "Safety Compliance"] })}::jsonb)
    `;
  }
  ctx.reviewTemplateId = tmplId;

  if (await hasData(client, "review_cycles")) {
    console.log("  [CHECK] review_cycles has data. Fetching existing cycles.");
    const rows = await client`SELECT id FROM review_cycles WHERE tenant_id = ${tenantId} ORDER BY created_at ASC`;
    if (rows[0]) ctx.reviewCycle2024Id = rows[0].id;
    if (rows[1]) ctx.reviewCycle2025Id = rows[1].id;
    if (rows[2]) ctx.reviewCycle2026Id = rows[2].id;
  } else {
    console.log("  [SEED] review_cycles is empty. Inserting multi-year appraisal cycles.");
    for (const c of cycles) {
      const revCycleId = uuid();
      await client`
        INSERT INTO review_cycles (id, tenant_id, attributes)
        VALUES (${revCycleId}, ${tenantId}, ${JSON.stringify({ name: `${c.name} Appraisal Cycle`, start_date: c.start, end_date: c.end, status: c.status })}::jsonb)
      `;
      if (c.year === 2024) ctx.reviewCycle2024Id = revCycleId;
      if (c.year === 2025) ctx.reviewCycle2025Id = revCycleId;
      if (c.year === 2026) ctx.reviewCycle2026Id = revCycleId;

      const calibId = uuid();
      const facilitatorMem = ctx.membershipByCode["MK-102"] || (await client`SELECT id FROM memberships WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
      if (!(await hasData(client, "calibration_sessions")) && facilitatorMem) {
        await client`
          INSERT INTO calibration_sessions (id, tenant_id, facilitator_membership_id, review_cycle_id, attributes)
          VALUES (${calibId}, ${tenantId}, ${facilitatorMem}, ${revCycleId}, ${JSON.stringify({ session_name: `Plant Calibration Review ${c.year}`, status: "completed", scheduled_on: `${c.year}-12-10` })}::jsonb)
        `;
      }

      if (!(await hasData(client, "review_participants"))) {
        for (const emp of ctx.roster.slice(0, 6)) {
          if (emp.joiningDate > c.end) continue;

          const partId = uuid();
          await client`
            INSERT INTO review_participants (id, tenant_id, employee_id, review_cycle_id, review_template_id, attributes)
            VALUES (${partId}, ${tenantId}, ${emp.employeeId}, ${revCycleId}, ${tmplId}, ${JSON.stringify({ status: c.year < 2026 ? "completed" : "in_progress" })}::jsonb)
          `;

          const rater = emp.managerCode ? ctx.employeeByCode[emp.managerCode] : ctx.employeeByCode["MK-101"] || emp;
          if (!(await hasData(client, "review_responses"))) {
            await client`
              INSERT INTO review_responses (id, tenant_id, review_participant_id, rater_employee_id, attributes)
              VALUES (${uuid()}, ${tenantId}, ${partId}, ${rater.employeeId}, ${JSON.stringify({ role: "manager", overall_score: 4.5, comments: `Consistently meets high production quality standards during ${c.year}.` })}::jsonb)
            `;
          }

          const summaryId = uuid();
          if (!(await hasData(client, "review_summaries"))) {
            await client`
              INSERT INTO review_summaries (id, tenant_id, review_participant_id, attributes)
              VALUES (${summaryId}, ${tenantId}, ${partId}, ${JSON.stringify({ final_score: 4.5, rating_label: "Exceeds Expectations", calibrated: true })}::jsonb)
            `;

            if (!(await hasData(client, "talent_placements"))) {
              await client`
                INSERT INTO talent_placements (id, tenant_id, calibration_session_id, employee_id, review_summary_id, attributes)
                VALUES (${uuid()}, ${tenantId}, ${calibId}, ${emp.employeeId}, ${summaryId}, ${JSON.stringify({ performance_box: "high", potential_box: "high", grid_placement: "Star Performer" })}::jsonb)
              `;
            }
          }
        }
      }
    }
  }

  // 3. Continuous Check-ins & Feedback Requests & Coaching Notes
  if (!(await hasData(client, "checkins"))) {
    console.log("  [SEED] checkins is empty. Inserting checkins.");
    for (const emp of ctx.roster.slice(0, 5)) {
      await client`
        INSERT INTO checkins (id, tenant_id, employee_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${emp.employeeId}, ${JSON.stringify({ scheduled_date: "2026-08-15", status: "completed", discussion_topics: ["Shift efficiency", "Preventative maintenance cadence"], mood: "positive" })}::jsonb)
      `;

      const feedReqId = uuid();
      const hrEmpId = ctx.employeeByCode["MK-102"]?.employeeId || emp.employeeId;
      const supEmpId = ctx.employeeByCode["MK-104"]?.employeeId || emp.employeeId;
      const leadEmpId = ctx.employeeByCode["MK-101"]?.employeeId || emp.employeeId;

      if (!(await hasData(client, "feedback_requests"))) {
        await client`
          INSERT INTO feedback_requests (id, tenant_id, requester_employee_id, subject_employee_id, attributes)
          VALUES (${feedReqId}, ${tenantId}, ${hrEmpId}, ${emp.employeeId}, ${JSON.stringify({ cycle_tag: "Q2-2026", prompt: "Evaluate cross-functional support and safety habits." })}::jsonb)
        `;

        if (!(await hasData(client, "feedback_entries"))) {
          await client`
            INSERT INTO feedback_entries (id, tenant_id, author_employee_id, subject_employee_id, attributes)
            VALUES (${uuid()}, ${tenantId}, ${supEmpId}, ${emp.employeeId}, ${JSON.stringify({ rating: 5, comments: "Exceptional ownership on night shifts; zero safety incidents.", feedback_request_id: feedReqId })}::jsonb)
          `;
        }
      }

      if (!(await hasData(client, "manager_coaching_notes"))) {
        await client`
          INSERT INTO manager_coaching_notes (id, tenant_id, manager_employee_id, subject_employee_id, attributes)
          VALUES (${uuid()}, ${tenantId}, ${leadEmpId}, ${emp.employeeId}, ${JSON.stringify({ note_date: "2026-07-20", key_takeaway: "Recommended for advanced automation certification program." })}::jsonb)
        `;
      }
    }
  } else {
    console.log("  [CHECK] checkins already has data. Skipping.");
  }

  // 4. Succession Plans & Succession Candidates
  if (!(await hasData(client, "succession_plans"))) {
    console.log("  [SEED] succession_plans is empty. Inserting succession bench.");
    const succPlanId = uuid();
    const posWvs = ctx.positionIds["POS-WVS"] || (await client`SELECT id FROM positions WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
    if (posWvs) {
      await client`
        INSERT INTO succession_plans (id, tenant_id, position_id, attributes)
        VALUES (${succPlanId}, ${tenantId}, ${posWvs}, ${JSON.stringify({ title: "Weaving Supervisor Succession Bench", readiness_target_months: 12 })}::jsonb)
      `;

      if (!(await hasData(client, "succession_candidates"))) {
        const candidateEmpId = ctx.employeeByCode["MK-107"]?.employeeId || (await client`SELECT id FROM employees WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
        if (candidateEmpId) {
          await client`
            INSERT INTO succession_candidates (id, tenant_id, succession_plan_id, employee_id, attributes)
            VALUES (${uuid()}, ${tenantId}, ${succPlanId}, ${candidateEmpId}, ${JSON.stringify({ readiness: "ready_now", ranking: 1, notes: "Master technician with extensive team leadership experience." })}::jsonb)
          `;
        }
      }
    }
  } else {
    console.log("  [CHECK] succession_plans already has data. Skipping.");
  }

  // 5. Skills Ontology Nodes, Aliases, Relationships, Requirements & Evidence
  const skillLoom = ctx.skillIds["SK-LOOM-01"] || (await client`SELECT id FROM skills WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
  const skillDye = ctx.skillIds["SK-DYE-01"] || skillLoom;
  const ontoVer = ctx.skillOntologyVersionId || (await client`SELECT id FROM skill_ontology_versions WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;

  if (skillLoom && ontoVer) {
    if (!(await hasData(client, "skill_ontology_nodes"))) {
      await client`
        INSERT INTO skill_ontology_nodes (id, tenant_id, skill_id, skill_ontology_version_id, attributes)
        VALUES 
          (${uuid()}, ${tenantId}, ${skillLoom}, ${ontoVer}, ${JSON.stringify({ category_node: "Manufacturing / Weaving" })}::jsonb),
          (${uuid()}, ${tenantId}, ${skillDye}, ${ontoVer}, ${JSON.stringify({ category_node: "Processing / Chemistry" })}::jsonb)
      `;
    }

    if (!(await hasData(client, "skill_aliases"))) {
      await client`
        INSERT INTO skill_aliases (id, tenant_id, skill_id, skill_ontology_version_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${skillLoom}, ${ontoVer}, ${JSON.stringify({ alias: "Shuttleless Loom Operation" })}::jsonb)
      `;
    }

    if (!(await hasData(client, "skill_relationships"))) {
      await client`
        INSERT INTO skill_relationships (id, tenant_id, from_skill_id, to_skill_id, skill_ontology_version_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${skillLoom}, ${skillDye}, ${ontoVer}, ${JSON.stringify({ relationship_type: "adjacent_trade" })}::jsonb)
      `;
    }

    const jdFirst = (await client`SELECT id FROM job_descriptions WHERE tenant_id = ${tenantId} LIMIT 1`)[0];
    if (jdFirst && !(await hasData(client, "job_skill_requirements"))) {
      await client`
        INSERT INTO job_skill_requirements (id, tenant_id, job_description_id, skill_id, skill_ontology_version_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${jdFirst.id}, ${skillLoom}, ${ontoVer}, ${JSON.stringify({ minimum_proficiency: "L3", mandatory: true })}::jsonb)
      `;
    }

    const jpOp = ctx.jobProfileIds["P-OP"] || (await client`SELECT id FROM job_profiles WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
    if (jpOp && !(await hasData(client, "role_skill_requirements"))) {
      await client`
        INSERT INTO role_skill_requirements (id, tenant_id, job_profile_id, skill_id, skill_ontology_version_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${jpOp}, ${skillLoom}, ${ontoVer}, ${JSON.stringify({ required_level: "proficient" })}::jsonb)
      `;
    }

    if (!(await hasData(client, "employee_skills"))) {
      for (const emp of ctx.roster.slice(0, 8)) {
        const empSkillId = uuid();
        await client`
          INSERT INTO employee_skills (id, tenant_id, employee_id, skill_id, attributes)
          VALUES (${empSkillId}, ${tenantId}, ${emp.employeeId}, ${skillLoom}, ${JSON.stringify({ proficiency: "L4 - Advanced", verified: true, verified_on: "2025-05-10" })}::jsonb)
        `;

        if (!(await hasData(client, "skill_evidence"))) {
          await client`
            INSERT INTO skill_evidence (id, tenant_id, attributes)
            VALUES (${uuid()}, ${tenantId}, ${JSON.stringify({ employee_skill_id: empSkillId, evidence_type: "practical_demonstration", assessor: "Ramesh Nair", verified_date: "2025-05-10" })}::jsonb)
          `;
        }
      }
    }
  }

  // 6. Certifications & Employee Certifications
  let certId = "";
  if (await hasData(client, "certifications")) {
    const rows = await client`SELECT id FROM certifications WHERE tenant_id = ${tenantId} LIMIT 1`;
    certId = rows[0]?.id;
  } else {
    certId = uuid();
    await client`
      INSERT INTO certifications (id, tenant_id, attributes)
      VALUES (${certId}, ${tenantId}, ${JSON.stringify({ code: "ISO-45001", name: "Occupational Health & Safety Specialist", issuing_authority: "Bureau Veritas", validity_years: 3 })}::jsonb)
    `;
  }

  if (certId && !(await hasData(client, "employee_certifications"))) {
    console.log("  [SEED] employee_certifications is empty. Inserting certifications.");
    for (const empCode of ["MK-104", "MK-106", "MK-107"]) {
      const emp = ctx.employeeByCode[empCode];
      if (!emp) continue;
      await client`
        INSERT INTO employee_certifications (id, tenant_id, employee_id, certification_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${emp.employeeId}, ${certId}, ${JSON.stringify({ certificate_number: `BV-IND-${empCode}-2024`, issue_date: "2024-09-15", expiry_date: "2027-09-14", status: "active" })}::jsonb)
      `;
    }
  }

  // 7. Courses, Course Versions, Learning Paths, Items, Enrollments & Completions
  let courseSafetyId = "";
  let coursePoshId = "";
  if (await hasData(client, "courses")) {
    const rows = await client`SELECT id FROM courses WHERE tenant_id = ${tenantId} LIMIT 2`;
    courseSafetyId = rows[0]?.id;
    coursePoshId = rows[1]?.id || rows[0]?.id;
  } else {
    console.log("  [SEED] courses is empty. Inserting training courses.");
    courseSafetyId = uuid();
    coursePoshId = uuid();
    await client`
      INSERT INTO courses (id, tenant_id, attributes)
      VALUES 
        (${courseSafetyId}, ${tenantId}, ${JSON.stringify({ code: "CRS-SAFE-01", title: "Industrial Loom Lockout-Tagout (LOTO) Procedures", duration_hours: 8, provider: "MKraft Technical Academy" })}::jsonb),
        (${coursePoshId}, ${tenantId}, ${JSON.stringify({ code: "CRS-ETHICS-01", title: "Workplace Respect, POSH & Compliance 2024-2026", duration_hours: 4, provider: "External Legal Counsel" })}::jsonb)
    `;
  }

  let verSafetyId = "";
  let verPoshId = "";
  if (await hasData(client, "course_versions")) {
    const rows = await client`SELECT id FROM course_versions WHERE tenant_id = ${tenantId} LIMIT 2`;
    verSafetyId = rows[0]?.id;
    verPoshId = rows[1]?.id || rows[0]?.id;
  } else {
    verSafetyId = uuid();
    verPoshId = uuid();
    await client`
      INSERT INTO course_versions (id, tenant_id, course_id, attributes)
      VALUES 
        (${verSafetyId}, ${tenantId}, ${courseSafetyId}, ${JSON.stringify({ version: 1, released_on: "2024-04-01" })}::jsonb),
        (${verPoshId}, ${tenantId}, ${coursePoshId}, ${JSON.stringify({ version: 2, released_on: "2025-01-01" })}::jsonb)
    `;
  }

  let pathId = "";
  if (await hasData(client, "learning_paths")) {
    const rows = await client`SELECT id FROM learning_paths WHERE tenant_id = ${tenantId} LIMIT 1`;
    pathId = rows[0]?.id;
  } else {
    pathId = uuid();
    await client`
      INSERT INTO learning_paths (id, tenant_id, attributes)
      VALUES (${pathId}, ${tenantId}, ${JSON.stringify({ code: "LP-PLANT-MANDATORY", title: "Mandatory Safety & Compliance Track", required_for_all: true })}::jsonb)
    `;
  }

  if (!(await hasData(client, "learning_path_items"))) {
    await client`
      INSERT INTO learning_path_items (id, tenant_id, learning_path_id, course_version_id, attributes)
      VALUES 
        (${uuid()}, ${tenantId}, ${pathId}, ${verSafetyId}, ${JSON.stringify({ sequence_order: 1 })}::jsonb),
        (${uuid()}, ${tenantId}, ${pathId}, ${verPoshId}, ${JSON.stringify({ sequence_order: 2 })}::jsonb)
    `;
  }

  if (!(await hasData(client, "enrollments"))) {
    console.log("  [SEED] enrollments is empty. Inserting enrollments and completions.");
    for (const emp of ctx.roster) {
      const enrollId = uuid();
      await client`
        INSERT INTO enrollments (id, tenant_id, employee_id, attributes)
        VALUES (${enrollId}, ${tenantId}, ${emp.employeeId}, ${JSON.stringify({ course_id: courseSafetyId, enrolled_on: emp.joiningDate, status: "completed" })}::jsonb)
      `;

      if (!(await hasData(client, "learning_completions"))) {
        await client`
          INSERT INTO learning_completions (id, tenant_id, enrollment_id, employee_id, attributes)
          VALUES (${uuid()}, ${tenantId}, ${enrollId}, ${emp.employeeId}, ${JSON.stringify({ completed_on: emp.joiningDate, score_percentage: 92, certificate_generated: true })}::jsonb)
        `;
      }
    }
  } else {
    console.log("  [CHECK] enrollments already has data. Skipping.");
  }

  // 8. Capability Index Versions, Runs & Component Scores
  let capVerId = "";
  if (await hasData(client, "capability_index_versions")) {
    const rows = await client`SELECT id FROM capability_index_versions WHERE tenant_id = ${tenantId} LIMIT 1`;
    capVerId = rows[0]?.id;
  } else {
    capVerId = uuid();
    await client`
      INSERT INTO capability_index_versions (id, tenant_id, attributes)
      VALUES (${capVerId}, ${tenantId}, ${JSON.stringify({ model_name: "MKraft Technical Capability Index v1", weights: { production_accuracy: 0.4, safety_record: 0.3, attendance_rate: 0.3 } })}::jsonb)
    `;
  }

  if (capVerId && !(await hasData(client, "capability_index_runs"))) {
    console.log("  [SEED] capability_index_runs is empty. Inserting scoring runs.");
    for (const emp of ctx.roster.slice(0, 6)) {
      const runId = uuid();
      await client`
        INSERT INTO capability_index_runs (id, tenant_id, capability_index_version_id, employee_id, attributes)
        VALUES (${runId}, ${tenantId}, ${capVerId}, ${emp.employeeId}, ${JSON.stringify({ computed_on: "2026-08-01", composite_score: 87.5, tier: "High Potential" })}::jsonb)
      `;

      if (!(await hasData(client, "capability_component_scores"))) {
        await client`
          INSERT INTO capability_component_scores (id, tenant_id, capability_index_run_id, attributes)
          VALUES 
            (${uuid()}, ${tenantId}, ${runId}, ${JSON.stringify({ component: "production_accuracy", score: 90 })}::jsonb),
            (${uuid()}, ${tenantId}, ${runId}, ${JSON.stringify({ component: "safety_record", score: 85 })}::jsonb)
        `;
      }
    }
  }

  console.log("✓ Domain 07 seeded successfully.");
}
