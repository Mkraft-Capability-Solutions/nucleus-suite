<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# GOV-03 — Project Charter

| Attribute | Value |
| :--- | :--- |
| Document ID | GOV-03 |
| Title | Project Charter |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Executive Sponsor |
| Author | Dhanraj Dadhich |
| Reviewed by | Programme Manager, Product Owner, PQA Lead — *pending* |
| Approved by | Steering Committee — *pending* |
| Date | 2026-11-05 |
| Classification | Confidential |
| CMMI practice areas | GOV, PLAN |
| Related documents | GOV-01, GOV-04, GOV-07, PLN-01, PLN-02, PLN-03, RSK-02, QA-01 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 – BG-10 |
| Source inputs | Nucleus Technical & Functional Blueprint v1.1; Process Flows & Process Maps v1.0; HR Demo Points Build Sheet v1.0 |

---

## 1. Purpose

This charter formally **authorises the Nucleus Suite programme**, names its sponsor and programme manager, delegates authority to apply resources, and records the high-level scope, objectives, milestones, constraints and success criteria agreed at Gate G0. Detailed planning lives in PLN-01; this charter is the authority from which that plan derives.

## 2. Programme Identification

| Item | Value |
| :--- | :--- |
| Programme name | Nucleus HRMS Suite — Product Build Programme |
| Programme code | NUC |
| Sponsoring organisation | MultipliersKraft — sponsoring business unit confirmed by the Executive Sponsor at G0 sign-off |
| Executive Sponsor | Role: Chief Executive / Chief Product Officer — name recorded at G0 sign-off (§13) |
| Programme Manager | Role: Programme Manager — name recorded at G0 sign-off (§13) |
| Product Owner | Role: Head of Product — HCM — name recorded at G0 sign-off (§13) |
| Start | 2026 Q4 — R0 UI-validation prototype (local JSON) in progress; P0 week 1 starts on the recorded decision to exit R0 |
| Planned horizon | R0, then P0 Foundations (wk 1–8), P1 Core HRMS (wk 9–24), P2 Pilot & Intelligence (wk 25–40), P3 Depth (wk 41–64), P4 Scale (wk 65–96), P5 Frontier (after wk 96) — see GOV-01 §7, PLN-02 |

## 3. Business Case Summary

### 3.1 Opportunity

Enterprises with mixed office and frontline workforces, especially in Indian manufacturing, services and logistics, currently run HR across several disconnected systems — a core HR record, an outsourced payroll service, a separate attendance system and spreadsheets. This produces reconciliation effort, compliance exposure and poor frontline experience (GOV-01 §2, problems P1–P7).

### 3.2 Proposed Solution

Build Nucleus Suite: a single multi-tenant, AI-native HCM suite with enterprise-grade core HR depth, native Indian statutory payroll, frontline-first time management, governed AI agents and an organisation digital twin (GOV-01 §3, §8).

### 3.3 Expected Benefits

| Benefit | Linked goal | Measured by |
| :--- | :--- | :--- |
| Lower total cost of HR technology ownership for customers (one platform vs. 3–4) | BG-07, BG-10 | Pilot customer total cost of ownership: licence, integration and reconciliation effort before and after go-live, measured over the first two quarters of the P2 pilot |
| Payroll accuracy and faster close | BG-04 | BO-04.1, BO-04.2 |
| Compliance assurance (statutory, privacy) | BG-03, BG-06 | BO-03.2, BO-06.1, BO-06.2 |
| Higher self-service adoption and reduced HR ticket volume | BG-02 | BO-02.1, BO-02.2 |
| Better talent retention and internal mobility | BG-05, BG-08 | BO-05.2, BO-08.3 |
| Recurring SaaS revenue | BG-10 | Subscription revenue per active worker against the finance model approved by the Executive Sponsor and CFO at G0 |

### 3.4 Treatment of Client Requirements

The 26 client demo points (R-01..R-27) are in scope. Any status recorded in client trackers (Implemented / WIP / Done) is disregarded for baseline purposes: each is a new requirement to be specified, traced and verified under this programme.

### 3.5 Options Considered

| Option | Summary | Disposition |
| :--- | :--- | :--- |
| O1 | Do nothing / continue prototype only | Rejected — no market entry |
| O2 | Build India-only payroll + attendance product | Rejected — does not meet BG-01, BG-02 or BG-05 |
| O3 | **Build full AI-native HCM suite in phases P0–P5 after R0 validation** | **Selected** — recorded as DEC-0001 in DAR-02 |
| O4 | Build on top of a third-party HCM platform | Rejected — loses unified object model and AI-native architecture |

## 4. Objectives

The programme objectives are the ten business goals and their measurable objectives defined in GOV-01 §5. Summary:

