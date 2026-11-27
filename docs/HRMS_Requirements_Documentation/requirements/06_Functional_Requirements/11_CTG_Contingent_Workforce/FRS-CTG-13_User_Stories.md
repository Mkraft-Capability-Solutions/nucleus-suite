<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-CTG-13 — Contingent Workforce — User Stories and Acceptance Criteria

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-CTG-13 |
| Title | Contingent Workforce — User Stories and Acceptance Criteria |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Contingent Workforce |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, VV |
| Related documents | FRS-CTG-00, FRS-CTG-01, FRS-CTG-02, FRS-CTG-03, FRS-CTG-04, FRS-CTG-05, FRS-CTG-06, FRS-CTG-07, FRS-CTG-08, FRS-CTG-09, FRS-CTG-10, FRS-CTG-11, FRS-CTG-12, FRS-CTG-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-03 · processes CTG-01–CTG-03 |
| Source of record | Derived from FRS-CTG-12 use cases; source rules, tests and golden data |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

24 user stories, each traced to its use case and verified by Given / When / Then acceptance criteria. Priority mix: Must 16, Should 8.

## 1. Story index

| ID | As a | I want | Priority | Use case |
| :--- | :--- | :--- | :--- | :--- |
| CTG-US-001 | HR operations | to register employees and helpers from one vendor under their own classes | Must | CTG-UC-001 |
| CTG-US-002 | Finance | to see the deployed population by class and rate for each engagement | Must | CTG-UC-001 |
| CTG-US-003 | Plant HR / time office | a worker already deployed by one vendor to be refused when another vendor submits them | Should | CTG-UC-001 |
| CTG-US-004 | Finance | the variance between claimed and attended days shown before I pay | Must | CTG-UC-002 |
| CTG-US-005 | Finance | to pass the supported amount and query the rest with evidence attached | Must | CTG-UC-002 |
| CTG-US-006 | Plant HR / time office | claimed days without attendance raised as exceptions that block vendor payment only | Must | CTG-UC-002 |
| CTG-US-007 | Compliance owner | vendors without filing evidence by the due date flagged as Held | Must | CTG-UC-003 |
| CTG-US-008 | Auditor | to retrieve a contractor's verified evidence for any period | Should | CTG-UC-003 |
| CTG-US-009 | Finance | the vendor's verification status shown on its invoice | Must | CTG-UC-003 |
| CTG-US-010 | HR operations | the per-site headcount cap held within the vendor's licence | Must | CTG-UC-004 |
| CTG-US-011 | Compliance owner | an alert before a contractor's contract or licence expires without renewal | Must | CTG-UC-004 |
| CTG-US-012 | Finance | rate cards with effective dates | Must | CTG-UC-004 |
| CTG-US-013 | Finance | invoice approval blocked until the vendor's challans are verified | Must | CTG-UC-005 |
| CTG-US-014 | Compliance owner | each deployed worker matched to the contribution lists | Must | CTG-UC-005 |
| CTG-US-015 | Director / approver | to release a held payment with the waived rule named | Should | CTG-UC-005 |
| CTG-US-016 | Plant HR / time office | gate access activated only after induction and PPE are complete | Must | CTG-UC-006 |
| CTG-US-017 | Employee / worker | to acknowledge each PPE item I receive | Must | CTG-UC-006 |
| CTG-US-018 | Compliance owner | a site list of contract workers with induction and PPE status | Should | CTG-UC-006 |
| CTG-US-019 | Compliance owner | every contract worker paid below minimum wage or for fewer days than worked listed before invoice release | Must | CTG-UC-007 |
| CTG-US-020 | Finance | the vendor invoice held until wage verification is complete | Must | CTG-UC-007 |
| CTG-US-021 | Plant HR / time office | workers in the wage register who are not registered on the engagement flagged to me | Should | CTG-UC-007 |
| CTG-US-022 | Plant HR / time office | a monthly forecast by line and class with seasonal peaks | Should | CTG-UC-008 |
| CTG-US-023 | Compliance owner | to know when planned deployment would breach a site licence | Should | CTG-UC-008 |
| CTG-US-024 | Director / approver | a costed plan to approve with monthly totals by site | Should | CTG-UC-008 |

## 2. Stories with acceptance criteria

### CTG-US-001 · Engage a contractor and register its workers by class

As a **HR operations**, I want to register employees and helpers from one vendor under their own classes, so that each group gets the rest days its class allows.

