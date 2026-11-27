<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-LCY-13 — Lifecycle — User Stories and Acceptance Criteria

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-LCY-13 |
| Title | Lifecycle — User Stories and Acceptance Criteria |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Lifecycle |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, VV |
| Related documents | FRS-LCY-00, FRS-LCY-01, FRS-LCY-02, FRS-LCY-03, FRS-LCY-04, FRS-LCY-05, FRS-LCY-06, FRS-LCY-07, FRS-LCY-08, FRS-LCY-09, FRS-LCY-10, FRS-LCY-11, FRS-LCY-12, FRS-LCY-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 · R-17, R-24 · processes LCY-01–LCY-08 |
| Source of record | Derived from FRS-LCY-12 use cases; source rules, tests and golden data |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

40 user stories, each traced to its use case and verified by Given / When / Then acceptance criteria. Priority mix: Must 28, Should 12.

## 1. Story index

| ID | As a | I want | Priority | Use case |
| :--- | :--- | :--- | :--- | :--- |
| LCY-US-001 | HR operations | pre-boarding tasks to run in parallel with owners and due dates | Must | LCY-UC-001 |
| LCY-US-002 | Candidate | to see exactly which documents are pending and why one was rejected | Should | LCY-UC-001 |
| LCY-US-003 | HR operations | one joining console showing every step, owner, SLA and generated artefact per hire | Must | LCY-UC-002 |
| LCY-US-004 | Compliance owner | Form F produced as a step of the joining chain | Must | LCY-UC-002 |
| LCY-US-005 | Employee / worker | to acknowledge policies on my phone with the version recorded | Must | LCY-UC-002 |
| LCY-US-006 | Payroll manager | an alert when bank details are captured inside the payroll window | Must | LCY-UC-002 |
| LCY-US-007 | HR operations | confirmation blocked while any mandatory induction item is open | Must | LCY-UC-003 |
| LCY-US-008 | Manager / supervisor | a reminder 30 days before my team member's confirmation date | Should | LCY-UC-003 |
| LCY-US-009 | Payroll manager | a transfer to re-resolve professional tax for the new state from the effective date | Must | LCY-UC-004 |
| LCY-US-010 | Plant HR / time office | a transferred employee to appear in my scope from the effective date | Should | LCY-UC-004 |
| LCY-US-011 | Employee / worker | to see my required notice and any shortfall when I propose a last working day | Must | LCY-UC-005 |
| LCY-US-012 | HR operations | clearance to start the moment I accept a resignation | Must | LCY-UC-005 |
| LCY-US-013 | Payroll manager | F&F held while any blocking clearance item is open | Must | LCY-UC-006 |
| LCY-US-014 | Department clearance owner | to see only my items with SLAs on my phone | Must | LCY-UC-006 |
| LCY-US-015 | Director / approver | to waive a blocking item only with a reason, turning its value into a recovery | Must | LCY-UC-006 |
| LCY-US-016 | Payroll manager | each settlement line with its basis | Must | LCY-UC-007 |
| LCY-US-017 | Finance | a held settlement excluded from the bank file | Must | LCY-UC-007 |
| LCY-US-018 | HR operations | the F&F record to save without error at every step | Must | LCY-UC-007 |
| LCY-US-019 | Admin / IT | every issued asset to appear automatically on the leaver's clearance list | Must | LCY-UC-008 |
| LCY-US-020 | Payroll manager | unreturned assets to flow into F&F as recovery lines | Must | LCY-UC-008 |
| LCY-US-021 | HR operations | joining held until mandatory checks clear | Must | LCY-UC-009 |
| LCY-US-022 | Candidate | to give explicit consent before checks start | Should | LCY-UC-009 |
| LCY-US-023 | Employee / worker | to apply for an internal role from self-service | Must | LCY-UC-010 |
| LCY-US-024 | HR operations | an inter-entity transfer that keeps service date and leave balances | Must | LCY-UC-010 |
| LCY-US-025 | HR operations | to record rehire eligibility at exit | Should | LCY-UC-011 |
| LCY-US-026 | Employee / worker | to choose whether to join the alumni network | Should | LCY-UC-011 |
| LCY-US-027 | HR operations | structured primary and secondary exit reasons | Must | LCY-UC-012 |
| LCY-US-028 | Manager / supervisor | attrition reports that do not identify individuals | Must | LCY-UC-012 |
| LCY-US-029 | Manager / supervisor | a probation review task 30 days before it is due | Must | LCY-UC-013 |
| LCY-US-030 | HR operations | the approved outcome to update the assignment and generate the letter | Must | LCY-UC-013 |
| LCY-US-031 | Employee / worker | to receive my confirmation letter in self-service | Should | LCY-UC-013 |
| LCY-US-032 | HR operations | to see the impact of a conversion before approval | Must | LCY-UC-014 |
| LCY-US-033 | Employee / worker | my service to count from my original joining date where policy allows | Must | LCY-UC-014 |
| LCY-US-034 | Compliance owner | statutory re-registration steps opened automatically | Should | LCY-UC-014 |
| LCY-US-035 | Employee / worker | to see my notice shortfall and buy-out cost before I confirm | Must | LCY-UC-015 |
| LCY-US-036 | Payroll manager | the approved notice result passed to full and final | Must | LCY-UC-015 |
| LCY-US-037 | Manager / supervisor | to approve an early release with the cost shown | Should | LCY-UC-015 |
| LCY-US-038 | Manager / supervisor | a hand-over plan pre-filled with what the leaver owns | Should | LCY-UC-016 |
| LCY-US-039 | Employee / worker | a clear checklist of what to hand over | Should | LCY-UC-016 |
| LCY-US-040 | HR operations | clearance to wait for the hand-over sign-off | Should | LCY-UC-016 |

