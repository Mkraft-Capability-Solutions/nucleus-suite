<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-SSV-13 — Self-service & Helpdesk — User Stories and Acceptance Criteria

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-SSV-13 |
| Title | Self-service & Helpdesk — User Stories and Acceptance Criteria |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Self-service & Helpdesk |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM, VV |
| Related documents | FRS-SSV-00, FRS-SSV-01, FRS-SSV-02, FRS-SSV-03, FRS-SSV-04, FRS-SSV-05, FRS-SSV-06, FRS-SSV-07, FRS-SSV-08, FRS-SSV-09, FRS-SSV-10, FRS-SSV-11, FRS-SSV-12, FRS-SSV-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-02, BG-03 · processes SSV-01–SSV-05 |
| Source of record | Derived from FRS-SSV-12 use cases; source rules, tests and golden data |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

29 user stories, each traced to its use case and verified by Given / When / Then acceptance criteria. Priority mix: Must 22, Should 7.

## 1. Story index

| ID | As a | I want | Priority | Use case |
| :--- | :--- | :--- | :--- | :--- |
| SSV-US-001 | Employee / worker | to see which rule marked my day as a half day | Must | SSV-UC-001 |
| SSV-US-002 | Employee / worker | to read my attendance and payslip with no network | Must | SSV-UC-001 |
| SSV-US-003 | Manager / supervisor | all my pending items across modules in one queue | Must | SSV-UC-002 |
| SSV-US-004 | Manager / supervisor | to see the rule context with each request | Must | SSV-UC-002 |
| SSV-US-005 | Manager / supervisor | to approve directly from the business messaging channel | Should | SSV-UC-002 |
| SSV-US-006 | Employee / worker | to apply for leave by messaging | Must | SSV-UC-003 |
| SSV-US-007 | Employee / worker | my payslip only after my identity is verified | Must | SSV-UC-003 |
| SSV-US-008 | Employee / worker | my ticket answered with evidence from my own record | Must | SSV-UC-004 |
| SSV-US-009 | HR operations | tickets routed by category and location with SLA timers | Must | SSV-UC-004 |
| SSV-US-010 | Employee / worker | answers that cite the policy clause they come from | Must | SSV-UC-005 |
| SSV-US-011 | Employee / worker | the assistant to act only after I confirm | Must | SSV-UC-005 |
| SSV-US-012 | HR operations | the assistant never to reveal another employee's data | Must | SSV-UC-005 |
| SSV-US-013 | HR operations | articles to expire from assistant grounding when their review date passes | Must | SSV-UC-006 |
| SSV-US-014 | Employee / worker | to search HR articles in Marathi | Should | SSV-UC-006 |
| SSV-US-015 | HR operations | to build a new-parent journey once and have it start automatically | Should | SSV-UC-007 |
| SSV-US-016 | Manager / supervisor | to see my tasks within a team member's journey | Should | SSV-UC-007 |
| SSV-US-017 | Employee / worker | to apply for leave using only a keyboard and screen reader | Must | SSV-UC-008 |
| SSV-US-018 | Employee / worker | a high-contrast theme | Must | SSV-UC-008 |
| SSV-US-019 | Employee / worker | to unlock the app with my fingerprint | Must | SSV-UC-009 |
| SSV-US-020 | Tenant admin | to revoke a lost device | Must | SSV-UC-009 |
| SSV-US-021 | Employee / worker | to continue on the mobile app a conversation I began on the messaging channel | Must | SSV-UC-010 |
| SSV-US-022 | Employee / worker | to ask the canteen kiosk about my roster in Marathi by voice | Must | SSV-UC-010 |
| SSV-US-023 | HR operations | a full transcript with every question the assistant hands over | Should | SSV-UC-010 |
| SSV-US-024 | Employee / worker | to raise a harassment complaint that only the committee can see | Must | SSV-UC-011 |
| SSV-US-025 | HR operations | to give an investigator access that expires on its own | Must | SSV-UC-011 |
| SSV-US-026 | Auditor | to review the confidential case audit without reading case content | Should | SSV-UC-011 |
| SSV-US-027 | Employee / worker | to download a signed salary certificate immediately | Must | SSV-UC-012 |
| SSV-US-028 | HR operations | to control which template version employees can generate | Must | SSV-UC-012 |
| SSV-US-029 | Employee / worker | to obtain my experience letter after I have left | Should | SSV-UC-012 |

