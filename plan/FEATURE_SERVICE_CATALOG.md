# Feature-to-service implementation catalog

Generated from current navigation, form metadata, widget definitions and App Router files. Reproduce with `node scripts/generate-service-plan.mjs`. All service contracts below are proposed unless explicitly marked as existing source metadata. Common authorization, errors, transactions and acceptance gates are mandatory from SERVICE_CONTRACTS.md. No item is marked live merely because a handler exists.

## Navigation features

### s1 — S1: People Command Centre

- Source: `src/data/ui/navigation.catalog.json` → dashboard / EXECUTIVE & OPERATIONAL CONSOLES. Current target: `dashboard`.
- User outcome: Executive leadership KPIs, headcount forecast & org health radar.
- Proposed service owner: `dashboard`. Read use case: scoped dashboard projection; return filter scope, cursor and freshness.
- Permission contract: `dashboard.s1.read`; each mutation has a separate `dashboard.s1.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: readConsole, queryWidget, saveLayout, resetLayout. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: dashboard domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `s2`, `s3`, `s4`, `s5`, `s6`, `s7`, `s8`, `s9`, `s10`, `analytics_exec`, `analytics_copilot`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### s2 — S2: HR Operations Console

- Source: `src/data/ui/navigation.catalog.json` → dashboard / EXECUTIVE & OPERATIONAL CONSOLES. Current target: `dashboard`.
- User outcome: SLA approval queue, onboarding pipeline & absence heatmap.
- Proposed service owner: `dashboard`. Read use case: scoped dashboard projection; return filter scope, cursor and freshness.
- Permission contract: `dashboard.s2.read`; each mutation has a separate `dashboard.s2.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: readConsole, queryWidget, saveLayout, resetLayout. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: dashboard domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `s1`, `s3`, `s4`, `s5`, `s6`, `s7`, `s8`, `s9`, `s10`, `analytics_exec`, `analytics_copilot`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### s3 — S3: Attendance & Shifts

- Source: `src/data/ui/navigation.catalog.json` → dashboard / EXECUTIVE & OPERATIONAL CONSOLES. Current target: `dashboard`.
- User outcome: Punches, shift roster strip with gaps & paired-punch AI.
- Proposed service owner: `dashboard`. Read use case: scoped dashboard projection; return filter scope, cursor and freshness.
- Permission contract: `dashboard.s3.read`; each mutation has a separate `dashboard.s3.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: readConsole, queryWidget, saveLayout, resetLayout. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: dashboard domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `s1`, `s2`, `s4`, `s5`, `s6`, `s7`, `s8`, `s9`, `s10`, `analytics_exec`, `analytics_copilot`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### s4 — S4: Talent Acquisition

- Source: `src/data/ui/navigation.catalog.json` → dashboard / EXECUTIVE & OPERATIONAL CONSOLES. Current target: `dashboard`.
- User outcome: Hiring funnel, aged reqs with blockers & candidate AI match.
- Proposed service owner: `dashboard`. Read use case: scoped dashboard projection; return filter scope, cursor and freshness.
- Permission contract: `dashboard.s4.read`; each mutation has a separate `dashboard.s4.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: readConsole, queryWidget, saveLayout, resetLayout. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: dashboard domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `s1`, `s2`, `s3`, `s5`, `s6`, `s7`, `s8`, `s9`, `s10`, `analytics_exec`, `analytics_copilot`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### s5 — S5: Payroll Control Room

- Source: `src/data/ui/navigation.catalog.json` → dashboard / EXECUTIVE & OPERATIONAL CONSOLES. Current target: `dashboard`.
- User outcome: 8-stage cycle stepper, cost bridge & blocking exceptions.
- Proposed service owner: `dashboard`. Read use case: scoped dashboard projection; return filter scope, cursor and freshness.
- Permission contract: `dashboard.s5.read`; each mutation has a separate `dashboard.s5.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: readConsole, queryWidget, saveLayout, resetLayout. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: dashboard domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `s1`, `s2`, `s3`, `s4`, `s6`, `s7`, `s8`, `s9`, `s10`, `analytics_exec`, `analytics_copilot`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### s6 — S6: Performance & Talent

- Source: `src/data/ui/navigation.catalog.json` → dashboard / EXECUTIVE & OPERATIONAL CONSOLES. Current target: `dashboard`.
- User outcome: 9-Box talent grid, calibration bias flags & succession.
- Proposed service owner: `dashboard`. Read use case: scoped dashboard projection; return filter scope, cursor and freshness.
- Permission contract: `dashboard.s6.read`; each mutation has a separate `dashboard.s6.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: readConsole, queryWidget, saveLayout, resetLayout. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: dashboard domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `s1`, `s2`, `s3`, `s4`, `s5`, `s7`, `s8`, `s9`, `s10`, `analytics_exec`, `analytics_copilot`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### s7 — S7: Manager Cockpit

- Source: `src/data/ui/navigation.catalog.json` → dashboard / EXECUTIVE & OPERATIONAL CONSOLES. Current target: `dashboard`.
- User outcome: 3-item weekly brief, 1-click approvals & team signals.
- Proposed service owner: `dashboard`. Read use case: scoped dashboard projection; return filter scope, cursor and freshness.
- Permission contract: `dashboard.s7.read`; each mutation has a separate `dashboard.s7.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: readConsole, queryWidget, saveLayout, resetLayout. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: dashboard domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `s1`, `s2`, `s3`, `s4`, `s5`, `s6`, `s8`, `s9`, `s10`, `analytics_exec`, `analytics_copilot`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### s8 — S8: Employee Home

- Source: `src/data/ui/navigation.catalog.json` → dashboard / EXECUTIVE & OPERATIONAL CONSOLES. Current target: `dashboard`.
- User outcome: Shift clock ring, leave balances, net pay preview & AI policy.
- Proposed service owner: `dashboard`. Read use case: scoped dashboard projection; return filter scope, cursor and freshness.
- Permission contract: `dashboard.s8.read`; each mutation has a separate `dashboard.s8.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: readConsole, queryWidget, saveLayout, resetLayout. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: dashboard domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `s1`, `s2`, `s3`, `s4`, `s5`, `s6`, `s7`, `s9`, `s10`, `analytics_exec`, `analytics_copilot`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### s9 — S9: Magnetix Capability

- Source: `src/data/ui/navigation.catalog.json` → dashboard / EXECUTIVE & OPERATIONAL CONSOLES. Current target: `dashboard`.
- User outcome: NCI index, skill coverage matrix & business signal proof.
- Proposed service owner: `dashboard`. Read use case: scoped dashboard projection; return filter scope, cursor and freshness.
- Permission contract: `dashboard.s9.read`; each mutation has a separate `dashboard.s9.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: readConsole, queryWidget, saveLayout, resetLayout. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: dashboard domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `s1`, `s2`, `s3`, `s4`, `s5`, `s6`, `s7`, `s8`, `s10`, `analytics_exec`, `analytics_copilot`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### s10 — S10: Workspace Governance

- Source: `src/data/ui/navigation.catalog.json` → dashboard / EXECUTIVE & OPERATIONAL CONSOLES. Current target: `dashboard`.
- User outcome: Workspace settings, role access and integration previews.
- Proposed service owner: `dashboard`. Read use case: scoped dashboard projection; return filter scope, cursor and freshness.
- Permission contract: `dashboard.s10.read`; each mutation has a separate `dashboard.s10.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: readConsole, queryWidget, saveLayout, resetLayout. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: dashboard domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `s1`, `s2`, `s3`, `s4`, `s5`, `s6`, `s7`, `s8`, `s9`, `analytics_exec`, `analytics_copilot`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### core_people — People Core

- Source: `src/data/ui/navigation.catalog.json` → core_hr / FOUNDATION & LIFECYCLE. Current target: `people_core`.
- User outcome: Central employee directory, personal details & digital profiles.
- Proposed service owner: `organization`. Read use case: scoped people_core projection; return filter scope, cursor and freshness.
- Permission contract: `organization.core_people.read`; each mutation has a separate `organization.core_people.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: createEmployment, changeAssignment, approvePosition, transferEmployee. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: organization domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### core_attendance — Smart Attendance

- Source: `src/data/ui/navigation.catalog.json` → core_hr / FOUNDATION & LIFECYCLE. Current target: `attendance`.
- User outcome: Real-time clock-in/out, biometric turnstile sync & overtime.
- Proposed service owner: `attendance`. Read use case: scoped attendance projection; return filter scope, cursor and freshness.
- Permission contract: `attendance.core_attendance.read`; each mutation has a separate `attendance.core_attendance.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: recordPunch, assignRoster, submitGatePass, approveOvertime, resolveException, recomputeDay. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: attendance domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `ops_rosters`, `ops_field`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### core_leaves — Leave Management

- Source: `src/data/ui/navigation.catalog.json` → core_hr / FOUNDATION & LIFECYCLE. Current target: `leaves`.
- User outcome: Leave policies, rollover accrual & approval matrices.
- Proposed service owner: `leave`. Read use case: scoped leaves projection; return filter scope, cursor and freshness.
- Permission contract: `leave.core_leaves.read`; each mutation has a separate `leave.core_leaves.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: applyLeave, decideLeave, cancelLeave, reconcileEarlyReturn, publishLeavePolicy. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: leave domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### core_onboarding — Onboarding & Lifecycle

- Source: `src/data/ui/navigation.catalog.json` → core_hr / FOUNDATION & LIFECYCLE. Current target: `onboarding`.
- User outcome: New hire onboarding workflows, document checklist & exits.
- Proposed service owner: `lifecycle`. Read use case: scoped onboarding projection; return filter scope, cursor and freshness.
- Permission contract: `lifecycle.core_onboarding.read`; each mutation has a separate `lifecycle.core_onboarding.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: startJoining, completeTask, confirmProbation, initiateExit, clearAsset, issueLetter. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: lifecycle domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `payroll_fnf`, `ops_assets`, `platform_workflows`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### core_org — Organization Management

- Source: `src/data/ui/navigation.catalog.json` → core_hr / ORGANIZATION & GOVERNANCE. Current target: `team`.
- User outcome: Departments, designations, reporting lines & visual org chart.
- Proposed service owner: `organization`. Read use case: scoped team projection; return filter scope, cursor and freshness.
- Permission contract: `organization.core_org.read`; each mutation has a separate `organization.core_org.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: createEmployment, changeAssignment, approvePosition, transferEmployee. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: organization domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### core_workforce — Workforce Management

- Source: `src/data/ui/navigation.catalog.json` → core_hr / ORGANIZATION & GOVERNANCE. Current target: `contract_workforce`.
- User outcome: Worker classification, contractor pools & staffing.
- Proposed service owner: `contractors`. Read use case: scoped contract_workforce projection; return filter scope, cursor and freshness.
- Permission contract: `contractors.core_workforce.read`; each mutation has a separate `contractors.core_workforce.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: registerVendor, assignWorker, submitVendorAttendance, reconcileInvoice. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: contractors domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `ops_contract`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### core_operations — HR Operations & Helpdesk

- Source: `src/data/ui/navigation.catalog.json` → core_hr / ORGANIZATION & GOVERNANCE. Current target: `helpdesk`.
- User outcome: Employee service desk, query resolution & letters.
- Proposed service owner: `ops`. Read use case: scoped helpdesk projection; return filter scope, cursor and freshness.
- Permission contract: `ops.core_operations.read`; each mutation has a separate `ops.core_operations.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: createTask, logTime, approveTimesheet, submitExpense, resolveTicket. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: ops domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### core_compliance — Statutory Compliance

- Source: `src/data/ui/navigation.catalog.json` → core_hr / ORGANIZATION & GOVERNANCE. Current target: `compliance`.
- User outcome: 2026 Labour Codes simulator, 50% wage floor & PF/ESI.
- Proposed service owner: `compliance`. Read use case: scoped compliance projection; return filter scope, cursor and freshness.
- Permission contract: `compliance.core_compliance.read`; each mutation has a separate `compliance.core_compliance.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: publishRulePack, validateGoldenCases, submitDeclaration, fileObligation, recordAccident. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: compliance domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `payroll_tax`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### access_scope — Access scope administration

- Source: `src/data/ui/navigation.catalog.json` → core_hr / People & lifecycle. Current target: `access_scope`.
- User outcome: Manage access scope administration with a scoped work queue, record history and controlled actions..
- Proposed service owner: `platform`. Read use case: scoped access_scope projection; return filter scope, cursor and freshness.
- Permission contract: `platform.access_scope.read`; each mutation has a separate `platform.access_scope.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-005 / access_scope** below.
- Data ownership: platform domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### person_record — Employee record

- Source: `src/data/ui/navigation.catalog.json` → core_hr / People & lifecycle. Current target: `person_record`.
- User outcome: Manage employee record with a scoped work queue, record history and controlled actions..
- Proposed service owner: `organization`. Read use case: scoped person_record projection; return filter scope, cursor and freshness.
- Permission contract: `organization.person_record.read`; each mutation has a separate `organization.person_record.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-010 / person_record** below.
- Data ownership: organization domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### assignment_admin — Assignment and policy attributes

- Source: `src/data/ui/navigation.catalog.json` → core_hr / People & lifecycle. Current target: `assignment_admin`.
- User outcome: Manage assignment and policy attributes with a scoped work queue, record history and controlled actions..
- Proposed service owner: `organization`. Read use case: scoped assignment_admin projection; return filter scope, cursor and freshness.
- Permission contract: `organization.assignment_admin.read`; each mutation has a separate `organization.assignment_admin.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-011 / assignment_admin** below.
- Data ownership: organization domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### position_register — Position register

- Source: `src/data/ui/navigation.catalog.json` → core_hr / People & lifecycle. Current target: `position_register`.
- User outcome: Manage position register with a scoped work queue, record history and controlled actions..
- Proposed service owner: `organization`. Read use case: scoped position_register projection; return filter scope, cursor and freshness.
- Permission contract: `organization.position_register.read`; each mutation has a separate `organization.position_register.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-012 / position_register** below.
- Data ownership: organization domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### sanctioned_strength — Sanctioned strength board

- Source: `src/data/ui/navigation.catalog.json` → core_hr / People & lifecycle. Current target: `sanctioned_strength`.
- User outcome: Manage sanctioned strength board with a scoped work queue, record history and controlled actions..
- Proposed service owner: `organization`. Read use case: scoped sanctioned_strength projection; return filter scope, cursor and freshness.
- Permission contract: `organization.sanctioned_strength.read`; each mutation has a separate `organization.sanctioned_strength.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-013 / sanctioned_strength** below.
- Data ownership: organization domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### document_vault — Document vault

- Source: `src/data/ui/navigation.catalog.json` → core_hr / People & lifecycle. Current target: `document_vault`.
- User outcome: Manage document vault with a scoped work queue, record history and controlled actions..
- Proposed service owner: `documents`. Read use case: scoped document_vault projection; return filter scope, cursor and freshness.
- Permission contract: `documents.document_vault.read`; each mutation has a separate `documents.document_vault.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-014 / document_vault** below.
- Data ownership: documents domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### joining_chain — Joining chain console

- Source: `src/data/ui/navigation.catalog.json` → core_hr / People & lifecycle. Current target: `joining_chain`.
- User outcome: Manage joining chain console with a scoped work queue, record history and controlled actions..
- Proposed service owner: `lifecycle`. Read use case: scoped joining_chain projection; return filter scope, cursor and freshness.
- Permission contract: `lifecycle.joining_chain.read`; each mutation has a separate `lifecycle.joining_chain.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-060 / joining_chain** below.
- Data ownership: lifecycle domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### clearance_board — Clearance board

- Source: `src/data/ui/navigation.catalog.json` → core_hr / People & lifecycle. Current target: `clearance_board`.
- User outcome: Manage clearance board with a scoped work queue, record history and controlled actions..
- Proposed service owner: `lifecycle`. Read use case: scoped clearance_board projection; return filter scope, cursor and freshness.
- Permission contract: `lifecycle.clearance_board.read`; each mutation has a separate `lifecycle.clearance_board.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-061 / clearance_board** below.
- Data ownership: lifecycle domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### asset_register — Asset register

