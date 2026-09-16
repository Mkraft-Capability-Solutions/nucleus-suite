# Nucleus HRMS — Module, Sub-Module, Component and Interaction Blueprint

**Status:** Proposed detailed experience handoff
**Companion to:** `UX_NAVIGATION_DASHBOARD_CHANGE_PLAN.md`
**Audience:** Product, design, frontend, backend, data, security and QA
**Purpose:** Define the complete structure and behavior of every planned product area without replacing the current routing, authentication, tenant, database or service architecture.

---

## 1. Experience principle

Every screen should feel like part of one calm, premium B2B product. The interface should be clear before it is clever, useful before it is decorative, and trustworthy before it is impressive.

The experience uses:

- Montserrat for headings, navigation and controls;
- Lato for body copy, forms, tables and data;
- desaturated teal, navy, slate and semantic colors;
- strong alignment and whitespace;
- minimal shadows and no neon bloom;
- predictable placement of actions;
- restrained motion between 120–180ms;
- clear evidence, scope and freshness for important data.

---

## 2. Product map

```text
Nucleus HRMS
├── Dashboard and personal work
│   ├── Role cockpits S1–S10
│   ├── My inbox
│   ├── Mira assistant
│   ├── Notifications
│   └── Focus and announcements
├── Core HR
│   ├── People core
│   ├── Organization
│   ├── Lifecycle and onboarding
│   └── Engagement and experience
├── Workforce operations
│   ├── Attendance and time office
│   ├── Leave and COFF
│   ├── Contract workforce [future]
│   └── Projects and timesheets [future]
├── Payroll and finance
│   ├── Payroll
│   ├── Loans and advances
│   └── Compensation and benefits
├── Talent and growth
│   ├── Talent acquisition
│   ├── Performance
│   └── Learning and skills
├── Insights and AI
│   ├── People intelligence
│   ├── Mira assistant
│   └── Dedicated helpdesk [future]
└── Platform and governance
    ├── Compliance
    ├── Integrations
    ├── VP readiness
    ├── Settings and access
    └── Platform administration
```

### Status legend

| Status | Meaning |
|---|---|
| Existing | A canonical destination and implementation already exist |
| Enhance | Existing destination receives the new system, components or interaction improvements |
| New | Approved new capability requiring implementation |
| Future | Do not expose in navigation until product, data and permissions are approved |

---

## 3. Shared page architecture

```text
ModulePage
├── ModulePageHeader
│   ├── Breadcrumb
│   ├── Title + one-sentence purpose
│   ├── Scope + freshness
│   ├── Primary action
│   └── Overflow actions
├── ModuleTabs
├── FilterBar
├── MetricStrip (when decisions benefit from summary values)
├── MainContent
│   ├── DataTable / Board / Timeline / Chart / Form
│   └── Loading / Empty / Error / Partial / Restricted state
└── DetailDrawer / TaskDialog / Wizard
```

### Layout rules

- One primary action per page.
- Use 24px page padding on desktop, 16px on tablet/mobile.
- Use 20px content-grid gaps on desktop and 12–16px on smaller screens.
- Keep filter bars visible while long lists scroll.
- Use drawers for read-first record inspection.
- Use a dedicated page for complex, shareable or multi-step work.
- Use dialogs only for short decisions or confirmations.
- Drawers are 440–520px desktop and full-screen mobile.
- Tabs update the URL when the state is shareable.
- Mobile forms use a sticky submit footer above the safe area.

### Shared components

| Component | Responsibility | Required states |
|---|---|---|
| `ModulePageHeader` | Context, title, scope, freshness and actions | default, loading, partial, restricted |
| `ModuleTabs` | Sub-module navigation | default, hover, active, focus, overflow, mobile |
| `FilterBar` | Search, filters, dates and saved views | idle, dirty, applied, loading, reset |
| `MetricCard` | Explainable operational value | loading, value, zero, missing, stale, restricted |
| `DataTable` | Sortable/filterable records | loading, empty, error, selectable, paginated |
| `StatusBadge` | Text-and-icon status | neutral, info, success, warning, danger |
| `DetailDrawer` | Record inspection and contained edit | loading, read, edit, dirty, save-error |
| `TaskDialog` | Short task/decision | default, invalid, submitting, success, error |
| `Wizard` | Multi-step creation/import | active, complete, invalid, resumable, failed |
| `Timeline` | Workflow and audit history | empty, current, pending, failed, corrected |
| `ApprovalPanel` | Approve, reject and reroute | pending, submitting, complete, no-authority |
| `FileUploader` | Scan and validate files | idle, drag, upload, scan, accepted, rejected |
| `ChartPanel` | Chart, definition and data alternative | loading, data, empty, partial, error, restricted |
| `EmptyState` | Explain absence and next step | first-use, no-results, unavailable, no-access |
| `InlineNotice` | Local status without blocking the page | info, success, warning, error, partial |

