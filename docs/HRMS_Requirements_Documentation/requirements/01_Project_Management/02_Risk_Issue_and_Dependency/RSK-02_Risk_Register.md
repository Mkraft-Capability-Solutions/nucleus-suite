<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# RSK-02 — Risk Register

| Attribute | Value |
| :--- | :--- |
| Document ID | RSK-02 |
| Title | Risk Register |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Programme Manager |
| Author | Dhanraj Dadhich |
| Reviewed by | Risk owners listed below — *pending* |
| Approved by | Not baselined (living register) |
| Date | 2026-11-05 |
| Classification | Confidential |
| CMMI practice areas | RSK, MC |
| Related documents | RSK-01, RSK-03, GOV-01, GOV-10, GOV-11, SAM-01, MPM-01, PCM-01, DAR-02, PLN-02 |
| Quality & process-performance objectives | QPPO-04 (predictable phase delivery) |
| Process performance baseline used | PPM-02 (schedule risk input) |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-09 |

---

## 1. Purpose

The authoritative list of identified risks and opportunities for the Nucleus Suite programme, scored and managed per RSK-01. Seed entries below were identified during the governance restructure on 2026-11-05 and **must be re-validated by each named owner role at the first fortnightly risk review**.

## 2. Scoring and Coding Reference (from RSK-01)

- **P** = Probability 1–5; **I** = Impact 1–5 (highest dimension); **Score** = P × I.
- Rating: 15–25 Critical · 8–14 High · 4–7 Medium · 1–3 Low.
- **Override:** Impact 5 on compliance, trust or people/safety ⇒ Critical.
- **Categories:** SCP, TEC, AIE, PRV, STA, MIG, SEC, VND, HUM, SCH, CST, QLT, SEM (domain seam), DEC (open decision), RUS (reuse/duplication), OPP (opportunity).
- **Domains:** PLT, PPL, TIM, LVE, PAY, CMP, LCY, SSV, CMB, TAL, CTG, EXP, FIN, INT.
- **Phase** = earliest phase in which the risk is exposed: R0 (current UI-validation prototype, local JSON) · P0 Foundations (wk 1–8) · P1 Core HRMS (wk 9–24) · P2 Pilot & Intelligence (wk 25–40) · P3 Depth (wk 41–64) · P4 Scale (wk 65–96) · P5 Frontier. Phase assignments are **indicative** until phase scope is baselined in PLN-02.

## 3. Register Fields

| Field | Description |
| :--- | :--- |
| ID | `RSK-R-NNN`, never reused |
| Category / Domains | Per §2 |
| Risk statement | Cause → event → effect |
| Goals affected | BG-xx |
| P / I / Score / Rating | Per §2 |
| Owner (role) | Accountable role |
| Response strategy | Avoid / Mitigate / Transfer / Accept / Escalate (threats) · Exploit / Enhance / Share / Accept (opportunities) |
| Response actions | Concrete actions; linked RSK-AC-xxx in RSK-03 |
| Trigger | Observable early-warning signal |
| Contingency | Plan if trigger fires |
| Phase | Per §2 |
| Status | Open / In response / Watching / Closed / Realised (→ issue) |

## 4. Summary Heat Map (seed register, threats only)

| P \ I | 1 | 2 | 3 | 4 | 5 |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **5** | | | | | |
| **4** | | | 016 | 006, 013, 020, 026, 033 | |
| **3** | | | 018, 019, 028, 034 | 008, 012, 014, 015, 017, 021, 023, 024, 025, 027 | 001, 002, 003, 005, 007 |
| **2** | | | 022 | 010, 011 | 004, 009 |
| **1** | | | | | |

**Critical** (by score or override): 001, 002, 003, 004, 005, 006, 007, 009, 013, 020, 026, 033.

## 5. Threat Register

### RSK-R-001 — Statutory payroll calculation error
| Field | Value |
| :--- | :--- |
| Category / Domains | STA / PAY, CMP |
| Statement | Because Indian statutory rules (PF wage ceiling, ESI eligibility threshold, state-specific Professional Tax slabs, TDS under old/new regimes, Code on Wages basic-wage floor) are numerous and change frequently, there is a risk that the payroll engine computes incorrect deductions or net pay, which would result in under/over-payment of employees, incorrect statutory remittances, penalties and loss of customer trust. |
| Goals affected | BG-04, BG-06 |
| P / I / Score | 3 / 5 / 15 — **Critical** |
| Owner | Payroll Domain Lead |
| Strategy | Mitigate |
| Actions | Statutory rule catalogue with effective-dated versions and a named authoritative source per rule; golden-dataset reconciliation of every payroll run against the HRMS Demo Dataset v1.1 expected results (QA-03 §5.2); mandatory parallel payroll runs (≥ 2 cycles) before any customer go-live; second statutory SME peer review of every rule change. |
| Trigger | Any golden-dataset reconciliation failure; parallel-run variance above tolerance (MET-13); statutory notification not yet modelled. |
| Contingency | Block payroll lock for affected population; manual off-cycle correction; customer communication via OCM-01. |
| Phase | P1 |
| Status | Open |

