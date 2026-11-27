<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/MultipliersKraftLogoDark.png">
  <img src="../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# IA-01 — API and Tool Surface Catalogue

| Attribute | Value |
| :--- | :--- |
| Document ID | IA-01 |
| Title | API and Tool Surface Catalogue |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Integration Architect |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Architecture Review Board — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | TS, PI |
| Related documents | IA-02, IA-03, ICD-01, AI-01 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 – BG-10 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 13_API_and_Tools<br>Field_Spec_Impl_Path.csv (form → menu path → CRUD endpoint) |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

> API AND GOVERNED TOOL SURFACE
> The public REST surface and the agent tool surface. Build the tool layer once and expose it twice — internally to our agents, externally over MCP.

## PUBLIC REST (OpenAPI 3.1, versioned, sandbox tenant for every partner)

| Surface | Name | Method / class | Purpose | Permission | Side effect | Dry run | Consumed by | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| REST | /v1/people | GET, POST | List and create persons | people.read / people.write | write | No | Partners, ERP | Read-only fields rejected in ERP-owned mode |
| REST | /v1/assignments | GET, POST, PATCH | Assignment lifecycle with effective dating | people.write | write | No | Partners, HRIS | PATCH requires effective_from and reason |
| REST | /v1/attendance/events | POST | Bulk punch ingestion | time.ingest | write | No | Device agents, kiosks | Idempotent on (person, ts, device) |
| REST | /v1/attendance/days | GET | Derived days with totals, status and provenance | time.read | read | — | Manager apps, analytics | Scope-resolved; pay fields never present |
| REST | /v1/attendance/recompute | POST | Request recompute for a person and range | time.admin | write | Yes | Admin, integrations | Rejected for locked periods |
| REST | /v1/leave/requests | GET, POST | Apply and track leave | leave.self / leave.admin | write | No | Employee apps, business messaging | Validation errors name the rule |
| REST | /v1/leave/balance | GET | Projected balance with transactions | leave.self | read | — | Apps, assistant | Projection, never a stored column |
| REST | /v1/gate-passes | GET, POST | Request and list gate passes | time.self | write | No | Apps, business messaging | Ceiling enforced server-side |
| REST | /v1/payroll/runs | GET, POST | Run lifecycle | payroll.admin | write | Yes on state change | Payroll UI | Run type mandatory |
| REST | /v1/payroll/payslips | GET | Payslip by period and run | payroll.self / payroll.admin | read | — | Apps | Run selector required |
| REST | /v1/payroll/journal | GET | Dimensioned salary journal per run | finance.read | read | — | ERP, finance | Blocked until every component is mapped |
| REST | /v1/loans/eligibility/{personId} | GET | Decision, ceiling and reasons | loans.read | read | — | Loan UI, guarantor lock, payroll node, agent tool | THE single eligibility source |
| REST | /v1/requisitions | GET, POST | Requisition with sanction check | talent.write | write | No | Recruiting UI | Addition blocked without headroom |
| REST | /v1/compliance/forms | GET, POST | Form library and generated instances | compliance.read/write | write | No | Compliance UI | State-scoped |
| REST | /v1/integration/employee-master | POST | ERP inbound upsert | integration.write | write | No | ERP | Idempotent on external code; conflicts held |
| REST | /v1/webhooks | GET, POST | Subscription management and delivery log | integration.admin | write | No | Partners | Signed, retried, inspectable |

## GOVERNED TOOL SURFACE (internal agents AND external MCP — build once, expose twice)