---

## 4. Universal user interaction contracts

### 4.1 Open and inspect a record

1. User opens the canonical module URL.
2. Stable skeletons preserve the final layout while data loads.
3. Filters initialize from the URL and server-authorized scope.
4. Selecting a row opens a detail drawer.
5. The drawer has a clear title, close control and ordered sections.
6. Browser Back closes the drawer when the drawer state is in the URL.
7. Closing restores focus to the originating row.

### 4.2 Create or edit

1. User selects the primary action.
2. The server rechecks create/edit permission.
3. Client validation gives immediate guidance; server validation is authoritative.
4. Unsaved values remain when validation fails.
5. Submit disables duplicate submission and shows progress.
6. Success returns record ID, version and request ID.
7. The list refreshes and the new/updated record is focused.
8. Failure never produces a success message.

### 4.3 Approve, reject or reroute

1. Show request context, evidence, current state and the user's authority.
2. Show only valid state transitions.
3. Require a reason for rejection/reroute when policy requires it.
4. Confirm the exact consequence and affected record.
5. Server checks tenant, permission, record version and segregation of duties.
6. On conflict, refresh and explain that another actor changed the record.
7. Audit actor, before/after state, reason, request ID and timestamp.
8. Offer Undo only when the domain has a valid reverse transition.

### 4.4 Upload or import

1. User downloads the current template or selects a supported file.
2. Upload shows progress and permits cancellation before acceptance.
3. Server scans file type, size and content.
4. Mapping preview identifies recognized, missing and invalid fields.
5. Dry run shows creates, updates, skips and conflicts.
6. User confirms the operation.
7. Background job exposes progress, error report and audit history.

### 4.5 Export

1. Show current scope, filters, fields and sensitivity.
2. Server authorizes export separately from read access.
3. Large exports run asynchronously.
4. Completed files are short-lived and access controlled.
5. Every export is audited.

### 4.6 Dashboard drill-down

1. User selects a metric, chart point or queue item.
2. The dashboard creates a canonical module URL with equivalent filters.
3. The destination displays the applied dashboard context.
4. Clearing context returns to the normal module view.

### 4.7 AI-assisted action

1. Distinguish sourced fact, inference and proposed action.
2. Citations open the exact authorized evidence location.
3. Proposed mutations open a normal workflow with fields prefilled.
4. User reviews and submits normally.
5. AI never bypasses permission, validation or approval.

---

## 5. Dashboard and personal-work domain

### 5.1 Role cockpits — `/`

| Sub-module | Components | Interactions | Rules |
|---|---|---|---|
| Cockpit selector | `CockpitSelector`, `CockpitSummary`, `ScopeFilter` | Switch authorized view, copy link, restore default | URL is authoritative; server resolves permissions |
| Command centre | `MetricStrip`, `ChartPanel`, `ActionQueue` | Filter period/site, inspect definition, drill down | Real data only; partial sources identified |
| S1–S10 views | Shared cockpit framework + role-specific widgets | Change filters, inspect, drill down, open workflow | Each view feature flagged and independently releasable |
| Data freshness | `FreshnessBadge`, `SourceList`, `RefreshAction` | Inspect sources, refresh, retry failed source | Distinguish live, cached, stale and partial |

Detailed S1–S10 content and data requirements remain in the companion master plan.

### 5.2 My inbox — `/inbox`

| Sub-module | Components | Interactions | Rules |
|---|---|---|---|
| Inbox queue | `InboxList`, `InboxFilters`, `StatusBadge` | Search, filter, sort by age/risk, open item | Only authorized actionable records |
| Item detail | `InboxDetailDrawer`, `EvidencePanel`, `Timeline` | Inspect request and evidence | Do not reveal inaccessible related records |
| Decision | `ApprovalPanel`, `ReroutePicker`, `ReasonField` | Approve, reject, reroute | Server transition and delegation rules |
| Read state | `ReadIndicator`, `BulkReadAction` | Mark read/unread, bulk mark read | Optimistic update rolls back on failure |

### 5.3 Mira assistant — `/assistant`

| Sub-module | Components | Interactions | Rules |
|---|---|---|---|
| Conversation | `ConversationPanel`, `PromptComposer`, `SuggestedPrompt` | Ask, cancel, retry, start new conversation | Tenant scoped; cancellation supported |
| Grounded answer | `AnswerBlock`, `CitationCard`, `ConfidenceNotice` | Expand citation, open source, copy permitted excerpt | Never claim grounding without accessible citation |
| Action proposal | `ActionProposalCard`, `FieldPreview`, `OpenWorkflowButton` | Review and open prefilled workflow | No direct restricted mutation |
| Feedback | `AnswerFeedback`, `IssueCategory` | Rate and categorize issue | Do not send raw HR content to generic analytics |
| History | `ConversationList`, `DeleteConversationDialog` | Open, rename, delete | Follow approved retention policy |