### RSK-R-002 — Non-compliance with DPDP Act 2023 / GDPR
| Field | Value |
| :--- | :--- |
| Category / Domains | PRV / PLT, PPL, all |
| Statement | Because the suite processes extensive personal and sensitive data (identity documents, bank details, health-related leave reasons, biometrics) across all domains, there is a risk that consent, purpose limitation, data-principal rights or retention obligations are not met, which would result in regulatory penalties and reputational harm. |
| Goals affected | BG-06 |
| P / I / Score | 3 / 5 / 15 — **Critical** |
| Owner | Data Protection Officer |
| Strategy | Mitigate |
| Actions | Privacy-by-design checklist in every domain pack (domain pack structure, DOC-01 §3); data inventory and purpose register (GOV-10); DPIA for high-risk processing; consent and rights-request workflows specified in PLT; privacy test cases in QA-03. |
| Trigger | Domain pack reaches G1 without completed data inventory; DPIA open at G2. |
| Contingency | Hold release of affected feature; legal counsel review. |
| Phase | P0 |
| Status | Open |

### RSK-R-003 — AI bias in hiring, calibration or promotion decisions
| Field | Value |
| :--- | :--- |
| Category / Domains | AIE / INT, TAL |
| Statement | Because AI features (candidate ranking, 9-box calibration assistance, attrition prediction, talent marketplace matching) learn from historical data that may encode bias, there is a risk that recommendations systematically disadvantage protected groups, which would result in discriminatory employment outcomes, legal exposure and loss of trust. |
| Goals affected | BG-02, BG-05, BG-06 |
| P / I / Score | 3 / 5 / 15 — **Critical** (override: people/safety) |
| Owner | Head of AI |
| Strategy | Mitigate / Avoid (for fully automated decisions) |
| Actions | Human-in-the-loop mandatory for all employment-affecting decisions (GOV-11); pre-release fairness evaluation (MET-14); explanation for every recommendation; DAEB approval gate; ongoing bias monitoring. |
| Trigger | Fairness metric outside threshold; grievance referencing an AI recommendation. |
| Contingency | Disable feature flag; revert to non-AI workflow; root cause via CAR. |
| Phase | P2 |
| Status | Open |

### RSK-R-004 — Seam S-11: agent action bypasses the permission model
| Field | Value |
| :--- | :--- |
| Category / Domains | SEM, AIE, SEC / INT → all domains |
| Statement | Because Nucleus Talk agents (INT) will execute transactions in every other domain on a user's behalf (seam S-11), there is a risk that an agent acts outside the user's permissions, misinterprets intent, or is manipulated by prompt injection in user-supplied content, which would result in unauthorised data changes or disclosures. |
| Goals affected | BG-02, BG-06 |
| P / I / Score | 2 / 5 / 10 — **Critical** (override: compliance/trust) |
| Owner | Head of AI |
| Strategy | Mitigate / Avoid |
| Actions | Agents call only the same permission-checked domain services as the user — no privileged path; explicit confirmation for every write; allow-listed tools per agent; seam contract test for S-11 in every domain; prompt-injection red-team tests (QA-03 §5.9); audit records carry user + agent identity. |
| Trigger | Red-team bypass; any audit record of an agent write without confirmation. |
| Contingency | Kill-switch to read-only mode for all agents; incident process. |
| Phase | P2 |
| Status | Open |

### RSK-R-005 — LLM hallucination in HR policy and payroll answers
| Field | Value |
| :--- | :--- |
| Category / Domains | AIE / INT, SSV |
| Statement | Because generative models can produce fluent but incorrect answers, there is a risk that Nucleus Talk gives employees wrong information about leave entitlement, pay, tax or policy, which would result in wrong decisions by employees, grievances and liability. |
| Goals affected | BG-02, BG-06 |
| P / I / Score | 3 / 5 / 15 — **Critical** |
| Owner | Head of AI |
| Strategy | Mitigate |
| Actions | Answers grounded only in tenant policy documents and system-of-record data with citations; refusal when grounding confidence is low; numeric answers (balances, pay) computed by deterministic services, never generated; groundedness evaluation set (MET-15). |
| Trigger | Groundedness below threshold; user-reported incorrect answer. |
| Contingency | Restrict assistant to navigation and retrieval-only mode for the affected domain. |
| Phase | P2 (navigation-only voice already in R0 prototype) |
| Status | Open |

