<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-PLT-09 — Platform & Foundations — Backlog and Open Decisions

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-PLT-09 |
| Title | Platform & Foundations — Backlog and Open Decisions |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Delivery Lead |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | PLAN, EST, DAR |
| Related documents | FRS-PLT-00, FRS-PLT-01, FRS-PLT-02, FRS-PLT-03, FRS-PLT-04, FRS-PLT-05, FRS-PLT-06, FRS-PLT-07, FRS-PLT-08, FRS-PLT-09, FRS-PLT-10, FRS-PLT-11, FRS-PLT-12, FRS-PLT-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-06, BG-07, BG-10 · R-09 · processes PLT-01–PLT-08 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 18_Build_Backlog, 22_Open_Decisions<br>Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 11_Open_Questions |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.


## Phase 0 — Foundations (Weeks 1-8)

| ID | Epic | Story | Phase | Component | Depends on | Effort (days) | Definition of done |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| BL-001 | Platform | Repository, module boundaries, dependency-graph test in CI, preview environments | P0 | — | — | 8 | A cross-module database import fails the build |
| BL-002 | Platform | Tenancy with RLS forced, plus the CI guard that fails any table without tenant_id and a policy | P0 | CMP-08 | BL-001 | 6 | New table without a policy fails CI |
| BL-003 | Platform | Identity: OIDC, SAML, SCIM, roles | P0 | CMP-08 | BL-002 | 6 | SSO login and deprovisioning work end to end |
| BL-004 | Platform | Scope resolver with entity, reporting line AND location dimensions | P0 | CMP-08 | BL-003 | 8 | TC-P05 passes: plant user sees time, pay fields null |
| BL-005 | Platform | Bi-temporal base tables and the as-at reader | P0 | CMP-10 | BL-002 | 8 | 'What did we believe on 3 June about her grade effective 1 April' answers in SQL |
| BL-006 | Platform | Workflow engine v1 with sequential multi-level chains, SLA and versioning | P0 | CMP-01 | BL-005 | 12 | Leave chain and loan chain both run on it unchanged |
| BL-007 | Platform | Configuration framework with effective dating and the override-with-reason pattern | P0 | CMP-10 | BL-005 | 8 | A new leave type needs no developer |
| BL-008 | Platform | Audit projection and action ledger schema | P0 | CMP-06 | BL-005 | 6 | Every write and sensitive read lands with actor and reason |
| BL-009 | Platform | Transactional outbox and relay worker | P0 | CMP-07 | BL-002 | 5 | Consumers are idempotent under replay |
| BL-010 | Platform | Design system and component library | P0 | — | BL-001 | 8 | Employee home renders on a mid-range mobile in under 2.5s on 3G |
| BL-011 | Platform | ADRs started, including the master-data direction decision | P0 | — | — | 2 | OD-07 recorded before People Core schema work |

## Phase 4 — Scale (Weeks 65-96)

| ID | Epic | Story | Phase | Component | Depends on | Effort (days) | Definition of done |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| BL-152 | Channel | White-label and partner console | P4 | CMP-10 | BL-007 | 20 | A partner configures a tenant without engineering |

## Open decisions blocking this domain

| ID | Decision | Why it matters | Blocks | Must close by | Owner | Current lean |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| OD-01 | Node framework: NestJS for structure vs Fastify for speed and simplicity | Shapes every module boundary and testing approach | BL-001 | Phase 0 week 2 | Engineering lead | — |
| OD-02 | Hosting: ECS vs EKS | Operability at 2 a.m. matters more than the diagram | BL-001 | Phase 0 week 4 | Engineering lead | Whichever the team can operate |
| OD-03 | One mobile app for employees and managers, or two | Bundle size and mobile-heavy audience | BL-010, BL-080 | Phase 0 exit | Product | One app, role-aware |
| OD-07 | Master-data direction per tenant, and whether co-owned ships in Phase 1 or Phase 2 | GATES People Core schema work; cannot slip past Phase 0 | BL-011, BL-020, BL-102 | Phase 0 — hard gate | Product + Engineering | Support all three; ship co-owned in P1 |

## Open questions on client requirements

_No entries in source for this scope._

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
| Size | 16 | specified items (table rows) | Counted automatically at generation |
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
