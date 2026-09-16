# Rule: Data Boundary & readData Pattern

## The Core Rule

**All UI data in the prototype phase flows through ONE boundary: `readData()`.**

The only exception is the leave service adapter (`leave-workflow.ts`), which has its own managed boundary.

## readData Pattern

```js
// Import at top of component
const { readData } = useHRMS();  // or inject via props from parent

// Usage — always provide namespace and key
const employeeName = readData("components.Clerio.PeopleCoreView", "employee_name_label");
const deptOptions = readData("components.Clerio.PeopleCoreView", "department_options");
```

The namespace format is: `components.{FolderPath}.{ComponentName}` or `data.{domain}.{key}`

## What Belongs in JSON Fixtures

✅ **Business data that drives UI rendering:**
- Employee records, attendance history, leave balances
- Navigation catalog items
- Dashboard widget configurations
- Picklist/dropdown options

❌ **Never in JSON fixtures:**
- Secrets, API keys, passwords
- Business logic or computed values (put these in service files)
- CSS values, styling configurations
- Route definitions (use navigation.catalog.json)

## Service Adapters — When to Use

For interactive mutations (not just reads), use service adapters:

| Service | Use For |
|:---|:---|
| `src/services/leave-workflow.ts` | Leave request mutations, balance updates |
| `src/services/dashboard-preferences.ts` | Widget layout persistence (browser-local) |
| `src/services/localization.ts` | Published translation catalog |

## What NOT to Do

```js
// ❌ Never import raw fixture JSON into a component
import employees from '../../../data/ui/employees.json';

// ❌ Never construct API calls from components (production phase only)
import { fetchEmployees } from '@/app/actions/peopleActions';
const res = await fetchEmployees();

// ❌ Never embed large data objects inline in components
const HARDCODED_DATA = [{ id: 1, name: "Alice" }, ...];
```

## Navigation Data

Navigation items are exclusively managed in:
```
src/data/ui/navigation.catalog.json
```

Access via `useHRMS()` context — the `domains` and module items are pre-loaded.  
**Never create a local array of navigation items in a page component.**

## Running the Manifest

After changing any file under `src/data/ui/`:
```bash
npm run data:manifest
```

This regenerates the workspace manifest and verifies all data contracts. Changes that break the manifest will fail the build.

## JSON File Naming Conventions

```
src/data/ui/
├── navigation.catalog.json          # Navigation domains and items
├── context.AuthContext.json         # Demo user personas
├── context.HRMSContext.json         # Global HRMS snapshot
├── dashboard.widgets.json           # Widget registry
├── leave.workflow.json              # Leave configuration and calendars
├── picklists.catalog.json           # Dropdown/select option catalogs
└── appearance.json                  # (handled by AppearanceContext — do not modify directly)
```

## Data Immutability in Prototype

Prototype data mutations are **in-memory only** — they reset on page refresh. This is by design for the UI validation phase. Never try to persist mutations to JSON files at runtime.
