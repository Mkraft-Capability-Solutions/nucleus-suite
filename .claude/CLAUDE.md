# Nucleus HRMS — AI Agent Instructions (CLAUDE.md)

> This file is the authoritative guide for AI coding agents (Claude, Cursor, Codex, Cline, Windsurf, Antigravity) working in the **Nucleus HRMS** repository.
> For comprehensive agent rules, see [`AGENTS.md`](file:///Users/dhanraj/dhanraj/DFS/workspace/MKraft/nucleus-suite/AGENTS.md) at the repo root.

---

## 🚦 Current Phase: LOCAL JSON UI VALIDATION

This is a **prototype phase**. No production infrastructure is active. All mutations are in-memory.

**Do NOT activate:**
- Production databases (PostgreSQL / Drizzle migrations)
- External APIs (email, SMS, WhatsApp, ERP, payment gateways)
- Production authentication flows
- Live payroll disbursement or statutory filing

---

## ⚡ Quick Reference

### Stack
- **Framework:** Next.js App Router (read `node_modules/next/dist/docs/` before using any Next.js API)
- **UI Library:** MUI v7 (`@mui/material`, `@mui/icons-material`)
- **Language:** TypeScript (strict mode — no `any`, no suppressed errors)
- **Tests:** Vitest (`npm test`) — currently **824 passing**
- **State:** React Context API (`AuthContext`, `HRMSContext`, `I18nContext`, `AppearanceContext`)

### Critical Commands
```bash
npm run typecheck          # Must pass (0 errors) before any PR
npm run lint               # Must pass (0 warnings)
npm test                   # Must pass (824+ tests)
npm run build              # Must pass before declaring feature complete
npm run data:manifest      # Run after changing data/ui/ JSON files
```

### Navigation Catalog
The single source of truth for all navigation is:
```
src/data/ui/navigation.catalog.json
```
**Never** create inline navigation arrays in page components.

### Design Tokens
**Zero hardcoded colors.** Always use CSS custom properties:
```css
color: var(--text);           /* NOT: color: #0f172a */
background: var(--card);      /* NOT: background: #ffffff */
border: 1px solid var(--line); /* NOT: border: 1px solid #e2e8f0 */
```

### Data Access Pattern
```js
// ✅ Correct — use the readData boundary
const data = readData("components.ModuleName.ComponentName", "key");

// ❌ Wrong — never import raw fixture JSON into components
import employees from '../../../data/employees.json';
```

### i18n Pattern
```js
// ✅ Correct
const label = translateText("domain.screen", "key", { value1: name });
const text = readData("components.ModuleName.ComponentName", "label_key");

// ❌ Wrong — hardcoded JSX strings
<label>First Name</label>
```

---

## 📐 File Structure Quick Map

```
src/
├── app/api/v1/          # API routes (dormant — do NOT activate without authorization)
├── components/Clerio/   # All workspace views (PeopleCoreView, PayrollView, etc.)
├── components/Leave/    # Leave sub-components (LeaveApplicationDialog, etc.)
├── components/Dashboard/# 10 executive console dashboards + personalization
├── context/             # Auth, HRMS, i18n, Appearance providers
├── data/ui/             # JSON data catalogs — source of truth for prototype data
├── lib/                 # Pure business logic, rules engine, validation
├── server/              # Domain services (DORMANT — reference only in prototype)
├── services/            # Frontend service adapters (leave-workflow.ts, etc.)
├── utils/               # voiceCommandEngine.ts, permissions.js, csv.ts
└── types/               # Shared TypeScript types
```

---

## 🔒 Security Rules

1. **Never commit secrets, keys, or passwords** to any file.
2. The demo password `Nucl3u$123$ecure` is documented only in `ROLE_MODEL.md` — never copy it elsewhere.
3. Client-side role checks are **UI convenience only** — not security boundaries.
4. Hidden buttons/menus do not constitute authorization.

---

## 📋 Before Implementing Any Feature

1. Read `AGENTS.md` completely.
2. Run `git status` to understand existing uncommitted work.
3. Search for existing implementations: `grep -r "feature_name" src/`.
4. Check `documentation/implementation/IMPLEMENTATION_PLAN.md` for status.
5. Check `documentation/coverage/WORKBOOK_UI_COVERAGE.md` for screen mapping.
6. Run the full quality gate and confirm baseline before starting.

---

## Rules Index (`.claude/rules/`)

| Rule File | Coverage |
|:---|:---|
| [`leave-system.md`](./rules/leave-system.md) | Leave workflow, balance invariants, approval chain |
| [`voice-navigation.md`](./rules/voice-navigation.md) | Voice command engine, speech synthesis, audio constraints |
| [`design-tokens.md`](./rules/design-tokens.md) | CSS variable system, theme tokens, zero hardcoded colors |
| [`data-boundary.md`](./rules/data-boundary.md) | readData pattern, JSON fixtures, service adapters |
| [`attendance-system.md`](./rules/attendance-system.md) | Punch pairing, shift rosters, OT computation |
| [`payroll-engine.md`](./rules/payroll-engine.md) | Gross-to-net, PF/ESI/PT/TDS, payroll control room |
| [`navigation-catalog.md`](./rules/navigation-catalog.md) | Navigation catalog structure, breadcrumbs, routing |
| [`i18n-patterns.md`](./rules/i18n-patterns.md) | Translation patterns, 11 languages, RTL, readData |
| [`auth-and-roles.md`](./rules/auth-and-roles.md) | 5 demo roles, RBAC, console access, ABAC model |
| [`form-validation.md`](./rules/form-validation.md) | Form invariants, field controls, validation patterns |

## Skills Index (`.claude/skills/`)

| Skill File | Trigger When |
|:---|:---|
| [`implement-module-view.md`](./skills/implement-module-view.md) | Adding or extending a module view (PeopleCoreView, etc.) |
| [`add-voice-command.md`](./skills/add-voice-command.md) | Adding new voice commands to Nucleus Talk |
| [`add-dashboard-widget.md`](./skills/add-dashboard-widget.md) | Adding widgets to executive console dashboards |
| [`leave-workflow-changes.md`](./skills/leave-workflow-changes.md) | Modifying leave logic, balance, or approval |
| [`add-bulk-import.md`](./skills/add-bulk-import.md) | Implementing bulk import for any entity |
