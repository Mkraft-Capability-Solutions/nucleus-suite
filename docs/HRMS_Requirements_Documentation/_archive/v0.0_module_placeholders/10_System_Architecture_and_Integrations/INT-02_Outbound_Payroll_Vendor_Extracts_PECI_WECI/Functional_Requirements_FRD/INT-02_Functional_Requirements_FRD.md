# Functional Requirements Document (FRD): INT-02 Outbound Payroll Vendor Extracts PECI WECI

## 1. Functional Specifications
* **FR-INT-02-001 (Audit Trail Enforcement):** The system MUST capture a deterministic audit log entry for every state transition within this module, recording Timestamp, Actor ID, Target ID, Attribute Before, and Attribute After.
* **FR-INT-02-002 (Effective Dating Engine):** The system MUST support forward-dated and retroactive entry execution using true Workday-style bi-temporal tracking (Transaction Time vs. Effective Time).
* **FR-INT-02-003 (Localization Layer):** Functional validation criteria MUST dynamically toggle depending on the country or legal entity jurisdiction attributed to the underlying worker profile.

## 2. Hard Business Logic Rules
* **BR-INT-02-101:** Total transaction payload validation fails if mandatory contextual objects (Cost Center, Job Profile, Supervisory Organization) lack valid relationships on the target Effective Date.
* **BR-INT-02-102:** Matrix management structural rollups must automatically recalculate within 150ms of a committed record shift to prevent workflow routing deadlocks.
