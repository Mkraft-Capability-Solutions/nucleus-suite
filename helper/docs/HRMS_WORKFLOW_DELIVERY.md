# HRMS implementation status — 13 September 2026

Target: mkraft-hrms. NucleusUI is a read-only functional reference. This document supersedes the earlier navigation-only delivery notes.

## Delivered

The left dock and right feature rail follow the reference's business domains. Related registers share workflow tabs (at most three per module); inputs and individual API endpoints do not each receive a sidebar tab. Saved section URLs continue to work. Feature Catalog, search and navigation use one permission-aware catalogue.

The combined catalogue exposes **397 operations: 142 reads and 255 writes across 132 resource sections in 29 modules**. These counts describe implemented endpoint coverage, not certification of complete reference parity.

| Area | Implemented behavior |
|---|---|
| People Core | Employee identity, employment contracts, contact history, emergency contacts, dependants, bank/tax profiles and effective-dated assignment records. Versioned edits, tenant-local references and audit records. New/edited bank and tax attributes are encrypted. |
| HR Operations | Tickets with category, priority, subject, description, due date and owner; assignment, replies, resolution, closure and reopening. Team access excludes other employees' grievances. |
| Projects & allocation | Project activation/hold/closure; dated employee allocation, independent approval and release. Over-capacity allocations and closing a project with active allocations are rejected. |
| Travel, duty & expenses | Draft/edit/submit/return/approve/reject/cancel/complete travel; linked expense claims and reimbursement references. Self-service and reporting-team boundaries are enforced by the server. |
| Timesheets | Project-linked daily tasks, minutes and billing status; submission and independent approval. Inactive projects, out-of-project dates and totals above 1,440 minutes/day are rejected. |
| Assets | Registration, allocation, dated return/condition, maintenance, restoration and retirement. Custody changes also update canonical asset tables; outstanding assets block settlement. |
| Rosters | Dated shift/site plans with hours and breaks; approval, publication and withdrawal; overlapping approved/published plans rejected. See downstream integration limits below. |
| Career mobility | Career-move requests, effective dates, motivation/development plans, approval and completion records. Employment assignment changes remain explicit in People Core. |
| Payroll accounting | Effective GL component mappings with approval, posting generation and ERP acknowledgement. Missing mappings fail instead of using demo accounts. |
| Statutory | Generated form history, linked filing records, review, filing and acceptance acknowledgements. External filing is not fabricated. |
| Exit settlement | Reviewed earning/recovery lines and computed net, independent approval, finalized payroll reference, clearance/asset/loan checks, payment reference, canonical settlement and exit closure. Removed demo monthly proration. |
| My Inbox | Scope-filtered operational review queue, excluding own requests, unrelated reporting teams and restricted grievances; links to the owning register. Existing notification inbox retained. |
| Advanced controls | Eleven typed commands and their history, with dedicated permissions for policy, scope grants, attendance evaluation, leave maintenance, ERP, GL, statutory forms, HR records, manpower and controlled requisitions. |
| Existing modules | All previous supported recruitment, onboarding, payroll, loans, learning, performance, compensation, compliance and administrative forms remain grouped in their owning workflows. |

Forms support typed nested inputs and repeatable rows, document upload/download, permitted record actions, immutable selected record/version, validation failures without losing input, server-backed searchable choices where supported, pagination and audit history.

## Persistence and concurrency

Applied migration 0016 adds tenant-isolated operational records/events, encrypted dossier receipts and durable command request claims with forced RLS, bound SQL and tenant indexes. Mutations serialize capacity checks with writes, version checks, idempotency receipts and audit insertion in one transaction. Concurrent duplicate submissions return the original result; mismatched keys and stale edits are rejected.

Applied migration 0017 registers self/team permission names **without assigning those permissions to staff roles**. Existing owner-role permission policy was extended by 0016. Broader proposed grants are in PROPOSED_HRMS_ROLE_GRANTS.sql and have NOT been applied.

Command requests persist processing/completed/failed state. Some pre-existing advanced commands span multiple database operations. An interrupted or failed command requires reconciliation before retry; the wrapper refuses automatic duplicate execution.

## Validation

