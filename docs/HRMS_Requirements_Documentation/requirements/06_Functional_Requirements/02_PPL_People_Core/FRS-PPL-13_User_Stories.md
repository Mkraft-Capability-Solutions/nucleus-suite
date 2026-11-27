<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-PPL-13 — People Core — User Stories and Acceptance Criteria

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-PPL-13 |
| Title | People Core — User Stories and Acceptance Criteria |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — People Core |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, VV |
| Related documents | FRS-PPL-00, FRS-PPL-01, FRS-PPL-02, FRS-PPL-03, FRS-PPL-04, FRS-PPL-05, FRS-PPL-06, FRS-PPL-07, FRS-PPL-08, FRS-PPL-09, FRS-PPL-10, FRS-PPL-11, FRS-PPL-12, FRS-PPL-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 · R-03, R-04, R-05, R-23 · processes PPL-01–PPL-08 |
| Source of record | Derived from FRS-PPL-12 use cases; source rules, tests and golden data |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

50 user stories, each traced to its use case and verified by Given / When / Then acceptance criteria. Priority mix: Must 37, Should 13.

## 1. Story index

| ID | As a | I want | Priority | Use case |
| :--- | :--- | :--- | :--- | :--- |
| PPL-US-001 | HR operations | the system to search for an existing person before I create a new one | Must | PPL-UC-001 |
| PPL-US-002 | HR operations | to assign a new hire only to a vacant, active position | Must | PPL-UC-001 |
| PPL-US-003 | Payroll manager | payroll group and location to be set independently on every assignment | Must | PPL-UC-001 |
| PPL-US-004 | Employee / worker | to join on my planned date even if my PAN record needs correction | Must | PPL-UC-001 |
| PPL-US-005 | HR operations | to record an assignment change with an effective date and reason | Must | PPL-UC-002 |
| PPL-US-006 | Payroll manager | retro changes to produce arrears instead of rewriting closed runs | Must | PPL-UC-002 |
| PPL-US-007 | Plant HR / time office | attendance to be recomputed automatically when a worker's shift group or rest days change | Must | PPL-UC-002 |
| PPL-US-008 | Payroll manager | contractual daily-wage workers to be paid only for days present with no weekly off | Must | PPL-UC-003 |
| PPL-US-009 | Plant HR / time office | third-party employees and helpers under one vendor to resolve different rest-day rules | Must | PPL-UC-003 |
| PPL-US-010 | Plant HR / time office | OT to be generated only on rest days or holidays for workers with that eligibility basis | Must | PPL-UC-003 |
| PPL-US-011 | Implementation consultant | grace exemption to come from the designation band | Must | PPL-UC-003 |
| PPL-US-012 | Finance | to record approved manpower by department, designation and location | Must | PPL-UC-004 |
| PPL-US-013 | Manager / supervisor | to see headroom before raising a requisition | Must | PPL-UC-004 |
| PPL-US-014 | HR operations | a separated worker's position to be marked vacant with the last incumbent | Must | PPL-UC-004 |
| PPL-US-015 | HR operations | to re-parent a department with an effective date | Must | PPL-UC-005 |
| PPL-US-016 | Manager / supervisor | the organisation chart to follow reporting relationships on the employee record | Must | PPL-UC-005 |
| PPL-US-017 | Employee / worker | to upload my documents from my phone with the type suggested for me | Must | PPL-UC-006 |
| PPL-US-018 | HR operations | only low-confidence extractions to come to my verification queue | Must | PPL-UC-006 |
| PPL-US-019 | Compliance owner | reminders before a document expires | Must | PPL-UC-006 |
| PPL-US-020 | HR operations | to rehire a former worker on the same person record | Must | PPL-UC-007 |
| PPL-US-021 | Payroll manager | an entity transfer to close the old employment and open the new one without a gap or overlap | Must | PPL-UC-007 |
| PPL-US-022 | HR operations | converting a third-party worker to permanent to re-resolve their policy | Should | PPL-UC-007 |
| PPL-US-023 | HR operations | to decide suspected duplicates with both records side by side | Must | PPL-UC-008 |
| PPL-US-024 | Payroll manager | inbound ERP employee records that look like duplicates to be held | Must | PPL-UC-008 |
| PPL-US-025 | HR operations | to define job profiles with band and required competencies | Must | PPL-UC-009 |
| PPL-US-026 | Implementation consultant | profiles in use to be protected from retirement | Should | PPL-UC-009 |
| PPL-US-027 | HR operations | to give a worker a dotted-line project manager for a fixed period | Must | PPL-UC-010 |
| PPL-US-028 | Manager / supervisor | dotted-line relationships to grant no compensation visibility | Must | PPL-UC-010 |
| PPL-US-029 | HR operations | to record a host assignment with payroll indicators | Should | PPL-UC-011 |
| PPL-US-030 | Compliance owner | an alert when a work permit ends before the posting | Should | PPL-UC-011 |
| PPL-US-031 | Employee / worker | to nominate family members with shares for my PF and gratuity | Must | PPL-UC-012 |
| PPL-US-032 | HR operations | a nomination change to keep the previous version until approved | Must | PPL-UC-012 |
| PPL-US-033 | Plant HR / time office | to see a worker's emergency contact quickly during an incident | Should | PPL-UC-012 |
| PPL-US-034 | HR operations | to preview who will approve what after a reorganisation | Must | PPL-UC-013 |
| PPL-US-035 | Tenant admin | to see scope changes per principal before a reorganisation commits | Must | PPL-UC-013 |
| PPL-US-036 | Manager / supervisor | to see my team with vacancies and span of control | Must | PPL-UC-014 |
| PPL-US-037 | HR operations | the chart to update automatically when a reporting manager changes | Must | PPL-UC-014 |
| PPL-US-038 | Plant HR / time office | the chart to show only my site | Must | PPL-UC-014 |
| PPL-US-039 | HR operations | to add a second concurrent assignment to an existing person | Must | PPL-UC-015 |
| PPL-US-040 | Payroll manager | each assignment paid in its own payroll group | Must | PPL-UC-015 |
| PPL-US-041 | Employee / worker | to see each of my assignments separately in self-service | Should | PPL-UC-015 |
| PPL-US-042 | HR operations | a plan seeded with today's sanctioned, filled and open counts | Must | PPL-UC-016 |
| PPL-US-043 | Finance | planned cost by cost centre before approval | Must | PPL-UC-016 |
| PPL-US-044 | Director / approver | monthly variance of actual headcount against the approved plan | Should | PPL-UC-016 |
| PPL-US-045 | Employee / worker | to download a salary certificate myself | Should | PPL-UC-017 |
| PPL-US-046 | HR operations | certificates to be verifiable by third parties | Should | PPL-UC-017 |
| PPL-US-047 | Employee / worker | a digital ID on my phone | Should | PPL-UC-017 |
| PPL-US-048 | Manager / supervisor | span, layers and vacancy age for my unit | Should | PPL-UC-018 |
| PPL-US-049 | HR operations | the same metrics compared across all five sites | Should | PPL-UC-018 |
| PPL-US-050 | Employee / worker | my individual flight-risk score never to be shown to managers | Should | PPL-UC-018 |

