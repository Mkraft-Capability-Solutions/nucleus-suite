# Frontend review handoff

Local preview is configured in the ignored `.env.local` with JSON mode and demo access enabled. Start with `npm run dev` at the repository root and open `http://localhost:3000` for the public website or `http://localhost:3000/login` to sign in. Demo account: `superadmin@nucleus.com`, using the current shared demo password in ROLE_MODEL.md. See [the role model](engineering/ROLE_MODEL.md) for all five accounts.

## Delivered

- Public Home, About, Features, Why Nucleus, Docs, Contact and Login routes. The contact preview prepares a downloadable draft; it does not send messages.
- Personal dashboards for Superadmin, HR Manager and Employee, with role-filtered widgets, drag handles, editable presentation, undo/redo, presets and six named local layouts per account/console.
- Nucleus branding and five consistent `@nucleus.com` demo accounts; the shared password is documented in the role model at the user’s explicit request.

- Supplied `public/images/logo.png` on the login screen and navigation dock; supplied favicon set in App Router metadata, manifest and `/favicon.ico`.
- Moved image URLs checked against `public/images`; no unresolved local image references found.
- Shared JSON navigation catalog for the module chooser, right submenu and feature catalog, with direct MUI v7 icon imports. All 49 operational screens and main workspace destinations are represented.
- Keyboard-operable menu cards, search, modal role/focus handling, and a reusable workspace shortcut hook.
- Full README rewrite with local setup, actual directory structure, navigation, architecture and frontend-only scope.
- All 23 process workbook sheets captured in `WORKBOOK_UI_COVERAGE.json`; all 49 screen IDs matched. Screen-level process guidance added to operational views. Unimplemented requirements remain explicitly identified rather than marked complete.

## Verification

- Production build passed on Next.js 16.3.5.
- Typecheck and ESLint passed.
- Vitest: 724 passed, 21 skipped.
- UI/data contracts: 28 passed.
- Browser verification across completed runs: 24 workspace checks, 12 public-site/customization checks and 2 dark-editor checks passed across desktop Chromium and Pixel 7 viewport. Coverage includes all five accounts, public routing, logout, mouse/touch/keyboard drag, named layouts, imports, persistence and storage failures.
- Local root page and workspace-data endpoint returned HTTP 200 with `.env.local`, without test environment overrides.

No database schemas, ORM configuration or live server/service integrations were implemented in this phase. The existing backend remains for later work. Matching a screen ID is UI coverage, not complete implementation of the workbook's workflows, security, offline behavior or release gates. Review `WORKBOOK_UI_COVERAGE.md` before approving those features.
