<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/MultipliersKraftLogoDark.png">
  <img src="../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# BA-02 — Process Inventory

| Attribute | Value |
| :--- | :--- |
| Document ID | BA-02 |
| Title | Process Inventory |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Enterprise Architect |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | RDM |
| Related documents | BA-01, UCC-01, FRS-<DOM>-01 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-01 – BG-10 |
| Source of record | Nucleus — Process Flows & Process Maps v1.0 — sheet(s) 03_Process_Inventory |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.


## Platform & Foundations

| Process ID | Process | Domain | Trigger | Primary actor | Frequency | Criticality | Blueprint module | Phase | Reuses | Demo pts | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PLT-01 | Tenant provisioning | PLT | Signed order / demo request | Implementation consultant | Per client | High | Platform | P0 | CMP-09 |  | Target: fully provisioned in under 30 minutes, automated (NFR). |
| PLT-02 | Identity, role and data-scope grant | PLT | User created or moved | Tenant admin | Continuous | Critical | Platform §8 | P0 | CMP-08 | 8 | Entity + reporting line + LOCATION. Location scope is the v1.1 gap; retrofitting a permission model is unsafe. |
| PLT-03 | Configuration authoring and effective dating | PLT | Policy change or implementation | Implementation consultant | Continuous | Critical | Platform | P0 | CMP-09, CMP-10 | 2,3,4,7,12 | If a client rule needs a developer, it is a product gap (blueprint §15). |
| PLT-04 | Workflow definition and versioning | PLT | New or changed process | Implementation consultant | Occasional | High | Module 5 | P0 | CMP-01 | 5,16 | In-flight instances finish on the version they started under. |
| PLT-05 | Approval chain execution | PLT | Any approvable request | Approvers | Continuous | Critical | Module 5 | P0 | CMP-01 | 5,9,16,24 | ONE engine. Leave, gate pass, loan, requisition, OT, regularisation, letters all consume it. |
| PLT-06 | Audit and action ledger write | PLT | Any write or sensitive read | System | Continuous | Critical | Platform §6.2, §8 | P0 | CMP-06 |  | Append-only. Agent identity is a dimension, not a separate log. |
| PLT-07 | Event publish and outbox relay | PLT | Any domain write | System | Continuous | Critical | Platform §7.5 | P0 | CMP-07 |  | Transactional outbox. Transport is swappable without touching producers. |
| PLT-08 | Bi-temporal write and as-at read | PLT | Any temporal fact change | System | Continuous | Critical | Platform §7.4 | P0 | CMP-10 | 5,7,12 | valid_from/to + recorded_from/to. Payroll and attendance recompute both depend on as-at reads. |

## People Core

| Process ID | Process | Domain | Trigger | Primary actor | Frequency | Criticality | Blueprint module | Phase | Reuses | Demo pts | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PPL-01 | Create person, position and assignment | PPL | Offer accepted or data load | HR ops | Daily | Critical | Module 1 | P1 | CMP-10, CMP-08 | 22 | person survives rehire and entity transfer; assignment is what everything else references. |
| PPL-02 | Assignment change (effective-dated, retro-capable) | PPL | Grade, manager, location, cost centre, class change | HR ops | Weekly | Critical | Module 1 | P1 | CMP-10, CMP-01 |  | Retro changes after a closed payroll produce arrears, never a rewrite. |
| PPL-03 | Worker class and policy attribute resolution | PPL | Any time or pay computation | System | Continuous | Critical | Module 1 | P1 | CMP-10 | 2,3,4 | Class supplies the default; the assignment may override with a reason and a date. |
| PPL-04 | Position control and sanctioned strength | PPL | Budget approval or vacancy | HR / Finance | Monthly | High | Module 1 | P3 | CMP-10 | 24,25 | Actual, open and sanctioned are three readings of one structure. |
| PPL-05 | Org unit change and reorganisation | PPL | Restructure | HR ops | Occasional | Medium | Module 1 | P1 | CMP-10 | 22 | Effective-dated, so history survives the reorganisation. |
| PPL-06 | Document capture, classification and expiry | PPL | Upload | Employee / HR | Continuous | Medium | Module 1 | P1 | CMP-08 | 26 | Expiry tracking drives compliance nudges; storage is encrypted and tokenised. |
| PPL-07 | Rehire, entity transfer and class change | PPL | Rejoin or transfer | HR ops | Occasional | High | Module 1 | P2 | CMP-10 | 3 | Tenure and gratuity continuity decided by rule, not by hand. |
| PPL-08 | Duplicate person detection | PPL | Onboarding or ERP sync | System / HR | Per hire | High | Module 1 | P2 | CMP-11 | 14 | Two people, same name and DOB, same site is routine in manufacturing. |

