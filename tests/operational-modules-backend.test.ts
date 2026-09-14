import { describe, expect, it } from "vitest";
import { OPERATIONAL_MODULES, createModuleRecordSchema } from "@/server/ops/modules-service";

describe("Operational Modules Backend Verification (Implementation Plan)", () => {
  const all17Modules = [
    { id: "document_vault", screen: "SCR-014", table: "documents" },
    { id: "attendance_detail", screen: "SCR-022", table: "attendance_entries" },
    { id: "overtime_register", screen: "SCR-024", table: "overtime_entries" },
    { id: "attendance_exceptions", screen: "SCR-025", table: "attendance_exceptions" },
    { id: "leave_policy_admin", screen: "SCR-032", table: "leave_policies" },
    { id: "tax_declarations", screen: "SCR-054", table: "tax_profiles" },
    { id: "bank_disbursement", screen: "SCR-055", table: "disbursement_batches" },
    { id: "rule_pack_manager", screen: "SCR-070", table: "rule_pack_versions" },
    { id: "golden_case_library", screen: "SCR-071", table: "rule_pack_assignments" },
    { id: "gl_mapping", screen: "SCR-102", table: "gl_mappings" },
    { id: "reconciliation", screen: "SCR-103", table: "reconciliation_items" },
    { id: "clearance_board", screen: "SCR-061", table: "clearance_items" },
    { id: "asset_register", screen: "SCR-064", table: "hardware_assets" },
    { id: "letters_register", screen: "SCR-067", table: "hr_letters" },
    { id: "check_in_out", screen: "SCR-020", table: "attendance_punches" },
    { id: "my_attendance", screen: "SCR-021", table: "attendance_days" },
    { id: "full_and_final", screen: "SCR-056", table: "fnf_settlements" },
  ];

  const extendedDomainModules = [
    { id: "ats_pipeline", screen: "SCR-062", table: "applications" },
    { id: "interview_schedule", screen: "SCR-063", table: "interview_sessions" },
    { id: "contractor_daily_muster", screen: "SCR-071", table: "contract_worker_assignments" },
    { id: "contractor_compliance", screen: "SCR-072", table: "contractor_statutory_evidence" },
    { id: "disciplinary_enquiry", screen: "SCR-081", table: "compliance_evidence" },
    { id: "safety_incident_register", screen: "SCR-082", table: "safety_evaluations" },
    { id: "social_workplace_feed", screen: "SCR-084", table: "feed_posts" },
    { id: "skill_matrix_admin", screen: "SCR-091", table: "job_skill_requirements" },
    { id: "tni_survey", screen: "SCR-092", table: "surveys" },
    { id: "performance_review_cycle", screen: "SCR-094", table: "review_cycles" },
  ];

  const specFormsModules = [
    { id: "shift_master", screen: "SCR-028", formId: "FRM-TIM-01" },
    { id: "roster_schedule", screen: "SCR-029", formId: "FRM-TIM-02" },
    { id: "compensatory_off", screen: "SCR-033", formId: "FRM-LVE-03" },
    { id: "leave_encashment", screen: "SCR-034", formId: "FRM-LVE-04" },
    { id: "helpdesk_ticket", screen: "SCR-043", formId: "FRM-SSV-01" },
    { id: "pay_component_master", screen: "SCR-057", formId: "FRM-PAY-01" },
    { id: "reimbursement_claim", screen: "SCR-058", formId: "FRM-PAY-06" },
    { id: "probation_confirmation", screen: "SCR-068", formId: "FRM-LCY-02" },
    { id: "resignation_exit", screen: "SCR-069", formId: "FRM-LCY-03" },
    { id: "salary_advance", screen: "SCR-081", formId: "FRM-CMB-02" },
    { id: "candidate_application", screen: "SCR-092", formId: "FRM-TAL-02" },
    { id: "interview_feedback", screen: "SCR-093", formId: "FRM-TAL-03" },
    { id: "offer_management", screen: "SCR-094", formId: "FRM-TAL-04" },
    { id: "contractor_invoice", screen: "SCR-096", formId: "FRM-CTG-02" },
  ];

  it("registers all 17 primary operational modules with valid screenId, canonical tables, and permissions", () => {
    for (const mod of all17Modules) {
      const config = OPERATIONAL_MODULES[mod.id];
      expect(config, `Missing configuration for ${mod.id}`).toBeDefined();
      expect(config.screenId).toBe(mod.screen);
      expect(config.table).toBe(mod.table);
      expect(config.permission).toBeTruthy();
      expect(config.auditAction).toBeTruthy();
    }
  });

  it("registers all extended domain operational modules with valid specifications", () => {
    for (const mod of extendedDomainModules) {
      const config = OPERATIONAL_MODULES[mod.id];
      expect(config, `Missing configuration for ${mod.id}`).toBeDefined();
      expect(config.screenId).toBe(mod.screen);
      expect(config.table).toBe(mod.table);
      expect(config.permission).toBeTruthy();
      expect(config.auditAction).toBeTruthy();
    }
  });

  it("registers all 14 Excel spec forms in OPERATIONAL_MODULES with screenId, table, permissions, and auditAction", () => {
    for (const mod of specFormsModules) {
      const config = OPERATIONAL_MODULES[mod.id];
      expect(config, `Missing configuration for ${mod.id}`).toBeDefined();
      expect(config.screenId).toBe(mod.screen);
      expect(config.permission).toBeTruthy();
      expect(config.auditAction).toBeTruthy();
    }
  });

  it("validates form payloads for each operational module schema", () => {
    const samplePayloads: Record<string, Record<string, unknown>> = {
      document_vault: { documentType: "Passport", employeeId: "EMP-001", expiryDate: "2030-01-01" },
      attendance_detail: { employeeId: "EMP-002", workDate: "2026-09-15", overrideReason: "Punch missing" },
      overtime_register: { employeeId: "EMP-003", otMinutes: 120, multiplier: 2.0 },
      attendance_exceptions: { employeeId: "EMP-004", exceptionType: "LATE_IN", resolution: "Waived" },
      leave_policy_admin: { policyCode: "PL_CORP", carryForwardCap: 30, accrualFrequency: "MONTHLY" },
      tax_declarations: { employeeId: "EMP-005", regime: "NEW", section80cAmount: 150000 },
      bank_disbursement: { batchId: "BATCH-2026-09", count: 250, totalAmountMinor: 12500000 },
      ats_pipeline: { candidateId: "CAND-101", targetStage: "TECHNICAL_INTERVIEW" },
      interview_schedule: { candidateId: "CAND-102", panelist: "TECH_LEAD", slot: "2026-09-16T10:00:00Z" },
      contractor_daily_muster: { vendorId: "VEND-01", shift: "A", deployedCount: 45 },
      contractor_compliance: { challanId: "CHALLAN-88", pfRemittanceDate: "2026-09-10" },
      disciplinary_enquiry: { noticeId: "SCN-001", charge: "Unexcused Absence", hearingDate: "2026-09-20" },
      safety_incident_register: { form18Logged: true, location: "Press Shop Floor", severity: "MINOR" },
      social_workplace_feed: { department: "ENGINEERING", message: "Hackathon 2026 registration open!" },
      skill_matrix_admin: { roleId: "SENIOR_DEV", benchmarkScore: 85 },
      tni_survey: { department: "OPERATIONS", trainingNeed: "Forklift Safety" },
      performance_review_cycle: { cycleName: "FY26-H1", launchDate: "2026-10-01" },
    };

    for (const [modId, payload] of Object.entries(samplePayloads)) {
      const parsed = createModuleRecordSchema.safeParse(payload);
      expect(parsed.success, `Payload failed schema validation for ${modId}`).toBe(true);
    }
  });
});