## 2. Stories with acceptance criteria

### SSV-US-001 · Complete a self-service action in three taps

As a **Employee / worker**, I want to see which rule marked my day as a half day, so that I understand my attendance without raising a ticket.

Priority: **Must** · Use case: SSV-UC-001 · Realises: SSV-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1019 was marked half day on 2026-09-10 for a fourth late arrival beyond the 15-minute grace | she opens My attendance for 10 September | the day shows half day with the rule and the three earlier late days listed |
| 2 | the half day is shown | she taps 'Raise regularisation' | a request form opens pre-filled with the date and needs only a reason |

### SSV-US-002 · Complete a self-service action in three taps

As a **Employee / worker**, I want to read my attendance and payslip with no network, so that I can check them on the shop floor where signal is poor.

Priority: **Must** · Use case: SSV-UC-001 · Realises: SSV-01

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | my phone is offline and last synced at 07:42 | I open My attendance | the last 60 days are shown with 'last synced 07:42' |
| 2 | I submit a leave request offline | the phone reconnects | the request is submitted and appears in my history |

### SSV-US-003 · Act on pending approvals from one unified inbox

As a **Manager / supervisor**, I want all my pending items across modules in one queue, so that I do not check a separate inbox per module.

Priority: **Must** · Use case: SSV-UC-002 · Realises: SSV-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I have 3 leave requests, 2 gate passes, 1 overtime request and 1 expense claim pending | I open SCR-040 | all 7 items appear in one list sorted by SLA due |
| 2 | a new regularisation request arrives | the queue refreshes | it appears in the same list |

### SSV-US-004 · Act on pending approvals from one unified inbox

As a **Manager / supervisor**, I want to see the rule context with each request, so that I avoid approving something that causes a surprise deduction.

Priority: **Must** · Use case: SSV-UC-002 · Realises: SSV-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | Kavya Venkatesh requests a third gate pass with 4 hours and 2 instances used in September | I open the request | the item shows 0 hours and 0 instances remaining |
| 2 | a leave request is for a day with 3 earned leave days expiring on 2026-12-31 | I open it | the expiring balance is shown |

### SSV-US-005 · Act on pending approvals from one unified inbox

As a **Manager / supervisor**, I want to approve directly from the business messaging channel, so that I can decide while away from my desk.

Priority: **Should** · Use case: SSV-UC-002 · Realises: SSV-02

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a leave request notification arrives on the business messaging channel | I reply Approve | the leave is approved and the channel is recorded as the decision source |
| 2 | I already rejected the same request on web | I reply Approve on the messaging channel | the approval is not applied and I am told it was rejected on web |

### SSV-US-006 · Transact through the business messaging channel

As a **Employee / worker**, I want to apply for leave by messaging, so that I can do it without installing the app.

Priority: **Must** · Use case: SSV-UC-003 · Realises: SSV-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I am verified and have 6 casual leave days | I send 'leave 15 Oct casual' and confirm | a 1-day casual leave request is submitted and I receive its reference |
| 2 | I do not confirm within 10 minutes | the timer expires | no request is created |

### SSV-US-007 · Transact through the business messaging channel

As a **Employee / worker**, I want my payslip only after my identity is verified, so that no one else can get it by using my phone number.

Priority: **Must** · Use case: SSV-UC-003 · Realises: SSV-03

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | my session has expired | I ask for my September payslip | I am asked for a one-time code before the payslip is sent |
| 2 | a message comes from an unregistered number asking for E1019's payslip | it is processed | no data is returned |