## Time & Attendance

| Process ID | Process | Domain | Trigger | Primary actor | Frequency | Criticality | Blueprint module | Phase | Reuses | Demo pts | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TIM-01 | Punch ingestion from all sources | TIM | Punch at device, app, business messaging, kiosk, web, gate | Worker | Continuous (500/s peak) | Critical | Module 2 | P1 | CMP-07 | 1 | Raw events immutable. Offline buffering and catch-up are the normal case, not the exception. |
| TIM-02 | Attendance day derivation | TIM | Punch landed, or recompute demand | System | Nightly + on demand | Critical | Module 2 | P1 | CMP-04, CMP-10 | 1 | Keyed on the date the SHIFT started. Pairing, segments, breaks, gross/net/OT. |
| TIM-03 | Shift inference from in-punch | TIM | First in-punch of a day | System | Per day | High | Module 2 | P1 | CMP-04 | 13 | Adopt the shift actually punched into; record assigned vs inferred; never silent. |
| TIM-04 | Day type resolution | TIM | Before disposition | System | Per day | Critical | Module 2 | P1 | CMP-10 | 2,3 | Rest day and holiday resolve FIRST, from worker class and location calendar. |
| TIM-05 | Disposition — grace, lates, half-day, absent, relief | TIM | After totals computed | System | Per day | Critical | Module 2 | P1 | CMP-04, CMP-10 | 12 | Thresholds by shift length are configuration rows, not code. |
| TIM-06 | Gate pass request, approval and credit | TIM | Employee request | Employee | Weekly | High | Module 2 | P1 | CMP-01, CMP-02 | 11 | Ceiling enforced in the service, not the form, because business messaging uses the same rule. |
| TIM-07 | Overtime computation and approval | TIM | Attendance day computed | Manager | Daily | Critical | Module 2 | P1 | CMP-01, CMP-04 | 1,4,10 | Eligibility by class; basis (gross vs net) is tenant configuration. |
| TIM-08 | Exception queue and regularisation | TIM | Unpaired punch, device failure, dispute | Manager / HR | Daily | High | Module 2 | P1 | CMP-01, CMP-04 | 1 | First agent surface with real volume (Attendance Steward). |
| TIM-09 | Attendance recompute | TIM | Late punch, approved regularisation, rule change, roster republish | System | Continuous | Critical | Module 2 | P1 | CMP-04 | 12 | Isolated worker. A month for 5,000 people in under 10 minutes. |
| TIM-10 | Team history and operational time reports | TIM | Manager query | Manager | Daily | High | Module 4 / 11 | P1 | CMP-08 | 1 | A scoped view over attendance_day, not a report builder. Must work on a phone. |

## Leave

