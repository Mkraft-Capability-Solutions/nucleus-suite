<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/MultipliersKraftLogoDark.png">
  <img src="../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# GOV-06 — Glossary and Acronyms

| Attribute | Value |
| :--- | :--- |
| Document ID | GOV-06 |
| Title | Glossary and Acronyms |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Business Analyst Lead |
| Author | Dhanraj Dadhich |
| Reviewed by | Product Council, Statutory Compliance SME — *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM |
| Related documents | DOC-01, GOV-01, GOV-05, GOV-10, GOV-11, MPM-01 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 |
| Source inputs | Process Flows & Process Maps v1.0; Forms & Fields Complete; Technical & Functional Blueprint v1.1 |

---

## 1. Purpose and Rules

This glossary is the **controlled vocabulary** for all requirements, designs, tests and governance documents. A term defined here MUST be used with this meaning everywhere; documents MUST NOT redefine it. New terms are added through the Product Council; definitions that change the meaning of a baselined requirement need a CR (CM-02).

Column **Owner** gives the domain code (GOV-05 §3) or governance area that owns the definition. Statutory definitions summarise the law for orientation only; the authoritative text is the statute and rules as amended — the Statutory Compliance SME validates every statutory entry before baseline.

## 2. Programme Identifiers

| Identifier | Meaning | Owner |
| :--- | :--- | :--- |
| BG-nn | Business goal (GOV-01) | GOV |
| BO-nn.n | Business objective under a goal (GOV-01) | GOV |
| BRQ-nnn | Business requirement (BRS-01); refines BG/BO, refined by STR and realised by SYS | GOV |
| STR-nnn | Stakeholder requirement (STRS-01); traces to at least one BRQ | GOV |
| SYS-nnn | System requirement (SRS-01); realises one or more BRQ | GOV |
| <DOM>-<TYPE>-nnn | Authored requirement, e.g. `PAY-NFR-004`; TYPE includes FR, NFR, BR, SEC, OPS, NOT, RPT, LOC, MIG, INT, AI, UC, US, CG (capability gap) and FX (frontier feature) (REQ-01 §5.2) | Domain |
| <DOM>-CG-nnn | Capability gap; register of record RB-03, status vocabulary GOV-02 §3, leadership register GOV-02 §6 | GOV |
| <DOM>-FX-nnn | Frontier feature; register of record RB-03, leadership register GOV-02 §7 | GOV |
| <DOM>-UC-nnn / <DOM>-US-nnn | Use case (FRS-&lt;DOM&gt;-12) / user story (FRS-&lt;DOM&gt;-13) | Domain |
| CAP-<DOM>-nn | L2 business capability (GOV-05) | GOV |
| CMP-nn | Reusable platform component from the Blueprint (e.g. CMP-01 workflow & approval engine) — distinct from the domain code CMP | PLT |
| DEC-nnnn | Decision record (DAR-02) | DAR |
| DOM-nn / DOM-nn.s | Process / process step from the Process Flows workbook (e.g. TIM-02, TIM-02.3) | Domain |
| DT-nn | Differentiator theme (GOV-01 §8) | GOV |
| FRM-<MOD>-nn | Form from the Forms & Fields workbook | Domain |
| INV-xxx-nn | System invariant (e.g. INV-LEV-01) | Domain |
| OD-nn | Open decision from source workbooks | DAR |
| BL-nnn | Backlog item | PLN |
| QPPO-nn | Quantitative process-performance objective (MPM-01) | MPM |
| R-nn | Client requirement from the HR Demo Points Build Sheet (R-01..R-27) | GOV |
| RL-nnn | Business rule | Domain |
| SCR-nnn | Screen | Domain |
| TC-xxx | Test case | QA (V&V) |

## 3. Domain Codes

| Code | Domain | Code | Domain |
| :--- | :--- | :--- | :--- |
| PLT | Platform & Foundations | CMB | Compensation, Loans & Benefits |
| PPL | People Core | TAL | Talent |
| TIM | Time & Attendance | CTG | Contingent Workforce |
| LVE | Leave | EXP | Experience |
| PAY | Payroll | FIN | Finance & ERP |
| CMP | Compliance | INT | Intelligence & Agents |
| LCY | Lifecycle | SSV | Self-service & Helpdesk |

