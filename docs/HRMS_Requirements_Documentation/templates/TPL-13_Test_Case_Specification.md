<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../requirements/assets/MultipliersKraftLogoDark.png">
  <img src="../requirements/assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# TPL-13 — Test Case Specification

| Attribute | Value |
| :--- | :--- |
| Document ID | TPL-13 |
| Title | Test Case Specification |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | QA / Test Lead |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | EPG Lead — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | PAD, VV, PI, MPM |
| Related documents | DOC-01, QA-03, MTP-01, UAT-01, VV-01 to VV-03, REQ-02, TPL-02, TPL-06, TPL-07 |
| Quality & process-performance objectives | QPPO-02 (remove defects before system test), QPPO-03 (exact payroll at go-live), QPPO-01 (minimise defects reaching users) |
| Process performance baseline used | PPB-03 (defect removal efficiency), PPB-06 (escaped defects per 100 FRs) |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | RL-nnn · TC-xxx · T-nn · MET-05, MET-12 |

---

## 1. Purpose and Use

This template specifies a test case in detail. Summary rows stay in FRS-<DOM>-08; client acceptance tests (`T-nn`) are held in VV-02. Every Must requirement has at least one positive and one negative test, and every business rule has at least one test case (TPL-01 §8).

*Guidance: test data is synthetic and taken from the golden dataset (HRMS Demo Dataset v1.1). Automated tests carry the TC ID in the test name so that REQ-02 links each requirement to its evidence. Delete guidance lines before use.*

## 2. Suite Header

| Field | Value |
| :--- | :--- |
| Suite | [FRS-<DOM>-08 section, e.g. Payroll golden cases] |
| Domain and capability | [`<DOM>` — capability] |
| Test level | [Unit / Integration / System / End-to-end / UAT / Performance / Security / Accessibility / AI evaluation / Migration reconciliation] |
| Environment | [Environment and data load] |
| Entry criteria | [Criteria] |
| Exit criteria | [Criteria with thresholds] |

## 3. Test Case

| Field | Value |
| :--- | :--- |
| Test case ID | [TC-xxx — source identifier, or the next free ID in the domain series] |
| Title | [Title] |
| Requirements verified | [RL-nnn, BS:RL-nn, `<DOM>-FR/NFR/AI-nnn`, SYS-nnn, BRQ-nnn] |
| Type | [Golden / Property / Positive / Negative / Boundary / Regression] |
| Priority | [P1 / P2 / P3] |
| Persona or role | [PER-nn] |
| Preconditions | [State before execution] |
| Source record | [Golden dataset sheet and record] |
| Automation | [Automated / Manual] |
| Verification method | [Test / Demonstration] |
| Pass threshold | [Measurable condition] |
| Detection phase represented | [Unit / Integration / System / UAT] |

| Step | Action | Expected result |
| ---: | :--- | :--- |
| [n] | [Action] | [Result] |

| Execution | Value |
| :--- | :--- |
| Build or version | [Reference] |
| Executed by, date | [Name, YYYY-MM-DD] |
| Result | [Pass / Fail / Blocked / Not run] |
| Defects raised | [Defect IDs; injection phase recorded on each] |
| Execution effort | [Minutes] |
| CAR link | [CAR-nnnn if a defect this test should have caught escaped] |

## 4. Worked Example — TC-Y281 Code on Wages 50% Floor Add-back

| Field | Value |
| :--- | :--- |
| Test case ID | TC-Y281 |
| Title | 50% floor add-back fires when excluded components exceed half of remuneration |
| Requirements verified | RL-281 (where excluded components exceed 50% of total remuneration, the excess is added back to the wage base); process step PAY-05.2 |
| Type | Golden |
| Priority | P1 |
| Persona or role | Payroll administrator (PER-13) |
| Preconditions | India statutory rule pack active with `floor_pct` = 50%; September 2026 run open for LE-01 and LE-02 |
| Source record | Sheet 13_Salary_Structure: E1014 Harish Nambiar (LE-01, Bengaluru Corporate Office) and E1049 Naveen Bandaru (LE-02, Medchal Works); control E1048 Sirisha Yadav |
| Automation | Automated |
| Verification method | Test |
| Pass threshold | Statutory wage base matches the golden value to the paisa for all three records; 0 add-back where excluded components are ≤ 50% |
| Detection phase represented | System |

| Step | Action | Expected result |
| ---: | :--- | :--- |
| 1 | Compute the wage base for E1014: monthly gross ₹ 1,80,975; Basic + DA ₹ 70,000; excluded ₹ 1,10,975 (61.32% of gross) | Add-back ₹ 20,487.50 (2048750 paise); statutory wage base ₹ 90,487.50 (9048750 paise) |
| 2 | Compute the wage base for E1049: monthly gross ₹ 1,13,530; Basic + DA ₹ 43,680; excluded ₹ 69,850 (61.53%) | Add-back ₹ 13,085; statutory wage base ₹ 56,765 |
| 3 | Compute the wage base for control E1048: excluded ₹ 43,930 (38.65% of ₹ 1,13,650) | Add-back ₹ 0; statutory wage base ₹ 69,720 |
| 4 | Open the payslip explanation for E1014 | The add-back line cites RL-281 and shows the 50% floor calculation |

The obligation behind RL-281 is a Code on Wages requirement (to be validated by Legal).

## Approval & Sign-off

| Role | Name | Date | Decision | Conditions / comments |
| :--- | :--- | :--- | :--- | :--- |
| Author | Dhanraj Dadhich | 2026-11-05 | Submitted | |
| Peer review moderator | *pending* | | | PR-xxxx |
| PQA (process compliance) | *pending* | | | |
| EPG Lead | *pending* | | | |

## Measurement Data Captured

| Measure | Value | Unit | Notes |
| :--- | :--- | :--- | :--- |
| Size | 4 | sections | |
| Authoring effort | *to be recorded* | person-hours | |
| Review effort (preparation + meeting) | *pending review* | person-hours | From PR-xxxx |
| Review rate | *pending review* | sections / hour | Compare with PPB-02 control limits |
| Requirement volatility | 0 | CRs since baseline | |

## Revision History

| Version | Date | Author | Change summary | CR ref | Approved by |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1.0.0 | 2026-11-05 | Dhanraj Dadhich | Consolidated release | CR-0001 | *pending* |
