# Functional Requirements Document (FRD): TIME-05 Overtime and Premium Pay Rules

## 1. Functional Specifications
* **FR-TIME-05-001 (Audit Trail Enforcement):** The system MUST capture a deterministic audit log entry for every state transition within this module, recording Timestamp, Actor ID, Target ID, Attribute Before, and Attribute After.
* **FR-TIME-05-002 (Effective Dating Engine):** The system MUST support forward-dated and retroactive entry execution using true Workday-style bi-temporal tracking (Transaction Time vs. Effective Time).
* **FR-TIME-05-003 (Localization Layer):** Functional validation criteria MUST dynamically toggle depending on the country or legal entity jurisdiction attributed to the underlying worker profile.

## 2. Hard Business Logic Rules
* **BR-TIME-05-101:** Total transaction payload validation fails if mandatory contextual objects (Cost Center, Job Profile, Supervisory Organization) lack valid relationships on the target Effective Date.
* **BR-TIME-05-102:** Matrix management structural rollups must automatically recalculate within 150ms of a committed record shift to prevent workflow routing deadlocks.
