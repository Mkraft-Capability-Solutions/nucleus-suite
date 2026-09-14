# Rule: Navigation Catalog System

## Single Source of Truth

**All navigation is defined exclusively in:**
```
src/data/ui/navigation.catalog.json
```

Never create navigation arrays, domain lists, or module items anywhere else.

## Catalog Structure

```json
{
  "domains": [
    {
      "id": "core_hr",
      "label": "Core HR",
      "groups": [
        {
          "id": "people",
          "items": [
            {
              "id": "people_core",
              "label": "People Core",
              "targetTab": "people_core",
              "icon": "Users",
              "description": "Employee directory and org structure"
            }
          ]
        }
      ]
    }
  ]
}
```

## Adding a New Module

1. Add the item to `navigation.catalog.json` under the appropriate domain and group
2. Add a case to the view dispatcher in `MainWorkspace.js`
3. Create the view component in `src/components/Clerio/`
4. Register the module in the permission system (`src/utils/permissions.js`)
5. Run `npm run data:manifest` to update the workspace manifest
6. Add navigation tests

## Breadcrumbs

Breadcrumbs must **dynamically reflect** the user's actual location. Format:
```
[Active Domain Name] / [Active Sub-module or Tab Name]
```

❌ Never hardcode:
```jsx
<Breadcrumb>Feature Catalog / Dashboard</Breadcrumb>
```

✅ Always derive dynamically:
```jsx
const domainLabel = getDomainLabel(activeTab);
const moduleLabel = getModuleLabel(activeTab);
<Breadcrumb>{domainLabel} / {moduleLabel}</Breadcrumb>
```

## Navigation IDs

Tab IDs must be consistent across:
- `navigation.catalog.json` (`item.id` and `item.targetTab`)
- `MainWorkspace.js` switch dispatcher
- `voiceCommandEngine.ts` TAB result targets
- Permission checks in `permissions.js`

Reference mapping:

| Tab ID | Domain | Component |
|:---|:---|:---|
| `people_core` | `core_hr` | `PeopleCoreView` |
| `attendance` | `workforce_ops` | `AttendanceView` |
| `leaves` | `core_hr` | `LeaveView` |
| `onboarding` | `core_hr` | `OnboardingView` |
| `team` | `core_hr` | `TeamView` |
| `payroll` | `payroll_finance` | `PayrollView` |
| `compensation` | `payroll_finance` | `CompensationView` |
| `compliance` | `core_hr` | `ComplianceView` |
| `recruitment` | `talent` | `RecruitmentView` |
| `performance` | `talent` | `PerformanceView` |
| `learning` | `talent` | `LearningView` |
| `experience` | `talent` | `ExperienceView` |
| `contract_workforce` | `workforce_ops` | `ContractWorkforceView` |
| `projects` | `workforce_ops` | `ProjectView` |
| `analytics` | `analytics_ai` | `AnalyticsView` |
| `helpdesk` | `core_hr` | `HelpdeskView` |
| `integrations` | `platform` | `IntegrationsView` |
| `access_control` | `platform` | `AccessControlView` |
| `settings` | `platform` | `SettingsView` |
| `dashboard` | `dashboard` | Console views (S1-S10) |
