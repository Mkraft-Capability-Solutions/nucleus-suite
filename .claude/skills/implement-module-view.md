# Skill: Implement a Module View

## When to Use
When adding or significantly extending any of the 18 module views (e.g., `PeopleCoreView`, `PayrollView`, etc.).

## Checklist

### 1. Pre-Implementation Research
- [ ] Read `documentation/implementation/IMPLEMENTATION_PLAN.md` — find the module's status and gaps
- [ ] Read `documentation/coverage/WORKBOOK_UI_COVERAGE.md` — identify the screen IDs (SCR-xxx)
- [ ] Check `src/data/ui/navigation.catalog.json` — verify the tab ID exists
- [ ] Search for the existing component: `find src/components -name "*ModuleName*"`
- [ ] Check if a server-side service exists: `ls src/server/{domain}/`

### 2. Component Structure

Each module view follows this standard pattern:

```jsx
"use client";
import React, { useState, useCallback } from 'react';
import { useHRMS } from '@/context/HRMSContext';
import { useAuth } from '@/context/AuthContext';
import styles from './ModuleNameView.module.css';

export default function ModuleNameView({ onTabChange }) {
  const { readData, translateText } = useHRMS();
  const { user, userRole } = useAuth();
  
  // Sub-tab state
  const [activeSubTab, setActiveSubTab] = useState('primary_tab');
  
  return (
    <div className={styles.container}>
      {/* KPI Strip — 4 metric cards */}
      <div className={styles.kpiStrip}>...</div>
      
      {/* Sub-tab navigation */}
      <div className={styles.subTabs}>...</div>
      
      {/* Content area */}
      <div className={styles.content}>
        {activeSubTab === 'primary_tab' && <PrimaryContent />}
      </div>
    </div>
  );
}
```

### 3. CSS Module Rules
- Zero hardcoded colors — use only `var(--token-name)` (see `design-tokens.md`)
- Class names in camelCase: `.kpiStrip`, `.subTabs`, `.dataGrid`
- Include loading, empty, and error state classes

### 4. Sub-Tab Pattern

```jsx
const SUBTABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'details', label: 'Details' },
];

<div className={styles.subTabBar}>
  {SUBTABS.map(tab => (
    <button
      key={tab.id}
      className={`${styles.subTab} ${activeSubTab === tab.id ? styles.active : ''}`}
      onClick={() => setActiveSubTab(tab.id)}
    >
      {tab.label}
    </button>
  ))}
</div>
```

### 5. KPI Metric Strip (4 cards)

Always render 4 stat cards at the top of each module view:

```jsx
<div className={styles.kpiStrip}>
  {[
    { label: 'Total Employees', value: '247', trend: '+12', color: 'var(--info)' },
    { label: 'Active', value: '231', trend: '+8', color: 'var(--status-ok)' },
    { label: 'On Leave', value: '11', trend: '-3', color: 'var(--pending)' },
    { label: 'Anomalies', value: '5', trend: '+2', color: 'var(--flag)' },
  ].map(kpi => (
    <div key={kpi.label} className={styles.kpiCard}>
      <span className={styles.kpiValue}>{kpi.value}</span>
      <span className={styles.kpiLabel}>{kpi.label}</span>
    </div>
  ))}
</div>
```

### 6. MainWorkspace Registration

After creating the component, add it to `MainWorkspace.js`:

```js
// In the view dispatcher switch/conditional
case 'your_tab_id':
  return <YourModuleView onTabChange={onTabChange} />;
```

### 7. Verification

```bash
npm run typecheck  # 0 errors
npm test           # all tests still pass
npm run build      # build succeeds
```

Visually verify in browser:
- [ ] All 4 themes render correctly
- [ ] Mobile layout doesn't overflow
- [ ] Empty state shows when no data
- [ ] Loading state shows (even if instant with JSON data)
- [ ] Role access works (try as EMPLOYEE — should be restricted if not permitted)