## 2. Stories with acceptance criteria

### LCY-US-001 · Run pre-boarding from offer acceptance to day one

As a **HR operations**, I want pre-boarding tasks to run in parallel with owners and due dates, so that a joiner is ready on day one without me chasing each department.

Priority: **Must** · Use case: LCY-UC-001 · Realises: LCY-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | candidate CN-2026-0188 accepts offer OF-2026-0066 for joining on 2026-09-01 | the chain is instantiated | document collection, medical fitness and asset tasks are created in parallel, each with owner and due date |
| 2 | medical fitness for a factory role is open on 2026-08-30 | the readiness check runs | the owner and HR operations are alerted that a blocking item is open |

### LCY-US-002 · Run pre-boarding from offer acceptance to day one

As a **Candidate**, I want to see exactly which documents are pending and why one was rejected, so that I can complete joining formalities without repeated calls.

Priority: **Should** · Use case: LCY-UC-001 · Realises: LCY-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I uploaded a blurred PAN card | HR rejects it with reason 'illegible' | I see the rejection reason and a re-upload option |
| 2 | all my documents are accepted | I open the portal | every document item shows Complete |

### LCY-US-003 · Complete the joining chain

As a **HR operations**, I want one joining console showing every step, owner, SLA and generated artefact per hire, so that I can see and clear blockers before the joiner's first payroll.

Priority: **Must** · Use case: LCY-UC-002 · Realises: LCY-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1066 joins Chakan Works on 2026-09-01 | the joining chain starts | SCR-060 lists registrations, Form F, bank capture, policy acknowledgement, induction and asset steps with owners and SLAs |
| 2 | the ESI registration step for E1066 is 2 days past its SLA | I open SCR-060 | the step is shown overdue and has been escalated to the HR operations lead |

### LCY-US-004 · Complete the joining chain

As a **Compliance owner**, I want Form F produced as a step of the joining chain, so that the form exists from day one for every factory joiner.

Priority: **Must** · Use case: LCY-UC-002 · Realises: LCY-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1066 joins at a factory location on 2026-09-01 | the statutory forms step runs | Form F FRM-F-2026-0112 is generated and linked to E1066 |
| 2 | a joiner at LOC-BLR, an office location | the statutory forms step runs | no Form F is generated and the step completes as not applicable |

### LCY-US-005 · Complete the joining chain

As a **Employee / worker**, I want to acknowledge policies on my phone with the version recorded, so that there is no dispute later about which version I accepted.

Priority: **Must** · Use case: LCY-UC-002 · Realises: LCY-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the code of conduct is at version 3.2 | I acknowledge it on SCR-062 on 2026-09-02 | my acknowledgement records policy version 3.2 and timestamp 2026-09-02 |
| 2 | the policy is updated to version 3.3 | I open SCR-062 | I am asked to acknowledge version 3.3 and my 3.2 acknowledgement remains on record |

### LCY-US-006 · Complete the joining chain