## 2. Stories with acceptance criteria

### PPL-US-001 · Create person, position and assignment

As a **HR operations**, I want the system to search for an existing person before I create a new one, so that a returning or duplicate worker does not end up with two records.

Priority: **Must** · Use case: PPL-UC-001 · Realises: PPL-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a new joiner with the same name and date of birth as an existing worker at LOC-PLA | HR operations searches before creating | both records are shown side by side with a match score and HR must choose Same person or Different person |
| 2 | HR chooses Different person with reason 'Different PAN and mobile' | creation continues | a new person is created and the decision is logged with HR's identity and reason |

### PPL-US-002 · Create person, position and assignment

As a **HR operations**, I want to assign a new hire only to a vacant, active position, so that headcount and budget stay consistent with the position register.

Priority: **Must** · Use case: PPL-UC-001 · Realises: PPL-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | POS-2214 Senior Engineer — Machining at LOC-PLA has status Vacant | HR creates the assignment against POS-2214 | the assignment is saved and people.position.filled is emitted |
| 2 | POS-2216 is Filled by E1018 | HR selects POS-2216 for a new hire | the assignment is blocked with the message that the position is already filled |

### PPL-US-003 · Create person, position and assignment

As a **Payroll manager**, I want payroll group and location to be set independently on every assignment, so that head-office-payrolled staff can work at a plant without their salary moving to plant payroll.

