# Skill: Configure and Advance an Approval Workflow State Machine

This skill defines how to create, evaluate, and transition multi-level approval workflows across Nucleus HRMS.

---

## Workflow Steps

### Step 1: Define the State Machine
1. In `src/server/workflows/` or domain service (e.g. `src/server/leave/`), declare state types:
   ```typescript
   export type WorkflowState = 'DRAFT' | 'SUBMITTED' | 'PENDING_L1' | 'PENDING_L2' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
   ```

### Step 2: Validate State Transitions
1. Use an explicit transition lookup table to prevent illegal status changes:
   ```typescript
   const ALLOWED_TRANSITIONS: Record<WorkflowState, WorkflowState[]> = {
     DRAFT: ['SUBMITTED', 'CANCELLED'],
     SUBMITTED: ['PENDING_L1', 'CANCELLED'],
     PENDING_L1: ['PENDING_L2', 'REJECTED', 'CANCELLED'],
     PENDING_L2: ['APPROVED', 'REJECTED', 'CANCELLED'],
     APPROVED: [],
     REJECTED: [],
     CANCELLED: []
   };
   ```

### Step 3: Enforce RBAC & Delegation
1. Check that the actor holds the required role or delegated authority:
   ```typescript
   const isManager = access.context.user.id === record.managerId;
   const isHR = access.context.roles.includes('HRBP') || access.context.roles.includes('SUPER_ADMIN');
   if (!isManager && !isHR) throw new HttpError({ status: 403, message: 'Unauthorized transition' });
   ```

### Step 4: Emit Domain Event to Outbox
1. In `src/server/jobs/outbox.ts`:
   ```typescript
   await enqueueOutboxEvent(tx, {
     tenantId: access.tenantId,
     eventType: 'WORKFLOW_STATE_CHANGED',
     payload: { entityId, fromState, toState, actorId: access.context.user.id }
   });
   ```
