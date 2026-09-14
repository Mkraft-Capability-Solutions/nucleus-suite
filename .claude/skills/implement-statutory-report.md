# Skill: Implement Statutory Reports (Form 28, Form 18, Form 36, Form F)

This skill guides you through generating factory statutory compliance reports under the Indian Factories Act, 1948, and the Payment of Gratuity Act, 1972.

---

## Workflow Steps

### Step 1: Identify Statutory Report Requirements
1. **Form 28 (Muster Roll)**: Monthly employee attendance, in/out punch, overtime hours, and fine deductions.
2. **Form 18 (Notice of Accident)**: Incident report with injured person details, severity, location, cause, and doctor's certificate.
3. **Form 36 (Inspection Book)**: Factory inspector observations, compliance deadline, and rectification remarks.
4. **Form F (Gratuity Nomination)**: Employee nominee names, relation, age, and proportional allocation share (summing to 100%).

### Step 2: Extract Data via Server Service
1. Create or extend domain service in `src/server/compliance/` or `src/server/exports/`:
   ```typescript
   export async function generateMusterRollData(access: Access, month: string, plantId: string) {
     return await tenantTx(access, async (tx) => {
       return await tx.query.attendanceDays.findMany({
         where: (ad, { eq, and }) => and(eq(ad.tenantId, access.tenantId), eq(ad.locationId, plantId))
       });
     });
   }
   ```

### Step 3: Implement Formatter & Export Endpoint
1. In `src/app/api/v1/exports/route.ts`, support CSV, PDF, and Excel formatting:
   - CSV: UTF-8 encoded with RFC 4180 escaping.
   - Headers: `Content-Disposition: attachment; filename="Form_28_Muster_Roll.csv"`.

### Step 4: Wire to UI
1. In `src/components/Clerio/ComplianceView.js` or `ReportsView.js`, add an action button triggering direct file download.
