# Security, RBAC & Privacy (GDPR / DPDP) Rules

> **Scope:** Access Governance, Data Protection & Role Models  
> **Source:** `docs/engineering/ROLE_MODEL.md` & `src/server/platform/access.ts`

---

## 1. Role-Based Access Control (RBAC)

Nucleus HRMS defines 10 discrete user personas mapped to dedicated Command Consoles (S1–S10):
- `SUPER_ADMIN` (Full System Access)
- `CHRO` (Executive People Strategy — S1)
- `HRBP` (Operational HR Management — S2)
- `PLANT_SUPERVISOR` (Shift & Floor Operations — S3)
- `TA_LEAD` (Talent Acquisition & ATS — S4)
- `FINANCE_CONTROLLER` (Payroll & GL Control Room — S5)
- `TALENT_CALIBRATION_LEAD` (9-Box & PMS — S6)
- `LINE_MANAGER` (Manager Cockpit — S7)
- `EMPLOYEE` (Self-Service Home — S8)
- `CAPABILITY_LEAD` (Magnetix L&D — S9)

---

## 2. Plant vs. Head Office Data Scoping (Demo 8)

- Plant users can view and edit attendance, shift assignments, and gate passes for their assigned location.
- **Salary Data Masking**: Compensation components, salary rates, and CTC totals must be completely hidden/masked (`***`) from plant floor supervisors. Only corporate Head Office finance/HR roles possess salary visibility.

---

## 3. Privacy & Compliance (DPDP Act 2023 / GDPR)

- **Right to be Forgotten**: Identity data deletion requests must wipe personal PII while retaining anonymized statutory payroll records for mandatory tax audits.
- **Audit Logging**: Every access to sensitive records (PAN, Aadhaar, Bank Details, Salary) logs an access event into `access_events` with actor ID and IP address.
