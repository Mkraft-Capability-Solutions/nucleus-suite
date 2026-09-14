# Skill: Wire an Operational Form (SCR-001 to SCR-050) to Neon Database

This skill guides you through connecting any of the 50 operational forms from `Nucleus_Forms_and_Fields_Complete_MKraft.xlsx` to an API route and Neon PostgreSQL database table.

---

## Workflow Steps

### Step 1: Locate the Form Specification
1. Inspect `src/lib/operational-module-registry.js` or `data/ui/lib.operational-module-registry.json` for the screen ID (e.g. `SCR-023` Gate Pass).
2. Note the field names, required validation constraints, and target endpoint (e.g. `/api/v1/gate-passes`).

### Step 2: Ensure Server Domain Service Exists
1. Navigate to `src/server/[domain]/` (e.g. `src/server/attendance/`).
2. Verify or implement the domain service function with `tenantTx()` transaction scoping:
   ```typescript
   export async function submitFormRecord(access: Access, data: FormData) {
     return await tenantTx(access, async (tx) => {
       return await tx.insert(table).values({ ...data, tenantId: access.tenantId }).returning();
     });
   }
   ```

### Step 3: Implement API Route
1. In `src/app/api/v1/[endpoint]/route.ts`:
   ```typescript
   import "server-only";
   import { requireAccess } from "@/server/platform/access";
   import { httpOk, httpError } from "@/server/platform/http";

   export async function POST(req: Request) {
     const access = await requireAccess(req);
     const body = await req.json();
     const result = await submitFormRecord(access, body);
     return httpOk(result);
   }
   ```

### Step 4: Wire Client Form Submission
1. In the client component (`src/components/Clerio/...`):
   ```javascript
   const res = await fetch('/api/v1/[endpoint]', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Idempotency-Key': crypto.randomUUID()
     },
     body: JSON.stringify(formData)
   });
   if (!res.ok) throw new Error('Submission failed');
   showToast('Success', 'Record successfully saved', 'success');
   ```

### Step 5: Verification
1. Run `npx tsc --noEmit` to verify type safety.
2. Run `npm test` to verify zero regression.
