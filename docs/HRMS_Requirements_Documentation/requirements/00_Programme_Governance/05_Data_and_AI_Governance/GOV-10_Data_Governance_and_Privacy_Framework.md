<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# GOV-10 — Data Governance and Privacy Framework

| Attribute | Value |
| :--- | :--- |
| Document ID | GOV-10 |
| Title | Data Governance and Privacy Framework |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Data Protection Officer (DPO) |
| Author | Dhanraj Dadhich |
| Reviewed by | CISO, Legal, Enterprise Architect — *pending* |
| Approved by | Data & AI Ethics Board (DAEB) — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | GOV, RDM, TS, VV |
| Related documents | DOC-01, GOV-07, GOV-08, GOV-09, GOV-11, REQ-01, PLT (Platform & Foundations) requirement packs, INT (Intelligence & Agents) requirement packs |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-06 |

---

## 1. Purpose and Scope

This framework sets the rules for owning, classifying, protecting, retaining and using personal and business data in Nucleus Suite. It applies to:

- every process domain (PLT, PPL, TIM, LVE, PAY, CMP, LCY, SSV, CMB, TAL, CTG, EXP, FIN, INT) and every environment (development, test, staging, production);
- every channel (UI, API, voice, business messaging self-service, AI copilot and agents, exports);
- every processing role — Nucleus Suite as a SaaS processor for tenant controllers, and as a controller for its own operational data.

It turns privacy-by-design into **requirements**. Domain requirement packs MUST derive `PLT-NFR` / domain `NFR` items from §14, and those items are traced in REQ-02.

> **Legal status:** references to the Digital Personal Data Protection Act, 2023 (DPDP), its rules, the EU GDPR and Indian labour and tax statutes are summaries of principles for engineering purposes. **All legal interpretations, timelines and retention periods are to be validated by Legal** before baseline (G1). This document does not restate statutory section numbers or penalties.

## 2. Principles

| # | Principle | Engineering meaning |
| :-: | :--- | :--- |
| P1 | Lawful purpose | Every data element is linked to at least one documented purpose and lawful basis in the Record of Processing Activities (RoPA) |
| P2 | Notice and consent | Clear, itemised notice in the user's language at collection; consent captured, versioned and withdrawable where consent is the basis |
| P3 | Purpose limitation | Data is used only for the recorded purpose; any new purpose (including AI training) requires a new assessment |
| P4 | Data minimisation | Collect only the fields the purpose needs; optional fields are explicitly marked |
| P5 | Accuracy | Self-service correction; data quality rules (§7) |
| P6 | Storage limitation | Retention schedule (§8) enforced automatically |
| P7 | Security safeguards | Encryption, least privilege, tenant isolation, logging (§9, §12) |
| P8 | Accountability | Owners named; DPIAs; audit evidence; DAEB oversight |
| P9 | Transparency of AI | AI processing of personal data is disclosed and explainable (GOV-11) |

## 3. Data Governance Organisation

| Role | Responsibility | Assigned to |
| :--- | :--- | :--- |
| Data Owner | Accountable for a data domain: classification, access policy, retention and quality thresholds | Business head of the domain (see §4) |
| Data Steward | Day-to-day definitions, quality monitoring, issue resolution, glossary entries (GOV-06) | Named domain SME |
| Data Custodian | Technical operation: storage, backup, encryption, access implementation | Platform / DBA team |
| DPO | Privacy oversight, DPIAs, rights requests, breach coordination, regulator liaison | DPO (STK-06) |
| CISO | Security controls, incident response | CISO (STK-05) |
| DAEB | Approves high-risk processing and AI uses of personal data | Per GOV-04 / GOV-11 |
| Data Governance Council | Cross-domain standards, master-data decisions, metrics review; meets monthly | Chaired by DPO; members are the Data Owners |

## 4. Data Domains and Ownership