| Surface | Name | Method / class | Purpose | Permission | Side effect | Dry run | Consumed by | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TOOL | read_employee | read | Employee record within the caller's scope | people.read | read | — | Policy Assistant, Manager Coach | Compensation fields obey RL-005 |
| TOOL | list_exceptions | read | Open attendance exceptions for a scope | time.read | read | — | Attendance Steward | Drives the daily triage |
| TOOL | propose_regularisation | propose | Draft a regularisation with evidence | time.propose | propose | Yes | Attendance Steward | Human approves unless under the tenant threshold |
| TOOL | simulate_payroll | read | Dry-run a run and return the diff | payroll.simulate | read | — | Payroll Preparer | Never mutates |
| TOOL | run_pre_audit | propose | Execute checks and classify flags | payroll.audit | propose | Yes | Payroll Preparer | Propose only. Always. |
| TOOL | check_loan_eligibility | read | Call the single eligibility method | loans.read | read | — | Policy Assistant | Same answer as the screen and the payroll node |
| TOOL | draft_letter | propose | Render a letter draft from a template | experience.propose | propose | Yes | HR assistant | Human reviews before issue |
| TOOL | assemble_filing_pack | propose | Build a statutory pack from posted records | compliance.propose | propose | Yes | Compliance Watcher | A human files |
| TOOL | create_ticket | write | Raise a helpdesk ticket | helpdesk.write | write | Yes | Policy Assistant | Low blast radius |
| TOOL | schedule_interview | write | Book an interview slot | talent.write | write | Yes | Recruiting Coordinator | Scheduling auto; candidate decisions human |
| TOOL | run_report | read | Governed query over the analytics model | analytics.read | read | — | Analyst agent | Returns chart and the SQL |
| TOOL | apply_leave | write | Apply on the employee's behalf | leave.self | write | Yes | Policy Assistant | Confirmation required |

## Form CRUD endpoint map

