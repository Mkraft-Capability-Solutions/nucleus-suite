# Rule: Payroll Engine

## Scope
All code touching payroll runs, salary computation, tax deductions, payslips, CTC structures, EWA, loans, and F&F settlement.

## Critical: Payroll is DORMANT in Prototype Phase

**No live payroll disbursements, bank file generation, or statutory form filings in the prototype phase.** These are all deferred to the production phase.

The payroll **computation logic** (gross-to-net, PF/ESI/PT/TDS formulas) is implemented in `src/server/payroll/service.ts` and tested. The UI preview shows simulated results.

## Payroll Control Room — 8 Stages

```
Stage 1: Pre-Payroll Input Validation
Stage 2: Salary Structure Lock
Stage 3: Attendance & Leave Integration
Stage 4: Statutory Deductions (PF/ESI/PT/TDS)
Stage 5: Gross-to-Net Calculation
Stage 6: Exception Approval Gate
Stage 7: Payroll Lock (HRBP + CFO authorization)
Stage 8: Bank Disbursement File Generation
```

Stages 1-5 have UI representation. **Stages 6-8 (authorization and disbursement) are deferred.**

## Statutory Deductions — India

| Deduction | Rule | Cap |
|:---|:---|:---|
| PF (Employee) | 12% of Basic + DA | Statutory: ₹15,000 wage ceiling; VPF allowed above |
| PF (Employer) | 12% of Basic + DA | Same ceiling |
| ESI (Employee) | 0.75% of Gross | Applicable when Gross ≤ ₹21,000/month |
| ESI (Employer) | 3.25% of Gross | Same condition |
| Professional Tax | State-specific slabs | Karnataka/Maharashtra/Delhi/etc. |
| TDS | Dual regime computation | New Regime (115BAC) vs Old Regime |

**INV-PAY-01:** Basic + DA must be ≥ 50% of Total CTC (Code on Wages compliance). Validate this before allowing CTC structure save.

## Wage Simulator

The salary structure simulator is in `src/server/payroll/wage-simulator.test.ts` (8 tests). The simulator:
- Takes CTC as input
- Outputs component breakdown (Basic, HRA, Special Allowance, etc.)
- Validates against INV-PAY-01
- Computes all deductions

**Use the simulator for all "What If" CTC calculations.** Do not implement ad-hoc salary formulas in components.

## Loans & Advances (SCR-080)

Loan management is in `src/server/loans/service.ts` and `loans.test.ts` (17 tests).

Required fields per workbook (SCR-080):
- Loan type (Company Loan / Salary Advance)
- Principal amount
- Number of EMIs
- Monthly EMI deduction
- **Guarantor field** — not yet implemented
- **Board approval** — not yet implemented

## CTC Exception Approval

The `CtcExceptionModal.js` handles CTC exceptions. The approval chain (HRBP → CFO) is partially implemented.  
**Do not bypass the exception modal** for any salary revision above the configured threshold.

## EWA (Earned Wage Access)

EWA allows employees to withdraw earned wages before payday. Status: **NOT YET IMPLEMENTED** — high priority backlog item.

When implementing:
- Maximum EWA = 50% of earned wages to date
- Minimum withdrawal = ₹1,000
- Maximum 2 EWA requests per month
- Deducted from final month payslip automatically

## Full & Final Settlement

F&F settlement covers:
- Last working month salary (pro-rated)
- Earned leave encashment
- Gratuity (if eligible — 5 years+ service)
- Notice period recovery or payment
- Asset clearance deduction

Status: **Partially implemented** — referenced in PayrollView but standalone F&F workflow not rendered.

## Testing

```bash
npx vitest run src/server/payroll/payroll.test.ts       # 12 tests
npx vitest run src/server/payroll/service.test.ts       # 6 tests
npx vitest run src/server/payroll/wage-simulator.test.ts # 8 tests
npx vitest run src/server/loans/loans.test.ts            # 17 tests
```

All 43 payroll + loan tests must pass.