| Process ID | Process | Domain | Trigger | Primary actor | Frequency | Criticality | Blueprint module | Phase | Reuses | Demo pts | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| LVE-01 | Leave accrual run | LVE | Nightly job / 1 January / completion date | System | Nightly | Critical | Module 2 | P1 | CMP-02, CMP-10 | 7 | Idempotent per person/type/period/transaction. Double-credit must be impossible, not unlikely. |
| LVE-02 | Joining-month proration | LVE | New joiner | System | Per hire | High | Module 2 | P1 | CMP-02, CMP-10 | 7 | Proration table is data (16_Leave_Proration in the dataset). |
| LVE-03 | Leave request validation | LVE | Employee applies | System | Continuous | High | Module 2 | P1 | CMP-02 | 7 | Combination and cap rules run BEFORE the approval chain, with a message naming the rule. |
| LVE-04 | Leave approval chain | LVE | Validated request | Supervisor, HOD, HR Head | Continuous | High | Module 2 | P1 | CMP-01 | 5 | Sequential, SLA per step, HR edit right logged with actor and reason. |
| LVE-05 | Early return and re-credit | LVE | Employee returns early | HR | Occasional | Critical | Module 2 | P1 | CMP-02, CMP-04 | 5 | Reversal row + attendance recompute in ONE transaction, or the payslip disagrees with the ledger. |
| LVE-06 | Comp-off credit and expiry | LVE | Rest-day or holiday working | System | Nightly | High | Module 2 | P1 | CMP-02 | 6 | Per-credit 60-day clock. A single balance-level expiry is wrong. |
| LVE-07 | Year-end encashment, lapse and birthday leave | LVE | 31 December / birthday | System | Annual | High | Module 2 | P1 | CMP-02 | 7 | EL encashes, CL and SL lapse. Encashment is a payroll input. |
| LVE-08 | Balance projection from the ledger | LVE | Any balance read | System | Continuous | Critical | Module 2 | P1 | CMP-02 | 5,6,7 | Balance is a projection, never a stored column. |

## Payroll

| Process ID | Process | Domain | Trigger | Primary actor | Frequency | Criticality | Blueprint module | Phase | Reuses | Demo pts | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PAY-01 | Period setup and run creation | PAY | Cycle start or off-cycle need | Payroll manager | Monthly+ | Critical | Module 3 | P1 | CMP-10 | 10 | run_type is set here. A period carries several runs. |
| PAY-02 | Input lock and immutable snapshot | PAY | Cut-off reached | Payroll manager | Per run | Critical | Module 3 | P1 | CMP-05, CMP-10 |  | Hashed snapshot of inputs, rule pack versions and config. Reproducibility depends on it. |
| PAY-03 | Pre-payroll audit | PAY | Snapshot taken | Payroll manager + agent | Per run | Critical | Module 3 | P1 | CMP-05 | 15 | Rule checks first, statistical second. CRITICAL flags block approval. |
| PAY-04 | Gross-to-net DAG execution | PAY | Audit cleared | System | Per run | Critical | Module 3 | P1 | CMP-03 |  | Topological, once per employee, every intermediate stored. Integer money. |
| PAY-05 | Wage base and 50% floor add-back | PAY | Inside the DAG | System | Per run | Critical | Modules 3, 6 | P1 | CMP-03 |  | One node, versioned, testable in isolation, simulatable. |
| PAY-06 | Daily-wage earnings computation | PAY | Inside the DAG for daily classes | System | Per run | Critical | Module 3 | P1 | CMP-03 | 2 | A separate node, not a proration parameter. Visible as such on the payslip. |
| PAY-07 | Statutory computation (PF, ESI, PT, LWF, TDS) | PAY | Inside the DAG | System | Per run | Critical | Modules 3, 6 | P1 | CMP-03, CMP-09 | 17 | Central pack + state pack. PT differs by state on one run. |
| PAY-08 | Loan, advance and EWA recovery | PAY | Inside the DAG | System | Per run | High | Modules 3, 12 | P1 | CMP-03 | 9 | Respect the net-pay floor; stop on closure; report balance back to CMB. |
| PAY-09 | Review, approval and disbursement | PAY | Calculation complete | Payroll manager, Finance | Per run | Critical | Module 3 | P1 | CMP-01, CMP-05 | 15 | Dual control, out-of-band verification of bank totals. |
| PAY-10 | Off-cycle overtime run | PAY | OT approved for the period | Payroll manager | Monthly | High | Module 3 | P1 | CMP-03 | 10 | Own approval path, own bank file, own journal. Screens need a run selector. |
| PAY-11 | Arrears and retro processing | PAY | Retro change on a closed period | System | Monthly | Critical | Module 3 | P2 | CMP-03, CMP-10 |  | Recompute as-at the old rule version, difference posted as arrears. |
| PAY-12 | Full-and-final run | PAY | Clearance complete | Payroll manager | Per exit | Critical | Modules 3, 5 | P1 | CMP-03, CMP-05 | 16 | Blocked while any blocking clearance item is open — same lock as PAY-02. |
| PAY-13 | Payslip publication and retrieval | PAY | Run disbursed | Employee | Monthly | High | Modules 3, 4 | P1 | CMP-08 | 10 | Run selector everywhere. Offline view on mobile. |
| PAY-14 | Rollback and reversal | PAY | Defect found pre-disbursement | Payroll manager | Rare | Critical | Module 3 | P1 | CMP-05 |  | Permitted up to DISBURSEMENT_PREPARED. Beyond that, arrears only. |

