# Application audit — 13 September 2026

## Release decision

**Suitable for an explicitly enabled synthetic-data preview, not customer production.** A working build is not evidence of durable workflows, tenant isolation in the UI, regulatory compliance, or absence of defects. The customer release check intentionally fails while these integration gaps remain.

The review inventoried 414 JS/TS source files, 185 API handlers, 70 UI JSON resources, and 49 registered operational screens. It examined configuration and identity boundaries, service loading, representative workflow actions, exports/imports, accessibility, dependencies, backend authorization, and test quality. Automated navigation exercises the main modules, operational registry and consoles on desktop and mobile. This is not a claim that every possible interaction or backend state has been tested.

## Findings addressed

| Severity | Finding and evidence | Change |
| --- | --- | --- |
| Critical | Installed Next.js 16.1.6 had advisories reported by npm audit. | Updated Next.js and matching ESLint configuration to 16.3.5; lockfile updated. |
| High | SheetJS 0.18.5 exposed known parser vulnerabilities; npm has no patched release. | Use the official 0.20.3 tarball with lockfile integrity. Compatible transitive dependency updates removed remaining audit findings. |
| High | Disabling demo login did not disable `/api/workspace-data`. | Endpoint returns no fixture records and a non-cacheable 503 when demo access is disabled. |
| High | `AuthContext` trusted a saved email as identity without credential verification. | Removed browser identity restoration; each page session requires sign-in. Demo role switching is restricted to the demo administrator. |
| High | UI permission overrides and generic HR form contents persisted across users in shared browser storage. | Removed persistence of these values and reset permission state on logout. Existing legacy browser entries are no longer read. |
| High | MIS exports exposed risk values hidden by the table's role policy. | Both export formats share a redaction projection for compensation and risk; risk filtering is disabled for restricted roles. Production still needs server-side field projection. |
| High | CSV cells could be interpreted as spreadsheet formulas. | Escape formula prefixes, including leading whitespace/control characters, before CSV serialization. |
| High | The user-supplied auth secret had been disclosed. | Rotated the local `.env` secret; no secret added to examples or source. Hosted secrets must be independently rotated in the hosting environment. |
| Medium | Environment comments advertised an unimplemented database provider and unused settings. | Corrected `.env` and `.env.example`; added range, URL, trusted-origin and boolean validation. Added a separate production-readiness gate. |
| Medium | `NODE_ENV=production` in a shared environment conflicts with development; localhost is unsuitable for hosted auth. | Document framework-controlled execution mode; reject local/non-HTTPS hosted origins. Netlify requires its actual HTTPS origin. |
| Medium | Cookie/AI settings were ignored, and blank model identifiers defeated fallback defaults. | Wire session lifetime/SameSite and AI timeout/retry settings; normalize blank model values. |
| High | Better Auth was configured but lacked an HTTP catch-all route. | Added guarded GET/POST handlers. Missing database/auth configuration returns 503 before auth execution. UI session adoption is still outstanding. |
| Medium | Demo password hashing blocked the event loop; unknown accounts took a different expensive-hash path. | Use asynchronous scrypt for both existing and unknown accounts. Reject cross-origin and over-4-KiB sign-in requests. This is not distributed abuse protection. |
| Medium | Biometric and recovery forms claimed an unavailable authentication flow. | Removed these controls from login; clearly disclose demo capability limits. |
| Medium | Several export/download/audit buttons only opened success-sounding alerts. | Disable these unimplemented actions with explanatory JSON tooltips. No fabricated download claim. |
| Medium | Login inputs lacked explicit accessible names/autocomplete and allowed repeated submissions. | Add names, autocomplete, length limits, disabled/busy states and an announced error. Fixed global loading unmounting the form, which had erased failed-login messages. |
| Medium | Generic action modal lacked keyboard focus handling and Escape dismissal. | Focus the modal, cycle keyboard focus, restore focus on close, handle Escape. |
| Medium | Import had no format/size/row limit; export errors were unhandled. | Enforce CSV/XLS/XLSX, 5 MB and 10,000 rows; show export failures. Compressed expansion/worker isolation remains future hardening. |
| Medium | MIS row detail was available through a mouse-only row click. | Provide a named keyboard-accessible detail button. |
| Low | Demo record IDs used short random numbers and could collide. | Generate UUIDs for browser-created HRMS records. |
| Medium | Pages lacked basic response hardening. | Add no-sniff, frame denial, referrer/permissions policies and baseline CSP restrictions. A full script nonce CSP requires separate integration work. |
| Medium | Browser-only writes looked like durable server actions. | Persistent preview label, explicit generic-form notice, accurate session-only completion message. |

| Medium | Mobile hero clipped text; toast stacks obscured the workspace. | Stack hero content on narrow screens, constrain responsive grids and toast widths, show only the newest mobile toast, and check hero overflow in browser tests. |

## Architecture assessment

The backend is a modular monolith: Next route handlers call domain services under `src/server`, using Better Auth, tenant authorization, Drizzle and Neon PostgreSQL. Retaining this structure is appropriate until measured traffic or isolation requirements justify separate deployments. Splitting into microservices or introducing custom cryptography would not resolve the current UI integration bottleneck.