As a **Payroll manager**, I want an alert when bank details are captured inside the payroll window, so that a fraudulent or mistaken account change is caught before disbursement.

Priority: **Must** · Use case: LCY-UC-002 · Realises: LCY-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the September 2026 payroll window for LE-01 is open | HR captures bank details for a joiner | an alert is raised to me naming the employee and change time |
| 2 | the window is closed | bank details are captured | no alert is raised |

### LCY-US-007 · Confirm an employee at the end of probation

As a **HR operations**, I want confirmation blocked while any mandatory induction item is open, so that no one is confirmed without completing required training.

Priority: **Must** · Use case: LCY-UC-003 · Realises: LCY-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1066 has harassment-prevention awareness IND-2026-0090 in progress | I try to action confirmation | the action is blocked and IND-2026-0090 is named as the blocker |
| 2 | E1058 has all induction items complete and a Confirm recommendation | I action confirmation on 2026-09-01 | the assignment shows confirmed from 2026-09-01 and a confirmation letter is generated |

### LCY-US-008 · Confirm an employee at the end of probation

As a **Manager / supervisor**, I want a reminder 30 days before my team member's confirmation date, so that I assess on time.

Priority: **Should** · Use case: LCY-UC-003 · Realises: LCY-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1060's confirmation is due 2026-10-06 | 2026-09-06 arrives | I receive a confirmation task for E1060 |
| 2 | I recommend extending probation by 3 months for below-par performance | HR approves | the new probation end date is 2027-01-06 and an extension letter is generated |

### LCY-US-009 · Process a promotion or transfer

As a **Payroll manager**, I want a transfer to re-resolve professional tax for the new state from the effective date, so that the employee is not taxed under the old state.

Priority: **Must** · Use case: LCY-UC-004 · Realises: LCY-04

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1051 transfers from Peenya Works (KA) to Chakan Works (MH) effective 2026-10-01 | October payroll runs | professional tax is computed on the Maharashtra slab |
| 2 | the transfer is effective 2026-10-16 | October payroll runs | the period is split and both states' rules are applied to their portions |

### LCY-US-010 · Process a promotion or transfer

As a **Plant HR / time office**, I want a transferred employee to appear in my scope from the effective date, so that I can manage their attendance from day one.

Priority: **Should** · Use case: LCY-UC-004 · Realises: LCY-04

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1051 transfers to LOC-PUN effective 2026-10-01 | I open the attendance screen on 2026-10-01 | E1051 appears in my list |
| 2 | the Peenya plant HR opens attendance on 2026-10-01 | the list loads | E1051 no longer appears for dates from 2026-10-01 |

### LCY-US-011 · Submit and process a resignation with notice

As a **Employee / worker**, I want to see my required notice and any shortfall when I propose a last working day, so that I know the financial effect before I submit.

Priority: **Must** · Use case: LCY-UC-005 · Realises: LCY-05

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | my notice period is 30 days | I resign on 2026-08-19 proposing 2026-09-18 | the screen shows 30 days required, 30 served and no shortfall |
| 2 | I propose 2026-09-08 instead | the computation runs | a 10-day shortfall is shown |

### LCY-US-012 · Submit and process a resignation with notice

As a **HR operations**, I want clearance to start the moment I accept a resignation, so that no-dues finishes by the last working day.

Priority: **Must** · Use case: LCY-UC-005 · Realises: LCY-05

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I accept E1042's resignation with last working day 2026-09-18 | acceptance is saved | the clearance checklist for his worker class and location is created with all items open |
| 2 | the employee withdraws before acceptance | I open the case | it shows Withdrawn and no checklist exists |

### LCY-US-013 · Clear no-dues before full and final settlement

As a **Payroll manager**, I want F&F held while any blocking clearance item is open, so that no settlement is paid with assets or dues outstanding.

Priority: **Must** · Use case: LCY-UC-006 · Realises: LCY-06

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1042 has two open blocking items: tool kit and locker key, and knowledge transfer | I try to release his F&F | release is refused and both items are listed |
| 2 | both items are then cleared | the check runs | F&F moves from HELD to READY |

### LCY-US-014 · Clear no-dues before full and final settlement

As a **Department clearance owner**, I want to see only my items with SLAs on my phone, so that I clear my part without waiting for others.

Priority: **Must** · Use case: LCY-UC-006 · Realises: LCY-06

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I own 'ID card and access revocation' for E1068 | I mark it cleared on 2026-09-30 | the item shows Cleared with my name and date |
| 2 | my item for E1042 is 2 days past SLA | the daily check runs | my manager is notified |

