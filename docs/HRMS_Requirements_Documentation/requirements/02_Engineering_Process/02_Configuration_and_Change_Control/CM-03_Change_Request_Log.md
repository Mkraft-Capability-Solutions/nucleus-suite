<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# CM-03 — Change Request Log

| Attribute | Value |
| :--- | :--- |
| Document ID | CM-03 |
| Title | Change Request Log |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Configuration Manager |
| Author | Dhanraj Dadhich |
| Reviewed by | CCB — *pending* |
| Approved by | Not baselined (living) |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | CM, MC, MPM |
| Related documents | CM-01, CM-02, REQ-02, DAR-02, the change request record (CM-02) |
| Quality & process-performance objectives | QPPO-06 (fast, controlled change) |
| Process performance baseline used | PPB-07 (CR cycle time) |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-09 |

---

## 1. Purpose

The single register of every change request (CR) against Nucleus Suite baselines. Detailed CR forms (change request record, CM-02) are filed alongside under `CR-nnnn.md` once raised. This log is the index and status record.

## 2. Field Definitions

| Field | Description |
| :--- | :--- |
| CR ID | `CR-nnnn`, sequential, never reused |
| Title | Short description |
| Raised by (role) / date | |
| Class | Minor / Major / Strategic / Emergency (CM-02 §3) |
| Cause category | Clarification / Missed requirement / Stakeholder change / Regulatory / Defect-driven / Design-driven / Process improvement |
| Affected CIs | Doc IDs, requirement IDs, CMP-nn, BL-nnn, AI assets… |
| Domains | 14-domain codes |
| Impact summary | Schedule / cost / QPPO / compliance / privacy / AI (CM-02 §5) |
| Status | Raised → Under analysis → Pending decision → Approved / Approved with conditions / Deferred / Rejected / Escalated → In implementation → Verified → Closed |
| Decision / date / authority | |
| Logged → decision (days) | Cycle-time data for the PPB |
| Decision → close (days) | |
| Links | Decision record (DEC-nnnn), minutes, branch |

## 3. Log

| CR ID | Title | Raised by / date | Class | Cause | Affected CIs | Domains | Impact summary | Status | Decision / date / authority | Links |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| CR-0001 | Restructure governance folder after CMMI gap analysis | Governance Workstream / 2026-11-05 | Major (governance baseline; affects all requirement documentation conventions) | Process improvement | Superseded GOV-01..GOV-04 cloned sub-documents (16 files, withdrawn); retired IDs FR/BR-GOV-0x; new DOC, GOV, PLN, REQ, CM, OCM, RSK, QA, MPM, MC, DAR, CAR, PCM, SAM, OT documents; new BRS-01, CONOPS-01, STRS-01, SRS-01 and the system requirement set (NFR-01, SEC-01, OPS-01, NOT-01, RPT-01, LOC-01); relocation into the `requirements/` tree (CM-01 §3.2); adoption of the 14 domain codes, stages R0 and P0–P5, source-workbook ID schemes and the ML5 target | All | Scope: documentation only, no product code. Schedule: none to product phases. Compliance/privacy/AI: none directly; establishes the controls. Positive effect on RDM/CM QPPOs expected. | **Raised — pending CCB** | — | DEC-0001 (DAR-02); DOC-02 §4 |

## 4. Summary (updated at each CCB)

| Period | Raised | Approved | Rejected | Deferred | Open | Emergency | Median cycle time (logged → decision) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| R0 to date | 1 | 0 | 0 | 0 | 1 | 0 | — |

## Approval & Sign-off

| Role | Name | Date | Decision | Conditions / comments |
| :--- | :--- | :--- | :--- | :--- |
| Author | Dhanraj Dadhich | 2026-11-05 | Submitted | |
| Peer review moderator | *pending* | | | PR-xxxx |
| PQA (process compliance) | *pending* | | | NC-xxxx if any |
| Not baselined (living) | *pending* | | | |

## Measurement Data Captured

| Measure | Value | Unit | Notes |
| :--- | :--- | :--- | :--- |
| Size | 5 | sections | |
| Authoring effort | *to be recorded* | person-hours | |
| Review effort (preparation + meeting) | *pending review* | person-hours | From PR-xxxx |
| Rework effort | *pending review* | person-hours | |
| Review rate | *pending review* | pages / hour | Compare with PPB-02 control limits |
| Requirement volatility | 0 | CRs since baseline | Not yet baselined (CM-03) |

| Detection phase | Major | Minor | Editorial |
| :--- | :--- | :--- | :--- |
| Author self-check | 0 | 0 | 0 |
| Peer review | *pending* | | |

## 5. Revision History

| Version | Date | Author | Change summary | CR ref | Approved by |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1.0.0 | 2026-11-05 | Dhanraj Dadhich | Consolidated release | CR-0001 | *pending* |