### 5.4 Notifications, focus and announcements

| Sub-module | Components | Interactions | Rules |
|---|---|---|---|
| Notifications | `NotificationPopover`, `NotificationRow` | Open target, mark read, open inbox | Read failure remains visibly unread |
| Today's focus | `FocusTaskList`, `FocusTaskRow` | Complete/reopen, open source | Persist on server; safe optimistic rollback |
| Announcements | `AnnouncementCard`, `AnnouncementDetail` | Read and acknowledge | Tenant scope and active dates |
| Announcement authoring | `AnnouncementComposer`, `AudiencePreview`, `PublishDialog` | Draft, preview, schedule, publish | Authorized roles only; attachments secured |

---

## 6. Core HR domain

### 6.1 People core — `/people` — Enhance

| Sub-module | Components | User interactions | Safety and edge behavior |
|---|---|---|---|
| Employee directory | `PeopleKpiStrip`, `PeopleFilterBar`, `PeopleTable` | Search, filter, sort, paginate, open employee | Restricted fields masked; empty and no-result states differ |
| Employee profile | `EmployeeProfileDrawer`, `ProfileSummary`, `EmploymentDetails`, `ReportingCard` | Inspect, edit allowed fields, view history | Self/manager/HR field scopes; version conflict handling |
| Positions and bands | `PositionTable`, `BandBadge`, `PositionDrawer` | Inspect open/filled positions and band | Compensation range separately permitted |
| Document vault | `DocumentTable`, `FileUploader`, `DocumentPreview`, `VerificationBadge` | Upload, preview, verify, replace, download | Scan, expiry, retention, masking and download audit |
| Employment history | `EmploymentTimeline`, `ChangeDetail` | Inspect role/manager/status changes | Append corrections; never rewrite history |
| Create person | `CreatePersonWizard`, `DuplicateCheck`, `InviteSummary` | Enter details, review duplicate matches, create/invite | Server duplicate rules; secrets never redisplayed |

### 6.2 Organization — `/organization` — Enhance

| Sub-module | Components | User interactions | Safety and edge behavior |
|---|---|---|---|
| Organization explorer | `OrgTree`, `OrgSearch`, `NodeSummaryDrawer` | Expand, search, center, open profile | Virtualize large trees; hide unauthorized branches |
| Departments | `DepartmentTable`, `DepartmentDrawer`, `DepartmentForm` | Create/edit/archive department | Resolve active dependencies before archive |
| Reporting lines | `ReportingLineEditor`, `ChangePreview`, `EffectiveDatePicker` | Select manager, preview impact, schedule change | Prevent cycles and invalid effective dates |
| Positions | `PositionPlanTable`, `PositionForm`, `OccupancyPanel` | Create position, set capacity/band, assign occupant | Enforce entity scope and headcount policy |
| History | `OrgChangeTimeline`, `DiffPanel` | Filter and inspect changes | Read-only, immutable audit |

### 6.3 Lifecycle and onboarding — `/onboarding` — Enhance

| Sub-module | Components | User interactions | Safety and edge behavior |
|---|---|---|---|
| Lifecycle pipeline | `LifecycleBoard`, `LifecycleCard`, `LifecycleFilters` | Filter by stage/owner/date, open journey | Server state-machine transitions |
| Onboarding checklist | `ChecklistTemplate`, `ChecklistRun`, `TaskOwnerPicker` | Assign, complete/reopen, add evidence | Required tasks block completion |
| Document collection | `DocumentRequirementList`, `FileUploader`, `VerificationPanel` | Request, upload, verify/reject | Restricted document access |
| Asset assignment | `AssetPicker`, `AssignmentForm`, `AssetHistory` | Allocate, transfer, verify return | Serial uniqueness and custody history |
| Letters | `TemplatePicker`, `LetterMergeForm`, `DocumentPreview` | Choose template, preview, generate | Versioned template and generated-file audit |
| Probation milestones | `MilestoneTimeline`, `EvaluationForm`, `ReminderPanel` | Review, add evidence, escalate overdue | Manager/HR scope and effective dates |
| Exit clearance | `ExitChecklist`, `NoDuesPanel`, `SettlementLink` | Complete clearance, dispute, inspect blockers | No settlement release from client-only state |

### 6.4 Engagement and experience — `/engagement` — Enhance