### RSK-R-006 — Scope creep from the breadth of the hire-to-retire vision
| Field | Value |
| :--- | :--- |
| Category / Domains | SCP / all |
| Statement | Because the vision covers the full hire-to-retire scope plus beyond-blueprint (P5 Frontier) features, there is a risk that each domain expands continually as new capability ideas are raised, which would result in delayed baselines, schedule slippage and an unfocused P1. |
| Goals affected | BG-01, BG-09 |
| P / I / Score | 4 / 4 / 16 — **Critical** |
| Owner | Product Owner |
| Strategy | Avoid / Mitigate |
| Actions | Phase-scoped MoSCoW per domain baselined at G1; capability coverage matrix (GOV-02) used for roadmap placement, not for P1 scope; beyond-blueprint ideas parked in P5 Frontier; all post-baseline additions via CCB (CM-02); scope volatility metric (MET-04). |
| Trigger | MET-04 above threshold for two consecutive months. |
| Contingency | SteerCo re-baseline; defer Could-haves to later phase. |
| Phase | P0 |
| Status | Open |

### RSK-R-007 — Cross-tenant data leakage
| Field | Value |
| :--- | :--- |
| Category / Domains | SEC / PLT, INT, all |
| Statement | Because the suite is multi-tenant SaaS with shared infrastructure, there is a risk that a defect in tenant scoping (query, cache, search index, analytics or AI retrieval) exposes one tenant's data to another, which would result in a personal data breach and severe reputational damage. |
| Goals affected | BG-06, BG-10 |
| P / I / Score | 3 / 5 / 15 — **Critical** |
| Owner | Security Lead |
| Strategy | Mitigate |
| Actions | Mandatory tenant-scoped transaction wrapper for all data access; database row-level security as defence in depth; tenant isolation test suite including AI retrieval and analytics; ARB review of every new data store; penetration test before pilot (P2). |
| Trigger | Any isolation test failure; code path bypassing the tenant wrapper. |
| Contingency | Incident and breach-notification process (GOV-10). |
| Phase | P0 |
| Status | Open |

### RSK-R-008 — Poor quality of migrated legacy data
| Field | Value |
| :--- | :--- |
| Category / Domains | MIG / PPL, LVE, PAY |
| Statement | Because customers migrate from spreadsheets, legacy HRMS and payroll bureaus with inconsistent data, there is a risk that migrated employee, balance and payroll-history data is incomplete or wrong, which would result in incorrect balances, payroll errors and delayed go-lives. |
| Goals affected | BG-01, BG-04 |
| P / I / Score | 3 / 4 / 12 — High |
| Owner | Migration Lead |
| Strategy | Mitigate |
| Actions | Migration toolkit with validation rules and reconciliation reports (10_Verification_and_Validation); ≥ 2 mock migrations before cut-over; customer data-owner sign-off; opening-balance reconciliation tests. |
| Trigger | Mock migration error rate above threshold. |
| Contingency | Delay cut-over; run legacy in parallel. |
| Phase | P2 (pilot) |
| Status | Open |

### RSK-R-009 — Mishandling of biometric data
| Field | Value |
| :--- | :--- |
| Category / Domains | PRV, SEC / TIM, PLT |
| Statement | Because attendance uses biometric devices and potentially face recognition for plant workers, there is a risk that biometric templates are stored, transmitted or retained improperly, which would result in irreversible harm to individuals and serious legal exposure. |
| Goals affected | BG-03, BG-06 |
| P / I / Score | 2 / 5 / 10 — **Critical** (override) |
| Owner | Data Protection Officer |
| Strategy | Avoid / Mitigate |
| Actions | Prefer on-device matching so only match events (not templates) reach the suite; explicit consent and non-biometric alternative; encryption and strict retention; DPIA before any biometric feature; supplier DPA clauses (SAM-01). |
| Trigger | Design requiring central template storage; supplier unable to meet terms. |
| Contingency | Fall back to non-biometric punch methods. |
| Phase | P1 |
| Status | Open |

