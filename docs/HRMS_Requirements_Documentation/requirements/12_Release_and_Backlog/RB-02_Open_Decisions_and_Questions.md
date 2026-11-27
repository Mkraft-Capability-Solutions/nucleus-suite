<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/MultipliersKraftLogoDark.png">
  <img src="../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# RB-02 — Open Decisions and Questions

| Attribute | Value |
| :--- | :--- |
| Document ID | RB-02 |
| Title | Open Decisions and Questions |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Programme Manager |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Steering Committee — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | DAR, RSK |
| Related documents | DAR-01, DAR-02, RSK-03 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 – BG-10 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 22_Open_Decisions<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 11_Open_Questions |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

## 1. Open decisions (OD-xx)

Each is resolved through DAR-01 and recorded in DAR-02.

| ID | Decision | Why it matters | Blocks | Must close by | Owner | Current lean |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| OD-01 | Node framework: NestJS for structure vs Fastify for speed and simplicity | Shapes every module boundary and testing approach | BL-001 | Phase 0 week 2 | Engineering lead | — |
| OD-02 | Hosting: ECS vs EKS | Operability at 2 a.m. matters more than the diagram | BL-001 | Phase 0 week 4 | Engineering lead | Whichever the team can operate |
| OD-03 | One mobile app for employees and managers, or two | Bundle size and mobile-heavy audience | BL-010, BL-080 | Phase 0 exit | Product | One app, role-aware |
| OD-04 | Learning built native or delivered by an external LXP behind the Module 10 contract | Decides P3 scope and the Magnetix relationship | BL-141 | Phase 2 | Deb / Product | Keep the contract stable either way |
| OD-05 | First design partner and the industry whose playbook we optimise | Sets the shadow-run target and the implementation template | BL-111 | Phase 1 week 10 | Deb | Manufacturing |
| OD-06 | Register as a Consent Manager under DPDP, or stay strictly a processor | Affects the compliance build and contracts | BL-090 | Phase 3 | Deb / counsel | Processor |
| OD-07 | Master-data direction per tenant, and whether co-owned ships in Phase 1 or Phase 2 | GATES People Core schema work; cannot slip past Phase 0 | BL-011, BL-020, BL-102 | Phase 0 — hard gate | Product + Engineering | Support all three; ship co-owned in P1 |
| OD-08 | Default overtime basis: gross span or net hours | Affects every attendance golden case and the central rule pack default | BL-031, BL-110 | Phase 1 week 9 | Product + payroll SME | Gross for this client; default stated in the pack |
| OD-09 | Which Phase 1 absorption option we take for the four to six engineer-weeks v1.1 added | Deciding late is how Phase 1 quietly becomes Phase 1 and a half | BL-034, BL-040, BL-132 | Phase 0 exit | Deb / delivery lead | Preference order: move Performance to P3; defer the second ingestion source; extend P1 by three weeks |
| OD-10 | Break deduction default in the product (recorded-not-deducted vs deducted) | Changes net minutes, disposition and OT for every client | BL-031 | Phase 1 week 9 | Product | Configurable, no silent default |
| OD-11 | Owner for the Form F joining-form item | Named as unassigned in the blueprint's traceability annexure | BL-060, BL-091 | Phase 1 week 12 | Deb | — |
| OD-12 | Whether the demo tenant ships as a permanent product asset (seeded from the demo dataset) | A reusable sales and QA asset, or a one-off | BL-111 | Phase 1 | Product | Permanent, version-controlled |
| OD-13 | Agent autonomy defaults for the first tenant | Reversal rate is the number a prospect will ask for | BL-125 | Phase 2 | Product | Propose-only at first tenant |
| OD-14 | Payroll SME: hire or retain as a reviewer | The highest-risk gap in the team; silent wrongness otherwise | BL-054, BL-090 | Phase 0 — non-negotiable | Deb | Retain a practising consultant |

## 2. Open questions on client requirements (Q-xx)

