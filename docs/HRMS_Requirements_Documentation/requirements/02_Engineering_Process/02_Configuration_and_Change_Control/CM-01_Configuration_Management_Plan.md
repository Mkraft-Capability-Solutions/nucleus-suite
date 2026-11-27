<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# CM-01 — Configuration Management Plan

| Attribute | Value |
| :--- | :--- |
| Document ID | CM-01 |
| Title | Configuration Management Plan |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Configuration Manager |
| Author | Dhanraj Dadhich |
| Reviewed by | Enterprise Architect, Delivery Lead, PQA Lead, Head of AI — *pending* |
| Approved by | Steering Committee — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | CM, PQA, RDM, MPM |
| Related documents | DOC-01, DOC-02, CM-02, CM-03, REQ-01, REQ-02, PLN-01, PLN-03, MPM-01, QA-04, GOV-10, GOV-11 |
| Quality & process-performance objectives | QPPO-06 (fast, controlled change) |
| Process performance baseline used | PPB-07 (CR cycle time) |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-09 |

---

## 1. Purpose and Scope

This plan establishes and maintains the **integrity of Nucleus Suite work products** through:
- configuration identification
- baselining
- change control
- status accounting
- configuration audits

It covers documents, source code, data fixtures, database schemas, environments, AI assets, test assets, measurement baselines (PPB/PPM) and imported source workbooks, from R0 through P0–P4.

## 2. Roles

| Role | Responsibility |
| :--- | :--- |
| Configuration Manager | Owns this plan, DOC-02 register, baselines, status accounting, audits |
| Change Control Board (CCB) | Approves changes to baselines (CM-02) |
| CI owners | Maintain their items; raise CRs; keep RTM/registers in sync |
| Delivery Lead | Branching, build and release discipline |
| Platform Lead | Environment configuration and infrastructure-as-code |
| Head of AI | AI model, prompt, dataset and evaluation-suite configuration |
| PMO Analyst | PPB/PPM and measurement-repository configuration |
| PQA Lead | Independent configuration audits evidence review |

## 3. Configuration Items (CIs)

### 3.1 CI classes

| CI class | Examples | Identification | Repository / location | Control level |
| :--- | :--- | :--- | :--- | :--- |
| Governance and plans | DOC, GOV, PLN, REQ, CM, OCM, RSK, QA, MPM, MC, DAR, CAR, PCM, SAM, OT documents | Doc ID + version (DOC-01 §4, §9) | `requirements/00–02` | Formal (CCB) after baseline |
| Imported source catalogues | Client demo points R-xx; processes DOM-nn; rules RL-nnn; screens SCR-nnn; forms FRM-<MOD>-nn; tests TC-xxx; components CMP-nn; build backlog BL-nnn; open decisions OD-nn | Workbook name + import version + checksum; item source IDs kept | `requirements/03–12` per type | Formal; new workbook version = CR |
| Business, stakeholder and system requirements | BRS-01, CONOPS-01, STRS-01, SRS-01, NFR-01, SEC-01, OPS-01, NOT-01, RPT-01, LOC-01 | Doc ID + version | `requirements/03_Business_Requirements`, `04_Stakeholder_Requirements`, `05_System_Requirements` | Formal after G1 |
| Domain requirement documents | `FRS-<DOM>-nn_<Title>`; catalogues UCC-01, USC-01 | Doc ID + version | `requirements/06_Functional_Requirements/<NN>_<DOM>_<Name>/` | Formal after G1 |
| Architecture and data | Architecture decisions, data model, JSON schemas, API contracts | Doc/artefact ID + version | `requirements/05_System_Requirements`, `07_Data_Architecture`, `08_Integration_and_API`, code repository | Formal (ARB + CCB) |
| Source code | Application, services, server domain, shared components (CMP-nn) | Repo path + commit hash + tag | Git repository | Formal at release tags; managed in feature branches |
| Data fixtures (prototype) | Local JSON catalogues in the prototype code repository, data manifest | Path + commit | Git repository | Managed (R0); synthetic data only |
| Database schema | Versioned migrations | Migration sequence number | Git repository | Formal; applied only via versioned migrations — **dormant in R0** |
| Environment configuration | Infrastructure-as-code, environment parameters (no secret values) | Path + version | Git / IaC repo | Formal for SIT/UAT/PERF/PROD |
| Secrets | Credentials, keys | Reference name only | Managed secret vault (selected through DAR-01 and approved by the ARB at P0 G2) | **Never stored in repository or documents** |
| AI assets | Model identifier and version, prompts/system instructions, tool-surface definitions, retrieval indexes, fine-tuning datasets, evaluation suites, guardrail configs, model cards | AI asset ID `AIA-<type>-nnn` + version | Git (prompts, configs, eval suites); model registry holding exact model references and versions (AI asset register, §11) | Formal; DAEB approval for promotion (GOV-11) |
| Test assets | TC-xxx catalogue, automated suites, golden datasets (e.g. payroll and attendance golden files), test reports | TC ID / suite path + version | `requirements/10_Verification_and_Validation`, code repository | Formal after test-readiness gate |
| Measurement assets | Measurement definitions, PPBs, PPMs, Monte Carlo models, QPPO definitions | `PPB-<area>-vN`, `PPM-<area>-vN`, `QPPO-nn` | Measurement repository (MPM-01) | Formal; new version on recalibration |
| Process assets | Standard artefact formats (DOC-01 §4), procedures, checklists, tailoring records | Doc ID + version | `requirements/02_Engineering_Process` | Formal (EPG) |
| Release packages | Release notes, deployment manifests, SBOM | Release tag `P<n>-r<k>` | Release repository | Formal |

