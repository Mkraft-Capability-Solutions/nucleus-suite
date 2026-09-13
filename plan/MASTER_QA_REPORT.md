# Master QA implementation report — 13 September 2026

This delivery improves the active **JSON UI preview**. It does not complete the entire enterprise master request or activate the deferred database/services phase. The full acceptance text, evidence and remaining work are retained in `MASTER_QA_REQUIREMENTS.json`.

## 1. Files changed

- Public motion: `src/components/Website/PublicMotion.tsx`, its CSS module, `PublicPage.tsx`, `HomeStory.tsx`/CSS, `Website.module.css`, and the shared public login wrapper.
- Leave: new `src/components/Leave/` components, `src/services/leave-workflow.ts`, `leave-reference.ts`, `leaveEngine.js`, and integration in `HRMSContext.js`, `LeaveView.js`, `OperationalModuleView.js`.
- Shared forms: `ActionFormModal.js`/CSS, `FormValidationBoundary.tsx`, `src/lib/form-validation.ts`, MUI input theme, and `src/utils/csv.ts`.
- Data/localization: English interface namespace, leave policy/configuration JSON, regenerated workspace contracts/manifest.
- Verification: unit and Playwright regressions, reproducible source/form/theme audit scripts, engineering/source coverage documentation and this plan folder.

## 2. UI/UX improvements

All seven public routes have a contextual motion strategy: product perspective and restrained pointer tilt, mouse-position glow, scale/stagger feature grids, lateral docs reveals, scroll entrances, reading progress, bounded decorative parallax, CTA press feedback, disclosure and form feedback. Route changes reinitialize observers and cancel previous work. Reduced-motion changes cancel animations; touch devices do not receive mouse-follow effects. Ambient motion settles within five seconds. Content remains usable without animation.

## 3. Leave management

Both leave application entrypoints now share one asynchronous service and dialog. Fixed UTC date drift, incorrect balance clamping/restoration, wrong-type early-return credit, out-of-sequence approvals, self approval, stale actions, overlapping requests, fractional comp-off loss and unsorted FIFO consumption. Application reserves once; rejection/withdrawal/cancellation restores once. HR adjustments record reasons. Source IDs, worker eligibility, location holidays, weekly offs, birthday month, monthly caps, six-month waiting periods and incompatible leave combinations are retained/enforced. Comp-off grants are validated per debit date and restoration does not extend expiry. Added scoped request history, session activity, searchable employee selection, monthly calendar and real CSV export. Seven source requests remain explicitly read-only pending ledger reconciliation.

## 4. Forms and fields

SCR-030 retains default dates **2026-09-13**, required employee/type/from/to/Number of Days, inclusive auto-derivation, manual **0.5** steps (including the requested above-span override), optional reason/contact and usable mobile step controls. Generic forms retain configured dropdown options. Shared action forms await completion, prevent duplicate dispatch, retain entered values on failure and reset on a new dialog lifecycle. MUI dialogs provide focus management.

## 5. Validation

Shared validation rejects blank required values, invalid selection membership, non-finite numbers, invalid numeric constraints, bad precision/bounds, malformed dates/times, reversed dependent dates, invalid lengths and unchecked required checkboxes. Messages use localization resources. Leave commands validate identity, eligibility, available allocation, overlaps, status/version, review authority, rejection reason and dated credit validity before state replacement.

Static sweep: **460 JS/TS files, 24 forms, 15 intrinsic/MUI numeric controls, 22 metadata numeric fields**; zero missing numeric constraints or adjacent required-label candidates. These are heuristic findings, not proof that every business rule is correct.

## 6. Security

Leave commands reject foreign employee submissions, self approval, inappropriate manager tiers and stale decisions. Source names are resolved from stable IDs. CSV exports neutralize formula prefixes. No production credentials, migrations or authentication changes were introduced. Preview checks are not server authorization, durable audit or tenant isolation. The active/deferred API identifier and status mismatch remains documented.

## 7. Responsive design

Fixed the 320px landing artwork overflow by containing its decorative layer. Public theme/navigation behavior was checked on desktop/mobile; the broader suite covered 79 workspace views at four widths and two theme modes. New leave dialogs, cards and calendar use responsive MUI layouts. Removed duplicate input focus halos while retaining the MUI focus outline. Browser emulation does not replace real-device/iOS testing.

## 8. Testing performed

- TypeScript: passed.
- ESLint: passed; final added audit script check pending.
- Unit suite: **806 passed, 21 skipped**. Database-dependent tests remain unverified.
- UI contracts: **31 passed**.
- Initial full Playwright run: **82/90 passed**. Found/fixed actual 320px artwork overflow and unscoped public-menu test locators. Stable rerun resolved the development-refresh login failure without weakening authentication.
- Corrective public/theme/role run: **24/26 passed**; both failures were the newly added calendar test's required-label locator. Corrected locator; subsequent leave run **10/10 passed**.
- Final leave/public regression run: PENDING_BROWSER.
- Isolated production build: PENDING_BUILD.
- Reproducible inventories: **603 source/config/style files**, **239 literal background findings**, zero known fixed-dark surface patterns. Literal findings include charts, semantic colors, artwork and document previews and require context.
- Diff whitespace check: pending final review.

The original 90-case suite was not repeated in full after the later leave-only changes. Its failures were rerun individually and affected leave/public cases were rerun. Do not add these overlapping runs together as a unique-test total.

## 9. Remaining issues

- Active database/API migration, server authorization, transactions, durable audits/notifications and all-domain CRUD consistency remain deferred by repository scope.
- MK login personas are not linked to E workbook employees or EMP legacy examples. Partial historical paid ledgers cannot be silently treated as complete opening accounts.
- Scheduled accrual/carry-forward/encashment, dated grant administration, request-changes/resubmission, partial approval, delegation/escalation and reminder delivery are not complete. The unused legacy annual-credit helper must not be used for posting.
- Maternity/statutory eligibility, notice-period/evidence requirements, restricted dates and organization-specific policy administration need reviewed configuration. The continuous-absence interpretation for incompatible types is documented for policy-owner acceptance.
- Non-leave domain-specific validations, all table/bulk operations and live KPI accuracy are not fully verified. Existing synthetic workspace data remains preview data.
- No full screen-reader/WCAG certification, penetration test, load benchmark, real-device matrix or customer deployment verification was performed.

## 10. Requirements coverage

Counts refer to the **47 top-level groups** extracted from the master request, not individual bullets. A partially delivered group is counted as remaining.

- Total identified: **47**
- Implemented in full within the stated group scope: **13**
- Verified: **13**
- Partial or deferred: **34**

This is not 100% completion. `MASTER_QA_REQUIREMENTS.json` preserves every group's acceptance criteria, evidence and limitations; `MASTER_QA_IMPLEMENTATION.md` records policy and integration decisions.
