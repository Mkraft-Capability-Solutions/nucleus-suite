# Indian Statutory Compliance & Factories Act Rules

> **Scope:** Domain Compliance & Statutory Reporting  
> **Source:** `HR Demo Points.xlsx` (Demo 17, 24, 26) & Factories Act, 1948

---

## 1. 2026 Code on Wages: 50% Basic Floor Rule

- **Rule (Demo 24)**: Total Basic Wage + Dearness Allowance (DA) must be at least **50% of the Total Gross Remuneration (CTC)**.
- **Excess Allowance Reclassification**: If non-basic allowances exceed 50%, the surplus must be rolled back into Basic for PF, ESIC, and Gratuity calculations.
- **Implementation**: Handled by `src/server/payroll/wage-simulator.ts` and `src/components/Clerio/SalarySimulator.js`.

---

## 2. Mandatory Factory Forms

Every manufacturing plant and industrial unit must maintain:
1. **Form 28 (Muster Roll)**:
   - Daily attendance recording employee token number, in/out punch, overtime hours, and fine deductions.
   - Preserved for at least 3 years under the Factories Act.
2. **Form 18 (Notice of Accident)**:
   - Mandatory incident notification for any workplace injury causing more than 48 hours of absence.
   - Auto-notifies Factory Inspectorate within 24 hours of occurrence.
3. **Form 36 (Inspection Book)**:
   - Official register recording visits, comments, and statutory orders by State Factory Inspectors.
4. **Form F (Gratuity Nomination)**:
   - Mandatory nominee allocation under Payment of Gratuity Act, 1972, captured upon employee confirmation.

---

## 3. Gratuity Calculation Formula

- **Eligibility**: 5 continuous years of service (waived upon death or permanent disability).
- **Formula**:
  $$\text{Gratuity} = \frac{15}{26} \times \text{Last Drawn Basic} \times \text{Completed Years of Service}$$
- Handled in `src/server/fnf/` and `src/services/payrollAdjacenciesService.js`.