### 3.2 Controlled documentation baseline structure

The requirements documentation is controlled as the following tree. It replaces the earlier `01_…`–`12_…` folder layout. The relocation is recorded under CR-0001.

```text
requirements/
├── 00_Programme_Governance          DOC, GOV-01..04, GOV-07..11, SRC-01
├── 01_Project_Management            PLN, RSK, MPM, MC, DAR, SAM, OCM
├── 02_Engineering_Process           REQ-01, REQ-03, CM, QA-01/02/04, PCM, CAR, OT
├── 03_Business_Requirements         BRS-01, CONOPS-01, GOV-05, GOV-06, BA-01..06
├── 04_Stakeholder_Requirements      STRS-01
├── 05_System_Requirements           SRS-01, NFR-01, SEC-01, OPS-01, NOT-01, RPT-01, LOC-01
├── 06_Functional_Requirements       FRS-00, UCC-01, USC-01
│   └── <NN>_<DOM>_<Name>/           FRS-<DOM>-00..13 (12 use cases, 13 user stories)
├── 07_Data_Architecture             DA-01..05, MIG-01
├── 08_Integration_and_API           IA-01..03, ICD-01
├── 09_AI_and_Agents                 AI-01
├── 10_Verification_and_Validation   QA-03, MTP-01, UAT-01, VV-01..03
├── 11_Traceability                  REQ-02, TR-01..04
├── 12_Release_and_Backlog           RB-01..03
└── assets                           logos
```

Documents are cross-referenced **by document ID, not by path**, so relocation does not break traceability. DOC-02 records the authoritative location of each ID.

## 4. Identification and Naming Rules

1. Document IDs and versions: DOC-01 §4 and §9.
2. Domain requirement documents: `FRS-<DOM>-nn_<Title_With_Underscores>.md`, with nn from 00 to 13.
3. Imported items keep their source IDs exactly. Each import carries a header with workbook name, sheet, import date, import version and checksum.
4. File names use `ASCII`, underscores, no spaces. The ID prefix comes first.
5. Code tags: `P<phase>-r<release-number>` (e.g. `P1-r3`). Baseline tags: `BSL-<type>-<phase>-v<n>` (e.g. `BSL-FUNC-P1-v1`). `BSL-` is used deliberately so that baseline tags never collide with backlog story IDs `BL-nnn`.
6. AI assets: `AIA-MOD-nnn` (model reference), `AIA-PRM-nnn` (prompt), `AIA-DS-nnn` (dataset), `AIA-EVL-nnn` (evaluation suite), `AIA-TL-nnn` (tool-surface definition).