### RSK-R-010 — Offline sync conflicts at plants
| Field | Value |
| :--- | :--- |
| Category / Domains | TEC / TIM, CTG |
| Statement | Because plant locations have intermittent connectivity and attendance is captured offline-first, there is a risk that punches, gate passes or roster changes conflict or duplicate when devices resync, which would result in wrong attendance, overtime and pay. |
| Goals affected | BG-03, BG-04 |
| P / I / Score | 2 / 4 / 8 — High |
| Owner | Chief Architect |
| Strategy | Mitigate |
| Actions | Deterministic conflict-resolution rules specified in the TIM domain pack; idempotent event IDs; sync reconciliation report for supervisors; offline test scenarios (QA-03). |
| Trigger | Duplicate or orphan punch rate above threshold in pilot. |
| Contingency | Supervisor manual reconciliation before payroll cut-off. |
| Phase | P1 |
| Status | Open |

### RSK-R-011 — Union or works-council resistance at plants
| Field | Value |
| :--- | :--- |
| Category / Domains | HUM / TIM, EXP |
| Statement | Because geofenced and biometric attendance, productivity analytics and AI features can be perceived as surveillance, there is a risk that unions or worker representatives oppose rollout, which would result in delayed adoption or partial deployment. |
| Goals affected | BG-03 |
| P / I / Score | 2 / 4 / 8 — High |
| Owner | OCM Lead |
| Strategy | Mitigate |
| Actions | Early engagement of worker representatives (GOV-07, GOV-09); transparent data-use notices in local languages; lead with worker-benefit features (earned wage access, local-language payslip, leave via voice). |
| Trigger | Formal objection or grievance at pilot site. |
| Contingency | Phased rollout; non-biometric options. |
| Phase | P2 |
| Status | Open |

### RSK-R-012 — Regulatory change in labour codes and tax rules
| Field | Value |
| :--- | :--- |
| Category / Domains | PRV, STA / PAY, CMP |
| Statement | Because labour codes, state rules and tax regimes are subject to change and phased notification, there is a risk that rules change during build or after release, which would result in rework and non-compliant calculations until updated. |
| Goals affected | BG-04 |
| P / I / Score | 3 / 4 / 12 — High |
| Owner | Payroll Domain Lead |
| Strategy | Mitigate |
| Actions | Configuration-driven, effective-dated rule engine (no hard-coded statutory values); regulatory watch with named source (RSK-D-001); rule-change SLA in customer agreements. |
| Trigger | New notification published. |
| Contingency | Emergency change path via CCB (CM-02). |
| Phase | P1 |
| Status | Open |

### RSK-R-013 — Key-person dependency
| Field | Value |
| :--- | :--- |
| Category / Domains | HUM / all |
| Statement | Because domain knowledge (statutory payroll, product vision, architecture) is concentrated in a few individuals, there is a risk that loss or unavailability of one person stalls decisions or delivery, which would result in schedule slippage and knowledge loss. |
| Goals affected | BG-09 |
| P / I / Score | 4 / 4 / 16 — **Critical** |
| Owner | Programme Manager |
| Strategy | Mitigate |
| Actions | Named deputies for every governance role (GOV-07); knowledge captured in domain packs; pairing; OT-01 cross-training. |
| Trigger | Any key role without a deputy at G0. |
| Contingency | Engage implementation partner SMEs (SAM-01). |
| Phase | R0 |
| Status | Open |

### RSK-R-014 — Seam S-06: unbalanced or rejected payroll journal (PAY → FIN)
| Field | Value |
| :--- | :--- |
| Category / Domains | SEM, TEC, VND / PAY → FIN |
| Statement | Because the payroll outbox must post GL journals to multiple ERPs (ERP system) with differing chart-of-accounts and voucher formats, there is a risk that a journal is unbalanced, mis-mapped or rejected, which would result in a failed month-end close for customers. |
| Goals affected | BG-04, BG-07 |
| P / I / Score | 3 / 4 / 12 — High |
| Owner | Integration Lead |
| Strategy | Mitigate |
| Actions | Double-entry balance check (total debits = total credits) as a hard gate before export; seam contract test S-06; sandbox certification with each ERP partner (RSK-D-002); reconciliation report. |
| Trigger | Partner sandbox rejects test vouchers; any unbalanced journal in testing. |
| Contingency | Manual journal export as interim. |
| Phase | P1 |
| Status | Open |

### RSK-R-015 — Performance and scalability at enterprise volumes
| Field | Value |
| :--- | :--- |
| Category / Domains | TEC / PLT, PAY, INT |
| Statement | Because bi-temporal history, real-time payroll previews and analytics multiply data volume, there is a risk that response times and payroll run durations degrade for large tenants, which would result in unacceptable experience and missed payroll cut-offs. |
| Goals affected | BG-01, BG-10 |
| P / I / Score | 3 / 4 / 12 — High |
| Owner | Chief Architect |
| Strategy | Mitigate |
| Actions | Verify against the NFR targets in 05_System_Requirements (do not set separate targets here); performance test with representative synthetic volumes before pilot and again before P4 Scale; capacity model. |
| Trigger | Performance NFR measurement outside target (MET-27). |
| Contingency | Optimise / scale out; restrict feature for large tenants. |
| Phase | P2 (exposure grows through P4) |
| Status | Open |

