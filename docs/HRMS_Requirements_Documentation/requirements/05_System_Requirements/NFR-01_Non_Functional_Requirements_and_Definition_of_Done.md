<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/MultipliersKraftLogoDark.png">
  <img src="../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# NFR-01 — Non-Functional Requirements and Definition of Done

| Attribute | Value |
| :--- | :--- |
| Document ID | NFR-01 |
| Title | Non-Functional Requirements and Definition of Done |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Chief Architect |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Architecture Review Board — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, VV, MPM |
| Related documents | SRS-01, OPS-01, MPM-01, QA-03 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 – BG-10 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 20_NFR_and_DoD |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

These targets are the source of truth for the quality and process-performance objectives in MPM-01 and the operational targets in OPS-01.

| Requirement | Target | How measured | Gate | Owner |
| :--- | :--- | :--- | :--- | :--- |
| Availability | 99.9% monthly, maintenance outside Indian business hours | Synthetic probes plus incident record | Monthly review | Engineering |
| Payroll availability | 99.95% during the 25th to the 5th | Probe window separated in reporting | Monthly review | Engineering |
| API latency | p95 under 300 ms, p99 under 800 ms for interactive reads | OpenTelemetry percentile dashboards | Release gate | Engineering |
| Mobile cold start | Under 2.5 s on a mid-range mobile devices on 3G | Device lab run per release | Release gate | Mobile |
| Payroll throughput | 10,000 employees gross-to-net in under 120 seconds | Load test on the payroll worker | Release gate | Payroll engineer |
| Payroll accuracy | Zero calculation defects reaching disbursement | Golden cases plus shadow runs; breach is a Sev-1 | Every build + monthly report | Payroll engineer |
| Attendance ingestion | 500 events per second sustained per tenant at shift change, with offline catch-up | Load test with device simulators | Release gate | Time engineer |
| Attendance recompute | A full month for 5,000 employees in under 10 minutes without degrading interactive latency | Load test with the interactive suite running concurrently | Release gate | Time engineer |
| Attendance accuracy | Zero disposition defects reaching payroll | Attendance golden cases plus shadow attendance | Every build | QA |
| Recovery | RPO 5 minutes, RTO 1 hour | Quarterly restore drill, documented | Quarterly | Engineering |
| Data residency | Indian tenant data resides in India, enforced at the infrastructure layer | Infrastructure policy test | Release gate | Platform |
| Provisioning | A new tenant fully provisioned in under 30 minutes, automated | Timed provisioning run | Per release | Platform |
| Implementation | Standard configuration live in under 4 weeks for a 500-person client | Implementation record per client | Per client | Delivery |
| Test coverage | 85%+ on payroll, attendance and compliance; 70% overall; 100% of statutory rules covered by golden cases | CI coverage report | Every build | QA |
| Accessibility | WCAG 2.2 AA on employee-facing surfaces | Automated plus manual audit | Per release | Design |
| Agent reversal rate | Under 2%, tracked from day one | Action ledger metric | Weekly | Product |
| Regularisations | Falling quarter on quarter per 100 employees | Operational report | Quarterly | Product |
| Security | Zero critical or high vulnerabilities in production; SOC 2 Type I by month 12 | SAST, dependency scan, external pen test | Every build + quarterly | Engineering |

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
| Size | 18 | specified items (table rows) | Counted automatically at generation |
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