| Question ID | Requirement | Module | Question | Why the source does not answer it | What it affects | Who should answer |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Q-01 | R-01 | ATT | Is the intermediate break deducted from paid hours? | The example gives total hours of 19:20 and OT of 7:20, which means the 45-minute break is not deducted. Confirm this is intended, and whether it holds for all break types or only the dinner break. | Changes OT cost on every long shift. | HR product owner with the client |
| Q-02 | R-08 | LVE | What do employees joining after 4 December receive? | The proration table ends at "up to 4th Dec — 1 each". The source is silent on 5 December onwards. | Leaves a gap in the accrual rule that will surface in the first December joining. | HR product owner with the client |
| Q-03 | R-08 | LVE | Birthday leave — how many days, and what are the rules? | The source names birthday leave without quantum, window, approval requirement or lapse behaviour. | Cannot be built from the line as written. | HR product owner with the client |
| Q-04 | R-08 | LVE | Is the 10 EL a month a cap on availing or on accrual? | Accrual is 1.5 a month, so a 10-day monthly figure can only be an availing cap. Confirm. | A wrong reading either blocks valid leave or lets an employee exhaust the year in two months. | HR product owner with the client |
| Q-05 | R-08 | LVE | Is monthly EL credited at the start or the end of the month? | Determines whether an employee can avail the month's accrual within that month. | Affects every leave balance on the first of the month. | HR product owner with the client |
| Q-06 | R-08 | LVE | Which grade rank is "AGM and above" and which is "Assistant Manager and above"? | Both rules are stated by designation name. The grade ladder has to be confirmed so the rules read a rank. | Designation-name matching breaks the first time a title changes. | HR product owner with the client |
| Q-07 | R-07 | LVE | Are the 60 COFF days calendar days or working days? | The source says 60 days from the COFF date without qualifying it. | Shifts the expiry date by around two weeks. | HR product owner with the client |
| Q-08 | R-10 | LON | What loan amount triggers the third guarantor? | The third guarantor is described as optional "if in case the Loan amount is more" without a threshold. | The conditional cannot be implemented without a number. | HR product owner with the client |
| Q-09 | R-10 | LON | Does "more than 5 years" mean continuous service from date of joining? | Confirm whether breaks in service, transfers between entities or a change of employment category reset the clock. | Determines the loan ceiling for long-service employees. | HR product owner with the client |
| Q-10 | R-12 | GPS | Does unused gate pass entitlement lapse each month? | The source gives a monthly entitlement but does not say whether it carries forward. | Affects the entitlement check and the utilisation report. | HR product owner with the client |
| Q-11 | R-13 | SHF | How often may the night extension be used? | The source states the rule without a frequency limit. | Without a cap the rule can be used to normalise late arrival. | HR product owner with the client |
| Q-12 | R-13 | ATT | Does the late counter reset on the calendar month or the payroll month? | These differ where the payroll cycle is not the calendar month. | Changes who receives the fourth-late half day and when. | HR product owner with the client |
| Q-13 | R-18, R-27 | STA | Which state's rules apply to Form 28, Form 18, Form 36 and Form F? | Factory Act forms are prescribed by state rules and the layouts differ. | A form in the wrong state variant is a compliance failure, not a cosmetic issue. | HR product owner with the client |
| Q-14 | R-03 | EMP | For daily wage employees, does a rest day worked attract OT or a normal day's wage? | The source says contractual employees have no rest days and are paid daily wages, but not how an extra day is treated. | Determines whether OT applies at all to this population. | HR product owner with the client |
| Q-15 | R-15 | INT | Which system owns which employee field? | The link is described as an API without stating direction of ownership per field. | Two-way ownership of the same field is the usual cause of master data drift. | Technical lead with the ERP team |
| Q-16 | R-17 | FNF | Which departments must sign off on no dues, and who owns each? | The clearance checklist needs its department list before it can be built. | The checklist is the gate on same-day settlement. | HR product owner with the client |

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
| Size | 30 | specified items (table rows) | Counted automatically at generation |
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