Priority: **Must** · Use case: PPL-UC-001 · Realises: PPL-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1056 Anand Krishnan is assigned to location LOC-CHN | HR sets payroll group HO | the assignment stores LOC-CHN and HO with no defaulting between them |
| 2 | HR leaves payroll group blank on a new assignment at LOC-CHN | they save | the save is refused with the message that payroll group is required |

### PPL-US-004 · Create person, position and assignment

As a **Employee / worker**, I want to join on my planned date even if my PAN record needs correction, so that a data mismatch does not delay my start.

Priority: **Must** · Use case: PPL-UC-001 · Realises: PPL-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a joiner whose PAN name does not match the verification source | HR completes creation | the worker is hired with a payroll-blocking flag visible to the payroll manager |
| 2 | the flag is open at payroll input validation | the run is prepared | the worker is held out of pay with the reason PAN mismatch |

### PPL-US-005 · Change an assignment with an effective date

As a **HR operations**, I want to record an assignment change with an effective date and reason, so that the change applies from the right day and the history explains why.

Priority: **Must** · Use case: PPL-UC-002 · Realises: PPL-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1018's manager is E1017 | HR raises a change to manager E1021 effective 2026-12-01 with reason 'Line rebalancing' | after approval a new assignment version exists from 2026-12-01 and the earlier version is retained |
| 2 | HR submits a change with no effective date | they click submit | the request is rejected with 'Effective date is required' |

### PPL-US-006 · Change an assignment with an effective date

As a **Payroll manager**, I want retro changes to produce arrears instead of rewriting closed runs, so that paid payslips and filed returns stay unchanged.

Priority: **Must** · Use case: PPL-UC-002 · Realises: PPL-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the August 2026 run for PLANT-BLR is closed and E1022's grade change is approved effective 2026-08-01 | the change is written | payroll.arrears.requested is queued for the next open run and the August run is untouched |
| 2 | the arrears are queued | the October 2026 run is computed | it contains an arrears line for August with the difference amount |

### PPL-US-007 · Change an assignment with an effective date

As a **Plant HR / time office**, I want attendance to be recomputed automatically when a worker's shift group or rest days change, so that past days reflect the policy that actually applied.

Priority: **Must** · Use case: PPL-UC-002 · Realises: PPL-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1026's shift group changes effective 2026-10-15 | the change is approved on 2026-10-20 | a recompute is queued for 2026-10-15 to 2026-10-20 and time.recompute.requested is emitted |
| 2 | a cost centre change with no time-policy effect | it is approved | no recompute is queued |

### PPL-US-008 · Resolve worker class and policy attributes

As a **Payroll manager**, I want contractual daily-wage workers to be paid only for days present with no weekly off, so that pay follows the contract terms without manual adjustment.

Priority: **Must** · Use case: PPL-UC-003 · Realises: PPL-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1032 Shivanna Muniyappa in class WC-CONT with wage type Daily | attendance runs for a week containing Sunday | no weekly off is generated for E1032 |
| 2 | E1032 is present 24 days in a 30-day month | payroll computes | E1032 is paid for 24 days |

### PPL-US-009 · Resolve worker class and policy attributes

As a **Plant HR / time office**, I want third-party employees and helpers under one vendor to resolve different rest-day rules, so that each sub-category gets its entitlement without a code change.

Priority: **Must** · Use case: PPL-UC-003 · Realises: PPL-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1034 Imran Shaikh in class WC-3PE and E1053 Padmaja Cheruku in class WC-3PH, both under third-party category | a week of attendance is run | E1034 receives a Sunday rest day and E1053 does not |
| 2 | an employee-record rest-day value of N for a WC-3PE worker | resolution runs | the employee-record value wins over the sub-category default |

### PPL-US-010 · Resolve worker class and policy attributes

As a **Plant HR / time office**, I want OT to be generated only on rest days or holidays for workers with that eligibility basis, so that ordinary working-day extra hours do not create OT for them.

Priority: **Must** · Use case: PPL-UC-003 · Realises: PPL-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1034 with OT eligibility RestDayHolidayOnly works 2 extra hours on a working day | OT is computed | OT hours are zero |
| 2 | E1034 works 8 hours on his Sunday rest day | OT is computed | OT is generated normally for that day |

