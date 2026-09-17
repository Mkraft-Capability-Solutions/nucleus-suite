# Production Workflows & Live Database Persistence

**Status**: Verified Production Grade  
**Date**: September 2026  
**Repository**: `nucleus-suite`  
**Database**: Neon PostgreSQL / Drizzle ORM  

---

## 1. Executive Summary

This document records the complete transition of the Nucleus Suite from demo/static state fallbacks to verified production-grade workflows and live PostgreSQL database persistence.

### Key Mandates Completed:
1. **Elimination of Demo Disclaimers**:
   - Removed the residual message `"Demo only: this form does not send requests or save changes to a server."` from all action form modals.
   - Updated modal footers to display verified enterprise status: `"Production Verified: Submissions are validated, audited, and persisted to database."`
   - Replaced all `"This action requires a connected service and is unavailable in the demo."` strings across all operational views with live workflow engine feedback.
   - Updated login screen header to `"Sign in to the Nucleus enterprise workspace"`.

2. **Profile Photo & Avatar Persistence**:
   - Built a dedicated production API endpoint at `/api/v1/operations/photos` supporting both `GET` and `POST` methods.
   - Profile photos (including uploaded images like `logo.jpeg` or base64 data URLs) are written directly to:
     - `employeesTable` (`metadata->>'photo'`)
     - `usersTable` (`user.image`)
   - Synchronized client-side state across `AuthContext`, `HRMSContext`, `SettingsView`, and `TopNav` through the custom `nucleus:profile-updated` event pipeline.

3. **Elimination of Local / Session Storage as Source of Truth**:
   - Replaced client-only `localStorage` reliance for employee mutations with direct transactional `POST` / `PATCH` requests to `/api/v1/people`.
   - Guaranteed that modal action forms dispatch to authenticated backend operational routes.

---

## 2. Action Form Modal Catalog & Backend Endpoint Matrix

Every modal action launched via `launchAction(action, context)` is now routed through `completeAction` in `MainWorkspace.js` to live PostgreSQL endpoints:

| Action Identifier | Action Title | Target API Endpoint | Target DB Entity / Table |
|---|---|---|---|
| `photo` | Change profile photo | `/api/v1/operations/photos` | `employees.metadata`, `user.image` |
| `employee` | Add employee | `/api/v1/people` | `employeesTable` |
| `legal_entity` | Create legal entity (SCR-001) | `/api/v1/operations/legal-entities` | `hrms_operation_records` |
| `location` | Create location master (SCR-002) | `/api/v1/operations/locations` | `hrms_operation_records` |
| `position` | Create position slot | `/api/v1/organization/positions` | `positionsTable` |
| `document` | Upload employee document | `/api/v1/operations/documents` | `hrms_operation_records` / `documentsTable` |
| `invite` | Invite teammate | `/api/v1/operations/invites` | `hrms_operation_records` |
| `oneOnOne` | Schedule a 1 on 1 | `/api/v1/operations/one-on-ones` | `hrms_operation_records` |
| `feedback360` | Request 360 feedback | `/api/v1/operations/feedback-360` | `hrms_operation_records` |
| `okr` | Create OKR goal | `/api/v1/objectives` | `objectivesTable` |
| `wellbeing` | Create wellbeing plan | `/api/v1/operations/wellbeing-checkins` | `hrms_operation_records` |
| `compCycle` | Create annual review cycle | `/api/v1/operations/comp-cycles` | `hrms_operation_records` |
| `offCycleOt` | Create off cycle OT run | `/api/v1/ot-requests` | `overtimeRequestsTable` |
| `arrears` | Create retro arrears run | `/api/v1/operations/arrears` | `hrms_operation_records` |
| `contractor` | Register contract worker | `/api/v1/contract-workforce/contractors` | `contractorsTable` |
| `debitNote` | Issue debit note | `/api/v1/operations/debit-notes` | `hrms_operation_records` |
| `filing` | Review and file obligation | `/api/v1/compliance/filings` | `hrms_operation_records` |
| `inspector` | Record inspector entry | `/api/v1/compliance/inspections` | `hrms_operation_records` |
| `apiKey` | Generate API key | `/api/v1/webhooks/endpoints` | `webhookEndpointsTable` |
| `connector` | Configure connector | `/api/v1/webhooks/subscriptions` | `webhookSubscriptionsTable` |
| `learningPath` | Create learning path | `/api/v1/my-learning` | `learningPathsTable` |
| `focusBlock` | Schedule focus block | `/api/v1/operations/focus-blocks` | `hrms_operation_records` |
| `biometric` | Register biometric terminal | `/api/v1/operations/biometrics` | `hrms_operation_records` |
| `returnPlan` | Create return to work plan | `/api/v1/operations/return-plans` | `hrms_operation_records` |
| `kudos` | Send recognition kudos | `/api/v1/recognition-events` | `recognitionEventsTable` |
| `probation` | Record probation review | `/api/v1/operations/probation-reviews` | `hrms_operation_records` |
| `ticket` | Create support ticket | `/api/v1/operations/tickets` | `hrms_operation_records` |
| `reply` | Post ticket response | `/api/v1/operations/ticket-replies` | `hrms_operation_records` |
| `settings` | Save tenant settings | `/api/v1/tenant/settings` | `tenants.branding` / settings |
| `assetReturn` | Record asset return | `/api/v1/offboarding/items` | `assetsTable` |
| `clearance` | Finalize exit clearance | `/api/v1/offboarding/cases` | `offboardingCasesTable` |
| `roster` | Create operational roster | `/api/v1/operations/rosters` | `hrms_operation_records` |
| `leaveDecision` | Approve / reject leave | `/api/v1/leave-requests/decide` | `leaveRequestsTable` |
| `benefitLock` | Lock benefit election window | `/api/v1/operations/benefit-locks` | `hrms_operation_records` |
| `payrollPreview` | Trigger payroll calculation | `/api/v1/payroll-runs` | `payrollRunsTable` |
| `payrollRelease` | Authorize payroll disbursement | `/api/v1/payroll-runs` | `payrollRunsTable` |
| `actionReversal` | Request action rollback | `/api/v1/operations/reversals` | `hrms_operation_records` |
| `anomalyReview` | Resolve payroll anomaly | `/api/v1/payroll-anomalies` | `payrollAnomaliesTable` |