### SSV-US-008 · Raise and resolve a helpdesk ticket

As a **Employee / worker**, I want my ticket answered with evidence from my own record, so that I understand the outcome instead of just being told it is correct.

Priority: **Must** · Use case: SSV-UC-004 · Realises: SSV-04

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | Rahul Gaikwad raises 'comp-off credit from 31 May has disappeared' | the resolver resolves it | the resolution shows the credit lapsed on 30 July, 60 days after crediting, with the ledger movement |
| 2 | I reopen the ticket with a reason | the reopen is saved | the ticket returns to the resolver with its SLA restarted |

### SSV-US-009 · Raise and resolve a helpdesk ticket

As a **HR operations**, I want tickets routed by category and location with SLA timers, so that each query reaches the right person and nothing is forgotten.

Priority: **Must** · Use case: SSV-UC-004 · Realises: SSV-04

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a High priority payroll ticket is raised on 2026-09-09 | routing runs | it is assigned to the payroll resolver group with SLA due 2026-09-10 |
| 2 | the SLA passes unresolved | the check runs | the ticket escalates to the group lead |

### SSV-US-010 · Answer a policy question with grounded sources

As a **Employee / worker**, I want answers that cite the policy clause they come from, so that I can trust and check the answer.

Priority: **Must** · Use case: SSV-UC-005 · Realises: SSV-05

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the leave policy says casual leave cannot be carried forward | I ask 'can I carry forward casual leave?' | the answer says no and links to that clause |
| 2 | no indexed policy covers sabbaticals | I ask about sabbatical leave | no answer is given, a ticket is raised and I receive its number |

### SSV-US-011 · Answer a policy question with grounded sources

As a **Employee / worker**, I want the assistant to act only after I confirm, so that nothing changes on my record without my consent.

Priority: **Must** · Use case: SSV-UC-005 · Realises: SSV-05

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I ask the assistant to apply 1 day casual leave on 2026-10-15 | it shows the dry-run summary | no request exists until I confirm |
| 2 | I confirm | the action runs | the leave request is created and the action ledger records tool, inputs and my confirmation |

### SSV-US-012 · Answer a policy question with grounded sources

As a **HR operations**, I want the assistant never to reveal another employee's data, so that privacy is preserved even for curious questions.

Priority: **Must** · Use case: SSV-UC-005 · Realises: SSV-05

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1019 asks 'what is Rahul's leave balance?' | the agent retrieves data | no data about Rahul is returned and the answer says it cannot share it |
| 2 | the same question is asked by Rahul's manager | the agent retrieves data | the balance is returned because it is within the manager's scope |

### SSV-US-013 · Publish and find answers in the HR service catalogue and knowledge base

As a **HR operations**, I want articles to expire from assistant grounding when their review date passes, so that the assistant never cites stale policy.

Priority: **Must** · Use case: SSV-UC-006 · Realises: SSV-CG-001

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an article's review date is 2026-10-01 | the date passes without review | it is flagged stale and excluded from grounding |
| 2 | I review and republish it | the new version is indexed | the assistant cites the new version |

### SSV-US-014 · Publish and find answers in the HR service catalogue and knowledge base

As a **Employee / worker**, I want to search HR articles in Marathi, so that I can understand policy in my own language.

Priority: **Should** · Use case: SSV-UC-006 · Realises: SSV-CG-001

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the gate pass article has a published Marathi variant | I search in Marathi | the Marathi article is returned |
| 2 | the overtime article has no Marathi variant | I open it | the English version is shown with a note that a translation is not available |

### SSV-US-015 · Compose and run a guided employee journey

As a **HR operations**, I want to build a new-parent journey once and have it start automatically, so that every new parent gets the same support.