### PPL-US-011 · Resolve worker class and policy attributes

As a **Implementation consultant**, I want grace exemption to come from the designation band, so that a new senior designation is exempt from late marks without code changes.

Priority: **Must** · Use case: PPL-UC-003 · Realises: PPL-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | designation DES-07 Assistant Manager has grace exemption Y | an Assistant Manager punches in 12 minutes late | no late-mark deduction is generated |
| 2 | a policy request for a worker on a date before their joining date | the resolver runs | it returns 'not employed' rather than class defaults |

### PPL-US-012 · Control positions and sanctioned strength

As a **Finance**, I want to record approved manpower by department, designation and location, so that hiring can be checked against what was sanctioned.

Priority: **Must** · Use case: PPL-UC-004 · Realises: PPL-04

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | Finance sets sanctioned strength 12 for OU-112 Assembly, designation DES-12, location LOC-PUN effective 2027-04-01 with approver recorded | it is saved | people.sanction.set is emitted and the strength board shows 12 sanctioned from 2027-04-01 |
| 2 | Finance saves a sanction without an approver | they submit | the save is rejected with 'Approver is required' |

### PPL-US-013 · Control positions and sanctioned strength

As a **Manager / supervisor**, I want to see headroom before raising a requisition, so that I do not raise requests that will be blocked.

Priority: **Must** · Use case: PPL-UC-004 · Realises: PPL-04

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | OU-112 at LOC-PUN has 12 sanctioned, 9 filled and 2 open requisitions | the manager opens the strength board | headroom shows 1 |
| 2 | headroom is 0 and no override exists | the manager raises a new requisition | it is blocked with the shortfall shown |

### PPL-US-014 · Control positions and sanctioned strength

As a **HR operations**, I want a separated worker's position to be marked vacant with the last incumbent, so that the replacement requisition references the exact position.

Priority: **Must** · Use case: PPL-UC-004 · Realises: PPL-04

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1071 separates from POS-2214 on 2026-08-22 | the separation is processed | POS-2214 shows status Vacant, last incumbent E1071 and vacated on 2026-08-22, and people.position.vacated is emitted |
| 2 | POS-2214 is vacant | a replacement requisition is raised | it is linked to POS-2214 |

### PPL-US-015 · Change an org unit or reorganise

As a **HR operations**, I want to re-parent a department with an effective date, so that the change happens on the agreed day and earlier history is kept.

Priority: **Must** · Use case: PPL-UC-005 · Realises: PPL-05

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | OU-113 Quality Assurance sits under OU-110 Manufacturing | HR re-parents it under OU-100 effective 2027-01-01 and it is approved | the chart as at 2026-12-31 shows OU-113 under OU-110 and as at 2027-01-01 under OU-100 |
| 2 | HR tries to make OU-110 a child of OU-111 | they submit | the change is rejected because it would create a cycle |

### PPL-US-016 · Change an org unit or reorganise

As a **Manager / supervisor**, I want the organisation chart to follow reporting relationships on the employee record, so that no one has to maintain a separate hierarchy.

Priority: **Must** · Use case: PPL-UC-005 · Realises: PPL-05

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1022's reporting manager changes from E1021 to E1016 | the chart is reopened after the change is effective | E1022 appears under E1016 with no separate hierarchy update |
| 2 | the department-wise view is selected | the chart renders | workers are grouped by their current org unit |

### PPL-US-017 · Capture, classify and track documents

As a **Employee / worker**, I want to upload my documents from my phone with the type suggested for me, so that I can complete my records without visiting HR.

Priority: **Must** · Use case: PPL-UC-006 · Realises: PPL-06

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1060 uploads a photo of her driving licence | the upload completes | the class Driving licence is suggested and the expiry date is extracted for confirmation |
| 2 | she uploads a file with no class selected and rejects the suggestion | she saves | the save is rejected with 'Document class is required' |

### PPL-US-018 · Capture, classify and track documents

As a **HR operations**, I want only low-confidence extractions to come to my verification queue, so that I spend time on documents that need it.

Priority: **Must** · Use case: PPL-UC-006 · Realises: PPL-06

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an extraction with confidence 0.72 | classification completes | the document appears in the HR verification queue |
| 2 | E1060's PAN is already verified and a new upload extracts a different PAN | extraction completes | the verified PAN is unchanged and the difference is queued for HR |