## Compliance

| Process ID | Process | Domain | Trigger | Primary actor | Frequency | Criticality | Blueprint module | Phase | Reuses | Demo pts | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| CMP-01p | Rule pack authoring, test and deployment | CMP | Statutory notification | Payroll & compliance engineer | Per notification | Critical | Module 6 | P1 | CMP-09 | 17 | Green suite + named reviewer or it does not deploy. |
| CMP-02p | Obligation calendar and filing | CMP | Calendar due date | HR / Finance owner | Monthly | Critical | Module 6 | P1 | CMP-01 | 17 | The screen the HR head opens every morning. |
| CMP-03p | Statutory form and register generation | CMP | Joining, period end, or filing demand | System | Per event | Critical | Module 6 | P1 | CMP-03r, CMP-09 | 17,26 | Declarative query bound to a template, state-scoped to the plant's registration. |
| CMP-04p | Labour Codes wage-base simulation | CMP | Structure change proposal | HR / Comp | Occasional | High | Modules 6, 12 | P2 | CMP-03 |  | Sell the simulator; it opens doors (blueprint Module 3). |
| CMP-05p | AI governance logging and disclosure | CMP | Any inference | System | Continuous | High | Module 6 | P2 | CMP-06 |  | Disclosure, labelling, inference log, no AI-only adverse decision. |
| CMP-06p | DPDP consent, retention and erasure | CMP | Consent event or erasure request | System / DPO | Continuous | High | Module 6 | P3 | CMP-06 |  | 48-hour pre-erasure intimation; processor obligations flowed down. |

## Lifecycle

| Process ID | Process | Domain | Trigger | Primary actor | Frequency | Criticality | Blueprint module | Phase | Reuses | Demo pts | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| LCY-01 | Pre-boarding | LCY | Offer accepted | Candidate, HR | Per hire | High | Module 5 | P1 | CMP-01 | 23 | Document collection, BGV, asset and IT requests run in parallel. |
| LCY-02 | Joining chain | LCY | Date of joining | HR ops | Per hire | Critical | Module 5 | P1 | CMP-01, CMP-03r | 23,26 | Statutory joining forms including Form F are produced INSIDE the chain. |
| LCY-03 | Probation and confirmation | LCY | Probation end approaching | Manager, HR | Per hire | Medium | Module 5 | P2 | CMP-01, CMP-03r | 21 | Confirmation letter and any referral balance both trigger here. |
| LCY-04 | Promotion and transfer | LCY | Approved change | HR ops | Monthly | High | Module 5 | P2 | CMP-01, CMP-10 |  | Transfer re-resolves PT, LWF, holiday calendar, rest-day pattern and location scope. |
| LCY-05 | Resignation and notice | LCY | Employee resigns | Employee, HR | Per exit | High | Module 5 | P1 | CMP-01 | 16 | Notice computation feeds F&F recovery. |
| LCY-06 | Clearance / no-dues | LCY | Resignation accepted | Department owners | Per exit | Critical | Module 5 | P1 | CMP-01, CMP-05 | 16 | Parallel with notice, not after it. Blocking items gate F&F. |
| LCY-07 | F&F settlement on the last working day | LCY | All blocking items cleared | Payroll | Per exit | Critical | Modules 3, 5 | P1 | CMP-03, CMP-05 | 16 | Gratuity, encashment, notice recovery, negative net handling. |
| LCY-08 | Asset allocation and return | LCY | Joining / exit | Admin, IT | Per hire and exit | Medium | Module 5 | P1 | CMP-01 | 23 | A register, not a checkbox. Same assets appear as blocking clearance items. |

## Self-Service & Helpdesk

