# Rule: Attendance System

## Scope
All code touching biometric punches, shift rosters, OT computation, gate passes, regularizations, and attendance records.

## Invariants

```
INV-ATT-01: Punch IN timestamp must always be before Punch OUT timestamp.
             A pair where OUT < IN is invalid and must be rejected.
INV-ATT-02: A single employee cannot have two concurrent active IN punches
             without an intervening OUT punch.
```

## Punch Pairing Rules

The attendance engine pairs `IN` and `OUT` punches chronologically:
- First IN of the day = start of shift
- Last OUT of the day = end of shift
- Intermediate punches (multiple IN/OUT) = gate passes

**Cross-midnight shifts** (e.g., 22:00 – 06:00) are handled — the shift day is assigned by the IN punch date, not the OUT punch date.

## Shift Roster Types

| Shift | Duration | Break |
|:---|:---:|:---|
| 8-Hour Day Shift | 8h | 30 min statutory meal break |
| 9-Hour Corporate | 9h | 60 min break |
| Cross-Midnight | Variable | Per roster configuration |

Breaks are **automatically deducted** from gross hours to compute net presence. Do not manually calculate breaks in UI components.

## Overtime Computation

OT = Net Present Hours − Scheduled Shift Hours (when > 0)

OT is capped per jurisdiction rules. The `src/server/attendance/service.ts` handles OT computation — **do not recompute OT in component code**.

## Gate Pass

- Max quota: **240 minutes / 2 instances per month** (configuration from workbook)
- Gate pass deducts from net attendance only if approved by manager
- Gate pass types: `PERSONAL` | `OFFICIAL_DUTY`
- Request must include: reason, duration (15/30/60/120 min), type

## Regularization

An attendance regularization corrects a missed punch or anomaly. Workflow:
```
Employee submits regularization → Manager reviews → HR approves → Payroll locks
```

**Status:** Regularization form exists; full approval chain and payroll deduction integration are deferred.

## Cross-Component Events

```js
// Punch IN
window.dispatchEvent(new CustomEvent('nucleus:trigger_punch', { detail: { type: 'IN' } }));

// Punch OUT  
window.dispatchEvent(new CustomEvent('nucleus:trigger_punch', { detail: { type: 'OUT' } }));
```

These events are handled in `MainWorkspace.js` → `handleVoicePunch()` → calls `punchIn()` or `punchOut()`.

## AttendanceFAB

The floating attendance pill (`AttendanceFAB.js`) is the primary punch trigger for employees. It shows:
- Current clock state: `CLOCKED IN (04h 12m)` or `NOT CLOCKED IN`
- Geofence status badge
- One-click clock toggle

**Do not create secondary punch buttons elsewhere** without coordinating with AttendanceFAB state.

## Testing

```bash
npx vitest run src/server/attendance/attendance-golden.test.ts  # 70 tests
npx vitest run src/server/attendance/service.test.ts            # 15 tests
```

All 85 attendance tests must pass after any attendance-related change.
