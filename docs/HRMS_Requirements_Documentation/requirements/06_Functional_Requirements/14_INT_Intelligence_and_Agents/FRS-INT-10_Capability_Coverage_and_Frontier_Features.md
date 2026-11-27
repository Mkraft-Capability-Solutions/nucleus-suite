<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-INT-10 — Intelligence & Agents — Capability Coverage and Frontier Features

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-INT-10 |
| Title | Intelligence & Agents — Capability Coverage and Frontier Features |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Intelligence & Agents |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, DAR |
| Related documents | FRS-INT-00, FRS-INT-01, FRS-INT-02, FRS-INT-03, FRS-INT-04, FRS-INT-05, FRS-INT-06, FRS-INT-07, FRS-INT-08, FRS-INT-09, FRS-INT-10, FRS-INT-11, FRS-INT-12, FRS-INT-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-02, BG-08 · processes INT-01–INT-04 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 03_Process_Inventory<br>Authored (sections 2–3) |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Capabilities specified in the source

| Process ID | Process | Criticality | Phase | Reuses |
| :--- | :--- | :--- | :--- | :--- |
| INT-01 | Agent invocation through the policy gate | Critical | P2 | CMP-11, CMP-06 |
| INT-02 | Action ledger write and reversal | Critical | P2 | CMP-06 |
| INT-03 | Analytics projection and operational reports | High | P2 | CMP-07, CMP-08 |
| INT-04 | Predictive scoring with explanation | Medium | P3 | CMP-11 |

Forms specified: 0 with 0 fields; screens: 2; rules: 6.

## 2. Capability gaps (Authored — new requirements)

Capabilities that an enterprise-grade, market-leading HCM needs and that the source workbooks do not yet specify. Each is a new requirement with status **Proposed**, decided through CM-02, and has a use case in FRS-INT-12.

| ID | Capability | Requirement | Priority | Phase |
| :--- | :--- | :--- | :--- | :--- |
| INT-CG-001 | Self-service report writer | Authorised users MUST be able to build ad-hoc reports on secured data sources with filters, grouping, calculated fields and scheduled distribution, honouring field-level security. | Must | P2 |
| INT-CG-002 | Executive dashboards and people analytics | The system MUST provide headcount, attrition, diversity, cost, absenteeism and overtime dashboards with drill-down within the viewer's scope. | Must | P2 |
| INT-CG-003 | Data warehouse export | The system MUST export analytics-ready, de-identified datasets to a customer data warehouse on schedule with schema documentation. | Should | P3 |
| INT-CG-004 | Regulatory and statutory reports library | The system MUST provide a library of statutory and regulatory reports per jurisdiction maintained with rule packs. | Must | P2 |
| INT-CG-005 | Skills gap analysis | HR MUST see current versus required skills by role, team and site with recommended learning and hiring actions. | Must | P3 |
| INT-CG-006 | Organisation network analysis (consented) | HR COULD analyse collaboration patterns from consented, aggregated metadata to find silos and key connectors, never at individual-content level. | Could | P5 |
| INT-CG-007 | Embedded analytics in every screen | Every transactional screen SHOULD show context-relevant metrics (e.g. team absence trend on the leave approval screen) within the viewer's scope. | Should | P3 |

## 3. Frontier features (Authored)

Forward-looking capabilities that set Nucleus Suite apart. Each requires a decision under DAR-01 and, where AI is involved, the GOV-11 controls for its risk tier. Status: **Proposed**.

| ID | Feature | Description | Differentiation | Builds on | AI risk tier | Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| INT-FX-001 | Natural-language analytics | Ask questions in plain language; answers are generated only from governed, scope-filtered data with the query shown for transparency. | Analytics for every manager, not only analysts. | Analyst agent, scope resolver | Tier 1 | P4 |
| INT-FX-002 | Predictive workforce planning | Forecasts demand and supply of skills and headcount by site with scenario comparison. | Strategic planning built into the HCM. | Analytics projections | Tier 2 | P5 |
| INT-FX-003 | Agent and MCP ecosystem | Customers and partners connect their own AI agents through the governed MCP tool surface with the same permissions, approvals and ledger. | An open, safe AI platform rather than a closed assistant. | Tool surface, policy gate | Tier 2 | P4 |
| INT-FX-004 | Autonomous insight alerts | Detects significant changes (absenteeism spikes, OT anomalies, attrition clusters) and pushes explained insights to owners. | Insight arrives without anyone asking. | Analytics projections | Tier 1 | P4 |
| INT-FX-005 | Model transparency centre | Model cards, evaluation results, fairness metrics and drift status of every AI feature visible to admins and auditors. | Trustworthy AI as a visible product capability. | Action ledger | No AI | P4 |
| INT-FX-006 | Workforce scenario studio | Combines organisation digital twin, cost forecasting and skills supply to compare strategic scenarios (new plant, automation, expansion). | Board-level workforce strategy in one place. | Org digital twin, workforce cost scenarios | Tier 2 | P5 |
| INT-FX-007 | Multi-agent orchestration with human approval chains | Coordinates several governed agents on a single goal (e.g. open a new site) with every step approved and ledgered. | End-to-end automation without losing control. | Agent and MCP ecosystem, approval engine | Tier 3 | P5 |

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