| Form ID | Form Name | Target Module ID | CRUD API Endpoint | Full Location Path |
| :--- | :--- | :--- | :--- | :--- |
| FRM-PLT-01 | Legal Entity Master | legal_entity | /api/v1/organization/entities | Platform & Admin > People & lifecycle > Legal entity master (SCR-001) |
| FRM-PLT-02 | Location / Work Site Master | location_master | /api/v1/organization/locations | Platform & Admin > People & lifecycle > Location / Work site master (SCR-002) |
| FRM-PLT-03 | User, Role and Scope Grant | access_scope | /api/v1/identity/memberships | Core HR > People & lifecycle > Access scope administration (SCR-005) |
| FRM-PPL-01 | Add / Edit Employee — Identity and Personal | person_record | /api/v1/people | Core HR > People & lifecycle > Employee record (SCR-010) |
| FRM-PPL-02 | Employment, Assignment and Policy | assignment_admin | /api/v1/organization/tree | Core HR > People & lifecycle > Assignment and policy attributes (SCR-011) |
| FRM-PPL-03 | Position Master | position_register | /api/v1/organization/tree | Core HR > People & lifecycle > Position register (SCR-012) |
| FRM-PPL-04 | Sanctioned Strength | sanctioned_strength | /api/v1/organization/tree | Core HR > People & lifecycle > Sanctioned strength board (SCR-013) |
| FRM-PPL-05 | Document Upload and Verification | document_vault | /api/v1/ops/modules/document_vault/records | Core HR > People & lifecycle > Document vault (SCR-014) |
| FRM-PPL-06 | Asset Allocation and Return | asset_register | /api/v1/assets | Core HR > People & lifecycle > Asset register (SCR-064) |
| FRM-TIM-01 | Shift Master | shift_master | /api/v1/ops/modules/shift_master/records | Core HR > Attendance operations > Shift master (SCR-028) |
| FRM-TIM-02 | Roster / Shift Schedule | roster_schedule | /api/v1/ops/modules/roster_schedule/records | Core HR > Attendance operations > Roster / Shift Schedule (SCR-029) |
| FRM-TIM-03 | Check In / Check Out | check_in_out | /api/v1/attendance/punches | Core HR > Attendance operations > Check in and check out (SCR-020) |
| FRM-TIM-04 | Attendance Day Detail and Override | attendance_detail | /api/v1/ops/modules/attendance_detail/records | Core HR > Attendance operations > Attendance day detail (SCR-022) |
| FRM-TIM-05 | Attendance Regularisation Request | my_attendance | /api/v1/attendance/days | Core HR > Attendance operations > My attendance history (SCR-021) |
| FRM-TIM-06 | Gate Pass | gate_passes | /api/v1/gate-passes | Core HR > Attendance operations > Gate pass register (SCR-023) |
| FRM-TIM-07 | Overtime Register and Approval | overtime_register | /api/v1/ot-requests | Core HR > Attendance operations > Overtime register (SCR-024) |
| FRM-TIM-08 | Attendance Exception Resolution | attendance_exceptions | /api/v1/regularizations | Core HR > Attendance operations > Attendance exception queue (SCR-025) |
| FRM-LVE-01 | Leave Type Configuration | leave_policy_admin | /api/v1/ops/modules/leave_policy_admin/records | Core HR > Leave operations > Leave policy configuration (SCR-032) |
| FRM-LVE-02 | Apply for Leave | leave_requests | /api/v1/leave-requests | Core HR > Leave operations > Leave requests (SCR-030) |
| FRM-LVE-03 | Compensatory Off Claim | compensatory_off | /api/v1/ops/modules/compensatory_off/records | Core HR > Leave operations > Compensatory off claim (SCR-033) |
| FRM-LVE-04 | Leave Encashment Request | leave_encashment | /api/v1/ops/modules/leave_encashment/records | Core HR > Leave operations > Leave encashment request (SCR-034) |
| FRM-PAY-01 | Pay Component Master | pay_component_master | /api/v1/ops/modules/pay_component_master/records | Payroll & Finance > Payroll & finance operations > Pay component master (SCR-057) |
| FRM-PAY-02 | Salary Structure | salary_simulator | /api/v1/wage-simulations | Core HR > Payroll & finance operations > Salary structure simulator (SCR-052) |
| FRM-PAY-03 | Payroll Run | payroll_runs | /api/v1/payroll-runs | Payroll & Finance > Payroll & finance operations > Payroll run cockpit (SCR-050) |
| FRM-PAY-04 | Pre-Payroll Audit Resolution | pre_payroll_audit | /api/v1/payroll-anomalies | Payroll & Finance > Payroll & finance operations > Pre-payroll audit (SCR-051) |
| FRM-PAY-05 | Investment Declaration and Tax | tax_declarations | /api/v1/ops/modules/tax_declarations/records | Payroll & Finance > Payroll & finance operations > Tax declaration and projection (SCR-054) |
| FRM-PAY-06 | Reimbursement Claim | reimbursement_claim | /api/v1/ops/modules/reimbursement_claim/records | Payroll & Finance > Payroll & finance operations > Reimbursement claim (SCR-058) |
| FRM-PAY-07 | Disbursement and Bank File | bank_disbursement | /api/v1/ops/modules/bank_disbursement/records | Payroll & Finance > Payroll & finance operations > Bank disbursement control (SCR-055) |
| FRM-PAY-08 | Full and Final Settlement | full_and_final | /api/v1/fnf-settlements | Payroll & Finance > Payroll & finance operations > Full and final settlement (SCR-056) |
| FRM-CMB-01 | Loan Application | loans_advances | /api/v1/loans | Payroll & Finance > Payroll & finance operations > Loans and advances (SCR-080) |
| FRM-CMB-02 | Salary Advance Request | salary_advance | /api/v1/ops/modules/salary_advance/records | Payroll & Finance > Payroll & finance operations > Salary advance request (SCR-081) |
| FRM-TAL-01 | Manpower Requisition | requisitions | /api/v1/requisitions | Core HR > Talent & experience operations > Recruitment requisitions (SCR-090) |
| FRM-TAL-02 | Candidate Record and Application | candidate_application | /api/v1/ops/modules/candidate_application/records | Core HR > Talent & experience operations > Candidate record and application (SCR-092) |
| FRM-TAL-03 | Interview Feedback | interview_feedback | /api/v1/ops/modules/interview_feedback/records | Core HR > Talent & experience operations > Interview feedback (SCR-093) |
| FRM-TAL-04 | Offer | offer_management | /api/v1/ops/modules/offer_management/records | Core HR > Talent & experience operations > Offer management (SCR-094) |
| FRM-TAL-05 | Employee Referral | referrals | /api/v1/referrals | Core HR > Talent & experience operations > Referral tracking (SCR-091) |
| FRM-LCY-01 | Pre-boarding and Joining Chain | joining_chain | /api/v1/onboarding/instances | Core HR > People & lifecycle > Joining chain console (SCR-060) |
| FRM-LCY-02 | Confirmation | probation_confirmation | /api/v1/ops/modules/probation_confirmation/records | Core HR > People & lifecycle > Confirmation review (SCR-068) |
| FRM-LCY-03 | Resignation and Exit | resignation_exit | /api/v1/ops/modules/resignation_exit/records | Core HR > People & lifecycle > Resignation and exit (SCR-069) |
| FRM-LCY-04 | Exit Clearance | clearance_board | /api/v1/ops/modules/clearance_board/records | Core HR > People & lifecycle > Clearance board (SCR-061) |
| FRM-EXP-01 | Letter Generation | letters_register | /api/v1/hr-letters | Core HR > People & lifecycle > Letters and issue register (SCR-067) |
| FRM-EXP-02 | Recognition Nomination | recognition_register | /api/v1/recognition-events | Core HR > Talent & experience operations > Recognition register (SCR-065) |
| FRM-EXP-03 | Announcement | announcement_management | /api/v1/announcements | Core HR > Talent & experience operations > Announcements (SCR-066) |
| FRM-SSV-01 | Helpdesk Ticket | helpdesk_ticket | /api/v1/ops/modules/helpdesk_ticket/records | Analytics & AI > Intelligence operations > Helpdesk ticket (SCR-043) |
| FRM-CMP-01 | Obligation Calendar Entry | obligation_calendar | /api/v1/compliance/obligations | Workforce Operations > Compliance engineering > Obligation calendar (SCR-072) |
| FRM-CTG-01 | Contractor Engagement | contractor_reconciliation | /api/v1/contractors/invoices | Core HR > Compliance engineering > Contractor engagement and invoice (SCR-095) |
| FRM-CTG-02 | Contractor Invoice Reconciliation | contractor_invoice | /api/v1/ops/modules/contractor_invoice/records | Workforce Operations > Compliance engineering > Contractor invoice reconciliation (SCR-096) |
| FRM-FIN-01 | GL Mapping | gl_mapping | /api/v1/ops/modules/gl_mapping/records | Payroll & Finance > Payroll & finance operations > GL mapping and journal (SCR-102) |
| FRM-FIN-02 | ERP Integration and Field Ownership | integration_config | /api/v1/integrations/connections | Core HR > Integration operations > Integration configuration (SCR-100) |

