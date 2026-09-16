import { SeedContext, uuid, timestampStr, dateStr, hasData } from "./types";

export async function seedDomain03(ctx: SeedContext) {
  const { client, tenantId } = ctx;
  console.log("--> Seeding Domain 03: Workflows, Steps, Tasks & Notifications...");

  // 1. Workflow Definitions & Versions
  if (!(await hasData(client, "workflow_definitions"))) {
    console.log("  [SEED] workflow_definitions is empty. Inserting definitions.");
    const wfDefs = [
      { code: "WF-LEAVE-APPROVAL", name: "Employee Leave Approval Workflow", subject: "leave_request" },
      { code: "WF-ADVANCE-APPROVAL", name: "Salary Advance Approval", subject: "salary_advance" },
      { code: "WF-ONBOARDING", name: "New Hire Onboarding Pipeline", subject: "onboarding_instance" }
    ];

    for (const def of wfDefs) {
      const defId = uuid();
      const verId = uuid();
      await client`
        INSERT INTO workflow_definitions (id, tenant_id, code, name, subject_type, status)
        VALUES (${defId}, ${tenantId}, ${def.code}, ${def.name}, ${def.subject}, 'active')
      `;
      ctx.workflowDefIds[def.code] = defId;

      await client`
        INSERT INTO workflow_versions (id, tenant_id, workflow_definition_id, version, definition)
        VALUES (${verId}, ${tenantId}, ${defId}, 1, ${JSON.stringify({ version_number: 1, is_active: true })}::jsonb)
      `;
      ctx.workflowVersionIds[def.code] = verId;

      // Steps
      const step1Id = uuid();
      const step2Id = uuid();
      const step3Id = uuid();

      await client`
        INSERT INTO workflow_steps (id, tenant_id, workflow_version_id, step_key, name, assignee_rule)
        VALUES 
          (${step1Id}, ${tenantId}, ${verId}, 'initiate', 'Submission Initiated', ${JSON.stringify({ order: 1 })}::jsonb),
          (${step2Id}, ${tenantId}, ${verId}, 'manager_review', 'Manager Review', ${JSON.stringify({ order: 2 })}::jsonb),
          (${step3Id}, ${tenantId}, ${verId}, 'final_approved', 'Approved & Closed', ${JSON.stringify({ order: 3 })}::jsonb)
      `;
      ctx.workflowStepIds[`${def.code}_S1`] = step1Id;
      ctx.workflowStepIds[`${def.code}_S2`] = step2Id;
      ctx.workflowStepIds[`${def.code}_S3`] = step3Id;

      // Transitions
      await client`
        INSERT INTO workflow_transitions (id, tenant_id, workflow_version_id, from_step_id, to_step_id, event, condition, priority)
        VALUES 
          (${uuid()}, ${tenantId}, ${verId}, ${step1Id}, ${step2Id}, 'SUBMIT', ${JSON.stringify({ guard: "has_balance" })}::jsonb, 100),
          (${uuid()}, ${tenantId}, ${verId}, ${step2Id}, ${step3Id}, 'APPROVE', ${JSON.stringify({ guard: "is_manager" })}::jsonb, 100)
      `;

      // Workflow Instances across 2024, 2025, 2026
      for (const [year, status] of [[2024, "completed"], [2025, "completed"], [2026, "in_progress"]] as Array<[number, string]>) {
        const instId = uuid();
        const stepInstId = uuid();
        await client`
          INSERT INTO workflow_instances (id, tenant_id, workflow_version_id, attributes)
          VALUES (${instId}, ${tenantId}, ${verId}, ${JSON.stringify({ status, started_at: timestampStr(year, 6, 1), reference_id: `REF-${year}-${def.code}` })}::jsonb)
        `;

        await client`
          INSERT INTO step_instances (id, tenant_id, workflow_instance_id, workflow_step_id, attributes)
          VALUES (${stepInstId}, ${tenantId}, ${instId}, ${step2Id}, ${JSON.stringify({ status: status === "completed" ? "approved" : "pending" })}::jsonb)
        `;

        const taskAssignId = uuid();
        await client`
          INSERT INTO task_assignments (id, tenant_id, step_instance_id, attributes)
          VALUES (${taskAssignId}, ${tenantId}, ${stepInstId}, ${JSON.stringify({ assigned_to_membership_id: ctx.membershipByCode["MK-102"], due_date: dateStr(year, 6, 5) })}::jsonb)
        `;

        await client`
          INSERT INTO approvals (id, tenant_id, step_instance_id, decided_by_membership_id, task_assignment_id, attributes)
          VALUES (${uuid()}, ${tenantId}, ${stepInstId}, ${ctx.membershipByCode["MK-102"]}, ${taskAssignId}, ${JSON.stringify({ decision: status === "completed" ? "approved" : "pending_review", decided_at: timestampStr(year, 6, 4) })}::jsonb)
        `;

        await client`
          INSERT INTO workflow_activity (id, tenant_id, workflow_instance_id, attributes)
          VALUES (${uuid()}, ${tenantId}, ${instId}, ${JSON.stringify({ action: "step_transition", from: "initiate", to: "manager_review", timestamp: timestampStr(year, 6, 2) })}::jsonb)
        `;
      }
    }
  } else {
    console.log("  [CHECK] workflow_definitions already has data. Skipping.");
  }

  // 2. Notification Templates, Preferences, Notifications & Deliveries
  if (!(await hasData(client, "notification_templates"))) {
    console.log("  [SEED] notification_templates is empty. Inserting template.");
    const tmplId = uuid();
    await client`
      INSERT INTO notification_templates (id, tenant_id, attributes)
      VALUES (${tmplId}, ${tenantId}, ${JSON.stringify({ code: "TMPL_LEAVE_DECISION", name: "Leave Request Decision", channel: "in_app" })}::jsonb)
    `;
  } else {
    console.log("  [CHECK] notification_templates already has data. Skipping.");
  }

  if (!(await hasData(client, "notifications"))) {
    console.log("  [SEED] notifications is empty. Inserting notifications & deliveries.");
    for (const empCode of ["MK-102", "MK-104", "MK-107", "MK-111", "MK-115"]) {
      const memId = ctx.membershipByCode[empCode];
      if (!memId) continue;

      if (!(await hasData(client, "notification_preferences"))) {
        await client`
          INSERT INTO notification_preferences (id, tenant_id, membership_id, attributes)
          VALUES (${uuid()}, ${tenantId}, ${memId}, ${JSON.stringify({ email_digest: true, in_app_alerts: true, sms_critical: false })}::jsonb)
        `;
      }

      for (const [year, title, body] of [
        [2024, "FY 2024-25 Goal Cycle Published", "Annual performance objectives are now ready for your review."],
        [2025, "Salary Increment Statement Available", "Your FY25 increment letter has been generated."],
        [2026, "Biometric Regularization Reminder", "Please regularize attendance before the payroll lock date."]
      ] as Array<[number, string, string]>) {
        const notifId = uuid();
        await client`
          INSERT INTO notifications (id, tenant_id, membership_id, attributes)
          VALUES (${notifId}, ${tenantId}, ${memId}, ${JSON.stringify({ title, body, event_type: "hr.announcement", read: year < 2026, sent_at: timestampStr(year, 8, 1) })}::jsonb)
        `;

        if (!(await hasData(client, "notification_deliveries"))) {
          await client`
            INSERT INTO notification_deliveries (id, tenant_id, notification_id, attributes)
            VALUES (${uuid()}, ${tenantId}, ${notifId}, ${JSON.stringify({ channel: "in_app", status: "delivered", delivered_at: timestampStr(year, 8, 1, 9, 5) })}::jsonb)
          `;
        }
      }
    }
  } else {
    console.log("  [CHECK] notifications already has data. Skipping.");
  }

  console.log("✓ Domain 03 seeded successfully.");
}