Priority: **Should** · Use case: SSV-UC-007 · Realises: SSV-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a new-parent journey triggers on maternity leave approval | an employee's maternity leave from 2026-11-01 is approved | the journey starts with the benefits checklist task |
| 2 | the leave is cancelled | the cancellation is saved | the journey is cancelled and pending nudges withdrawn |

### SSV-US-016 · Compose and run a guided employee journey

As a **Manager / supervisor**, I want to see my tasks within a team member's journey, so that I play my part at the right moment.

Priority: **Should** · Use case: SSV-UC-007 · Realises: SSV-CG-002

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a return-to-work task is due on 2027-05-02 | the date arrives | the task appears in my unified inbox |
| 2 | I complete it | the journey refreshes | the step shows Complete with my name |

### SSV-US-017 · Use self-service with assistive technology

As a **Employee / worker**, I want to apply for leave using only a keyboard and screen reader, so that I can use self-service independently.

Priority: **Must** · Use case: SSV-UC-008 · Realises: SSV-CG-003

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | a screen reader is active | I tab through the leave form | every field announces its label and required state |
| 2 | I submit with the end date empty | validation runs | the error is announced and focus moves to the end date field |

### SSV-US-018 · Use self-service with assistive technology

As a **Employee / worker**, I want a high-contrast theme, so that I can read screens in bright shop-floor light.

Priority: **Must** · Use case: SSV-UC-008 · Realises: SSV-CG-003

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I select high contrast | I open My attendance | all text meets a contrast ratio of at least 4.5:1 |
| 2 | I sign in on another device | the app loads | my theme choice is kept |

### SSV-US-019 · Use the native mobile app with offline access and biometric unlock

As a **Employee / worker**, I want to unlock the app with my fingerprint, so that I get in quickly at the punch gate.

Priority: **Must** · Use case: SSV-UC-009 · Realises: SSV-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | biometric unlock is enabled | I open the app | it unlocks after a fingerprint match without a password |
| 2 | five failed fingerprint attempts occur | the sixth attempt starts | the app asks for my PIN |

### SSV-US-020 · Use the native mobile app with offline access and biometric unlock

As a **Tenant admin**, I want to revoke a lost device, so that cached payslips cannot be read by whoever finds it.

Priority: **Must** · Use case: SSV-UC-009 · Realises: SSV-CG-004

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1023 reports her phone lost on 2026-10-03 | I revoke the device | the tokens are invalidated immediately |
| 2 | the lost phone is opened later | the app launches | the cache is wiped and sign-in is required |

### SSV-US-021 · Converse with one HR assistant across web, mobile, kiosk, voice and messaging

As a **Employee / worker**, I want to continue on the mobile app a conversation I began on the messaging channel, so that I do not have to repeat my question when I switch devices.

Priority: **Must** · Use case: SSV-UC-010 · Realises: SSV-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1018 asked about her earned leave balance on the messaging channel at 09:10 | she opens the mobile app at 09:25 | the same thread shows her question and the answer citing the leave policy clause |
| 2 | an unconfirmed 2-day leave draft exists in the messaging thread | E1018 resumes in the mobile app | the draft is shown and must be confirmed again in the app before it is submitted |

### SSV-US-022 · Converse with one HR assistant across web, mobile, kiosk, voice and messaging

As a **Employee / worker**, I want to ask the canteen kiosk about my roster in Marathi by voice, so that I can get answers on the shop floor without a smartphone.

Priority: **Must** · Use case: SSV-UC-010 · Realises: SSV-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1066 at Chakan Works has tapped her badge and entered her PIN | she asks in Marathi for tomorrow's shift | the kiosk replies in Marathi on screen and by voice with shift A 08:00–20:00 |
| 2 | the kiosk session has had no input for 60 seconds | the timer expires | the session ends and no personal data remains on screen |

### SSV-US-023 · Converse with one HR assistant across web, mobile, kiosk, voice and messaging

