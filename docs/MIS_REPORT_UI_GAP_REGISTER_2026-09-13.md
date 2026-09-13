# Nucleus MTD MIS report: UI and workflow gap register

13 September 2026 | Product, design, frontend and backend handoff

## Frontend implementation update

The People Intelligence area now includes the **MTD MIS Reporting Centre**. It replaces the presentation-only MIS table with CSV/XLSX reading, typed field mapping, duplicate and business-rule validation, a quality queue, publishable client-side dataset runs, a report catalogue, calculated scoped KPI cards, employee drill-down, protected CTC and flight-risk display, risk-case review controls, source/audit history and real CSV/XLSX export.

The screens operate against the prototype's active client-side report state and existing display data. Persistent, server-authorised datasets, schedule execution, recipient delivery and model-source APIs remain the backend implementation handoff; their fields and workflow requirements below still define those API contracts.

## Scope

This review compares the supplied `Nucleus_MIS_Report_MTD_1789248363478.csv` with the active NucleusUI prototype and the existing process-map register. The attached file is a CSV, despite the request referring to XLSX sheets; it contains no embedded instructions.

The file contains eight employee rows and these nine fields: employee ID, employee name, department, designation, attendance percentage, overtime hours, gross CTC, performance rating and flight risk. It is labelled MTD but does not state its as-of date, start/end dates, legal entity, location, timezone, source system or report owner.

The prototype already has a configurable MIS table in `AnalyticsView`, seeded master data with the same nine visible measures, a department filter, CSV export and a visual four-step ingestion modal. It also now has generic record-detail workspaces for all 49 process-map screens. Those surfaces are useful foundations, but they do not complete the reporting product described by this file.

## What the supplied report shows

| Measure | Observed value | Product implication |
| --- | ---: | --- |
| Population | 8 employees across 6 departments | A report must identify its population, exclusions and the scope the viewer is permitted to see. |
| Average attendance | 94.83% | Requires a defined MTD period, working-day denominator, leave treatment and drill-through to attendance days. |
| Total overtime | 101.0 hours | Requires approval, policy eligibility, payable/non-payable status and payroll-run linkage. |
| Flight risk distribution | 6 Low, 1 Medium, 1 High | Requires a protected risk-case workflow, score metadata, explanation, owner and mitigation outcome. |
| Gross CTC currencies | 6 INR, 1 USD, 1 GBP | A mixed-currency report cannot responsibly calculate one aggregate cost without currency code, exchange-rate basis and an optional reporting currency. |
| Completeness | All nine supplied columns are populated | File-level completeness alone is insufficient; type, reference, duplicate, period and business-rule validation are still required. |

## Current coverage versus missing structure