| Domain | Key entities | Data Owner | Steward | Module |
| :--- | :--- | :--- | :--- | :--- |
| Worker | Person, worker, employment, contract worker, dependants, emergency contacts | HR Ops Head | HRIS Analyst | PPL, LCY |
| Organisation | Legal entity, business unit, location, position, job, cost centre, supervisory org | HR Ops Head + Finance | Org Design Analyst | PPL |
| Compensation | Pay grade, salary structure, CTC, allowances, revisions | Compensation & Benefits Lead | C&B Analyst | CMB |
| Time & Leave | Punches, shifts, rosters, overtime, gate passes, leave requests and balances | Plant Head / HR Ops Head | Time Office Lead | TIM, LVE |
| Payroll | Pay results, statutory deductions, bank instructions, tax declarations | Payroll Manager | Payroll Analyst | PAY |
| Talent | Requisitions, candidates, assessments, offers | TA Lead | TA Ops | TAL |
| Performance | Goals, ratings, calibration, feedback | CHRO delegate | Talent Analyst | TAL |
| Learning & Skills | Courses, completions, skills, certifications | Capability Lead | L&D Analyst | TAL |
| Platform | Users, roles, consent, audit logs, configuration | CIO / CISO | Platform Admin | PLT |
| Analytics | Derived metrics, models, features | CHRO + Head of AI | Analytics Lead | INT |

## 5. Data Classification

| Class | Definition | HR examples | Minimum controls |
| :--- | :--- | :--- | :--- |
| **Public** | Approved for public release | Published job postings, company holidays page | Integrity controls |
| **Internal** | Business data; low harm if disclosed internally | Org chart (names, titles), policy documents, aggregate headcount | Authentication; tenant isolation |
| **Confidential** | Personal or business data causing harm if disclosed | Contact details, date of birth, job history, performance ratings, leave balances, attendance records, candidate CVs | RBAC/ABAC; encryption in transit and at rest; access logged for bulk reads and exports |
| **Restricted** | Highly sensitive personal data — severe harm, regulatory exposure | PAN, Aadhaar number, bank account / IFSC, salary / CTC / payslips, tax declarations, health and medical data, disability status, biometric templates, background-check results, disciplinary / grievance records, caste / religion (where collected for statutory reporting), children's data | All Confidential controls **plus**: field-level encryption or tokenisation; masked by default; reveal-on-demand with purpose and logging; excluded from non-production environments (synthetic or masked data only); excluded from AI training unless DAEB-approved; export watermarking |

**Rules:**

- **R-CLS-01:** Every attribute in every module data model (data model and interface format, DA-01, ICD-01) MUST carry a classification tag.
- **R-CLS-02:** Derived data inherits the highest classification of its inputs unless it has been anonymised and that anonymisation verified (§13).
- **R-CLS-03:** Aadhaar is stored only where a lawful requirement exists, and then in tokenised / masked form. Use of Aadhaar is subject to the specific rules that apply to it — **to be validated by Legal**.
- **R-CLS-04:** Biometric raw images are not retained. Only templates are processed, under explicit notice. Device-held templates follow the vendor DPA (SAM-01).
- **R-CLS-05:** Salary masking for plant supervisors (GOV-08 §4) applies in every channel.

## 6. Master Data Governance

| Master data | System of record | Golden-record rule | Change authority |
| :--- | :--- | :--- | :--- |
| Worker identity | Nucleus Suite PPL | One person ID per human across rehires, contractor→employee conversions and multiple employments; duplicates resolved by matching rules (name + DoB + government ID token) | HRBP with steward approval |
| Organisation structure | Nucleus Suite PPL | Effective-dated; no orphan positions; one supervisory parent per org | HR Ops Head |
| Cost centre / GL accounts | Tenant ERP | Synced inbound; Nucleus Suite does not originate them | Finance |
| Locations / establishments | Nucleus Suite PPL / CMP | Linked to statutory registrations (PF, ESI, PT, factory licence) | HR Ops + Legal |
| Pay components | Nucleus Suite CMB / PAY | Versioned; statutory flags mandatory | Payroll Manager |
| Skills ontology | Nucleus Suite TAL | Curated taxonomy with synonyms; AI-suggested skills require steward or employee confirmation | Capability Lead |
| Picklists / reference codes | Nucleus Suite PLT | Centrally managed catalogue; localised labels | Data Steward |