### RSK-R-016 — Prototype-to-production gap
| Field | Value |
| :--- | :--- |
| Category / Domains | TEC, SCH / PLT, all |
| Statement | Because the current stage (R0) validates UI against local JSON with in-memory mutations, there is a risk that behaviour assumed in the prototype cannot be supported by production services, authorisation and data rules, which would result in rework and schedule slip in P0–P1. |
| Goals affected | BG-01, BG-09 |
| P / I / Score | 4 / 3 / 12 — High |
| Owner | Chief Architect |
| Strategy | Mitigate |
| Actions | Every prototype screen traced to FR and service contract in REQ-02 before G2; client-side checks treated as UX only; server-side authorisation specified per FR. |
| Trigger | FRs reaching G2 without a service contract. |
| Contingency | Re-plan P1 scope via CCB. |
| Phase | P0 |
| Status | Open |

### RSK-R-017 — Voice recognition accuracy in Indian languages
| Field | Value |
| :--- | :--- |
| Category / Domains | TEC, HUM / INT, SSV |
| Statement | Because frontline users speak many languages, accents and code-mixed speech in noisy plant environments, there is a risk that voice commands are misrecognised, which would result in wrong actions, frustration and low adoption of Nucleus Talk. |
| Goals affected | BG-02, BG-03 |
| P / I / Score | 3 / 4 / 12 — High |
| Owner | Head of AI |
| Strategy | Mitigate |
| Actions | Confirmation before any action; per-language accuracy evaluation set (MET-20); touch fallback for every voice action; noise testing at pilot plant. |
| Trigger | Command success rate below threshold in pilot. |
| Contingency | Limit voice to navigation in affected languages. |
| Phase | P2 |
| Status | Open |

### RSK-R-018 — LLM vendor dependency and cost escalation
| Field | Value |
| :--- | :--- |
| Category / Domains | VND, CST / INT |
| Statement | Because AI features depend on third-party model providers, there is a risk of price increases, model deprecation, rate limits or terms changes, which would result in cost overruns, degraded features or forced re-engineering. |
| Goals affected | BG-02, BG-10 |
| P / I / Score | 3 / 3 / 9 — High |
| Owner | Vendor Manager |
| Strategy | Mitigate / Transfer |
| Actions | Provider-abstraction layer; evaluation suite enabling model swap; per-tenant usage metering and budgets; contract terms per SAM-01 §6. |
| Trigger | Cost per active user above budget; deprecation notice. |
| Contingency | Switch provider or self-host for affected workload. |
| Phase | P2 |
| Status | Open |

### RSK-R-019 — Accessibility non-conformance
| Field | Value |
| :--- | :--- |
| Category / Domains | QLT / EXP, SSV, all UI |
| Statement | Because the suite has dense dashboards and custom interactions, there is a risk that screens fail WCAG 2.2 AA, which would result in exclusion of users with disabilities and procurement disqualification. |
| Goals affected | BG-01, BG-06 |
| P / I / Score | 3 / 3 / 9 — High |
| Owner | UX Lead |
| Strategy | Mitigate |
| Actions | Accessibility acceptance criteria in the screen specification format (FRS-<DOM>-04); automated and manual accessibility tests (QA-03); MET-23. |
| Trigger | MET-23 below threshold. |
| Contingency | Release blocked for affected screens at G4. |
| Phase | P1 |
| Status | Open |

### RSK-R-020 — Governance and process adoption lag (CMMI ML5 goal)
| Field | Value |
| :--- | :--- |
| Category / Domains | QLT, HUM / programme |
| Statement | Because the governance framework is newly defined and the team is accustomed to lightweight prototype delivery, there is a risk that processes are not followed or evidence is not produced, which would result in failure to demonstrate defined-process (ML3) capability — the prerequisite for ML4–ML5 — and uncontrolled baselines. |
| Goals affected | BG-09 |
| P / I / Score | 4 / 4 / 16 — **Critical** |
| Owner | EPG Lead |
| Strategy | Mitigate |
| Actions | OT-01 process training; standard artefact formats and automated checks that produce evidence as a side-effect; PQA audits per QA-01; proportionate tailoring (PCM-01). |
| Trigger | PQA non-conformances open > 30 days (MET-25). |
| Contingency | SteerCo intervention; dedicated process coach. |
| Phase | R0 |
| Status | Open |

