# Rule: i18n — Internationalization Patterns

## Core Principle

**All user-facing strings must use `readData()` or `translateText()`.** No hardcoded JSX text literals.

## 11 Supported Languages

| Code | Language | RTL? |
|:---:|:---|:---:|
| `en` | English (source) | No |
| `hi` | Hindi | No |
| `mr` | Marathi | No |
| `ta` | Tamil | No |
| `te` | Telugu | No |
| `bn` | Bengali | No |
| `es` | Spanish | No |
| `fr` | French | No |
| `de` | German | No |
| `ja` | Japanese | No |
| `ar` | Arabic | **Yes** |

## Translation Patterns

### Pattern 1: readData (component strings — most common)
```js
// In components that use HRMSContext
const { readData } = useHRMS();
const label = readData("components.Clerio.AttendanceView", "punch_in_label");
```

### Pattern 2: translateText (parameterized strings)
```js
const { translateText } = useHRMS();
// String template: "Welcome back, {value1}! You have {value2} pending approvals."
const greeting = translateText("components.Clerio.TopNav", "welcome_message", {
  value1: user.name,
  value2: pendingCount
});
```

### Pattern 3: useTranslation hook (i18n context)
```tsx
import { useTranslation } from '@/context/I18nContext';
const { t } = useTranslation();
const title = t('leave.application.title');
```

## Where New Strings Belong

New interface strings go in:
```
src/data/locales/en/interface.json
```

Use meaningful namespace/key names:
```json
{
  "leave": {
    "application": {
      "title": "Apply for Leave",
      "dateRange": "Leave Date Range",
      "typeLabel": "Leave Type"
    }
  }
}
```

**Do NOT put strings in `src/locales/translations.ts` directly** — that file is auto-generated. Add to the source locale files and run discovery scripts.

## What to NEVER Translate

- Route paths (`/workspace`, `/login`)
- Icon names
- Employee/record IDs (`MK-102`, `EMP-001`)
- CSS custom property names (`--signal`, `--text`)
- Validation invariant codes (`INV-LEV-01`)
- Status keys (`APPROVED`, `PENDING`)

## Number & Currency Formatting

Format numbers and currency according to the active locale:
```js
// ✅ Correct — locale-aware
const formatted = new Intl.NumberFormat('hi-IN', { 
  style: 'currency', 
  currency: 'INR' 
}).format(amount);

// ❌ Wrong — hardcoded format
const formatted = `₹${amount.toFixed(2)}`;
```

## Date Formatting

```js
// ✅ Correct — locale-aware date formatting
const dateStr = new Intl.DateTimeFormat('en-IN', { 
  dateStyle: 'medium' 
}).format(date);

// ❌ Wrong
const dateStr = date.toLocaleDateString();
```

## RTL Layout (Arabic)

Arabic requires RTL layout. When implementing RTL support:
- Use `dir="rtl"` on the HTML root or layout
- Use logical CSS properties: `margin-inline-start` instead of `margin-left`
- MUI v7 supports RTL via `createTheme({ direction: 'rtl' })`

> ⚠️ Full RTL layout for Arabic is **not yet implemented** — deferred. When adding new CSS, use logical properties where possible to ease future RTL support.

## Verifying Translations

After adding new strings, run:
```bash
node scripts/verify-interface-copy.mjs
```

This checks that all translation references resolve and scans for unharvested JSX text literals.