| Process ID | Process | Domain | Trigger | Primary actor | Frequency | Criticality | Blueprint module | Phase | Reuses | Demo pts | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SSV-01 | Employee self-service action | SSV | Employee intent | Employee | Continuous | High | Module 4 | P1 | CMP-08 | 1,11 | Three taps or fewer. Offline for attendance and payslip. |
| SSV-02 | Manager unified approval inbox | SSV | Any pending item | Manager | Daily | High | Module 4 | P1 | CMP-01, CMP-08 | 5 | One queue across every module, not one inbox per module. |
| SSV-03 | business messaging channel transaction | SSV | Message received | Employee | Continuous | High | Modules 4, 7 | P2 | CMP-02, CMP-08 | 20 | Parallel first-class channel: apply, approve, check in, payslip. |
| SSV-04 | Helpdesk ticket | SSV | Question or issue | Employee | Continuous | Medium | Module 7 | P2 | CMP-01 |  | Routing, SLA, escalation, deflection measurement. |
| SSV-05 | Grounded policy answer | SSV | Employee question | Policy Assistant agent | Continuous | Medium | Module 7 | P2 | CMP-11, CMP-06 | 7 | No answer without a retrieved source; unknown creates a ticket and says so. |

## Compensation, Loans & Benefits

| Process ID | Process | Domain | Trigger | Primary actor | Frequency | Criticality | Blueprint module | Phase | Reuses | Demo pts | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| CMB-01 | Loan eligibility evaluation | CMB | Any eligibility question | System | Continuous | Critical | Module 12 | P1 | CMP-02 | 9 | ONE service method read by the screen, the guarantor lock, payroll and the agent tool. |
| CMB-02 | Loan application and guarantor acceptance | CMB | Employee applies | Employee, guarantors | Monthly | High | Module 12 | P2 | CMP-01, CMP-02 | 9 | Two mandatory guarantors, third optional above a threshold. |
| CMB-03 | Loan sanction and director override | CMB | Application approved | Finance / Director | Monthly | High | Module 12 | P2 | CMP-01 | 9 | Override records approver, reason and the rules waived. |
| CMB-04 | Repayment, closure and guarantor release | CMB | Payroll recovery / final instalment | System | Monthly | Critical | Modules 3, 12 | P2 | CMP-02 | 9 | Release is an explicit event. Without it a guarantor is blocked forever. |
| CMB-05 | Salary advance and earned wage access | CMB | Employee request | Employee | Monthly | Medium | Modules 3, 12 | P3 | CMP-02, CMP-03 |  | Cap at 50% of accrued net; design in the ledger now even if it ships later. |
| CMB-06 | Compensation revision cycle | CMB | Annual cycle | HR, Finance | Annual | High | Module 12 | P3 | CMP-01, CMP-03r | 21 | Budget cascade, manager proposal, simulation, letter generation. |

## Talent

| Process ID | Process | Domain | Trigger | Primary actor | Frequency | Criticality | Blueprint module | Phase | Reuses | Demo pts | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TAL-01 | Requisition raise and position control check | TAL | Vacancy or growth | Hiring manager | Weekly | High | Modules 1, 9 | P3 | CMP-01, CMP-02 | 24,25 | Replacement names a vacated position; addition consumes sanction or is blocked. |
| TAL-02 | Candidate pipeline to offer | TAL | Requisition open | Recruiter | Continuous | Medium | Module 9 | P3 | CMP-01 |  | No auto-reject. Ranking assists; humans decide; reasons recorded. |
| TAL-03 | Referral tracking and award payout | TAL | Referral submitted | Employee, HR | Monthly | Medium | Modules 9, 15 | P2 | CMP-02 | 19 | Part on joining, balance on confirmation, paid through payroll. |
| TAL-04 | Goal, check-in and review cycle | TAL | Cycle opened | Manager, employee | Quarterly | Medium | Module 8 | P2 | CMP-01, CMP-11 |  | AI drafts, human decides and signs; the system records that. |
| TAL-05 | Skills inference and learning assignment | TAL | Work signal or completion | System | Continuous | Medium | Module 10 | P3 | CMP-07, CMP-11 | 23 | Induction paths assigned by the joining chain use the same mechanism. |

## Contingent Workforce