Priority: **Must** · Use case: CTG-UC-001 · Realises: CTG-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an engagement with VN-01 Sharada Manpower Services at Peenya Works supplying classes WC-3PE and WC-3PH | I register E1034 Imran Shaikh as WC-3PE and E1036 Lakshmi Rao as WC-3PH | Sunday 06 Sep resolves as Weekly Off for E1034 and Working for E1036 |
| 2 | the same engagement | I open it for editing | no rest-day or overtime field is offered on the engagement; each class's policy is shown read-only |

### CTG-US-002 · Engage a contractor and register its workers by class

As a **Finance**, I want to see the deployed population by class and rate for each engagement, so that I know what a correct invoice should look like before it arrives.

Priority: **Must** · Use case: CTG-UC-001 · Realises: CTG-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | VN-01 has 4 active workers across WC-3PE and WC-3PH at a rate of 700 rupees per worker per day | I open the engagement | I see the count per class, the rate per class and the invoice basis |
| 2 | one of those assignments ends on 15 Sep | I view the deployed population for 16 Sep | the count for that worker's class is reduced by one |

### CTG-US-003 · Engage a contractor and register its workers by class

As a **Plant HR / time office**, I want a worker already deployed by one vendor to be refused when another vendor submits them, so that no person is billed twice or enrolled under two engagements.

Priority: **Should** · Use case: CTG-UC-001 · Realises: CTG-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1036 is active under the VN-01 engagement at Peenya Works | VN-05 submits E1036 for deployment at Oragadam Works | registration is refused and the message names the VN-01 engagement |
| 2 | E1036's VN-01 assignment has ended | VN-05 submits her again | registration proceeds |

### CTG-US-004 · Reconcile a contractor invoice against attendance

As a **Finance**, I want the variance between claimed and attended days shown before I pay, so that we do not pay for days nobody worked.

Priority: **Must** · Use case: CTG-UC-002 · Realises: CTG-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | invoice INV-VN01-2609 claims 56 worker-days at 700 rupees (39,200 rupees) and attendance holds 53 | the invoice is reconciled | a variance of 3 days and 2,100 rupees is shown, listing E1036 on 06, 07 and 13 Sep |
| 2 | invoice INV-VN01-2608 claims 104 worker-days and attendance holds 104 | it is reconciled | variance is zero and 72,800 rupees is presented for approval |

### CTG-US-005 · Reconcile a contractor invoice against attendance

As a **Finance**, I want to pass the supported amount and query the rest with evidence attached, so that the vendor is paid promptly for undisputed days and knows exactly what is queried.

Priority: **Must** · Use case: CTG-UC-002 · Realises: CTG-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the reconciled INV-VN01-2609 | I pass 37,100 rupees and raise a query on the remaining 2,100 rupees | the decision records the evidence reference, the passed amount and the held amount, and the invoice status is Query raised |
| 2 | the same query | it is sent to VN-01 | it lists the three unsupported worker-days by worker and date |

### CTG-US-006 · Reconcile a contractor invoice against attendance

As a **Plant HR / time office**, I want claimed days without attendance raised as exceptions that block vendor payment only, so that I can check the gate records without holding anyone's salary.

Priority: **Must** · Use case: CTG-UC-002 · Realises: CTG-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | 07 Sep is claimed for E1036 on INV-VN01-2609 with no punch recorded | reconciliation runs | an exception of type 'Vendor claim without attendance' with severity 'Blocks vendor payment' appears in the exception queue |
| 2 | the same exception is open | the employee payroll run is prepared | it is not blocked by this exception |

### CTG-US-007 · Verify a contractor's monthly statutory compliance as principal employer

As a **Compliance owner**, I want vendors without filing evidence by the due date flagged as Held, so that our exposure as principal employer is visible before we pay them.

Priority: **Must** · Use case: CTG-UC-003 · Realises: CTG-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | VN-01 Sharada Manpower Services has not produced its August 2026 PF challan by the due date | the due date passes | VN-01's August verification is Held, escalated to the Director / approver and shown on VN-01's invoices |
| 2 | VN-02 uploads its August PF and ESI challans and wage register with establishment codes matching the vendor master | I review them | I can mark August Verified and the evidence is stored against VN-02's engagement and period |

### CTG-US-008 · Verify a contractor's monthly statutory compliance as principal employer

As a **Auditor**, I want to retrieve a contractor's verified evidence for any period, so that I can test the principal-employer control without asking the team.

Priority: **Should** · Use case: CTG-UC-003 · Realises: CTG-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | VN-05 Kaveri Industrial Services' August 2026 verification is Verified | I open it | I see the challans, payment proof, wage register, reviewer and verification date, all read-only |
| 2 | the same record | I attempt to replace a document | the action is not available to me |

### CTG-US-009 · Verify a contractor's monthly statutory compliance as principal employer

As a **Finance**, I want the vendor's verification status shown on its invoice, so that I do not approve a payment without knowing the compliance position.

