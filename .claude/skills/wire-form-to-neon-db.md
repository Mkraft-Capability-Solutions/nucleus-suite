# Skill: Wire an Operational Form (SCR-001 to SCR-050) to Neon Database

This skill guides you through connecting any of the 50 operational forms from `Nucleus_Forms_and_Fields_Complete_MKraft.xlsx` to a Next.js Server Action and Neon PostgreSQL database table.

---

## Workflow Steps

### Step 1: Locate the Form Specification
1. Inspect `src/config/ui/lib.operational-module-registry.json` for the screen ID (e.g. `SCR-023` Gate Pass).
2. Note the field names and required validation constraints.

### Step 2: Ensure Server Domain Service Exists
1. Navigate to `src/server/[domain]/application/` (e.g. `src/server/attendance/application/attendanceService.ts`).
2. Verify or implement the domain service function with `tenantTx()` transaction scoping:
   ```typescript
   export async function submitFormRecord(access: Access, data: FormData) {
     return await tenantTx(access, async (tx) => {
       return await tx.insert(table).values({ ...data, tenantId: access.tenantId }).returning();
     });
   }
   ```

### Step 3: Implement Server Action
1. In `src/app/actions/[domain]Actions.ts` (e.g., `src/app/actions/attendanceActions.ts`):
   ```typescript
   "use server";
   import { requireAccess } from "@/server/platform/access";
   import { submitFormRecord } from "@/server/[domain]/application/[domain]Service";

   export async function submitAction(data: any) {
     const access = await requireAccess();
     try {
       const result = await submitFormRecord(access, data);
       return { success: true, data: result };
     } catch (error) {
       console.error("Action Failed:", error);
       return { success: false, error: error.message };
     }
   }
   ```

### Step 4: Wire Client Form Submission
1. In the client component (`src/components/Clerio/...`):
   ```javascript
   import { submitAction } from '@/app/actions/[domain]Actions';
   
   // Inside form handler
   try {
     const res = await submitAction(formData);
     if (!res.success) throw new Error(res.error);
     showToast('Success', 'Record successfully saved', 'success');
   } catch (e) {
     showToast('Error', e.message, 'error');
   }
   ```

### Step 5: Verification
1. Run `npx tsc --noEmit` to verify type safety.
2. Run `npm test` to verify zero regression.