| Process ID | Process | Domain | Trigger | Primary actor | Frequency | Criticality | Blueprint module | Phase | Reuses | Demo pts | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| CTG-01 | Contractor engagement and worker registration | CTG | Contract signed | HR / Purchase | Per contract | High | Module 13 | P3 | CMP-10 | 3 | One engagement, several worker classes. Class is the unit of policy, not the contract. |
| CTG-02 | Contractor attendance and invoice reconciliation | CTG | Vendor invoice | Finance | Monthly | High | Module 13 | P3 | CMP-04 | 3 | Bill against attendance the system already holds; variance visible before payment. |
| CTG-03 | Principal employer compliance verification | CTG | Monthly filing cycle | Compliance owner | Monthly | High | Modules 6, 13 | P3 | CMP-01 | 17 | Contractor's own PF and ESI filings held as evidence. |

## Experience

| Process ID | Process | Domain | Trigger | Primary actor | Frequency | Criticality | Blueprint module | Phase | Reuses | Demo pts | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| EXP-01 | Recognition nomination, award and payout | EXP | Programme cycle | Manager, HR | Monthly | Medium | Module 15 | P2 | CMP-01, CMP-03 | 18 | Monetary component raises a payroll input in a named run. |
| EXP-02 | Announcement generation and publish | EXP | Event or manual | System / HR | Daily | Low | Module 15 | P2 | CMP-03r, CMP-07 | 20 | Audience rule + channel list, with an editorial override before publish. |
| EXP-03 | Letter generation and issue register | EXP | Lifecycle event | HR ops | Weekly | Medium | Module 15 | P2 | CMP-03r, CMP-01 | 21 | Issued letter retains the template version that produced it. |

## Finance & Erp

| Process ID | Process | Domain | Trigger | Primary actor | Frequency | Criticality | Blueprint module | Phase | Reuses | Demo pts | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| FIN-01 | ERP employee master inbound sync | FIN | Scheduled batch or webhook | System | Nightly | Critical | Blueprint §9.2 | P1 | CMP-07, CMP-10 | 14 | Three ownership modes; co-owned is the common answer. Never implicit last-write-wins. |
| FIN-02 | GL mapping maintenance and validation | FIN | New component or account | Implementation / Finance | Occasional | Critical | Blueprint §9.1 | P1 | CMP-10 | 15 | Unmapped component blocks the run reaching APPROVED. |
| FIN-03 | Salary journal generation and posting | FIN | Run approved | System | Per run | Critical | Blueprint §9.1 | P1 | CMP-03 | 15 | Dimensioned at employee level BEFORE aggregation. One journal per run per entity. |
| FIN-04 | Reconciliation reporting | FIN | Post-posting | Finance | Per run | Critical | Blueprint §9.4 | P1 | CMP-08 | 15 | A product screen, not a support script. |
| FIN-05 | Bank file generation and dual control | FIN | Run approved | Finance | Per run | Critical | Module 3 | P1 | CMP-05 |  | Out-of-band total verification; alert on bank-detail change inside a payroll window. |

## Intelligence & Agents

| Process ID | Process | Domain | Trigger | Primary actor | Frequency | Criticality | Blueprint module | Phase | Reuses | Demo pts | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| INT-01 | Agent invocation through the policy gate | INT | Schedule or user ask | Agent | Continuous | Critical | Blueprint §6.2 | P2 | CMP-11, CMP-06 |  | Identity, scoped role, per-tool permission, blast-radius cap, dry-run requirement. |
| INT-02 | Action ledger write and reversal | INT | Agent action executed | System | Continuous | Critical | Blueprint §6.2 | P2 | CMP-06 |  | Simulation result, approval, outcome, reversal handle. Watch the reversal rate. |
| INT-03 | Analytics projection and operational reports | INT | Event or schedule | System | Continuous | High | Module 11 | P2 | CMP-07, CMP-08 | 1 | Shipped configured: break, OT register, late summary, gate-pass utilisation, team history. |
| INT-04 | Predictive scoring with explanation | INT | Monthly scoring | System | Monthly | Medium | Module 11 | P3 | CMP-11 |  | HR-only by default; manager exposure is a tenant opt-in with guidance. |

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
| Size | 93 | specified items (table rows) | Counted automatically at generation |
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