Priority: **Must** · Use case: CTG-UC-003 · Realises: CTG-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | VN-01's August verification is Held | I open a VN-01 invoice | the verification status Held is shown with a link to the verification item |
| 2 | VN-02's August verification is Verified | I open a VN-02 invoice | the status Verified is shown with the verification date |

### CTG-US-010 · Maintain contract-labour vendors with licences, rate cards and caps

As a **HR operations**, I want the per-site headcount cap held within the vendor's licence, so that we never deploy more contract workers than the licence permits.

Priority: **Must** · Use case: CTG-UC-004 · Realises: CTG-CG-001

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | VN-01's licence at Peenya Works permits 20 workers | I set a cap of 25 for VN-01 at Peenya Works | the cap is refused and the licensed headcount of 20 is shown |
| 2 | a cap of 4 for VN-01 at Peenya Works with 4 workers deployed | a fifth worker is registered | registration is refused and the cap is named |

### CTG-US-011 · Maintain contract-labour vendors with licences, rate cards and caps

As a **Compliance owner**, I want an alert before a contractor's contract or licence expires without renewal, so that workers are not deployed under an expired contract.

Priority: **Must** · Use case: CTG-UC-004 · Realises: CTG-CG-001

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | VN-04 Deccan Facility Services' contract at Medchal Works ends on 30 Sep 2026 and no renewal has been raised | the configured 30-day lead time is reached on 31 Aug 2026 | I receive an alert naming VN-04, Medchal Works and the 30 Sep end date |
| 2 | the contract is not renewed by 30 Sep | a VN-04 worker is submitted for deployment on 01 Oct | the deployment is blocked |

### CTG-US-012 · Maintain contract-labour vendors with licences, rate cards and caps

As a **Finance**, I want rate cards with effective dates, so that invoices before and after a rate change reconcile at the right rate.

Priority: **Must** · Use case: CTG-UC-004 · Realises: CTG-CG-001

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | VN-01's rate is 700 rupees per worker per day from 01 Apr 2025 | I add a rate of 735 rupees effective 01 Oct 2026 | September 2026 invoices reconcile at 700 and October 2026 invoices at 735 |
| 2 | the same rate card | I add a row effective 15 Sep 2026 that overlaps the existing rows | the row is refused with the overlapping period shown |

### CTG-US-013 · Verify contractor challans against deployed workers before invoice approval

As a **Finance**, I want invoice approval blocked until the vendor's challans are verified, so that we never pay a contractor whose statutory dues are unevidenced.

Priority: **Must** · Use case: CTG-UC-005 · Realises: CTG-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | VN-01 has not produced its August 2026 PF challan | I try to approve INV-VN01-2608 | approval is blocked with the reason 'statutory verification incomplete for Aug 2026' |
| 2 | VN-01's August challans are uploaded and the vendor-period is marked Verified | I open INV-VN01-2608 | approval is available |

### CTG-US-014 · Verify contractor challans against deployed workers before invoice approval

As a **Compliance owner**, I want each deployed worker matched to the contribution lists, so that I can see exactly who is not covered.

Priority: **Must** · Use case: CTG-UC-005 · Realises: CTG-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | VN-01 deployed 4 workers in August including E1034 and E1036 | the ESI contribution list omits E1036 | the reconciliation shows E1036 as missing and Verified cannot be selected |
| 2 | the wage register shows 26 days for E1034 and attendance holds 26 | the reconciliation runs | E1034 is shown as covered with no day mismatch |

### CTG-US-015 · Verify contractor challans against deployed workers before invoice approval

As a **Director / approver**, I want to release a held payment with the waived rule named, so that an exceptional release is deliberate and traceable.

Priority: **Should** · Use case: CTG-UC-005 · Realises: CTG-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | VN-01's August verification is incomplete and its invoice is blocked | I release the invoice with the reason 'Challan paid, upload delayed; evidence due 10 Oct' | the release records me, the time, the reason and the waived rule |
| 2 | the release is recorded | an auditor views the invoice | the waiver and its reason are shown alongside the decision |

### CTG-US-016 · Complete safety induction and PPE issue before gate access

As a **Plant HR / time office**, I want gate access activated only after induction and PPE are complete, so that no contract worker reaches the shop floor unprepared.

Priority: **Must** · Use case: CTG-UC-006 · Realises: CTG-CG-003

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1036 is registered at Peenya Works and has not completed the safety induction | she presents at the gate terminal | entry is refused, the attempt is logged and an exception is raised to the time office |
| 2 | her induction is recorded as passed and safety shoes, helmet and goggles are issued and acknowledged | the checklist completes | gate access is activated and her next gate punch is accepted |