| Goal | Headline objective for this charter |
| :--- | :--- |
| BG-01 | Hire-to-retire core HCM on a bi-temporal worker model (BO-01.1 – BO-01.3) |
| BG-02 | Agentic, voice-and-chat experience with human-in-the-loop (BO-02.1 – BO-02.3) |
| BG-03 | Frontline and plant workforce excellence (BO-03.1 – BO-03.4) |
| BG-04 | Continuous, compliant payroll (BO-04.1 – BO-04.3) |
| BG-05 | Skills-based talent ecosystem (BO-05.1 – BO-05.3) |
| BG-06 | Trust by design (BO-06.1 – BO-06.4) |
| BG-07 | Composable open platform (BO-07.1 – BO-07.3) |
| BG-08 | Decision intelligence (BO-08.1 – BO-08.3) |
| BG-09 | Process capability at CMMI Maturity Level 5 — quantitative management, CAR, continuous improvement (BO-09.1 – BO-09.6) |
| BG-10 | Scalable multi-tenant SaaS economics (BO-10.1 – BO-10.3) |

## 5. Scope Summary

| In scope | Out of scope |
| :--- | :--- |
| The 14 process domains (PLT, PPL, TIM, LVE, PAY, CMP, LCY, SSV, CMB, TAL, CTG, EXP, FIN, INT) across the L0 value chain HIRE → ONBOARD → WORK → PAY → COMPLY → GROW → EXIT, plus GOVERN, as detailed in GOV-01 §6.2 | Items OS-01 to OS-10 in GOV-01 §6.3 (e.g. ERP general ledger, live disbursement before the P2 pilot, covert monitoring, fully autonomous people decisions) |
| Differentiator themes DT-01 to DT-12 (GOV-01 §8), including P5 Frontier themes | Hardware manufacturing; non-India country payroll before P4 |
| Governance, process, measurement and quality assets required for CMMI ML5 (QPPOs, process-performance baselines and models, CAR) | Customer-specific custom code forks |
| Data migration (MIG-01) and parallel-run support for pilot customers | Customer business process redesign beyond configuration support |

## 6. Milestones and Gates

| Gate | Name | Indicative timing | Key exit evidence | Approver |
| :--- | :--- | :--- | :--- | :--- |
| G0 | Initiation | R0 (2026 Q4) | This charter, GOV-01, GOV-04, PLN-01, RSK-01, CM-01, QA-01 approved; decision to exit R0 recorded in DAR-02 | SteerCo |
| G1 | Requirements Baseline (per phase) | Start of each phase (P0: wk 1) | Functional requirement packs for the phase approved; processes (DOM-nn), rules (RL-nnn), forms (FRM-<MOD>-nn), screens (SCR-nnn) traced in RTM; NFRs baselined; estimates (PLN-03) | Product Council → SteerCo |
| G2 | Design Baseline | P0: wk 3; later phases: phase start + 2–3 wks | ARB-approved architecture, data model, API/integration contracts, reusable components (CMP-nn) | ARB |
| G3 | Test Readiness | Phase end − 3 wks (P1: wk 21) | Build complete; unit/integration green; test cases (TC-xxx) approved | Product Council |
| G4 | Phase Readiness / Go-live | Phase end (P0: wk 8; P1: wk 24; P2: wk 40; P3: wk 64; P4: wk 96) | V&V exit criteria; UAT sign-off; OCM readiness; cut-over plan; security & DPO sign-off | SteerCo |
| G5 | Post-Implementation Review | Go-live + 90 days | Benefits tracking; lessons-learned record (PCM-01); improvement actions | SteerCo |

Gates G1–G5 repeat for each phase P0–P5. Phase windows: GOV-01 §7 and PLN-02. Week numbers are relative to P0 week 1 and remain indicative until baselined at each phase's G1.

## 7. Authority

| Authority | Granted to | Limits |
| :--- | :--- | :--- |
| Approve charter, budget, release scope, go-live | Steering Committee | — |
| Apply approved budget and staff within plan | Programme Manager | Within tolerances in GOV-04 §6 |
| Prioritise backlog within approved release scope | Product Owner | Must not change release scope without CCB |
| Approve architecture and technology choices | Architecture Review Board | Within approved budget |
| Approve AI features and sensitive data uses | Data & AI Ethics Board | Veto authority on GOV-11 grounds |
| Approve/reject change requests | Change Control Board | Per thresholds in CM-02 |

Decision-rights detail: GOV-04 §4.

## 8. Budget and Resources

