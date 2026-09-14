# Rule: Leave System

## Scope
All code touching leave requests, leave balances, leave approval, comp-off, sandwich rules, holiday calendars, or leave policy.

## Critical Invariants

```
INV-LEV-01: Leave balance must never go negative after a request is submitted.
INV-LEV-02: No two approved leave spans for the same employee may overlap.
INV-SEC-02: An employee cannot approve their own leave request.
```

## Mandatory Service Boundary

**ALL leave mutations MUST go through `src/services/leave-workflow.ts`.**

```ts
// ✅ Correct
import { submitLeaveRequest } from '@/services/leave-workflow';
const result = await submitLeaveRequest({ employeeId, leaveType, startDate, endDate });

// ❌ Wrong — never mutate leave state directly in a component
setLeaveBalance(prev => prev - days);
```

## Leave State Machine

```
DRAFT → SUBMITTED → PENDING_L1 → PENDING_L2 → APPROVED → COMPLETED
                                              ↘ REJECTED
APPROVED → CANCELLED (by employee, before start date)
APPROVED → WITHDRAWN (by employee, after start date, early return)
PENDING → EXPIRED (auto, if not actioned in 72h — future)
```

Only states defined in the workbook are valid. Do not invent new states.

## Data Sources

- Leave balances: `src/data/ui/leave.workflow.json` (prototype)
- Leave types: workbook `14_Leave_Types`
- Holiday calendar: workbook `09_Holiday_Calendar`
- Accrual policy: workbook `15_Leave_Accrual_Policy`
- Historical requests: workbook `18_Leave_Requests` (read-only)
- Comp-off ledger: workbook `19_CompOff_Ledger`

**Never equate workbook employee IDs (e.g., EMP-xxx) with persona IDs (MK-102, MK-104, MK-107).**

## Sandwich Rule

When a leave spans a weekend (Saturday/Sunday), those weekend days are included in the deduction count per the sandwich rule — unless the leave type is specifically exempted.

The `leave-workflow.ts` service handles sandwich calculation. **Do not re-implement it in components.**

## Comp-Off Credits

- Comp-off credits expire after 60 days (FIFO order)
- Auto-expiry daemon is **not yet implemented** — deferred to production phase
- Do not display comp-off expiry alerts without verified expiry data

## Leave Application Dialog

The canonical leave application UI is `src/components/Leave/LeaveApplicationDialog.tsx`.  
**Do not create a second leave form.** Extend this component if you need additional fields.

Required fields per SCR-030: employee, leave type, start date, end date, duration.  
Optional: reason, emergency contact number.

## Voice Command Integration

When voice command "Apply for Leave" is executed:
1. `sessionStorage.setItem('nucleus:auto_open_leave_apply', 'true')` is set
2. `nucleus:open_leave_apply` CustomEvent is dispatched (twice — 150ms and 500ms delay for timing safety)
3. `LeaveView.js` listens for this event on mount and opens the dialog

**Do not add new leave entry points without updating `voiceCommandEngine.ts`.**

## Testing Requirements

Before any leave change, run:
```bash
npx vitest run src/services/leave-workflow.test.ts  # 44 tests
npx vitest run src/services/leave-reference.test.ts  # 3 tests
npx vitest run src/server/leave/leave-ledger.test.ts  # 47 tests
```

All 94 leave tests must pass.