### PPL-US-019 · Capture, classify and track documents

As a **Compliance owner**, I want reminders before a document expires, so that workers renew licences before they lapse.

Priority: **Must** · Use case: PPL-UC-006 · Realises: PPL-06

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a forklift licence for E1026 expires on 2027-01-31 | reminders are scheduled | reminders are set for 2026-12-02, 2027-01-01 and 2027-01-24 |
| 2 | the 30-day reminder date arrives | the reminder fires | people.document.expiring is emitted and E1026 and HR are notified |

### PPL-US-020 · Rehire, transfer between entities or change worker class

As a **HR operations**, I want to rehire a former worker on the same person record, so that history, statutory identifiers and documents stay together.

Priority: **Must** · Use case: PPL-UC-007 · Realises: PPL-07

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a former worker separated on 2025-03-31 is found by PAN token | HR rehires them effective 2026-12-01 | a new employment is created under the existing person_id and no new person is created |
| 2 | the rehire is saved | the employee record is opened | both employments are listed with their dates and separation reason |

### PPL-US-021 · Rehire, transfer between entities or change worker class

As a **Payroll manager**, I want an entity transfer to close the old employment and open the new one without a gap or overlap, so that each entity's payroll pays exactly the right days.

Priority: **Must** · Use case: PPL-UC-007 · Realises: PPL-07

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1050 transfers from LE-02 to LE-01 effective 2027-01-01 | the transfer is processed | the LE-02 employment ends 2026-12-31 and the LE-01 employment starts 2027-01-01 |
| 2 | the configured continuity rule recognises group service | the transfer is processed | tenure start remains E1050's original joining date 2017-10-30 and the rule applied is recorded |

### PPL-US-022 · Rehire, transfer between entities or change worker class

As a **HR operations**, I want converting a third-party worker to permanent to re-resolve their policy, so that rest days, leave and statutory set change from the conversion date.

Priority: **Should** · Use case: PPL-UC-007 · Realises: PPL-07

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1034 converts from WC-3PE to WC-PERM effective 2027-02-01 | the new assignment is created | the resolved vector from 2027-02-01 shows leave eligible Y and OT eligibility All |
| 2 | the same worker on 2027-01-31 | policy is resolved | the WC-3PE values still apply |

### PPL-US-023 · Detect duplicate persons

As a **HR operations**, I want to decide suspected duplicates with both records side by side, so that two real people are never merged and one person is never created twice.

Priority: **Must** · Use case: PPL-UC-008 · Realises: PPL-08

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a candidate scoring 0.91 against an existing worker at LOC-PLA with matching name and date of birth but different mobile and PAN | HR opens the case | both records are shown with matching attributes highlighted and differing ones marked |
| 2 | HR decides Different person with reason 'Different PAN' | the same pair is evaluated again next month | no new case is raised |

### PPL-US-024 · Detect duplicate persons

As a **Payroll manager**, I want inbound ERP employee records that look like duplicates to be held, so that no worker is set up twice for pay.

Priority: **Must** · Use case: PPL-UC-008 · Realises: PPL-08

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an inbound ERP record matching an existing person at 0.88 | the sync runs | the record is held, a case is raised to HR and nothing is written to the person |
| 2 | HR decides Same person | the decision is saved | the inbound record updates the existing person and no new person is created |

### PPL-US-025 · Maintain job architecture

As a **HR operations**, I want to define job profiles with band and required competencies, so that positions share a consistent definition of the role.

Priority: **Must** · Use case: PPL-UC-009 · Realises: PPL-CG-001

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | profile Senior Engineer — Machining with band B and competency CNC programming at level 3 | it is published and linked to POS-2214 and POS-2216 | both positions show the profile, band B and the competency requirement |
| 2 | HR edits the profile to require level 4 effective 2027-04-01 | POS-2214 is viewed as at 2027-03-31 | level 3 is shown |

### PPL-US-026 · Maintain job architecture

As a **Implementation consultant**, I want profiles in use to be protected from retirement, so that positions are never left pointing at a retired profile.

Priority: **Should** · Use case: PPL-UC-009 · Realises: PPL-CG-001

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | profile Operator — Assembly referenced by POS-2225 and POS-2226 | retirement is requested | it is blocked and both positions are listed |
| 2 | both positions are moved to another profile | retirement is requested again | it is accepted with the end date recorded |