L0 value-chain stages: **HIRE, ONBOARD, WORK, PAY, COMPLY, GROW, EXIT, GOVERN** (GOV-05 §2).

## 4. Glossary (A–Z)

| Term | Definition | Owner |
| :--- | :--- | :--- |
| 9-Box Grid | 3×3 matrix plotting performance (x-axis) against potential (y-axis) to classify talent into nine boxes from "Risk" to "Star / Future Leader". | TAL |
| 115BAC (New Tax Regime) | Section of the Income Tax Act providing the concessional new personal income-tax regime with fewer exemptions; the default regime unless the employee opts for the old regime. | PAY |
| ABAC (Attribute-Based Access Control) | Authorisation that evaluates attributes of user, resource, action and context (e.g. site, legal entity, purpose) in addition to role. | PLT |
| Acceptance Criteria | Testable conditions a requirement must satisfy to be accepted. | GOV (RDM) |
| Accrual | Periodic crediting of leave entitlement to a worker's balance per policy. | LVE |
| Action Ledger | Append-only record in INT of every agent proposal, policy-gate result, human approval, execution and reversal. | INT |
| Agent (AI Agent) | Software component that plans and executes tasks using tools on behalf of a user, within that user's permissions and subject to the policy gate. | INT |
| Approval Chain | Ordered set of approvers for a transaction defined in CMP-01 (e.g. L1 manager → L2 HRBP). | PLT |
| ARB | Architecture Review Board (GOV-04). | GOV |
| Arrears | Amounts payable to a worker for prior periods due to late or retroactive changes. | PAY |
| As-of Date | The effective date for which data is viewed or a transaction applies. | PPL |
| Audit Trail | Immutable chronological record of who changed what, when, from which value to which value, and why. | PLT |
| Baseline | Formally approved version of a work product, changeable only via change control. | GOV (CM) |
| BGV | Background verification of a candidate's identity, education, employment and records. | LCY |
| Bi-temporal Data | Data that records both **effective time** (when a fact is true in the business) and **transaction time** (when the system learned it), enabling as-of and as-known queries. | PPL / PLT |
| Bias Check | Statistical review of outcomes (e.g. ratings, selections) across protected or relevant subgroups to detect adverse impact before finalisation. | TAL / INT |
| Bonus (Statutory) | Annual bonus payable under the Payment of Bonus Act / Code on Wages to eligible employees within prescribed limits. | PAY |
| Business Process | A configured CMP-01 workflow definition (steps, conditions, routing) for a transaction type. | PLT |
| Business Requirement (BRQ) | A statement of what the business needs from Nucleus Suite, independent of any solution, identified `BRQ-nnn` and specified in BRS-01. Each BRQ refines a business goal (BG-nn) or objective (BO-nn.n), may cite a client requirement (R-nn), is restated from each stakeholder's viewpoint by stakeholder requirements (STR) and is realised by system requirements (SYS). | GOV (RDM) |
| Calibration | Structured session where leaders align ratings across teams, typically using a 9-box and distribution guidelines. | TAL |
| Capability Gap | A capability the product needs that the source workbooks do not specify, or specify only in part. Identified `<DOM>-CG-nnn` (for example PLT-CG-001); RB-03 is the register of record for its ID, title, priority and target phase, GOV-02 §3 defines the status and GOV-02 §6 gives the leadership view, and the domain pack FRS-&lt;DOM&gt;-10 carries the item at requirement level. A capability gap is elicited, specified and approved through CM-02 before the G1 of its target phase, and keeps its ID when it moves between phases. | GOV |
| CAR (Causal Analysis and Resolution) | CMMI practice area for identifying root causes of selected outcomes and taking action to prevent recurrence or replicate success. | GOV (EPG) |
| CCB | Change Control Board (CM-02). | GOV |
| Change Request (CR) | Formal proposal to change a baselined item, assessed for impact and decided by the CCB. | GOV (CM) |
| CHRO | Chief Human Resources Officer; persona for console S1. | GOV |
| CMMI | Capability Maturity Model Integration — model of best practices for process improvement, appraised at maturity levels 1–5. | GOV |
| Code on Wages, 2019 | Labour code consolidating wage laws; defines "wages" such that excluded allowances above 50% of total remuneration are added back to wages. | CMP |
| Code on Wages 50% Rule | Validation that Basic + DA (+ retaining allowance) is at least 50% of total remuneration; the excess of excluded components is treated as wages for statutory computation (INV-PAY-01). | CMB / CMP |
| Comp-off (Compensatory Off) | Leave credit earned for working on a weekly off or holiday; expires per policy (FIFO). | LVE |
| Configuration Item (CI) | Any work product placed under configuration management (CM-01). | GOV (CM) |
| CONOPS (Concept of Operations) | Description, in the language of the people who will use the suite, of how work is done today, how it will be done with Nucleus Suite, the system context, the operational scenarios and the support concept (CONOPS-01). It gives BRS-01 and STRS-01 their operational setting and gives architects and testers the end-to-end scenarios to verify against. | GOV (RDM) |
| Consent Ledger | Append-only record of each data principal's consent grants, withdrawals and purposes. | PLT |
| Contingent Worker | Non-employee worker (contractor, agency worker, consultant) recorded in Nucleus Suite. | CTG |
| Contract Labour (R&A) Act | Contract Labour (Regulation and Abolition) Act, 1970 — governs engagement of contract labour through contractors (being subsumed into the labour codes). | CTG |
| Control Chart | Statistical chart (e.g. XmR, u-chart) showing process data against calculated control limits to distinguish common-cause from special-cause variation. | MPM |
| Cost Centre | Financial unit to which worker costs are charged; mastered from FIN inbound. | FIN / PPL |
| Cross-midnight Shift | Shift that starts on one calendar day and ends on the next; the shift day is the IN-punch date. | TIM |
| CTC (Cost to Company) | Total annual employer cost of a worker including salary, employer statutory contributions and benefits. | CMB |
| DA (Dearness Allowance) | Cost-of-living allowance; counted with Basic for PF and the Code on Wages 50% rule. | CMB |
| DAEB | Data & AI Ethics Board (GOV-04, GOV-11). | GOV |
| DAR | Decision Analysis and Resolution — structured evaluation of alternatives against criteria (DAR-01). | GOV |
| Data Fiduciary | Under DPDP Act 2023, the entity determining the purpose and means of processing personal data (typically the employer tenant). | PLT / GOV-10 |
| Data Principal | Under DPDP Act 2023, the individual to whom personal data relates (worker, candidate, dependant). | PLT / GOV-10 |
| Data Processor | Entity processing personal data on behalf of a data fiduciary (Nucleus Suite as SaaS provider). | GOV-10 |
| Delegation | Temporary assignment of a user's approval authority to another user, e.g. while on leave. | PLT |
| Digital Twin (Organisation) | Live model of the organisation (positions, people, cost, skills, spans) used for what-if simulation (DT-03). | INT |
| Domain Event | Immutable message announcing a business fact (e.g. WorkerHired) for other domains and integrations. | PLT |
| DPDP Act 2023 | Digital Personal Data Protection Act, 2023 (India) — governs processing of digital personal data, consent, rights and obligations. | GOV-10 |
| DPIA | Data Protection Impact Assessment — assessment of privacy risk for a processing activity. | GOV-10 |
| DPO | Data Protection Officer. | GOV |
| Drift (Model Drift) | Degradation of a model's performance or change in input-data distribution over time. | INT |
| DSR | Data-subject / data-principal request (access, correction, erasure, grievance). | PLT |
| ECR (Electronic Challan cum Return) | Monthly EPFO return of member-wise PF wages and contributions with payment challan. | CMP |
| Effective Dating | Recording each change with the date from which it is valid, allowing future-dated and retroactive changes. | PPL |
| Effective Time | The business-validity time axis of bi-temporal data. | PPL |
| EPF / PF | Employees' Provident Fund under the EPF & MP Act, 1952 — employee and employer contributions (12% of PF wages, subject to wage ceiling rules). | PAY |
| EPFO | Employees' Provident Fund Organisation — statutory body administering EPF, EPS, EDLI. | CMP |
| EPG | Engineering Process Group — owns the standard process and improvement (PCM-01). | GOV |
| EPS | Employees' Pension Scheme — part of employer PF contribution diverted to pension. | PAY |
| ERP Posting Formats | The three salary-journal formats Nucleus Suite produces for posting to a customer's ERP system: a structured XML document, a CSV journal and an XML voucher (CAP-FIN-03). | FIN |
| ESI / ESIC | Employees' State Insurance under the ESI Act, 1948, administered by ESIC; contributions on gross wages for employees within the wage threshold. | PAY |
| ESG | Environmental, Social and Governance reporting; Nucleus Suite supplies workforce (social) metrics. | INT |
| EWA (Earned Wage Access) | Facility allowing workers to draw part of wages already earned before payday, within employer policy, recovered in payroll. | PAY |
| Exit Clearance (No-Dues) | Sign-off by IT, Admin, Finance and Stores that a leaver has no outstanding items, feeding F&F. | LCY |
| Explainability | Ability to give a human-understandable reason for an AI output affecting a person. | INT / GOV-11 |
| F&F (Full and Final Settlement) | Final settlement on exit: pro-rata salary, leave encashment, gratuity, notice pay/recovery, deductions. | PAY |
| Factories Act, 1948 | Law regulating health, safety, welfare, working hours and registers in factories (being subsumed into the OSH Code). | CMP |
| Form 16 | Annual TDS certificate issued by employer to employee for salary income. | CMP |
| Form 18 | Factories Act notice of accident/dangerous occurrence (state rules). | CMP |
| Form 24Q | Quarterly TDS return for salary payments filed by the employer. | CMP |
| Form 28 | Muster roll / register of adult workers' attendance under state Factories Rules. | CMP |
| Form 36 | Inspection book recording factory inspector visits and orders (state rules). | CMP |
| Form F | Gratuity nomination form under the Payment of Gratuity (Central) Rules. | CMP |
| Frontier Feature | A capability beyond the current blueprint that would make the product distinctive, identified `<DOM>-FX-nnn` (for example PLT-FX-001) and, where AI is involved, carrying a GOV-11 risk tier. It remains a proposal until it has a DAR-01 decision record, Change Control Board approval (CM-02) and, for AI features, Data & AI Ethics Board approval. RB-03 is the register of record; GOV-02 §7 gives the leadership view and links each item to a differentiator theme or business goal. | GOV |
| Gate (G0–G5) | Formal decision point in the life cycle (DOC-01 §12). | GOV |
| Gate Pass | Authorised temporary exit from premises during a shift (Personal or Official Duty), subject to quota. | TIM |
| GL (General Ledger) | Customer ERP's accounting ledger to which the salary journal posts. | FIN |
| GL Mapping | Rules mapping pay components and cost dimensions to GL accounts. | FIN |
| Gratuity | Lump-sum benefit under the Payment of Gratuity Act, 1972, generally 15/26 × last drawn wages × completed years for eligible service. | PAY |
| Gross-to-Net | Calculation from gross earnings through deductions to net pay. | PAY |
| Grounded Answer | AI response generated only from cited, authorised tenant sources (e.g. policy documents). | SSV / INT |
| HCM | Human Capital Management. | GOV |
| HITL (Human-in-the-Loop) | Design in which a human must review/approve before an AI-proposed action takes effect. | INT / GOV-11 |
| HRBP | HR Business Partner; persona for console S2. | GOV |
| HRMS | Human Resource Management System. | GOV |
| ICD (Interface Control Document) | The contract for every external boundary of the suite (ICD-01): what moves, in which direction, by which mechanism and credentials, with which fields and field owners, how failures are retried and how completeness is reconciled. Interface requirements are identified `<DOM>-INT-nnn.nn` per interface and `PLT-INT-1nn` across interfaces. | PLT |
| Idempotency Key | Client-supplied key ensuring a repeated request is processed only once. | PLT |
| Invariant | Condition that must always hold (e.g. INV-LEV-01 leave balance never negative). | Domain |
| Job Profile | Definition of a job: title, family, grade, responsibilities, required skills. | PPL |
| L0 / L1 / L2 / L3 | Levels of the capability hierarchy: value-chain stage, domain, capability, sub-capability (GOV-05). | GOV |
| Legal Entity | Registered company that employs workers and holds statutory registrations. | PPL |
| Leave Encashment | Payment in lieu of unused leave per policy or at exit. | LVE / PAY |
| LWF (Labour Welfare Fund) | State-specific periodic contribution by employer and employee to a welfare fund. | PAY |
| Matrix Organisation | Secondary reporting relationship in addition to the primary supervisory line. | PPL |
| Maturity Level (ML) | CMMI staged level: ML1 Initial, ML2 Managed, ML3 Defined, ML4 Quantitatively Managed, ML5 Optimizing. | GOV |
| Model Card | Document describing an AI model's purpose, data, performance, limitations, fairness results and owners (AI feature specification and model card, GOV-11). | INT |
| MoSCoW | Prioritisation scheme: Must, Should, Could, Won't (this time). | GOV (RDM) |
| MTP (Master Test Plan) | The executable test plan for the programme (MTP-01), derived from the V&V strategy (QA-03): what is tested in each phase, at which test level and type, in which environment, with which data, under which entry, suspension and exit criteria, and with which measures. UAT is one of its levels. | QA (V&V) |
| Muster Roll | Register of workers' daily attendance; see Form 28. | CMP |
| NC (Non-Conformance) | PQA finding that a process or work product deviates from its standard. | GOV (PQA) |
| Net Presence | Gross time between first IN and last OUT minus breaks and unapproved gate-pass time. | TIM |
| NFR | Non-functional requirement (performance, security, availability, usability, etc.). | GOV (RDM) |
| Nucleus Talk | Nucleus Suite voice and conversational assistant. | INT |
| Nucleus Suite | Product short name; full name Nucleus HRMS Suite. | GOV |
| OCM | Organisational Change Management — adoption, communication and training (OCM-01). | GOV |
| OKR | Objectives and Key Results goal framework. | TAL |
| Ontology (Skills) | Structured graph of skills, their relationships and proficiency levels. | TAL |
| Overtime (OT) | Net present hours beyond scheduled shift hours, subject to statutory caps and rates. | TIM |
| Parallel Run | Running legacy and Nucleus payroll for the same period and reconciling results before go-live. | PAY / QA (V&V) |
| Pay Group | Set of workers processed together with the same pay frequency and calendar. | PAY |
| Payroll Control Room | The 8-stage controlled payroll process from input validation to bank file. | PAY |
| Payroll Lock | State after which a pay period's results are immutable; changes flow as retro. | PAY |
| PAN | Permanent Account Number — Indian tax identifier; sensitive personal data. | PPL |
| Peer Review | Examination of a work product by peers to find defects (QA-02). | GOV (PR) |
| Persona | Archetypal user with goals and context (GOV-08). | GOV |
| Policy Gate | INT component that checks every agent action against the user's permissions, tenant policy and AI risk tier, and decides allow / require approval / deny. | INT |
| Position | A budgeted seat in a supervisory organisation that a worker fills. | PPL |
| Position Management | Staffing model where hiring is against approved positions. | PPL |
| PPB (Process-Performance Baseline) | Characterisation of a sub-process's historical performance (central tendency and variation). | MPM |
| PPM (Process-Performance Model) | Statistical/probabilistic model predicting an outcome (e.g. escaped defects) from controllable process factors. | MPM |
| PPR | Process-Performance Review forum (GOV-04 §3.8). | GOV |
| PQA | Process Quality Assurance — independent objective evaluation of processes and products (QA-01). | GOV |
| Proration | Proportional calculation of pay for partial periods. | PAY |
| PT (Professional Tax) | State-levied tax on employment deducted by the employer per state slabs. | PAY |
| Purpose Binding | Restricting use of personal data to the purposes for which it was collected or consented. | PLT / GOV-10 |
| QPPO | Quantitative Process-Performance Objective — measurable, statistically managed target for process performance derived from business objectives. | MPM |
| R0 | Current stage: UI-validation prototype on local JSON; no live backend. | GOV |
| RACI | Responsible, Accountable, Consulted, Informed matrix. | GOV |
| RAID Log | Register of Risks, Assumptions, Issues, Dependencies (RSK-03). | GOV |
| RBAC | Role-Based Access Control. | PLT |
| Regularisation | Correction of a missed or anomalous punch through an approval workflow. | TIM |
| Requisition | Approved request to fill a position or create a hire. | TAL |
| Retro (Retroactive Pay) | Recalculation of past locked periods triggered by back-dated changes; differences paid or recovered as arrears. | PAY |
| Risk Tier (AI) | GOV-11 classification of an AI feature's potential impact on people (e.g. Low / Medium / High / Prohibited). | GOV-11 |
| RTL | Right-to-left script layout (Arabic). | PLT |
| RTM | Requirements Traceability Matrix (REQ-02). | GOV (RDM) |
| Sandwich Rule | Policy counting intervening weekly offs/holidays as leave when leave is taken on both sides of them. | LVE |
| SCIM | System for Cross-domain Identity Management — standard for user provisioning. | PLT |
| SCORM / xAPI | E-learning content packaging (SCORM) and experience-tracking (xAPI) standards. | TAL |
| Self-Approval Prohibition | Rule that a user cannot approve their own request (INV-SEC-02). | PLT |
| Shift Roster | Assignment of workers to shifts over a period. | TIM |
| Skills Profile | A worker's validated skills and proficiency levels mapped to the ontology. | TAL |
| Special-Cause Variation | Variation outside a process's normal (common-cause) pattern, detected by control-chart rules; triggers investigation. | MPM |
| SSO / MFA | Single sign-on / multi-factor authentication. | PLT |
| Stakeholder Requirement (STR) | A need stated from the viewpoint of a persona (PER-nn) or stakeholder (STK-nn), identified `STR-nnn` and specified in STRS-01. Each STR traces to at least one business requirement (BRQ) and is validated with its stakeholder by walkthrough or acceptance test. | GOV (RDM) |
| SteerCo | Steering Committee (GOV-04). | GOV |
| Sub-process | A defined component of a process that is measured and statistically managed for QPPOs (e.g. peer review, payroll validation). | MPM |
| Succession Plan | Identified successors and readiness for critical positions. | TAL |
| Supervisory Organisation | Reporting-hierarchy unit led by a manager; drives approvals, security and analytics. | PPL |
| System Requirement (SYS) | A testable statement of what the system as a whole must do or be, identified `SYS-nnn` and specified in SRS-01, with companion system-level requirements in SEC-01, OPS-01, NOT-01, RPT-01, LOC-01 and NFR-01. Each SYS realises one or more business requirements (BRQ) and is allocated to the domain functional packs. | GOV (RDM) |
| Tailoring | Approved adaptation of the standard process for a workstream (PCM-01). | GOV (EPG) |
| TDS (Tax Deducted at Source) | Income tax deducted by the employer from salary under section 192 of the Income Tax Act. | PAY |
| Tenant | Isolated customer instance in the multi-tenant platform. | PLT |
| Tool Surface | Catalogue of versioned, permission-checked tools an agent may call to read or change data. | INT |
| Total Rewards Statement | Statement of a worker's full remuneration and benefits value. | CMB |
| Traceability | Ability to follow a requirement forwards to design and test and backwards to its source. | GOV (RDM) |
| Transaction Time | The system-recording time axis of bi-temporal data. | PPL / PLT |
| UAN | Universal Account Number — portable EPFO member identifier. | PPL / PAY |
| UAT | User Acceptance Testing — validation by the client's business users that the suite is fit for its intended use, run to the scenarios in UAT-01 (UAT-001 to UAT-039) as a level of MTP-01, formally in P2 before Gate G4 and repeated for later phases. Walkthroughs on the R0 prototype are validation only and do not count as acceptance. | QA (V&V) |
| Use Case | A goal-oriented description of an interaction between an actor (persona or external system) and Nucleus Suite, with preconditions, main and alternative flows and outcomes, identified `<DOM>-UC-nnn` and held in section 12 of the domain pack (FRS-&lt;DOM&gt;-12). Each use case names the process it realises and the client requirements, business rules and acceptance tests it covers, and through that process traces to the business and system requirements above it. | Domain |
| User Story | A small, independently deliverable increment written as role, need and benefit with acceptance criteria, identified `<DOM>-US-nnn` and held in section 13 of the domain pack (FRS-&lt;DOM&gt;-13). Each story names the use case it refines and carries its own priority and acceptance criteria. | Domain |
| Value Stream | End-to-end sequence of stages delivering value to a stakeholder (GOV-05 §5). | GOV |
| Verifiable Credential | Cryptographically signed, tamper-evident digital credential (W3C Verifiable Credentials model). | LCY / TAL |
| VPF (Voluntary Provident Fund) | Employee PF contribution above the statutory rate, credited to the same PF account. | PAY |
| V&V | Verification ("built right") and Validation ("built the right thing") (QA-03). | GOV |
| Wage Ceiling (PF) | Statutory wage limit on which PF contributions are mandatory; contributions above it are optional by agreement. | PAY |
| Worker | Any person doing work for the tenant — employee or contingent worker. | PPL |
| Workflow & Approval Engine (CMP-01) | Reusable Blueprint component executing configured business processes, approvals, delegation and SLA escalation. | PLT |

