# UI, testing and delivery

## Feature acceptance

Each change needs a concrete user/role, trigger, expected outcome, error behavior and data source. For workbook requirements, reference source sheet/cell IDs and update `docs/WORKBOOK_UI_COVERAGE.md` through `scripts/generate-process-ui-map.py` when mappings change. A rendered screen is not evidence that its approvals, persistence or integrations work.

Target [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/): keyboard-operable controls, visible focus, meaningful labels, sufficient contrast, accessible status/error announcements, focus restoration in dialogs, usable zoom/reflow and reduced-motion support. Test desktop and narrow mobile layouts. Do not claim conformance without an accessibility audit.

Tables and dashboards need explicit units/currency, locale-aware dates, honest totals, stable keys, clear filters, empty/loading/error states and contextual actions. Never use a misleading aggregate when only one page of data is loaded. Destructive changes need deliberate confirmation; routine navigation should not.

## Checks

Run from the repository root with Node 22:

```sh
npm run data:manifest
npm run typecheck
npm run lint
npm test
npm run test:ui
npm run build
npm run test:e2e
```

Regenerate the manifest only when resources/fields changed. Run build and dev/browser checks sequentially. Browser tests need `DEMO_TEST_PASSWORD` from a local/CI secret and a Playwright Chromium installation; use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` when pointing to an installed Chrome. Do not put the password in commands committed to the repo. Database-dependent skipped tests remain unverified, not passed.

Meaningful regression coverage includes all five logins, invalid login rejection, secret-free responses, default consoles, inaccessible role destinations, data-service failure/retry and desktop/mobile navigation. Test authorization at the server boundary when production services become authorized; UI tests cannot prove tenant isolation.

## Delivery

Before a UI handoff, report changed behavior, exact test results and remaining gaps. Keep README startup steps and environment examples synchronized. Customer production deployment on either Vercel or Netlify must pass `npm run release:check` for the intended environment. Explicitly authorized synthetic UI previews use `npm run build` and hosted smoke checks; this does not satisfy the customer production gate. Never copy local demo opt-ins into a customer production site. Do not claim production readiness from `next build` alone.

Use the existing proprietary license and lockfile. Review dependency changes for provenance, licenses and advisories; record unresolved risk. Avoid unrelated package upgrades, broad formatting churn and premature repository reorganizations.
