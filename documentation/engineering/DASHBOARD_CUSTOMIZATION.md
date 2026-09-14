# Dashboard customization

## Product behavior

The S10 Superadmin, S2 HR Manager and S8 Employee dashboards support:

- A different role-specific widget catalogue and default/focused presets.
- Pointer/touch dragging from dedicated handles; keyboard pickup with Space, arrow-key movement, Space to drop and Escape to cancel. Explicit earlier/later controls provide a non-drag alternative.
- Add/remove components, custom titles, one/two/full-width cards, item limits, density, two/three desktop columns and three accent palettes. Narrow screens stack widgets.
- Draft editing with Save/Cancel, a bounded 40-step undo/redo history and default/focused/blank presets.
- Up to six named layouts per account and console; create, rename, select and delete controls.
- Versioned JSON import/export of presentation metadata only, size limits, validation, duplicate removal and role/module revalidation.
- Storage failure messages that preserve the current draft; permission changes remove inaccessible widgets.
- The existing detailed console and downstream operational pages remain accessible.

## Boundaries

`src/lib/dashboard-layout.ts` owns the typed layout schema, validation and permission filtering. `src/services/dashboard-preferences.ts` is an async local-storage adapter. `src/data/ui/dashboard.widgets.json` provides widget definitions and synthetic content through the existing workspace service. Components live under `src/components/Dashboard/Personalization/`.

Local storage is a convenience, not an authorization source. Presentation metadata is namespaced by account, role and console. It contains no operational records or session credentials. Exported files do not grant access; imports intersect with the current widget allowlist. A role's module grant is required for both the widget and its navigation links.

Saved layouts survive browser reloads and sign-out. Unsaved drafts are discarded when leaving the dashboard; save first. Browser unload has an edit warning. Layouts are device-local and do not synchronize between tabs/devices; a later save on the same account can replace an earlier save. Operational data remains a synthetic preview. Real employee scoping, sessions, durable preference storage and concurrency controls require the approved backend phase.

## Verification

Unit tests cover malformed imports, bounded collections, identity separation, role/module checks and revoked widget filtering. Browser tests cover public routing, login/logout, editing, undo/redo, persistence, cancellation, keyboard dragging, named layouts, import permissions and storage failures on desktop and mobile.

The drag interactions use the documented [dnd-kit sortable preset and keyboard sensor](https://dndkit.com/legacy/presets/sortable/overview/). Do not remove keyboard controls when changing drag behavior.
