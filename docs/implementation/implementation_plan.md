# Master HRMS Enterprise Implementation Plan

This plan consolidates all prior instructions and documents a single source of truth for the remaining enterprise production readiness tasks, ensuring the application remains 100% build-stable while migrating backend architectures and refining the UI structure.

## User Review Required

> [!IMPORTANT]
> **Component Renaming Impact**
> Renaming the `src/components/Clerio` directory to `src/components/Workspace` will require updating imports in approximately 60+ files. We will perform this carefully to ensure zero downtime and build breakage. Do you approve this specific new name (`Workspace`), or would you prefer another name like `AppShell` or `CoreApp`?

> [!WARNING]
> **Tab Synchronization Complexity**
> Fixing the Right Sub-Navigation (`RightSubNav.js`) to trigger specific active tabs in the middle pane (e.g., inside `PeopleCoreView.js`, `LeaveView.js`) requires passing the `activeSubFeature` prop down into these views and translating the string IDs (e.g., `employee_records`) into MUI Tab indices (e.g., `0`, `1`). We will implement a `useEffect` synchronization block in each View component to handle this.

## Open Questions

> [!CAUTION]
> **Helper Code Migration Strategy**
> We will establish `src/server/v1` as our primary stable architecture. We will stage the copied helper code in `src/server/v2/`. Features will be gradually refactored and moved from `v2` into `v1`. Once a feature is fully migrated to `v1`, the corresponding `v2` file will be renamed with a `.bak` extension to preserve a rollback state without polluting the active codebase.

## Proposed Changes

---

### Phase 1: Documentation Consolidation
Consolidate fragmented implementation docs into strict, single-source-of-truth markdown files.

#### [NEW] [MASTER_HRMS_ENTERPRISE_IMPLEMENTATION_PLAN.md](file:///home/thedhanraj/Raj/dhanraj/work/MKraft/nucleus-suite/docs/implementation/MASTER_HRMS_ENTERPRISE_IMPLEMENTATION_PLAN.md)
Create a comprehensive, 100% up-to-date master implementation plan that merges `IMPLEMENTATION_PLAN.md`, `DOMAIN_AUDIT_AND_ACTION_PLAN.md`, `MISSING_SERVICES.md`, and other legacy planning files. 

#### [NEW] [SIDEBAR_AND_NAVIGATION_MAP.md](file:///home/thedhanraj/Raj/dhanraj/work/MKraft/nucleus-suite/docs/implementation/SIDEBAR_AND_NAVIGATION_MAP.md)
Create a detailed map of all Left Sidebar menus, submenus, Right Sub-Navigation links, their destination views, and specific tab synchronization points.

#### [DELETE] Redundant documentation files
Delete all other fragmented `.md` files in the `docs/implementation` directory (e.g., `MISSING_SERVICES.md`, `goal_for_implementation_plan.md`, etc.) to prevent AI and human context loss.

---

### Phase 2: Navigation & Tab Synchronization
Ensure that clicking an item in `RightSubNav.js` correctly activates the corresponding middle-pane tab.

#### [MODIFY] [RightSubNav.js](file:///home/thedhanraj/Raj/dhanraj/work/MKraft/nucleus-suite/src/components/Clerio/RightSubNav.js) & [MainWorkspace.js](file:///home/thedhanraj/Raj/dhanraj/work/MKraft/nucleus-suite/src/components/Clerio/MainWorkspace.js)
Pass down the `activeSubFeature` accurately and handle deep-link changes.

#### [MODIFY] Module Views (e.g., `PeopleCoreView.js`, `PayrollView.js`, `LeaveView.js`)
Introduce a `useEffect` hook that listens to the `activeSubFeature` prop and updates the MUI `value` (active tab index) accordingly.
- e.g., If `activeSubFeature === 'employee_records'`, set `activeTab = 0`.
- e.g., If `activeSubFeature === 'document_vault'`, set `activeTab = 1`.

---

### Phase 3: Component Renaming (Refactoring "Clerio")
Remove the meaningless `Clerio` folder name and replace it with a semantic naming convention.

#### [MODIFY] `src/components/Clerio/` → `src/components/Workspace/`
- Rename the folder.
- Execute a global find-and-replace to update all import paths from `@/components/Clerio/...` to `@/components/Workspace/...`.
- Verify the build via `npx tsc --noEmit` and `npm run build`.

---

### Phase 4: `helper/` Service Migration
Safely port logic from `helper/` while retaining frontend stability.

#### [MODIFY] `src/server/` Architecture (v1 vs v2)
1. **Analyze:** Cross-reference `helper/src/server` files with our current database tables.
2. **Stage in v2:** Copy specific engines into `src/server/v2/`.
3. **Refactor & Move to v1:** Gradually refactor the `v2` logic to perfectly match our Neon DB `schema.ts` and Next.js 15 route patterns, then move the finalized logic into `src/server/v1/`.
4. **Deprecate:** Rename the exhausted `v2` files to `.bak` (e.g., `leaveService.v2.ts.bak`).
5. **Wire:** Connect the new `v1` real services to our REST API routes without changing the API contract expected by the UI.

---

### Phase 5: Advanced Voice AI Integration
Enhance the existing TopNav Mic Icon with the advanced Voice AI logic found in the `helper` code, upgrading it to a premium Siri-like experience.

#### [MODIFY] `src/components/Workspace/TopNav.js` (Currently `Clerio/TopNav.js`)
- Integrate the advanced Voice AI capabilities from the `helper` codebase.
- Implement a floating, transparent, Siri-style animated orb/logo overlay that activates when the microphone is listening.
- Expand the AI's capabilities to handle more complex navigation and form-filling commands.

## Verification Plan

### Automated Tests
- Run `npm run build` after renaming `Clerio` to ensure no broken imports exist.
- Run `npx tsc --noEmit` to verify type integrity post-refactor.

### Manual Verification
1. Click through the Left Sidebar and observe the correct Middle pane loading.
2. Click through the Right Sidebar submenus and verify the Middle pane's specific tabs switch automatically.
3. Verify the `MASTER_HRMS_ENTERPRISE_IMPLEMENTATION_PLAN.md` file contains all necessary information.