- Source: `src/data/ui/navigation.catalog.json` → core_hr / People & lifecycle. Current target: `asset_register`.
- User outcome: Manage asset register with a scoped work queue, record history and controlled actions..
- Proposed service owner: `lifecycle`. Read use case: scoped asset_register projection; return filter scope, cursor and freshness.
- Permission contract: `lifecycle.asset_register.read`; each mutation has a separate `lifecycle.asset_register.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-064 / asset_register** below.
- Data ownership: lifecycle domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### letters_register — Letters and issue register

- Source: `src/data/ui/navigation.catalog.json` → core_hr / People & lifecycle. Current target: `letters_register`.
- User outcome: Manage letters and issue register with a scoped work queue, record history and controlled actions..
- Proposed service owner: `lifecycle`. Read use case: scoped letters_register projection; return filter scope, cursor and freshness.
- Permission contract: `lifecycle.letters_register.read`; each mutation has a separate `lifecycle.letters_register.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-067 / letters_register** below.
- Data ownership: lifecycle domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### policy_acknowledgements — Policy acknowledgements

- Source: `src/data/ui/navigation.catalog.json` → core_hr / People & lifecycle. Current target: `policy_acknowledgements`.
- User outcome: Manage policy acknowledgements with a scoped work queue, record history and controlled actions..
- Proposed service owner: `documents`. Read use case: scoped policy_acknowledgements projection; return filter scope, cursor and freshness.
- Permission contract: `documents.policy_acknowledgements.read`; each mutation has a separate `documents.policy_acknowledgements.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-062 / policy_acknowledgements** below.
- Data ownership: documents domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### employee_home — Employee home actions

- Source: `src/data/ui/navigation.catalog.json` → core_hr / People & lifecycle. Current target: `employee_home`.
- User outcome: Manage employee home actions with a scoped work queue, record history and controlled actions..
- Proposed service owner: `dashboard`. Read use case: scoped employee_home projection; return filter scope, cursor and freshness.
- Permission contract: `dashboard.employee_home.read`; each mutation has a separate `dashboard.employee_home.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-042 / employee_home** below.
- Data ownership: dashboard domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### check_in_out — Check in and check out

- Source: `src/data/ui/navigation.catalog.json` → core_hr / Attendance operations. Current target: `check_in_out`.
- User outcome: Manage check in and check out with a scoped work queue, record history and controlled actions..
- Proposed service owner: `attendance`. Read use case: scoped check_in_out projection; return filter scope, cursor and freshness.
- Permission contract: `attendance.check_in_out.read`; each mutation has a separate `attendance.check_in_out.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-020 / check_in_out** below.
- Data ownership: attendance domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### my_attendance — My attendance history

- Source: `src/data/ui/navigation.catalog.json` → core_hr / Attendance operations. Current target: `my_attendance`.
- User outcome: Manage my attendance history with a scoped work queue, record history and controlled actions..
- Proposed service owner: `attendance`. Read use case: scoped my_attendance projection; return filter scope, cursor and freshness.
- Permission contract: `attendance.my_attendance.read`; each mutation has a separate `attendance.my_attendance.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-021 / my_attendance** below.
- Data ownership: attendance domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### attendance_detail — Attendance day detail

- Source: `src/data/ui/navigation.catalog.json` → core_hr / Attendance operations. Current target: `attendance_detail`.
- User outcome: Manage attendance day detail with a scoped work queue, record history and controlled actions..
- Proposed service owner: `attendance`. Read use case: scoped attendance_detail projection; return filter scope, cursor and freshness.
- Permission contract: `attendance.attendance_detail.read`; each mutation has a separate `attendance.attendance_detail.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-022 / attendance_detail** below.
- Data ownership: attendance domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### gate_passes — Gate pass register

- Source: `src/data/ui/navigation.catalog.json` → core_hr / Attendance operations. Current target: `gate_passes`.
- User outcome: Manage gate pass register with a scoped work queue, record history and controlled actions..
- Proposed service owner: `attendance`. Read use case: scoped gate_passes projection; return filter scope, cursor and freshness.
- Permission contract: `attendance.gate_passes.read`; each mutation has a separate `attendance.gate_passes.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-023 / gate_passes** below.
- Data ownership: attendance domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### overtime_register — Overtime register

- Source: `src/data/ui/navigation.catalog.json` → core_hr / Attendance operations. Current target: `overtime_register`.
- User outcome: Manage overtime register with a scoped work queue, record history and controlled actions..
- Proposed service owner: `attendance`. Read use case: scoped overtime_register projection; return filter scope, cursor and freshness.
- Permission contract: `attendance.overtime_register.read`; each mutation has a separate `attendance.overtime_register.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-024 / overtime_register** below.
- Data ownership: attendance domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### attendance_exceptions — Attendance exception queue

- Source: `src/data/ui/navigation.catalog.json` → core_hr / Attendance operations. Current target: `attendance_exceptions`.
- User outcome: Manage attendance exception queue with a scoped work queue, record history and controlled actions..
- Proposed service owner: `attendance`. Read use case: scoped attendance_exceptions projection; return filter scope, cursor and freshness.
- Permission contract: `attendance.attendance_exceptions.read`; each mutation has a separate `attendance.attendance_exceptions.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-025 / attendance_exceptions** below.
- Data ownership: attendance domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### recompute_monitor — Attendance recompute monitor

- Source: `src/data/ui/navigation.catalog.json` → core_hr / Attendance operations. Current target: `recompute_monitor`.
- User outcome: Manage attendance recompute monitor with a scoped work queue, record history and controlled actions..
- Proposed service owner: `attendance`. Read use case: scoped recompute_monitor projection; return filter scope, cursor and freshness.
- Permission contract: `attendance.recompute_monitor.read`; each mutation has a separate `attendance.recompute_monitor.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-026 / recompute_monitor** below.
- Data ownership: attendance domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### team_history — Team history

- Source: `src/data/ui/navigation.catalog.json` → core_hr / Attendance operations. Current target: `team_history`.
- User outcome: Manage team history with a scoped work queue, record history and controlled actions..
- Proposed service owner: `attendance`. Read use case: scoped team_history projection; return filter scope, cursor and freshness.
- Permission contract: `attendance.team_history.read`; each mutation has a separate `attendance.team_history.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-027 / team_history** below.
- Data ownership: attendance domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### leave_requests — Leave requests

- Source: `src/data/ui/navigation.catalog.json` → core_hr / Leave operations. Current target: `leave_requests`.
- User outcome: Manage leave requests with a scoped work queue, record history and controlled actions..
- Proposed service owner: `leave`. Read use case: scoped leave_requests projection; return filter scope, cursor and freshness.
- Permission contract: `leave.leave_requests.read`; each mutation has a separate `leave.leave_requests.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-030 / leave_requests** below.
- Data ownership: leave domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### leave_ledger — Leave balance and ledger

- Source: `src/data/ui/navigation.catalog.json` → core_hr / Leave operations. Current target: `leave_ledger`.
- User outcome: Manage leave balance and ledger with a scoped work queue, record history and controlled actions..
- Proposed service owner: `leave`. Read use case: scoped leave_ledger projection; return filter scope, cursor and freshness.
- Permission contract: `leave.leave_ledger.read`; each mutation has a separate `leave.leave_ledger.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-031 / leave_ledger** below.
- Data ownership: leave domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### leave_policy_admin — Leave policy configuration

- Source: `src/data/ui/navigation.catalog.json` → core_hr / Leave operations. Current target: `leave_policy_admin`.
- User outcome: Manage leave policy configuration with a scoped work queue, record history and controlled actions..
- Proposed service owner: `leave`. Read use case: scoped leave_policy_admin projection; return filter scope, cursor and freshness.
- Permission contract: `leave.leave_policy_admin.read`; each mutation has a separate `leave.leave_policy_admin.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-032 / leave_policy_admin** below.
- Data ownership: leave domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### talent_ats — Talent ATS

- Source: `src/data/ui/navigation.catalog.json` → talent / ACQUISITION & PERFORMANCE. Current target: `recruitment`.
- User outcome: Requisitions, candidate pipeline & scorecards.
- Proposed service owner: `talent`. Read use case: scoped recruitment projection; return filter scope, cursor and freshness.
- Permission contract: `talent.talent_ats.read`; each mutation has a separate `talent.talent_ats.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: approveRequisition, submitReferral, advanceApplication, decideOffer, convertHire. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: talent domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `talent_mobility`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### talent_performance — Performance & OKRs

- Source: `src/data/ui/navigation.catalog.json` → talent / ACQUISITION & PERFORMANCE. Current target: `performance`.
- User outcome: Goals cascade, quarterly appraisals & 360 reviews.
- Proposed service owner: `performance`. Read use case: scoped performance projection; return filter scope, cursor and freshness.
- Permission contract: `performance.talent_performance.read`; each mutation has a separate `performance.talent_performance.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: publishCycle, submitGoal, submitReview, calibrateRating, finalizeCycle. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: performance domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `talent_succession`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### talent_learning — Learning & L&D

- Source: `src/data/ui/navigation.catalog.json` → talent / ACQUISITION & PERFORMANCE. Current target: `learning`.
- User outcome: Course catalog, mandatory tracks & certifications.
- Proposed service owner: `learning`. Read use case: scoped learning projection; return filter scope, cursor and freshness.
- Permission contract: `learning.talent_learning.read`; each mutation has a separate `learning.talent_learning.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: publishPath, enrollLearner, recordCompletion. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: learning domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### talent_skills — Skills & Capability

- Source: `src/data/ui/navigation.catalog.json` → talent / ACQUISITION & PERFORMANCE. Current target: `experience`.
- User outcome: Nucleus capability index & skill gap radar.
- Proposed service owner: `skills`. Read use case: scoped experience projection; return filter scope, cursor and freshness.
- Permission contract: `skills.talent_skills.read`; each mutation has a separate `skills.talent_skills.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: assessSkill, approveEvidence, updateTaxonomy. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: skills domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `talent_recognition`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### talent_succession — Succession Planning

- Source: `src/data/ui/navigation.catalog.json` → talent / GROWTH & RECOGNITION. Current target: `performance`.
- User outcome: 9-Box talent calibration & critical bench strength.
- Proposed service owner: `performance`. Read use case: scoped performance projection; return filter scope, cursor and freshness.
- Permission contract: `performance.talent_succession.read`; each mutation has a separate `performance.talent_succession.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: publishCycle, submitGoal, submitReview, calibrateRating, finalizeCycle. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: performance domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `talent_performance`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### talent_mobility — Internal Mobility (IJP)

- Source: `src/data/ui/navigation.catalog.json` → talent / GROWTH & RECOGNITION. Current target: `recruitment`.
- User outcome: Internal job postings & career path transitions.
- Proposed service owner: `talent`. Read use case: scoped recruitment projection; return filter scope, cursor and freshness.
- Permission contract: `talent.talent_mobility.read`; each mutation has a separate `talent.talent_mobility.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: approveRequisition, submitReferral, advanceApplication, decideOffer, convertHire. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: talent domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `talent_ats`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### talent_recognition — Recognition & Rewards

- Source: `src/data/ui/navigation.catalog.json` → talent / GROWTH & RECOGNITION. Current target: `experience`.
- User outcome: Peer appreciation badges & employee rewards ledger.
- Proposed service owner: `engagement`. Read use case: scoped experience projection; return filter scope, cursor and freshness.
- Permission contract: `engagement.talent_recognition.read`; each mutation has a separate `engagement.talent_recognition.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: nominateRecognition, approveAward, submitSurvey, assignWellbeingFollowup. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: engagement domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `talent_skills`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### requisitions — Recruitment requisitions

- Source: `src/data/ui/navigation.catalog.json` → talent / Talent & experience operations. Current target: `requisitions`.
- User outcome: Manage recruitment requisitions with a scoped work queue, record history and controlled actions..
- Proposed service owner: `talent`. Read use case: scoped requisitions projection; return filter scope, cursor and freshness.
- Permission contract: `talent.requisitions.read`; each mutation has a separate `talent.requisitions.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-090 / requisitions** below.
- Data ownership: talent domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### referrals — Referral tracking

- Source: `src/data/ui/navigation.catalog.json` → talent / Talent & experience operations. Current target: `referrals`.
- User outcome: Manage referral tracking with a scoped work queue, record history and controlled actions..
- Proposed service owner: `talent`. Read use case: scoped referrals projection; return filter scope, cursor and freshness.
- Permission contract: `talent.referrals.read`; each mutation has a separate `talent.referrals.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-091 / referrals** below.
- Data ownership: talent domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### learning_paths — My learning

- Source: `src/data/ui/navigation.catalog.json` → talent / Talent & experience operations. Current target: `learning_paths`.
- User outcome: Manage my learning with a scoped work queue, record history and controlled actions..
- Proposed service owner: `learning`. Read use case: scoped learning_paths projection; return filter scope, cursor and freshness.
- Permission contract: `learning.learning_paths.read`; each mutation has a separate `learning.learning_paths.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-063 / learning_paths** below.
- Data ownership: learning domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### recognition_register — Recognition register

- Source: `src/data/ui/navigation.catalog.json` → talent / Talent & experience operations. Current target: `recognition_register`.
- User outcome: Manage recognition register with a scoped work queue, record history and controlled actions..
- Proposed service owner: `engagement`. Read use case: scoped recognition_register projection; return filter scope, cursor and freshness.
- Permission contract: `engagement.recognition_register.read`; each mutation has a separate `engagement.recognition_register.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-065 / recognition_register** below.
- Data ownership: engagement domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### announcement_management — Announcements

- Source: `src/data/ui/navigation.catalog.json` → talent / Talent & experience operations. Current target: `announcement_management`.
- User outcome: Manage announcements with a scoped work queue, record history and controlled actions..
- Proposed service owner: `notifications`. Read use case: scoped announcement_management projection; return filter scope, cursor and freshness.
- Permission contract: `notifications.announcement_management.read`; each mutation has a separate `notifications.announcement_management.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-066 / announcement_management** below.
- Data ownership: notifications domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### payroll_global — Global Payroll

- Source: `src/data/ui/navigation.catalog.json` → payroll_finance / PAYROLL & COMPENSATION. Current target: `payroll`.
- User outcome: Gross-to-Net DAG calculation, pay cycles & bank files.
- Proposed service owner: `payroll`. Read use case: scoped payroll projection; return filter scope, cursor and freshness.
- Permission contract: `payroll.payroll_global.read`; each mutation has a separate `payroll.payroll_global.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: openRun, freezeInputs, calculateRun, resolveException, approveRun, lockRun, createCorrection. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: payroll domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `payroll_claims`, `payroll_ewa`, `payroll_accounting`, `ops_travel`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### payroll_comp — Compensation & Benefits

- Source: `src/data/ui/navigation.catalog.json` → payroll_finance / PAYROLL & COMPENSATION. Current target: `compensation`.
- User outcome: Salary banding, compa-ratio & benefits setup.
- Proposed service owner: `compensation`. Read use case: scoped compensation projection; return filter scope, cursor and freshness.
- Permission contract: `compensation.payroll_comp.read`; each mutation has a separate `compensation.payroll_comp.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: simulateSalary, proposeChange, approveChange, publishStructure. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: compensation domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### payroll_claims — Reimbursements & Claims

- Source: `src/data/ui/navigation.catalog.json` → payroll_finance / PAYROLL & COMPENSATION. Current target: `payroll`.
- User outcome: Employee expense reports, fuel claims & receipt OCR.
- Proposed service owner: `ops`. Read use case: scoped payroll projection; return filter scope, cursor and freshness.
- Permission contract: `ops.payroll_claims.read`; each mutation has a separate `ops.payroll_claims.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: createTask, logTime, approveTimesheet, submitExpense, resolveTicket. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: ops domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `payroll_global`, `payroll_ewa`, `payroll_accounting`, `ops_travel`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### payroll_ewa — Loans, Advances & EWA

- Source: `src/data/ui/navigation.catalog.json` → payroll_finance / PAYROLL & COMPENSATION. Current target: `payroll`.
- User outcome: Earned Wage Access liquidity & automated EMI deductions.
- Proposed service owner: `advances`. Read use case: scoped payroll projection; return filter scope, cursor and freshness.
- Permission contract: `advances.payroll_ewa.read`; each mutation has a separate `advances.payroll_ewa.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: requestAdvance, approveAdvance, reserveEarnedBalance. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: advances domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `payroll_global`, `payroll_claims`, `payroll_accounting`, `ops_travel`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### payroll_tax — Tax & Statutory

- Source: `src/data/ui/navigation.catalog.json` → payroll_finance / STATUTORY & ACCOUNTING. Current target: `compliance`.
- User outcome: PF ECR, ESIC challans, PT & TDS 24Q filing verification.
- Proposed service owner: `compliance`. Read use case: scoped compliance projection; return filter scope, cursor and freshness.
- Permission contract: `compliance.payroll_tax.read`; each mutation has a separate `compliance.payroll_tax.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: publishRulePack, validateGoldenCases, submitDeclaration, fileObligation, recordAccident. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: compliance domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `core_compliance`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### payroll_accounting — Payroll Accounting (GL)