### CTG-US-017 · Complete safety induction and PPE issue before gate access

As a **Employee / worker**, I want to acknowledge each PPE item I receive, so that there is a clear record of what I was issued.

Priority: **Must** · Use case: CTG-UC-006 · Realises: CTG-CG-003

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a helmet, safety shoes and goggles are issued to me on 02 Sep | I acknowledge receipt at the site kiosk | each item is recorded against me with the issue date and my acknowledgement |
| 2 | only two of the three required items are issued | I acknowledge them | my gate access stays pending and the missing item is shown |

### CTG-US-018 · Complete safety induction and PPE issue before gate access

As a **Compliance owner**, I want a site list of contract workers with induction and PPE status, so that I can evidence the control during an inspection.

Priority: **Should** · Use case: CTG-UC-006 · Realises: CTG-CG-003

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | VN-01 has 4 active workers at Peenya Works | I open the site induction and PPE status list | each worker shows induction date, validity end, PPE items issued and gate access status |
| 2 | one worker's induction validity has ended | the list is refreshed | that worker is flagged and their gate access shows Suspended |

### CTG-US-019 · Validate contractor wage payments against gate attendance and minimum wages before invoice release

As a **Compliance owner**, I want every contract worker paid below minimum wage or for fewer days than worked listed before invoice release, so that we never pay a contractor who has short-paid workers.

Priority: **Must** · Use case: CTG-UC-007 · Realises: CTG-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | worker CW-2231 at Chakan Works has 26 gate days in October 2026 and the register pays 24 | validation runs | CW-2231 is classified Days mismatch with 2 unpaid days |
| 2 | the register pays CW-2240 a daily rate ₹35 below the applicable minimum wage | validation runs | CW-2240 is classified Underpaid with the shortfall per day and for the month |

### CTG-US-020 · Validate contractor wage payments against gate attendance and minimum wages before invoice release

As a **Finance**, I want the vendor invoice held until wage verification is complete, so that payments follow evidence.

Priority: **Must** · Use case: CTG-UC-007 · Realises: CTG-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | vendor V-014 for October 2026 has 3 Underpaid workers | I open the invoice | it shows Held with reason wage verification incomplete |
| 2 | the vendor uploads arrears proof and all 3 pass | validation re-runs | the vendor-period shows Wage verified and the invoice becomes payable |

### CTG-US-021 · Validate contractor wage payments against gate attendance and minimum wages before invoice release

As a **Plant HR / time office**, I want workers in the wage register who are not registered on the engagement flagged to me, so that I can stop unregistered deployment at the gate.

Priority: **Should** · Use case: CTG-UC-007 · Realises: CTG-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the register includes CW-2299 who is not registered on the engagement | the file is validated | the row is rejected and I receive a flag naming CW-2299 and the vendor |
| 2 | CW-2299 also has gate punches in October | I open the flag | the punch dates are shown for investigation |

### CTG-US-022 · Forecast contract labour by line and season and compare with vendor capacity

As a **Plant HR / time office**, I want a monthly forecast by line and class with seasonal peaks, so that I can book vendors before the festive dispatch peak.

Priority: **Should** · Use case: CTG-UC-008 · Realises: CTG-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the machining line plan rises 18% in October 2027 and absence historically rises 6% that month | the forecast is computed | October shows the higher requirement with both drivers explained |
| 2 | the agent proposes 12 more helpers for October | I reduce it to 8 and accept | 8 is used in the forecast and my edit is recorded in the action ledger |

### CTG-US-023 · Forecast contract labour by line and season and compare with vendor capacity

As a **Compliance owner**, I want to know when planned deployment would breach a site licence, so that we apply for an amendment in time.

Priority: **Should** · Use case: CTG-UC-008 · Realises: CTG-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | Chakan Works is licensed for 450 contract workers and October 2027 forecasts 472 | capacity is compared | 22 workers are shown as unallocatable and I am alerted |
| 2 | the forecast is reduced to 445 | capacity is compared again | the alert is cleared |

### CTG-US-024 · Forecast contract labour by line and season and compare with vendor capacity

As a **Director / approver**, I want a costed plan to approve with monthly totals by site, so that the contract labour budget matches the production plan.

Priority: **Should** · Use case: CTG-UC-008 · Realises: CTG-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the plan totals ₹6.8 crore for FY 2027-28 at Chakan Works | I open the approval | I see monthly cost by line and vendor |
| 2 | the approved plan has 100 contract workers on the assembly line for May 2027 | actual deployment reaches 114 | Plant HR is alerted to a 14% variance on that line |

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
| Size | 72 | specified items (table rows) | Counted automatically at generation |
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