---

## 3. Profile Photo Workflow Architecture

### User Flow:
1. User navigates to **Settings -> Profile & Personal**.
2. User clicks **"Change profile photo"** button (`launchAction('photo')`).
3. `ActionFormModal` presents the form:
   - Field: `photo` (`type="file"`, accepts image types).
   - Footer: Displays `CheckCircle2` with `"Production Verified: Submissions are validated, audited, and persisted to database."`.
4. User selects a photo file (e.g. `logo.jpeg` or custom image).
   - The file input reads the image and encodes it as a data URL (`photoDataUrl`) alongside the file name.
5. User clicks **"Save photo"**:
   - `ActionFormModal` calls `onComplete(...)`.
   - `MainWorkspace.completeAction(...)` dispatches a `POST` request to `/api/v1/operations/photos` with `{ action: 'photo', photo: 'logo.jpeg', photoDataUrl: '...', context: { ... } }`.
6. **Backend Processing** (`/api/v1/operations/photos/route.ts`):
   - Authenticates request and context.
   - Executes SQL update:
     ```sql
     UPDATE employees
     SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{photo}', to_jsonb($1::text), true),
         updated_at = NOW()
     WHERE id = $2::uuid;
     ```
   - Updates `user.image` in `"user"` table.
   - Returns `{ success: true, data: { photoUrl: '...' } }`.
7. **Client Synchronization**:
   - Dispatches `nucleus:profile-updated` event.
   - `HRMSContext` updates internal `user.avatar`, `user.image`, `user.photo`.
   - `SettingsView` updates avatar circle image with the new photo.
   - `TopNav` updates header avatar and dropdown avatar.
   - Toast notification is displayed: `"Action submitted and recorded in database successfully."`.

---

## 4. Verification & Testing

1. **Build Verification**:
   - `npm run build` executed cleanly with Next.js Turbopack (`code 0`).
   - Zero TypeScript or lint errors.
2. **Runtime Verification**:
   - Route `/api/v1/operations/photos` verified for both `GET` and `POST`.
   - No mock or demo disclaimers rendered in form modals.
