<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../requirements/assets/MultipliersKraftLogoDark.png">
  <img src="../requirements/assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# KI-02 — Source Data Quality and Completeness

| Attribute | Value |
| :--- | :--- |
| Register | KI-02 |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Author | Dhanraj Dadhich |
| Date | 2026-11-05 |
| Scope | Gaps and quality defects in the source workbooks |

| ID | Issue | Evidence | Impact | Recommended resolution | Owner (role) | Needed by | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| KI-101 | Processes specified only at inventory level | PLT: es; PPL: es; PAY: es; CMP: es; LCY: es; SSV: es; CMB: es; TAL: es; CTG: es; EXP: es; FIN: es; INT: es | Flows rely on authored use cases rather than source step specifications | Product owners confirm the authored flows in FRS-<DOM>-12 and add step rows to the process workbook | Domain Product Owners | Each domain's G1 | Open |
| KI-102 | Domains with no source test cases | SSV, CTG, INT | Acceptance relies on authored user-story criteria and authored test cases | Add golden test cases to the process workbook's test sheet for these domains | QA / Test Lead | Each domain's G1 | Open |
| KI-103 | Forms workbook read-me lists a sheet that does not exist | Read-me of the Forms & Fields workbook describes a fourth (benchmark) sheet; the workbook has three data sheets | Readers look for evidence that is not there | Remove the reference from the workbook read-me | Business Analyst Lead | P0 G1 | Open |
| KI-104 | Third-party product names inside source workbooks | Process workbook (SSV and FIN rules and steps, screens SCR-041, SCR-066, TIM-01 text), picklist PL_ERP_SYSTEM values, dataset sheets | Requirements show generic terms, but the source of record still carries product names | Replace product names in the workbooks with generic terms and neutral connector codes | Business Analyst Lead | P0 G1 | Open |
| KI-105 | Client rule IDs collide with product rule IDs | Build-sheet rules RL-01…RL-27 versus process rules RL-001… | Ambiguous traceability (handled in requirements as BS:RL-xx) | Rename build-sheet rules at source to a distinct prefix | Business Analyst Lead | P0 G1 | Open |
| KI-106 | Loan rules incomplete | No rule ID for the loan net-pay floor; no process step emits loan.closed; no rule releases guarantors when a loan is rejected at sanction or foreclosed (authored release flows added in CMB use cases) | Loan lifecycle gaps at build time | Add the three rules and the event to the process workbook | Compensation Product Owner | P1 G1 | Open |
| KI-107 | Phase mismatches between processes and capability gaps | PAY-11 (P2) overlaps PAY-CG-002 (P1); CTG capability gaps are P2 while CTG processes are P3 | Planning inconsistency | Product Council aligns phases during scope triage | Head of Product | Scope triage | Open |
| KI-108 | Lanes that are not personas | Process lanes 'Compliance engineer', 'Named reviewer', 'Admin / IT', 'Department owners' and the purchasing role in CTG-01 have no persona definition | Access design for these actors is unspecified | Add the roles to the roles sheet with scope and visibility | Security Architect | P1 G2 | Open |
| KI-109 | Rule ranges and stray references | PPL-08 cites ERP rules and tests only as ranges (RL-510..516, TC-F510..516); RL-014 appears only in step and traceability rows | Use cases cannot cite individual rules | List individual IDs in the process workbook | Business Analyst Lead | P1 G1 | Open |