| Sub-module | Components | User interactions | Safety and edge behavior |
|---|---|---|---|
| Pulse surveys | `SurveyCard`, `SurveyResponseForm`, `ParticipationSummary` | Save draft, submit once, view permitted summary | Anonymous threshold and confidentiality |
| Survey administration | `SurveyBuilder`, `AudienceBuilder`, `SchedulePanel` | Draft, preview, schedule, pause, close | Audience preview and audit |
| Engagement trends | `EngagementMetricStrip`, `TrendChart`, `SegmentFilter` | Change period/segment, inspect methodology | Small cohorts suppressed |
| Recognition | `RecognitionFeed`, `RecognitionComposer`, `RecognitionDetail` | Recognize colleague, choose value/badge | Moderation and controlled rewards ledger |
| Wellbeing resources | `ResourceDirectory`, `ConfidentialityNotice` | Browse and open approved resources | Never infer medical status or expose usage |

---

## 7. Workforce operations domain

### 7.1 Attendance and time office — `/attendance` — Enhance

| Sub-module | Components | User interactions | Safety and edge behavior |
|---|---|---|---|
| Today and punch | `PunchStatusCard`, `PunchAction`, `LocationStatus`, `ShiftSummary` | Punch in/out, confirm context, view latest event | Server time; duplicate prevention; offline clarity |
| Attendance calendar | `AttendanceCalendar`, `DayStatusLegend`, `MonthPicker` | Change month, select day, request correction | Overnight shift and holiday handling |
| Day trace | `PunchTimeline`, `CalculationBreakdown`, `TraceDrawer` | Inspect raw events, breaks and rules | Raw events immutable; corrections append |
| Regularization | `RegularizationForm`, `EvidenceUploader`, `ApprovalTimeline` | Propose correction and submit | Payroll-lock conflicts explained |
| Team attendance | `TeamAttendanceTable`, `ScopeFilter`, `ExceptionBadge` | Filter team/site, inspect exception | Manager scope resolved server side |
| Shifts and rosters | `RosterMatrix`, `ShiftEditor`, `CoverageSummary`, `SuggestionPreview` | Assign/swap, preview coverage, request/approve | Rest, leave and policy conflicts block commit |
| Overtime | `OvertimeTable`, `ThresholdIndicator`, `ApprovalPanel` | Review, approve/dispute, inspect source | Approved rules and locked periods |

### 7.2 Leave and COFF — `/leave` — Enhance

| Sub-module | Components | User interactions | Safety and edge behavior |
|---|---|---|---|
| Balances | `LeaveBalanceCards`, `BalanceLedgerDrawer` | Inspect available/pending/used and ledger | As-of date; adjustments explained |
| Apply leave | `LeaveRequestForm`, `DateRangePicker`, `PolicyPreview`, `ApproverPreview` | Select type/dates, review calculation, submit | Server recalculates; policy version explicit |
| My requests | `LeaveRequestTable`, `RequestDetailDrawer`, `ApprovalTimeline` | Filter, inspect, cancel/modify when allowed | Processed/locked requests protected |
| Team approvals | `LeaveApprovalQueue`, `CoveragePanel`, `ApprovalPanel` | Review overlap, approve, reject, reroute | Coverage advisory; authority verified |
| COFF ledger | `CoffBalance`, `CoffLedger`, `GrantRequestForm` | View grants/expiry, request grant/use | Every credit traces to qualifying work |
| Policy matrix | `PolicySummary`, `RuleExplanation`, `EffectiveVersionBadge` | Review rules and examples | Legal/HR-approved configuration only |

### 7.3 Contract workforce — Future

| Sub-module | Components | User interactions | Required before launch |
|---|---|---|---|
| Contractors | `ContractorTable`, `ContractorDrawer`, `AssignmentForm` | Create/inspect worker and assignment | Route, schema, services, owner and permissions |
| Agencies | `AgencyTable`, `ComplianceStatus`, `AgencyDrawer` | Review agency and certificates | Vendor/document ownership |
| Contracts | `ContractTable`, `ContractTimeline`, `RenewalAction` | Review, request renewal/closure | Legal workflow |
| Invoice reconciliation | `ReconciliationTable`, `VarianceDrawer`, `DisputeForm` | Compare hours, accept/dispute | Finance reconciliation and audit |

Do not add these destinations to navigation until the complete backend and authorization model exists.

### 7.4 Projects and timesheets — Future

| Sub-module | Components | User interactions | Required before launch |
|---|---|---|---|
| Projects | `ProjectGrid`, `ProjectDrawer`, `ProjectForm` | Create, filter, inspect, edit | Ownership/membership and client-data policy |
| Sprint board | `KanbanBoard`, `TaskCard`, `TaskDrawer` | Create/assign/move, filter own work | Keyboard alternative and transition rules |
| Timesheets | `WeekTimesheet`, `TimeEntryForm`, `SubmissionSummary` | Log/edit, submit, reopen when permitted | Eligibility, lock dates and approval workflow |
| Allocation | `AllocationChart`, `AllocationEditor`, `ConflictNotice` | Review/edit allocation | Effective dates, capacity and audit |

---

## 8. Payroll and finance domain

### 8.1 Payroll — `/payroll` — Enhance

