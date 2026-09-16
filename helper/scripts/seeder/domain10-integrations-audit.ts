import { SeedContext, uuid, hasData } from "./types";

export async function seedDomain10(ctx: SeedContext) {
  const { client, tenantId } = ctx;
  const legalEntityId = (ctx.legalEntityId && ctx.legalEntityId !== "")
    ? ctx.legalEntityId
    : (await client`SELECT id FROM legal_entities WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;

  const hrMemId = ctx.membershipByCode["MK-102"] || (await client`SELECT m.id FROM memberships m JOIN "user" u ON u.id = m.user_id WHERE m.tenant_id = ${tenantId} AND (u.email = 'hr@brigtenz.tech' OR u.email = 'sunita.verma@mkraft.demo') LIMIT 1`)[0]?.id || (await client`SELECT id FROM memberships WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
  const finMemId = ctx.membershipByCode["MK-103"] || hrMemId;

  const empByCode = async (code: string) => {
    if (ctx.employeeByCode[code]?.employeeId) return ctx.employeeByCode[code].employeeId;
    const r = await client`SELECT id FROM employees WHERE tenant_id = ${tenantId} AND employee_code = ${code} LIMIT 1`;
    if (r[0]?.id) return r[0].id;
    const fallback = await client`SELECT id FROM employees WHERE tenant_id = ${tenantId} LIMIT 1`;
    return fallback[0]?.id || uuid();
  };

  const emp104Id = await empByCode("MK-104");
  const emp106Id = await empByCode("MK-106");
  const emp107Id = await empByCode("MK-107");
  const emp113Id = await empByCode("MK-113");

  const salStructId = ctx.salaryStructureId || (await client`SELECT id FROM salary_structures WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id || uuid();
  const jurId = ctx.jurisdictionId || (await client`SELECT id FROM jurisdictions LIMIT 1`)[0]?.id;
  const statRulePackId = ctx.statutoryRulePackId || (await client`SELECT id FROM statutory_rule_packs LIMIT 1`)[0]?.id;
  const currId = ctx.currencyId || (await client`SELECT id FROM currencies WHERE alpha_code = 'INR' LIMIT 1`)[0]?.id;

  console.log("--> Seeding Domain 10: Integrations, Background Jobs, Audit & Governance...");

  // 1. Integration Catalog & Connections & Secrets & External ID Mappings & Inbound Events
  let catalogId = "";
  if (await hasData(client, "integration_catalog", false)) {
    const rows = await client`SELECT id FROM integration_catalog LIMIT 1`;
    catalogId = rows[0]?.id;
  } else {
    catalogId = uuid();
    await client`
      INSERT INTO integration_catalog (id, attributes)
      VALUES (${catalogId}, ${JSON.stringify({ code: "BIO-ZKTECO", name: "ZKTeco Biometrics Push Protocol" })}::jsonb)
    `;
  }

  let connId = "";
  if (await hasData(client, "integration_connections")) {
    const rows = await client`SELECT id FROM integration_connections WHERE tenant_id = ${tenantId} LIMIT 1`;
    connId = rows[0]?.id;
  } else {
    connId = uuid();
    await client`
      INSERT INTO integration_connections (id, tenant_id, integration_catalog_id, attributes)
      VALUES (${connId}, ${tenantId}, ${catalogId}, ${JSON.stringify({ connection_name: "Plant North Gate Gateway", status: "connected" })}::jsonb)
    `;
  }

  if (!(await hasData(client, "integration_secrets"))) {
    console.log("  [SEED] integration_secrets is empty. Inserting secrets.");
    await client`
      INSERT INTO integration_secrets (id, tenant_id, integration_connection_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${connId}, ${JSON.stringify({ secret_type: "hmac_key", key_version: 1, masked_value: "sec_live_****98a2" })}::jsonb)
    `;
  }

  if (!(await hasData(client, "external_id_mappings"))) {
    console.log("  [SEED] external_id_mappings is empty. Inserting device mappings.");
    await client`
      INSERT INTO external_id_mappings (id, tenant_id, integration_connection_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${connId}, ${JSON.stringify({ internal_id: emp107Id, external_id: "ZK_CARD_1007", entity_type: "employee" })}::jsonb)
    `;
  }

  if (!(await hasData(client, "inbound_events"))) {
    console.log("  [SEED] inbound_events is empty. Inserting event log.");
    await client`
      INSERT INTO inbound_events (id, tenant_id, integration_connection_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${connId}, ${JSON.stringify({ event_type: "biometric_punch_sync", payload_count: 14, received_at: "2026-09-11T08:05:00Z", status: "processed" })}::jsonb)
    `;
  }

  // 2. Webhook Endpoints, Webhook Subscriptions & Webhook Deliveries
  let hookEpId = "";
  if (await hasData(client, "webhook_endpoints")) {
    const rows = await client`SELECT id FROM webhook_endpoints WHERE tenant_id = ${tenantId} LIMIT 1`;
    hookEpId = rows[0]?.id;
  } else {
    hookEpId = uuid();
    await client`
      INSERT INTO webhook_endpoints (id, tenant_id, attributes)
      VALUES (${hookEpId}, ${tenantId}, ${JSON.stringify({ target_url: "https://erp.mkraft.local/api/hrms-events", active: true })}::jsonb)
    `;
  }

  let hookSubId = "";
  if (await hasData(client, "webhook_subscriptions")) {
    const rows = await client`SELECT id FROM webhook_subscriptions WHERE tenant_id = ${tenantId} LIMIT 1`;
    hookSubId = rows[0]?.id;
  } else {
    hookSubId = uuid();
    await client`
      INSERT INTO webhook_subscriptions (id, tenant_id, webhook_endpoint_id, attributes)
      VALUES (${hookSubId}, ${tenantId}, ${hookEpId}, ${JSON.stringify({ event_pattern: "payroll.run.*", format: "json" })}::jsonb)
    `;
  }

  // Transactional outbox & Webhook deliveries
  let outboxId = "";
  if (await hasData(client, "transactional_outbox")) {
    const rows = await client`SELECT id FROM transactional_outbox WHERE tenant_id = ${tenantId} LIMIT 1`;
    outboxId = rows[0]?.id;
  } else {
    outboxId = uuid();
    await client`
      INSERT INTO transactional_outbox (id, tenant_id, event_type, aggregate_type, aggregate_id, payload, status, attempts, published_at)
      VALUES (${outboxId}, ${tenantId}, 'payroll.run.completed', 'payroll_run', ${uuid()}, ${JSON.stringify({ period: "2026-08", total_paid: 120000000 })}::jsonb, 'published', 1, now())
    `;
  }

  if (!(await hasData(client, "webhook_deliveries"))) {
    console.log("  [SEED] webhook_deliveries is empty. Inserting delivery logs.");
    await client`
      INSERT INTO webhook_deliveries (id, tenant_id, webhook_subscription_id, outbox_event_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${hookSubId}, ${outboxId}, ${JSON.stringify({ status_code: 200, response_time_ms: 145, delivered_at: "2026-09-01T10:05:00Z" })}::jsonb)
    `;
  }

  // 3. Scheduled Tasks & Task Attempts
  let taskId = "";
  if (await hasData(client, "scheduled_tasks")) {
    const rows = await client`SELECT id FROM scheduled_tasks WHERE tenant_id = ${tenantId} LIMIT 1`;
    taskId = rows[0]?.id;
  } else {
    taskId = uuid();
    await client`
      INSERT INTO scheduled_tasks (id, tenant_id, task_type, payload, status, attempts, max_attempts, completed_at)
      VALUES (${taskId}, ${tenantId}, 'nightly_attendance_aggregation', ${JSON.stringify({ cutoff_hour: 23 })}::jsonb, 'succeeded', 1, 3, now())
    `;
  }

  if (!(await hasData(client, "task_attempts"))) {
    console.log("  [SEED] task_attempts is empty. Inserting attempts.");
    await client`
      INSERT INTO task_attempts (id, tenant_id, scheduled_task_id, attempt_number, worker_id, started_at, ended_at, outcome)
      VALUES (${uuid()}, ${tenantId}, ${taskId}, 1, 'worker-pod-01', timestamp '2026-09-10 23:00:00', now(), 'succeeded')
    `;
  }

  // 4. File Imports & Import Rows, Export Jobs
  if (!(await hasData(client, "file_imports"))) {
    console.log("  [SEED] file_imports is empty. Inserting import logs.");
    const [docRow] = await client`SELECT id FROM documents WHERE tenant_id = ${tenantId} LIMIT 1`;
    const impId = uuid();
    await client`
      INSERT INTO file_imports (id, tenant_id, document_id, requested_by_membership_id, attributes)
      VALUES (${impId}, ${tenantId}, ${docRow.id}, ${hrMemId}, ${JSON.stringify({ file_name: "legacy_opening_balances_2024.csv", total_rows: 16, processed_rows: 16, status: "completed" })}::jsonb)
    `;

    await client`
      INSERT INTO import_rows (id, tenant_id, file_import_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${impId}, ${JSON.stringify({ row_number: 1, raw_data: { code: "MK-101", cl: 12, sl: 12 }, status: "success" })}::jsonb)
    `;
  }

  if (!(await hasData(client, "export_jobs"))) {
    console.log("  [SEED] export_jobs is empty. Inserting export records.");
    await client`
      INSERT INTO export_jobs (id, tenant_id, requested_by_membership_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${finMemId}, ${JSON.stringify({ report_type: "PF_ANNUAL_REPORT_FY25", format: "xlsx", completed_at: "2025-05-10T11:00:00Z", download_url: "/exports/pf_fy25.xlsx" })}::jsonb)
    `;
  }

  // 5. Idempotency Keys
  if (!(await hasData(client, "idempotency_keys"))) {
    console.log("  [SEED] idempotency_keys is empty. Inserting keys.");
    await client`
      INSERT INTO idempotency_keys (id, tenant_id, operation, idempotency_key, request_hash, expires_at, response_status)
      VALUES (${uuid()}, ${tenantId}, 'payroll_disbursement_batch', 'KEY-DISB-2026-08', 'sha256-req-hash-9988', timestamp '2026-12-31', 200)
    `;
  }

  // 6. Audit Events & Audit Event Changes
  let auditId = "";
  if (await hasData(client, "audit_events")) {
    const rows = await client`SELECT id FROM audit_events WHERE tenant_id = ${tenantId} LIMIT 1`;
    auditId = rows[0]?.id;
  } else {
    auditId = uuid();
    await client`
      INSERT INTO audit_events (id, tenant_id, action, entity_type, entity_id, reason, purpose)
      VALUES (${auditId}, ${tenantId}, 'salary_structure.updated', 'salary_structure', ${salStructId}, 'Annual merit grid revision', 'hr_administration')
    `;
  }

  if (!(await hasData(client, "audit_event_changes"))) {
    console.log("  [SEED] audit_event_changes is empty. Inserting change audit log.");
    await client`
      INSERT INTO audit_event_changes (id, tenant_id, audit_event_id, field_path, classification, old_value, new_value)
      VALUES (${uuid()}, ${tenantId}, ${auditId}, 'basic_salary_minor', 'compensation_pii', '3500000', '3800000')
    `;
  }

  // 7. Access Events
  if (!(await hasData(client, "access_events"))) {
    console.log("  [SEED] access_events is empty. Inserting access log.");
    await client`
      INSERT INTO access_events (
        id, tenant_id, subject_type, subject_id, field_domain, purpose, 
        decision, reason_code, request_id, occurred_at
      )
      VALUES (
        ${uuid()}, ${tenantId}, 'employee_compensation', ${emp107Id}, 'payroll', 'monthly_calculation',
        'allowed', 'AUTHORIZED_ROLE', ${uuid()}, now()
      )
    `;
  }

  // 8. Privacy Requests & Consent Records
  if (!(await hasData(client, "privacy_requests"))) {
    console.log("  [SEED] privacy_requests is empty. Inserting GDPR/DPDP privacy requests.");
    await client`
      INSERT INTO privacy_requests (id, tenant_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${JSON.stringify({ request_type: "data_export", requested_by: "harish.personal@example.test", status: "fulfilled", fulfilled_on: "2026-01-10" })}::jsonb)
    `;
  }

  if (!(await hasData(client, "consent_records"))) {
    console.log("  [SEED] consent_records is empty. Inserting DPDP consent records.");
    await client`
      INSERT INTO consent_records (id, tenant_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${JSON.stringify({ subject_id: emp107Id, consent_type: "biometric_data_storage", granted: true, granted_at: "2024-08-01" })}::jsonb)
    `;
  }

  // 9. Legal Holds & Legal Hold Items
  if (!(await hasData(client, "legal_holds"))) {
    console.log("  [SEED] legal_holds is empty. Inserting compliance legal holds.");
    const holdId = uuid();
    await client`
      INSERT INTO legal_holds (id, tenant_id, attributes)
      VALUES (${holdId}, ${tenantId}, ${JSON.stringify({ matter_name: "Statutory PF Audit 2024", hold_reason: "Internal labour law verification", active: true })}::jsonb)
    `;

    const [docRow] = await client`SELECT id FROM documents WHERE tenant_id = ${tenantId} LIMIT 1`;
    if (docRow) {
      await client`
        INSERT INTO legal_hold_items (id, tenant_id, legal_hold_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${holdId}, ${JSON.stringify({ entity_type: "document", entity_id: docRow.id, custodian: "Sunita Verma" })}::jsonb)
      `;
    }
  }

  // 10. Retention Policies
  if (!(await hasData(client, "retention_policies"))) {
    console.log("  [SEED] retention_policies is empty. Inserting retention schedules.");
    await client`
      INSERT INTO retention_policies (
        id, tenant_id, jurisdiction_id, data_class, trigger_event, duration_days, 
        terminal_action, legal_basis, valid_from, version
      )
      VALUES (
        ${uuid()}, ${tenantId}, ${jurId}, 'payroll_slips', 'statutory_close', 2920,
        'archive', 'Income Tax Act 1961 Section 44AA', '2024-04-01', 1
      )
    `;
  }

  // 11. Compliance Calendar Items & Compliance Evidence
  if (!(await hasData(client, "compliance_calendar_items"))) {
    console.log("  [SEED] compliance_calendar_items is empty. Inserting statutory deadlines.");
    const calItems = [
      { code: "PF-SEP-26", title: "EPFO Monthly ECR Filing & Challan Remittance", due: "2026-09-15", status: "due_soon" },
      { code: "ESI-SEP-26", title: "ESIC Contribution Payment for August 2026", due: "2026-09-21", status: "scheduled" },
      { code: "TDS-Q2-26", title: "Advance Income Tax Q2 Installment", due: "2026-09-15", status: "due_soon" },
      { code: "PT-MH-26", title: "Maharashtra Professional Tax Monthly Filing", due: "2026-09-30", status: "scheduled" }
    ];

    for (const item of calItems) {
      const cId = uuid();
      await client`
        INSERT INTO compliance_calendar_items (id, tenant_id, legal_entity_id, attributes)
        VALUES (${cId}, ${tenantId}, ${legalEntityId}, ${JSON.stringify({ code: item.code, title: item.title, due_date: item.due, status: item.status })}::jsonb)
      `;

      await client`
        INSERT INTO compliance_evidence (id, tenant_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${JSON.stringify({ compliance_item_id: cId, evidence_type: "challan_receipt", status: item.status === "due_soon" ? "pending_upload" : "verified" })}::jsonb)
      `;
    }
  }

  // 12. Regulatory Change Statuses
  if (!(await hasData(client, "regulatory_change_statuses"))) {
    console.log("  [SEED] regulatory_change_statuses is empty. Inserting regulatory tracking.");
    await client`
      INSERT INTO regulatory_change_statuses (id, tenant_id, jurisdiction_id, statutory_rule_pack_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${jurId}, ${statRulePackId}, ${JSON.stringify({ regulation_name: "Code on Wages 2024 Notification", status: "compliant", assessed_on: "2024-04-15" })}::jsonb)
    `;
  }

  // 13. Exchange Rate Snapshots
  if (!(await hasData(client, "exchange_rate_snapshots"))) {
    console.log("  [SEED] exchange_rate_snapshots is empty. Inserting FX snapshots.");
    const [usdRow] = await client`
      INSERT INTO currencies (id, alpha_code, numeric_code, name, minor_units, symbol, active)
      VALUES (${uuid()}, 'USD', '840', 'US Dollar', 2, '$', true)
      ON CONFLICT (alpha_code) DO UPDATE SET name = 'US Dollar'
      RETURNING id
    `;

    await client`
      INSERT INTO exchange_rate_snapshots (id, tenant_id, base_currency_id, quote_currency_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${usdRow.id}, ${currId}, ${JSON.stringify({ rate: 83.95, rate_date: "2026-09-10", source: "RBI Reference Rate" })}::jsonb)
    `;
  }

  // 14. Asset Catalog & Asset Assignments
  if (!(await hasData(client, "asset_catalog"))) {
    console.log("  [SEED] asset_catalog is empty. Inserting company assets.");
    const asset1 = uuid();
    const asset2 = uuid();

    await client`
      INSERT INTO asset_catalog (id, tenant_id, legal_entity_id, attributes)
      VALUES 
        (${asset1}, ${tenantId}, ${legalEntityId}, ${JSON.stringify({ asset_tag: "AST-NB-042", name: "Lenovo ThinkPad P14s (IT & Plant Control)", serial_no: "LNV-882910" })}::jsonb),
        (${asset2}, ${tenantId}, ${legalEntityId}, ${JSON.stringify({ asset_tag: "AST-TAB-015", name: "Samsung Rugged Galaxy Tab (Floor Inspection)", serial_no: "SMG-334411" })}::jsonb)
    `;

    await client`
      INSERT INTO asset_assignments (id, tenant_id, asset_id, employee_id, attributes)
      VALUES 
        (${uuid()}, ${tenantId}, ${asset1}, ${emp113Id}, ${JSON.stringify({ assigned_on: "2025-06-05", status: "active" })}::jsonb),
        (${uuid()}, ${tenantId}, ${asset2}, ${emp106Id}, ${JSON.stringify({ assigned_on: "2024-07-05", status: "active" })}::jsonb)
    `;
  }

  // 15. Teams & Job Families
  if (!(await hasData(client, "teams"))) {
    console.log("  [SEED] teams is empty. Inserting production teams.");
    await client`
      INSERT INTO teams (id, tenant_id, attributes)
      VALUES 
        (${uuid()}, ${tenantId}, ${JSON.stringify({ team_code: "TEAM-WEAVE-ALPHA", name: "Weaving Alpha Squad", lead_employee_id: emp104Id })}::jsonb),
        (${uuid()}, ${tenantId}, ${JSON.stringify({ team_code: "TEAM-MAINT-BETA", name: "Preventative Maintenance Squad", lead_employee_id: emp107Id })}::jsonb)
    `;
  }

  if (!(await hasData(client, "job_families"))) {
    console.log("  [SEED] job_families is empty. Inserting job families.");
    await client`
      INSERT INTO job_families (id, tenant_id, attributes)
      VALUES 
        (${uuid()}, ${tenantId}, ${JSON.stringify({ family_code: "TEXTILE_MFG", name: "Textile Manufacturing & Operations" })}::jsonb),
        (${uuid()}, ${tenantId}, ${JSON.stringify({ family_code: "CORP_FUNCT", name: "Corporate Services & Governance" })}::jsonb)
    `;
  }

  // 16. Custom Field Definitions & Values
  if (!(await hasData(client, "custom_field_definitions"))) {
    console.log("  [SEED] custom_field_definitions is empty. Inserting custom fields.");
    const cfdId = uuid();
    await client`
      INSERT INTO custom_field_definitions (id, tenant_id, attributes)
      VALUES (${cfdId}, ${tenantId}, ${JSON.stringify({ entity_type: "employee", field_key: "locker_number", label: "Plant Locker Number", data_type: "string" })}::jsonb)
    `;

    await client`
      INSERT INTO custom_field_values (id, tenant_id, custom_field_definition_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${cfdId}, ${JSON.stringify({ entity_id: emp107Id, value: "LOCKER-B-14" })}::jsonb)
    `;
  }

  console.log("✓ Domain 10 seeded successfully.");
}