All master data is **bi-temporal**: it records both the effective date (when the fact is true in the business) and the transaction date (when it was entered into the system). This lets the system answer "what did we know, and when?".

## 7. Data Quality Management

| Dimension | Definition | Example rule | Threshold (production) |
| :--- | :--- | :--- | :--- |
| Completeness | Mandatory attributes populated | Every active worker has a position, cost centre, location and manager | ≥ 99.5% |
| Validity | Values conform to format and domain | PAN format valid; IFSC exists in reference list; email RFC-compliant; phone +91 format | ≥ 99.9% |
| Accuracy | Values reflect reality | Bank account verification (penny-drop or equivalent, where enabled) | ≥ 99.5% verified before first salary |
| Consistency | No contradictions across domains | Payroll location = worker location on the pay date | 100% (blocking) |
| Uniqueness | No duplicates | One active employment per person per legal entity unless concurrent employment is allowed | 100% |
| Timeliness | Data available when needed | Attendance finalised before payroll stage 3 cut-off | 100% (blocking for payroll) |
| Integrity | Valid relationships on the effective date | Position, job and supervisory org valid on the transaction's effective date | 100% (blocking) |

**Operation:**

1. Rules are defined by stewards and implemented as validation services (PLT domain).
2. Quality dashboards are reviewed monthly by the Data Governance Council.
3. A blocking-rule breach stops the dependent process (e.g. payroll lock).
4. Migration data must pass these thresholds before cut-over (migration requirements and test strategy, QA-03).

## 8. Retention and Disposal Schedule

| Record category | Retention trigger | Indicative period | Basis | Disposal method |
| :--- | :--- | :--- | :--- | :--- |
| Payroll registers, payslips, pay results | End of financial year | Per applicable tax, wage and social-security statutes — **to be confirmed by Legal** (commonly several years) | Statutory | Anonymise personal identifiers beyond retention; keep aggregated statutory figures |
| PF / ESI / PT / TDS filings and challans | Filing date | Per statute — **to be confirmed by Legal** | Statutory | Move to restricted long-term storage, then purge |
| Factories Act registers (muster roll, overtime, accident notices, inspection book) | Register closure | Per Factories Act and state rules — **to be confirmed by Legal** (e.g. muster roll at least 3 years per programme rules) | Statutory | Move to restricted long-term storage, then purge |
| Attendance raw punches | Pay period lock | Duration needed for disputes and statute — **to be confirmed by Legal** | Statutory / legitimate use | Purge raw data; keep the processed register |
| Biometric templates | Separation or consent withdrawal | Deleted promptly after the purpose ends — **to be confirmed by Legal** | Consent / purpose | Cryptographic erasure; vendor deletion certificate |
| Candidate data (not hired) | Requisition closure | Short period, e.g. 6–12 months, unless the candidate consents to talent-pool retention — **to be confirmed by Legal** | Consent | Delete or anonymise |
| Employee master and employment history | Separation | Period covering statutory, gratuity and dispute obligations — **to be confirmed by Legal** | Statutory / legitimate use | Anonymise |
| Performance and calibration records | Cycle close | Defined by HR policy — **to be confirmed by Legal** | Contract / legitimate use | Delete or anonymise |
| Audit logs (access events, state transitions) | Event date | Period aligned with the longest dependent record retention | Accountability | Move to write-once long-term storage, then purge |
| AI prompts / conversation logs | Interaction | Minimal (e.g. 30–90 days) unless needed for incident investigation | Legitimate use / consent | Delete; aggregated telemetry only |
| Backups | Backup date | Rolling window per CONT plan | Operational | Expire; erasure requests applied on restore |

**Retention rules:**

- **R-RET-01:** Retention is configured per tenant and jurisdiction, and enforced by a scheduled disposal service that keeps an evidence log.
- **R-RET-02:** A legal hold suspends disposal for named records.
- **R-RET-03:** An erasure request is reconciled against statutory retention. Personal identifiers are removed or pseudonymised; statutory payroll records are kept in anonymised or legally required form only.