### RSK-R-021 — Localisation and RTL defects across 11 languages
| Field | Value |
| :--- | :--- |
| Category / Domains | QLT / EXP, SSV, all UI |
| Statement | Because the suite supports 11 languages including right-to-left Arabic, there is a risk of untranslated strings, truncation, wrong number/date/currency formats and broken RTL layouts, which would result in poor usability for non-English users. |
| Goals affected | BG-03 |
| P / I / Score | 3 / 4 / 12 — High |
| Owner | Localisation Lead |
| Strategy | Mitigate |
| Actions | All strings externalised; pseudo-localisation tests; RTL visual tests; native-speaker validation per language before G4. |
| Trigger | Translation completeness below threshold at G3. |
| Contingency | Release language as beta; English fallback. |
| Phase | P1 |
| Status | Open |

### RSK-R-022 — Estimation uncertainty for P5 Frontier features
| Field | Value |
| :--- | :--- |
| Category / Domains | SCH, CST / INT |
| Statement | Because beyond-blueprint features (organisation digital twin, autonomous multi-step agents) have no internal historical data, there is a risk that estimates are significantly wrong, which would result in P5 schedule and cost overrun. |
| Goals affected | BG-02, BG-08 |
| P / I / Score | 2 / 3 / 6 — Medium |
| Owner | Delivery Lead |
| Strategy | Mitigate |
| Actions | Time-boxed spikes before estimation; three-point estimates (PLN-03); feature-flagged incremental delivery. |
| Trigger | Spike reveals unknown dependencies. |
| Contingency | Move to later horizon via CCB. |
| Phase | P5 |
| Status | Open |

### RSK-R-023 — Seam S-01: attendance recompute after payroll lock (TIM → PAY)
| Field | Value |
| :--- | :--- |
| Category / Domains | SEM, STA / TIM → PAY |
| Statement | Because attendance can change after the payroll cut-off (late regularisations, offline punches syncing, supervisor corrections), there is a risk that attendance is recomputed after the payroll period is locked, which would result in pay that no longer matches attendance, silent overwrites of locked data or unreconciled arrears. |
| Goals affected | BG-03, BG-04 |
| P / I / Score | 3 / 4 / 12 — High |
| Owner | Payroll Domain Lead (with Time & Attendance Lead) |
| Strategy | Mitigate |
| Actions | Seam contract S-01: locked periods are immutable; post-lock changes create effective-dated adjustments that flow to the next payroll as arrears/recovery; seam test cases seeded from the 21_Expected_Attendance golden cases; reconciliation report TIM vs PAY per cycle. |
| Trigger | Any post-lock attendance change without a matching PAY adjustment record. |
| Contingency | Freeze TIM edits for locked periods; manual arrears run. |
| Phase | P1 |
| Status | Open |

### RSK-R-024 — Seam S-02: leave versus punch conflict (LVE → TIM)
| Field | Value |
| :--- | :--- |
| Category / Domains | SEM / LVE → TIM |
| Statement | Because an employee can have approved leave and attendance punches on the same day (half-day leave, cancelled leave, forgotten leave withdrawal), there is a risk that LVE and TIM disagree on the day status, which would result in double counting, wrong leave balances (INV-LEV-01) and wrong pay. |
| Goals affected | BG-01, BG-04 |
| P / I / Score | 3 / 4 / 12 — High |
| Owner | Time & Attendance Lead (with Leave Lead) |
| Strategy | Mitigate |
| Actions | Seam contract S-02 defining precedence and resolution rules; exception queue for supervisors; seam tests from golden dataset; leave balance invariant tests. |
| Trigger | Conflict count above threshold in golden reconciliation or pilot. |
| Contingency | Supervisor exception resolution before payroll cut-off. |
| Phase | P1 |
| Status | Open |

### RSK-R-025 — Seam S-07: ERP-owned fields overwritten (FIN → PPL)
| Field | Value |
| :--- | :--- |
| Category / Domains | SEM / FIN → PPL |
| Statement | Because some worker attributes (e.g. cost centre, legal entity, GL mapping) are mastered in the customer's ERP while others are mastered in PPL, there is a risk that a sync overwrites fields owned by the other system, which would result in wrong cost allocation, broken approval routing and journal mis-postings. |
| Goals affected | BG-01, BG-07 |
| P / I / Score | 3 / 4 / 12 — High |
| Owner | Integration Lead |
| Strategy | Mitigate |
| Actions | Field-level system-of-record matrix in the FIN/PPL seam contract; sync rejects writes to non-owned fields; audit of every cross-system update; seam test S-07. |
| Trigger | Any audit record showing a non-owner write. |
| Contingency | Roll back via effective-dated history; disable inbound sync for the field. |
| Phase | P1 |
| Status | Open |

