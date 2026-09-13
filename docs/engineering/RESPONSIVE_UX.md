# Responsive UI and device behavior

The application is a responsive web preview. Screen size changes presentation, never authorization. No feature is granted or revoked by user agent or viewport width; the existing role and module permissions remain authoritative for this UI phase.

| Area | Phone | Tablet and desktop |
| --- | --- | --- |
| Public website | Single-column content, labeled Menu, full contact form | Expanded navigation and multi-column content |
| Sign-in | Scrollable at short heights and when the keyboard opens | Centered card |
| Workspace navigation | Header Modules menu with visible category labels; console, appearance, quick actions and profile remain accessible | Side rail, contextual navigation and header search where space permits |
| Employee, HR and superadmin dashboards | Single-column widgets, wrapping controls; touch handles and move buttons in the editor | Multi-column layouts; keyboard and pointer drag |
| Forms and dialogs | Stacked fields; bounded, scrollable dialogs | Wider grouped fields |
| Tables and calendar | Horizontal scrolling inside the data region; no omitted columns; focusable overflowing table wrappers | Full-width tables as space permits |
| Project boards | Horizontally scrollable columns | Multiple visible columns |
| Assistant and messages | Compact labeled-by-accessible-name buttons and viewport-bounded drawers | Expanded buttons and side drawers |
| Appearance | Semantic light/dark tokens, theme-aware MUI portals and native fields | Same |

Daily attendance, leave, payslip review, profile, tasks, requests and approvals should remain available on phones when permitted. Bulk imports, payroll comparisons, workflow design and extensive permission editing are more comfortable on a large screen, but are not artificially blocked on phones. Existing prototype/service limitations apply equally to all devices. Printed document previews intentionally retain a light paper palette; public pages have a consistent light brand palette independent of the workspace preference.

Use container queries for internal workspace layouts because the available width also depends on open navigation. Use dynamic viewport units for shells and dialogs. Do not mask layout errors with page-wide clipping, remove data columns, or hide essential actions solely to make an overflow test pass.

Regression checks: `e2e/responsive-audit.spec.ts` checks all 69 module entry views and ten dashboard consoles in both themes at 320, 390, 768 and 1440 CSS pixels. `e2e/responsive-interactions.spec.ts` covers public routes, short-height login, and all five role entry flows with dark widget dialogs. Existing workspace and customization tests cover the ten consoles, navigation and editing interactions. Screenshots and runtime checks are evidence for the tested states, not a guarantee for every possible device or nested workflow.

To test an already running local server, set `E2E_BASE_URL=http://localhost:3000`. Without this variable, Playwright starts its isolated server on port 3100. Keep credentials in `.env.local` or the CI secret store.
