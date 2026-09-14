# Rule: Form Validation Standards

## Field Control Mapping

Use the correct control for every data type. **Never use a plain text input where a dedicated control exists.**

| Data Type | Required Control |
|:---|:---|
| Date | Date picker (MUI `DatePicker`) |
| Date + Time | Date-time picker (MUI `DateTimePicker`) |
| Boolean | `Switch` or `Checkbox` |
| Fixed options (< 10) | `Select` / `RadioGroup` |
| Large option set | Searchable select / Autocomplete |
| Multiple selections | Multi-select / `Checkbox` group |
| Long text (> 100 chars) | `Textarea` |
| Number / integer | Numeric input with step |
| Currency (₹) | Currency input — format as `₹ 1,00,000` |
| Percentage | Numeric input with `%` suffix |
| Email | `type="email"` with RFC regex validation |
| Phone | Phone field with `+91` prefix validation |
| Password | `type="password"` with strength indicator |
| File upload | File uploader with MIME type filter |
| Employee picker | `LeaveEmployeeSelect` component or equivalent |

## Business Invariants (Must Enforce in UI)

```
INV-LEV-01: Leave balance >= 0 (no negative leave)
INV-LEV-02: No overlapping approved leave spans
INV-ATT-01: Punch IN time must be before OUT time
INV-SEC-02: No self-approval (leave, expense, salary revision)
INV-PAY-01: Basic + DA >= 50% of Total CTC (Code on Wages)
```

## Validation UX Pattern

Every important form must show:

```
1. Real-time inline validation (on blur or on change)
2. Disabled submit button when form is invalid
3. Clear error message below the field (not just red border)
4. Loading state on submit (spinner in button)
5. Success feedback (toast + optional form reset)
6. Error feedback (toast + scroll to first error)
7. Unsaved-changes warning before navigation
```

## MUI v7 Form Pattern

```tsx
// ✅ Correct MUI v7 form pattern
import { TextField, Select, MenuItem, FormControl, InputLabel } from '@mui/material';

<FormControl fullWidth size="small">
  <InputLabel id="leave-type-label">Leave Type</InputLabel>
  <Select
    labelId="leave-type-label"
    value={leaveType}
    label="Leave Type"
    onChange={(e) => setLeaveType(e.target.value)}
    error={!!errors.leaveType}
  >
    {leaveTypes.map(type => (
      <MenuItem key={type.id} value={type.id}>{type.label}</MenuItem>
    ))}
  </Select>
</FormControl>
```

## Dependent Fields Pattern

When a parent field changes, child fields must:
1. Show loading state
2. Fetch new options
3. Clear previously selected invalid values
4. Not retain a value that's no longer valid

```js
// Country → State → City cascade pattern
const handleCountryChange = (country) => {
  setCountry(country);
  setState('');    // ← clear child
  setCity('');     // ← clear grandchild
  loadStates(country); // ← fetch new options
};
```

## Required vs Optional Labeling

- Required fields: show `*` after the label — `"Leave Type *"`
- Optional fields: show `(optional)` in placeholder or helper text
- Never leave ambiguity about required state

## Form Submission Integrity Checklist

Before shipping any form, verify the complete chain:

```
✅ UI field name → service/API parameter name matches
✅ All required fields validated before submit
✅ Submit button disabled while loading
✅ Duplicate submission prevented (disable on first click)
✅ Error responses shown in UI (not just console.error)
✅ Success closes modal / resets form
✅ Data refreshes after success
```