### LCY-US-015 · Clear no-dues before full and final settlement

As a **Director / approver**, I want to waive a blocking item only with a reason, turning its value into a recovery, so that an unreturned asset is recovered, not silently ticked.

Priority: **Must** · Use case: LCY-UC-006 · Realises: LCY-06

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | tool kit AST-T-0077 with recovery value 12,000 is unreturned | I waive the item with reason 'lost on site' | the item shows Waived and a 12,000 recovery line is added to the F&F |
| 2 | I submit a waiver with an empty reason | I save | the waiver is refused |

### LCY-US-016 · Settle full and final on the last working day

As a **Payroll manager**, I want each settlement line with its basis, so that I can approve quickly and answer the leaver's questions.

Priority: **Must** · Use case: LCY-UC-007 · Realises: LCY-07

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1068 has 7 completed years and Basic plus DA of 43,120 | the settlement is computed | gratuity shows 174,138 with basis 15/26 x 43,120 x 7 |
| 2 | E1068 served 30 of 30 notice days | the settlement is computed | notice pay shows 0 with the basis stated |

### LCY-US-017 · Settle full and final on the last working day

As a **Finance**, I want a held settlement excluded from the bank file, so that payment is never released before no-dues.

Priority: **Must** · Use case: LCY-UC-007 · Realises: LCY-07

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | run PR-2026-09-03 has settlements for E1068 and E1042 and E1042 is HELD | the bank file is generated | it contains only E1068's settlement |
| 2 | E1042's items are cleared later | the file is regenerated | E1042 is included |

### LCY-US-018 · Settle full and final on the last working day

As a **HR operations**, I want the F&F record to save without error at every step, so that the reported save defect cannot recur.

Priority: **Must** · Use case: LCY-UC-007 · Realises: LCY-07

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an F&F with one clearance line Pending | I save the record | it saves and release remains blocked |
| 2 | the line is Cleared | I save again | it saves and release is permitted |

### LCY-US-019 · Allocate and recover company assets

As a **Admin / IT**, I want every issued asset to appear automatically on the leaver's clearance list, so that nothing is forgotten at exit.

Priority: **Must** · Use case: LCY-UC-008 · Realises: LCY-08

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1066 holds laptop AST-L-0412, handset AST-M-0908 and access card AST-A-1155 | his resignation is accepted | three asset items appear on his clearance checklist with recovery values 58,000, 14,000 and 500 |
| 2 | laptop AST-L-0298 is returned by E1068 on 2026-09-24 in good condition | I record the return | the clearance item is cleared and the asset becomes Available |

### LCY-US-020 · Allocate and recover company assets

As a **Payroll manager**, I want unreturned assets to flow into F&F as recovery lines, so that we recover their value.

Priority: **Must** · Use case: LCY-UC-008 · Realises: LCY-08

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | locker key AST-K-0231 for E1042 is waived as not returned | F&F is computed | a 500 asset recovery deduction appears |
| 2 | PPE set AST-P-0512 was written off as worn | F&F is computed | no recovery line appears for it |

### LCY-US-021 · Orchestrate background verification before joining

As a **HR operations**, I want joining held until mandatory checks clear, so that we never onboard someone whose mandatory check failed.

Priority: **Must** · Use case: LCY-UC-009 · Realises: LCY-CG-001

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | Basanti Naik's package marks identity and previous employment as mandatory | previous employment is Pending on 2026-10-04 | her joining on 2026-10-05 is held |
| 2 | both mandatory components are Clear | the check runs | the joining gate opens |

### LCY-US-022 · Orchestrate background verification before joining

As a **Candidate**, I want to give explicit consent before checks start, so that my data is used only for the purpose I agreed to.

Priority: **Should** · Use case: LCY-UC-009 · Realises: LCY-CG-001

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I have not consented | HR attempts to start checks | no request is sent |
| 2 | I consent on 2026-09-21 | checks start | the consent timestamp is recorded with the request |

### LCY-US-023 · Apply for internal roles and run inter-entity transfers

As a **Employee / worker**, I want to apply for an internal role from self-service, so that I can grow without leaving the company.

Priority: **Must** · Use case: LCY-UC-010 · Realises: LCY-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I have 14 months' tenure and the rule requires 12 | I open an internal opening | the Apply action is available |
| 2 | a colleague has 8 months' tenure | they open the same opening | Apply is unavailable and the tenure rule is shown |