### PPL-US-027 · Maintain multiple and matrix hierarchies

As a **HR operations**, I want to give a worker a dotted-line project manager for a fixed period, so that project approvals go to the project lead without changing the reporting line.

Priority: **Must** · Use case: PPL-UC-010 · Realises: PPL-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1020 reports to E1021 and is assigned dotted-line manager E1018 for a tooling project from 2026-11-01 to 2027-01-31 | E1020 submits a project expense on 2026-12-05 | the project step routes to E1018 and the line step to E1021 |
| 2 | the same request type on 2027-02-10 | it is submitted | the project step resolves to E1021 because the dotted line has ended |

### PPL-US-028 · Maintain multiple and matrix hierarchies

As a **Manager / supervisor**, I want dotted-line relationships to grant no compensation visibility, so that project leadership does not expose salaries.

Priority: **Must** · Use case: PPL-UC-010 · Realises: PPL-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1018 is dotted-line manager for E1020 | E1018 opens E1020's profile | attendance and project data are visible and compensation fields are null |
| 2 | E1021 is E1020's solid-line manager with compensation permission for PLANT-BLR | E1021 opens the profile | permitted compensation fields are shown |

### PPL-US-029 · Manage global and expatriate assignments

As a **HR operations**, I want to record a host assignment with payroll indicators, so that payroll knows who pays the worker during the posting.

Priority: **Should** · Use case: PPL-UC-011 · Realises: PPL-CG-003

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1009 is posted abroad from 2027-04-01 to 2028-03-31 with split payroll 40% home and 60% host | HR saves the host assignment | it is linked to E1009's LE-01 employment and both shares are stored |
| 2 | split payroll is selected with no shares | HR saves | the save is refused with 'Enter the share for each country' |

### PPL-US-030 · Manage global and expatriate assignments

As a **Compliance owner**, I want an alert when a work permit ends before the posting, so that the worker never works without a valid permit.

Priority: **Should** · Use case: PPL-UC-011 · Realises: PPL-CG-003

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1009's work permit expires on 2027-12-31 and the posting ends on 2028-03-31 | the permit is uploaded | an immediate alert is raised to HR operations and the Compliance owner |
| 2 | a renewed permit to 2028-06-30 is uploaded | it is verified | the alert closes and reminders are rescheduled from the new expiry |

### PPL-US-031 · Record dependants, nominees and emergency contacts

As a **Employee / worker**, I want to nominate family members with shares for my PF and gratuity, so that benefits go to the people I choose.

Priority: **Must** · Use case: PPL-UC-012 · Realises: PPL-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1028 adds spouse 60% and daughter 30% for gratuity Form F | she tries to submit | submit is disabled and the total shows 90% of 100% |
| 2 | she changes the daughter's share to 40% | she submits | the nomination is accepted for HR approval |

### PPL-US-032 · Record dependants, nominees and emergency contacts

As a **HR operations**, I want a nomination change to keep the previous version until approved, so that there is never a period with no valid nomination.

Priority: **Must** · Use case: PPL-UC-012 · Realises: PPL-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1028 has an approved PF nomination and submits a new one | HR has not yet decided | the approved nomination remains in force |
| 2 | HR rejects the new nomination with reason 'Signed form missing' | the decision is saved | E1028 is notified with the reason and the earlier nomination stays in force |

### PPL-US-033 · Record dependants, nominees and emergency contacts

As a **Plant HR / time office**, I want to see a worker's emergency contact quickly during an incident, so that family can be informed without delay.

Priority: **Should** · Use case: PPL-UC-012 · Realises: PPL-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | plant HR scoped to LOC-PLA and E1026 has an emergency contact recorded | plant HR opens E1026's profile card | the emergency contact name and phone are shown |
| 2 | plant HR scoped to LOC-PLA | they search for an employee at LOC-HYD | no emergency contact is returned |

### PPL-US-034 · Stage and commit a mass reorganisation

As a **HR operations**, I want to preview who will approve what after a reorganisation, so that no request is stranded or misrouted on the effective date.