### RSK-R-026 — Open decisions block the backlog
| Field | Value |
| :--- | :--- |
| Category / Domains | DEC, SCH / PLT, all |
| Statement | Because foundational open decisions (OD-nn) remain unresolved — e.g. OD-01 Node framework choice (NestJS vs Fastify) blocks BL-001 — there is a risk that P0 Foundations cannot start or proceeds on assumptions that later change, which would result in idle capacity, rework and slippage of every downstream phase. |
| Goals affected | BG-09, BG-01 |
| P / I / Score | 4 / 4 / 16 — **Critical** |
| Owner | Programme Manager (decision owners per OD) |
| Strategy | Mitigate |
| Actions | Every OD-nn logged in DAR-02 with decision owner, due date and blocked BL items; DAR-01 evaluation for each; OD ageing reported weekly; decision deadlines set relative to blocked BL start dates. |
| Trigger | Any OD past due date or blocking a BL item scheduled within 2 weeks. |
| Contingency | Steering Committee decides at next meeting using DAR-01 evidence available. |
| Phase | P0 |
| Status | Open |

### RSK-R-027 — Shared component re-implemented inside a domain
| Field | Value |
| :--- | :--- |
| Category / Domains | RUS, TEC / all |
| Statement | Because 11 shared components (CMP-nn — e.g. CMP-01 workflow & approval engine with 13 consuming domains) must be built once and consumed everywhere, there is a risk that teams under schedule pressure build local equivalents, which would result in inconsistent behaviour (e.g. different approval or delegation rules per domain), duplicated effort and multiplied defects. |
| Goals affected | BG-07, BG-09 |
| P / I / Score | 3 / 4 / 12 — High |
| Owner | Chief Architect |
| Strategy | Avoid |
| Actions | Anti-repeat-work rule (PCM-01 §5.4): re-implementing a shared component is a design defect; mandatory reuse check in peer review (QA-02 checklist R-5); ARB approval required for any exception; CMP consumer map maintained. |
| Trigger | Peer review finds a local workflow/approval/notification/audit implementation. |
| Contingency | Refactor to shared component before G3. |
| Phase | P0 |
| Status | Open |

### RSK-R-028 — Remaining domain seams without contracts
| Field | Value |
| :--- | :--- |
| Category / Domains | SEM / cross-domain |
| Statement | Because the 12 domain seams (S-01..S-12) each hand data or control from one domain to another, there is a risk that seams not covered by an explicit contract and seam test (beyond S-01, S-02, S-06, S-07, S-11 above) fail at integration, which would result in late discovery of defects at system test or in pilot. |
| Goals affected | BG-01, BG-07 |
| P / I / Score | 3 / 3 / 9 — High |
| Owner | Chief Architect |
| Strategy | Mitigate |
| Actions | Each seam has an owner pair, contract (08_Integration_and_API) and seam test set in QA-03 §4 before G2; seam coverage tracked in REQ-02. |
| Trigger | Seam reaching G2 without contract or tests. |
| Contingency | Add seam-specific risk entry and integration spike. |
| Phase | P1 |
| Status | Open |

### RSK-R-033 — Insufficient historical data for statistically valid baselines (ML4–ML5)
| Field | Value |
| :--- | :--- |
| Category / Domains | QLT, SCH / programme |
| Statement | Because the programme is new (R0 prototype → P0) and has no organisational history, there is a risk that process performance baselines (PPB-xx) and process performance models (PPM-xx) are built on too few data points, or on data from unstable processes, which would result in misleading control limits, wrong predictions and failure to evidence quantitative management at CMMI ML4–ML5. |
| Goals affected | BG-09 |
| P / I / Score | 4 / 4 / 16 — **Critical** |
| Owner | EPG Lead (with Measurement Analyst) |
| Strategy | Mitigate / Accept (time-bound) |
| Actions | Start collecting base measures from P0 day one (MPM-01 §6); mark early baselines as *provisional* until the minimum data-point rule is met (MPM-01 §8.2: ≥ 20 points for XmR, recompute after process change); use pooled / industry reference ranges only as labelled priors, never as targets; prove stability before computing capability; schedule ML4 evidence window from P2 and ML5 from P3 onwards (PCM-01 §9). |
| Trigger | Any sub-process selected for statistical management with < 20 points at a gate; baseline recomputed > 2 times in a quarter. |
| Contingency | Manage the sub-process with RAG thresholds only (MC-01 §4) and defer statistical claims; shift appraisal date. |
| Phase | P0 |
| Status | Open |