## 5. Change Discipline for Living Items

- A change to a requirement, import or design **must update the RTM (REQ-02) in the same change set**.
- Living registers (RAID, CR log, decision log, RTM, DOC-02) are edited directly by their owners. They are snapshot-baselined at each gate.
- Every change to a baselined CI references its approved CR ID in the change description.

## 6. Baselines

| Baseline | Content | Established at | Approval |
| :--- | :--- | :--- | :--- |
| Governance baseline | Governance and plan documents | G0 | SteerCo |
| **Functional baseline** | Source-import v1.0 (R-xx, DOM, RL, SCR, FRM, TC, CMP, BL), BRS-01, CONOPS-01, STRS-01, SRS-01, NFR-01, SEC-01, OPS-01, NOT-01, RPT-01, LOC-01, FRS-<DOM>-00..13, UCC-01, USC-01, AI specs, RTM snapshot | G1 (R0 exit); per-phase mini-G1 for P3/P4 | Product Council + CCB |
| **Allocated baseline** | Architecture, data model, API contracts, shared-component contracts (CMP-nn), tool-surface definitions | G2 (P0 exit) | ARB + CCB |
| **Product baseline** | Tagged code, schemas/migrations, configs, test suites and reports, AI asset versions | Test-readiness gate (G3 / phase) | CCB |
| **Release baseline** | Product baseline + release notes, deployment manifest, SBOM, cut-over plan, OCM readiness | G4 | SteerCo |
| **Measurement baseline** | QPPOs, PPBs, PPMs in use | Each phase exit; on recalibration | EPG + SteerCo |

## 7. Repository and Branching Policy

| Rule | Policy |
| :--- | :--- |
| System of record | Git repository for code, documents (Markdown), schemas, prompts, configs and test assets |
| **Commit and push authority** | **Commits and pushes happen only on explicit approval of the responsible human owner.** Automated agents (including AI coding assistants) prepare changes locally and never commit or push without that approval. |
| Main branch | Protected. Changes by reviewed merge only. Always releasable. |
| Branch types | `feature/<ID>-<slug>` (ID = BL-nnn, CR-nnnn or requirement ID), `release/P<n>-r<k>`, `hotfix/<CR>` |
| Merge criteria | Peer review approved (QA-02); typecheck, lint, tests and build gates pass; RTM updated; CR referenced for baselined CIs |
| Commit messages | Reference the ID (BL-nnn / CR-nnnn / requirement ID) |
| Prohibited content | Secrets, credentials, environment values, real personal data |
| Tags | Signed Git tags for baselines and releases; signing keys are held in the managed secret vault and signatures are verified by the CI pipeline before any release |
| Retention | Full history retained; branches deleted after merge, tags never deleted |

## 8. Access Control

| Repository area | Read | Write | Approve merge |
| :--- | :--- | :--- | :--- |
| Governance docs (`requirements/00–02`) | All programme members | Doc owners | Doc approver per DOC-01 §8 |
| Requirements (`03–12`) | All programme members | BAs, POs, Architects | PO / ARB per type |
| Source code | Engineering | Squad members | Code owners per path |
| Environment config / IaC | Engineering | Platform squad | Platform Lead |
| AI assets | Engineering, AI | INT squad | Head of AI (promotion needs DAEB for agentic features) |
| Measurement assets | PMO, EPG | PMO Analyst | EPG Lead |

Access rights are reviewed quarterly and on every role change.

## 9. Environments and Release Management