- Source: `src/data/ui/navigation.catalog.json` → payroll_finance / STATUTORY & ACCOUNTING. Current target: `payroll`.
- User outcome: Balanced salary journal & ERP general ledger sync.
- Proposed service owner: `exports`. Read use case: scoped payroll projection; return filter scope, cursor and freshness.
- Permission contract: `exports.payroll_accounting.read`; each mutation has a separate `exports.payroll_accounting.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: generateJournal, generateBankInstruction, reconcileBankResponse. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: exports domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `payroll_global`, `payroll_claims`, `payroll_ewa`, `ops_travel`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### payroll_fnf — Full & Final Settlement

- Source: `src/data/ui/navigation.catalog.json` → payroll_finance / STATUTORY & ACCOUNTING. Current target: `onboarding`.
- User outcome: Exit recovery calculation, notice pay & gratuity DAG.
- Proposed service owner: `payroll`. Read use case: scoped onboarding projection; return filter scope, cursor and freshness.
- Permission contract: `payroll.payroll_fnf.read`; each mutation has a separate `payroll.payroll_fnf.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: openRun, freezeInputs, calculateRun, resolveException, approveRun, lockRun, createCorrection. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: payroll domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `core_onboarding`, `ops_assets`, `platform_workflows`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### payroll_runs — Payroll run cockpit

- Source: `src/data/ui/navigation.catalog.json` → payroll_finance / Payroll & finance operations. Current target: `payroll_runs`.
- User outcome: Manage payroll run cockpit with a scoped work queue, record history and controlled actions..
- Proposed service owner: `payroll`. Read use case: scoped payroll_runs projection; return filter scope, cursor and freshness.
- Permission contract: `payroll.payroll_runs.read`; each mutation has a separate `payroll.payroll_runs.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-050 / payroll_runs** below.
- Data ownership: payroll domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### pre_payroll_audit — Pre-payroll audit

- Source: `src/data/ui/navigation.catalog.json` → payroll_finance / Payroll & finance operations. Current target: `pre_payroll_audit`.
- User outcome: Manage pre-payroll audit with a scoped work queue, record history and controlled actions..
- Proposed service owner: `payroll`. Read use case: scoped pre_payroll_audit projection; return filter scope, cursor and freshness.
- Permission contract: `payroll.pre_payroll_audit.read`; each mutation has a separate `payroll.pre_payroll_audit.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-051 / pre_payroll_audit** below.
- Data ownership: payroll domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### salary_simulator — Salary structure simulator

- Source: `src/data/ui/navigation.catalog.json` → payroll_finance / Payroll & finance operations. Current target: `salary_simulator`.
- User outcome: Manage salary structure simulator with a scoped work queue, record history and controlled actions..
- Proposed service owner: `compensation`. Read use case: scoped salary_simulator projection; return filter scope, cursor and freshness.
- Permission contract: `compensation.salary_simulator.read`; each mutation has a separate `compensation.salary_simulator.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-052 / salary_simulator** below.
- Data ownership: compensation domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### payslips — Payslips

- Source: `src/data/ui/navigation.catalog.json` → payroll_finance / Payroll & finance operations. Current target: `payslips`.
- User outcome: Manage payslips with a scoped work queue, record history and controlled actions..
- Proposed service owner: `payroll`. Read use case: scoped payslips projection; return filter scope, cursor and freshness.
- Permission contract: `payroll.payslips.read`; each mutation has a separate `payroll.payslips.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-053 / payslips** below.
- Data ownership: payroll domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### tax_declarations — Tax declaration and projection

- Source: `src/data/ui/navigation.catalog.json` → payroll_finance / Payroll & finance operations. Current target: `tax_declarations`.
- User outcome: Manage tax declaration and projection with a scoped work queue, record history and controlled actions..
- Proposed service owner: `compliance`. Read use case: scoped tax_declarations projection; return filter scope, cursor and freshness.
- Permission contract: `compliance.tax_declarations.read`; each mutation has a separate `compliance.tax_declarations.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-054 / tax_declarations** below.
- Data ownership: compliance domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### bank_disbursement — Bank disbursement control

- Source: `src/data/ui/navigation.catalog.json` → payroll_finance / Payroll & finance operations. Current target: `bank_disbursement`.
- User outcome: Manage bank disbursement control with a scoped work queue, record history and controlled actions..
- Proposed service owner: `exports`. Read use case: scoped bank_disbursement projection; return filter scope, cursor and freshness.
- Permission contract: `exports.bank_disbursement.read`; each mutation has a separate `exports.bank_disbursement.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-055 / bank_disbursement** below.
- Data ownership: exports domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### full_and_final — Full and final settlement

- Source: `src/data/ui/navigation.catalog.json` → payroll_finance / Payroll & finance operations. Current target: `full_and_final`.
- User outcome: Manage full and final settlement with a scoped work queue, record history and controlled actions..
- Proposed service owner: `payroll`. Read use case: scoped full_and_final projection; return filter scope, cursor and freshness.
- Permission contract: `payroll.full_and_final.read`; each mutation has a separate `payroll.full_and_final.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-056 / full_and_final** below.
- Data ownership: payroll domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### gl_mapping — GL mapping and journal

- Source: `src/data/ui/navigation.catalog.json` → payroll_finance / Payroll & finance operations. Current target: `gl_mapping`.
- User outcome: Manage gl mapping and journal with a scoped work queue, record history and controlled actions..
- Proposed service owner: `exports`. Read use case: scoped gl_mapping projection; return filter scope, cursor and freshness.
- Permission contract: `exports.gl_mapping.read`; each mutation has a separate `exports.gl_mapping.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-102 / gl_mapping** below.
- Data ownership: exports domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### reconciliation — Payroll reconciliation

- Source: `src/data/ui/navigation.catalog.json` → payroll_finance / Payroll & finance operations. Current target: `reconciliation`.
- User outcome: Manage payroll reconciliation with a scoped work queue, record history and controlled actions..
- Proposed service owner: `exports`. Read use case: scoped reconciliation projection; return filter scope, cursor and freshness.
- Permission contract: `exports.reconciliation.read`; each mutation has a separate `exports.reconciliation.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-103 / reconciliation** below.
- Data ownership: exports domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### loans_advances — Loans and advances

- Source: `src/data/ui/navigation.catalog.json` → payroll_finance / Payroll & finance operations. Current target: `loans_advances`.
- User outcome: Manage loans and advances with a scoped work queue, record history and controlled actions..
- Proposed service owner: `loans`. Read use case: scoped loans_advances projection; return filter scope, cursor and freshness.
- Permission contract: `loans.loans_advances.read`; each mutation has a separate `loans.loans_advances.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-080 / loans_advances** below.
- Data ownership: loans domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### ops_rosters — Shift Planning & Rosters

- Source: `src/data/ui/navigation.catalog.json` → workforce_ops / SCHEDULING & WORKFORCE. Current target: `attendance`.
- User outcome: Multi-shift rotations & auto-roster assignments.
- Proposed service owner: `attendance`. Read use case: scoped attendance projection; return filter scope, cursor and freshness.
- Permission contract: `attendance.ops_rosters.read`; each mutation has a separate `attendance.ops_rosters.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: recordPunch, assignRoster, submitGatePass, approveOvertime, resolveException, recomputeDay. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: attendance domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `core_attendance`, `ops_field`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### ops_projects — Projects & Pod Allocation

- Source: `src/data/ui/navigation.catalog.json` → workforce_ops / SCHEDULING & WORKFORCE. Current target: `projects`.
- User outcome: Agile engineering pods & sprint velocities.
- Proposed service owner: `ops`. Read use case: scoped projects projection; return filter scope, cursor and freshness.
- Permission contract: `ops.ops_projects.read`; each mutation has a separate `ops.ops_projects.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: createTask, logTime, approveTimesheet, submitExpense, resolveTicket. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: ops domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `ops_timesheets`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### ops_field — Field Workforce

- Source: `src/data/ui/navigation.catalog.json` → workforce_ops / SCHEDULING & WORKFORCE. Current target: `attendance`.
- User outcome: Geo-fenced punches, route waypoints & field visits.
- Proposed service owner: `attendance`. Read use case: scoped attendance projection; return filter scope, cursor and freshness.
- Permission contract: `attendance.ops_field.read`; each mutation has a separate `attendance.ops_field.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: recordPunch, assignRoster, submitGatePass, approveOvertime, resolveException, recomputeDay. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: attendance domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `core_attendance`, `ops_rosters`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### ops_contract — Contract Workforce

- Source: `src/data/ui/navigation.catalog.json` → workforce_ops / SCHEDULING & WORKFORCE. Current target: `contract_workforce`.
- User outcome: Turnstile biometric vs vendor invoice reconciliation.
- Proposed service owner: `contractors`. Read use case: scoped contract_workforce projection; return filter scope, cursor and freshness.
- Permission contract: `contractors.ops_contract.read`; each mutation has a separate `contractors.ops_contract.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: registerVendor, assignWorker, submitVendorAttendance, reconcileInvoice. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: contractors domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `core_workforce`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### ops_assets — Assets & Gate Passes

- Source: `src/data/ui/navigation.catalog.json` → workforce_ops / OPERATIONS & ASSETS. Current target: `onboarding`.
- User outcome: IT equipment custody, serial logs & gate clearance.
- Proposed service owner: `lifecycle`. Read use case: scoped onboarding projection; return filter scope, cursor and freshness.
- Permission contract: `lifecycle.ops_assets.read`; each mutation has a separate `lifecycle.ops_assets.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: startJoining, completeTask, confirmProbation, initiateExit, clearAsset, issueLetter. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: lifecycle domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `core_onboarding`, `payroll_fnf`, `platform_workflows`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### ops_travel — Travel & Duty Management

- Source: `src/data/ui/navigation.catalog.json` → workforce_ops / OPERATIONS & ASSETS. Current target: `payroll`.
- User outcome: Travel requisitions, per diem rates & flight booking.
- Proposed service owner: `ops`. Read use case: scoped payroll projection; return filter scope, cursor and freshness.
- Permission contract: `ops.ops_travel.read`; each mutation has a separate `ops.ops_travel.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: createTask, logTime, approveTimesheet, submitExpense, resolveTicket. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: ops domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `payroll_global`, `payroll_claims`, `payroll_ewa`, `payroll_accounting`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### ops_timesheets — Timesheets & Productivity

- Source: `src/data/ui/navigation.catalog.json` → workforce_ops / OPERATIONS & ASSETS. Current target: `projects`.
- User outcome: Task timers, billable client hours & weekly review.
- Proposed service owner: `ops`. Read use case: scoped projects projection; return filter scope, cursor and freshness.
- Permission contract: `ops.ops_timesheets.read`; each mutation has a separate `ops.ops_timesheets.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: createTask, logTime, approveTimesheet, submitExpense, resolveTicket. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: ops domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `ops_projects`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### approval_inbox — Unified approval inbox

- Source: `src/data/ui/navigation.catalog.json` → workforce_ops / Workforce operations. Current target: `approval_inbox`.
- User outcome: Manage unified approval inbox with a scoped work queue, record history and controlled actions..
- Proposed service owner: `governance`. Read use case: scoped approval_inbox projection; return filter scope, cursor and freshness.
- Permission contract: `governance.approval_inbox.read`; each mutation has a separate `governance.approval_inbox.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-040 / approval_inbox** below.
- Data ownership: governance domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### contractor_reconciliation — Contractor engagement and invoice

- Source: `src/data/ui/navigation.catalog.json` → workforce_ops / Workforce operations. Current target: `contractor_reconciliation`.
- User outcome: Manage contractor engagement and invoice with a scoped work queue, record history and controlled actions..
- Proposed service owner: `contractors`. Read use case: scoped contractor_reconciliation projection; return filter scope, cursor and freshness.
- Permission contract: `contractors.contractor_reconciliation.read`; each mutation has a separate `contractors.contractor_reconciliation.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-095 / contractor_reconciliation** below.
- Data ownership: contractors domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### analytics_exec — Executive Dashboards

- Source: `src/data/ui/navigation.catalog.json` → analytics_ai / DASHBOARDS & INTELLIGENCE. Current target: `dashboard`.
- User outcome: Cross-domain executive KPI pulse & forecasts.
- Proposed service owner: `analytics`. Read use case: scoped dashboard projection; return filter scope, cursor and freshness.
- Permission contract: `analytics.analytics_exec.read`; each mutation has a separate `analytics.analytics_exec.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: queryMetric, publishReport, scheduleReport, rebuildProjection. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: analytics domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `s1`, `s2`, `s3`, `s4`, `s5`, `s6`, `s7`, `s8`, `s9`, `s10`, `analytics_copilot`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### analytics_people — People Intelligence

- Source: `src/data/ui/navigation.catalog.json` → analytics_ai / DASHBOARDS & INTELLIGENCE. Current target: `analytics`.
- User outcome: Demographic diversity ratios & attrition trends.
- Proposed service owner: `analytics`. Read use case: scoped analytics projection; return filter scope, cursor and freshness.
- Permission contract: `analytics.analytics_people.read`; each mutation has a separate `analytics.analytics_people.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: queryMetric, publishReport, scheduleReport, rebuildProjection. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: analytics domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `analytics_workforce`, `analytics_payroll`, `analytics_talent`, `analytics_custom`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### analytics_workforce — Workforce Analytics

- Source: `src/data/ui/navigation.catalog.json` → analytics_ai / DASHBOARDS & INTELLIGENCE. Current target: `analytics`.
- User outcome: Overtime heatmaps & shift utilization.
- Proposed service owner: `analytics`. Read use case: scoped analytics projection; return filter scope, cursor and freshness.
- Permission contract: `analytics.analytics_workforce.read`; each mutation has a separate `analytics.analytics_workforce.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: queryMetric, publishReport, scheduleReport, rebuildProjection. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: analytics domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `analytics_people`, `analytics_payroll`, `analytics_talent`, `analytics_custom`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### analytics_payroll — Payroll Analytics

- Source: `src/data/ui/navigation.catalog.json` → analytics_ai / DASHBOARDS & INTELLIGENCE. Current target: `analytics`.
- User outcome: Wage bill monthly bridge & statutory liabilities.
- Proposed service owner: `analytics`. Read use case: scoped analytics projection; return filter scope, cursor and freshness.
- Permission contract: `analytics.analytics_payroll.read`; each mutation has a separate `analytics.analytics_payroll.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: queryMetric, publishReport, scheduleReport, rebuildProjection. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: analytics domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `analytics_people`, `analytics_workforce`, `analytics_talent`, `analytics_custom`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### analytics_talent — Talent Analytics

- Source: `src/data/ui/navigation.catalog.json` → analytics_ai / DASHBOARDS & INTELLIGENCE. Current target: `analytics`.
- User outcome: Time-to-hire metrics & candidate funnel conversion.
- Proposed service owner: `analytics`. Read use case: scoped analytics projection; return filter scope, cursor and freshness.
- Permission contract: `analytics.analytics_talent.read`; each mutation has a separate `analytics.analytics_talent.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: queryMetric, publishReport, scheduleReport, rebuildProjection. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: analytics domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `analytics_people`, `analytics_workforce`, `analytics_payroll`, `analytics_custom`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### analytics_copilot — AI Copilot & Agents

- Source: `src/data/ui/navigation.catalog.json` → analytics_ai / AI & CUSTOM REPORTING. Current target: `dashboard`.
- User outcome: Autonomous reasoning agent & policy citations.
- Proposed service owner: `ai`. Read use case: scoped dashboard projection; return filter scope, cursor and freshness.
- Permission contract: `ai.analytics_copilot.read`; each mutation has a separate `ai.analytics_copilot.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: proposeAction, approveAction, executeApprovedAction, reverseAction, evaluateRun. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: ai domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `s1`, `s2`, `s3`, `s4`, `s5`, `s6`, `s7`, `s8`, `s9`, `s10`, `analytics_exec`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### analytics_custom — Custom Reports Builder

- Source: `src/data/ui/navigation.catalog.json` → analytics_ai / AI & CUSTOM REPORTING. Current target: `analytics`.
- User outcome: Dynamic query builder & CSV/PDF scheduler.
- Proposed service owner: `analytics`. Read use case: scoped analytics projection; return filter scope, cursor and freshness.
- Permission contract: `analytics.analytics_custom.read`; each mutation has a separate `analytics.analytics_custom.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: queryMetric, publishReport, scheduleReport, rebuildProjection. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: analytics domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `analytics_people`, `analytics_workforce`, `analytics_payroll`, `analytics_talent`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### assistant_helpdesk — Assistant and helpdesk