- Full regression checkpoint: 745 passed, 22 skipped. Skipped tests are not counted as verified.
- Final focused checks, including real PostgreSQL integration: 18 passed. The live test creates an isolated temporary tenant and removes only its fixture records.
- Live checks cover concurrent idempotency, key conflict, stale versions, self-approval, immutable action payloads, self/team scopes, approval-inbox isolation, daily-time limits, allocation capacity, project closure, canonical asset custody, dossier versioning and encryption at rest.
- Desktop/mobile browser contract checks cover course creation and travel submission/independent approval. Browser API traffic is intercepted; these are not authenticated acceptance checks against live business records.
- Production build and targeted ESLint passed. Desktop/mobile browser rerun: 4 passed. Repository-wide lint has pre-existing errors in unrelated untracked seeder scripts.

## Rollout decisions and configuration

1. **Default staff access — approval required.** Automatic approval review rejected applying persistent grants across employee, manager, HR, payroll and compliance roles. The exact proposed SQL is PROPOSED_HRMS_ROLE_GRANTS.sql. Employees receive their own helpdesk/travel/timesheet access; managers receive direct-team review; HR receives dossier and workforce operations; payroll receives settlement/accounting and expense review; compliance receives form/filing access. Bank/tax field access is not automatically granted to HR by this proposal. The SQL affects matching active roles across existing tenants; review that scope before applying it.
2. **Encryption key.** HRMS_FIELD_ENCRYPTION_KEY must be a durable, backed-up 64-character hex secret in every runtime writing or reading encrypted dossier records. A local ignored key is configured. Do not rotate or discard it without an explicit re-encryption procedure. It is not committed.
3. **Legacy sensitive-data conversion.** Automatic approval review rejected the bulk live backfill. It was not run. Legacy records remain readable under their existing field permissions; new/edited bank and tax records are encrypted. scripts/encrypt-dossier-records.cjs is dry-run by default; --apply performs the separately reviewable conversion.
4. **External services.** Configure and validate the real ERP, filing, banking, email/calendar and biometric providers before claiming external delivery. A stored payment or filing acknowledgement records an independently completed action; it does not initiate a transfer or government submission.
5. **Rollback.** Keep the new tables and encryption key when reverting application code. Do not drop workflow/audit/receipt tables or reverse data by deleting history. Export a database backup before any destructive migration. Reconcile processing/failed command requests before replaying them.

## Reference parity still requiring implementation or acceptance

REFERENCE_FORM_INVENTORY.json captures all 41 shared reference forms and 49 operational-screen definitions, including their fields. It was extracted from the reference source without executing or modifying it. Navigation similarity and endpoint counts do not establish field-by-field parity.

The following are deliberately not represented as complete:

- Published roster plans are persisted and reviewed, but are not yet the scheduling source consumed by the existing attendance calculator. Approved timesheets are not automatically payroll inputs.
- Mobility completion does not silently rewrite the employee master. Effective-dated assignments are recorded separately; automatic effective-date activation requires a defined scheduling/reconciliation process.
- Reference-specific one-on-one/focus calendars, wellbeing/return-to-work plans, device/biometric enrollment, profile-photo/settings actions and some specialised forms still need explicit domain mapping and provider-dependent behavior. Do not replace these with success-only buttons.
- Existing pre-change records in every canonical domain have not been bulk-imported into the new operational registers. Asset changes synchronize canonical custody for records created through the new workflow; no unapproved bulk conversion was performed.
- Complete authenticated joiner-to-payroll, recruitment-to-onboarding, loan-to-repayment, exit-to-payment and external delivery acceptance has not been run. The isolated database test covers the specific scenarios listed above.

## Reproduction

- npm run workflows:generate
- npx tsc --noEmit
- npm test
- npm run build
- Set MKRAFT_WORKFLOW_LIVE_VERIFY=1, then run npx vitest run src/server/workflows/operational-live.test.ts (requires configured test-capable database).
- Set MKRAFT_UI_PREVIEW=true in a local development environment, then run npx playwright test e2e/workflow-forms.spec.ts e2e/operational-workflows.spec.ts.

No production deployment or external message/payment/filing was performed by this work.