Priority: **Must** · Use case: PPL-UC-013 · Realises: PPL-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a change set moving OU-114 Maintenance at LOC-PLA under a new head | the preview runs | each open request from OU-114 workers is listed with its current and future approver |
| 2 | an open request whose future approver cannot be resolved | commit is attempted | commit is blocked and the request is listed |

### PPL-US-035 · Stage and commit a mass reorganisation

As a **Tenant admin**, I want to see scope changes per principal before a reorganisation commits, so that no one gains or loses access unexpectedly.

Priority: **Must** · Use case: PPL-UC-013 · Realises: PPL-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a change set moving 40 workers from LOC-PLA to LOC-PUN | the preview runs | it lists the principals who gain or lose visibility of each worker |
| 2 | commit of 40 moves where one fails validation | commit runs | none of the 40 moves is applied and the failing one is reported |

### PPL-US-036 · Explore the interactive organisation chart

As a **Manager / supervisor**, I want to see my team with vacancies and span of control, so that I can plan hiring and workload.

Priority: **Must** · Use case: PPL-UC-014 · Realises: PPL-CG-006

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1021 Rekha Deshpande manages assembly operators at LOC-PLA | she opens the chart | her node shows her direct reports, the headcount and span of control |
| 2 | a vacant position POS-2225 at LOC-PUN in OU-112 | HR views OU-112 at LOC-PUN | POS-2225 appears as a vacancy node with last incumbent E1072 |

### PPL-US-037 · Explore the interactive organisation chart

As a **HR operations**, I want the chart to update automatically when a reporting manager changes, so that there is no second hierarchy to maintain.

Priority: **Must** · Use case: PPL-UC-014 · Realises: PPL-CG-006

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1022's manager changes from E1021 to E1016 effective today | the chart is reopened | E1022 appears under E1016 |
| 2 | the department-wise view is selected | the chart renders | workers are grouped by org unit with headcounts per unit |

### PPL-US-038 · Explore the interactive organisation chart

As a **Plant HR / time office**, I want the chart to show only my site, so that I do not see people outside my grant.

Priority: **Must** · Use case: PPL-UC-014 · Realises: PPL-CG-006

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | plant HR scoped to LOC-CHN | they open the chart | only LOC-CHN workers and their reporting lines are shown |
| 2 | the same user | they open the location filter | LOC-HYD is not offered |

### PPL-US-039 · Hold concurrent assignments for one person

As a **HR operations**, I want to add a second concurrent assignment to an existing person, so that I don't create a duplicate person for a second role.

Priority: **Must** · Use case: PPL-UC-015 · Realises: PPL-CG-007

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1069 holds a permanent assignment at LOC-PLA | I add a trainer assignment in LE-02 at LOC-HYD effective 2026-11-01 | E1069 shows two active assignments and one person identifier |
| 2 | the selected position is frozen | I try to add the assignment | creation is blocked with the frozen status named |

### PPL-US-040 · Hold concurrent assignments for one person

As a **Payroll manager**, I want each assignment paid in its own payroll group, so that pay and statutory contributions are processed by the right entity.

Priority: **Must** · Use case: PPL-UC-015 · Realises: PPL-CG-007

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1069 has assignments in PLANT-BLR and PLANT-HYD | the November runs are created | E1069 appears in both run populations with the assignment identifier on each payslip |
| 2 | the PF wage ceiling applies to the person | both assignments are computed | the payroll exception list shows the shared-ceiling check for E1069 |

### PPL-US-041 · Hold concurrent assignments for one person

As a **Employee / worker**, I want to see each of my assignments separately in self-service, so that I can track pay and attendance for each role.

Priority: **Should** · Use case: PPL-UC-015 · Realises: PPL-CG-007

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I hold two assignments | I open my payslips for November 2026 | I see one payslip per assignment, each labelled with its entity |
| 2 | I apply for leave | I choose the assignment | the request routes to that assignment's manager only |

### PPL-US-042 · Plan headcount and positions against sanctioned strength

As a **HR operations**, I want a plan seeded with today's sanctioned, filled and open counts, so that I start from facts, not a blank sheet.

Priority: **Must** · Use case: PPL-UC-016 · Realises: PPL-CG-008

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | Chakan Works Machining has 20 sanctioned, 17 filled and 1 open requisition | I create the FY 2027-28 plan | the line shows headroom of 2 |
| 2 | a manager proposes +6 machinists from Q2 | the proposal is saved | planned Q2 headcount is 26 and planned cost updates |