| Environment | Purpose | Data | Promotion from | Active |
| :--- | :--- | :--- | :--- | :--- |
| LOCAL | R0 UI-validation prototype; in-memory JSON | Synthetic fixtures | — | **Now** |
| DEV | Integration of feature branches | Synthetic | LOCAL | From P0 |
| SIT | System integration testing | Synthetic | DEV | From P0 |
| UAT | User acceptance, payroll parallel runs | Synthetic or masked (DPO-approved) | SIT | From P1 |
| PERF | Performance and scale | Synthetic at volume | SIT | From P1 |
| PROD | Pilot and production tenants | Real | UAT | From P2 pilot |

Release process:
1. Release branch cut
2. Product baseline tagged
3. Release notes and SBOM produced
4. G4 approval
5. Deployment via the pipeline only (no manual production changes)
6. Post-deployment verification
7. Release baseline recorded in status accounting

Production configuration changes follow CM-02, using the emergency path where justified.

## 10. AI Asset Configuration and Model Versioning

- Every AI feature in production references **exact versions** of its model, prompts, tool-surface definition, retrieval index and guardrail config. "Latest" aliases are not allowed in UAT/PROD.
- A change to any AI asset is a CR. It needs a regression run of the AI evaluation suite (`AIA-EVL`) against the previous version, with results attached.
- Promotion of agentic capabilities (tool-surface actions that change data) requires DAEB approval (GOV-11).
- Datasets used for fine-tuning or evaluation are versioned with lineage, classification and consent basis recorded (GOV-10). Real personal data is never used without a DPO-approved basis.
- Model cards are versioned with the model reference and updated on every promotion.
- Rollback: the previous AI asset set is kept deployable for ≥ 1 release.

## 11. Configuration Status Accounting

The Configuration Manager maintains:

| Record | Content | Frequency |
| :--- | :--- | :--- |
| DOC-02 Master Document Register | All controlled documents, versions, status, location | On change |
| Baseline register | Baselines, contents (CI + version), approval reference | On each baseline |
| CR status (CM-03) | Open/closed CRs, affected CIs | Weekly |
| Import register | Source workbook versions imported, diffs, checksums | On each import |
| Release register | Releases, tags, environments deployed | On release |
| AI asset register | AI asset versions in each environment | On change |
| Measurement baseline register | QPPO/PPB/PPM versions in use | On recalibration |

CM metrics (CR cycle time, baseline integrity findings, unauthorised-change count) feed MPM-01. CR cycle time is a candidate PPB.

## 12. Configuration Audits

| Audit | Purpose | When | Performed by | Evidence |
| :--- | :--- | :--- | :--- | :--- |
| Functional Configuration Audit (FCA) | Verify the product meets its functional baseline: every Must requirement traced to passed TCs | Before G4 | QA Lead + Configuration Manager | RTM snapshot, test reports |
| Physical Configuration Audit (PCA) | Verify the release package matches its documentation: tags, versions, SBOM, AI asset versions | Before G4 | Configuration Manager | Release manifest comparison |
| Baseline integrity audit | Verify that baselined CIs changed only via approved CRs | Each phase exit; random monthly sample | PQA Lead (QA-04) | CR log vs repository history |
| Import integrity audit | Verify imported IDs are unchanged and source checksums match | After each import | BA Lead + CM | Import register |

Findings are logged as non-conformances (`NC-nnnn`) and tracked to closure. Recurring findings trigger CAR-01.

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
| Size | 13 | sections | |
| Authoring effort | *to be recorded* | person-hours | |
| Review effort (preparation + meeting) | *pending review* | person-hours | From PR-xxxx |
| Rework effort | *pending review* | person-hours | |
| Review rate | *pending review* | pages / hour | Compare with PPB-02 control limits |
| Requirement volatility | 0 | CRs since baseline | Not yet baselined (CM-03) |

| Detection phase | Major | Minor | Editorial |
| :--- | :--- | :--- | :--- |
| Author self-check | 0 | 0 | 0 |
| Peer review | *pending* | | |

## 13. Revision History

| Version | Date | Author | Change summary | CR ref | Approved by |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1.0.0 | 2026-11-05 | Dhanraj Dadhich | Consolidated release | CR-0001 | *pending* |
