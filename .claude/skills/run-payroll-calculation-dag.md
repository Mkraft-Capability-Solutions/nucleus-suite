# Skill: Execute and Verify Payroll Calculation DAG & F&F Settlements

This skill details how to run the Directed Acyclic Graph (DAG) for Indian payroll, statutory withholdings, loan EMI recovery, and full & final settlements.

---

## Workflow Steps

### Step 1: Ingest Attendance & LOP Days
1. Read monthly attendance days from `src/server/attendance/`:
   $$\text{Payable Days} = \text{Calendar Days} - \text{LOP Days}$$

### Step 2: Calculate Salary Components
1. In `src/server/payroll/service.ts`:
   - Basic = Prorated based on Payable Days.
   - HRA = 40% (Non-metro) or 50% (Metro) of Basic.
   - EPF Employee = 12% of Basic (capped at statutory ₹1,800/mo or actual).
   - ESIC Employee = 0.75% of Gross (if Gross ≤ ₹21,000).
   - PT = Slab-based state tax (e.g. ₹200/mo).
   - TDS = Section 115BAC (New Regime) or Old Regime with 80C deductions.

### Step 3: Deduct Loan EMIs & Advances
1. Query active loans from `src/server/loans/`:
   - Deduct monthly EMI unless an approved recovery hold is active (Demo 10).

### Step 4: Same-Day Zero-Dues F&F Settlement (Demo 16)
1. In `src/server/fnf/`:
   $$\text{Net F&F} = \text{Earned Salary} + \text{Leave Encashment} + \text{Gratuity} - \text{Notice Shortfall} - \text{Loan Balance}$$
2. Verify all 4 department sign-offs (IT, Admin, Finance, Stores) before authorizing final bank payout file generation.
