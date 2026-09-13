# JSON workspace data and service integration

The browser loads application data asynchronously from `GET /api/workspace-data`.
The route calls `getWorkspaceData()` in `src/server/workspace/repository.ts`, which
currently uses the JSON repository. Components do not import fixture JSON or
contain business-record arrays. View copy and configurable catalogs also live
in JSON; component code retains rendering, icons, interaction state, and calculations.

## Files and responsibilities

| File/directory | Responsibility |
| --- | --- |
| `src/data/workbook.json` | Canonical workbook sheets and operational records |
| `src/data/ui/*.json` | Per-view data, chart inputs, catalogs, copy, and demo state |
| `src/data/demo-accounts.json` | Server-only demo accounts and password hashes; never part of the workspace response |
| `src/data/assistant.json` | Navigation-assistant intents and responses |
| `src/data/workspace-manifest.ts` | Generated server-only JSON import map for Netlify bundling |
| `src/data/workspace-contract.mjs` | Generated resource/field names for response validation; no record values |
| `src/server/workspace/repository.ts` | Async data-provider boundary |
| `src/services/workspace-data.mjs` | HTTP loading, request coalescing, validation, cached reads, and defensive copies |
| `src/services/module-service.mjs` | Async operational-record selector |
| `src/services/auth-service.mjs` | Login transport; no offline credential fallback |
| `src/services/assistant-service.mjs` | Assistant transport; no fabricated successful network fallback |
| `src/components/WorkspaceDataBoundary.js` | Loading, error, cancellation-on-unmount, and explicit retry UI |

The response contract is `{ version: 1, resources: { ... } }`. Resources are
named by their owning view or domain, such as `context.HRMSContext`,
`components.Clerio.PayrollView`, and `lib.operational-module-registry`.
`workbook` contains the source workbook. Preserve existing keys when changing
values. Newly added resources or fields require `npm run data:manifest`.

A single bootstrap request loads the snapshot. `readData(resource, key)` reads
that snapshot after loading; it does not fetch on every render. It returns a
copy so form edits cannot mutate another consumer's source records. The
application shell is loaded after bootstrap because some view catalogs are
initialized at module scope. A failed or malformed response shows an error and
Retry button; it does not substitute invented records. Operational screens
with no source rows show an empty state.

## Editing data

1. Change values in the owning JSON file, preserving its shape and keys.
2. Run `npm run data:manifest` after adding/removing resources or keys.
3. Run `npm test`, `npm run test:ui`, and `npm run build`.
4. Reload the browser to fetch the new snapshot. The current cache lasts for
   the page lifetime; a server deployment does not mutate an open browser's state.

The workbook generator writes `src/data/workbook.json`. Its original workbook
input is external to this checkout; do not run it unless that input is available.
The checked-in JSON is sufficient to build and run the application.

## Connecting real backend services

Replace the implementation of `getWorkspaceData()` with authenticated domain
service calls or a database repository. Return the same versioned resource
contract to retain the current UI. Map database DTOs here instead of spreading
endpoint-specific transformations across components. The client service also
supports transport injection with `configureWorkspaceTransport`; configure it
before mounting/importing the application shell, not during an active session.

For a larger dataset, split bootstrap into per-domain endpoints and use async
selectors such as `listModuleRecords()`. Keep loading/error behavior and schema
validation at the service boundary. Do not send a production tenant's complete
data set to every role: the real provider must authenticate, authorize, and
filter records before returning them.

Demo sign-in is explicitly enabled with `DEMO_AUTH_ENABLED=true` and only runs
in JSON mode. It verifies server-side hashes but is **not** a production session
system. Replace it with Better Auth sessions and connect the UI identity to server sessions before serving customer data. Disable demo sign-in
with `DEMO_AUTH_ENABLED=false`; this also closes the workspace-data endpoint.
Unknown data modes fail closed until their
repository is implemented.

## Current write behavior

Forms and workflow actions update browser state. Generic form contents, identity,
and permission overrides are no longer persisted in localStorage. They do not write into the source JSON or persist to the
database. Signing out or switching users remounts HR state. User-selected PDF
metadata uses the real file name and size, but uploading the file to storage,
virus scanning, indexing, and durable document delivery are not implemented.

When integrating writes, implement domain mutation services with validation,
server authorization, and error handling, then update/invalidate the affected
read snapshots after a successful response. Do not attempt to persist changes
by writing bundled JSON from a Netlify function: deployment assets are not a
durable data store.

## Verification scope

Unit tests cover business services, data loading/coalescing, failed requests,
response validation, missing fields, defensive copies, and data-reference
integrity. Browser tests cover JSON bootstrap, credential rejection, service
retry, major modules, registered operational screens, and the dashboard
consoles on desktop and mobile. Database integration tests remain opt-in and
need a disposable configured database; they are not proof of a live production
backend when skipped. Coverage thresholds apply to the deterministic HR rules
and VP policy core, not the entire application.