## 9. Sensitive-Access Audit Logging

- **R-AUD-01:** Every reveal, view, export, print or API read of Restricted data creates an immutable `access_event` containing:
  - actor ID, role and tenant;
  - purpose code;
  - record reference;
  - fields accessed;
  - timestamp (UTC);
  - IP address / device;
  - channel (UI, API, voice, copilot).
- **R-AUD-02:** Every state transition of a business record logs actor, previous state, new state, timestamp and comments (aligned with approval-workflow rules).
- **R-AUD-03:** Logs are tamper-evident (hash-chained or write-once storage) and are readable only by Security, the DPO and auditors (PER-15).
- **R-AUD-04:** Monthly access-review reports go to Data Owners. Anomalous access (volume spikes, off-hours bulk reads) raises alerts to the CISO.

## 10. Data Principal (Data Subject) Rights

| Right | Channel | Workflow | Statutory constraint |
| :--- | :--- | :--- | :--- |
| Notice / information | Privacy centre in S8; candidate portal | Itemised notice per purpose, versioned | — |
| Access / summary of personal data | S8 "My Data" export; request queue (S10 privacy workspace) | Automated report of data held, purposes and recipients | Timelines per statute — **to be validated by Legal** |
| Correction / completion | Self-service edit or request | Steward review for verified fields (e.g. PAN) | — |
| Erasure | Request queue | Checks against statutory retention (R-RET-03) → erase or anonymise → confirmation with reasons for any data retained | Statutory retention overrides |
| Consent withdrawal | Consent dashboard | Stops the consent-based processing; explains consequences | Processing already done stays lawful |
| Grievance redressal | Privacy grievance form; DPO contact | Tracked to closure with SLA | Escalation to regulator possible |
| Nomination (DPDP) | Profile setting | Nominee recorded for exercising rights on death or incapacity | — |
| Objection to automated decisions (GDPR context) | Request queue | Human review (GOV-11 §7) | Where GDPR applies |

**Children's data:** Nucleus Suite does not target children. Where minors' data is processed — dependants or nominees for benefits, or apprentices / young workers where legally employed — verifiable parental or guardian consent and restrictions on tracking and profiling apply, as required by the DPDP Act — **to be validated by Legal**. Minors' data is classified Restricted and excluded from AI profiling.

## 11. Personal Data Breach Management

1. Detection → triage by the CISO within 1 h.
2. The DPO is engaged immediately.
3. Containment, then assessment of affected data principals and tenants.
4. Notification per GOV-09 §7.2, covering the Data Protection Board, data principals, controllers under DPAs, and GDPR authorities where applicable. Prescribed form and timelines are **to be validated by Legal**.
5. Breach register entry: ID, date, nature, data categories, counts, actions, notifications made, lessons learned.
6. Causal analysis (CAR) and corrective actions tracked in RSK-03.

## 12. Tenant Isolation, Residency and Cross-Border Transfer

- **R-TEN-01:** Every persisted record carries `tenant_id`. All server-side data access runs inside a tenant-scoped transaction. Cross-tenant queries are prohibited except for anonymised platform telemetry.
- **R-TEN-02:** Encryption keys can be held per tenant (bring-your-own-key, BYOK, available for enterprise tier — see PLT architecture requirements).
- **R-RES-01:** The default data residency for Indian tenants is India-region hosting. The tenant chooses its region at onboarding; that choice is recorded in the contract.
- **R-XBT-01:** Cross-border transfer — for example to an AI model provider or a support centre — is allowed only to jurisdictions not restricted under DPDP government notifications, and with GDPR transfer mechanisms where applicable. Every transfer is recorded in the RoPA and the sub-processor list — **to be validated by Legal**.
- **R-XBT-02:** Sub-processors are disclosed to tenants. Tenants are notified of changes per the DPA.

## 13. Anonymisation, Pseudonymisation and Non-Production Data