| Area | Current prototype coverage | Missing page, component or flow | Priority |
| --- | --- | --- | --- |
| MIS report list | A single MIS Studio table is embedded in People Intelligence. | **Report catalogue** with saved templates, owner, audience, status, refresh schedule, last successful run and version history. | P0 |
| MTD report record | Column picker, department filter, search and CSV download. | **Report-detail page** with a formal title, reporting period, scope, source freshness, applied filters, definitions, run history and audit trail. | P0 |
| File ingestion | Mapping modal uses preset sample datasets; selecting upload only displays a message. | **Real file upload and preview** that reads CSV/XLSX, detects delimiter/encoding, stores file metadata and presents a source-data preview. | P0 |
| Mapping | Heuristic mapping for a limited static field set. | **Mapping and transformation editor** with source/target types, required-field rules, value transformations, lookup mapping, default policy, versioning and field-owner indication. | P0 |
| Data quality | The preview labels sampled rows as valid without checking them. | **Validation results page**: row/field errors, duplicate employee IDs, unmatched departments/designations, invalid percentages/hours, missing period and currency parsing errors; allow correction, exclusion and rerun. | P0 |
| Dataset publication | Import merges client-side sample records into React state. | **Dataset run and publish flow** with staging, reconciliation, approvals, rollback, idempotency key and persistent import/run history. | P0 |
| Employee row drill-down | MIS rows are read-only. | **Employee MIS 360 drawer/page** that brings together profile, attendance calendar, approved OT, compensation-effective record, performance cycle and permitted risk case. | P0 |
| Attendance measure | One percentage appears in the table. | **Attendance metric detail** with MTD dates, scheduled/working/present/leave/absence days, late/gate-pass adjustments, shift policy and daily trace links. | P0 |
| Overtime measure | One total appears in the table. | **Overtime drill-down** linked to the overtime register: date, shift, eligibility, approved minutes, multiplier, approver, payroll-run tag and payment status. | P0 |
| Performance rating | Free-text rating is displayed. | **Performance cycle result** with cycle, rating scale/version, calibration state, reviewer, acknowledgement, effective date and evidence; do not use a display string as the source of truth. | P1 |
| Flight risk | A colour badge and a separate sample attrition tab. | **Flight-risk case page** with numeric score, band, model/version, run date, contributing factors, confidence, reviewer decision, mitigation plan, review date and outcome. | P0 |
| Compensation | Gross CTC is stored as display text. | **Secure compensation reporting component** with numeric annual amount, ISO currency, effective date, legal entity, pay basis, reporting-currency conversion and strict field masking/export controls. | P0 |
| Executive summary | Headcount and other headline cards use unrelated sample metrics; average attendance is hard-coded at 95.1%. | **Report KPI strip and charts** calculated from the selected filtered dataset, with a visible calculation definition and record-level drill-through. | P0 |
| Department analysis | One hard-coded department selector. | **Dimension filter builder** for entity, location, department, cost centre, manager, worker class, role, shift, period and status; values must come from governed reference data. | P1 |
| Trends | MTD is only a label in the download file name. | **Period comparison view** for MTD/QTD/YTD with previous-period deltas, trend charts and explicit date boundaries. | P1 |
| Distribution | CSV is the only real export. Excel and intelligence-pack buttons only show a success message. | **Export and distribution centre** for CSV/XLSX/PDF, column-level masking, asynchronous generation, download expiry, scheduled delivery, recipient review and export audit. | P0 |
| Governance | No report-level source lineage, classification or owner is shown. | **Data catalogue and governance panel**: source system, refresh SLA, data owner, field classification, retention, legal basis, model use and quality score. | P1 |
| Access control | UI role controls exist, but the MIS table uses shared client state. | **Report-scope policy layer** enforcing tenant/entity/manager/field permissions in APIs and exports; include access-denied explanation and audit events. | P0 |

## Missing fields

### Report and dataset context

Every import and report run needs `reportId`, `templateVersion`, `datasetId`, `sourceFileId`, `sourceSystem`, `sourceExtractedAt`, `periodStart`, `periodEnd`, `asOfAt`, `timezone`, `legalEntityId`, `locationIds`, `populationDefinition`, `rowCount`, `acceptedRowCount`, `rejectedRowCount`, `qualityStatus`, `preparedBy`, `reviewedBy`, `publishedAt` and `dataClassification`.

### Employee identity and organisation

The supplied fields require stable reference keys rather than display labels: `employeeId`, `employmentId`, `workerStatus`, `managerId`, `legalEntityId`, `locationId`, `departmentId`, `costCentreId`, `designationId`, `workerClass`, `employmentStartDate` and `employmentEndDate` when relevant.

### Attendance and overtime

Add `attendancePeriodStart`, `attendancePeriodEnd`, `scheduledWorkingDays`, `presentDays`, `approvedLeaveDays`, `unpaidLeaveDays`, `absenceDays`, `lateMinutes`, `gatePassMinutes`, `attendancePercent`, `attendanceCalculationVersion`, `overtimeMinutes`, `overtimeEligibilityRule`, `overtimeMultiplier`, `overtimeApprovalStatus`, `overtimeApproverId`, `overtimePayableAmount`, `overtimePayrollRunId` and `overtimePaymentStatus`.

### Compensation

Replace display-only CTC with `grossCtcAmount`, `grossCtcCurrency`, `grossCtcFrequency`, `grossCtcEffectiveFrom`, `grossCtcEffectiveTo`, `reportingCurrency`, `exchangeRate`, `exchangeRateAsOf`, `convertedGrossCtcAmount`, `payGroup`, `compensationAccessLevel` and `maskingReason`.

### Performance and flight risk

Add `performanceCycleId`, `ratingScaleId`, `ratingValue`, `ratingLabel`, `calibrationStatus`, `ratingFinalizedAt`, `reviewerId`, `employeeAcknowledgedAt`, `flightRiskScore`, `flightRiskBand`, `riskModelId`, `riskModelVersion`, `riskRunId`, `riskGeneratedAt`, `riskConfidence`, `riskDrivers`, `riskReviewerId`, `riskReviewStatus`, `mitigationOwnerId`, `mitigationPlan`, `nextReviewAt` and `caseOutcome`.

## Missing reusable UI components