As a **HR operations**, I want a full transcript with every question the assistant hands over, so that I can resolve it without asking the employee to start again.

Priority: **Should** · Use case: SSV-UC-010 · Realises: SSV-CG-005

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | the assistant's confidence is 0.52 against a threshold of 0.70 | an employee asks about night-shift allowance eligibility | a ticket is raised with the transcript attached and the employee is given the ticket number |
| 2 | HR operations resolves that ticket | the resolution is saved | the reply is posted to the channel the employee used most recently |

### SSV-US-024 · Handle a confidential HR case in a restricted queue

As a **Employee / worker**, I want to raise a harassment complaint that only the committee can see, so that I can report safely without my line manager knowing.

Priority: **Must** · Use case: SSV-UC-011 · Realises: SSV-CG-006

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1042 raises a complaint naming her line manager E1019 | the case is created | neither E1019 nor E1019's manager can see, search or be notified about the case |
| 2 | the case is under inquiry | E1042 checks its status | she sees the status Under inquiry and the next hearing date but not committee notes |

### SSV-US-025 · Handle a confidential HR case in a restricted queue

As a **HR operations**, I want to give an investigator access that expires on its own, so that access never outlives the need.

Priority: **Must** · Use case: SSV-UC-011 · Realises: SSV-CG-006

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | an investigator is granted access for 14 days from 2026-11-05 | 2026-11-19 00:00 passes | the grant has expired and both the grant and the expiry appear in the case audit |
| 2 | a payroll manager with entity-wide HR access opens the case link | the request is evaluated | access is denied and the case owner receives an alert within 5 minutes |

### SSV-US-026 · Handle a confidential HR case in a restricted queue

As a **Auditor**, I want to review the confidential case audit without reading case content, so that I can confirm need-to-know access was respected.

Priority: **Should** · Use case: SSV-UC-011 · Realises: SSV-CG-006

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | I hold the case-audit grant for Vindhya Precision Industries | I open the audit for a closed harassment case | I see each access with principal, action and timestamp but no notes or evidence |
| 2 | I hold only the general audit grant | I search the action ledger | confidential case entries are not listed |

### SSV-US-027 · Generate a signed standard letter on demand

As a **Employee / worker**, I want to download a signed salary certificate immediately, so that I can submit my home-loan application the same day.

Priority: **Must** · Use case: SSV-UC-012 · Realises: SSV-CG-007

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1018's September 2026 payroll run is finalised | she requests a salary certificate addressed to her bank | a signed PDF with a verification QR code is ready within 10 seconds showing September 2026 gross and net pay |
| 2 | E1018 has already generated 3 salary certificates in November 2026 | she requests a fourth | the request is refused and the next eligible date 2026-12-01 is shown |

### SSV-US-028 · Generate a signed standard letter on demand

As a **HR operations**, I want to control which template version employees can generate, so that every self-issued letter uses approved wording.

Priority: **Must** · Use case: SSV-UC-012 · Realises: SSV-CG-007

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | address-proof template version 3 is approved and version 2 is withdrawn | any employee requests address proof | only version 3 is used and the issue log records version 3 |
| 2 | a visa letter request contains free-text addressee details | the employee submits it | it waits in the HR operations queue and is signed only after HR approves |

### SSV-US-029 · Generate a signed standard letter on demand

As a **Employee / worker**, I want to obtain my experience letter after I have left, so that I can join my next employer without chasing my old HR team.

Priority: **Should** · Use case: SSV-UC-012 · Realises: SSV-CG-007

| # | Given | When | Then |
| ---: | :--- | :--- | :--- |
| 1 | E1032's last working day was 2026-10-31 and the final settlement is complete | he requests an experience letter through alumni access | a signed letter is issued showing his service dates and last designation |
| 2 | E1032's final settlement is still pending | he requests the letter | the request is held and he is told the letter will be available once the settlement completes |

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
| Size | 87 | specified items (table rows) | Counted automatically at generation |
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