- Analytics uses pseudonymised or aggregated data by default. Small-cell suppression applies: no reporting cell with fewer than *k* individuals (default k = 5, configurable).
- Anonymisation techniques are documented and re-identification-tested before data is classified as non-personal.
- **Non-production environments use synthetic data or irreversibly masked data only. Production Restricted data MUST NOT be copied to development or test.** This also applies to the current R0 local JSON prototype, which uses synthetic personas only.

## 14. Data Protection Impact Assessment (DPIA)

**Triggers — a DPIA is mandatory for:**

- biometrics;
- health data;
- large-scale monitoring (geofencing, location, productivity analytics);
- AI profiling or scoring of workers or candidates (also requires the AI impact assessment, AIIA, in GOV-11);
- new cross-border transfers;
- children's data;
- new purposes for existing data;
- any processing the DPO designates as high risk.

**Process:** screening checklist → full DPIA (description, necessity and proportionality, risks to data principals, mitigations, residual risk) → DPO opinion → DAEB approval for high residual risk → requirements raised (`PLT-NFR` / domain NFR) → re-assessment on material change.

## 15. Privacy-by-Design Checklist (Domain Requirement Packs)

Every domain requirement pack (domain pack structure, DOC-01 §3) MUST answer all items below. Any "No" needs a DAR record (DAR-02).

| # | Check |
| :-: | :--- |
| PbD-01 | Each new personal data attribute has a purpose, lawful basis, classification and retention entry |
| PbD-02 | Collection is minimal; optional fields are marked optional |
| PbD-03 | Notice text exists and is localised for each collection point |
| PbD-04 | Restricted fields are masked by default, with logged reveal |
| PbD-05 | Access is server-enforced and scoped by role, organisation and location; salary masking honoured |
| PbD-06 | Exports, reports and business messaging / voice responses respect classification (watermark, row-level security, small-cell suppression) |
| PbD-07 | Retention / disposal behaviour is specified |
| PbD-08 | Rights handling (access, correction, erasure) covers the domain's data |
| PbD-09 | AI and agent use of the data is declared and approved per GOV-11 |
| PbD-10 | Test data is synthetic or masked |
| PbD-11 | Audit events are defined for sensitive reads and state transitions |
| PbD-12 | DPIA screening completed |

## 16. Metrics

| Metric | Target |
| :--- | :--- |
| Attributes with classification tag | 100% before G2 |
| DPIA coverage for triggered processing | 100% before G4 |
| Rights requests closed within statutory timeline | 100% |
| Data quality blocking-rule pass rate at payroll cut-off | 100% |
| Restricted-data incidents in non-production environments | 0 |
| Unreviewed access-review reports older than 30 days | 0 |

## Approval & Sign-off

| Role | Name | Date | Decision | Conditions / comments |
| :--- | :--- | :--- | :--- | :--- |
| Author | Dhanraj Dadhich | 2026-11-05 | Submitted | |
| Peer review moderator | *pending* | | | PR-xxxx |
| PQA (process compliance) | *pending* | | | NC-xxxx if any |
| Data & AI Ethics Board (DAEB) | *pending* | | | |

## Measurement Data Captured

| Measure | Value | Unit | Notes |
| :--- | :--- | :--- | :--- |
| Size | 17 | sections | |
| Authoring effort | *to be recorded* | person-hours | |
| Review effort (preparation + meeting) | *pending review* | person-hours | From PR-xxxx |
| Rework effort | *pending review* | person-hours | |
| Review rate | *pending review* | pages / hour | Compare with PPB-02 control limits |
| Requirement volatility | 0 | CRs since baseline | Not yet baselined (CM-03) |

| Detection phase | Major | Minor | Editorial |
| :--- | :--- | :--- | :--- |
| Author self-check | 0 | 0 | 0 |
| Peer review | *pending* | | |

## 17. Revision History

| Version | Date | Author | Change summary | CR ref | Approved by |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1.0.0 | 2026-11-05 | Dhanraj Dadhich | Consolidated release | CR-0001 | *pending* |