1. **Report header and scope bar** — period, entity/location scope, population count, freshness, owner and quality state.
2. **Metric-definition popover** — formula, numerator/denominator, source tables, filter context and last calculation time.
3. **Dataset quality summary** — accepted/rejected counts, severity, error types and safe links to row corrections.
4. **Data-source freshness badge** — source time, expected refresh SLA, failed/late status and retry owner.
5. **Saved filter and dimension builder** — reusable scoped filters with permission-aware options.
6. **Row drill-down drawer** — a consistent cross-module entry point into employee, attendance, payroll, performance and risk records.
7. **Sensitive-value component** — role-aware masking, reveal request, reason capture and reveal/export audit.
8. **Currency cell and conversion component** — locale rendering plus an explicit rate/source tooltip; never sum mixed display strings.
9. **Risk explanation and action panel** — protected display of model factors, review decision and mitigation actions.
10. **Report run and export queue** — queued/running/succeeded/failed states, downloadable artifact, retry and audit trail.

## Required end-to-end flows

### 1. External MTD file to published report

Upload file → inspect schema and source metadata → map fields and transforms → validate rows and references → correct or exclude failures → stage dataset → reconcile counts and metrics → reviewer approval → publish dataset → run selected report → audit every step.

The current modal stops short of reading a selected file and the import updates browser memory. It needs a server-side staging/run model before it can be treated as an ingestion flow.

### 2. MTD report to operational action

Open report → apply permitted scope and date range → inspect calculated KPI → filter department/manager/worker class → open employee row → drill into attendance, approved overtime, performance or risk case → record approved action → return to report with refreshed status.

The table currently has no row action, drill-down or relationship to a record-specific workflow.

### 3. High flight-risk review

Model run completes → high-risk case enters restricted queue → authorised HR reviewer checks inputs, factors and confidence → records acknowledge/override/escalate decision with reason → assigns mitigation owner and due date → tracks outcome → retains auditable history.

The current colour badge does not provide a controlled case, model governance or an action trail.

### 4. Overtime to payroll control

MTD overtime total → employee/date detail → eligibility and approval verification → payroll input preview → payroll-run tag → disbursement/reconciliation status → drill-back to source attendance trace.

The existing Overtime Register workspace is a starting point, but the MIS total is not linked to it.

## Navigation and module placement

| Primary module | Submodules to add or complete | Why |
| --- | --- | --- |
| Analytics & Intelligence | MIS report catalogue, dataset runs, data-quality queue, report detail, scheduled distribution, report/export audit | Keeps report authoring, data freshness and consumption together. |
| People Core | Employee MIS 360 and protected identity/organisation drill-down | A report row needs a controlled employee record destination. |
| Attendance Operations | Attendance metric detail, overtime review, payroll-tag reconciliation | Makes attendance and OT figures explainable and actionable. |
| Talent & Performance | Performance cycle results and flight-risk case management | Separates a performance fact from a governed predictive-risk action. |
| Payroll & Finance | Compensation reporting, currency conversion, OT payment reconciliation | Supports secure cost analysis and prevents mixed-currency errors. |
| Platform & Administration | Source mappings, data catalogue, report access policy, retention and classification | Owns report governance and integration configuration. |

## Delivery order and acceptance criteria

### P0: trustworthy MTD reporting

Deliver real file parsing, field mapping, server-side validation/staging, report period and scope metadata, calculated filtered KPI values, employee-row drill-down, MTD attendance/OT traceability, controlled CTC formatting, risk-case review and real CSV/XLSX exports with audit.

Acceptance: uploading this CSV creates a persistent import run; every row is either accepted or rejected with a specific reason; the report shows the actual 8-record scope and 94.83% average attendance/101.0 OT hours for this source; its date range and data freshness are visible; a permitted user can trace each measure to its record source; a non-permitted user cannot retrieve CTC or flight-risk values through the UI or export endpoint.

### P1: repeatable reporting operations

Add saved templates, report ownership, schedules, delivery history, period comparisons, governed dimension filters, report definitions, risk mitigation tracking, conversion-rate management and dataset/version lineage.

Acceptance: a report can be rerun for another period without editing the template; recipients receive only their permitted data; scheduled outputs have success/failure history; version and source differences are visible between runs.

### P2: advanced intelligence

Add calculated measures, analytical dashboards, configurable alerts, model monitoring, bias/quality tests, action effectiveness reporting and self-service report builder controls.

Acceptance: intelligence conclusions can be opened to source data, calculation definition and model/version metadata, and every high-impact action requires its configured approval and audit evidence.