## Additional interfaces defined in ICD-01 and MIG-01 (Authored)

| Surface | Name | Method / class | Purpose | Permission | Side effect | Dry run | Consumed by | Note | Domain | Defined in |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| REST | /v1/integration/reference-master | POST | ERP inbound snapshot of cost centres, projects, departments and active GL accounts (FULL or DELTA per master type) | integration.write | write | No | ERP | Idempotent on snapshot_id and per row on master_type + code + payload_hash; a FULL snapshot deactivating more than 10% of active codes is held for Finance confirmation; codes are end-dated, never hard-deleted | FIN | ICD-01 §8 (FIN-INT-003) |
| REST | /v1/integration/vendor-master | POST | ERP inbound snapshot of contractor and vendor codes, contract terms, statutory registrations and rate cards | integration.write | write | No | ERP | Idempotent on snapshot_id and per row on vendor_code + payload_hash; ERP-owned vendor fields are read-only in Nucleus; a Blocked vendor stops new deployments and flags open invoices | CTG | ICD-01 §16 (CTG-INT-001) |
| REST | /v1/attendance/devices/{device_id}/heartbeat | POST | Site agent or terminal liveness signal with buffer depth and clock offset for the device health report | time.ingest | write | No | Site agents, biometric terminals | Expected every 5 minutes; mTLS with the agent enrolment certificate bound to its location grant; a device silent for more than 15 minutes in a rostered shift raises a device-failure exception (RL-140) | TIM | ICD-01 §10.1, §10.4 (TIM-INT-001) |
| WEBHOOK | /v1/channels/messaging/inbound | POST | Inbound user messages, button replies and shared locations from the business messaging channel | Provider HMAC-SHA256 signature plus source allow-list (no bearer scope); actions run under the bound person's own permissions | write | No | Business messaging channel | Idempotent on the provider message_id; action tokens are signed, single use and expire after 24 hours; every action calls the same domain service and rules as the app; unbound numbers receive the onboarding reply only | SSV | ICD-01 §11 (SSV-INT-001) |
| WEBHOOK | /v1/integration/bgv/callback | POST | Background-verification case status, per-check results and report availability for the pre-boarding chain | Provider HMAC-SHA256 signature (no bearer scope) | write | No | Background-verification provider | Deduplicated on the provider event_id; a callback for an unknown case_ref is rejected and alerted; a DISCREPANT or UNABLE_TO_VERIFY result opens a human review task and never rejects the candidate | LCY | ICD-01 §13 (LCY-INT-001) |
| WEBHOOK | /v1/integration/esign/callback | POST | E-signature envelope status, signed document and audit certificate | Provider HMAC-SHA256 signature (no bearer scope) | write | No | E-signature provider | Deduplicated on the provider event ID; a signed file whose hash chain does not match document_sha256 is rejected and alerted; DECLINED and EXPIRED return the letter to HR | EXP | ICD-01 §14 (EXP-INT-001) |
| SCIM | /scim/v2/Users | GET, POST, PUT, PATCH | SCIM 2.0 service endpoint for directory-driven provisioning of principal accounts (provisioning mode B) | scim.provision | write | No | Enterprise directory | Creates principal accounts awaiting linkage only, never person, employment or assignment records; keyed on externalId = employee code; a 409 on userName is held for the administrator | PLT | ICD-01 §15 (PLT-INT-004) |
| SCIM | /scim/v2/Groups | GET | SCIM 2.0 service endpoint exposing the tenant-configured role groups to the enterprise directory | scim.provision | read | — | Enterprise directory | Group membership derives from Nucleus role, entity and location grants; no SCIM attribute maps to an entity or location grant (PLT-INT-004.04) | PLT | ICD-01 §15 (PLT-INT-004) |
| TOOL | MCP server (initialize, tools/list, tools/call) | JSON-RPC 2.0 over streamable HTTPS | Expose the twelve governed tools of IA-01 to the client AI environment under the same policy gate, autonomy limits and action ledger as internal agents | OAuth 2.1 authorisation code with PKCE bound to a human principal; tool scopes equal the IA-01 permissions | read | Yes | Client AI environment | Side effect per tool as in IA-01; dry_run on tools marked dry run; every tools/call creates an action ledger row; disbursement, termination, offer release, statutory filing and loan sanction are at most proposed; default 60 calls per minute per principal | INT | ICD-01 §17 (INT-INT-001) |