| Sub-module | Components | User interactions | Safety and edge behavior |
|---|---|---|---|
| Payroll runs | `PayrollRunTable`, `RunStatusBadge`, `RunDetailDrawer` | Create authorized run, open, compare, resume | Duplicate-period prevention |
| Inputs | `PayrollInputTable`, `InputImportWizard`, `ValidationSummary` | Upload/review inputs, correct, freeze | Dry run, source tracking and lock |
| Calculation | `RunStepper`, `CalculationSummary`, `EmployeeCalculationDrawer` | Calculate, inspect trace, recalculate subset | Idempotent, versioned, deterministic |
| Anomalies | `AnomalyQueue`, `AnomalyDetail`, `ResolutionForm` | Resolve, defer or escalate | No blanket clear; evidence and reason required |
| Approval | `PayrollApprovalPanel`, `ReconciliationSummary`, `SoDNotice` | Approve/reject stage | Maker-checker enforcement |
| Journal | `JournalPreview`, `BalanceIndicator`, `JournalExport` | Inspect and export/post through integration | Balanced approved run required |
| Payslips | `PayslipTable`, `PayslipPreview`, `ReleasePanel` | Preview, release batch, download | Self-only default; release/download audit |
| Finalization | `FinalizeChecklist`, `ConfirmationDialog` | Review blockers and finalize | Elevated permission and explicit consequence |

### 8.2 Loans and advances — `/loans` — Enhance

| Sub-module | Components | User interactions | Safety and edge behavior |
|---|---|---|---|
| My loans | `LoanSummaryCards`, `LoanTable`, `RepaymentSchedule` | Inspect balance, installments, history | Self scope unless finance permission |
| Apply | `LoanApplicationWizard`, `EligibilityPanel`, `DocumentUploader` | Enter request, review eligibility, submit | Server-calculated eligibility |
| Finance review | `LoanApprovalQueue`, `AffordabilitySummary`, `ApprovalPanel` | Request info, approve/reject | Sensitive-field restrictions and SoD |
| Advances/EWA | `AdvanceRequestForm`, `AccruedAmountPanel`, `RepaymentPreview` | Request amount, confirm terms | Legal/product/payment approval required |
| Repayments | `RepaymentLedger`, `AdjustmentForm` | Inspect deductions, propose correction | Payroll-linked audit |

### 8.3 Compensation and benefits — `/compensation` — Enhance

| Sub-module | Components | User interactions | Safety and edge behavior |
|---|---|---|---|
| Total rewards | `CompensationSummary`, `SalaryStructure`, `StatementDownload` | Review package, inspect components, download | Self-only default and secure generation |
| Bands and benchmarks | `BandTable`, `BandPositionChart`, `BenchmarkSource` | Filter role/location, inspect range | Restricted aggregates and source date |
| Compensation changes | `CompChangeForm`, `ChangePreview`, `ApprovalTimeline` | Propose, review impact, submit/approve | Budget, effective date, SoD and audit |
| Benefits | `BenefitPlanCards`, `EnrollmentForm`, `CostPreview` | Compare and enroll/change during window | Eligibility and dependent privacy |
| History | `CompensationTimeline`, `StatementTable` | View effective history/documents | Immutable and masked appropriately |

---

## 9. Talent and growth domain

### 9.1 Talent acquisition — `/talent` — Enhance

| Sub-module | Components | User interactions | Safety and edge behavior |
|---|---|---|---|
| Requisitions | `RequisitionTable`, `RequisitionForm`, `ApprovalTimeline` | Create, submit, approve, pause, close | Budget/headcount authorization |
| Candidate pipeline | `CandidateBoard`, `CandidateCard`, `CandidateDrawer` | Filter, open, advance valid stage | Keyboard alternative and server transition |
| Applications | `ApplicationTable`, `ResumePreview`, `ApplicationTimeline` | Search, review, advance/dispose with reason | Consent, retention and restricted download |
| Interviews | `InterviewSchedule`, `ScorecardForm`, `PanelStatus` | Schedule and submit feedback | Assigned interviewer scope and feedback lock |
| Offers | `OfferWorkflow`, `CompensationApproval`, `OfferDocumentPreview` | Prepare, approve, issue, record response | Compensation/document permissions |
| Insights | `FunnelChart`, `SourceBreakdown`, `ExperienceSummary` | Filter and drill down | Privacy threshold and stage definitions |

### 9.2 Performance — `/performance` — Enhance