## 5. Acronym Quick Reference

| Acronym | Expansion | Acronym | Expansion |
| :--- | :--- | :--- | :--- |
| API | Application Programming Interface | KRA | Key Result Area |
| BGV | Background Verification | LMS | Learning Management System |
| CAR | Causal Analysis and Resolution | LWF | Labour Welfare Fund |
| CI | Configuration Item | MFA | Multi-Factor Authentication |
| CR | Change Request | ML | Maturity Level / Machine Learning (context) |
| CTC | Cost to Company | NC | Non-Conformance |
| DA | Dearness Allowance | NFR | Non-Functional Requirement |
| DAR | Decision Analysis and Resolution | OCM | Organisational Change Management |
| DEI | Diversity, Equity and Inclusion | OKR | Objectives and Key Results |
| DPDP | Digital Personal Data Protection (Act 2023) | OSH | Occupational Safety, Health and Working Conditions (Code) |
| DPIA | Data Protection Impact Assessment | PAN | Permanent Account Number |
| DPO | Data Protection Officer | PF | Provident Fund |
| DSR | Data-subject Request | PPB / PPM | Process-Performance Baseline / Model |
| ECR | Electronic Challan cum Return | PQA | Process Quality Assurance |
| EDLI | Employees' Deposit Linked Insurance | PT | Professional Tax |
| EPF / EPS | Employees' Provident Fund / Pension Scheme | QPPO | Quantitative Process-Performance Objective |
| ESI(C) | Employees' State Insurance (Corporation) | RACI | Responsible, Accountable, Consulted, Informed |
| ESG | Environmental, Social, Governance | RBAC / ABAC | Role- / Attribute-Based Access Control |
| EWA | Earned Wage Access | RTM | Requirements Traceability Matrix |
| F&F | Full and Final Settlement | SCIM | System for Cross-domain Identity Management |
| GDPR | General Data Protection Regulation (EU) | SSO | Single Sign-On |
| GL | General Ledger | TDS | Tax Deducted at Source |
| HCM | Human Capital Management | UAN | Universal Account Number |
| HITL | Human-in-the-Loop | UAT | User Acceptance Testing |
| HRBP | HR Business Partner | V&V | Verification and Validation |
| HRMS | Human Resource Management System | VPF | Voluntary Provident Fund |
| BRS | Business Requirements Specification (BRS-01) | SRS | System Requirements Specification (SRS-01) |
| CONOPS | Concept of Operations (CONOPS-01) | StRS | Stakeholder Requirements Specification (STRS-01) |
| ICD | Interface Control Document (ICD-01) | MTP | Master Test Plan (MTP-01) |