### LCY-US-024 · Apply for internal roles and run inter-entity transfers

As a **HR operations**, I want an inter-entity transfer that keeps service date and leave balances, so that the employee loses nothing by moving.

Priority: **Must** · Use case: LCY-UC-010 · Realises: LCY-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an employee moves from LE-01 to LE-02 on 2026-11-01 with 9.5 earned leave days | the transfer completes | the LE-02 assignment shows the original service date and 9.5 days earned leave |
| 2 | the transfer completes | payroll looks for an exit | no F&F is created for the employee |

### LCY-US-025 · Record rehire eligibility and maintain alumni

As a **HR operations**, I want to record rehire eligibility at exit, so that future hiring decisions use what we knew at exit.

Priority: **Should** · Use case: LCY-UC-011 · Realises: LCY-CG-003

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1068 exits on 2026-09-30 | I record Eligible with reason 'voluntary, good standing' | the record shows Eligible and the reason is visible only to HR |
| 2 | E1068 applies again in 2027 | a recruiter opens the application | a returning-employee flag links to his past record |

### LCY-US-026 · Record rehire eligibility and maintain alumni

As a **Employee / worker**, I want to choose whether to join the alumni network, so that I control how the company contacts me after I leave.

Priority: **Should** · Use case: LCY-UC-011 · Realises: LCY-CG-003

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I decline consent | my exit completes | no alumni record exists for me |
| 2 | I consent and later withdraw | the withdrawal is saved | my contact data is removed from the alumni list |

### LCY-US-027 · Capture exit interviews and attrition reasons

As a **HR operations**, I want structured primary and secondary exit reasons, so that attrition reports show real drivers.

Priority: **Must** · Use case: LCY-UC-012 · Realises: LCY-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I interview E1068 | I record primary reason 'career growth' and secondary 'commute' | both codes are stored against his exit |
| 2 | the exit interview for E1042 is still open on his last working day | F&F release is checked | the open interview does not hold F&F |

### LCY-US-028 · Capture exit interviews and attrition reasons

As a **Manager / supervisor**, I want attrition reports that do not identify individuals, so that I can act on patterns without breaching confidence.

Priority: **Must** · Use case: LCY-UC-012 · Realises: LCY-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | 3 people left the Assembly department at LOC-PLA in Q3 | I open the Q3 attrition report | the department cell is suppressed and counted under Other |
| 2 | 12 people left LOC-PLA in Q3 | I open the report | reason counts for LOC-PLA are shown without names |

### LCY-US-029 · Automate probation reviews and outcomes

As a **Manager / supervisor**, I want a probation review task 30 days before it is due, so that I decide in time instead of letting probation lapse.

Priority: **Must** · Use case: LCY-UC-013 · Realises: LCY-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1066 joined on 2026-09-01 with 6 months probation ending 2027-02-28 | the date reaches 2027-01-29 | I receive a review task due 2027-02-28 |
| 2 | I have not submitted by 2027-02-28 | the due date passes | the task escalates to my manager and HR |

### LCY-US-030 · Automate probation reviews and outcomes

As a **HR operations**, I want the approved outcome to update the assignment and generate the letter, so that confirmation is consistent across records and documents.

Priority: **Must** · Use case: LCY-UC-013 · Realises: LCY-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | confirmation is approved | the outcome is recorded | the assignment shows confirmed from 2027-03-01 and the letter is sent for e-signature |
| 2 | an extension of 3 months with a 3-month policy maximum | it is approved | the probation end date becomes 2027-05-31 and a new review is scheduled |

### LCY-US-031 · Automate probation reviews and outcomes

As a **Employee / worker**, I want to receive my confirmation letter in self-service, so that I have proof of my confirmed status.

Priority: **Should** · Use case: LCY-UC-013 · Realises: LCY-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | my confirmation is approved | the letter is generated | it appears in my documents and asks for my acknowledgement |
| 2 | I acknowledge the letter | I sign | the acknowledgement time is recorded on the letter |

### LCY-US-032 · Convert a contract or trainee worker to permanent

As a **HR operations**, I want to see the impact of a conversion before approval, so that I know how leave, pay and statutory treatment will change.