| Sub-module | Components | User interactions | Safety and edge behavior |
|---|---|---|---|
| Review cycles | `CycleTable`, `CycleForm`, `ParticipantSummary` | Configure, preview population, launch/close | Launched configuration controlled |
| Goals/OKRs | `GoalTree`, `GoalForm`, `ProgressUpdate` | Create/cascade, update, attach evidence | Ownership and period validation |
| Reviews | `ReviewForm`, `CompetencyScale`, `EvidencePanel` | Save draft, request feedback, submit | Autosave status and submission lock |
| Feedback | `FeedbackRequest`, `FeedbackForm`, `FeedbackSummary` | Request/provide/view | Confidentiality explicit |
| Calibration | `CalibrationGrid`, `EmployeeCalibrationDrawer`, `DistributionPanel` | Filter, inspect, propose adjustment | Reason and adjustment history; no drag-only UI |
| Publish | `PublishSummary`, `ValidationChecklist`, `ConfirmationDialog` | Resolve blockers and publish | Elevated permission, audit and consequence |

### 9.3 Learning and skills — `/learning` — Enhance

| Sub-module | Components | User interactions | Safety and edge behavior |
|---|---|---|---|
| My learning | `EnrollmentCards`, `ProgressBar`, `DeadlineBadge` | Resume, view requirements | External launches labelled; source shown |
| Catalogue | `CourseGrid`, `CourseFilters`, `CourseDrawer` | Search/filter, inspect, enroll/request | Eligibility/capacity server checked |
| Assignments | `AssignmentTable`, `AudienceBuilder`, `SchedulePanel` | Assign course and set deadline | Audience preview and audit |
| Certifications | `CertificateTable`, `CertificateUploader`, `ExpiryStatus` | Upload, verify, renew | Verification and expiry history |
| Skills/evidence | `SkillProfile`, `EvidenceCard`, `VerificationPanel` | Add evidence, request verification | Inferred is never shown as verified |
| Analytics | `LearningMetricStrip`, `CompletionFunnel`, `FunctionHoursChart` | Filter and drill into aggregates | Cohort privacy and event definitions |

---

## 10. Insights and AI domain

### 10.1 People intelligence — `/insights` — Enhance

| Sub-module | Components | User interactions | Safety and edge behavior |
|---|---|---|---|
| Metric catalogue | `MetricDefinitionTable`, `MetricDefinitionDrawer` | Search, inspect formula/owner/version, create if allowed | Definitions versioned |
| Snapshots | `SnapshotChart`, `ComparisonPicker`, `DataFreshness` | Change period/segment, compare | Missing/partial/stale explicit |
| Capability index | `CapabilityRunTable`, `RunDetail`, `EvidenceCoverage` | Start run, inspect status/result | Version and coverage required |
| Custom analysis | `AnalysisBuilder`, `DimensionPicker`, `PreviewTable` | Configure, preview and save analysis | Query cost/row limits and field permissions |
| Exports | `ExportConfigurator`, `ExportJobStatus` | Select fields/scope/format, download | Separate permission and audit |

### 10.2 Dedicated helpdesk — Future decision

Until approved, policy questions remain in Mira and actionable requests remain in Inbox.

If approved, the module requires:

- `TicketList` with status, category, SLA, assignee and requester-safe filters;
- `TicketDetail` with timeline and attachments;
- `MessageThread` with internal/public note distinction;
- `SlaBadge` driven by configured calendars;
- `AssignmentPanel` with delegation and workload context;
- `CategoryForm` and routing rules;
- notifications, escalation, audit and retention behavior.

---

## 11. Platform and governance domain

### 11.1 Compliance — `/compliance` — Enhance

| Sub-module | Components | User interactions | Safety and edge behavior |
|---|---|---|---|
| Obligations | `ObligationCalendar`, `ObligationTable`, `ObligationDrawer` | Filter, assign owner, open filing | Entity and jurisdiction explicit |
| Evidence | `EvidenceTable`, `EvidenceUploader`, `EvidencePreview` | Upload, link, verify, replace version | Secure storage, scan and download audit |
| Controls | `ControlRegister`, `ControlStatus`, `TestResultTimeline` | Review, test, add evidence, remediate | Owner/cadence and immutable history |
| Filings | `FilingTable`, `FilingChecklist`, `SubmissionRecord` | Prepare, review, record proof | Do not imply submission without proof |
| Analytics | `ReadinessSummary`, `DueDateChart`, `RiskBreakdown` | Filter and drill down | Definitions and freshness shown |

### 11.2 Integrations — `/integrations` — Enhance

| Sub-module | Components | User interactions | Safety and edge behavior |
|---|---|---|---|
| Connectors | `ConnectorGrid`, `ConnectorStatus`, `ConnectorDrawer` | Inspect, configure, enable/disable | Secret never returned after write |
| Sync runs | `SyncRunTable`, `RunLogDrawer`, `RetryAction` | Inspect result/error, retry | Idempotent with duplicate prevention |
| Webhooks | `WebhookTable`, `WebhookForm`, `DeliveryLog` | Create/update/pause, rotate secret | Secret shown once; signing/replay protection |
| API keys | `ApiKeyTable`, `ApiKeyDialog`, `ScopePicker` | Generate, copy once, revoke | Expiry, least privilege and audit |
| Inbound imports | `InboundSourceTable`, `MappingEditor`, `JobHistory` | Configure, dry run, activate, inspect | Validation and tenant isolation |