### PPL-US-043 · Plan headcount and positions against sanctioned strength

As a **Finance**, I want planned cost by cost centre before approval, so that headcount growth fits the operating budget.

Priority: **Must** · Use case: PPL-UC-016 · Realises: PPL-CG-008

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a plan adding 6 band-B positions at Chakan | I open the cost view | the incremental annual cost per cost centre is shown |
| 2 | a designation band with no cost rate | the plan is submitted | submission is blocked with the unpriced line named |

### PPL-US-044 · Plan headcount and positions against sanctioned strength

As a **Director / approver**, I want monthly variance of actual headcount against the approved plan, so that I can act early on over- or under-hiring.

Priority: **Should** · Use case: PPL-UC-016 · Realises: PPL-CG-008

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the approved plan for Peenya Assembly in October 2026 is 30 | 29 are filled and 2 requisitions are open | the variance view shows +1 against plan |
| 2 | a requisition that would exceed sanctioned strength | it reaches approval | it is blocked and the excess is stated |

### PPL-US-045 · Present a digital ID and download verifiable employment letters

As a **Employee / worker**, I want to download a salary certificate myself, so that I can apply for a loan the same day.

Priority: **Should** · Use case: PPL-UC-017 · Realises: PPL-CG-009

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I am E1044 with posted payroll for July to September 2026 | I request a 3-month salary certificate | a signed PDF with a verification code is ready within 10 s |
| 2 | September payroll is not yet posted | I request July to September | the certificate covers July and August and says so |

### PPL-US-046 · Present a digital ID and download verifiable employment letters

As a **HR operations**, I want certificates to be verifiable by third parties, so that forged letters cannot pass as ours.

Priority: **Should** · Use case: PPL-UC-017 · Realises: PPL-CG-009

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a bank enters the verification code of a genuine certificate | verification runs | it confirms LE-01 issued it on the stated date with the stated contents |
| 2 | a tampered certificate with an altered amount | the bank verifies it | verification reports a mismatch |

### PPL-US-047 · Present a digital ID and download verifiable employment letters

As a **Employee / worker**, I want a digital ID on my phone, so that I can identify myself at another Vindhya site without a plastic card.

Priority: **Should** · Use case: PPL-UC-017 · Realises: PPL-CG-009

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I am an active employee at Chakan Works | I open the digital ID | it shows my photo, code, entity LE-01 and a code that refreshes every 60 s |
| 2 | my assignment ended on 2026-09-30 | I open the digital ID on 2026-10-01 | it is marked inactive |

### PPL-US-048 · Monitor organisation health metrics by unit

As a **Manager / supervisor**, I want span, layers and vacancy age for my unit, so that I can see where my structure needs attention.

Priority: **Should** · Use case: PPL-UC-018 · Realises: PPL-CG-010

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I am E1021 managing Peenya Assembly with 9 direct reports and one position vacant since 2026-07-15 | I open organisation health on 2026-11-05 | I see span 9, vacancy age 113 days and my layer count |
| 2 | I request Chakan Works Machining | the view loads | the unit is refused as outside my reporting line |

### PPL-US-049 · Monitor organisation health metrics by unit

As a **HR operations**, I want the same metrics compared across all five sites, so that I can prioritise interventions where structure is weakest.

Priority: **Should** · Use case: PPL-UC-018 · Realises: PPL-CG-010

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | my grant covers LE-01 and LE-02 | I open the site comparison | five sites are listed with span, layers, vacancy age and tenure mix |
| 2 | a manager at Oragadam Works with span 22 and the threshold set at 15 | the comparison loads | that manager's unit is flagged above threshold |

### PPL-US-050 · Monitor organisation health metrics by unit

As a **Employee / worker**, I want my individual flight-risk score never to be shown to managers, so that I am not singled out on an inference.

Priority: **Should** · Use case: PPL-UC-018 · Realises: PPL-CG-010

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a unit of 4 people and a minimum group size of 5 | a manager opens organisation health | flight-risk concentration is suppressed for that unit |
| 2 | a unit of 30 people | the metric shows | it appears only as a band for the unit with no individual names |

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
| Size | 150 | specified items (table rows) | Counted automatically at generation |
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