- Source: `src/data/ui/navigation.catalog.json` → analytics_ai / Intelligence operations. Current target: `assistant_helpdesk`.
- User outcome: Manage assistant and helpdesk with a scoped work queue, record history and controlled actions..
- Proposed service owner: `ai`. Read use case: scoped assistant_helpdesk projection; return filter scope, cursor and freshness.
- Permission contract: `ai.assistant_helpdesk.read`; each mutation has a separate `ai.assistant_helpdesk.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-041 / assistant_helpdesk** below.
- Data ownership: ai domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### agent_ledger — Agent console and action ledger

- Source: `src/data/ui/navigation.catalog.json` → analytics_ai / Intelligence operations. Current target: `agent_ledger`.
- User outcome: Manage agent console and action ledger with a scoped work queue, record history and controlled actions..
- Proposed service owner: `ai`. Read use case: scoped agent_ledger projection; return filter scope, cursor and freshness.
- Permission contract: `ai.agent_ledger.read`; each mutation has a separate `ai.agent_ledger.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-110 / agent_ledger** below.
- Data ownership: ai domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### operational_reports — Operational reports

- Source: `src/data/ui/navigation.catalog.json` → analytics_ai / Intelligence operations. Current target: `operational_reports`.
- User outcome: Manage operational reports with a scoped work queue, record history and controlled actions..
- Proposed service owner: `analytics`. Read use case: scoped operational_reports projection; return filter scope, cursor and freshness.
- Permission contract: `analytics.operational_reports.read`; each mutation has a separate `analytics.operational_reports.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-111 / operational_reports** below.
- Data ownership: analytics domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### platform_integrations — Integrations & API

- Source: `src/data/ui/navigation.catalog.json` → platform / INTEGRATIONS & AUTOMATION. Current target: `integrations`.
- User outcome: Enterprise ERP connectors, Slack webhooks & REST API.
- Proposed service owner: `integrations`. Read use case: scoped integrations projection; return filter scope, cursor and freshness.
- Permission contract: `integrations.platform_integrations.read`; each mutation has a separate `integrations.platform_integrations.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: configureConnector, validateMapping, startSync, retryEvent. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: integrations domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### platform_workflows — Workflow Automation Studio

- Source: `src/data/ui/navigation.catalog.json` → platform / INTEGRATIONS & AUTOMATION. Current target: `onboarding`.
- User outcome: Visual node flowchart studio & execution DAG.
- Proposed service owner: `governance`. Read use case: scoped onboarding projection; return filter scope, cursor and freshness.
- Permission contract: `governance.platform_workflows.read`; each mutation has a separate `governance.platform_workflows.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: publishWorkflow, decideApproval, delegateApproval, queryAudit. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: governance domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `core_onboarding`, `payroll_fnf`, `ops_assets`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### platform_roles — Access Control & RBAC Studio

- Source: `src/data/ui/navigation.catalog.json` → platform / INTEGRATIONS & AUTOMATION. Current target: `access_control`.
- User outcome: Per-user access configuration & organization-wide role matrix.
- Proposed service owner: `platform`. Read use case: scoped access_control projection; return filter scope, cursor and freshness.
- Permission contract: `platform.platform_roles.read`; each mutation has a separate `platform.platform_roles.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: inviteMember, changeGrant, revokeSession, enrollMfa. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: platform domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### platform_settings — Settings & Configuration

- Source: `src/data/ui/navigation.catalog.json` → platform / INTEGRATIONS & AUTOMATION. Current target: `settings`.
- User outcome: Legal entities, operating units & holiday calendars.
- Proposed service owner: `admin`. Read use case: scoped settings projection; return filter scope, cursor and freshness.
- Permission contract: `admin.platform_settings.read`; each mutation has a separate `admin.platform_settings.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: updateTenantSetting, publishConfiguration. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: admin domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `platform_security`, `platform_notifications`, `platform_audit`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### platform_security — Security Center

- Source: `src/data/ui/navigation.catalog.json` → platform / SECURITY & GOVERNANCE. Current target: `settings`.
- User outcome: Single Sign-On (SSO), MFA & zero-trust cloud IAM.
- Proposed service owner: `platform`. Read use case: scoped settings projection; return filter scope, cursor and freshness.
- Permission contract: `platform.platform_security.read`; each mutation has a separate `platform.platform_security.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: inviteMember, changeGrant, revokeSession, enrollMfa. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: platform domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `platform_settings`, `platform_notifications`, `platform_audit`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### platform_notifications — Notifications & Alerts

- Source: `src/data/ui/navigation.catalog.json` → platform / SECURITY & GOVERNANCE. Current target: `settings`.
- User outcome: Alert channels, email digest rules & SLA triggers.
- Proposed service owner: `notifications`. Read use case: scoped settings projection; return filter scope, cursor and freshness.
- Permission contract: `notifications.platform_notifications.read`; each mutation has a separate `notifications.platform_notifications.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: publishAnnouncement, enqueueDelivery, markRead, changePreference. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: notifications domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `platform_settings`, `platform_security`, `platform_audit`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### platform_audit — Immutable Audit Logs

- Source: `src/data/ui/navigation.catalog.json` → platform / SECURITY & GOVERNANCE. Current target: `settings`.
- User outcome: Cryptographically verifiable activity ledger.
- Proposed service owner: `governance`. Read use case: scoped settings projection; return filter scope, cursor and freshness.
- Permission contract: `governance.platform_audit.read`; each mutation has a separate `governance.platform_audit.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: publishWorkflow, decideApproval, delegateApproval, queryAudit. Expose only the intents relevant to this feature and its granted role; use the domain invariants in DOMAIN_SERVICES.md.
- Data ownership: governance domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Shared-target gap: also used by `platform_settings`, `platform_security`, `platform_notifications`. Verify a distinct subview/filter and business workflow for this feature; a shared landing view alone does not satisfy it.

### rule_pack_manager — Rule-pack manager

- Source: `src/data/ui/navigation.catalog.json` → platform / Compliance engineering. Current target: `rule_pack_manager`.
- User outcome: Manage rule-pack manager with a scoped work queue, record history and controlled actions..
- Proposed service owner: `compliance`. Read use case: scoped rule_pack_manager projection; return filter scope, cursor and freshness.
- Permission contract: `compliance.rule_pack_manager.read`; each mutation has a separate `compliance.rule_pack_manager.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-070 / rule_pack_manager** below.
- Data ownership: compliance domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### golden_case_library — Golden-case library

- Source: `src/data/ui/navigation.catalog.json` → platform / Compliance engineering. Current target: `golden_case_library`.
- User outcome: Manage golden-case library with a scoped work queue, record history and controlled actions..
- Proposed service owner: `compliance`. Read use case: scoped golden_case_library projection; return filter scope, cursor and freshness.
- Permission contract: `compliance.golden_case_library.read`; each mutation has a separate `compliance.golden_case_library.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-071 / golden_case_library** below.
- Data ownership: compliance domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### obligation_calendar — Obligation calendar

- Source: `src/data/ui/navigation.catalog.json` → platform / Compliance engineering. Current target: `obligation_calendar`.
- User outcome: Manage obligation calendar with a scoped work queue, record history and controlled actions..
- Proposed service owner: `compliance`. Read use case: scoped obligation_calendar projection; return filter scope, cursor and freshness.
- Permission contract: `compliance.obligation_calendar.read`; each mutation has a separate `compliance.obligation_calendar.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-072 / obligation_calendar** below.
- Data ownership: compliance domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### statutory_register — Statutory forms and registers

- Source: `src/data/ui/navigation.catalog.json` → platform / Compliance engineering. Current target: `statutory_register`.
- User outcome: Manage statutory forms and registers with a scoped work queue, record history and controlled actions..
- Proposed service owner: `compliance`. Read use case: scoped statutory_register projection; return filter scope, cursor and freshness.
- Permission contract: `compliance.statutory_register.read`; each mutation has a separate `compliance.statutory_register.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-073 / statutory_register** below.
- Data ownership: compliance domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### integration_config — Integration configuration