## Approval & Sign-off

| Role | Name | Date | Decision | Conditions / comments |
| :--- | :--- | :--- | :--- | :--- |
| Author | Dhanraj Dadhich | 2026-11-05 | Submitted | |
| Peer review moderator | *pending* | | | PR-xxxx |
| PQA (process compliance) | *pending* | | | NC-xxxx if any |
| Product Council | *pending* | | | |

## Measurement Data Captured

| Measure | Value | Unit | Notes |
| :--- | :--- | :--- | :--- |
| Size | 6 | sections | |
| Authoring effort | *to be recorded* | person-hours | |
| Review effort (preparation + meeting) | *pending review* | person-hours | From PR-xxxx |
| Rework effort | *pending review* | person-hours | |
| Review rate | *pending review* | pages / hour | Compare with PPB-02 control limits |
| Requirement volatility | 0 | CRs since baseline | Not yet baselined (CM-03) |

| Detection phase | Major | Minor | Editorial |
| :--- | :--- | :--- | :--- |
| Author self-check | 0 | 0 | 0 |
| Peer review | *pending* | | |

## 6. Revision History

| Version | Date | Author | Change summary | CR ref | Approved by |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1.0.0 | 2026-11-05 | Dhanraj Dadhich | Consolidated release | CR-0001 | *pending* |