### RSK-R-034 — Measurement data quality undermines quantitative management
| Field | Value |
| :--- | :--- |
| Category / Domains | QLT / programme |
| Statement | Because base measures (review size and effort, defect origin, story cycle times) are captured manually by many people, there is a risk of missing, inconsistent or gamed data, which would result in invalid PPBs/PPMs and wrong management decisions. |
| Goals affected | BG-09 |
| P / I / Score | 3 / 3 / 9 — High |
| Owner | Measurement Analyst |
| Strategy | Mitigate |
| Actions | Capture measures automatically from tools where possible (PR metadata, tracker timestamps); operational definitions per measure (MPM-01 §7); monthly data-quality checks (completeness, validity, consistency); measures used for process improvement, never for individual performance appraisal. |
| Trigger | Data completeness < 95% for a base measure in a month. |
| Contingency | Exclude affected period from baseline; corrective action via CAR-01. |
| Phase | P0 |
| Status | Open |

## 6. Opportunity Register

### RSK-R-029 — Voice-first frontline experience as a differentiator
| Field | Value |
| :--- | :--- |
| Category / Domains | OPP / INT, SSV, TIM |
| Statement | Because frontline and plant workers often have limited literacy, shared devices and busy hands, there is an opportunity that multilingual voice-first self-service (Nucleus Talk) wins manufacturing and frontline-heavy customers. |
| P / Benefit / Score | 3 / 4 / 12 |
| Owner | Product Owner |
| Strategy | Enhance |
| Actions | Prioritise voice journeys for top frontline tasks (punch, leave, payslip) for the P2 pilot; pilot plant case study. |
| Status | Open |

### RSK-R-030 — Statutory rule engine delivered as configurable content packs
| Field | Value |
| :--- | :--- |
| Category / Domains | OPP / PAY, CMP |
| Statement | Because the payroll rule engine is configuration-driven and effective-dated, there is an opportunity to deliver new states and countries as content packs rather than code, reducing time-to-market in P4 Scale. |
| P / Benefit / Score | 3 / 4 / 12 |
| Owner | Payroll Domain Lead |
| Strategy | Exploit / Share |
| Actions | Define rule-pack format in the PAY domain pack; evaluate statutory content partners (SAM-01). |
| Status | Open |

### RSK-R-031 — Shared components accelerate every domain
| Field | Value |
| :--- | :--- |
| Category / Domains | OPP / all |
| Statement | Because 11 shared components (CMP-nn) serve many domains, there is an opportunity that investing early in their quality in P0 shortens delivery of every later domain. |
| P / Benefit / Score | 3 / 4 / 12 |
| Owner | Chief Architect |
| Strategy | Exploit |
| Actions | Schedule CMP-01 and other high-consumer components first in P0; publish consumer guides. |
| Status | Open |

### RSK-R-032 — Process evidence automation
| Field | Value |
| :--- | :--- |
| Category / Domains | OPP / programme |
| Statement | Because requirements, reviews and changes are kept as version-controlled Markdown with a strict ID scheme, there is an opportunity to auto-generate traceability and audit evidence, reducing CMMI overhead. |
| P / Benefit / Score | 3 / 3 / 9 |
| Owner | EPG Lead |
| Strategy | Exploit |
| Actions | Scripted RTM consistency checks against the ID scheme (DOC-01 §7). |
| Status | Open |

## 7. Closed Risks

None at v0.1.

## Approval & Sign-off

| Role | Name | Date | Decision | Conditions / comments |
| :--- | :--- | :--- | :--- | :--- |
| Author | Dhanraj Dadhich | 2026-11-05 | Submitted | |
| Peer review moderator | *pending* | | | PR-xxxx |
| PQA (process compliance) | *pending* | | | NC-xxxx if any |
| Not baselined (living register) | *pending* | | | |

## Measurement Data Captured

| Measure | Value | Unit | Notes |
| :--- | :--- | :--- | :--- |
| Size | 8 | sections | |
| Authoring effort | *to be recorded* | person-hours | |
| Review effort (preparation + meeting) | *pending review* | person-hours | From PR-xxxx |
| Rework effort | *pending review* | person-hours | |
| Review rate | *pending review* | pages / hour | Compare with PPB-02 control limits |
| Requirement volatility | 0 | CRs since baseline | Not yet baselined (CM-03) |

| Detection phase | Major | Minor | Editorial |
| :--- | :--- | :--- | :--- |
| Author self-check | 0 | 0 | 0 |
| Peer review | *pending* | | |

## 8. Revision History

| Version | Date | Author | Change summary | CR ref | Approved by |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1.0.0 | 2026-11-05 | Dhanraj Dadhich | Consolidated release | CR-0001 | *pending* |
