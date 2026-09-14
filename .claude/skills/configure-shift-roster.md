# Skill: Configure Industrial Shift Rosters & Punch Pairing Across Midnight

This skill explains how to configure factory shifts, multi-punch pairing across midnight, split shifts, and grace periods.

---

## Workflow Steps

### Step 1: Define Shift Master
1. Shift A: `06:00` to `14:00`
2. Shift B: `14:00` to `22:00`
3. Shift C (Night): `22:00` to `06:00` (Next Day)
4. General: `09:00` to `17:30`

### Step 2: Auto-Shift Detection by Punch Timing (Demo 1)
1. In `src/server/attendance/` & `src/services/timeOfficeEngine.js`:
   - If in-punch is within window `[Shift_Start - 90m, Shift_Start + 120m]`, auto-assign that shift ID.
   - For night shifts spanning midnight, pair the out-punch on date $D+1$ with the in-punch on date $D$.

### Step 3: Enforce 15-Minute Grace & Late Penalties (Demo 12 & 13)
1. Allow up to 15 minutes of late arrival.
2. If instance count in current month $\le 3$: Mark as `PRESENT_WITH_GRACE`.
3. On 4th instance: Mark as `LATE` (deduct 0.5 day or short-leave pass).
4. **Exemption**: If employee band is `Assistant Manager` or above (Bands L4–L6), waive grace period counts completely.

### Step 4: Split Break & Fatigue Rest Derivation (Demo 18 & 19)
1. Deduct mandatory 45-minute dinner break on 12-hour continuous shifts.
2. Validate at least 11 hours of fatigue rest between consecutive shift assignments.
