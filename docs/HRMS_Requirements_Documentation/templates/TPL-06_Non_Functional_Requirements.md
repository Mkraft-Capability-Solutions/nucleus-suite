<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../requirements/assets/MultipliersKraftLogoDark.png">
  <img src="../requirements/assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# TPL-06 — Non-Functional Requirements

| Attribute | Value |
| :--- | :--- |
| Document ID | TPL-06 |
| Title | Non-Functional Requirements |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Chief Architect |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | EPG Lead — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | PAD, RDM, TS, VV |
| Related documents | DOC-01, NFR-01, SEC-01, OPS-01, LOC-01, SRS-01, MPM-01 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (minimise defects reaching users) |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-03, BG-06, BG-10 · MET-27 |

---

## 1. Purpose and Use

This template states measurable quality requirements. Platform-wide targets are held in NFR-01 (with security in SEC-01, operations in OPS-01 and localisation in LOC-01, all in `05_System_Requirements/`). Domain packs refine those targets only where the domain needs a stricter or additional one, as `<DOM>-NFR-nnn` in FRS-<DOM>-07.

*Guidance: every NFR states a number, a unit and its measurement conditions (load, data volume, environment, percentile, measurement method). Words such as "fast", "secure" or "scalable" without numbers fail review (REQ-03). Delete guidance lines before submission.*

## 2. NFR Attributes

| Attribute | Rule |
| :--- | :--- |
| ID | `<DOM>-NFR-nnn` |
| Category | ISO/IEC 25010 characteristic or an extension in §3 |
| Statement | The system MUST / SHOULD … |
| Target | Number and unit |
| Measurement conditions | Load, data volume, environment, percentile |
| Verification method | Test, Analysis, Inspection or Demonstration, with the measurement means (load test, restore drill, monitoring probe, audit) |
| Refines | The NFR-01, SEC-01, OPS-01 or LOC-01 target, and SYS-nnn |
| Priority | MoSCoW |
| Phase | R0, P0–P5 |
| Owner | Accountable role |

## 3. Categories

| Category | Sub-characteristics to consider |
| :--- | :--- |
| Performance efficiency | Response time, throughput, batch window, resource use |
| Reliability | Availability, fault tolerance, recoverability (RPO, RTO) |
| Security | Confidentiality, integrity, non-repudiation, accountability, authenticity |
| Interaction capability | Learnability, accessibility, user-error protection |
| Maintainability | Modularity, testability, analysability, modifiability |
| Compatibility | Interoperability, co-existence |
| Flexibility | Adaptability, installability, scalability |
| Functional suitability | Correctness of calculations (for example payroll accuracy) |
| Safety | Fail-safe behaviour for plant-safety features |
| Privacy (extension) | Minimisation, consent, purpose limitation, data-principal rights service levels |
| AI quality (extension) | Accuracy, fairness, groundedness, robustness |
| Operability (extension) | Observability, deployability, cost per tenant |
| Localisation (extension) | Languages, formats, statutory change lead time |

## 4. NFR Register

| ID | Category | Statement | Target | Measurement conditions | Verification | Refines | Priority | Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| [<DOM>-NFR-nnn] | [Category] | [Statement] | [Number + unit] | [Conditions] | [Method] | [NFR-01 target, SYS-nnn] | [MoSCoW] | [Pn] |

## 5. Worked Examples

| ID | Category | Statement | Target | Measurement conditions | Verification | Refines | Priority | Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PAY-NFR-001 | Performance efficiency | A gross-to-net run MUST complete within the payroll window | 10,000 employees in under 120 s | Golden salary structures (sheet 13_Salary_Structure) scaled to 10,000 employees with every component populated, India statutory rule pack, production-sized worker | Test (load test per release) | NFR-01 payroll throughput | Must | P1 |
| TIM-NFR-001 | Performance efficiency | Punch ingestion MUST absorb shift-change bursts without loss | 500 events per second sustained per tenant; 0 lost punches | Device simulators for all five Vindhya sites at 06:00 shift change, including offline catch-up of 72 h of queued punches | Test | NFR-01 attendance ingestion | Must | P1 |
| LVE-NFR-001 | Performance efficiency | Leave validation MUST answer while the employee waits | p95 ≤ 1.5 s | 2,000 concurrent employees on mobile and web, tenant of 5,000 employees, ledger with 24 months of history | Test | NFR-01 API latency; LVE-UC-003 | Must | P1 |
| PLT-NFR-001 | Reliability | Interactive service MUST be available | ≥ 99.9% per month | Maintenance outside Indian business hours excluded; synthetic probes every minute | Analysis of monitoring data | NFR-01 availability | Must | P1 |
| PLT-NFR-002 | Reliability | Data loss and recovery MUST stay within limits | RPO 5 min; RTO 1 h | Quarterly restore drill of a full tenant in the cloud region in India | Test (drill record) | NFR-01 recovery | Must | P1 |
| SSV-NFR-001 | Interaction capability | Employee-facing screens MUST conform to WCAG 2.2 AA | 0 critical violations | Automated scan plus manual audit of every SCR in the phase scope, in all four themes | Test | NFR-01 accessibility | Must | P1 |
| INT-NFR-001 | AI quality | Nucleus Talk answers on leave and payroll policy MUST be grounded | ≥ 99% of answers fully supported by cited sources (lower 95% confidence bound) | Curated benchmark of 500 policy questions in English and Hindi, human-graded | Analysis (MET-15) | GOV-11, QPPO-07 | Must | P2 |

## Approval & Sign-off

| Role | Name | Date | Decision | Conditions / comments |
| :--- | :--- | :--- | :--- | :--- |
| Author | Dhanraj Dadhich | 2026-11-05 | Submitted | |
| Peer review moderator | *pending* | | | PR-xxxx |
| PQA (process compliance) | *pending* | | | |
| EPG Lead | *pending* | | | |

## Measurement Data Captured

| Measure | Value | Unit | Notes |
| :--- | :--- | :--- | :--- |
| Size | 5 | sections | |
| Authoring effort | *to be recorded* | person-hours | |
| Review effort (preparation + meeting) | *pending review* | person-hours | From PR-xxxx |
| Review rate | *pending review* | sections / hour | Compare with PPB-02 control limits |
| Requirement volatility | 0 | CRs since baseline | |

## Revision History

| Version | Date | Author | Change summary | CR ref | Approved by |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1.0.0 | 2026-11-05 | Dhanraj Dadhich | Consolidated release | CR-0001 | *pending* |