Priority: **Must** · Use case: LCY-UC-014 · Realises: LCY-CG-006

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1030 is a trainee entitled only to CL | I preview conversion to WC-PERM from 2026-12-01 | the preview shows EL, CL and SL entitlements, the permanent pay structure and the continuity date |
| 2 | no permanent position is vacant at Peenya Machining | I preview | conversion is blocked with the position status named |

### LCY-US-033 · Convert a contract or trainee worker to permanent

As a **Employee / worker**, I want my service to count from my original joining date where policy allows, so that my gratuity and leave are not reset.

Priority: **Must** · Use case: LCY-UC-014 · Realises: LCY-CG-006

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a continuity rule counting trainee service for WC-TRN | E1030 is converted on 2026-12-01 having joined on 2026-07-01 | the continuity date is 2026-07-01 |
| 2 | the conversion completes | I open my profile | I see one employee code and worker class Permanent |

### LCY-US-034 · Convert a contract or trainee worker to permanent

As a **Compliance owner**, I want statutory re-registration steps opened automatically, so that registrations match the new worker class.

Priority: **Should** · Use case: LCY-UC-014 · Realises: LCY-CG-006

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1030 is converted | the chain runs | steps for the UAN update and nomination forms are created with owners and SLAs |
| 2 | a step is not done within its SLA | the SLA lapses | it escalates to me |

### LCY-US-035 · Compute notice period, shortfall and buy-out

As a **Employee / worker**, I want to see my notice shortfall and buy-out cost before I confirm, so that I can choose the best option.

Priority: **Must** · Use case: LCY-UC-015 · Realises: LCY-CG-007

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I am E1051 at Medchal Works with 30 days notice, resigning on 2026-11-02 and requesting LWD 2026-11-19 | I view the computation | I see a 12-day shortfall and its buy-out amount |
| 2 | I have 5 days of earned leave | I ask to offset 8 days | the offset is capped at 5 and 7 days are added to the buy-out |

### LCY-US-036 · Compute notice period, shortfall and buy-out

As a **Payroll manager**, I want the approved notice result passed to full and final, so that I do not recompute it by hand.

Priority: **Must** · Use case: LCY-UC-015 · Realises: LCY-CG-007

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a 7-day buy-out approved for E1051 | full and final is computed | a notice recovery line with the approved amount appears |
| 2 | the shortfall is waived by the manager | full and final is computed | no notice recovery line appears and the waiver is referenced |

### LCY-US-037 · Compute notice period, shortfall and buy-out

As a **Manager / supervisor**, I want to approve an early release with the cost shown, so that I make an informed decision.

Priority: **Should** · Use case: LCY-UC-015 · Realises: LCY-CG-007

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1051 asks to leave on 2026-11-19 | I open the approval | I see the shortfall, buy-out amount and leave offset |
| 2 | I approve | the decision is saved | the last working day is set to 2026-11-19 |

### LCY-US-038 · Complete a knowledge-transfer plan before exit clearance

As a **Manager / supervisor**, I want a hand-over plan pre-filled with what the leaver owns, so that nothing is forgotten when they leave.

Priority: **Should** · Use case: LCY-UC-016 · Realises: LCY-CG-008

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1068 owns 3 open approvals and 12 engineering documents | the resignation is accepted | the plan lists all 15 items for successor assignment |
| 2 | I approve the plan with successor E1005 for documents | items are completed | document ownership moves to E1005 |

### LCY-US-039 · Complete a knowledge-transfer plan before exit clearance

As a **Employee / worker**, I want a clear checklist of what to hand over, so that I can leave knowing my work is covered.

Priority: **Should** · Use case: LCY-UC-016 · Realises: LCY-CG-008

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | my plan has 15 items | I record completion with successor acknowledgement | each item shows completed with the date |
| 2 | a successor declines an item | the decline is recorded | my manager is asked to reassign it |

### LCY-US-040 · Complete a knowledge-transfer plan before exit clearance

As a **HR operations**, I want clearance to wait for the hand-over sign-off, so that knowledge transfer is not skipped to close exit faster.

Priority: **Should** · Use case: LCY-UC-016 · Realises: LCY-CG-008

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the knowledge-transfer item is configured as blocking for engineering roles | the plan is unsigned on LWD 2026-09-30 | full and final remains on hold |
| 2 | an authorised HR head waives the item with a reason | the waiver is saved | the clearance item closes and settlement can proceed |

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
| Size | 120 | specified items (table rows) | Counted automatically at generation |
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