### 11.3 VP readiness — `/readiness` — Enhance

| Sub-module | Components | User interactions | Safety and edge behavior |
|---|---|---|---|
| Summary | `ReadinessScore`, `GateSummary`, `EnvironmentStatus` | Inspect score, filter, open failure | Formula and freshness visible |
| Release gates | `GateChecklist`, `GateDetail`, `EvidencePanel` | Review, inspect evidence, rerun allowed check | Automated/manual evidence distinguished |
| Operations | `DependencyStatus`, `RunbookLinks`, `OwnerMatrix` | Open owner/runbook, acknowledge blocker | Link authorization checked |
| History | `ReadinessRunTable`, `RunComparison` | Compare runs and inspect regression | Immutable snapshots |

### 11.4 Settings and access — `/settings` — Enhance

| Sub-module | Components | User interactions | Safety and edge behavior |
|---|---|---|---|
| Organization settings | `TenantSettingsForm`, `LegalEntityTable`, `LocationTable` | Edit approved configuration | Effective dates and impact summary |
| Members | `MembershipTable`, `InviteMemberDialog`, `MembershipDrawer` | Invite, change role, suspend/remove | Protect last owner; reauthenticate sensitive change |
| Roles and permissions | `RoleTable`, `PermissionMatrix`, `RoleDrawer` | Create/edit/compare/assign | Server capability model authoritative |
| Policy configuration | `PolicyVersionTable`, `RuleEditor`, `EffectiveDatePanel` | Draft, validate, approve, activate | Maker-checker and version history |
| Notifications | `NotificationPreferences`, `ChannelStatus` | Configure channels/digests | Required notices protected |
| Audit | `AuditTable`, `AuditDetail`, `AuditExport` | Filter, inspect, authorized export | Immutable and restricted |
| Security | Link to `/settings/security` | Manage password and sessions | Reauthentication/session revocation |

### 11.5 Platform administration — `/platform` — Restricted

| Sub-module | Components | User interactions | Safety and edge behavior |
|---|---|---|---|
| Tenant operations | `TenantTable`, `TenantDetail`, `ProvisioningStatus` | Inspect, provision, controlled suspend | Platform-admin only and audited |
| System health | `ServiceStatusGrid`, `QueueHealth`, `FailureDetail` | Inspect and open runbook | No log/secret leakage |
| Jobs | `JobTable`, `JobDetail`, `RetryJobAction` | Inspect and retry eligible job | Idempotency and retry limits |
| Feature flags | `FlagTable`, `FlagEditor`, `AudiencePreview` | Preview and change rollout | Environment/tenant explicit |
| Access reviews | `AccessReviewTable`, `ReviewDecisionPanel` | Review privileged access | Separation of duties and evidence retention |

---

## 12. Responsive behavior by component pattern

| Pattern | Desktop | Tablet | Mobile |
|---|---|---|---|
| KPI strip | 3–6-card grid | 2–3 columns | 1–2 columns; scroll only for direct comparison |
| Filter bar | Inline + saved view | Two-row wrap | Search + Filter sheet |
| Data table | Full, sticky header | Hide optional columns | Priority row cards or horizontal table scroll |
| Detail drawer | 440–520px | Approximately 70vw | Full-screen sheet/page |
| Kanban/board | Multi-column | Horizontal scroll | One status column with selector |
| Charts | Paired where meaningful | Single/paired | Single column with summary first |
| Forms | Two columns for related short fields | Mostly one column | One column + sticky submit footer |
| Context tabs | Tabs + overflow | Scrollable tabs | Scrollable tabs or labelled select |
| Wizard | Centered step panel | Wide sheet | Full screen with Back/Next footer |

---

## 13. Beautiful interaction and motion language

The experience should feel polished through consistency, not decoration.

| Interaction | Visual response | Duration |
|---|---|---:|
| Button hover | Subtle tone change; no scale/glow | 120ms |
| Card hover when clickable | 1px lift + stronger border | 120ms |
| Selected navigation | Soft teal surface + 3px indicator | 140ms |
| Drawer open | Fade + 12px horizontal settle | 180ms |
| Dialog open | Fade + 6px vertical settle | 160ms |
| Tab change | Content crossfade | 140ms |
| Success | Inline confirmation/check; no confetti | 160ms |
| Skeleton to content | Crossfade with stable dimensions | 140ms |

Rules:

- No spring bounce for routine navigation.
- No animated gradients, scan effects or cursor-follow glow.
- No movement for non-interactive cards.
- Never delay task completion for animation.
- Reduced motion removes translation and shortens fades to near instant.

---

## 14. Content and edge-case specification