## Approval & Sign-off

| Role | Name | Date | Decision | Conditions / comments |
| :--- | :--- | :--- | :--- | :--- |
| Author | Dhanraj Dadhich | 2026-11-05 | Submitted | |
| Peer review moderator | *pending* | | | PR-xxxx |
| PQA (process compliance) | *pending* | | | |
| Approval authority (DOC-01 §7) | *pending* | | | |

## Measurement Data Captured

| Measure | Value | Unit | Notes |
| :--- | :--- | :--- | :--- |
| Size | 86 | specified items (table rows) | Counted automatically at generation |
| Authoring effort | *to be recorded* | person-hours | |
| Review effort (preparation + meeting) | *pending review* | person-hours | From PR-xxxx |
| Rework effort | *pending review* | person-hours | |
| Review rate | *pending review* | items / hour | Compare with PPB control limits |
| Requirement volatility (changes since baseline) | 0 | CRs touching this artefact | Not yet baselined (CM-03) |

**Defects found, by detection phase and severity**

| Detection phase | Major | Minor | Editorial | Injected in phase (major) |
| :--- | :--- | :--- | :--- | :--- |
| Author self-check | 0 | 0 | 0 | — |
| Peer review | *pending* | | | |
| Design / build | | | | |
| System / integration test | | | | |
| UAT | | | | |
| Production (escaped) | | | | each escaped major opens a CAR record (CAR-01) |

Within control limits of the review-rate PPB? *To be assessed at peer review.*

## Revision History

| Version | Date | Author | Change summary | CR ref | Approved by |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1.0.0 | 2026-11-05 | Dhanraj Dadhich | Consolidated release | CR-0001 | *pending* |