| Item | Value |
| :--- | :--- |
| Total programme budget | Effort baseline from RB-01: 665 engineer-days across 79 stories for P0–P4, excluding QA and implementation overhead (P5 proposals are unfunded until approved). The monetary budget is approved by the Executive Sponsor at G0 on that basis. |
| Budget by phase | Effort baseline by phase (RB-01): P0 77, P1 320, P2 120, P3 92, P4 56 engineer-days. The Programme Manager converts each into a phase budget, re-estimated with PLN-03 and approved at that phase's G1. |
| Contingency reserve | Risk-based (Σ probability × cost impact of open RSK-02 risks for the phase), with a floor of 10% of baselined effort; held by the Programme Manager and reported to the SteerCo (PLN-03 §7) |
| Management reserve | 10% of each phase budget for unidentified risks; held by the SteerCo and drawn only through an approved CR (PLN-03 §7) |
| Core team (roles) | Product Owner, Programme Manager, BA Lead, Enterprise Architect, Platform Lead, domain tech leads (one per process domain, 14 domains, combined where small), UX Research Lead, QA/Test Lead, PQA Lead, Configuration Manager, Security Lead, DPO, Head of AI, OCM Lead, Integration Lead, Payroll SME, Statutory Compliance SME |
| Staffing plan | PLN-01 §7 |
| Estimation basis | PLN-03 |

## 9. High-Level Risks

The top programme risks identified at initiation are recorded in the Risk Register (RSK-02). Headlines:

| Risk theme | Example | Register |
| :--- | :--- | :--- |
| Statutory complexity and rule change | Payroll/compliance errors at go-live | RSK-02 |
| Scope breadth vs. capacity | enterprise-grade breadth across 14 process domains (49 forms, 860 fields) | RSK-02 |
| AI safety, fairness and regulation | Biased or unexplained AI outcomes | RSK-02 |
| Data privacy and residency | DPDP non-compliance, cross-border transfer | RSK-02 |
| Prototype-to-production transition | R0 in-memory assumptions not holding once P0/P1 live backend starts | RSK-02 |
| Pilot customer availability | Insufficient data for golden tests | RSK-02 |

## 10. Key Assumptions and Constraints

See GOV-01 §10 (A-01 to A-06) and §11 (C-01 to C-07). The most binding constraint is **C-01: the programme is in R0 local JSON UI validation; production backends are not activated without an explicit, recorded programme decision.**

## 11. Success Criteria

The programme is successful when success criteria SC-01 to SC-06 in GOV-01 §9 are met, specifically:

1. R0 prototype validated with all ten persona groups and the 26 client demo points (R-01..R-27).
2. Each phase passes G4 against QA-03 exit criteria.
3. Pilot customer(s) live in P2 (second by end P3) with parallel-run variance within tolerance.
4. Business objectives achieved or formally re-baselined.
5. No unresolved critical compliance findings at any go-live.
6. CMMI ML3 appraisal readiness by end of P3 and ML5 (high maturity) appraisal readiness by end of P4, with quantitative process-performance objectives (QPPO-xx, MPM-01) met or under controlled improvement.

## 12. Stakeholders

The full stakeholder register, RACI and engagement strategy are in GOV-07; communication cadence in GOV-09.

## 13. Approval

| Role | Name | Decision | Signature / reference | Date |
| :--- | :--- | :--- | :--- | :--- |
| Executive Sponsor | *pending* — recorded at G0 | Approve / Reject | | |
| Chief Financial Officer (or delegate) | *pending* — recorded at G0 | Approve / Reject | | |
| Chief Technology Officer | *pending* — recorded at G0 | Approve / Reject | | |
| Head of Product — HCM | *pending* — recorded at G0 | Approve / Reject | | |
| Programme Manager | *pending* — recorded at G0 | Acknowledge | | |

## Approval & Sign-off

| Role | Name | Date | Decision | Conditions / comments |
| :--- | :--- | :--- | :--- | :--- |
| Author | Dhanraj Dadhich | 2026-11-05 | Submitted | |
| Peer review moderator | *pending* | | | PR-xxxx |
| PQA (process compliance) | *pending* | | | NC-xxxx if any |
| Steering Committee | *pending* | | | |

## Measurement Data Captured

| Measure | Value | Unit | Notes |
| :--- | :--- | :--- | :--- |
| Size | 14 | sections | |
| Authoring effort | *to be recorded* | person-hours | |
| Review effort (preparation + meeting) | *pending review* | person-hours | From PR-xxxx |
| Rework effort | *pending review* | person-hours | |
| Review rate | *pending review* | pages / hour | Compare with PPB-02 control limits |
| Requirement volatility | 0 | CRs since baseline | Not yet baselined (CM-03) |

| Detection phase | Major | Minor | Editorial |
| :--- | :--- | :--- | :--- |
| Author self-check | 0 | 0 | 0 |
| Peer review | *pending* | | |

## 14. Revision History

| Version | Date | Author | Change summary | CR ref | Approved by |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1.0.0 | 2026-11-05 | Dhanraj Dadhich | Consolidated release | CR-0001 | *pending* |