### Content limits

| Content | Limit/behavior |
|---|---|
| Module title | 42 characters before design review |
| Module description | 110 characters, maximum three lines |
| Tab label | Prefer under 24 characters; overflow menu after available width |
| Table primary text | One line with accessible full-text tooltip where safe |
| Drawer title | Two lines maximum |
| Button label | Verb + object; usually under 24 characters |
| Empty-state title | Under 60 characters |
| Error message | Plain-language cause + next action + request ID when useful |

### Required states for every data component

- Loading with stable dimensions.
- Valid data.
- Valid zero.
- No records exist.
- No results for current filters.
- Missing/insufficient history.
- Source unavailable.
- Partial data.
- Stale/cached data.
- Access restricted.
- Recoverable error.
- Non-recoverable error with support/request ID.

### International and dense-data behavior

- Allow labels at least 30% longer than English baseline.
- Use locale-aware currency, number and date formatting.
- Display time zone on deadlines and cross-location events.
- Numeric table columns use tabular numerals and right alignment.
- Large tables paginate or virtualize; never render thousands of rows at once.
- Charts provide summaries and accessible table alternatives.

---

## 15. Accessibility interaction checklist

- [ ] Logical page heading hierarchy.
- [ ] Skip link to main content.
- [ ] Visible focus in light and dark themes.
- [ ] Minimum 40×40px control target; 44×44px mobile primary controls.
- [ ] Icon-only controls have accessible names.
- [ ] Dialogs trap and restore focus.
- [ ] Drawers announce title and state.
- [ ] Async status uses appropriate live regions.
- [ ] Tables expose caption, headers and sort state.
- [ ] Charts include textual summary and data alternative.
- [ ] Color is never the only status/series cue.
- [ ] Drag interactions have keyboard/button alternatives.
- [ ] Reduced-motion preference honored.
- [ ] 200% zoom does not hide essential controls.

---

## 16. Module-level definition of done

A module is complete only when all applicable items pass:

- [ ] Canonical route and navigation-catalogue entry.
- [ ] Permission-filtered discovery and server authorization.
- [ ] Page header, contextual sub-navigation and responsive layout.
- [ ] Every required loading/empty/error/partial/restricted state.
- [ ] Primary list/detail interaction with focus restoration.
- [ ] Real create/edit/approval services; no fake client completion.
- [ ] Server validation, version conflict and audit behavior.
- [ ] Responsive table, drawer, form and chart behavior.
- [ ] Keyboard and screen-reader operation.
- [ ] Data reconciliation and business-owner approval.
- [ ] Unit, service, API and E2E coverage proportional to risk.
- [ ] Analytics events contain no sensitive payloads.
- [ ] Documentation, support guidance and feature flag/rollback where needed.

---

## 17. Build checklist by workstream

### Design system

- [ ] Bundle Montserrat and Lato.
- [ ] Implement professional light/dark tokens.
- [ ] Remove hard-coded neon colors and cyber effects.
- [ ] Update shared controls and every interactive state.
- [ ] Validate contrast and visual regression.

### Navigation and shell

- [ ] Canonical navigation catalogue.
- [ ] Dual-pane desktop launcher.
- [ ] Two-step mobile launcher.
- [ ] Module/global search integration.
- [ ] Full-width dashboard shell.
- [ ] Compact operational-module rail.
- [ ] Contextual tabs and overflow.
- [ ] On-demand intelligence drawer.
- [ ] Keyboard, focus and responsive tests.

### Module migration

- [ ] Apply shared page anatomy to each existing route.
- [ ] Map existing functions to approved sub-modules.
- [ ] Build missing shared components once.
- [ ] Preserve current services and route contracts.
- [ ] Add missing states, authorization and audit behavior.
- [ ] Do not expose future destinations prematurely.

### Dashboard delivery

- [ ] Shared cockpit framework.
- [ ] S8 Employee Home.
- [ ] S7 Manager Cockpit.
- [ ] S2 HR Operations.
- [ ] S5 Payroll Control Room.
- [ ] S1 People Command Centre.
- [ ] S3, S4, S6, S9 and S10 after data/product approval.

### Governance and release

- [ ] Product approves module/sub-module taxonomy.
- [ ] Design approves responsive states.
- [ ] Data owners approve definitions.
- [ ] Security/privacy approves scopes.
- [ ] Payroll/legal approves regulated logic.
- [ ] QA completes permission, tenancy, accessibility and responsive matrices.
- [ ] Pilot tenant reconciles values.
- [ ] Feature flags and rollback documented.

---

## 18. Final outcome

When this blueprint is implemented, users will see one polished B2B system rather than a collection of separate tools: navigation will be fast and predictable, each module will share the same interaction language, every sub-module will expose the correct components and states, dashboards will lead naturally into operational work, and sensitive actions will remain secure, explainable and auditable.
