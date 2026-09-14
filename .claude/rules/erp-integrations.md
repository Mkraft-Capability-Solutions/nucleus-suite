# Triple-Format ERP Outbox & GL Accounting Integration Rules

> **Scope:** Financial Posting & Multi-ERP Integration  
> **Source:** `HR Demo Points.xlsx` (Demo 14, 15) & `src/server/exports/`

---

## 1. Triple-Format ERP Outbox

At the completion of each payroll batch, Nucleus HRMS generates 3 standard accounting integration files:
1. **SAP iDoc XML**:
   - Follows SAP `HRMD_A` / `ACC_DOCUMENT` schema.
   - Cost center debit/credit legs mapped to SAP GL accounts.
2. **Oracle NetSuite CSV**:
   - Journal entry upload format with subsidiary, department, class, and currency columns.
3. **Tally Prime XML**:
   - Native `<VOUCHER>` XML format for direct import into Tally ERP/Prime.

---

## 2. Multi-Division GL Mapping Rules

- Salary earnings (Basic, HRA, Special Allowance) debit department cost centers.
- Deductions (PF, ESIC, PT, TDS) credit statutory liability accounts.
- Net salary credits the company clearing account.
- **Double-Entry Validation**: Total Debits must strictly equal Total Credits before any export file is finalized.