- Source: `src/data/ui/navigation.catalog.json` → platform / Integration operations. Current target: `integration_config`.
- User outcome: Manage integration configuration with a scoped work queue, record history and controlled actions..
- Proposed service owner: `integrations`. Read use case: scoped integration_config projection; return filter scope, cursor and freshness.
- Permission contract: `integrations.integration_config.read`; each mutation has a separate `integrations.integration_config.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-100 / integration_config** below.
- Data ownership: integrations domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

### sync_monitor — Integration sync monitor

- Source: `src/data/ui/navigation.catalog.json` → platform / Integration operations. Current target: `sync_monitor`.
- User outcome: Manage integration sync monitor with a scoped work queue, record history and controlled actions..
- Proposed service owner: `integrations`. Read use case: scoped sync_monitor projection; return filter scope, cursor and freshness.
- Permission contract: `integrations.sync_monitor.read`; each mutation has a separate `integrations.sync_monitor.<intent>` grant plus own/team/legal-entity scope. These keys must be seeded and reviewed before activation.
- Command specification: see operational contract **SCR-101 / sync_monitor** below.
- Data ownership: integrations domain records/projections listed in DOMAIN_SERVICES.md; other domains are read through ports or committed events.
- UI acceptance: permitted navigation opens this feature, scoped read matches its filter, empty/error/retry works, mobile has no lost primary action, and a server failure never displays success.
- Routing acceptance: retain a stable target and test deep-link/navigation restoration.

## Operational screen contracts

### SCR-005 / access_scope — Access scope administration

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **platform**. Declared read endpoint: `/api/v1/identity/memberships`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| principal | Principal | text | true | Validate domain type, length and referenced record scope |
| role | Role template | text | true | Validate domain type, length and referenced record scope |
| entity | Legal entity | text | true | Validate domain type, length and referenced record scope |
| location | Location scope | text | false | Validate domain type, length and referenced record scope |
| effectiveFrom | Effective from | date | true | Validate domain type, length and referenced record scope |

- Current action labels: **Grant scope**, **Revoke scope**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Active → Scheduled → Revoked. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the platform policy before implementation.
- Result projection: Principal, Scope, Status, Effective from plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce platform permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-010 / person_record — Employee record

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **organization**. Declared read endpoint: `/api/v1/people`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| employeeCode | Employee code | text | false | Validate domain type, length and referenced record scope |
| fullName | Full name | text | true | Validate domain type, length and referenced record scope |
| gender | Gender | text | true | Validate domain type, length and referenced record scope |
| dateOfBirth | Date of birth | date | true | Validate domain type, length and referenced record scope |
| mobile | Mobile | tel | true | Validate domain type, length and referenced record scope |
| personalEmail | Personal email | email | false | Validate domain type, length and referenced record scope |
| address | Present address | text | true | Validate domain type, length and referenced record scope |
| emergencyContact | Emergency contact | text | true | Validate domain type, length and referenced record scope |
| ifsc | IFSC | text | true | Validate domain type, length and referenced record scope |

- Current action labels: **Create employee**, **Request edit**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Active → On leave → Separated → Archived. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the organization policy before implementation.
- Result projection: Employee, Department, Assignment, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce organization permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-011 / assignment_admin — Assignment and policy attributes

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **organization**. Declared read endpoint: `/api/v1/organization/tree`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| position | Position | text | true | Validate domain type, length and referenced record scope |
| orgUnit | Organisation unit | text | true | Validate domain type, length and referenced record scope |
| designation | Designation | text | true | Validate domain type, length and referenced record scope |
| location | Location | text | true | Validate domain type, length and referenced record scope |
| payrollGroup | Payroll group | text | true | Validate domain type, length and referenced record scope |
| manager | Reporting manager | text | true | Validate domain type, length and referenced record scope |
| workerClass | Worker class | text | true | Validate domain type, length and referenced record scope |
| effectiveFrom | Effective from | date | true | Validate domain type, length and referenced record scope |
| changeReason | Change reason | text | true | Validate domain type, length and referenced record scope |

- Current action labels: **Add assignment**, **Schedule change**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Effective → Scheduled → Superseded. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the organization policy before implementation.
- Result projection: Employee, Position, Location, Effective from plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce organization permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-012 / position_register — Position register

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **organization**. Declared read endpoint: `/api/v1/organization/tree`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| positionCode | Position code | text | true | Validate domain type, length and referenced record scope |
| title | Position title | text | true | Validate domain type, length and referenced record scope |
| orgUnit | Organisation unit | text | true | Validate domain type, length and referenced record scope |
| location | Location | text | true | Validate domain type, length and referenced record scope |
| headcount | Approved headcount | number | true | min 0; max 1000000; step 1 |
| effectiveFrom | Effective from | date | true | Validate domain type, length and referenced record scope |

- Current action labels: **Create position**, **Freeze position**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Open → Filled → Frozen → Abolished. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the organization policy before implementation.
- Result projection: Position, Incumbent, Vacancy, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce organization permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-013 / sanctioned_strength — Sanctioned strength board

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **organization**. Declared read endpoint: `/api/v1/organization/tree`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| orgUnit | Organisation unit | text | true | Validate domain type, length and referenced record scope |
| designation | Designation | text | true | Validate domain type, length and referenced record scope |
| location | Location | text | true | Validate domain type, length and referenced record scope |
| sanctioned | Sanctioned strength | number | true | min 0; max 1000000; step 1 |
| effectiveFrom | Effective from | date | true | Validate domain type, length and referenced record scope |
| reason | Approval reference | text | true | Validate domain type, length and referenced record scope |

- Current action labels: **Set sanctioned strength**, **Review headroom**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Within headroom → At limit → Over plan. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the organization policy before implementation.
- Result projection: Organisation, Sanctioned, Filled, Open plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce organization permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-014 / document_vault — Document vault

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **documents**. Declared read endpoint: `not declared`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| employee | Employee | text | true | Validate domain type, length and referenced record scope |
| documentType | Document type | text | true | Validate domain type, length and referenced record scope |
| issuedOn | Issued on | date | false | Validate domain type, length and referenced record scope |
| expiresOn | Expires on | date | false | Validate domain type, length and referenced record scope |
| classification | Access classification | text | true | Validate domain type, length and referenced record scope |
| file | File | file | true | Validate domain type, length and referenced record scope |

- Current action labels: **Upload document**, **Verify document**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Pending verification → Verified → Expired → Replaced. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the documents policy before implementation.
- Result projection: Document, Employee, Expiry, Verification plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce documents permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-022 / attendance_detail — Attendance day detail

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **attendance**. Declared read endpoint: `not declared`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| employee | Employee | text | true | Validate domain type, length and referenced record scope |
| attendanceDate | Attendance date | date | true | Validate domain type, length and referenced record scope |
| appliedShift | Applied shift | text | true | Validate domain type, length and referenced record scope |
| reason | Override or recompute reason | text | true | Validate domain type, length and referenced record scope |

- Current action labels: **Regularise day**, **Recompute day**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Computed → Exception → Locked. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the attendance policy before implementation.
- Result projection: Employee, Date, Net hours, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce attendance permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-024 / overtime_register — Overtime register

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **attendance**. Declared read endpoint: `not declared`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| employee | Employee | text | true | Validate domain type, length and referenced record scope |
| attendanceDate | Attendance date | date | true | Validate domain type, length and referenced record scope |
| minutes | Approved overtime minutes | number | true | min 0; max 1000000; step 1 |
| multiplier | Multiplier | text | true | Validate domain type, length and referenced record scope |
| payRun | Payroll run | text | false | Validate domain type, length and referenced record scope |

- Current action labels: **Approve overtime**, **Tag payroll run**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Pending approval → Approved → Tagged to run → Paid. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the attendance policy before implementation.
- Result projection: Employee, Date, Overtime, Run plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce attendance permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-025 / attendance_exceptions — Attendance exception queue

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **attendance**. Declared read endpoint: `not declared`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| employee | Employee | text | true | Validate domain type, length and referenced record scope |
| attendanceDate | Attendance date | date | true | Validate domain type, length and referenced record scope |
| exceptionType | Exception type | text | true | Validate domain type, length and referenced record scope |
| resolution | Resolution notes | text | true | Validate domain type, length and referenced record scope |

- Current action labels: **Accept proposal**, **Resolve exception**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Open → Proposed → Resolved → Rejected. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the attendance policy before implementation.
- Result projection: Exception, Employee, Age, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce attendance permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-026 / recompute_monitor — Attendance recompute monitor

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **attendance**. Declared read endpoint: `/api/v1/ops/scheduled-tasks`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| employeeScope | Employee or scope | text | true | Validate domain type, length and referenced record scope |
| fromDate | From date | date | true | Validate domain type, length and referenced record scope |
| toDate | To date | date | true | Validate domain type, length and referenced record scope |
| reason | Recompute reason | text | true | Validate domain type, length and referenced record scope |

- Current action labels: **Queue recompute**, **Inspect delta**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Queued → Running → Completed → Blocked. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the attendance policy before implementation.
- Result projection: Job, Scope, Delta, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce attendance permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-027 / team_history — Team history

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **attendance**. Declared read endpoint: `/api/v1/reports/team-history`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| team | Team | text | true | Validate domain type, length and referenced record scope |
| fromDate | From date | date | true | Validate domain type, length and referenced record scope |
| toDate | To date | date | true | Validate domain type, length and referenced record scope |
| member | Team member | text | false | Validate domain type, length and referenced record scope |

- Current action labels: **Run report**, **Export history**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Ready → Scheduled → Expired. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the attendance policy before implementation.
- Result projection: Team member, Attendance, Leave, Overtime plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce attendance permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-032 / leave_policy_admin — Leave policy configuration

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **leave**. Declared read endpoint: `not declared`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| leaveType | Leave type | text | true | Validate domain type, length and referenced record scope |
| accrualPolicy | Accrual policy | text | true | Validate domain type, length and referenced record scope |
| carryForward | Carry-forward cap | number | false | min 0; max 1000000; step 0.5 |
| effectiveFrom | Effective from | date | true | Validate domain type, length and referenced record scope |
| changeReason | Change reason | text | true | Validate domain type, length and referenced record scope |

- Current action labels: **Create policy**, **Simulate policy**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Draft → Simulated → Effective → Superseded. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the leave policy before implementation.
- Result projection: Policy, Leave type, Effective from, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce leave permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-054 / tax_declarations — Tax declaration and projection

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **compliance**. Declared read endpoint: `not declared`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| employee | Employee | text | true | Validate domain type, length and referenced record scope |
| financialYear | Financial year | text | true | Validate domain type, length and referenced record scope |
| taxRegime | Tax regime | text | true | Validate domain type, length and referenced record scope |
| declarationType | Declaration type | text | true | Validate domain type, length and referenced record scope |
| amount | Declared amount | number | true | min 0; max 999999999.99; step 0.01 |
| proof | Proof document | file | false | Validate domain type, length and referenced record scope |

- Current action labels: **Add declaration**, **Review proof**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Draft → Submitted → Verified → Rejected. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the compliance policy before implementation.
- Result projection: Employee, Regime, Projected TDS, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce compliance permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-055 / bank_disbursement — Bank disbursement control

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **exports**. Declared read endpoint: `not declared`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| payrollRun | Payroll run | text | true | Validate domain type, length and referenced record scope |
| bankGateway | Bank gateway | text | true | Validate domain type, length and referenced record scope |
| checksum | File checksum | text | true | Validate domain type, length and referenced record scope |
| makerReference | Maker reference | text | true | Validate domain type, length and referenced record scope |
| checkerReference | Checker reference | text | true | Validate domain type, length and referenced record scope |

- Current action labels: **Generate bank file**, **Verify and release**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Prepared → Verified → Released → Failed. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the exports policy before implementation.
- Result projection: Run, Bank file, Total, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce exports permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-062 / policy_acknowledgements — Policy acknowledgements

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **documents**. Declared read endpoint: `/api/v1/announcements`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| policy | Policy version | text | true | Validate domain type, length and referenced record scope |
| audience | Audience rule | text | true | Validate domain type, length and referenced record scope |
| acknowledgedOn | Acknowledged on | date | true | Validate domain type, length and referenced record scope |
| comment | Employee comment | text | false | Validate domain type, length and referenced record scope |

- Current action labels: **Publish acknowledgement**, **Record acknowledgement**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Published → Pending acknowledgement → Acknowledged → Overdue. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the documents policy before implementation.
- Result projection: Policy, Audience, Acknowledged, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce documents permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-070 / rule_pack_manager — Rule-pack manager

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **compliance**. Declared read endpoint: `not declared`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| packName | Rule-pack name | text | true | Validate domain type, length and referenced record scope |
| jurisdiction | Jurisdiction | text | true | Validate domain type, length and referenced record scope |
| effectiveFrom | Effective from | date | true | Validate domain type, length and referenced record scope |
| version | Version | text | true | Validate domain type, length and referenced record scope |
| changeSummary | Change summary | text | true | Validate domain type, length and referenced record scope |

- Current action labels: **Draft rule pack**, **Run test suite**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Draft → Tested → Reviewed → Published → Effective → Superseded. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the compliance policy before implementation.
- Result projection: Pack, Jurisdiction, Version, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce compliance permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-071 / golden_case_library — Golden-case library

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **compliance**. Declared read endpoint: `not declared`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| caseName | Case name | text | true | Validate domain type, length and referenced record scope |
| domain | Domain | text | true | Validate domain type, length and referenced record scope |
| sourceData | Input fixture | text | true | Validate domain type, length and referenced record scope |
| expectedResult | Expected result | text | true | Validate domain type, length and referenced record scope |
| statuteReference | Statute reference | text | true | Validate domain type, length and referenced record scope |

- Current action labels: **Add golden case**, **Run comparison**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Draft → Passing → Mismatch → Retired. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the compliance policy before implementation.
- Result projection: Case, Domain, Last run, Outcome plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce compliance permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-101 / sync_monitor — Integration sync monitor

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **integrations**. Declared read endpoint: `/api/v1/webhooks/deliveries`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| connection | Connection | text | true | Validate domain type, length and referenced record scope |
| externalCode | External record code | text | true | Validate domain type, length and referenced record scope |
| conflictField | Conflict field | text | false | Validate domain type, length and referenced record scope |
| resolution | Resolution | text | true | Validate domain type, length and referenced record scope |

- Current action labels: **Resolve conflict**, **Replay delivery**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Applied → Conflict → Held → Replayed. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the integrations policy before implementation.
- Result projection: Batch, Connection, Rows, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce integrations permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-102 / gl_mapping — GL mapping and journal

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **exports**. Declared read endpoint: `not declared`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| payComponent | Pay component | text | true | Validate domain type, length and referenced record scope |
| ledgerAccount | GL account | text | true | Validate domain type, length and referenced record scope |
| costCentreSource | Cost-centre source | text | true | Validate domain type, length and referenced record scope |
| drCr | Debit or credit | text | true | Validate domain type, length and referenced record scope |
| effectiveFrom | Effective from | date | true | Validate domain type, length and referenced record scope |

- Current action labels: **Add mapping**, **Validate journal**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Draft → Validated → Posted → Superseded. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the exports policy before implementation.
- Result projection: Component, GL account, Dimension, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce exports permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-103 / reconciliation — Payroll reconciliation

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **exports**. Declared read endpoint: `not declared`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| payrollRun | Payroll run | text | true | Validate domain type, length and referenced record scope |
| reconciliationType | Reconciliation type | text | true | Validate domain type, length and referenced record scope |
| variance | Variance amount | number | true | min -999999999.99; max 999999999.99; step 0.01 |
| resolution | Resolution notes | text | true | Validate domain type, length and referenced record scope |

- Current action labels: **Run reconciliation**, **Resolve variance**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Open → Explained → Reconciled → Escalated. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the exports policy before implementation.
- Result projection: Control, Expected, Actual, Variance plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce exports permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-040 / approval_inbox — Unified approval inbox

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **governance**. Declared read endpoint: `/api/v1/notifications`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| requestType | Request type | text | true | Validate domain type, length and referenced record scope |
| decision | Decision | text | true | Validate domain type, length and referenced record scope |
| reason | Decision reason | text | true | Validate domain type, length and referenced record scope |

- Current action labels: **Review item**, **Delegate item**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Pending → Delegated → Approved → Rejected → Returned. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the governance policy before implementation.
- Result projection: Request, Requester, Due, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce governance permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-060 / joining_chain — Joining chain console

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **lifecycle**. Declared read endpoint: `/api/v1/onboarding/instances`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| employee | Employee | text | true | Validate domain type, length and referenced record scope |
| joiningDate | Joining date | date | true | Validate domain type, length and referenced record scope |
| owner | Owner | text | true | Validate domain type, length and referenced record scope |
| blocker | Blocker notes | text | false | Validate domain type, length and referenced record scope |

- Current action labels: **Create joining chain**, **Reassign step**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Not started → In progress → Blocked → Ready. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the lifecycle policy before implementation.
- Result projection: Joiner, Readiness, Owner, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce lifecycle permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-061 / clearance_board — Clearance board

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **lifecycle**. Declared read endpoint: `not declared`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| employee | Leaver | text | true | Validate domain type, length and referenced record scope |
| department | Department owner | text | true | Validate domain type, length and referenced record scope |
| blocking | Blocking item | text | true | Validate domain type, length and referenced record scope |
| recoveryAmount | Recovery amount | number | false | min 0; max 999999999.99; step 0.01 |
| waiverReason | Waiver reason | text | false | Validate domain type, length and referenced record scope |

- Current action labels: **Clear item**, **Waive item**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Open → Cleared → Waived → Held. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the lifecycle policy before implementation.
- Result projection: Leaver, Owner, Blocking, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce lifecycle permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-064 / asset_register — Asset register

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **lifecycle**. Declared read endpoint: `not declared`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| assetTag | Asset tag | text | true | Validate domain type, length and referenced record scope |
| assetType | Asset type | text | true | Validate domain type, length and referenced record scope |
| employee | Allocated employee | text | false | Validate domain type, length and referenced record scope |
| condition | Condition | text | true | Validate domain type, length and referenced record scope |
| returnedOn | Returned on | date | false | Validate domain type, length and referenced record scope |

- Current action labels: **Allocate asset**, **Record return**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Available → Allocated → Returned → Written off. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the lifecycle policy before implementation.
- Result projection: Asset, Holder, Condition, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce lifecycle permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-065 / recognition_register — Recognition register

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **engagement**. Declared read endpoint: `/api/v1/recognition-events`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| nominee | Nominee | text | true | Validate domain type, length and referenced record scope |
| programme | Programme | text | true | Validate domain type, length and referenced record scope |
| citation | Citation | text | true | Validate domain type, length and referenced record scope |
| awardValue | Award value | number | false | min 0; max 999999999.99; step 0.01 |

- Current action labels: **Nominate employee**, **Approve award**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Nominated → Approved → Published → Paid. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the engagement policy before implementation.
- Result projection: Nominee, Programme, Award, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce engagement permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-067 / letters_register — Letters and issue register

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **lifecycle**. Declared read endpoint: `not declared`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| employee | Employee | text | true | Validate domain type, length and referenced record scope |
| template | Template | text | true | Validate domain type, length and referenced record scope |
| effectiveDate | Effective date | date | true | Validate domain type, length and referenced record scope |
| approver | Approver | text | true | Validate domain type, length and referenced record scope |

- Current action labels: **Draft letter**, **Issue letter**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Draft → Pending approval → Issued → Reissued. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the lifecycle policy before implementation.
- Result projection: Letter, Employee, Version, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce lifecycle permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-073 / statutory_register — Statutory forms and registers

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **compliance**. Declared read endpoint: `/api/v1/compliance/forms`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| formCode | Form code | text | true | Validate domain type, length and referenced record scope |
| jurisdiction | Jurisdiction | text | true | Validate domain type, length and referenced record scope |
| period | Period | text | true | Validate domain type, length and referenced record scope |
| acknowledgement | Acknowledgement reference | text | false | Validate domain type, length and referenced record scope |

- Current action labels: **Generate form**, **Record filing**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Generated → Prepared → Filed → Accepted. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the compliance policy before implementation.
- Result projection: Form, Period, Jurisdiction, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce compliance permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-080 / loans_advances — Loans and advances

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **loans**. Declared read endpoint: `/api/v1/loans`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| employee | Employee | text | true | Validate domain type, length and referenced record scope |
| purpose | Purpose | text | true | Validate domain type, length and referenced record scope |
| principal | Principal amount | number | true | min 0; max 999999999.99; step 0.01 |
| tenureMonths | Tenure in months | number | true | min 0; max 1000000; step 1 |
| guarantorOne | Guarantor one | text | true | Validate domain type, length and referenced record scope |
| guarantorTwo | Guarantor two | text | true | Validate domain type, length and referenced record scope |

- Current action labels: **Apply for loan**, **Review sanction**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Applied → Guarantors pending → Sanction pending → Active → Closed. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the loans policy before implementation.
- Result projection: Employee, Principal, Outstanding, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce loans permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-090 / requisitions — Recruitment requisitions

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **talent**. Declared read endpoint: `/api/v1/requisitions`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| type | Replacement or addition | text | true | Validate domain type, length and referenced record scope |
| position | Position | text | true | Validate domain type, length and referenced record scope |
| orgUnit | Organisation unit | text | true | Validate domain type, length and referenced record scope |
| location | Location | text | true | Validate domain type, length and referenced record scope |
| overrideReason | Override reason | text | false | Validate domain type, length and referenced record scope |

- Current action labels: **Raise requisition**, **Approve requisition**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Draft → Blocked → Submitted → Approved → Filled. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the talent policy before implementation.
- Result projection: Requisition, Position, Headroom, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce talent permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-091 / referrals — Referral tracking

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **talent**. Declared read endpoint: `/api/v1/referrals`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| candidate | Candidate | text | true | Validate domain type, length and referenced record scope |
| referrer | Referrer | text | true | Validate domain type, length and referenced record scope |
| position | Position | text | true | Validate domain type, length and referenced record scope |
| relationship | Relationship | text | true | Validate domain type, length and referenced record scope |

- Current action labels: **Refer candidate**, **Award referral**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Referred → Screening → Interviewing → Hired → Awarded. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the talent policy before implementation.
- Result projection: Candidate, Referrer, Stage, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce talent permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-095 / contractor_reconciliation — Contractor engagement and invoice

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **contractors**. Declared read endpoint: `/api/v1/contractors/invoices`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| agency | Agency | text | true | Validate domain type, length and referenced record scope |
| contract | Contract reference | text | true | Validate domain type, length and referenced record scope |
| invoice | Invoice reference | text | true | Validate domain type, length and referenced record scope |
| variance | Attendance variance | number | true | min -1000000; max 1000000; step 1 |
| resolution | Resolution notes | text | false | Validate domain type, length and referenced record scope |

- Current action labels: **Reconcile invoice**, **Approve invoice**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Submitted → Variance held → Approved → Paid. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the contractors policy before implementation.
- Result projection: Agency, Invoice, Variance, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce contractors permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-100 / integration_config — Integration configuration

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **integrations**. Declared read endpoint: `/api/v1/integrations/connections`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| connection | Connection | text | true | Validate domain type, length and referenced record scope |
| masterDataMode | Master-data mode | text | true | Validate domain type, length and referenced record scope |
| fieldOwner | Field ownership | text | true | Validate domain type, length and referenced record scope |
| syncSchedule | Sync schedule | text | true | Validate domain type, length and referenced record scope |
| secretReference | Secret reference | text | false | Validate domain type, length and referenced record scope |

- Current action labels: **Configure connection**, **Validate connection**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Draft → Validated → Connected → Paused. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the integrations policy before implementation.
- Result projection: Connection, Mode, Last sync, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce integrations permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-110 / agent_ledger — Agent console and action ledger

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **ai**. Declared read endpoint: `/api/v1/ai/actions`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| agent | Agent | text | true | Validate domain type, length and referenced record scope |
| tool | Tool | text | true | Validate domain type, length and referenced record scope |
| scope | Permitted scope | text | true | Validate domain type, length and referenced record scope |
| approvalThreshold | Approval threshold | number | true | min 0; max 999999999.99; step 0.01 |
| reversalReason | Reversal reason | text | false | Validate domain type, length and referenced record scope |

- Current action labels: **Review action diff**, **Reverse action**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Planned → Gated → Simulated → Awaiting approval → Executed → Reversed. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the ai policy before implementation.
- Result projection: Agent, Action, Approver, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce ai permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-111 / operational_reports — Operational reports

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **analytics**. Declared read endpoint: `/api/v1/analytics/metrics`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| report | Report type | text | true | Validate domain type, length and referenced record scope |
| scope | Scope | text | true | Validate domain type, length and referenced record scope |
| fromDate | From date | date | true | Validate domain type, length and referenced record scope |
| toDate | To date | date | true | Validate domain type, length and referenced record scope |
| schedule | Schedule | text | false | Validate domain type, length and referenced record scope |

- Current action labels: **Run report**, **Schedule report**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Ready → Queued → Scheduled → Expired. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the analytics policy before implementation.
- Result projection: Report, Scope, Generated, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce analytics permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-020 / check_in_out — Check in and check out

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **attendance**. Declared read endpoint: `not declared`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| employee | Employee | text | true | Validate domain type, length and referenced record scope |
| punchType | Punch type | text | true | Validate domain type, length and referenced record scope |
| punchedAt | Timestamp | datetime-local | true | Validate domain type, length and referenced record scope |
| source | Source | text | true | Validate domain type, length and referenced record scope |
| locationEvidence | Location evidence | text | false | Validate domain type, length and referenced record scope |

- Current action labels: **Record punch**, **Retry queued punch**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Queued offline → Ingested → Computed → Rejected. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the attendance policy before implementation.
- Result projection: Employee, Punch, Source, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce attendance permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-021 / my_attendance — My attendance history

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **attendance**. Declared read endpoint: `not declared`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| fromDate | From date | date | true | Validate domain type, length and referenced record scope |
| toDate | To date | date | true | Validate domain type, length and referenced record scope |
| employee | Employee | text | true | Validate domain type, length and referenced record scope |

- Current action labels: **View history**, **Raise regularisation**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Computed → Exception → Locked. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the attendance policy before implementation.
- Result projection: Date, Net hours, Overtime, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce attendance permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-023 / gate_passes — Gate pass register

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **attendance**. Declared read endpoint: `/api/v1/gate-passes`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| employee | Employee | text | true | Validate domain type, length and referenced record scope |
| date | Date | date | true | Validate domain type, length and referenced record scope |
| fromTime | From time | time | true | Validate domain type, length and referenced record scope |
| toTime | To time | time | true | Validate domain type, length and referenced record scope |
| type | Pass type | text | true | Validate domain type, length and referenced record scope |
| reason | Reason | text | true | Validate domain type, length and referenced record scope |

- Current action labels: **Request gate pass**, **Review gate pass**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Draft → Pending approval → Approved → Rejected → Credited. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the attendance policy before implementation.
- Result projection: Employee, Date, Minutes, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce attendance permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-030 / leave_requests — Leave requests

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **leave**. Declared read endpoint: `/api/v1/leave-requests`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| employee | Employee | select | true | Validate domain type, length and referenced record scope |
| leaveType | Leave type | select | true | Validate domain type, length and referenced record scope |
| fromDate | From date | date | true | Validate domain type, length and referenced record scope |
| toDate | To date | date | true | Validate domain type, length and referenced record scope |
| numberOfDays | Number of Days | number | true | min 0.5; max 1000000; step 0.5; {"kind":"inclusiveDays","from":"fromDate","to":"toDate"} |
| reason | Reason | textarea | false | Validate domain type, length and referenced record scope |
| contact | Contact during leave | tel | false | Validate domain type, length and referenced record scope |

- Current action labels: **Apply for leave**, **Record early return**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Draft → Validated → Pending approval → Approved → Availed → Closed. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the leave policy before implementation.
- Result projection: Employee, Leave type, Dates, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce leave permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-031 / leave_ledger — Leave balance and ledger

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **leave**. Declared read endpoint: `/api/v1/leave-balances`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| employee | Employee | text | true | Validate domain type, length and referenced record scope |
| asAtDate | Balance as at | date | true | Validate domain type, length and referenced record scope |
| leaveType | Leave type | text | false | Validate domain type, length and referenced record scope |

- Current action labels: **View ledger**, **Export ledger**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Projected → Expired → Encashed → Reversed. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the leave policy before implementation.
- Result projection: Leave type, Credit, Debit, Balance plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce leave permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-050 / payroll_runs — Payroll run cockpit

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **payroll**. Declared read endpoint: `/api/v1/payroll-runs`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| entity | Legal entity | text | true | Validate domain type, length and referenced record scope |
| period | Payroll period | text | true | Validate domain type, length and referenced record scope |
| payrollGroup | Payroll group | text | true | Validate domain type, length and referenced record scope |
| runType | Run type | text | true | Validate domain type, length and referenced record scope |
| payDate | Pay date | date | true | Validate domain type, length and referenced record scope |

- Current action labels: **Create payroll run**, **Advance run**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Draft → Inputs locked → Pre-audit → Calculated → Review → Approved → Disbursed → Closed. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the payroll policy before implementation.
- Result projection: Period, Run type, Population, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce payroll permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-051 / pre_payroll_audit — Pre-payroll audit

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **payroll**. Declared read endpoint: `/api/v1/payroll-anomalies`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| payrollRun | Payroll run | text | true | Validate domain type, length and referenced record scope |
| severity | Severity | text | true | Validate domain type, length and referenced record scope |
| owner | Resolution owner | text | true | Validate domain type, length and referenced record scope |
| resolution | Resolution or waiver reason | text | true | Validate domain type, length and referenced record scope |

- Current action labels: **Log audit finding**, **Resolve finding**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Open → Assigned → Resolved → Waived. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the payroll policy before implementation.
- Result projection: Finding, Severity, Owner, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce payroll permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-052 / salary_simulator — Salary structure simulator

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **compensation**. Declared read endpoint: `/api/v1/wage-simulations`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| employee | Employee | text | true | Validate domain type, length and referenced record scope |
| basic | Basic pay | number | true | min 0; max 999999999.99; step 0.01 |
| hra | HRA | number | true | min 0; max 999999999.99; step 0.01 |
| specialAllowance | Special allowance | number | false | min 0; max 999999999.99; step 0.01 |
| effectiveFrom | Effective from | date | true | Validate domain type, length and referenced record scope |

- Current action labels: **Run simulation**, **Submit structure**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Draft → Simulated → Submitted → Adopted. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the compensation policy before implementation.
- Result projection: Employee, Gross, Take home, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce compensation permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-053 / payslips — Payslips

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **payroll**. Declared read endpoint: `/api/v1/payslips`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| employee | Employee | text | true | Validate domain type, length and referenced record scope |
| period | Pay period | text | true | Validate domain type, length and referenced record scope |
| payrollRun | Payroll run | text | false | Validate domain type, length and referenced record scope |

- Current action labels: **Open payslip**, **Explain line item**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Generated → Published → Viewed → Archived. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the payroll policy before implementation.
- Result projection: Employee, Period, Net pay, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce payroll permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-056 / full_and_final — Full and final settlement

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **payroll**. Declared read endpoint: `not declared`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| employee | Leaver | text | true | Validate domain type, length and referenced record scope |
| lastWorkingDay | Last working day | date | true | Validate domain type, length and referenced record scope |
| payrollRun | Settlement run | text | true | Validate domain type, length and referenced record scope |
| recoveryAmount | Recovery amount | number | false | min 0; max 999999999.99; step 0.01 |
| approvalReference | Approval reference | text | false | Validate domain type, length and referenced record scope |

- Current action labels: **Compute settlement**, **Settle F&F**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Held → Ready → Approved → Settled. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the payroll policy before implementation.
- Result projection: Leaver, Blocking items, Net settlement, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce payroll permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-041 / assistant_helpdesk — Assistant and helpdesk

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **ai**. Declared read endpoint: `/api/v1/ai/knowledge`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| question | Question | text | true | Validate domain type, length and referenced record scope |
| actionRequest | Requested action | text | false | Validate domain type, length and referenced record scope |
| ticketSubject | Ticket subject | text | false | Validate domain type, length and referenced record scope |
| ticketDescription | Ticket description | text | false | Validate domain type, length and referenced record scope |

- Current action labels: **Ask assistant**, **Raise ticket**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Answered → Action pending → Ticket raised → Resolved. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the ai policy before implementation.
- Result projection: Request, Channel, Owner, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce ai permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-042 / employee_home — Employee home actions

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **dashboard**. Declared read endpoint: `/api/v1/home`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| action | Action | text | true | Validate domain type, length and referenced record scope |
| context | Context | text | false | Validate domain type, length and referenced record scope |
| requestedAt | Requested at | datetime-local | true | Validate domain type, length and referenced record scope |

- Current action labels: **Start employee action**, **Review pending action**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Available → Queued offline → Completed → Needs attention. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the dashboard policy before implementation.
- Result projection: Action, Context, Updated, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce dashboard permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-063 / learning_paths — My learning

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **learning**. Declared read endpoint: `/api/v1/enrollments`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| employee | Employee | text | true | Validate domain type, length and referenced record scope |
| learningPath | Learning path | text | true | Validate domain type, length and referenced record scope |
| course | Course | text | false | Validate domain type, length and referenced record scope |
| evidence | Completion evidence | file | false | Validate domain type, length and referenced record scope |

- Current action labels: **Assign learning**, **Record completion**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Assigned → In progress → Completed → Verified → Certified. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the learning policy before implementation.
- Result projection: Learning path, Due date, Progress, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce learning permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-066 / announcement_management — Announcements

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **notifications**. Declared read endpoint: `/api/v1/announcements`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| title | Announcement title | text | true | Validate domain type, length and referenced record scope |
| audience | Audience rule | text | true | Validate domain type, length and referenced record scope |
| channel | Delivery channel | text | true | Validate domain type, length and referenced record scope |
| publishAt | Publish at | datetime-local | true | Validate domain type, length and referenced record scope |

- Current action labels: **Create announcement**, **Publish announcement**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Draft → Scheduled → Published → Archived. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the notifications policy before implementation.
- Result projection: Announcement, Audience, Channel, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce notifications permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

### SCR-072 / obligation_calendar — Obligation calendar

Existing metadata source: `src/data/ui/lib.operational-module-registry.json`. Proposed owner: **compliance**. Declared read endpoint: `/api/v1/compliance/obligations`; the current browser adapter still returns preview records.

| Input key | Label | Type | Required | Constraints / derivation |
| --- | --- | --- | --- | --- |
| obligation | Obligation | text | true | Validate domain type, length and referenced record scope |
| entity | Legal entity | text | true | Validate domain type, length and referenced record scope |
| state | State | text | true | Validate domain type, length and referenced record scope |
| dueDate | Due date | date | true | Validate domain type, length and referenced record scope |
| owner | Owner | text | true | Validate domain type, length and referenced record scope |
| evidence | Evidence | file | false | Validate domain type, length and referenced record scope |

- Current action labels: **Create obligation**, **Record filing**. Design each as a named application command; do not send arbitrary status strings to a generic update endpoint.
- Existing state labels: Upcoming → In preparation → Filed → Overdue → Closed. This is a UI vocabulary, not proof that every adjacent transition is legal. Define permitted edges, actors, required evidence and terminal-state rules in the compliance policy before implementation.
- Result projection: Obligation, Due date, Owner, Status plus ID/version and scope metadata. Render submitted values or authoritative computed values, never substitute a record ID for missing business data.
- Transaction: validate fields and referenced records; enforce compliance permission/scope; version-check aggregate; persist explicit fields and audit/outbox in one commit.
- Acceptance: required blanks/whitespace rejected; stale selections rejected; numeric/date boundaries tested; unauthorized tenant/employee blocked; duplicate submission yields one record; stale update yields conflict; database rollback leaves no partial record.
- Persistence gap: replace in-memory creation/transition in OperationalModuleView with typed command calls only after this screen's schema, policy and API tests pass.

## Shared action dialog contracts

Every dialog below must resolve to a domain command before its success callback becomes a durable workflow. `MainWorkspace` generic action completion is not sufficient service evidence.

### Action employee — Add employee

- Source: `components.Clerio.ActionFormModal.json/common_1/employee`. Intent label: Create employee.
- Inputs: firstName (text, required: First name); lastName (text, required: Last name); workEmail (email, required: Work email); department (select, required: Department); designation (text, required: Designation); joiningDate (date, required: Joining date); manager (text, optional: Reporting manager).
- Integration task: organization application service owns the employee command with permission organization.employee.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action position — Create position slot

- Source: `components.Clerio.ActionFormModal.json/common_1/position`. Intent label: Create slot.
- Inputs: title (text, required: Position title); department (select, required: Department); location (text, required: Location); grade (text, required: Grade or band); headcount (number, required: Approved headcount); effectiveDate (date, required: Effective date).
- Integration task: organization application service owns the position command with permission organization.position.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action document — Upload employee document

- Source: `components.Clerio.ActionFormModal.json/common_1/document`. Intent label: Upload document.
- Inputs: employee (text, required: Employee); documentType (select, required: Document category); title (text, required: Document title); file (file, required: File); expiryDate (date, optional: Expiry date).
- Integration task: documents application service owns the document command with permission documents.document.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action invite — Invite teammate

- Source: `components.Clerio.ActionFormModal.json/common_1/invite`. Intent label: Send invitation.
- Inputs: name (text, required: Full name); email (email, required: Work email); role (select, required: Role); team (text, required: Team or department); message (textarea, optional: Invitation message).
- Integration task: platform application service owns the invite command with permission platform.invite.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action oneOnOne — Schedule a 1 on 1

- Source: `components.Clerio.ActionFormModal.json/common_1/oneOnOne`. Intent label: Schedule 1 on 1.
- Inputs: participant (text, required: Participant); date (date, required: Date); time (time, required: Time); duration (select, required: Duration); agenda (textarea, optional: Agenda); recurrence (select, optional: Repeat).
- Integration task: performance application service owns the oneOnOne command with permission performance.oneOnOne.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action feedback360 — Request 360 feedback

- Source: `components.Clerio.ActionFormModal.json/common_1/feedback360`. Intent label: Request feedback.
- Inputs: employee (text, required: Employee under review); reviewers (textarea, required: Reviewers); cycle (text, required: Review cycle); dueDate (date, required: Response due date); message (textarea, optional: Message to reviewers).
- Integration task: performance application service owns the feedback360 command with permission performance.feedback360.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action okr — Create OKR goal

- Source: `components.Clerio.ActionFormModal.json/common_1/okr`. Intent label: Create goal.
- Inputs: objective (text, required: Objective); owner (text, required: Owner); cycle (select, required: Cycle); weight (number, required: Weight percent); keyResults (textarea, required: Key results); dueDate (date, optional: Due date).
- Integration task: performance application service owns the okr command with permission performance.okr.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action wellbeing — Create wellbeing plan

- Source: `components.Clerio.ActionFormModal.json/common_1/wellbeing`. Intent label: Create plan.
- Inputs: affectedGroup (text, required: Employee or cohort); action (textarea, required: Proposed action); owner (text, required: Plan owner); reviewDate (date, required: Review date).
- Integration task: engagement application service owns the wellbeing command with permission engagement.wellbeing.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action compCycle — Create annual review cycle

- Source: `components.Clerio.ActionFormModal.json/common_1/compCycle`. Intent label: Save review cycle.
- Inputs: name (text, required: Cycle name); effectiveDate (date, required: Effective date); budget (number, required: Budget allocation); eligiblePopulation (textarea, required: Eligible employees); approvalRoute (text, required: Approval route).
- Integration task: compensation application service owns the compCycle command with permission compensation.compCycle.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action offCycleOt — Create off cycle OT run

- Source: `components.Clerio.ActionFormModal.json/common_1/offCycleOt`. Intent label: Create OT run.
- Inputs: period (text, required: OT period); paymentDate (date, required: Payment date); employeeScope (textarea, required: Employee scope); approvalReference (text, required: Approved OT reference).
- Integration task: payroll application service owns the offCycleOt command with permission payroll.offCycleOt.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action arrears — Create retro arrears run

- Source: `components.Clerio.ActionFormModal.json/common_1/arrears`. Intent label: Create arrears run.
- Inputs: originalPeriod (text, required: Original pay period); paymentDate (date, required: Payment date); employeeScope (textarea, required: Affected employees); reason (textarea, required: Correction reason).
- Integration task: payroll application service owns the arrears command with permission payroll.arrears.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action contractor — Register contract worker

- Source: `components.Clerio.ActionFormModal.json/common_1/contractor`. Intent label: Register worker.
- Inputs: name (text, required: Worker name); agency (text, required: Agency); contract (text, required: Contract reference); worksite (text, required: Worksite); startDate (date, required: Assignment start); endDate (date, optional: Assignment end).
- Integration task: contractors application service owns the contractor command with permission contractors.contractor.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action debitNote — Issue debit note

- Source: `components.Clerio.ActionFormModal.json/common_1/debitNote`. Intent label: Create debit note.
- Inputs: vendor (text, required: Vendor); invoice (text, required: Invoice reference); amount (number, required: Amount); reason (textarea, required: Reason); evidence (file, optional: Supporting file).
- Integration task: exports application service owns the debitNote command with permission exports.debitNote.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action filing — Review and file obligation

- Source: `components.Clerio.ActionFormModal.json/common_1/filing`. Intent label: Record filing.
- Inputs: entity (text, required: Legal entity); obligation (text, required: Obligation); period (text, required: Filing period); submissionDate (date, required: Submission date); receipt (file, optional: Receipt or evidence); notes (textarea, optional: Review notes).
- Integration task: compliance application service owns the filing command with permission compliance.filing.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action inspector — Record inspector entry

- Source: `components.Clerio.ActionFormModal.json/common_1/inspector`. Intent label: Record visit.
- Inputs: inspector (text, required: Inspector name); authority (text, required: Authority); visitDate (date, required: Visit date); purpose (textarea, required: Visit purpose); observations (textarea, optional: Observations).
- Integration task: compliance application service owns the inspector command with permission compliance.inspector.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action apiKey — Generate API key

- Source: `components.Clerio.ActionFormModal.json/common_1/apiKey`. Intent label: Generate key.
- Inputs: name (text, required: Key name); environment (select, required: Environment); scopes (textarea, required: Scopes); expiry (date, optional: Expiry date).
- Integration task: integrations application service owns the apiKey command with permission integrations.apiKey.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action connector — Configure connector

- Source: `components.Clerio.ActionFormModal.json/common_1/connector`. Intent label: Save connector.
- Inputs: provider (text, required: Provider); connectionUrl (url, required: Connection URL); authentication (select, required: Authentication method); syncSchedule (select, required: Sync schedule); mappingNotes (textarea, optional: Field mapping notes).
- Integration task: integrations application service owns the connector command with permission integrations.connector.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action learningPath — Create learning path

- Source: `components.Clerio.ActionFormModal.json/common_1/learningPath`. Intent label: Create learning path.
- Inputs: learner (text, required: Learner); skillGoals (textarea, required: Skill goals); timeframe (select, required: Target timeframe); courses (textarea, required: Recommended courses).
- Integration task: learning application service owns the learningPath command with permission learning.learningPath.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action focusBlock — Schedule focus block

- Source: `components.Clerio.ActionFormModal.json/common_1/focusBlock`. Intent label: Schedule block.
- Inputs: date (date, required: Date); startTime (time, required: Start time); duration (select, required: Duration); calendar (select, required: Calendar); recurrence (select, optional: Repeat).
- Integration task: ops application service owns the focusBlock command with permission ops.focusBlock.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action photo — Change profile photo

- Source: `components.Clerio.ActionFormModal.json/common_1/photo`. Intent label: Save photo.
- Inputs: photo (file, required: Photo file).
- Integration task: documents application service owns the photo command with permission documents.photo.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action biometric — Set up biometric sign in

- Source: `components.Clerio.ActionFormModal.json/common_1/biometric`. Intent label: Start secure setup.
- Inputs: method (select, required: Method); deviceName (text, required: Device name); recoveryEmail (email, required: Recovery email).
- Integration task: privacy application service owns the biometric command with permission privacy.biometric.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action returnPlan — Plan employee return

- Source: `components.Clerio.ActionFormModal.json/common_1/returnPlan`. Intent label: Save return plan.
- Inputs: employee (text, required: Employee); returnDate (date, required: Return date); checklist (textarea, required: Return checklist); owner (text, required: Plan owner); notes (textarea, optional: Accommodations or notes).
- Integration task: leave application service owns the returnPlan command with permission leave.returnPlan.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action kudos — Send recognition note

- Source: `components.Clerio.ActionFormModal.json/common_1/kudos`. Intent label: Send note.
- Inputs: recipient (text, required: Recipient); message (textarea, required: Recognition message); channel (select, required: Delivery channel).
- Integration task: engagement application service owns the kudos command with permission engagement.kudos.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action probation — Prepare probation confirmation

- Source: `components.Clerio.ActionFormModal.json/common_1/probation`. Intent label: Prepare letter.
- Inputs: employee (text, required: Employee); decision (select, required: Decision); effectiveDate (date, required: Effective date); notes (textarea, required: Decision notes).
- Integration task: lifecycle application service owns the probation command with permission lifecycle.probation.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action widget — Save analysis widget

- Source: `components.Clerio.ActionFormModal.json/common_1/widget`. Intent label: Save widget.
- Inputs: name (text, required: Widget name); dashboard (select, required: Dashboard); refresh (select, required: Refresh frequency); visibility (select, required: Visibility).
- Integration task: dashboard application service owns the widget command with permission dashboard.widget.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action twoFactor — Set up two factor authentication

- Source: `components.Clerio.ActionFormModal.json/common_1/twoFactor`. Intent label: Continue to verification.
- Inputs: method (select, required: Authentication method); phone (tel, required: Recovery phone); verificationCode (text, required: Verification code).
- Integration task: platform application service owns the twoFactor command with permission platform.twoFactor.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action passwordReset — Reset password

- Source: `components.Clerio.ActionFormModal.json/common_1/passwordReset`. Intent label: Send reset link.
- Inputs: email (email, required: Work email).
- Integration task: platform application service owns the passwordReset command with permission platform.passwordReset.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action growthAction — Assign growth action

- Source: `components.Clerio.ActionFormModal.json/common_1/growthAction`. Intent label: Assign action.
- Inputs: employee (text, required: Employee); action (textarea, required: Growth action); owner (text, required: Owner); dueDate (date, required: Follow up date).
- Integration task: performance application service owns the growthAction command with permission performance.growthAction.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action ticket — Raise support ticket

- Source: `components.Clerio.ActionFormModal.json/common_1/ticket`. Intent label: Submit ticket.
- Inputs: category (select, required: Category); priority (select, required: Priority); subject (text, required: Subject); description (textarea, required: Description).
- Integration task: ops application service owns the ticket command with permission ops.ticket.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action reply — Reply to support ticket

- Source: `components.Clerio.ActionFormModal.json/common_1/reply`. Intent label: Send reply.
- Inputs: message (textarea, required: Reply or resolution notes).
- Integration task: ops application service owns the reply command with permission ops.reply.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action settings — Save profile and workspace settings

- Source: `components.Clerio.ActionFormModal.json/common_1/settings`. Intent label: Save changes.
- Inputs: name (text, required: Full name); email (email, required: Work email); location (text, optional: Work location); timezone (text, optional: Time zone).
- Integration task: admin application service owns the settings command with permission admin.settings.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action password — Update password

- Source: `components.Clerio.ActionFormModal.json/common_1/password`. Intent label: Update password.
- Inputs: currentPassword (password, required: Current password); newPassword (password, required: New password); confirmPassword (password, required: Confirm new password).
- Integration task: platform application service owns the password command with permission platform.password.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action assetReturn — Record asset return

- Source: `components.Clerio.ActionFormModal.json/common_1/assetReturn`. Intent label: Record return.
- Inputs: asset (text, required: Asset); condition (select, required: Return condition); returnDate (date, required: Return date); remarks (textarea, optional: Inspection remarks).
- Integration task: lifecycle application service owns the assetReturn command with permission lifecycle.assetReturn.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action clearance — Record department clearance

- Source: `components.Clerio.ActionFormModal.json/common_1/clearance`. Intent label: Save clearance.
- Inputs: department (text, required: Department); status (select, required: Clearance status); remarks (textarea, required: Remarks).
- Integration task: lifecycle application service owns the clearance command with permission lifecycle.clearance.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action roster — Review roster proposal

- Source: `components.Clerio.ActionFormModal.json/common_1/roster`. Intent label: Apply roster proposal.
- Inputs: site (text, required: Site); assignments (textarea, required: Assignment notes); effectiveDate (date, required: Effective date).
- Integration task: attendance application service owns the roster command with permission attendance.roster.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action leaveDecision — Decide leave request

- Source: `components.Clerio.ActionFormModal.json/common_1/leaveDecision`. Intent label: Record decision.
- Inputs: employee (text, required: Employee); decision (select, required: Decision); remarks (textarea, required: Decision remarks).
- Integration task: leave application service owns the leaveDecision command with permission leave.leaveDecision.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action benefitLock — Lock benefit selections

- Source: `components.Clerio.ActionFormModal.json/common_1/benefitLock`. Intent label: Lock selections.
- Inputs: benefits (textarea, required: Selected benefits); enrollmentYear (number, required: Enrollment year); confirmation (select, required: Confirm selection).
- Integration task: benefits application service owns the benefitLock command with permission benefits.benefitLock.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action payrollPreview — Preview payroll register

- Source: `components.Clerio.ActionFormModal.json/common_1/payrollPreview`. Intent label: Generate preview.
- Inputs: period (text, required: Payroll period); format (select, required: Preview format); audience (select, required: Access scope).
- Integration task: payroll application service owns the payrollPreview command with permission payroll.payrollPreview.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action payrollRelease — Authorize payroll release

- Source: `components.Clerio.ActionFormModal.json/common_1/payrollRelease`. Intent label: Authorize release.
- Inputs: period (text, required: Payroll period); exceptionSummary (textarea, required: Exception review summary); bankGateway (select, required: Bank gateway); authorization (text, required: Authorization reference).
- Integration task: payroll application service owns the payrollRelease command with permission payroll.payrollRelease.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action actionReversal — Reverse AI action

- Source: `components.Clerio.ActionFormModal.json/common_1/actionReversal`. Intent label: Record reversal.
- Inputs: actionId (text, required: Action ID); reason (textarea, required: Reason for reversal); confirmation (select, required: Confirmation).
- Integration task: ai application service owns the actionReversal command with permission ai.actionReversal.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

### Action anomalyReview — Review attendance anomaly

- Source: `components.Clerio.ActionFormModal.json/common_1/anomalyReview`. Intent label: Save review.
- Inputs: signal (text, required: Signal); affectedEmployees (textarea, required: Affected employees or cohort); outcome (select, required: Review outcome); notes (textarea, required: Review notes).
- Integration task: ai application service owns the anomalyReview command with permission ai.anomalyReview.execute; use the domain invariants in DOMAIN_SERVICES.md; persist the returned record/version before closing. Require referenced entity scope checks and shared form schema validation.
- Acceptance: cancel has no effect; invalid input cannot invoke a command; failure preserves values; duplicate retry is idempotent; a newly opened request clears prior values/errors.

## Dashboard widget contracts

### Widget governance — Workspace governance

- Existing roles: SUPER_ADMIN; module grant: `settings`; kind: links; preview data key: `governance`.
- Proposed query: `GET /api/v1/dashboard/widgets/governance/data`. Reuse the owning domain projection for settings; never return the entire workspace fixture.
- Accept only permitted filter keys and bounded results. Include asOf/empty/error semantics; apply role AND data scope on the server. Revalidate saved layout after permission change.
- Verify keyboard/touch placement, invalid import, user/console isolation, unauthorized data denial and stale query cancellation.

### Widget access — Access review

- Existing roles: SUPER_ADMIN; module grant: `settings`; kind: list; preview data key: `access`.
- Proposed query: `GET /api/v1/dashboard/widgets/access/data`. Reuse the owning domain projection for settings; never return the entire workspace fixture.
- Accept only permitted filter keys and bounded results. Include asOf/empty/error semantics; apply role AND data scope on the server. Revalidate saved layout after permission change.
- Verify keyboard/touch placement, invalid import, user/console isolation, unauthorized data denial and stale query cancellation.

### Widget connectors — Integration readiness

- Existing roles: SUPER_ADMIN; module grant: `integrations`; kind: list; preview data key: `connectors`.
- Proposed query: `GET /api/v1/dashboard/widgets/connectors/data`. Reuse the owning domain projection for integrations; never return the entire workspace fixture.
- Accept only permitted filter keys and bounded results. Include asOf/empty/error semantics; apply role AND data scope on the server. Revalidate saved layout after permission change.
- Verify keyboard/touch placement, invalid import, user/console isolation, unauthorized data denial and stale query cancellation.

### Widget platform-checklist — Launch readiness

- Existing roles: SUPER_ADMIN; module grant: `settings`; kind: list; preview data key: `platform-checklist`.
- Proposed query: `GET /api/v1/dashboard/widgets/platform-checklist/data`. Reuse the owning domain projection for settings; never return the entire workspace fixture.
- Accept only permitted filter keys and bounded results. Include asOf/empty/error semantics; apply role AND data scope on the server. Revalidate saved layout after permission change.
- Verify keyboard/touch placement, invalid import, user/console isolation, unauthorized data denial and stale query cancellation.

### Widget hr-priorities — Today’s HR priorities

- Existing roles: HR_MANAGER; module grant: `people_core`; kind: list; preview data key: `hr-priorities`.
- Proposed query: `GET /api/v1/dashboard/widgets/hr-priorities/data`. Reuse the owning domain projection for people_core; never return the entire workspace fixture.
- Accept only permitted filter keys and bounded results. Include asOf/empty/error semantics; apply role AND data scope on the server. Revalidate saved layout after permission change.
- Verify keyboard/touch placement, invalid import, user/console isolation, unauthorized data denial and stale query cancellation.

### Widget hr-pipeline — Onboarding pipeline

- Existing roles: HR_MANAGER; module grant: `onboarding`; kind: bars; preview data key: `hr-pipeline`.
- Proposed query: `GET /api/v1/dashboard/widgets/hr-pipeline/data`. Reuse the owning domain projection for onboarding; never return the entire workspace fixture.
- Accept only permitted filter keys and bounded results. Include asOf/empty/error semantics; apply role AND data scope on the server. Revalidate saved layout after permission change.
- Verify keyboard/touch placement, invalid import, user/console isolation, unauthorized data denial and stale query cancellation.

### Widget hr-approvals — Approval queue

- Existing roles: HR_MANAGER; module grant: `leaves`; kind: list; preview data key: `hr-approvals`.
- Proposed query: `GET /api/v1/dashboard/widgets/hr-approvals/data`. Reuse the owning domain projection for leaves; never return the entire workspace fixture.
- Accept only permitted filter keys and bounded results. Include asOf/empty/error semantics; apply role AND data scope on the server. Revalidate saved layout after permission change.
- Verify keyboard/touch placement, invalid import, user/console isolation, unauthorized data denial and stale query cancellation.

### Widget hr-actions — HR shortcuts

- Existing roles: HR_MANAGER; module grant: `people_core`; kind: links; preview data key: `hr-actions`.
- Proposed query: `GET /api/v1/dashboard/widgets/hr-actions/data`. Reuse the owning domain projection for people_core; never return the entire workspace fixture.
- Accept only permitted filter keys and bounded results. Include asOf/empty/error semantics; apply role AND data scope on the server. Revalidate saved layout after permission change.
- Verify keyboard/touch placement, invalid import, user/console isolation, unauthorized data denial and stale query cancellation.

### Widget learning — Learning priorities

- Existing roles: HR_MANAGER; module grant: `learning`; kind: bars; preview data key: `learning`.
- Proposed query: `GET /api/v1/dashboard/widgets/learning/data`. Reuse the owning domain projection for learning; never return the entire workspace fixture.
- Accept only permitted filter keys and bounded results. Include asOf/empty/error semantics; apply role AND data scope on the server. Revalidate saved layout after permission change.
- Verify keyboard/touch placement, invalid import, user/console isolation, unauthorized data denial and stale query cancellation.

### Widget hr-payroll — Payroll checklist

- Existing roles: HR_MANAGER; module grant: `payroll`; kind: list; preview data key: `hr-payroll`.
- Proposed query: `GET /api/v1/dashboard/widgets/hr-payroll/data`. Reuse the owning domain projection for payroll; never return the entire workspace fixture.
- Accept only permitted filter keys and bounded results. Include asOf/empty/error semantics; apply role AND data scope on the server. Revalidate saved layout after permission change.
- Verify keyboard/touch placement, invalid import, user/console isolation, unauthorized data denial and stale query cancellation.

### Widget my-day — My day

- Existing roles: EMPLOYEE; module grant: `attendance`; kind: list; preview data key: `my-day`.
- Proposed query: `GET /api/v1/dashboard/widgets/my-day/data`. Reuse the owning domain projection for attendance; never return the entire workspace fixture.
- Accept only permitted filter keys and bounded results. Include asOf/empty/error semantics; apply role AND data scope on the server. Revalidate saved layout after permission change.
- Verify keyboard/touch placement, invalid import, user/console isolation, unauthorized data denial and stale query cancellation.

### Widget my-leave — My leave overview

- Existing roles: EMPLOYEE; module grant: `leaves`; kind: metrics; preview data key: `my-leave`.
- Proposed query: `GET /api/v1/dashboard/widgets/my-leave/data`. Reuse the owning domain projection for leaves; never return the entire workspace fixture.
- Accept only permitted filter keys and bounded results. Include asOf/empty/error semantics; apply role AND data scope on the server. Revalidate saved layout after permission change.
- Verify keyboard/touch placement, invalid import, user/console isolation, unauthorized data denial and stale query cancellation.

### Widget my-learning — My learning

- Existing roles: EMPLOYEE; module grant: `learning`; kind: bars; preview data key: `my-learning`.
- Proposed query: `GET /api/v1/dashboard/widgets/my-learning/data`. Reuse the owning domain projection for learning; never return the entire workspace fixture.
- Accept only permitted filter keys and bounded results. Include asOf/empty/error semantics; apply role AND data scope on the server. Revalidate saved layout after permission change.
- Verify keyboard/touch placement, invalid import, user/console isolation, unauthorized data denial and stale query cancellation.

### Widget my-actions — My shortcuts

- Existing roles: EMPLOYEE; module grant: `people_core`; kind: links; preview data key: `my-actions`.
- Proposed query: `GET /api/v1/dashboard/widgets/my-actions/data`. Reuse the owning domain projection for people_core; never return the entire workspace fixture.
- Accept only permitted filter keys and bounded results. Include asOf/empty/error semantics; apply role AND data scope on the server. Revalidate saved layout after permission change.
- Verify keyboard/touch placement, invalid import, user/console isolation, unauthorized data denial and stale query cancellation.

### Widget recognition — Moments of recognition

- Existing roles: EMPLOYEE; module grant: `experience`; kind: list; preview data key: `recognition`.
- Proposed query: `GET /api/v1/dashboard/widgets/recognition/data`. Reuse the owning domain projection for experience; never return the entire workspace fixture.
- Accept only permitted filter keys and bounded results. Include asOf/empty/error semantics; apply role AND data scope on the server. Revalidate saved layout after permission change.
- Verify keyboard/touch placement, invalid import, user/console isolation, unauthorized data denial and stale query cancellation.

### Widget my-documents — My documents

- Existing roles: EMPLOYEE; module grant: `payroll`; kind: links; preview data key: `my-documents`.
- Proposed query: `GET /api/v1/dashboard/widgets/my-documents/data`. Reuse the owning domain projection for payroll; never return the entire workspace fixture.
- Accept only permitted filter keys and bounded results. Include asOf/empty/error semantics; apply role AND data scope on the server. Revalidate saved layout after permission change.
- Verify keyboard/touch placement, invalid import, user/console isolation, unauthorized data denial and stale query cancellation.

### Widget support — Need a hand?

- Existing roles: HR_MANAGER, EMPLOYEE; module grant: `helpdesk`; kind: links; preview data key: `support`.
- Proposed query: `GET /api/v1/dashboard/widgets/support/data`. Reuse the owning domain projection for helpdesk; never return the entire workspace fixture.
- Accept only permitted filter keys and bounded results. Include asOf/empty/error semantics; apply role AND data scope on the server. Revalidate saved layout after permission change.
- Verify keyboard/touch placement, invalid import, user/console isolation, unauthorized data denial and stale query cancellation.

## App Router service wiring inventory

Every current route requires method-specific contract, role/scope and rollback tests before live cutover. Controller ownership below comes from source imports; it does not certify the handler.

| Controller | Declared methods | Imported service domains | Target acceptance |
| --- | --- | --- | --- |
| src/app/api/agent/route.js | POST | Authentication/public transport; inspect boundary | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/workspace-data/route.ts | GET | workspace | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/auth/login/route.js | POST | Authentication/public transport; inspect boundary | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/auth/[...all]/route.ts | GET, POST | Authentication/public transport; inspect boundary | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/attendance/days/route.ts | GET | platform, attendance | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/attendance/punches/route.ts | POST | platform, attendance | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/attendance/team-summary/route.ts | GET | attendance, platform | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/coff-grants/route.ts | POST | platform, leave | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/interview-scores/route.ts | POST | platform, interviews | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/attendance/days/[id]/recompute/route.ts | POST | platform, attendance | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/enrollments/[id]/complete/route.ts | POST | platform, learning | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/enrollments/route.ts | GET, POST | platform, learning | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/attendance/days/[id]/trace/route.ts | GET | platform, attendance | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/offers/route.ts | POST | platform, talent | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/organization/positions/route.ts | POST | platform, organization | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/candidates/[id]/resume/route.ts | POST | platform, talent | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/candidates/route.ts | POST | platform, talent | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/offers/[id]/transition/route.ts | POST | platform, talent | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/loans/[id]/repay/route.ts | POST | platform, loans | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/loans/[id]/route.ts | GET | platform, loans | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/home/route.ts | GET | engagement, talent, interviews, leave, notifications, organization, payroll, compliance, attendance, skills, platform | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/loans/[id]/consent/route.ts | POST | platform, loans | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/organization/tree/route.ts | GET | platform, organization | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/interview-plans/route.ts | POST | platform, interviews | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/succession-plans/route.ts | POST | platform, performance | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/loans/[id]/approve/route.ts | POST | platform, loans | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/loans/[id]/disburse/route.ts | POST | platform, loans | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/attendance/days/[id]/transition/route.ts | POST | platform, attendance | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/loans/route.ts | GET, POST | platform, loans | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/organization/departments/route.ts | POST | platform, organization | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/tenant/settings/route.ts | GET, PATCH | platform, admin | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/workspace/bootstrap/route.ts | GET | admin, identity, platform-admin, notifications, platform | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/people/[id]/route.ts | GET | platform, organization | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/people/route.ts | GET, POST | platform, organization | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/documents/[id]/download/route.ts | GET | platform, organization | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/contractors/agencies/route.ts | POST | platform, contractors | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/ops/audit-events/route.ts | GET | platform, ops | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/people/import-apply/route.ts | POST | platform, organization | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/documents/[id]/scan/route.ts | POST | platform, organization | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/documents/route.ts | POST | platform, organization | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/contractors/contracts/route.ts | POST | platform, contractors | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/payslips/[id]/route.ts | GET | platform, payroll | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/interview-sessions/[id]/scores/route.ts | GET | platform, interviews | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/platform/tenants/route.ts | GET, POST | platform-admin, platform | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/contractors/invoices/route.ts | GET, POST | platform, contractors | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/people/import-preview/route.ts | POST | platform, organization | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/interview-sessions/[id]/debrief/route.ts | POST | platform, interviews | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/job-postings/route.ts | GET, POST | platform, interviews | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/interview-sessions/route.ts | POST | platform, interviews | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/contractors/assignments/route.ts | POST | platform, contractors | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/requisitions/[id]/approve/route.ts | POST | platform, talent | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/requisitions/route.ts | POST | platform, talent | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/benefits/claims/route.ts | POST | platform, benefits | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/platform/tenants/[tenantId]/users/route.ts | GET, POST | platform-admin, platform | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/platform/tenants/[tenantId]/route.ts | PATCH | platform-admin, platform | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/key-results/route.ts | POST | platform, performance | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/benefits/plans/route.ts | POST | platform, benefits | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/integrations/connections/route.ts | GET, POST | platform, integrations | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/invitations/[id]/revoke/route.ts | POST | platform, admin | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/invitations/route.ts | POST | platform, admin | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/wage-simulations/route.ts | POST | platform, payroll | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/benefits/enrollments/route.ts | GET, POST | platform, benefits | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/integrations/catalog/route.ts | GET | platform, integrations | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/calibration-sessions/[id]/adjust/route.ts | POST | platform, performance | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/calibration-sessions/route.ts | POST | platform, performance | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/payroll-inputs/route.ts | GET, POST | platform, payroll | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/payroll-anomalies/[id]/resolve/route.ts | POST | platform, payroll | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/payroll-anomalies/route.ts | GET | platform, payroll | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/webhooks/deliveries/[id]/replay/route.ts | POST | platform, integrations | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/webhooks/deliveries/route.ts | GET | platform, integrations | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/memberships/roles/route.ts | POST | platform, admin | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/offboarding/items/[id]/clear/route.ts | POST | platform, lifecycle | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/benefits/options/route.ts | POST | platform, benefits | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/auth/registration-state/route.ts | GET | identity | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/reports/team-history/route.ts | GET | platform, vp | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/learning-paths/route.ts | POST | platform, learning | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/referrals/[id]/award/route.ts | POST | platform, engagement | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/webhooks/inbound/route.ts | GET | platform, integrations | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/checkins/route.ts | POST | platform, performance | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/ops/scheduled-tasks/[id]/cancel/route.ts | POST | platform, ops | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/ops/scheduled-tasks/route.ts | GET, POST | platform, jobs, ops | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/delegations/[id]/revoke/route.ts | POST | platform, delegation | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/delegations/route.ts | GET, POST | platform, delegation | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/payroll-runs/[id]/finalize/route.ts | POST | platform, payroll | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/payroll-runs/[id]/route.ts | GET | platform, payroll | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/webhooks/secrets/route.ts | POST | platform, integrations | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/ops/access-events/route.ts | GET | platform, ops | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/regularizations/[id]/decide/route.ts | POST | platform, attendance | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/regularizations/route.ts | POST | platform, attendance | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/offboarding/cases/[id]/settle/route.ts | POST | platform, lifecycle | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/offboarding/cases/route.ts | POST | platform, lifecycle | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/announcements/route.ts | GET, POST | platform, engagement | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/job-descriptions/[id]/approve/route.ts | POST | platform, talent | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/job-descriptions/route.ts | POST | platform, talent | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/payroll-runs/[id]/approve/route.ts | POST | platform, payroll | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/webhooks/endpoints/route.ts | POST | platform, integrations | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/review-cycles/route.ts | POST | platform, performance | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/survey-runs/[id]/results/route.ts | GET | platform, engagement | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/survey-runs/route.ts | POST | platform, engagement | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/ai/reviews/[id]/decide/route.ts | POST | platform, ai | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/payroll-runs/[id]/calculate/route.ts | POST | platform, payroll | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/ai/reviews/route.ts | POST | platform, ai | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/webhooks/subscriptions/route.ts | POST | platform, integrations | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/exports/[id]/build/route.ts | POST | platform, exports | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/exports/[id]/route.ts | GET | platform, exports | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/exports/route.ts | GET, POST | platform, exports | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/roles/[id]/permissions/route.ts | POST | platform, admin | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/roles/route.ts | POST | platform, admin | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/employee-skills/route.ts | GET | platform, skills | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/payroll-runs/[id]/correct/route.ts | POST | platform, payroll | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/ops/outbox/[id]/retry/route.ts | POST | platform, ops | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/webhooks/inbound/[connectionId]/route.ts | POST | platform, integrations | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/objectives/route.ts | POST | platform, performance | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/payroll-runs/route.ts | GET, POST | platform, payroll | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/ops/outbox/route.ts | GET | platform, ops | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/search/route.ts | GET | platform, organization | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/salary-advances/[id]/route.ts | GET | platform, advances | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/payroll-runs/[id]/journal/route.ts | GET | platform, payroll | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/ai/runs/[id]/route.ts | GET | platform, ai | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/ai/runs/route.ts | POST | platform, ai | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/analytics/metrics/route.ts | GET, POST | platform, analytics | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/surveys/route.ts | POST | platform, engagement | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/salary-advances/[id]/approve/route.ts | POST | platform, advances | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/feedback/route.ts | GET, POST | platform, performance | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/analytics/capability-index/[id]/route.ts | GET | platform, analytics | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/analytics/capability-index/route.ts | POST | platform, analytics | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/analytics/metric-snapshots/route.ts | POST | platform, analytics | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/salary-advances/[id]/pay/route.ts | POST | platform, advances | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/feedback/entries/route.ts | POST | platform, performance | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/salary-advances/route.ts | GET, POST | platform, advances | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/route.ts | GET | Authentication/public transport; inspect boundary | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/leave-balances/route.ts | GET | platform, leave | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/referrals/route.ts | POST | platform, engagement | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/notifications/[id]/read/route.ts | POST | platform, notifications | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/notifications/route.ts | GET | platform, notifications | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/review-participants/route.ts | POST | platform, performance | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/notifications/preferences/route.ts | POST | platform, notifications | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/fx/rates/route.ts | GET, POST | platform, fx | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/courses/route.ts | GET, POST | platform, learning | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/applications/[id]/dispose/route.ts | POST | platform, talent | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/ai/actions/[id]/execute/route.ts | POST | platform, ai | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/identity/memberships/route.ts | GET | identity, platform | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/applications/[id]/route.ts | GET | platform, talent | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/ai/actions/[id]/route.ts | GET | platform, ai | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/survey-responses/route.ts | POST | platform, engagement | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/shift-swaps/[id]/decide/route.ts | POST | platform, attendance | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/shift-swaps/route.ts | POST | platform, attendance | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/applications/[id]/score/route.ts | POST | platform, talent | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/onboarding/instances/[id]/readiness/route.ts | GET | platform, lifecycle | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/onboarding/instances/route.ts | GET, POST | platform, lifecycle | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/ai/actions/[id]/approve/route.ts | POST | platform, ai | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/identity/context/route.ts | GET, POST | identity, platform | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/applications/[id]/advance/route.ts | POST | platform, talent | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/recognition-events/route.ts | POST | platform, engagement | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/review-responses/route.ts | GET, POST | platform, performance | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/skill-evidence/route.ts | POST | platform, skills | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/gate-passes/route.ts | POST | platform, attendance | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/ai/actions/[id]/reverse/route.ts | POST | platform, ai | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/ai/actions/route.ts | POST | platform, ai | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/onboarding/templates/[id]/route.ts | PATCH | platform, lifecycle | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/onboarding/templates/route.ts | GET, POST | platform, lifecycle | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/compliance/obligations/route.ts | GET, POST | platform, compliance | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/leave-requests/route.ts | GET, POST | platform, leave | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/compliance/evidence/route.ts | POST | platform, compliance | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/leave-requests/[id]/early-return/route.ts | POST | platform, leave | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/ai/knowledge/route.ts | GET, POST | platform, ai | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/skill-evidence/[id]/verify/route.ts | POST | platform, skills | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/compensation/proposals/[id]/approve/route.ts | POST | platform, compensation | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/leave-requests/[id]/decide/route.ts | POST | platform, leave | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/compensation/proposals/route.ts | GET, POST | platform, compensation | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/gate-passes/[id]/decide/route.ts | POST | platform, attendance | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/privacy/requests/[id]/close/route.ts | POST | platform, privacy | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/privacy/requests/route.ts | POST | platform, privacy | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/applications/route.ts | GET, POST | platform, talent | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/privacy/holds/route.ts | POST | platform, privacy | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/compliance/forms/route.ts | GET | platform, compliance | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/privacy/holds/[id]/release/route.ts | POST | platform, privacy | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/compensation/bands/route.ts | POST | platform, compensation | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/ai/feedback/route.ts | POST | platform, ai | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/compensation/budgets/route.ts | POST | platform, compensation | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/compensation/cycles/route.ts | POST | platform, compensation | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/ai/evals/route.ts | POST | platform, ai | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/onboarding/tasks/[id]/complete/route.ts | POST | platform, lifecycle | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/vp/readiness/route.ts | GET, POST | platform, vp | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |
| src/app/api/v1/ai/evals/[id]/route.ts | GET | platform, ai | Schema, session, scope, idempotency where mutable, response minimization and failure/retry proof |

## Page entrypoints

Public pages use the shared public shell/content service; login uses the shared header and session boundary; workspace composes authorized feature views. Every entrypoint needs theme continuity, keyboard/mobile navigation and error rendering.

- `src/app/page.js`
- `src/app/(website)/docs/page.tsx`
- `src/app/(website)/about/page.tsx`
- `src/app/(website)/features/page.tsx`
- `src/app/(website)/why-nucleus/page.tsx`
- `src/app/(website)/contact/page.tsx`
- `src/app/(workspace)/login/page.tsx`
- `src/app/(workspace)/workspace/page.tsx`