The frontend is a prototype composition with a large HRMS context and view-local state. Records and catalogs are loaded through an asynchronous JSON service, but its resource names mirror component files and some catalogs are evaluated at import time. The bootstrap snapshot contains the whole synthetic dataset. This provides a replacement boundary, but **does not provide a tenant-scoped, paginated domain API**. Copy, configuration, record DTOs and authorization policy should have separate versioned contracts when integrating the backend.

No quantum-resistant deployment, autonomous vulnerability patching, 100x scaling, or formally verified security is claimed. Keep cryptographic operations in maintained authentication/TLS libraries; a crypto-agility inventory and migration plan belong in the future-proofing work, not an invented custom algorithm.

## Remaining customer-release blockers

| Priority | Work | Acceptance evidence needed |
| --- | --- | --- |
| P0 | Connect UI login/logout/session refresh and tenant selection to Better Auth. | Real session cookies, expiry/revocation, inactive memberships, tenant changes and unauthorized access verified against disposable PostgreSQL. |
| P0 | Replace the public synthetic snapshot with authenticated domain projections; retain JSON as an explicit adapter. | Server rejects cross-tenant and forbidden-field reads; pagination, filters and scope are validated before data leaves the server. Never load all customer data then hide it in React. |
| P0 | Route every business mutation through a domain service. | Persistence across reload, server validation, permission checks, transactions, concurrency/idempotency, audit events and accurate failure UI for each enabled workflow. |
| P0 | Provision a real environment and verify migrations. | Actual HTTPS origin, private database, independent credentials, initial tenant/admin, migration status, backup and restore drill. No database credentials were supplied for this review. |
| P1 | Connect file storage and document processing. | Durable uploads/downloads, malware scanning, signed access, retention/deletion and failed-job recovery. Current file metadata is not an uploaded document. |
| P1 | Configure scheduled worker execution and operational monitoring. | Outbox job scheduling, retries/dead letters, delivery tracing, alerting, runtime health and external integration failures exercised on the host. |
| P1 | Reconcile scenario records and dashboard metrics. | Domain-owned DTOs and one canonical record set, KPI derivation and period/currency/timezone reconciliation across views. Moving sample values into JSON does not make independent scenario metrics consistent. |
| P1 | Replace specification-only tests with integration evidence. | Some tests such as `auth-lifecycle.test.ts` assert local constant tables and helper functions rather than the real auth implementation. Passing them does not prove session rotation, idle expiry, recovery or database policies. |
| P1 | Complete accessibility and interaction review across all workflow states. | Keyboard/screen-reader audit, focus behavior in remaining custom dialogs, contrast, errors, empty states, zoom and assistive technology tests. The shared modal fix does not certify every modal. |
| P1 | Performance and failure isolation. | Domain pagination; bounded imports in a worker; load tests and budgets; avoid full snapshot cloning on every hot render. Validate serverless bundle size and cold starts on Netlify. |
| P1 | Complete product actions currently disabled or simulated. | Real compliance receipts, PDF reports, contract documents, integration delivery and approval state transitions; then remove capability restrictions individually. |

## Environment decision

The pasted configuration is **not a working customer-production setup**. `json` is the only provider; `DEMO_AUTH_ENABLED=false` closes its workspace UI. An empty `DATABASE_URL` also leaves Better Auth unavailable. A localhost auth origin is for local use only. `LOG_LEVEL`, `DATABASE_POOL_MAX` and `DATABASE_TIMEOUT` do not have runtime consumers. Next.js manages `NODE_ENV`; Netlify manages its listener. The supported cookie and AI options now have real consumers and validation.

`.env` and `.env.example` intentionally keep demo access disabled. To inspect synthetic UI locally, run `DEMO_AUTH_ENABLED=true npm run dev`. To prepare a restricted Netlify preview, explicitly enable demo access in Builds and Functions and set the exact HTTPS site origin. Production should remain blocked until the P0 acceptance evidence exists.

## Validation

Final verification after the fixes:

| Check | Result |
| --- | --- |
| `npm run build` | Passed on Next.js 16.3.5, including environment preflight and production type checking. |
| `npm run typecheck` | Passed. |
| `npm run lint` | Passed with no reported errors or warnings. |
| `npm test` | 719 passed, 21 skipped; 65 test files passed, 17 skipped. |
| `npm run test:ui` | 25 passed. |
| `npm run test:e2e` | 10 passed across desktop Chromium and Pixel 7 viewport. Includes mobile hero overflow, navigation, failure/retry, login errors and forged-storage regression checks. |
| Dependency remediation | `npm audit fix` reported zero known vulnerabilities after the pinned package updates. |
| `npm run release:check` | Correctly failed: missing database and unimplemented tenant-scoped workspace reads/durable UI writes. |

Reviewed rendered desktop and mobile screenshots in `test-results/`. Browser checks start a development server; the separate production build verifies compilation, not deployed Netlify function behavior. Database integration tests require an isolated configured database and remain skipped when absent. Dependency audit is a point-in-time advisory check, not a proof of security. No deployment or database migration was performed.
