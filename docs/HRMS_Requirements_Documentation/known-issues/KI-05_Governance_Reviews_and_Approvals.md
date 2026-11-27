<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../requirements/assets/MultipliersKraftLogoDark.png">
  <img src="../requirements/assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# KI-05 — Governance, Reviews and Approvals

| Attribute | Value |
| :--- | :--- |
| Register | KI-05 |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Author | Dhanraj Dadhich |
| Date | 2026-11-05 |
| Scope | Pending people, reviews and approvals needed to baseline release 1.0.0 |

| ID | Issue | Evidence | Impact | Recommended resolution | Owner (role) | Needed by | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| KI-301 | Governance roles not yet assigned to named people | All approval authorities are roles | No document can be approved; G0 blocked | Executive Sponsor appoints people and deputies to SteerCo, Product Council, ARB, CCB, DAEB, EPG and PQA | Executive Sponsor | G0 | Open |
| KI-302 | Peer reviews, approvals and measurement data pending | 277 controlled documents carry pending review, sign-off and measurement entries | No baseline; no data for review-rate and defect-density baselines | Run reviews in gate order (see schedule below), record PR records, fill measurement blocks, approve CR-0001, tag the baseline | PQA Lead with Programme Manager | G0 then G1 | Open |
| KI-303 | Legal validation outstanding | 158 statements marked '(to be validated by Legal)' — register in KI-04 | Statutory and privacy obligations unconfirmed | One review pass by labour-law and privacy counsel; answers applied through CM-02 | Legal with DPO | G1 | Open |

## Review and approval schedule

| Wave | Documents | Approval authority | Duration |
| :--- | :--- | :--- | :--- |
| Wave 1 — G0 | DOC-01, DOC-02, GOV-01, GOV-03, GOV-04, PLN-01, CM-01, CM-02, REQ-01, RSK-01, QA-01, MPM-01 | Steering Committee | 2 weeks |
| Wave 2 — G1 business | BRS-01, CONOPS-01, STRS-01, GOV-02, GOV-05..11 | Steering Committee / Product Council | 2 weeks |
| Wave 3 — G1 system | SRS-01, NFR-01, SEC-01, OPS-01, NOT-01, RPT-01, LOC-01, DA-01..05, MIG-01, IA-01..03, ICD-01, AI-01 | Product Council / ARB / DAEB | 3 weeks |
| Wave 4 — G1 domains | 14 domain packs (FRS-<DOM>-00..13), UCC-01, USC-01, BA-01..06 | Product Council | 4 weeks, two domains per review session |
| Wave 5 — G1 verification and planning | MTP-01, UAT-01, QA-03, VV-01..03, REQ-02, TR-01..04, RB-01..03, PLN-02, PLN-03, RSK-02, RSK-03 | Product Council / Steering Committee | 2 weeks |

```mermaid
flowchart LR
    A["Appoint people"] --> W1["Wave 1 · G0"] --> W2["Wave 2 · business"] --> W3["Wave 3 · system"] --> W4["Wave 4 · domains"] --> W5["Wave 5 · verification"] --> B["Baseline tag 1.0.0"]
```
