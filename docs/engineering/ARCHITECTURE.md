# Architecture and implementation

## Current boundary

Next.js App Router hosts the application. React providers hold temporary interaction state. The browser obtains synthetic JSON via `/api/workspace-data` and `src/services/workspace-data.mjs`; `readData` reads the initialized snapshot. `/api/auth/login` verifies the preview password against server-held scrypt hashes. It does not establish a durable production session.

The current source structure is intentional:

```text
src/
├── app/          # App Router layouts, pages and route handlers
├── components/   # Shared and feature UI
├── context/      # Auth, HRMS and UI state providers
├── data/         # JSON fixtures, navigation and reference content
├── hooks/        # Reusable React hooks
├── lib/          # Shared contracts, configuration and registries
├── server/       # Server-only utilities; deferred backend remains gated
├── services/     # Existing HTTP/JSON adapter boundary
└── utils/        # Formatting and permission helpers
```

Do not add a second `src/lib/navigation-catalog.js`: `navigation-catalog.ts` already exists. Frontend navigation uses `workspace-navigation.js`. Avoid same-basename files with competing extensions.

## Change boundaries

- Keep business fixture content in JSON and transport behind services. Rendering strings and transient state are not database records; avoid blindly extracting executable logic into JSON.
- When adding resource keys, run `npm run data:manifest` and verify generated contracts. Never include account hashes in workspace resources.
- Prefer narrow components with clear inputs over growing the workspace switch renderer. New feature modules need explicit registry/navigation entries and a defined empty state.
- Model dates, money, units, stable IDs and statuses consistently. Preserve references across related fixtures. Do not equate a persona ID with an employee record unless the relationship is actually present.
- Operational mutations are in-memory previews. Dashboard presentation preferences use a separate browser-local async adapter and do not establish server persistence. Clearly label simulated delivery, approval, AI output or integration execution; do not show fabricated success for a failed request.
- Defer backend contracts requiring persistence, tenant enforcement and transaction design to the next approved phase. Before replacing the JSON adapter, define pagination, error shapes, cancellation, versioning, idempotency and authorization at the service boundary.

## Future planning

Plan capacity using measured record counts and latency budgets, then evaluate a 100x growth scenario with pagination, query budgets and bounded caches. Record cryptographic agility and quantum-threat assessment as future review items; neither custom cryptography nor unsupported “zero-latency” guarantees belong in this preview. Any future architecture diagram must label a Future-Proofing Layer covering growth and cryptographic migration responsibilities without claiming they are implemented.

## Public and workspace routes

Public pages use `src/components/Website` and the async server-only `public-content` adapter. They do not depend on the demo HR snapshot. `/login` and `/workspace` share the `(workspace)` route-group layout so in-memory identity survives sign-in navigation. A browser reload requires sign-in again, and logout returns to the public Home page.

Appearance is owned above both route groups by `src/context/AppearanceContext.tsx`. Its static JSON palette catalog contains design tokens only. `src/lib/appearance.ts` shares the same catalog between pre-paint preference restoration and interactive updates; `WorkspaceTheme` supplies matching MUI portal styles across the entire app. HRMS state exposes legacy mode aliases for existing charts, but does not reset or persist a separate theme.

Public navigation is rendered by `Website/PublicHeader.tsx` on both marketing and login pages. The workspace route-group server layout loads only public navigation fields through `getPublicContent` and passes them through `PublicSiteProvider`; login does not maintain a second menu catalog. Header regression tests compare destinations and logos on desktop and mobile.
