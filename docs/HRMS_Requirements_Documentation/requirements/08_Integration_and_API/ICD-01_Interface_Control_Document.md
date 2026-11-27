<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/MultipliersKraftLogoDark.png">
  <img src="../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# ICD-01 — Interface Control Document

| Attribute | Value |
| :--- | :--- |
| Document ID | ICD-01 |
| Title | Interface Control Document |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Integration Architect |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Architecture Review Board — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | TS, PI, VV, SAM |
| Related documents | IA-01, IA-02, IA-03, DA-01, DA-04, DA-05, FRS-FIN-01, FRS-FIN-02, FRS-FIN-03, FRS-PAY-07, FRS-TIM-07, FRS-PLT-07, NFR-01, GOV-10, MIG-01 |
| Quality & process-performance objectives | QPPO-01 (escaped defects), QPPO-03 (exact payroll), QPPO-05 (effective requirements reviews) |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-04, BG-06, BG-07 · R-01, R-15, R-16, R-17, R-18, R-27 · FIN-01–FIN-05, TIM-01, CMP-02p, CMP-03p, LCY-02 |

---

## 1. Purpose and Scope

This Interface Control Document (ICD) fixes the contract for every boundary that Nucleus Suite crosses. For each external interface it states what moves, in which direction, by which mechanism, under which credentials, with which fields, how failures are retried, how the result is proven complete, and who owns each field. It is the document an integration engineer builds from, a counterparty signs against, and a tester verifies with.

In scope are the twelve integration flows of the Process Flows workbook (sheet `15_Integration_Flows`, mirrored in IA-03), the public REST surface (IA-01) and the outbound webhook channel that carries the event catalogue (IA-02). Internal module-to-module calls are out of scope; they are governed by the shared-component contracts (BA-06).

| In scope | Out of scope |
| :--- | :--- |
| Twelve external integration flows, the public REST API and webhooks | Internal service-to-service calls (BA-06) |
| Field-level payloads, validation, idempotency, retries, reconciliation, ownership, service levels, versioning | Screen behaviour of the configuration and monitoring screens (FRS-FIN-04, FRS-PLT-04) |
| Authentication and transport security of each boundary | Counterparty-internal processing after acceptance |
| Acceptance criteria per interface | Commercial terms with counterparties (SAM-01) |

## 2. Delivery-Stage Constraint

The current delivery stage is **R0 — UI-validation prototype on local JSON**. Under DEC-0002 nothing in this document authorises live connectivity to any ERP system, bank, biometric terminal, statutory portal, identity provider, business messaging channel, background-verification provider or e-signature provider. During R0 each interface is represented only by local JSON fixtures that mirror the payloads specified here, so that screens such as the sync monitor (SCR-101), GL mapping and journal (SCR-102) and reconciliation (SCR-103) can be validated. Build of the interfaces starts in the phase stated for each one (P0 to P3) after the corresponding gate.

## 3. How to Read This Document

Each interface section has the same six parts:

1. **Interface profile** — identity, purpose, direction, counterparty, mechanism, trigger and cadence, authentication, idempotency key, owning process, phase and data classification.
2. **Payload specification** — one row per field with name, type, length, mandatory flag (M mandatory, C conditional, O optional), description, the Nucleus source as `object.field` (DA-01) and the validation applied.
3. **Sample payload** — a snippet using fictional data of the pilot demo tenant, Vindhya Precision Industries Pvt Ltd. Identifiers such as UAN and account numbers are format-valid dummies or masked.
4. **Behaviour** — error handling and retries, idempotency, reconciliation report, ownership rules, service levels and versioning.
5. **Sequence** — a Mermaid sequence diagram of the normal path and the principal exception.
6. **Interface requirements and acceptance criteria** — normative clauses.

**Identifiers.** Interface IDs follow `<DOM>-INT-<NNN>` using the domain that owns the process at the boundary. Normative clauses of an interface take the interface ID plus a two-digit suffix (for example `FIN-INT-001.03`). Cross-interface conventions use the reserved block `PLT-INT-101` onward. Source IDs (`RL-nnn`, `TC-xxx`, `T-nn`, `BL-nnn`, `OD-nn`, `Q-nn`, `RP-nn`, `F-INT-nn`, `FRM-*`, `SCR-nnn`) are cited exactly as issued.

**Normative language.** MUST is mandatory for acceptance, SHOULD is expected unless a recorded decision says otherwise, MAY is permitted. Priority uses MoSCoW (Must, Should, Could, Won't). Verification methods are Inspection (I), Analysis (A), Demonstration (D) and Test (T).

## 4. Integration Landscape

```mermaid
flowchart LR
    subgraph NS["Nucleus Suite"]
        GW["API and tool gateway"]
        IS["Integration service"]
        EB["Event outbox and webhooks"]
    end
    ERP["ERP system"]
    BANK["Bank"]
    DEV["Biometric terminals and site agents"]
    MSG["Business messaging channel"]
    STAT["Statutory portals"]
    BGV["Background-verification provider"]
    ESIG["E-signature provider"]
    IDP["Identity provider"]
    AIE["Client AI environment"]
    PART["Partner applications"]
    ERP -->|"employee, cost, vendor masters"| IS
    IS -->|"salary journal"| ERP
    IS -->|"bulk payment"| BANK
    DEV -->|"punch events"| GW
    MSG <-->|"actions and notices"| GW
    IS -->|"returns filed by a human"| STAT
    IS <-->|"cases and results"| BGV
    IS <-->|"envelopes and signed files"| ESIG
    IDP <-->|"OIDC, SAML 2.0, SCIM 2.0"| GW
    AIE <-->|"MCP tool calls"| GW
    PART <-->|"REST"| GW
    EB -->|"signed events"| PART
```

Domain modules never call a counterparty directly. Every inbound and outbound exchange passes through the API and tool gateway (synchronous calls) or the integration service (batch, file and connector traffic), which is where authentication, idempotency, logging and reconciliation are enforced once (RL-512).

### 4.1 Interface register

| Interface ID | Interface | Direction | Mechanism | Cadence | Owning process | Phase | Section |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| FIN-INT-001 | Employee master inbound | ERP system → Nucleus | REST batch upsert or scheduled file | Nightly and on change | FIN-01 | P1 | §6 |
| FIN-INT-002 | Salary journal outbound | Nucleus → ERP system | Connector API post, structured file, staging table, manual download, pull API | Per payroll run | FIN-03 | P1 | §7 |
| FIN-INT-003 | Cost-centre, project and department master | ERP system → Nucleus | REST snapshot or scheduled file | Weekly and on demand | FIN-02 | P1 | §8 |
| FIN-INT-004 | Bank disbursement | Nucleus ↔ Bank | Host-to-host API with file fallback | Per payroll run | FIN-05 | P1 | §9 |
| TIM-INT-001 | Biometric and access-control devices | Device → Nucleus | Site agent or device push to REST ingestion | Continuous | TIM-01 | P1 | §10 |
| SSV-INT-001 | Business messaging channel | Both | Provider API and signed inbound webhook | Continuous | SSV, LVE-04, TIM-01, EXP-02 | P2 | §11 |
| CMP-INT-001 – CMP-INT-004 | Statutory returns (PF, ESI, PT and LWF, TDS) | Nucleus → Statutory portal | Generated files uploaded by a human; acknowledgement captured | Monthly, half-yearly, quarterly | CMP-02p, CMP-03p | P1 | §12 |
| LCY-INT-001 | Background verification | Both | Provider API with signed callbacks | Per hire | LCY-02 | P3 | §13 |
| EXP-INT-001 | E-signature | Both | Provider API with signed callbacks | Per document | EXP-03 | P2 | §14 |
| PLT-INT-003 – PLT-INT-004 | Identity federation and provisioning | Both | OIDC, SAML 2.0, SCIM 2.0 | Continuous | PLT-02 | P0 | §15 |
| CTG-INT-001 | Contractor and vendor master | ERP system → Nucleus | REST snapshot or scheduled file | Monthly and on demand | CTG | P3 | §16 |
| INT-INT-001 | MCP server | Nucleus ↔ Client AI environment | MCP over the governed tool surface | On demand | INT-01 | P3 | §17 |
| PLT-INT-001 | Public REST API | Partner ↔ Nucleus | HTTPS, OpenAPI 3.1 | On demand | PLT | P1 | §18 |
| PLT-INT-002 | Webhooks | Nucleus → Partner | HTTPS POST of CloudEvents | Event driven | PLT | P1 | §19 |

## 5. Cross-Interface Conventions

### 5.1 Transport and message security

| Concern | Convention |
| :--- | :--- |
| Transport | TLS 1.2 or higher (TLS 1.3 preferred) on every connection; plain HTTP and plain FTP are refused |
| Mutual authentication | mTLS with per-counterparty client certificates for host-to-host links (bank, site agents, ERP connector where the ERP system supports it) |
| File exchange | SFTP with per-tenant key pairs; files encrypted and signed with OpenPGP; one inbound and one outbound folder per tenant and counterparty |
| Field-level protection | Restricted values (account number, Aadhaar, PAN, identity document numbers) are tokenised at rest and are detokenised only inside the component that builds the outbound payload; where a payload must carry a raw Restricted value it is additionally encrypted as a JSON Web Encryption (JWE) member |
| Residency | All integration staging, logs and files for an Indian tenant remain in the cloud region in India (NFR-01 data residency) |
| Secrets | Counterparty credentials live in the tenant secrets vault, never in configuration files, logs, events or LLM prompts |

### 5.2 Authentication matrix

| Pattern | Used by | Credential lifetime |
| :--- | :--- | :--- |
| OAuth 2.0 client credentials with scoped access tokens (JWT, 15-minute lifetime) | ERP connector, site agents, partners on the REST API | Client secret or private-key JWT rotated at least every 90 days |
| OAuth 2.1 authorisation code with PKCE, bound to a human principal | MCP clients in the client AI environment | Access token 15 minutes, refresh token 8 hours |
| mTLS client certificate | Bank host-to-host link, site agents, ERP connector | Certificate validity ≤ 1 year, renewed 30 days before expiry |
| HMAC-SHA256 request signature over timestamp and body | Inbound callbacks from the business messaging channel, background-verification provider and e-signature provider; outbound webhooks | Shared secret rotated at least every 90 days with a 7-day dual-secret overlap |
| OIDC or SAML 2.0 federation | Interactive sign-in through the identity provider | Per identity-provider session policy |
| SFTP key pair plus OpenPGP keys | File mechanisms | Rotated at least yearly |

### 5.3 Data formats

| Item | Convention |
| :--- | :--- |
| Encoding | UTF-8 without byte-order mark for JSON, CSV and XML |
| Dates and times | ISO 8601; dates as `YYYY-MM-DD`; timestamps with explicit offset, for example `2026-09-01T07:55:00+05:30`; the store keeps UTC plus the original offset |
| Money | Internally integer paise (DA-01 `payslip_line.amount_paise`); on the wire a decimal string with exactly two places, for example `"24118000.00"`, currency ISO 4217 `INR`; floating-point numbers are never used for money |
| Codes | Tenant codes are carried exactly as issued (`E1018`, `LE-01`, `LOC-PLA`, `CC-2100`); the ERP employee key is carried separately as `external_code` (`VPI-1018`) |
| Enumerations | Values come from the enumeration and picklist catalogues (DA-02, DA-03) and are transmitted as the code, not the label |
| CSV | Comma separator, double-quote text qualifier, header row mandatory, CRLF line endings, trailer row with record count and control total |
| Identifiers of records in transit | Every message carries a globally unique `message_id` (UUID) and the tenant-scoped business key named in its profile |

### 5.4 Idempotency

Every write that crosses a boundary is idempotent. Inbound REST writes accept an `Idempotency-Key` header; Nucleus keeps the key and the first response for 24 hours and returns that response unchanged to any repeat. Batch and file interfaces derive a business idempotency key, named in each profile, and additionally compare a SHA-256 `payload_hash` of the canonical record so that a repeated payload is rejected as a duplicate, logged and counted, never silently applied twice (RL-513). Outbound deliveries carry the key in the counterparty's reference field so that a resend after a timeout cannot create a second posting or payment.

### 5.5 Error model and retry policy

Synchronous errors use the problem-details format of RFC 9457 (`application/problem+json`) extended with `rule_id` (the business rule that failed, so that validation errors name the rule) and `field`. Errors are classified as follows.

| Class | Examples | Behaviour |
| :--- | :--- | :--- |
| Validation (permanent) | Missing mandatory field, value outside picklist, unbalanced journal | Rejected with HTTP 400 or 422; never retried automatically; record placed on the failure queue of the owning monitor screen with its reason |
| Business hold | Conflict on a Nucleus-owned field, unmatched code, period locked | Accepted and held (HTTP 202 with per-record outcome); a named role resolves it |
| Authentication or authorisation | Expired token, scope missing, certificate revoked | HTTP 401 or 403; alert to the integration administrator; no retry until credentials are fixed |
| Transient | Timeout, HTTP 429, 502, 503, 504, connection reset | Retried with the schedule below |

| Attempt | Delay before attempt (with ±20% jitter) |
| :--- | :--- |
| 1 | immediate |
| 2 | 1 minute |
| 3 | 5 minutes |
| 4 | 15 minutes |
| 5 | 1 hour |
| 6 | 4 hours |
| After attempt 6 | Moved to the dead-letter queue; incident raised to the interface owner; visible on the monitor screen with a replay action |

A `Retry-After` header from a counterparty overrides the schedule when it is longer. Payroll-critical interfaces (FIN-INT-002, FIN-INT-004) additionally alert Finance at attempt 3 so that the manual fallback can be used inside the pay-date window.

### 5.6 Reconciliation framework

Every interface produces a reconciliation report stored as `reconciliation_report` rows (DA-01) with `check`, `expected`, `actual`, `variance` and `status`. The universal assertion is **received = applied + held + rejected + duplicate**, with zero unaccounted records. Interface-specific assertions are listed in each section. Reconciliation is a product screen, not a support script (FIN-04).

### 5.7 Field ownership

A field has exactly one owner — Nucleus or the counterparty — and every mandatory field has an owner (RL-511). Fields owned by a counterparty are read-only in every Nucleus surface (screen, import, REST, tool) (RL-515). Conflict handling is explicit configuration (`PL_CONFLICT_POLICY`: owner wins, hold for review, latest wins) and is never an implicit last-write-wins (RL-514).

### 5.8 Versioning and deprecation

| Item | Rule |
| :--- | :--- |
| REST and webhook versions | Major version in the path (`/v1`); a breaking change creates `/v2`; the previous major version is supported for at least 12 months after the successor is generally available |
| Payload schema | Every message carries `schema_version` (semantic version); additive optional fields raise the minor version and never break consumers |
| File layouts | Layout version in the file header; a new layout is deployed as configuration alongside the old one and selected per tenant |
| Statutory layouts | Versioned inside the rule pack with `effective_from`; generation selects the layout in force for the period, not for the generation date |
| Deprecation notice | Announced in the partner changelog and the `Deprecation` and `Sunset` response headers at least 6 months before removal |
| Contract artefacts | OpenAPI 3.1 for REST, JSON Schema for event and batch payloads, published per version and tested by contract tests in CI |

### 5.9 Observability and audit

Every exchange writes an integration log entry with `message_id`, tenant, interface ID, direction, counterparty, business key, payload hash, size, outcome, latency and retry count. Payload bodies containing Personal or Restricted data are not written to logs; only hashes and business keys are. Reads and writes of Restricted fields through an interface create `audit_entry` rows (GOV-10 §9).

### 5.10 Environments

| Environment | Purpose | Data |
| :--- | :--- | :--- |
| Partner sandbox tenant | Every partner and counterparty integrates here first | Synthetic data seeded from the demo dataset |
| Pre-production | Cut-over rehearsal, connection tests with counterparty test endpoints | Synthetic or irreversibly masked data only |
| Production | Live exchange after go-live sign-off | Live data |

Credentials, certificates and endpoints are distinct per environment; a production credential presented to a non-production endpoint is rejected.

### 5.11 Cross-interface requirements

| ID | Requirement | Rationale | Source / trace | Realises SYS | Priority | Verification | Acceptance criterion |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PLT-INT-101 | All external traffic MUST pass through the API and tool gateway or the integration service; no domain module may hold a counterparty connection. | One enforcement point for security, idempotency and audit. | RL-512, BG-07 | SYS-084, SYS-089 | Must | I | Architecture review finds no counterparty client library or endpoint outside the gateway and integration service. |
| PLT-INT-102 | Every boundary MUST use TLS 1.2 or higher, and host-to-host links MUST use mTLS. | Protects personal and payroll data in transit. | GOV-10 §5, NFR-01 | SYS-088 | Must | T | A TLS 1.1 or plain-text connection attempt is refused; a host-to-host call without a valid client certificate is refused. |
| PLT-INT-103 | Every inbound write MUST be idempotent on the key stated in its profile and MUST record repeats as duplicates. | Retries and replays must never double-apply. | RL-513, T-29 | SYS-084, SYS-089 | Must | T | Replaying any accepted message returns the original outcome and creates no second domain write. |
| PLT-INT-104 | Validation errors MUST be returned as RFC 9457 problem details naming the failed rule and field. | Counterparties fix data without opening tickets. | IA-01 (leave requests note) | SYS-089 | Must | T | A request violating a rule returns `rule_id` equal to the rule ID and the offending `field`. |
| PLT-INT-105 | Transient failures MUST be retried on the schedule in §5.5 and then dead-lettered with an incident and a replay action. | Failures are visible, not silent. | RP-15, T-28 | SYS-055, SYS-088 | Must | T | A simulated 503 is retried six times at the stated intervals and then appears on the monitor with a working replay. |
| PLT-INT-106 | Every interface MUST produce a reconciliation report in which received equals applied plus held plus rejected plus duplicate. | Completeness must be provable per batch or run. | FIN-04, RL-530 | SYS-084 | Must | T | For each interface test batch the report shows zero unaccounted records. |
| PLT-INT-107 | Counterparty-owned fields MUST be read-only on every Nucleus surface, and conflict policy MUST be explicit configuration. | Prevents silent overwrite and drift. | RL-511, RL-514, RL-515 | SYS-084 | Must | T | Editing an ERP-owned field through screen, REST, import or tool is rejected with the owning system named. |
| PLT-INT-108 | Logs MUST NOT contain Personal or Restricted payload values; only hashes and business keys. | DPDP Act 2023 data minimisation (to be validated by Legal). | GOV-10 §9, §13 | SYS-033 | Must | I | Log inspection of a full test cycle finds no Aadhaar, PAN, account number, salary amount or date of birth. |
| PLT-INT-109 | Every message MUST carry `schema_version`, and breaking changes MUST be released as a new major version with at least 12 months of overlap. | Counterparties upgrade on their own schedule. | BG-07 | SYS-058, SYS-089 | Must | I | Contract registry shows each version, and the previous major version remains callable for 12 months. |
| PLT-INT-110 | Integration staging, files and logs for an Indian tenant MUST reside in the cloud region in India. | Data residency commitment. | NFR-01 | SYS-005 | Must | T | Infrastructure policy test passes for every integration store. |
| PLT-INT-111 | Counterparty credentials MUST be stored in the tenant secrets vault and rotated at the intervals in §5.2. | Limits the blast radius of a leaked credential. | GOV-10 §5 | SYS-088 | Must | I | Vault inventory shows each credential with a rotation date within its interval. |
| PLT-INT-112 | Each interface MUST be exercised in the partner sandbox tenant with synthetic data before any production credential is issued. | Production data never used for integration testing. | GOV-10 §13 | SYS-008, SYS-089 | Must | D | Sandbox test evidence is attached to the production credential request. |

## 6. FIN-INT-001 — Employee Master Inbound

### 6.1 Interface profile

| Attribute | Value |
| :--- | :--- |
| Interface ID | FIN-INT-001 |
| Purpose | Keep the Nucleus person and assignment records aligned with the employee master held in the client's ERP system, field by field, under an explicit ownership map |
| Direction | ERP system → Nucleus (configurable per tenant through `master_mode`: Nucleus owns, ERP owns, co-owned) |
| Counterparty | ERP system of the client |
| Mechanism | REST batch upsert `POST /v1/integration/employee-master` (≤ 500 records per call), or a scheduled CSV file on the tenant SFTP inbound folder processed by the integration service through the same validation path |
| Trigger and cadence | Nightly full or delta batch at 01:00 IST, plus on-change push from the ERP system; manual replay from the sync monitor (SCR-101) |
| Authentication | OAuth 2.0 client credentials, scope `integration.write`, over mTLS; SFTP key pair with OpenPGP-encrypted and signed file |
| Idempotency key | Batch: `Idempotency-Key` = `batch_id`. Record: `external_code` + SHA-256 `payload_hash` of the canonical record |
| Owning process | FIN-01 (steps FIN-01.1 to FIN-01.7), configuration FRM-FIN-02 on SCR-100, client form F-INT-01 |
| Phase | P1 (gated by OD-07) |
| Data classification | Personal (name, date of birth, contact); no Restricted values are accepted on this interface |

### 6.2 Payload specification

**Batch envelope**

| Field | Type | Length | M/C/O | Description | Source object.field | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| batch_id | string | 40 | M | ERP batch reference | employee_sync_log.batch | Unique per tenant; pattern `^[A-Z0-9-]{6,40}$` |
| source_system | string | 40 | M | ERP instance identifier configured on SCR-100 | integration_config.erp_system | Must equal the configured value for the tenant |
| schema_version | string | 10 | M | Payload schema version | — | Supported version, for example `1.0.0` |
| sent_at | timestamp | 30 | M | Time the ERP system produced the batch | employee_sync_log.received_at (compared) | ISO 8601 with offset; not more than 24 hours in the future |
| record_count | integer | 5 | M | Number of records in `records` | — | Equals array length; 1 to 500 |
| records | array | — | M | Employee records | — | Each record validated individually |

**Employee record**

| Field | Type | Length | M/C/O | Description | Source object.field | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| external_code | string | 30 | M | ERP employee key | person.erp_employee_key; employee_sync_log.external_code | Unique in both systems (match key); not blank |
| full_name | string | 120 | M | Legal full name | person.full_name | Letters, spaces, `.`, `'`, `-`; 2 to 120 characters |
| date_of_birth | date | 10 | M | Date of birth | person.date_of_birth | Age 14 to 80 on `effective_from`; with name, used for duplicate detection |
| gender | string | 1 | O | Gender code | person.gender | Picklist value |
| date_of_joining | date | 10 | M | Date of joining the legal entity | employment.employment_start | Not after `effective_from` |
| legal_entity_code | string | 10 | M | Employing legal entity | employment.legal_entity_id | Existing `legal_entity.entity_code` |
| department_code | string | 20 | M | ERP department, mapped to an org unit | assignment.org_unit | Mapped through the department cross-reference of FIN-INT-003; unmapped value is held |
| cost_centre | string | 20 | M | ERP cost centre | assignment.cost_centre | Active code received through FIN-INT-003 |
| location_code | string | 20 | O | Work location | assignment.location_id | Existing location; never used to derive payroll group |
| employment_status | string | 12 | M | Active, Inactive or Separated | employment.employment_end (derived) | Enumeration value |
| separation_date | date | 10 | C | Last working day; mandatory when status is Separated | employment.employment_end | Not before `date_of_joining` |
| official_email | string | 254 | O | Work email | person (contact) | RFC 5322 address |
| mobile | string | 13 | O | Mobile number | person.mobile | `^\+91[6-9][0-9]{9}$` |
| effective_from | date | 10 | M | Date the change takes effect | assignment.effective_from | Not before `date_of_joining` |
| grade | string | 5 | O | Grade as held in the ERP system | designation.band (compared only) | Nucleus-owned in the default map; logged and not applied |
| manager_external_code | string | 30 | O | Manager's ERP key | assignment.manager_assignment_id (compared only) | Nucleus-owned in the default map; a material difference is held |

**Response (HTTP 202) — per record**

| Field | Type | Length | M/C/O | Description | Source object.field | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| sync_id | string | 12 | M | Sync row reference | employee_sync_log.sync_id | Generated, `SY-nnnn` |
| external_code | string | 30 | M | Echo of the key | employee_sync_log.external_code | — |
| nucleus_code | string | 10 | C | Matched Nucleus employee code | employee_sync_log.nucleus_code | Present unless unmatched |
| outcome | string | 24 | M | `applied`, `applied_no_change`, `held_conflict`, `rejected_duplicate`, `rejected_unmatched`, `rejected_not_owned`, `rejected_invalid` | employee_sync_log.status | Enumeration value |
| fields | array | — | C | Per-field result with `field`, `erp_value`, `nucleus_value`, `field_owner` | employee_sync_log.field, erp_value, nucleus_value, field_owner | Present for applied, held and not-owned outcomes |
| error | object | — | C | Problem detail with `rule_id` | employee_sync_log.error | Present for rejected outcomes |

### 6.3 Sample payload

```json
{
  "batch_id": "ERP-SYNC-2026-09-14",
  "source_system": "VPI-ERP-PROD",
  "schema_version": "1.0.0",
  "sent_at": "2026-09-14T01:00:12+05:30",
  "record_count": 2,
  "records": [
    {
      "external_code": "VPI-1051",
      "full_name": "Haritha Reddy",
      "date_of_birth": "1999-04-02",
      "date_of_joining": "2024-02-19",
      "legal_entity_code": "LE-02",
      "department_code": "Assembly",
      "cost_centre": "CC-2100",
      "employment_status": "Active",
      "effective_from": "2026-09-14"
    },
    {
      "external_code": "VPI-9901",
      "full_name": "New joiner from ERP",
      "date_of_birth": "2001-01-15",
      "date_of_joining": "2026-09-14",
      "legal_entity_code": "LE-01",
      "department_code": "Logistics",
      "cost_centre": "CC-3200",
      "employment_status": "Active",
      "effective_from": "2026-09-14"
    }
  ]
}
```

```json
{
  "batch_id": "ERP-SYNC-2026-09-14",
  "results": [
    { "sync_id": "SY-0003", "external_code": "VPI-1051", "nucleus_code": "E1051", "outcome": "applied",
      "fields": [ { "field": "department", "erp_value": "Assembly", "nucleus_value": "Quality Assurance", "field_owner": "ERP" } ] },
    { "sync_id": "SY-0006", "external_code": "VPI-9901", "outcome": "rejected_unmatched",
      "error": { "rule_id": "RL-516", "detail": "Employee code not found in Nucleus; auto-create is off for this tenant" } }
  ]
}
```

### 6.4 Behaviour

| Aspect | Specification |
| :--- | :--- |
| Error handling and retries | Envelope errors return HTTP 400 and nothing is applied. Record errors never fail the batch; each record carries its own outcome. Transient failures of the ERP push are retried by the ERP system using the §5.5 schedule; file batches that fail decryption or signature checks are quarantined and alerted. Every non-applied record appears in the SCR-101 failure queue with its reason and a retry action (T-28). |
| Idempotency | A repeated `batch_id` returns the original response. A record whose `payload_hash` has already been applied is answered `rejected_duplicate` and logged (SY-0007 against SY-0001). |
| Reconciliation report | Sync reconciliation per batch on SCR-101: received = applied + applied_no_change + held_conflict + rejected_unmatched + rejected_duplicate + rejected_not_owned + rejected_invalid. Golden batch ERP-SYNC-2026-09-14 yields the outcomes in demo sheet `36_ERP_Inbound_Master` (TC-F510). |
| Ownership rules | Default map for the pilot tenant: the ERP system owns employee code, name, date of joining, department and cost centre; Nucleus owns grade, worker class, shift, leave policy, manager and all time and talent data (DA-04 `field_ownership_map`). ERP-owned fields render read-only (RL-515). An ERP value on a Nucleus-owned field is rejected and logged (SY-0004) or, when it differs materially, held for review (SY-0005). Payroll group is Nucleus-owned and never derived from location (SY-0008). |
| Service levels | Synchronous acknowledgement within 2 seconds for a 500-record call; on-change records applied within 5 minutes; a 5,000-record nightly batch fully processed within 15 minutes; held and failed records visible on SCR-101 immediately after processing. |
| Versioning | Path `/v1`; `schema_version` 1.x; CSV layout version in the header row comment; field additions are optional and minor. |

### 6.5 Sequence

```mermaid
sequenceDiagram
    autonumber
    participant ERP as ERP system
    participant GW as API gateway
    participant IS as Integration service
    participant PPL as People Core
    participant HR as HR reviewer
    ERP->>GW: POST employee-master batch
    GW->>IS: Authenticated batch
    IS->>IS: Validate envelope and hash each record
    alt Hash already applied
        IS-->>GW: rejected_duplicate
    else ERP-owned field changed
        IS->>PPL: Apply effective-dated upsert
        PPL-->>IS: Applied
        IS->>IS: Emit integration.sync.applied
    else Nucleus-owned field differs
        IS->>HR: Hold conflict on SCR-101
        IS->>IS: Emit integration.sync.conflict
    end
    IS-->>ERP: 202 with per-record outcomes
    HR->>IS: Resolve held conflict
```

### 6.6 Interface requirements and acceptance criteria

| ID | Requirement | Rationale | Source / trace | Realises SYS | Priority | Verification | Acceptance criterion |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| FIN-INT-001.01 | The interface MUST apply ERP data only through the integration service. | Domain modules never call the ERP system directly. | RL-512, FIN-01.3 | SYS-056, SYS-084 | Must | I | No People Core component holds an ERP connection. |
| FIN-INT-001.02 | The interface MUST be idempotent on `external_code` and MUST reject a repeated `payload_hash` as a duplicate. | Nightly replays must not double-apply. | RL-513, FIN-01.4, TC-F510 | SYS-084 | Must | T | Replaying SY-0001 produces SY-0007 `rejected_duplicate` and no new person version. |
| FIN-INT-001.03 | A difference on a Nucleus-owned field MUST be handled by the configured conflict policy and MUST NOT be applied by implicit last-write-wins. | Silent overwrite of an HR edit destroys trust. | RL-514, FIN-01.5 | SYS-084 | Must | T | SY-0005 (manager) is held for review on SCR-101 and the Nucleus value is unchanged. |
| FIN-INT-001.04 | ERP-owned fields MUST be read-only in every Nucleus surface while the tenant runs in ERP-owned or co-owned mode. | Single owner per field. | RL-515, FIN-01.6 | SYS-084 | Must | T | Editing department for E1051 on SCR-010 or via REST is rejected naming the ERP system as owner. |
| FIN-INT-001.05 | An unmatched external code MUST be parked for resolution and MUST NOT create a person automatically. | Prevents duplicate identities. | RL-516, FIN-01.7 | SYS-084 | Must | T | SY-0006 (VPI-9901) is `rejected_unmatched` and no person is created. |
| FIN-INT-001.06 | Every failed record MUST appear in a queue with its reason and MUST be retryable. | A failed record must not be silently skipped. | T-28, F-INT-01 `last_sync_status` | SYS-061, SYS-084 | Must | T | A forced failure appears on SCR-101 with reason; retry after correction applies it. |
| FIN-INT-001.07 | Every record received MUST be written to `employee_sync_log` with batch, payload hash, received and applied timestamps, status and error. | Evidence for reconciliation and audit. | DA-01 employee_sync_log | SYS-032, SYS-084 | Must | I | Log rows exist for all eight rows of batch ERP-SYNC-2026-09-14. |
| FIN-INT-001.08 | The scheduled-file mechanism SHOULD use the same validation, ownership and idempotency path as the REST mechanism. | One behaviour regardless of transport. | IA-03 employee master | SYS-061, SYS-084 | Should | T | The same batch delivered as file and as REST yields identical outcomes. |
| FIN-INT-001.09 | Saving an ownership map in which a mandatory field has no owner or a field has two owners MUST be blocked. | Ownership must be complete and exclusive. | RL-511, FRM-FIN-02 coverage panel | SYS-026, SYS-084 | Must | T | Save on SCR-100 is blocked with the unowned field listed. |

## 7. FIN-INT-002 — Salary Journal Outbound

### 7.1 Interface profile

| Attribute | Value |
| :--- | :--- |
| Interface ID | FIN-INT-002 |
| Purpose | Deliver one balanced, dimensioned salary journal per payroll run per legal entity to the ERP system, and write the ERP document number back onto the run |
| Direction | Nucleus → ERP system (push), with an alternative pull by the ERP system |
| Counterparty | ERP system of the client (general ledger) |
| Mechanism | Per tenant, one primary and at least one fallback of: (a) connector API post to the ERP system's journal endpoint, (b) ERP-native XML voucher file, (c) CSV journal file, (d) staging table in a client-controlled schema, (e) manual download from SCR-102; plus pull `GET /v1/payroll/journal?run_id=` for ERP systems that fetch |
| Trigger and cadence | Event `payroll.journal.ready` after the run reaches APPROVED; one journal for each run type (regular, off-cycle overtime, arrears, full and final, bonus) |
| Authentication | Connector: OAuth 2.0 client credentials or mTLS as the ERP system requires, credentials in the tenant vault. Files: SFTP key pair plus OpenPGP. Pull API: OAuth 2.0 scope `finance.read` |
| Idempotency key | `{tenant_id}:{run_id}:{legal_entity_code}:{journal_version}` carried in the ERP reference field |
| Owning process | FIN-02 (mapping), FIN-03 (generation and posting), FIN-04 (reconciliation); forms FRM-FIN-01, F-INT-02; screens SCR-102, SCR-103; report RP-15 |
| Phase | P1 (BL-100, BL-101, BL-103), second accounting system proven in P2 (BL-130) |
| Data classification | Confidential (aggregated amounts by dimension); an employee dimension appears only on loan and advance accounts |

### 7.2 Payload specification

**Journal header**

| Field | Type | Length | M/C/O | Description | Source object.field | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| journal_id | string | 30 | M | Nucleus journal reference | gl_journal.journal_id | Unique per tenant |
| run_id | string | 20 | M | Payroll run | gl_journal.run_id | Run in APPROVED or later state |
| legal_entity_code | string | 10 | M | Entity whose ledger is posted | gl_journal.entity | One journal per run per entity (RL-522) |
| period | string | 7 | M | Pay period `YYYY-MM` | gl_journal.period | Matches the run period |
| run_type | string | 15 | M | regular, off_cycle_ot, arrears, fnf, bonus | gl_journal.run_type | Enumeration; also carried as a line dimension |
| posting_date | date | 10 | M | Accounting date | payroll_run.pay_date | Inside an open ERP period (rejection is reported) |
| currency | string | 3 | M | ISO 4217 | — | `INR` for Indian entities |
| total_debit | decimal string | 18,2 | M | Sum of debit lines | gl_journal.total_dr | Equals `total_credit` |
| total_credit | decimal string | 18,2 | M | Sum of credit lines | gl_journal.total_cr | Equals `total_debit` |
| line_count | integer | 6 | M | Number of lines | — | Equals array length |
| idempotency_key | string | 80 | M | Key defined in §7.1 | gl_posting_log | Unique |
| schema_version | string | 10 | M | Payload version | — | Supported version |

**Journal line**

| Field | Type | Length | M/C/O | Description | Source object.field | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| line_no | integer | 6 | M | Sequence within the journal | gl_journal_line.line_id | Contiguous from 1 |
| mapping_id | string | 10 | M | Mapping row used | gl_mapping.mapping_id | Active on the posting date |
| component_code | string | 20 | M | Pay component or head | gl_mapping.component_code | Mapped for this entity (RL-521) |
| account_code | string | 20 | M | GL account | gl_journal_line.account_code | Active in the chart of accounts received via FIN-INT-003 |
| dr_cr | string | 2 | M | `Dr` or `Cr` | gl_journal_line.dr_cr | Enumeration |
| amount | decimal string | 18,2 | M | Line amount | gl_journal_line.amount | > 0.00; two decimals |
| cost_centre | string | 20 | C | Cost-centre dimension | gl_journal_line.cost_centre | Mandatory when the mapping is dimensioned by cost centre |
| department | string | 20 | C | Department dimension | gl_journal_line.department | As above |
| location | string | 20 | C | Location dimension | gl_journal_line.location | As above |
| project | string | 20 | C | Project dimension | gl_journal_line.project | As above |
| custom_dims | object | — | O | Tenant-defined dimensions | gl_journal_line.custom_dims | Keys configured on FRM-FIN-01 |
| employee_code | string | 10 | C | Employee dimension for loan and advance accounts | payslip_line (aggregated) | Only for mappings dimensioned by employee (GL-020, GL-021) |
| narration | string | 120 | O | Line narration | — | No personal data other than employee code |

**Posting result (write-back)**

| Field | Type | Length | M/C/O | Description | Source object.field | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| external_doc_no | string | 30 | C | ERP document number | payroll_run.external_doc_no; gl_journal.external_doc_no | Mandatory when status is posted |
| posted_at | timestamp | 30 | C | Posting time in the ERP system | payroll_run.gl_posted_on | ISO 8601 |
| status | string | 12 | M | posted, rejected, pending | gl_journal.status | Enumeration |
| error | object | — | C | ERP rejection detail | gl_posting_log.result | Present when rejected |

### 7.3 Sample payload

Extract of journal JV-2026-08-0441 for run PR-2026-08-01 (LE-01, August 2026). Lines shown are dimensioned extracts; account-level totals tie to demo sheet `56_GL_Journal`.

```json
{
  "journal_id": "JV-2026-08-0441",
  "run_id": "PR-2026-08-01",
  "legal_entity_code": "LE-01",
  "period": "2026-08",
  "run_type": "regular",
  "posting_date": "2026-08-31",
  "currency": "INR",
  "total_debit": "31720000.00",
  "total_credit": "31720000.00",
  "line_count": 3,
  "idempotency_key": "t-vpi:PR-2026-08-01:LE-01:1",
  "schema_version": "1.0.0",
  "lines": [
    { "line_no": 1, "mapping_id": "GL-001", "component_code": "PC-BASIC", "account_code": "5010100",
      "dr_cr": "Dr", "amount": "2145000.00", "cost_centre": "CC-2100", "department": "OU-111",
      "location": "LOC-PLA", "custom_dims": { "run_type": "regular" } },
    { "line_no": 2, "mapping_id": "GL-013", "component_code": "SALARY-PAYABLE", "account_code": "2010100",
      "dr_cr": "Cr", "amount": "24118000.00" },
    { "line_no": 3, "mapping_id": "GL-020", "component_code": "LOAN-RECOVERY", "account_code": "1030100",
      "dr_cr": "Cr", "amount": "3500.00", "employee_code": "E1044" }
  ]
}
```

CSV fallback (extract):

```text
journal_id,run_id,entity,period,run_type,line_no,account_code,dr_cr,amount,cost_centre,department,location,project,employee_code
JV-2026-08-0441,PR-2026-08-01,LE-01,2026-08,regular,1,5010100,Dr,2145000.00,CC-2100,OU-111,LOC-PLA,,
JV-2026-08-0441,PR-2026-08-01,LE-01,2026-08,regular,2,2010100,Cr,24118000.00,,,,,
TRAILER,3,31720000.00,31720000.00
```

ERP-native XML voucher fallback (extract):

```xml
<Voucher type="Journal" ref="t-vpi:PR-2026-08-01:LE-01:1" date="2026-08-31">
  <Narration>Salary August 2026 LE-01 run PR-2026-08-01</Narration>
  <Line account="5010100" side="Dr" amount="2145000.00" costCentre="CC-2100"/>
  <Line account="2010100" side="Cr" amount="24118000.00"/>
</Voucher>
```

Write-back received from the ERP system:

```json
{ "idempotency_key": "t-vpi:PR-2026-08-01:LE-01:1", "status": "posted",
  "external_doc_no": "ERP-JV-88214", "posted_at": "2026-09-02T11:04:37+05:30" }
```

### 7.4 Behaviour

| Aspect | Specification |
| :--- | :--- |
| Error handling and retries | Pre-send validation blocks delivery of an unbalanced or unmapped journal; an unmapped component blocks the run from reaching APPROVED in the first place (RL-321, RL-521). Transient connector failures follow §5.5 with a Finance alert at attempt 3. An ERP rejection (closed period, inactive account) is permanent: the journal is marked rejected, the reason appears in the posting log (RP-15) and Finance either corrects the master data and re-posts the same journal with the same key, or uses the file fallback. |
| Idempotency | The key in §7.1 travels in the ERP reference field. Before a resend after a timeout, the connector queries the ERP system by key; if a document exists it is adopted, not duplicated. Re-running the same period without change produces no second posting (T-29). A posted journal is immutable; corrections after DISBURSEMENT_PREPARED flow through an arrears run with its own journal (RL-323). |
| Reconciliation report | SCR-103 asserts and shows passing (RL-530): journal gross equals the sum of payslip earnings; salary payable credit equals the bank-file total (24,118,000.00 = BF-2026-08-0412); each statutory head equals its challan; dimension sums equal totals with zero residue; overtime in the off-cycle run equals approved overtime; loan recovery equals the movement in loan outstanding; every GL line drills to contributing payslip lines (RL-531). |
| Ownership rules | Chart of accounts, cost centres and projects are ERP-owned and read-only in Nucleus. The component-to-account mapping is Nucleus-owned and maintained by Finance on FRM-FIN-01. Journal content is Nucleus-owned. The ERP document number is ERP-owned and written back read-only (RL-524). |
| Service levels | Journal built within 5 minutes of APPROVED for 10,000 employees; first delivery attempt within 15 minutes; final posting status (posted, rejected or dead-lettered) recorded within 1 hour; posting log updated in real time. |
| Versioning | Payload `schema_version` 1.x; file layouts versioned per tenant connector; adding a dimension is a minor change. |

### 7.5 Sequence

```mermaid
sequenceDiagram
    autonumber
    participant PAY as Payroll engine
    participant IS as Integration service
    participant ERP as ERP system
    participant FIN as Finance user
    PAY->>IS: payroll.journal.ready
    IS->>IS: Check mapped, balanced, dimension residue zero
    IS->>ERP: Post journal with idempotency key
    alt Posted
        ERP-->>IS: Document number ERP-JV-88214
        IS->>PAY: Write back doc number, state POSTED_TO_GL
        IS->>IS: Emit payroll.run.posted
    else Transient failure
        IS->>IS: Retry per schedule, query ERP by key before resend
    else Rejected by ERP
        ERP-->>IS: Rejection reason
        IS->>FIN: Posting log entry and alert
        FIN->>IS: Re-post same key or use file fallback
    end
    IS->>FIN: Reconciliation report on SCR-103
```

### 7.6 Interface requirements and acceptance criteria

| ID | Requirement | Rationale | Source / trace | Realises SYS | Priority | Verification | Acceptance criterion |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| FIN-INT-002.01 | A payroll run MUST NOT reach APPROVED while any pay component in it lacks a GL mapping for the entity. | An unmapped journal cannot be posted. | RL-321, RL-521, TC-F521 | SYS-051 | Must | T | With GL-023 unmapped the run is blocked and the message names the component. |
| FIN-INT-002.02 | The interface MUST produce one balanced journal per run per legal entity with run type as a dimension. | Each run has its own ledger footprint. | RL-522, RL-324, RL-333 | SYS-006, SYS-084 | Must | T | PR-2026-09-02 produces its own journal JV-2026-10-0007 balancing at 425,390.00 each way. |
| FIN-INT-002.03 | Cost MUST be split at employee level from the assignment as it stood in the pay period before aggregation. | Lump salary figures force manual allocation every month. | RL-520, FIN-03.1 | SYS-024, SYS-084 | Must | T | Dimension residue is zero for every dimension in TC-F530. |
| FIN-INT-002.04 | Every delivery attempt MUST be recorded with mechanism, time, target, result and returned reference, and failures MUST be visible in the posting log. | A failed posting must not be silent. | RL-523, RP-15, F-INT-02 | SYS-032, SYS-084 | Must | T | A forced rejection appears in RP-15 with reason and time. |
| FIN-INT-002.05 | The ERP document number MUST be written back onto the payroll run and journal. | Two-way traceability between ledgers. | RL-524, FIN-03.5 | SYS-084 | Must | T | PR-2026-08-01 shows ERP-JV-88214 and its posting date. |
| FIN-INT-002.06 | Re-running or re-sending the same journal MUST NOT create a second posting. | Idempotent posting. | T-29 | SYS-050, SYS-084 | Must | T | A second post of JV-2026-08-0441 returns the existing document number. |
| FIN-INT-002.07 | The seven reconciliation assertions MUST run after posting and MUST be shown passing or failing on SCR-103. | Closes month-end disputes. | RL-530, TC-F530 | SYS-031, SYS-084 | Must | T | All seven assertions pass for the September 2026 golden runs. |
| FIN-INT-002.08 | Each tenant MUST have a primary and at least one fallback delivery mechanism, including manual download. | Payroll accounting cannot wait for a connector fix. | RL-523, IA-03 | SYS-084 | Must | D | Disabling the primary connector leaves file download available with identical content. |
| FIN-INT-002.09 | Journal posting SHOULD be proven against two different accounting systems, one file based and one API based, before P2 exit. | Proves the connector abstraction. | BL-130 | SYS-084 | Should | D | Both systems accept the same golden journal. |
| FIN-INT-002.10 | Every GL line MUST drill back to contributing employees and payslip lines. | Explainability of ledger figures. | RL-531, FIN-04.2 | SYS-030, SYS-084 | Must | D | Drilling line 1 lists the employees and payslip lines summing to its amount. |

## 8. FIN-INT-003 — Cost-Centre, Project and Department Master

### 8.1 Interface profile

| Attribute | Value |
| :--- | :--- |
| Interface ID | FIN-INT-003 |
| Purpose | Receive the client's cost structure (cost centres, projects, departments and, as an authored extension, the active GL account list) so that assignments, GL mappings and journals reference only valid codes; Nucleus keeps no second copy of the cost structure as a maintained master |
| Direction | ERP system → Nucleus |
| Counterparty | ERP system of the client |
| Mechanism | REST snapshot `POST /v1/integration/reference-master` (authored addition to IA-01), or scheduled CSV file per master type |
| Trigger and cadence | Weekly full snapshot on Sunday at 02:00 IST; on-demand delta before each payroll input lock |
| Authentication | OAuth 2.0 client credentials, scope `integration.write`, over mTLS; SFTP plus OpenPGP for files |
| Idempotency key | `snapshot_id`; per row `master_type` + `code` + `payload_hash` |
| Owning process | FIN-02 (mapping maintenance and validation) |
| Phase | P1 |
| Data classification | Internal |

### 8.2 Payload specification

| Field | Type | Length | M/C/O | Description | Source object.field | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| snapshot_id | string | 40 | M | Snapshot reference | reference_sync_log.snapshot_id | Unique per tenant |
| master_type | string | 15 | M | COST_CENTRE, PROJECT, DEPARTMENT, GL_ACCOUNT | — | Enumeration |
| snapshot_mode | string | 5 | M | FULL or DELTA | — | A FULL snapshot deactivates codes absent from it, with effective date |
| code | string | 20 | M | ERP code | org_unit.cost_centre; assignment.project_ref; gl_mapping.gl_account_code | Unique within master type and entity |
| name | string | 120 | M | Display name | org_unit.name (department cross-reference); gl_mapping.gl_account_name | 1 to 120 characters |
| status | string | 10 | M | Active, Inactive, Blocked | — | Enumeration |
| parent_code | string | 20 | O | Parent in the hierarchy | org_unit.parent (department) | Existing code of the same type or blank |
| level | integer | 2 | O | Hierarchy level | org_unit.level | 1 to 15 |
| legal_entity_code | string | 10 | M | Owning entity | legal_entity.entity_code | Existing entity |
| valid_from | date | 10 | M | Effective from | — | ISO date |
| valid_to | date | 10 | O | Effective to | — | Not before `valid_from` |
| account_type | string | 12 | C | For GL_ACCOUNT: expense, liability, asset | — | Mandatory for GL_ACCOUNT |
| nucleus_org_unit | string | 10 | C | For DEPARTMENT: mapped Nucleus org unit | org_unit.org_unit_code | Maintained in the cross-reference on SCR-100 |

### 8.3 Sample payload

```json
{
  "snapshot_id": "ERP-REF-2026-09-13-CC",
  "master_type": "COST_CENTRE",
  "snapshot_mode": "FULL",
  "schema_version": "1.0.0",
  "items": [
    { "code": "CC-2000", "name": "Manufacturing", "status": "Active", "level": 1,
      "legal_entity_code": "LE-01", "valid_from": "2016-04-01" },
    { "code": "CC-2100", "name": "Machining - Peenya", "status": "Active", "parent_code": "CC-2000",
      "level": 2, "legal_entity_code": "LE-01", "valid_from": "2016-04-01" },
    { "code": "CC-3200", "name": "Logistics", "status": "Active", "level": 1,
      "legal_entity_code": "LE-01", "valid_from": "2018-04-01" }
  ]
}
```

### 8.4 Behaviour

| Aspect | Specification |
| :--- | :--- |
| Error handling and retries | Row-level validation; invalid rows rejected with reason, valid rows applied. A FULL snapshot that would deactivate more than 10% of active codes is held for confirmation by Finance (protects against a truncated extract). Transient failures follow §5.5. |
| Idempotency | Repeated `snapshot_id` returns the original result; unchanged rows are counted `applied_no_change`. |
| Reconciliation report | Reference sync report: received = applied + no change + rejected + held. Pre-run unmapped-code report at payroll input lock lists assignments referencing inactive or unknown cost centres or projects, and GL mappings referencing inactive accounts; each raises a HIGH pre-audit flag and an unknown account blocks journal generation. |
| Ownership rules | Codes, names, status and hierarchy are ERP-owned and read-only. The department-to-org-unit cross-reference is Nucleus-owned and maintained by the implementation consultant. Codes are never hard-deleted; deactivation is effective-dated so historic journals remain valid. |
| Service levels | A 2,000-row snapshot applied within 10 minutes; unmapped-code report available within 5 minutes of input lock. |
| Versioning | As §5.8; new master types are additive enumeration values. |

### 8.5 Sequence

```mermaid
sequenceDiagram
    autonumber
    participant ERP as ERP system
    participant IS as Integration service
    participant REF as Reference store
    participant PAY as Payroll pre-audit
    participant FIN as Finance user
    ERP->>IS: Weekly FULL cost-centre snapshot
    IS->>IS: Validate rows and compare with active set
    alt Deactivation above 10 percent
        IS->>FIN: Hold snapshot for confirmation
    else Normal snapshot
        IS->>REF: Apply effective-dated changes
    end
    PAY->>REF: Check codes at input lock
    REF-->>PAY: Unknown or inactive codes
    PAY->>FIN: HIGH flags and journal block if any account invalid
```

### 8.6 Interface requirements and acceptance criteria

| ID | Requirement | Rationale | Source / trace | Realises SYS | Priority | Verification | Acceptance criterion |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| FIN-INT-003.01 | Nucleus MUST treat cost centres, projects, departments and GL accounts received on this interface as read-only reference data. | Nucleus does not maintain a second copy of the cost structure. | IA-03 cost-centre flow | SYS-084 | Must | T | No screen or API allows editing a received cost-centre name or status. |
| FIN-INT-003.02 | Unmapped or inactive codes referenced by assignments or GL mappings MUST be reported before a payroll run. | Prevents journals that the ERP system will reject. | IA-03 reconciliation column | SYS-051, SYS-084 | Must | T | Deactivating CC-3200 produces a pre-audit flag for every assignment referencing it. |
| FIN-INT-003.03 | A FULL snapshot that would deactivate more than 10% of active codes MUST be held for Finance confirmation. | Guards against truncated extracts. | Authored safeguard | SYS-051, SYS-084 | Must | T | A snapshot missing 15% of codes is held and nothing is deactivated. |
| FIN-INT-003.04 | Code deactivation MUST be effective-dated and MUST NOT remove history. | Historic journals must stay valid. | DA-01 temporal rule | SYS-022, SYS-026 | Must | T | A journal for August 2026 still resolves CC-2100 after its deactivation in October. |
| FIN-INT-003.05 | The GL account master SHOULD be received on this interface so that FRM-FIN-01 validates accounts against the chart of accounts. | FRM-FIN-01 requires accounts active in the chart of accounts. | FRS-FIN-03 FRM-FIN-01 validation | SYS-026, SYS-084 | Should | T | Selecting an inactive account on FRM-FIN-01 is rejected. |

## 9. FIN-INT-004 — Bank Disbursement

### 9.1 Interface profile

| Attribute | Value |
| :--- | :--- |
| Interface ID | FIN-INT-004 |
| Purpose | Pay net salary, off-cycle and settlement amounts from the entity's salary account to employee accounts, under dual control and with out-of-band total verification, and receive payment status back |
| Direction | Nucleus → Bank (payment instruction); Bank → Nucleus (acknowledgement and status) |
| Counterparty | The legal entity's bank |
| Mechanism | Host-to-host API with the bank where supported; file fallback in the bank's corporate bulk-payment layout (fixed width or CSV, or ISO 20022 credit-transfer XML where the bank accepts it) transmitted by SFTP or uploaded by Finance to the bank's corporate channel |
| Trigger and cadence | Per run, after APPROVED and DISBURSEMENT_PREPARED, on release by two different Finance principals; status polled or received until every line is final |
| Authentication | mTLS with a bank-issued certificate plus request signing; file mechanism OpenPGP encryption and signature with keys registered with the bank; release requires step-up authentication (FIDO2) of both principals |
| Idempotency key | File: `file_ref` + `checksum`. Line: `payment_ref` = `run_id` + `employee_code` + `seq_no` |
| Owning process | FIN-05, PAY-09 (FRM-PAY-07, SCR-055) |
| Phase | P1 |
| Data classification | Restricted (account numbers, amounts) |

### 9.2 Payload specification

**Header**

| Field | Type | Length | M/C/O | Description | Source object.field | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| file_ref | string | 20 | M | Bank file reference | bank_file.file_ref | Unique per tenant |
| run_id | string | 20 | M | Payroll run | bank_file.run_id | Run in DISBURSEMENT_PREPARED |
| legal_entity_code | string | 10 | M | Paying entity | payroll_run.legal_entity_id | — |
| debit_account | string | 34 | M | Entity salary account (detokenised at build) | legal_entity bank configuration | Registered with the bank |
| value_date | date | 10 | M | Credit date | payroll_run.pay_date | Business day; not in the past |
| record_count | integer | 6 | M | Number of detail lines | bank_file.account_count | Equals the number of payable payslips included |
| total_amount | decimal string | 15,2 | M | Sum of detail amounts | bank_file.total_amount | Equals the journal salary-payable credit for the run |
| checksum | string | 64 | M | SHA-256 of the detail records | bank_file.checksum | Recomputed by the verifier |
| generated_at | timestamp | 30 | M | Generation time | bank_file.generated_at | — |
| released_by / verified_by | string | 10 | M | Two distinct principals | bank_file.released_by, verified_by | Must differ; neither may be a payee in the file |

**Detail line**

| Field | Type | Length | M/C/O | Description | Source object.field | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| seq_no | integer | 6 | M | Line sequence | — | Contiguous from 1 |
| payment_ref | string | 35 | M | Unique payment reference | — | Unique per tenant |
| employee_code | string | 10 | M | Payee | payslip.person_id | Payslip in the run with net > 0 |
| beneficiary_name | string | 70 | M | Account holder name | person.full_name (bank record) | Upper case A–Z, space, `.`; truncated to bank limit |
| account_number | string | 18 | M | Beneficiary account (detokenised only inside the file builder) | person bank token | 9 to 18 digits |
| ifsc | string | 11 | M | Branch code | person bank record | `^[A-Z]{4}0[A-Z0-9]{6}$` and present in the reference list |
| amount | decimal string | 15,2 | M | Net to credit | payslip.net | > 0.00 |
| narration | string | 30 | M | Credit narration | — | `SAL <MON> <YYYY> <employee_code>`; no other personal data |

**Status (inbound)**

| Field | Type | Length | M/C/O | Description | Source object.field | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| payment_ref | string | 35 | M | Echo of line reference | — | Exists in the file |
| status | string | 10 | M | ACCEPTED, PROCESSED, REJECTED, RETURNED | — | Enumeration |
| bank_txn_ref | string | 30 | C | Bank transaction reference | — | Present when PROCESSED |
| reason_code | string | 10 | C | Bank reason for rejection or return | — | Present when REJECTED or RETURNED |
| status_at | timestamp | 30 | M | Status time | — | — |

### 9.3 Sample payload

Fixed-width fallback for file BF-2026-08-0412 (run PR-2026-08-01, LE-01, value date 31 August 2026); account numbers are masked in this document and are present in full only inside the encrypted file.

```text
H BF-2026-08-0412   PR-2026-08-01  LE-01 ********4410      20260831000412000000024118000.00
D 000001 PR-2026-08-01-E1018-1  RAVI KULKARNI     ********7306 VPIB0000123 000000062009.00 SAL AUG 2026 E1018
D 000002 PR-2026-08-01-E1019-1  SNEHA NAIR        ********7323 VPIB0000123 000000062376.00 SAL AUG 2026 E1019
T 000412 000000024118000.00 9f2c41d7e0b3a6c58d1e7f0a2b4c6d8e9f1a3b5c7d9e1f2a4b6c8d0e2f4a6b8c
```

Status received from the bank (API):

```json
{ "file_ref": "BF-2026-08-0412",
  "lines": [ { "payment_ref": "PR-2026-08-01-E1018-1", "status": "PROCESSED",
               "bank_txn_ref": "VPIB26243001187", "status_at": "2026-08-31T10:42:05+05:30" } ] }
```

### 9.4 Behaviour

| Aspect | Specification |
| :--- | :--- |
| Error handling and retries | Generation is blocked if the total differs from the journal salary-payable credit or from the sum of payslip nets. API transmission failures follow §5.5, but no resend occurs until a status inquiry by `file_ref` confirms non-receipt. Rejected or returned lines go to a returned-payment queue; after the employee's bank details are corrected through the approval path, they are paid in a separate disbursement file referencing the original `payment_ref`; the run itself is never altered. |
| Idempotency | The bank deduplicates on `file_ref` and `payment_ref`; Nucleus refuses to generate a second file for the same run and entity unless the first is formally cancelled with the bank. |
| Reconciliation report | Disbursement reconciliation on SCR-055: file total = journal salary payable = Σ payslip nets (24,118,000.00 for PR-2026-08-01); record count = payable payslips (412); processed + rejected + returned = records; returned amounts reappear as liabilities until repaid. |
| Ownership rules | Employee bank details are employee-captured and HR-verified in Nucleus; any capture or change inside a payroll window raises an alert (RL-322, RL-393). Bank transaction references are bank-owned and read-only. A full and final settlement is excluded from the file while any blocking clearance item is open (BF-2026-09-0002 excludes E1042). An off-cycle run produces its own file and value date (BF-2026-10-0096, RL-333). |
| Service levels | File generated within 10 minutes for 10,000 lines; host-to-host acknowledgement within 30 minutes; final status for every line by value date plus one business day; payroll availability 99.95% from the 25th to the 5th (NFR-01). |
| Versioning | Bank layouts held as versioned templates per bank; switching layout is configuration with a test file approved by the bank. |

### 9.5 Sequence

```mermaid
sequenceDiagram
    autonumber
    participant PAY as Payroll engine
    participant FIN1 as Finance maker
    participant FIN2 as Finance checker
    participant IS as Integration service
    participant BANK as Bank
    PAY->>IS: Run DISBURSEMENT_PREPARED
    IS->>IS: Build file, checksum, total equals journal net
    FIN1->>IS: Release with step-up authentication
    FIN2->>IS: Verify count and total out of band
    IS->>BANK: Transmit signed instruction
    BANK-->>IS: Acknowledgement
    BANK-->>IS: Line status PROCESSED or RETURNED
    alt Returned line
        IS->>FIN1: Returned-payment queue
    end
    IS->>PAY: Emit payroll.run.disbursed
```

### 9.6 Interface requirements and acceptance criteria

| ID | Requirement | Rationale | Source / trace | Realises SYS | Priority | Verification | Acceptance criterion |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| FIN-INT-004.01 | Release MUST require two different principals, and the verifier MUST confirm count and total through a channel separate from the release screen. | Dual control against payment fraud. | RL-322, FIN-05 | SYS-074, SYS-085 | Must | T | A single principal cannot both release and verify; release without verification transmits nothing. |
| FIN-INT-004.02 | The file total MUST equal the journal salary-payable credit and the sum of payslip nets, or generation is blocked. | Pay what was approved and posted. | IA-03 bank reconciliation | SYS-051, SYS-085 | Must | T | BF-2026-08-0412 totals 24,118,000.00 matching JV-2026-08-0441 line 10. |
| FIN-INT-004.03 | A bank-detail capture or change inside a payroll window MUST raise an alert to Finance before release. | Common fraud vector. | RL-393 | SYS-085 | Must | T | Changing E1019's account on 28 August raises an alert visible on SCR-055. |
| FIN-INT-004.04 | A settlement with an open blocking clearance item MUST be excluded from the bank file. | No-dues control reaches the money, not just the screen. | R-17, `57_Bank_File` | SYS-051, SYS-085 | Must | T | BF-2026-09-0002 contains E1068 only; E1042 is held. |
| FIN-INT-004.05 | Each off-cycle run MUST produce its own bank file and value date. | Overtime disburses after salary as its own run. | RL-333, R-11 | SYS-085 | Must | T | PR-2026-09-02 yields BF-2026-10-0096 with value date 7 October 2026. |
| FIN-INT-004.06 | Returned or rejected lines MUST be re-paid only through a separate disbursement referencing the original payment, never by altering the run. | Run immutability after DISBURSEMENT_PREPARED. | RL-323 | SYS-052, SYS-085 | Must | T | A returned line produces a re-payment file; PR-2026-08-01 totals are unchanged. |
| FIN-INT-004.07 | Account numbers MUST be detokenised only inside the file builder and MUST NOT appear in logs, screens or events. | Restricted data handling. | GOV-10 §5 | SYS-033, SYS-085 | Must | I | Log and event inspection finds only masked account numbers. |
| FIN-INT-004.08 | A file fallback MUST be available for every bank even when host-to-host is enabled. | Pay date cannot depend on one channel. | IA-03 bank flow | SYS-085 | Must | D | With the API disabled, Finance downloads a valid encrypted file for the same run. |

## 10. TIM-INT-001 — Biometric and Access-Control Devices

### 10.1 Interface profile

| Attribute | Value |
| :--- | :--- |
| Interface ID | TIM-INT-001 |
| Purpose | Land every punch from biometric terminals, access-control readers and kiosks as an immutable attendance event, with clock-drift correction and offline catch-up, so that attendance days can be derived |
| Direction | Device → Nucleus |
| Counterparty | Biometric terminals and access-control readers at each site, through a Nucleus site agent or direct device push |
| Mechanism | (a) Site agent polls device buffers through the device's software interface and pushes batches to `POST /v1/attendance/events`; (b) device pushes directly to the same endpoint where the device supports HTTPS push; heartbeat `POST /v1/attendance/devices/{device_id}/heartbeat` (authored addition to IA-01) |
| Trigger and cadence | Continuous: push every 30 seconds or every 200 events, whichever comes first; replay of the offline buffer on reconnect |
| Authentication | mTLS with a per-agent enrolment certificate, plus OAuth 2.0 client credentials, scope `time.ingest`, bound to the agent's location grant; each batch signed by the agent |
| Idempotency key | `(person_id, punch_ts, device_id)` (IA-01) and the device-local `device_event_id` |
| Owning process | TIM-01 (RL-070 to RL-075); exceptions TIM-08 (SCR-025) |
| Phase | P1 |
| Data classification | Personal (identity and time of presence); biometric templates never leave the device or site and are never transmitted |

### 10.2 Payload specification

**Batch**

| Field | Type | Length | M/C/O | Description | Source object.field | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| batch_id | string | 40 | M | Agent batch reference | — | Unique per agent |
| agent_id | string | 20 | M | Site agent | — | Enrolled agent with a location grant |
| sent_at | timestamp | 30 | M | Agent send time | — | ISO 8601 with offset |
| events | array | — | M | Punch events (1 to 1,000) | — | — |

**Event**

| Field | Type | Length | M/C/O | Description | Source object.field | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| device_event_id | string | 30 | M | Device-local sequence | attendance_event.event_id (mapped) | Monotonic per device |
| device_id | string | 20 | M | Terminal identifier | attendance_event.device_id | Registered device at the agent's location |
| enrolment_no | string | 20 | M | Enrolment number on the device | attendance_event.person_id (resolved) | Resolves to exactly one active person through the enrolment table |
| punch_ts_device | timestamp | 30 | M | Raw device timestamp | attendance_event.punch_ts (before correction) | ISO 8601 with device offset |
| device_clock_offset_ms | integer | 9 | M | Device offset from last time sync | attendance_event.drift_correction_ms | Within ±120,000 ms (RL-072) or the event is flagged |
| direction | string | 7 | M | IN, OUT, UNKNOWN | attendance_event.direction | Enumeration |
| source | string | 15 | M | BIOMETRIC, ACCESS_CONTROL, KIOSK | attendance_event.source | Enumeration within the tenant source set (RL-070) |
| verification_mode | string | 6 | O | FINGER, FACE, CARD, PIN | — | Enumeration |
| offline_queued | boolean | 1 | M | Event was buffered offline | — | Buffer age ≤ 7 days (RL-071 `queue_ttl`) |
| signed_ts | string | 128 | C | Signature over the offline timestamp | — | Mandatory when `offline_queued` is true |

Fields set by Nucleus on landing: `event_id`, corrected `punch_ts`, `received_at`, `is_duplicate`, `drift_correction_ms` (DA-01 `attendance_event`).

### 10.3 Sample payload

```json
{
  "batch_id": "AG-PLA-01-2026-09-08-000917",
  "agent_id": "AG-PLA-01",
  "sent_at": "2026-09-09T03:20:31+05:30",
  "events": [
    { "device_event_id": "BIO-PLA-01-884512", "device_id": "BIO-PLA-01", "enrolment_no": "1018",
      "punch_ts_device": "2026-09-08T21:15:02+05:30", "device_clock_offset_ms": 1800,
      "direction": "IN", "source": "BIOMETRIC", "verification_mode": "FINGER", "offline_queued": false },
    { "device_event_id": "BIO-PLA-01-884577", "device_id": "BIO-PLA-01", "enrolment_no": "1018",
      "punch_ts_device": "2026-09-09T03:20:04+05:30", "device_clock_offset_ms": 1800,
      "direction": "OUT", "source": "BIOMETRIC", "verification_mode": "FINGER", "offline_queued": false }
  ]
}
```

The second event is dated 9 September but belongs to the attendance day of 8 September for E1018 because the shift started on 8 September (demo point 1, T-01).

### 10.4 Behaviour

| Aspect | Specification |
| :--- | :--- |
| Error handling and retries | Unknown device or enrolment: event landed in a quarantine table and an exception raised (SCR-025), never discarded. Drift beyond ±120,000 ms: event landed with the raw value retained and a drift exception. Punch for a locked payroll period: landed, but the locked day is not changed and an exception is raised (RL-075). Agent transmission failures: agent keeps the buffer and retries per §5.5 until acknowledged. |
| Idempotency | Repeat of `(person_id, punch_ts, device_id)` or of `device_event_id` returns the original `event_id`. Punches by the same person inside the 60-second dedupe window are marked `is_duplicate`, not discarded (RL-073). |
| Reconciliation report | Device health report per shift: expected events (rostered heads × 2) against received events per device; last heartbeat; buffer depth; devices silent for more than 15 minutes during a shift raise a device-failure exception (RL-140). Agent batch report: received = landed + duplicate + quarantined. |
| Ownership rules | Raw events are device-owned and immutable: never edited, never deleted (DA-01). Corrections happen only through regularisation records on the derived day. Enrolment mapping is Nucleus-owned. |
| Service levels | 500 events per second sustained per tenant at shift change with offline catch-up (NFR-01 attendance ingestion); landed event reflected in the derived attendance day within 2 minutes; heartbeat every 5 minutes. |
| Versioning | Path `/v1`; agent software declares its supported `schema_version`; Nucleus accepts the current and previous minor versions. |

### 10.5 Sequence

```mermaid
sequenceDiagram
    autonumber
    participant DEV as Biometric terminal
    participant AG as Site agent
    participant GW as API gateway
    participant TIM as Time service
    participant SUP as Supervisor queue
    DEV->>AG: Buffered punches and clock offset
    AG->>GW: POST attendance events, signed batch
    GW->>TIM: Authenticated batch with location grant
    TIM->>TIM: Correct drift, keep raw value, dedupe
    alt Known person and open period
        TIM->>TIM: Land event and queue day derivation
        TIM->>TIM: Emit time.punch.ingested
    else Unknown enrolment or locked period
        TIM->>SUP: Raise exception on SCR-025
    end
    TIM-->>AG: Acknowledge event IDs
    AG->>AG: Clear acknowledged buffer entries
```

### 10.6 Interface requirements and acceptance criteria

| ID | Requirement | Rationale | Source / trace | Realises SYS | Priority | Verification | Acceptance criterion |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TIM-INT-001.01 | Every landed punch MUST be stored immutably with its raw device timestamp, correction and source. | Raw events are the legal evidence of presence. | RL-070, RL-072, DA-01 attendance_event | SYS-062, SYS-080 | Must | T | Attempts to update or delete an attendance event through any surface fail. |
| TIM-INT-001.02 | Offline punches MUST be accepted for up to 7 days when carried with a signed timestamp. | Plants lose connectivity. | RL-071 | SYS-064, SYS-065 | Must | T | A buffer replayed after 3 days lands with original times and derives correctly. |
| TIM-INT-001.03 | Duplicates inside the dedupe window MUST be marked, not discarded. | Evidence is never lost. | RL-073 | SYS-063 | Must | T | Two finger reads 20 seconds apart yield one effective punch and one marked duplicate. |
| TIM-INT-001.04 | A punch for a locked payroll period MUST raise an exception and MUST NOT change the locked day. | Payroll inputs stay stable after lock. | RL-075 | SYS-052 | Must | T | A late-arriving August punch after lock appears on SCR-025 and the August day is unchanged. |
| TIM-INT-001.05 | Cross-midnight punches MUST attach to the attendance date on which the shift started. | One session, one day. | T-01, R-01 | SYS-068 | Must | T | E1018 punches of 8–9 September yield one day on 8 September with gross 19:20. |
| TIM-INT-001.06 | The interface MUST sustain 500 events per second per tenant with offline catch-up. | Shift-change bursts. | NFR-01 attendance ingestion | SYS-062, SYS-064 | Must | T | Load test with device simulators sustains 500 events per second for 10 minutes without loss. |
| TIM-INT-001.07 | Biometric templates MUST NOT be transmitted to or stored in Nucleus. | Restricted biometric data minimisation (to be validated by Legal). | GOV-10 §5, §8 | SYS-081 | Must | I | Payload schema and stores contain no template field. |
| TIM-INT-001.08 | A device silent for more than 15 minutes during a rostered shift MUST raise a device-failure exception. | Missing data is detected before payroll. | RL-140, IA-03 device health | SYS-082 | Must | T | Disconnecting BIO-PLA-02 at 08:30 raises an exception by 08:45. |

## 11. SSV-INT-001 — Business Messaging Channel

### 11.1 Interface profile

| Attribute | Value |
| :--- | :--- |
| Interface ID | SSV-INT-001 |
| Purpose | Let employees and managers apply for leave, approve requests, check in and out, request gate passes, retrieve payslips and receive announcements through the business messaging channel, using exactly the same service rules as the app |
| Direction | Both: inbound user messages and button replies; outbound transactional notices, approval prompts and announcements |
| Counterparty | Business messaging channel provider contracted by MultipliersKraft or the tenant |
| Mechanism | Outbound: provider HTTPS API with pre-approved message templates. Inbound: signed HTTPS webhook `POST /v1/channels/messaging/inbound` (authored addition to IA-01) |
| Trigger and cadence | Continuous; outbound on domain events (for example `leave.request.approved`, approval step created, `payroll.run.disbursed`); announcements on publish schedule |
| Authentication | Inbound: HMAC-SHA256 signature from the provider plus source allow-list; outbound: provider token from the tenant vault. User binding: mobile number verified by one-time code at opt-in and linked to one person; payslip retrieval requires a fresh one-time code |
| Idempotency key | Inbound: provider `message_id`. Outbound: `source_event_id` + `recipient` + `template_code` |
| Owning process | SSV channel layer calling LVE-04, TIM-01, TIM-06, PLT-05, PAY payslip service, EXP-02 announcements |
| Phase | P2 |
| Data classification | Personal; Restricted values are never placed in message bodies |

### 11.2 Payload specification

**Inbound message**

| Field | Type | Length | M/C/O | Description | Source object.field | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| message_id | string | 64 | M | Provider message identifier | channel_message_log.message_id | Unique |
| from | string | 15 | M | Sender number in E.164 | person.mobile (bound) | Bound and opted in; else onboarding reply only |
| received_at | timestamp | 30 | M | Provider receipt time | — | Not older than 24 hours |
| type | string | 12 | M | text, button, location, interactive | — | Enumeration |
| text | string | 1024 | C | Free text | — | Parsed by the intent service; never stored beyond 30 days |
| button_payload | string | 128 | C | Opaque action token issued by Nucleus | approval_step (decision) | Signed, single use, 24-hour expiry |
| location | object | — | C | `lat`, `lng`, `accuracy_m` for check-in | attendance_event.geo_lat, geo_lng | Inside the site geofence for a check-in |
| context_message_id | string | 64 | O | Message being replied to | — | Exists in the outbound log |

**Outbound message**

| Field | Type | Length | M/C/O | Description | Source object.field | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| to | string | 15 | M | Recipient number | person.mobile | Opted in; consent record current |
| template_code | string | 40 | M | Approved template | announcement.channels; notification template | Approved for the tenant and language |
| language | string | 5 | M | Locale code | person preference | One of the 11 supported languages |
| parameters | array | — | M | Ordered template values | Source event payload | No Aadhaar, PAN, account number or salary figures |
| buttons | array | — | O | Action tokens | approval_step | Signed tokens |
| category | string | 15 | M | transactional or announcement | announcement.type | Announcements only to recipients matching the audience rule |
| idempotency_key | string | 120 | M | Key in §11.1 | channel_message_log | Unique |

### 11.3 Sample payload

Inbound approval by manager E1017 for a leave request of E1019:

```json
{ "message_id": "msg-7f3a9c21", "from": "+919845012345", "received_at": "2026-09-10T09:14:22+05:30",
  "type": "button", "button_payload": "apv.LR-2026-0917.step2.approve.c81e728d",
  "context_message_id": "out-55b1e0a4" }
```

Outbound notice to E1019 after the decision:

```json
{ "to": "+919845067890", "template_code": "leave_decision_v2", "language": "en",
  "parameters": ["Sneha", "CL", "2026-09-18", "Approved", "Nikhil Iyer"],
  "category": "transactional", "idempotency_key": "evt-9d1c:+919845067890:leave_decision_v2" }
```

### 11.4 Behaviour

| Aspect | Specification |
| :--- | :--- |
| Error handling and retries | Invalid signature: HTTP 401, discarded and alerted. Unbound number: onboarding reply only, no data. Business-rule rejection (for example, leave combination rule): reply with the rule message, the same text the app shows. Outbound failures follow §5.5; a notice undelivered after the schedule falls back to in-app and email. |
| Idempotency | Repeated inbound `message_id` is acknowledged without re-execution; action tokens are single use, so a double tap approves once. |
| Reconciliation report | Message delivery log: sent, delivered, read, failed per template per day; action parity report comparing each channel action with the equivalent app action outcome for the same golden inputs. |
| Ownership rules | The channel has no rule path of its own: every action calls the same domain service as the app (IA-03). Approval decisions record channel `messaging` on `approval_step.channel` (RL-013). Opt-in and withdrawal are recorded in `consent_record`. Payslips are delivered as a time-limited link (15 minutes) after a fresh one-time code, never as an open attachment. |
| Service levels | Inbound action acknowledged within 3 seconds; transactional outbound sent within 60 seconds of the triggering event; announcement broadcast of 10,000 recipients completed within 30 minutes subject to provider rate limits. |
| Versioning | Templates versioned and approved per language; inbound webhook versioned in the path. |

### 11.5 Sequence

```mermaid
sequenceDiagram
    autonumber
    participant U as Manager
    participant MSG as Messaging channel
    participant GW as API gateway
    participant WF as Approval service
    participant N as Notification service
    WF->>N: Approval step created
    N->>MSG: Template with approve and reject buttons
    MSG->>U: Approval prompt
    U->>MSG: Taps Approve
    MSG->>GW: Signed inbound webhook
    GW->>WF: Decision via same service as the app
    alt Rule satisfied
        WF-->>GW: Decision recorded, channel messaging
        WF->>N: Emit decision event
        N->>MSG: Decision notice to employee
    else Rule fails
        WF-->>GW: Rule message
        GW->>MSG: Reply with rule message
    end
```

### 11.6 Interface requirements and acceptance criteria

| ID | Requirement | Rationale | Source / trace | Realises SYS | Priority | Verification | Acceptance criterion |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SSV-INT-001.01 | Every channel action MUST call the same domain service and rules as the app. | The channel never gets its own rule path. | IA-03 messaging flow | SYS-071 | Must | T | The action parity suite returns identical outcomes for app and channel on all golden inputs. |
| SSV-INT-001.02 | Inbound webhooks MUST be signature-verified and replay-protected. | Prevents forged approvals. | §5.2 | SYS-088 | Must | T | A request with a bad signature or reused token is rejected. |
| SSV-INT-001.03 | A number MUST be bound to exactly one person by one-time code before any personal data is sent. | Prevents disclosure to the wrong person. | GOV-10 PbD-06 | SYS-070 | Must | T | An unbound number receives only the onboarding reply. |
| SSV-INT-001.04 | Message bodies MUST NOT contain Aadhaar, PAN, bank account or salary figures; payslips MUST be delivered only as a short-lived link after a fresh one-time code. | Restricted data minimisation. | GOV-10 §5 | SYS-070 | Must | I | Template review and log inspection find no Restricted values. |
| SSV-INT-001.05 | Opt-in and withdrawal MUST be recorded with notice version, and messages MUST stop within 1 hour of withdrawal. | Consent obligations under the DPDP Act 2023 (to be validated by Legal). | DA-01 consent_record | SYS-070 | Must | T | After withdrawal no further message is sent to the number. |
| SSV-INT-001.06 | Gate-pass and check-in requests through the channel MUST enforce the same ceilings and geofence as the app. | Ceiling enforced server-side. | IA-01 gate passes, R-12 | SYS-049, SYS-071 | Must | T | A third personal gate pass in a month is refused on the channel with the rule message. |

## 12. CMP-INT-001 to CMP-INT-004 — Statutory Returns to Authority Portals

### 12.1 Interface profile

| Attribute | Value |
| :--- | :--- |
| Interface IDs | CMP-INT-001 PF electronic challan-cum-return (EPFO); CMP-INT-002 ESI monthly contribution (ESIC); CMP-INT-003 professional tax and labour welfare fund returns (state authorities); CMP-INT-004 quarterly TDS statement on salaries (Form 24Q, Income-tax) with Form 16 issue |
| Purpose | Generate statutory return files from posted payroll records only, hand them to a named human who files them on the statutory portal, and capture the acknowledgement as evidence |
| Direction | Nucleus → Statutory portal (file upload by a human); acknowledgement captured back into Nucleus by upload or entry |
| Counterparty | EPFO, ESIC, state professional-tax and labour-welfare authorities, Income-tax |
| Mechanism | Files generated in the layout prescribed by the authority for the filing period, from templates versioned in the rule pack (RL-381); downloaded from SCR-073 or the filing pack assembled by the `assemble_filing_pack` tool; no automated portal submission in v1 |
| Trigger and cadence | PF and ESI monthly after the regular run is POSTED_TO_GL; PT monthly or half-yearly per state slab set; LWF half-yearly or annual per state; TDS quarterly; due dates from the obligation calendar (`28_Statutory_Calendar`) |
| Authentication | Download from Nucleus requires the compliance role within the entity scope and step-up authentication; portal credentials are held by the client's filer and are never stored in Nucleus |
| Idempotency key | `obligation_id` + `period` + `layout_version`; a repeat generation for a filed period creates a revision, never an overwrite |
| Owning process | CMP-02p (obligation calendar), CMP-03p (forms and registers), PAY statutory outputs; screens SCR-072, SCR-073 |
| Phase | P1 |
| Data classification | Confidential (wages and contributions) with Restricted identifiers (UAN, IP number, PAN) |

### 12.2 Payload specification

Layouts below list the business content; separators, column order and header records follow the authority's current published file specification, which the statutory SME validates for each layout version (to be validated by Legal).

**CMP-INT-001 — PF return line (one per member)**

| Field | Type | Length | M/C/O | Description | Source object.field | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| uan | string | 12 | M | Universal Account Number | person.uan | 12 digits; active member |
| member_name | string | 85 | M | Name as per UAN record | person.full_name | Upper case |
| gross_wages | integer | 10 | M | Gross wages for the month in rupees | payslip.gross | ≥ 0 |
| epf_wages | integer | 10 | M | Wages for EPF | salary_structure.statutory_wage_base (prorated) | ≤ gross; per tenant ceiling policy |
| eps_wages | integer | 10 | M | Wages for pension, capped at the statutory ceiling | payslip_line (PF node) | ≤ ceiling configured in the central rule pack |
| edli_wages | integer | 10 | M | Wages for insurance | payslip_line (PF node) | ≤ ceiling |
| epf_contribution_ee | integer | 10 | M | Employee share | payslip_line PF employee | Rate per rule pack |
| eps_contribution | integer | 10 | M | Pension share from employer | payslip_line PF employer split | Rate per rule pack |
| epf_eps_diff_er | integer | 10 | M | Employer share less pension share | payslip_line PF employer split | Equals employer share minus pension share |
| ncp_days | decimal | 4,1 | M | Non-contributory days | payslip.lop_days and unpaid days | 0 to days in month |
| refund_of_advances | integer | 10 | M | Refund of advances | payroll_input | ≥ 0 |

**CMP-INT-002 — ESI contribution line**

| Field | Type | Length | M/C/O | Description | Source object.field | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| ip_number | string | 10 | M | Insured person number | person.esi_ip | 10 digits |
| ip_name | string | 85 | M | Insured person name | person.full_name | — |
| days_paid | decimal | 4,1 | M | Days for which wages were paid | payslip.payable_days | 0 to days in month |
| total_monthly_wages | integer | 10 | M | Wages for ESI | payslip.gross (ESI-applicable components) | ≥ 0 |
| reason_code_zero_days | string | 2 | C | Reason when days paid is zero | — | Authority code list |
| last_working_day | date | 10 | C | When the employee left in the month | employment.employment_end | Within the month |

**CMP-INT-003 — PT and LWF return line**

| Field | Type | Length | M/C/O | Description | Source object.field | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| state_code | string | 2 | M | State of the slab set | location.state_code | KA, MH, TS, TN for the pilot |
| registration_no | string | 30 | M | Establishment registration | legal_entity / location statutory registration | Present for the state |
| employee_code | string | 10 | M | Employee | payslip.person_id | — |
| gross_for_slab | integer | 10 | M | Gross used to pick the slab | payslip.gross | ≥ 0 |
| pt_deducted | integer | 6 | M | PT deducted | payslip_line PT | Equals slab amount for the period (`48_PT_Slabs`) |
| lwf_employee / lwf_employer | integer | 6 | C | LWF contributions in an LWF period | payslip_line LWF | Per state LWF set |

**CMP-INT-004 — TDS statement deductee record (salary)**

| Field | Type | Length | M/C/O | Description | Source object.field | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| pan | string | 10 | M | Deductee PAN (detokenised at build) | person.pan_token | `^[A-Z]{5}[0-9]{4}[A-Z]$` |
| deductee_name | string | 75 | M | Name | person.full_name | — |
| payment_date | date | 10 | M | Salary payment date | payroll_run.pay_date | Within the quarter |
| amount_paid | decimal | 15,2 | M | Taxable salary paid | payslip lines (taxable) | ≥ 0 |
| tds_deducted | decimal | 15,2 | M | Tax deducted | payslip_line TDS | ≥ 0 |
| tds_deposited | decimal | 15,2 | M | Tax deposited | statutory_output (challan) | Equals deducted for the challan |
| challan_ref | string | 30 | M | Deposit challan reference | statutory_output.ack_ref | Exists for the period |
| regime | string | 3 | M | Tax regime opted | tax declaration | OLD or NEW |

### 12.3 Sample payload

PF return extract for LE-01, August 2026 (UANs are format-valid dummies; separator per the authority specification):

```text
100000376660#~#RAVI KULKARNI#~#70450#~#42840#~#15000#~#15000#~#5141#~#1250#~#3891#~#0#~#0
100000379341#~#SHIVANNA MUNIYAPPA#~#17550#~#17550#~#15000#~#15000#~#2106#~#1250#~#856#~#4#~#0
```

ESI contribution extract (E1032, August 2026, 27 days paid; IP number dummy):

```text
IP Number,IP Name,No of Days,Total Monthly Wages,Reason Code,Last Working Day
5300012345,SHIVANNA MUNIYAPPA,27,17550,,
```

Acknowledgement captured back:

```json
{ "obligation_id": "OB-2026-0912", "period": "2026-08", "filed_on": "2026-09-12",
  "ack_ref": "ECR ack 2026-09-12", "evidence_file_ref": "DOC-EV-2026-0912" }
```

### 12.4 Behaviour

| Aspect | Specification |
| :--- | :--- |
| Error handling and retries | Generation is refused unless the source run is POSTED_TO_GL and its pre-audit has no open CRITICAL flag. Missing UAN, IP number or PAN for an included employee is a blocking validation listed by employee. A portal rejection is entered by the filer with the authority's error text; the corrected file is generated as a new revision of the same obligation. No automated retries: filing is a human act. |
| Idempotency | One active file per obligation, period and layout version; a repeat generation creates revision n+1 with a reason and keeps earlier revisions. |
| Reconciliation report | Statutory reconciliation: liability credited in the journal for each head equals the challan amount (for example PF payable GL-014 4,032,000.00 for August equals the PF challan); line totals equal file header totals; obligations past due date without acknowledgement are red on SCR-072. |
| Ownership rules | Files are generated from posted records only (IA-03). The applicable form set follows the plant's registration, not the company's (RL-380). Acknowledgement references are authority-owned and retained against the period (RL-383). |
| Service levels | Files for 10,000 employees generated within 5 minutes; available at least 3 working days before each due date when the run is posted on time; evidence attached on filing day. |
| Versioning | Layouts versioned in the rule pack with `effective_from`; a layout change notified by an authority is a pack deployment with its golden cases, not an application release (DA-04 rule_pack). |

### 12.5 Sequence

```mermaid
sequenceDiagram
    autonumber
    participant PAY as Payroll engine
    participant CMP as Compliance service
    participant AG as Compliance Watcher
    participant FILER as Compliance owner
    participant PORTAL as Statutory portal
    PAY->>CMP: payroll.run.posted
    CMP->>CMP: Obligation due, select layout for period
    AG->>CMP: assemble_filing_pack, propose only
    CMP->>FILER: Pack with files and totals on SCR-072
    FILER->>PORTAL: Upload return and pay challan
    PORTAL-->>FILER: Acknowledgement
    FILER->>CMP: Attach acknowledgement and challan
    CMP->>CMP: Emit compliance.obligation.filed
```

### 12.6 Interface requirements and acceptance criteria

| ID | Requirement | Rationale | Source / trace | Realises SYS | Priority | Verification | Acceptance criterion |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| CMP-INT-001.01 | Statutory files MUST be generated only from posted payroll records. | Returns must agree with the ledger. | IA-03 statutory flow | SYS-086 | Must | T | Generation for PR-2026-09-01 at PRE_AUDIT is refused. |
| CMP-INT-001.02 | The statutory liability in the journal for each head MUST equal the challan amount for the period. | Closes the payroll-to-authority loop. | RL-530, IA-03 | SYS-084, SYS-086 | Must | T | August PF liability equals the PF challan with zero variance. |
| CMP-INT-001.03 | Filing MUST remain a human act; the agent tool MUST only propose the filing pack. | Statutory filing always requires a named human. | DA-04 tenant_agent_policy, IA-01 assemble_filing_pack | SYS-074, SYS-086 | Must | I | No code path submits to a portal; the ledger shows propose actions only. |
| CMP-INT-001.04 | The acknowledgement reference MUST be captured and retained against the obligation and period. | Evidence for inspection. | RL-383 | SYS-086 | Must | T | OB-2026-0912 shows the acknowledgement and evidence file. |
| CMP-INT-002.01 | The ESI file MUST include only employees covered for the contribution period, with days paid and wages from the payslip. | Coverage continues within a contribution period once established (to be validated by Legal). | CMP-02p | SYS-045, SYS-086 | Must | T | E1032 appears with 27 days and 17,550; E1018 does not. |
| CMP-INT-003.01 | PT and LWF returns MUST be produced per state from that state's slab set, including half-yearly levies. | Same run, different state answers. | RL-380, `48_PT_Slabs`, GL-016, GL-017, GL-026, GL-027 | SYS-045, SYS-086 | Must | T | LE-02 produces separate Telangana and Tamil Nadu returns for the same period. |
| CMP-INT-004.01 | The TDS statement MUST reconcile deducted tax to deposited challans for every deductee in the quarter. | Mismatches create notices for employees. | CMP-02p | SYS-086 | Must | T | A deliberate challan shortfall is flagged before file generation. |
| CMP-INT-004.02 | File layouts MUST be versioned in the rule pack and selected by the filing period's effective date. | Authority layouts change independently of releases. | RL-381, DA-04 rule_pack | SYS-045, SYS-086 | Must | I | Two layout versions coexist and each period uses the one in force for it. |

## 13. LCY-INT-001 — Background Verification

### 13.1 Interface profile

| Attribute | Value |
| :--- | :--- |
| Interface ID | LCY-INT-001 |
| Purpose | Initiate background-verification cases for selected candidates after recorded consent, and bring case status and results back onto the pre-boarding chain for a human decision |
| Direction | Nucleus → Provider (case creation); Provider → Nucleus (status callbacks and report) |
| Counterparty | Background-verification provider engaged by the tenant |
| Mechanism | Provider HTTPS API for case creation; signed callback `POST /v1/integration/bgv/callback` (authored addition to IA-01); report retrieved as an encrypted file and stored in the document vault |
| Trigger and cadence | Per hire, when the pre-boarding chain reaches the verification step after offer acceptance and consent |
| Authentication | Outbound OAuth 2.0 client credentials or mTLS per provider; inbound HMAC-SHA256 signature; identity numbers carried only as JWE-encrypted members |
| Idempotency key | `case_ref` (Nucleus) = `candidate_id` + `offer_id` + `check_set_version` |
| Owning process | LCY-02 (pre-boarding and joining chain, FRM-LCY-01, SCR-060) |
| Phase | P3 |
| Data classification | Restricted (identity documents, background-check results) |

### 13.2 Payload specification

**Case request**

| Field | Type | Length | M/C/O | Description | Source object.field | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| case_ref | string | 40 | M | Nucleus case reference | workflow instance step | Unique |
| candidate_id | string | 15 | M | Candidate | candidate.candidate_id | Exists, stage Offer accepted |
| consent_id | string | 20 | M | Consent record | candidate.consent_ref; consent_record.consent_id | Granted, not withdrawn, purpose `background_verification` |
| consent_at | timestamp | 30 | M | Consent time | consent_record.granted_at | Before `requested_at` |
| notice_version | string | 10 | M | Privacy notice shown | consent_record.notice_version | Current version |
| full_name | string | 120 | M | Candidate name | candidate.name | — |
| date_of_birth | date | 10 | M | Date of birth | candidate (personal) | — |
| contact | object | — | M | Mobile and email | candidate.contact | E.164 and RFC 5322 |
| checks | array | — | M | IDENTITY, ADDRESS, EDUCATION, EMPLOYMENT, CRIMINAL_RECORD, REFERENCE | check set configuration | Allowed by the tenant check set for the position |
| identity_documents | JWE | — | C | Encrypted document types and numbers | document (vault) | Present when IDENTITY is requested |
| document_links | array | — | O | Pre-signed links to uploaded documents | document.file_ref | Expire after 15 minutes, single use |
| requested_at | timestamp | 30 | M | Request time | — | — |

**Callback**

| Field | Type | Length | M/C/O | Description | Source object.field | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| case_ref | string | 40 | M | Echo | — | Exists |
| provider_case_id | string | 40 | M | Provider reference | — | — |
| case_status | string | 20 | M | INITIATED, IN_PROGRESS, INSUFFICIENT, CLEAR, DISCREPANT, UNABLE_TO_VERIFY | step status | Enumeration |
| check_results | array | — | C | Per check: `check`, `status`, `completed_at`, `summary` | — | Summary without raw identifiers |
| report_available | boolean | 1 | M | Final report ready | — | — |
| event_id | string | 64 | M | Provider event identifier | — | Unique; used for deduplication |

### 13.3 Sample payload

```json
{ "case_ref": "BGV-CN-2026-0211-OF-2026-0071-1", "candidate_id": "CN-2026-0211",
  "consent_id": "CNS-2026-0388", "consent_at": "2026-09-19T16:02:11+05:30", "notice_version": "PN-3.2",
  "full_name": "Basanti Naik", "date_of_birth": "1998-05-21",
  "contact": { "mobile": "+919900112233", "email": "basanti.naik@example.in" },
  "checks": ["IDENTITY", "ADDRESS", "EMPLOYMENT"],
  "identity_documents": "eyJhbGciOiJSU0EtT0FFUC0yNTYiLCJlbmMiOiJBMjU2R0NNIn0...",
  "requested_at": "2026-09-20T10:00:00+05:30" }
```

```json
{ "case_ref": "BGV-CN-2026-0211-OF-2026-0071-1", "provider_case_id": "PV-448812",
  "case_status": "DISCREPANT", "report_available": true, "event_id": "pv-evt-90114",
  "check_results": [ { "check": "EMPLOYMENT", "status": "DISCREPANT", "completed_at": "2026-09-27T12:40:00+05:30",
                       "summary": "Tenure differs from declaration by 5 months" } ] }
```

### 13.4 Behaviour

| Aspect | Specification |
| :--- | :--- |
| Error handling and retries | Case creation without a current consent is blocked before any data leaves Nucleus. Outbound failures follow §5.5. INSUFFICIENT status opens a task for the recruiter to collect documents. A callback for an unknown case is rejected and alerted. |
| Idempotency | Repeated `case_ref` returns the existing provider case; repeated callback `event_id` is ignored after the first. |
| Reconciliation report | Verification register: cases initiated, in progress, completed, overdue against the provider's agreed turnaround per check; cases without a final status at the joining date are flagged on SCR-060. |
| Ownership rules | Results are provider-owned and read-only. The hiring decision is human: a DISCREPANT result never auto-rejects a candidate; the decision and its reason are recorded. Consent withdrawal stops processing and triggers deletion at the provider under the contract. |
| Service levels | Case creation acknowledged within 1 minute; status changes reflected within 5 minutes of the provider callback; final report stored in the vault within 1 hour of availability. |
| Versioning | Check-set version recorded on each case; provider adapters versioned independently. |

### 13.5 Sequence

```mermaid
sequenceDiagram
    autonumber
    participant CAN as Candidate
    participant LCY as Pre-boarding chain
    participant IS as Integration service
    participant BGV as BGV provider
    participant HR as Recruiter
    CAN->>LCY: Gives consent with notice version
    LCY->>IS: Create case with consent reference
    IS->>BGV: Case request, identity data encrypted
    BGV-->>IS: Accepted with provider case ID
    BGV->>IS: Signed status callbacks
    IS->>LCY: Update verification step status
    alt Discrepant or insufficient
        LCY->>HR: Human review task with reasons
    else Clear
        LCY->>LCY: Step complete, chain continues
    end
```

### 13.6 Interface requirements and acceptance criteria

| ID | Requirement | Rationale | Source / trace | Realises SYS | Priority | Verification | Acceptance criterion |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| LCY-INT-001.01 | Consent MUST be recorded with notice version before any candidate data is dispatched. | Consent precedes processing (to be validated by Legal). | IA-03 BGV flow, DA-01 consent_record | SYS-084 | Must | T | Initiating a case for a candidate without consent is blocked and nothing is sent. |
| LCY-INT-001.02 | Case status MUST flow back onto the pre-boarding chain step. | One place to see joining readiness. | IA-03 BGV reconciliation | SYS-037, SYS-084 | Must | T | A provider status change is visible on SCR-060 within 5 minutes. |
| LCY-INT-001.03 | A discrepant or unverifiable result MUST create a human review task and MUST NOT reject the candidate automatically. | Humans decide; reasons recorded. | DA-01 candidate note | SYS-037, SYS-084 | Must | T | DISCREPANT for CN-2026-0211 opens a recruiter task; candidate stage is unchanged until decided. |
| LCY-INT-001.04 | Identity numbers MUST travel only as encrypted members and MUST NOT appear in logs or callbacks. | Restricted data handling. | GOV-10 §5 | SYS-033, SYS-084 | Must | I | Payload and log inspection show only encrypted or masked identifiers. |
| LCY-INT-001.05 | Reports MUST be stored in the document vault with Restricted classification and the candidate retention rule. | Retention for non-hired candidates is limited. | GOV-10 §8 | SYS-027, SYS-084 | Must | I | Report document carries Restricted class and a disposal date. |

## 14. EXP-INT-001 — E-Signature

### 14.1 Interface profile

| Attribute | Value |
| :--- | :--- |
| Interface ID | EXP-INT-001 |
| Purpose | Send generated letters, policies and contracts for electronic signature and retain the signed artefact and its audit certificate together with the template version used |
| Direction | Nucleus → Provider (envelope); Provider → Nucleus (status and signed file) |
| Counterparty | E-signature provider engaged by the tenant, offering signature methods recognised under the Information Technology Act, 2000 (to be validated by Legal) |
| Mechanism | Provider HTTPS API; signed callback `POST /v1/integration/esign/callback` (authored addition to IA-01) |
| Trigger and cadence | Per document, when a letter is issued (`experience.letter.issued`) with signature required, or a policy or contract needs acknowledgement |
| Authentication | Outbound OAuth 2.0 client credentials; inbound HMAC-SHA256 signature; signer identity verified by the provider's method (one-time code or approved electronic signature method) |
| Idempotency key | `envelope_ref` = `issue_id` + `revision` |
| Owning process | EXP-03 (letters, FRM-EXP-01, SCR-067), LCY-02 policy acknowledgements (RL-394) |
| Phase | P2 |
| Data classification | Personal (letters may carry compensation, which makes them Restricted) |

### 14.2 Payload specification

| Field | Type | Length | M/C/O | Description | Source object.field | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| envelope_ref | string | 40 | M | Nucleus envelope reference | letter_issued.issue_id | Unique |
| template_id | string | 15 | M | Template | letter_issued.template_id | Approved template |
| template_version | string | 30 | M | Version used | letter_issued.template_version | Version in force on issue date |
| document_sha256 | string | 64 | M | Hash of the rendered PDF | letter_issued.file_ref | Recomputed by the provider and on return |
| document | binary (base64) | ≤ 10 MB | M | Rendered PDF | letter_issued.file_ref | PDF/A |
| signers | array | — | M | Ordered signers with `role`, `name`, `email`, `mobile`, `order` | person; authorised signatory configuration | At least one; signatory authorised for the entity |
| signature_method | string | 20 | M | OTP_ESIGN, AADHAAR_ESIGN, DSC | — | Allowed for the document type |
| expires_at | timestamp | 30 | M | Envelope expiry | — | ≤ 30 days |
| callback status | string | 15 | M | SENT, VIEWED, SIGNED, DECLINED, EXPIRED, COMPLETED | — | Enumeration |
| signed_document | binary | ≤ 15 MB | C | Signed PDF on COMPLETED | document vault | Hash chain verifies |
| audit_certificate | binary | ≤ 2 MB | C | Signer events, times, methods | document vault | Present on COMPLETED |

### 14.3 Sample payload

```json
{ "envelope_ref": "ISS-2026-0311-1", "template_id": "appointment_letter", "template_version": "v2.1 effective 2026-04-01",
  "document_sha256": "4b9e0f6a1c27d3e85f90b2a4c6d8e0f13579bdf02468ace13579bdf02468ace1",
  "signers": [
    { "order": 1, "role": "authorised_signatory", "name": "Arvind Raghunathan", "email": "arvind.r@vindhya.example" },
    { "order": 2, "role": "employee", "name": "Abhinav Rastogi", "mobile": "+919822001144" } ],
  "signature_method": "OTP_ESIGN", "expires_at": "2026-09-08T23:59:59+05:30" }
```

### 14.4 Behaviour

| Aspect | Specification |
| :--- | :--- |
| Error handling and retries | Outbound failures follow §5.5. DECLINED and EXPIRED return the letter to HR with the reason; a re-issue creates a new revision. A returned signed file whose embedded hash chain does not match `document_sha256` is rejected and alerted. |
| Idempotency | Repeated `envelope_ref` returns the existing envelope; callbacks deduplicated on provider event ID. |
| Reconciliation report | Issued versus signed register: issued, pending, signed, declined, expired by template and month; documents pending past the SLA are flagged on SCR-067. |
| Ownership rules | The rendered document and template version are Nucleus-owned; the signature evidence is provider-owned and stored unaltered. The signed artefact is retained with the template version so a reprint years later is defensible (DA-01 letter_issued). |
| Service levels | Envelope created within 1 minute of issue; completion reflected within 5 minutes of the callback. |
| Versioning | Template version recorded on every envelope; provider adapter versioned independently. |

### 14.5 Sequence

```mermaid
sequenceDiagram
    autonumber
    participant HR as HR user
    participant EXP as Letters service
    participant IS as Integration service
    participant ES as E-signature provider
    participant EMP as Employee
    HR->>EXP: Issue appointment letter
    EXP->>IS: Envelope with PDF hash and template version
    IS->>ES: Create envelope
    ES->>EMP: Signing request
    EMP->>ES: Signs with one-time code
    ES->>IS: COMPLETED callback with signed file
    IS->>IS: Verify hash chain
    IS->>EXP: Store signed file and audit certificate
```

### 14.6 Interface requirements and acceptance criteria

| ID | Requirement | Rationale | Source / trace | Realises SYS | Priority | Verification | Acceptance criterion |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| EXP-INT-001.01 | The signed artefact MUST be retained with the template version used to render it. | Defensible reprint and evidence. | IA-03 e-signature flow, DA-01 letter_issued | SYS-032, SYS-084 | Must | T | ISS-2026-0311 shows the appointment letter template v2.1 with the signed file. |
| EXP-INT-001.02 | The returned signed document MUST be verified against the hash sent. | Detects tampering. | §5.1 | SYS-084, SYS-088 | Must | T | A modified file is rejected and alerted. |
| EXP-INT-001.03 | An issued-versus-signed register MUST be available with ageing. | Unsigned letters are compliance gaps. | IA-03 reconciliation | SYS-084 | Must | D | Register lists pending envelopes older than 7 days. |
| EXP-INT-001.04 | Only signature methods approved per document type MUST be offered. | Legal validity of the method varies by document (to be validated by Legal). | Authored | SYS-059, SYS-084 | Must | I | Configuration shows allowed methods per template type. |

## 15. PLT-INT-003 and PLT-INT-004 — Identity Federation and Provisioning

### 15.1 Interface profile

| Attribute | Value |
| :--- | :--- |
| Interface IDs | PLT-INT-003 Federated sign-in (OIDC and SAML 2.0); PLT-INT-004 Account provisioning (SCIM 2.0) |
| Purpose | Delegate authentication to the tenant's identity provider, and keep user accounts in the enterprise directory in step with worker joiner, mover and leaver events so that access follows assignment status |
| Direction | Both. Sign-in: identity provider → Nucleus assertions. Provisioning mode A (default, worker-driven): Nucleus → directory as SCIM client. Provisioning mode B: directory → Nucleus SCIM service endpoints for principal accounts only |
| Counterparty | Identity provider and enterprise directory of the tenant |
| Mechanism | OIDC authorisation code flow with PKCE (web and mobile) or SAML 2.0 service-provider-initiated sign-in; SCIM 2.0 `/Users` and `/Groups` with the enterprise user extension; Nucleus SCIM service endpoints `/scim/v2/Users`, `/scim/v2/Groups` (authored addition to IA-01) |
| Trigger and cadence | Sign-in on demand; provisioning on `people.worker.hired`, `people.assignment.changed`, separation effective time; nightly full parity check |
| Authentication | Sign-in: signed ID tokens or assertions validated against the identity provider's published keys or certificate. SCIM: OAuth 2.0 bearer token with scope `scim.provision` over mTLS |
| Idempotency key | SCIM `externalId` = employee code; operation key = `assignment_id` + `version` |
| Owning process | PLT-02 (principals, grants), PPL-01, PPL-02, LCY-06 (exit) |
| Phase | P0 |
| Data classification | Personal (work identity attributes); no passwords are stored for federated tenants |

### 15.2 Payload specification

**Sign-in claims consumed (PLT-INT-003)**

| Claim or attribute | Type | Length | M/C/O | Description | Source object.field | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| sub or NameID | string | 255 | M | Stable subject identifier | principal.principal_id (federated link) | Linked to exactly one principal |
| email | string | 254 | M | Work email | person (contact) | Domain in the tenant's verified domains |
| employee_number | string | 10 | C | Employee code where the provider releases it | person / assignment | Matches the linked person |
| amr / acr | string | 50 | M | Authentication methods and context | — | Meets the tenant's step-up policy for sensitive actions |
| auth_time | timestamp | — | M | Time of authentication | — | Within session policy |

**SCIM user resource (PLT-INT-004)**

| Attribute | Type | Length | M/C/O | Description | Source object.field | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| externalId | string | 10 | M | Employee code | assignment.person_id → employee code | Unique |
| userName | string | 254 | M | Sign-in name | person (official email) | Unique in directory |
| name.givenName / familyName | string | 60 | M | Name | person.full_name | — |
| active | boolean | 1 | M | Account enabled | employment status and assignment dates | False from the separation effective time |
| title | string | 80 | O | Designation title | designation.title | — |
| enterprise.employeeNumber | string | 10 | M | Employee code | — | Equals externalId |
| enterprise.department | string | 80 | O | Org unit name | org_unit.name | — |
| enterprise.costCenter | string | 20 | O | Cost centre | assignment.cost_centre | — |
| enterprise.organization | string | 10 | O | Legal entity code | employment.legal_entity_id | — |
| enterprise.manager.value | string | 10 | O | Manager's employee code | assignment.manager_assignment_id | Existing user |
| groups | array | — | O | Role groups derived from grants | role, entity_grant, location_grant | Group names configured per tenant |

### 15.3 Sample payload

```json
{ "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User",
              "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User"],
  "externalId": "E1066", "userName": "abhinav.rastogi@vindhya.example",
  "name": { "givenName": "Abhinav", "familyName": "Rastogi" }, "active": true,
  "title": "Engineer",
  "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User": {
    "employeeNumber": "E1066", "department": "OU-122", "costCenter": "CC-3200",
    "organization": "LE-01", "manager": { "value": "E1039" } } }
```

Leaver deactivation for E1068 at the end of the last working day:

```json
{ "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
  "Operations": [ { "op": "replace", "path": "active", "value": false } ] }
```

### 15.4 Behaviour

| Aspect | Specification |
| :--- | :--- |
| Error handling and retries | Invalid signature, audience or expired assertion: sign-in refused and logged. SCIM transient failures follow §5.5; a leaver deactivation that is still failing after attempt 3 raises a security incident. A SCIM `409` conflict on `userName` is held for the administrator. |
| Idempotency | SCIM operations are keyed by `externalId` and `assignment_id` + `version`; replays produce the same end state. |
| Reconciliation report | Joiner-mover-leaver parity report, nightly: active assignments without an active account; accounts active for workers whose employment has ended (must be zero); attribute mismatches on department, manager and cost centre. |
| Ownership rules | Nucleus does not write authentication: credentials, multi-factor policy and session lifetime belong to the identity provider (IA-03). Worker attributes are Nucleus-owned in mode A. In mode B the directory may create principal accounts in Nucleus but never person, employment or assignment records. Authorisation (roles, entity and location grants) is always Nucleus-owned (RL-002 to RL-004). |
| Service levels | Joiner account ready by the day before the date of joining; mover changes within 15 minutes; leaver deactivation within 1 hour of the separation effective time; sign-in assertion validation under 300 ms at p95. |
| Versioning | SCIM 2.0 core and enterprise schemas; custom attributes in a Nucleus extension schema with its own version. |

### 15.5 Sequence

```mermaid
sequenceDiagram
    autonumber
    participant PPL as People Core
    participant IS as Integration service
    participant DIR as Enterprise directory
    participant IDP as Identity provider
    participant U as Worker
    PPL->>IS: people.worker.hired E1066
    IS->>DIR: SCIM create user, externalId E1066
    DIR-->>IS: 201 Created
    U->>IDP: Sign in
    IDP-->>U: ID token or assertion
    U->>IS: Present token to Nucleus
    IS->>IS: Validate and map to principal and grants
    PPL->>IS: Separation effective for E1068
    IS->>DIR: SCIM patch active false
```

### 15.6 Interface requirements and acceptance criteria

| ID | Requirement | Rationale | Source / trace | Realises SYS | Priority | Verification | Acceptance criterion |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PLT-INT-003.01 | Nucleus MUST support OIDC and SAML 2.0 federated sign-in and MUST NOT store passwords for federated tenants. | Do not write authentication. | IA-03 SSO flow | SYS-011, SYS-083 | Must | T | A federated tenant has no password hashes in the principal store. |
| PLT-INT-003.02 | Sensitive actions (payroll approval, bank release, salary view) MUST require the authentication context configured for step-up. | Zero-trust for high-impact actions. | BG-06, FIN-INT-004.01 | SYS-015, SYS-083 | Must | T | A session without the required `acr` is prompted for step-up before release. |
| PLT-INT-004.01 | Leaver accounts MUST be deactivated within 1 hour of the separation effective time. | Access must end with employment. | IA-03 joiner-mover-leaver parity | SYS-012, SYS-083 | Must | T | E1068's account is inactive within 1 hour of 30 September 2026 end of day. |
| PLT-INT-004.02 | A nightly parity report MUST show zero active accounts for workers whose employment has ended. | Detects missed deprovisioning. | IA-03 reconciliation | SYS-012 | Must | T | Report shows zero after the leaver test. |
| PLT-INT-004.03 | Directory-driven provisioning MUST NOT create person, employment or assignment records. | Worker identity is mastered in People Core or the ERP system. | GOV-10 §6 | SYS-009, SYS-083 | Must | T | A SCIM create on the Nucleus endpoint yields only a principal awaiting linkage. |
| PLT-INT-004.04 | Authorisation grants MUST remain Nucleus-owned regardless of provisioning mode. | Data scope is evaluated by Nucleus at query time. | RL-002 to RL-004 | SYS-019, SYS-083 | Must | I | No SCIM attribute maps to entity or location grants. |

## 16. CTG-INT-001 — Contractor and Vendor Master

### 16.1 Interface profile

| Attribute | Value |
| :--- | :--- |
| Interface ID | CTG-INT-001 |
| Purpose | Receive contractor and vendor codes and contract terms from the ERP system so that contractor engagements, deployed workers and invoices in Nucleus reconcile to the client's vendor records |
| Direction | ERP system → Nucleus |
| Counterparty | ERP system of the client (vendor master) |
| Mechanism | REST snapshot `POST /v1/integration/vendor-master` (authored addition to IA-01) or scheduled CSV file |
| Trigger and cadence | Monthly full snapshot; on-demand delta when a new contractor is onboarded |
| Authentication | OAuth 2.0 client credentials, scope `integration.write`, over mTLS; SFTP plus OpenPGP for files |
| Idempotency key | `snapshot_id`; per row `vendor_code` + `payload_hash` |
| Owning process | CTG (contractor engagement FRM-CTG-01, invoice reconciliation FRM-CTG-02, SCR-095, SCR-096) |
| Phase | P3 |
| Data classification | Confidential |

### 16.2 Payload specification

| Field | Type | Length | M/C/O | Description | Source object.field | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| vendor_code | string | 10 | M | ERP vendor code | contractor_engagement.vendor_id; assignment.vendor_id | Unique |
| vendor_name | string | 120 | M | Registered name | vendor master (reference) | — |
| status | string | 10 | M | Active, Inactive, Blocked | — | Enumeration |
| engagement_type | string | 40 | M | Third party deployed workforce, contractual daily wage, and others | contractor_engagement (type) | Picklist value |
| contract_ref | string | 30 | M | Contract reference | contractor_engagement.contract_ref | — |
| contract_from / contract_to | date | 10 | M | Contract validity | contractor_engagement.start, end | `contract_to` ≥ `contract_from` |
| sites_served | array | — | M | Location codes | contractor_engagement.site | Existing locations |
| clra_licence | string | 30 | C | Contract labour licence | — | Mandatory for deployed workforce |
| pf_code / esi_code | string | 30 | C | Contractor's statutory registrations | — | Mandatory when the contractor's workers are covered |
| rate_card | array | — | O | `worker_class`, `rate_per_day`, `effective_from` | contractor_engagement.rate_card | Amount ≥ 0 |
| gstin | string | 15 | O | Tax registration | — | 15-character format |

### 16.3 Sample payload

```json
{ "snapshot_id": "ERP-VEN-2026-09-01", "schema_version": "1.0.0",
  "items": [ { "vendor_code": "VN-01", "vendor_name": "Sharada Manpower Services", "status": "Active",
               "engagement_type": "Third party - deployed workforce", "contract_ref": "VPI-CLC-2025-014",
               "contract_from": "2025-04-01", "contract_to": "2027-03-31", "sites_served": ["LOC-PLA"],
               "clra_licence": "KA/CLRA/2025/00418", "pf_code": "KA/BLR/0051103", "esi_code": "53000123450000801",
               "rate_card": [ { "worker_class": "WC-3PE", "rate_per_day": "700.00", "effective_from": "2025-04-01" } ] } ] }
```

### 16.4 Behaviour

| Aspect | Specification |
| :--- | :--- |
| Error handling and retries | Row validation as §8.4; a vendor set to Blocked in the ERP system blocks new deployments in Nucleus and flags open invoices. Transient failures follow §5.5. |
| Idempotency | As §8.4. |
| Reconciliation report | Invoice versus attendance variance before payment: claimed worker days against attendance-derived days per invoice; variance held, not paid (INV-VN01-2609: 56 claimed, 53 supported, 37,100.00 passed of 39,200.00). Contract expiry report: contracts ending within 30 days without renewal (VN-04 expiring 30 September 2026). |
| Ownership rules | Vendor code, name, status, contract dates and registrations are ERP-owned. Statutory verification status of the contractor (PF and ESI challan evidence) and the deployed-worker records are Nucleus-owned. Policy attaches to worker class, not to the contract (DA-01 contractor_engagement). |
| Service levels | Snapshot applied within 10 minutes; variance report available within 1 hour of invoice registration. |
| Versioning | As §5.8. |

### 16.5 Sequence

```mermaid
sequenceDiagram
    autonumber
    participant ERP as ERP system
    participant IS as Integration service
    participant CTG as Contingent service
    participant FIN as Finance user
    ERP->>IS: Monthly vendor snapshot
    IS->>CTG: Apply ERP-owned vendor fields
    CTG->>CTG: Check contract expiry within 30 days
    CTG->>FIN: Expiry alerts
    FIN->>CTG: Register vendor invoice
    CTG->>CTG: Compare claimed days with attendance
    alt Variance found
        CTG->>FIN: Hold difference, query raised
    else No variance
        CTG->>FIN: Passed for payment
    end
```

### 16.6 Interface requirements and acceptance criteria

| ID | Requirement | Rationale | Source / trace | Realises SYS | Priority | Verification | Acceptance criterion |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| CTG-INT-001.01 | Vendor records in Nucleus MUST reconcile to the client's vendor master by vendor code. | Reconcilable to the client's vendor records. | IA-03 contractor flow | SYS-084 | Must | T | Every vendor referenced on an assignment exists in the latest snapshot. |
| CTG-INT-001.02 | Invoice variance against attendance MUST be computed and held before payment is passed. | Variance visible before payment. | DA-01 contractor_invoice, `46_Contractor_Invoices` | SYS-051, SYS-084 | Must | T | INV-VN01-2609 shows variance of 3 days and passes 37,100.00. |
| CTG-INT-001.03 | Contracts expiring within 30 days without renewal MUST raise an obligation alert. | Principal-employer exposure. | `45_Vendors_Contractors` note | SYS-084 | Should | T | VN-04 appears on the obligation calendar before 30 September 2026. |
| CTG-INT-001.04 | ERP-owned vendor fields MUST be read-only in Nucleus. | Single owner per field. | RL-515 (applied to vendors) | SYS-084 | Must | T | Editing VN-01's contract dates in Nucleus is rejected. |

## 17. INT-INT-001 — MCP Server

### 17.1 Interface profile

| Attribute | Value |
| :--- | :--- |
| Interface ID | INT-INT-001 |
| Purpose | Expose the governed tool surface to the client's own AI environment over the Model Context Protocol, under the same policy gate, autonomy limits and action ledger as Nucleus internal agents (build once, expose twice) |
| Direction | Client AI environment ↔ Nucleus |
| Counterparty | MCP clients operated by the tenant |
| Mechanism | MCP server over streamable HTTPS (JSON-RPC 2.0 messages): `initialize`, `tools/list`, `tools/call`; tools exactly as listed in IA-01 governed tool surface |
| Trigger and cadence | On demand |
| Authentication | OAuth 2.1 authorisation code with PKCE through the tenant's identity provider; every token bound to a human principal; agent principals must name an accountable human owner (RL-001); tool scopes equal the IA-01 permissions |
| Idempotency key | `action_id` generated per `tools/call`; write tools also accept the caller's `idempotency_key` argument |
| Owning process | INT-01 (governed action), INT-02 (reversal) |
| Phase | P3 |
| Data classification | As per the data returned; compensation fields obey RL-005; Restricted identifiers are never returned in tool output |

### 17.2 Payload specification

**tools/call request**

| Field | Type | Length | M/C/O | Description | Source object.field | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| jsonrpc | string | 3 | M | Protocol version marker | — | `2.0` |
| id | string or integer | 64 | M | Request identifier | — | Unique per session |
| method | string | 20 | M | `tools/call` | — | — |
| params.name | string | 40 | M | Tool name | IA-01 tool | One of the 12 governed tools allowed for the principal |
| params.arguments | object | — | M | Tool arguments | — | Validated against the tool's JSON Schema |
| params.arguments.dry_run | boolean | 1 | C | Simulate only | action_ledger.simulation_result | Available on tools marked dry run in IA-01 |
| params.arguments.idempotency_key | string | 80 | C | Caller key for write tools | action_ledger | Unique per principal for 24 hours |

**tools/call result**

| Field | Type | Length | M/C/O | Description | Source object.field | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| result.content | array | — | M | Human-readable content | — | No Restricted values |
| result.structuredContent | object | — | M | Machine-readable output | Tool output schema | Validates against the output schema |
| result._meta.action_id | string | 36 | M | Ledger reference | action_ledger.action_id | Every call has one |
| result._meta.outcome | string | 20 | M | executed, proposed, simulated, denied | action_ledger.outcome | Enumeration |
| result._meta.approval_ref | string | 30 | C | Pending human approval | action_ledger.approval_ref | Present when outcome is proposed |
| result._meta.reversal_handle | string | 60 | C | Handle to reverse a write | action_ledger.reversal_handle | Present for reversible writes |
| result.isError | boolean | 1 | C | Tool-level error | — | Policy denials return `denied` with the rule |

### 17.3 Sample payload

```json
{ "jsonrpc": "2.0", "id": 41, "method": "tools/call",
  "params": { "name": "check_loan_eligibility", "arguments": { "person_id": "E1044" } } }
```

```json
{ "jsonrpc": "2.0", "id": 41,
  "result": {
    "content": [ { "type": "text", "text": "Not eligible: one active loan at a time (LN-2026-0041 active)." } ],
    "structuredContent": { "person_id": "E1044", "eligible": false, "ceiling": "87000.00",
                           "reasons": ["ONE_LOAN_AT_A_TIME"], "source": "loans.eligibility" },
    "_meta": { "action_id": "0f6a4c1e-6d2b-4a77-9b51-2b9e7d3f1a20", "outcome": "executed" } } }
```

### 17.4 Behaviour

| Aspect | Specification |
| :--- | :--- |
| Error handling and retries | Schema violation: JSON-RPC error `-32602` with the failing argument. Policy denial (scope, blast radius, autonomy limit): `isError` true with outcome `denied` and the rule. Disbursement, termination, offer release, statutory filing and loan sanction never execute through this interface; at most they are proposed for a named human (DA-04 tenant_agent_policy). Clients retry transient errors with backoff; write tools rely on `idempotency_key`. |
| Idempotency | A repeated `idempotency_key` from the same principal returns the original result and `action_id`. |
| Reconciliation report | Ledger completeness, daily: count of `tools/call` requests at the gateway equals `action_ledger` rows for the same period, by tool and outcome; reversal rate by tool (target under 2%, NFR-01). |
| Ownership rules | The tool contract, policy gate and ledger are Nucleus-owned; the same tool returns the same answer as the screen and the payroll node (IA-01 check_loan_eligibility). The external client never receives a wider scope than its human principal. |
| Service levels | Read tools p95 under 800 ms; propose and write tools p95 under 2 seconds excluding human approval; default limit 60 calls per minute per principal. |
| Versioning | Tool schemas versioned; `tools/list` advertises the version; a breaking tool change is published as a new tool name with the old one deprecated per §5.8. |

### 17.5 Sequence

```mermaid
sequenceDiagram
    autonumber
    participant AI as Client AI environment
    participant MCP as MCP server
    participant POL as Policy gate
    participant SVC as Domain service
    participant LED as Action ledger
    AI->>MCP: tools/call with user-bound token
    MCP->>POL: Check scope, autonomy and blast radius
    alt Allowed read or dry run
        POL->>SVC: Execute
        SVC-->>MCP: Result
    else Requires human approval
        POL->>LED: Record proposal with approval reference
        POL-->>MCP: Outcome proposed
    else Denied
        POL-->>MCP: Outcome denied with rule
    end
    MCP->>LED: Record action with outcome
    MCP-->>AI: Result with action_id
```

### 17.6 Interface requirements and acceptance criteria

| ID | Requirement | Rationale | Source / trace | Realises SYS | Priority | Verification | Acceptance criterion |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| INT-INT-001.01 | External MCP calls MUST pass the same policy gate as internal agents. | Same policy gate and action ledger. | IA-03 MCP flow | SYS-073, SYS-075 | Must | T | A tool denied to the Policy Assistant is denied identically over MCP. |
| INT-INT-001.02 | Every call MUST create an action ledger entry with principal, tool, inputs reference, outcome and reversal handle. | Every call in the ledger. | IA-03 reconciliation, DA-01 action_ledger | SYS-035, SYS-075 | Must | T | Daily gateway count equals ledger count for the test day. |
| INT-INT-001.03 | Every token MUST be bound to a human principal, and agent principals MUST have a named human owner. | Accountability for agent actions. | RL-001 | SYS-009, SYS-010 | Must | T | A token without a human principal is refused at `initialize`. |
| INT-INT-001.04 | Tools listed as propose-only MUST NOT execute writes over MCP regardless of tenant autonomy settings. | Payroll Preparer is propose-only always. | IA-01 run_pre_audit, DA-04 tenant_agent_policy | SYS-072, SYS-073 | Must | T | `run_pre_audit` over MCP yields `proposed` and no state change. |
| INT-INT-001.05 | Tool output MUST respect field-level scope, returning null for compensation outside the caller's payroll group. | Scope applies on every surface. | RL-005, T-18 | SYS-017, SYS-018 | Must | T | `read_employee` for E1056 by a Chennai plant HR principal returns null compensation fields. |

## 18. PLT-INT-001 — Public REST API

### 18.1 Interface profile

| Attribute | Value |
| :--- | :--- |
| Interface ID | PLT-INT-001 |
| Purpose | Give partners, client systems, device agents and Nucleus channels one documented, versioned, scope-resolved HTTP API over the product's records and actions |
| Direction | Partner ↔ Nucleus |
| Counterparty | Partner applications, client systems, site agents, ERP connectors |
| Mechanism | HTTPS with JSON bodies, described in OpenAPI 3.1; tenant-scoped base URL issued at provisioning; sandbox tenant for every partner |
| Trigger and cadence | On demand |
| Authentication | OAuth 2.0 client credentials (system clients) or authorisation code with PKCE (user-delegated clients); access tokens carry tenant, principal and scopes; scopes as listed below |
| Idempotency key | `Idempotency-Key` header on every POST and PATCH (§5.4); natural keys as noted per endpoint |
| Owning process | PLT (gateway, policy), with each endpoint owned by its domain |
| Phase | P1 for `/v1` |
| Data classification | Per resource; compensation fields obey RL-005 (null, not absent); Restricted identifiers are returned masked |

### 18.2 Endpoint catalogue (v1)

| Endpoint | Methods | Scope | Idempotency and notes | Owning domain |
| :--- | :--- | :--- | :--- | :--- |
| /v1/people | GET, POST | people.read / people.write | ERP-owned fields rejected in ERP-owned mode | PPL |
| /v1/assignments | GET, POST, PATCH | people.write | PATCH requires `effective_from` and `reason`; `If-Match` ETag required | PPL |
| /v1/attendance/events | POST | time.ingest | Idempotent on (person, ts, device) — TIM-INT-001 | TIM |
| /v1/attendance/days | GET | time.read | Scope-resolved; pay fields never present | TIM |
| /v1/attendance/recompute | POST | time.admin | Dry run supported; rejected for locked periods | TIM |
| /v1/leave/requests | GET, POST | leave.self / leave.admin | Validation errors name the rule | LVE |
| /v1/leave/balance | GET | leave.self | Projection over the ledger, never a stored column | LVE |
| /v1/gate-passes | GET, POST | time.self | Ceiling enforced server-side | TIM |
| /v1/payroll/runs | GET, POST | payroll.admin | Run type mandatory; dry run on state change | PAY |
| /v1/payroll/payslips | GET | payroll.self / payroll.admin | Run selector required | PAY |
| /v1/payroll/journal | GET | finance.read | Blocked until every component is mapped — FIN-INT-002 pull | FIN |
| /v1/loans/eligibility/{personId} | GET | loans.read | The single eligibility source | CMB |
| /v1/requisitions | GET, POST | talent.write | Addition blocked without sanctioned headroom | TAL |
| /v1/compliance/forms | GET, POST | compliance.read / compliance.write | State-scoped | CMP |
| /v1/integration/employee-master | POST | integration.write | FIN-INT-001 | FIN |
| /v1/webhooks | GET, POST | integration.admin | PLT-INT-002 | PLT |

### 18.3 Request and response conventions

| Field or header | Type | Length | M/C/O | Description | Source | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Authorization | header | — | M | `Bearer <access token>` | Token service | Valid signature, audience, expiry and scope |
| Idempotency-Key | header | 80 | C | Mandatory on POST and PATCH | — | UUID or caller key; stored 24 hours |
| If-Match | header | 64 | C | ETag for optimistic concurrency on PATCH | Resource version | Mismatch returns 412 |
| X-Request-Id | header | 36 | O | Caller correlation ID | — | Echoed in the response and logs |
| limit / cursor | query | 3 / 200 | O | Cursor pagination; `limit` ≤ 200 | — | Opaque cursor |
| as_of | query | 10 | O | Effective date for temporal reads | Effective-dated objects | ISO date |
| fields | query | 500 | O | Sparse field selection | — | Known field names only |
| Problem detail | body | — | C | RFC 9457 with `rule_id`, `field`, `trace_id` | — | On every 4xx and 5xx |
| RateLimit headers | header | — | M | Remaining quota and reset | Gateway | Default 600 requests per minute per client; bulk endpoints 50 per minute |

### 18.4 Sample payload

```http
GET /v1/leave/balance?person_id=E1004&as_of=2026-09-15 HTTP/1.1
Authorization: Bearer eyJhbGciOiJQUzI1NiJ9...
```

```json
{ "person_id": "E1004", "as_of": "2026-09-15",
  "balances": [ { "leave_type": "EL", "opening": "0", "credited": "18", "availed": "5", "closing": "13",
                  "movements": ["LL-0001", "LL-0004"] } ] }
```

```http
PATCH /v1/assignments/ASG-E1051-03 HTTP/1.1
Idempotency-Key: 7b1e2c90-5a4f-4f0e-8f3a-1c2d3e4f5a6b
If-Match: "v3"
Content-Type: application/json

{ "shift_group": "PLANT12" }
```

```json
{ "type": "https://errors.nucleus.example/validation", "title": "Effective date and reason required",
  "status": 422, "rule_id": "PLT-INT-001.04", "field": "effective_from",
  "detail": "PATCH on an assignment requires effective_from and reason", "trace_id": "4f1c9a2e" }
```

### 18.5 Behaviour

| Aspect | Specification |
| :--- | :--- |
| Error handling and retries | Per §5.5; 429 responses carry `Retry-After`; 5xx responses are safe to retry only with the same `Idempotency-Key`. |
| Idempotency | Per §5.4 and the endpoint notes. |
| Reconciliation report | API usage report per client: calls, errors by class, p95 latency, scope denials; bulk endpoints report accepted against processed records. |
| Ownership rules | Field ownership (§5.7) applies to every write; scope resolution is the intersection of tenant, entity, location, reporting line and payroll group (RL-004). |
| Service levels | p95 under 300 ms and p99 under 800 ms for interactive reads (NFR-01); availability 99.9% monthly. |
| Versioning | Per §5.8; OpenAPI document published per version with a changelog. |

### 18.6 Sequence

```mermaid
sequenceDiagram
    autonumber
    participant P as Partner client
    participant GW as API gateway
    participant POL as Scope resolver
    participant SVC as Domain service
    P->>GW: Request with token and Idempotency-Key
    GW->>GW: Validate token, rate limit, idempotency lookup
    GW->>POL: Resolve tenant, entity, location, payroll group
    POL->>SVC: Scoped call
    alt Valid
        SVC-->>GW: Result with masked or null fields per scope
    else Rule violated
        SVC-->>GW: Problem detail naming the rule
    end
    GW-->>P: Response with request ID and rate headers
```

### 18.7 Interface requirements and acceptance criteria

| ID | Requirement | Rationale | Source / trace | Realises SYS | Priority | Verification | Acceptance criterion |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PLT-INT-001.01 | The API MUST be described in OpenAPI 3.1 and versioned in the path. | Partners build from a contract. | IA-01 public REST | SYS-089 | Must | I | The published OpenAPI document validates and lists every v1 endpoint. |
| PLT-INT-001.02 | Every partner MUST receive a sandbox tenant seeded with synthetic data. | Safe integration development. | IA-01 public REST | SYS-008, SYS-089 | Must | D | A new partner can call every v1 endpoint in its sandbox within one day of onboarding. |
| PLT-INT-001.03 | Responses MUST be scope-resolved on every request, with compensation fields null outside the caller's payroll group. | Hidden screens are not a control. | RL-004, RL-005, T-18 | SYS-017, SYS-018 | Must | T | API read of E1056 by the Chennai plant HR role returns null salary fields. |
| PLT-INT-001.04 | PATCH on effective-dated resources MUST require `effective_from` and `reason`. | History, not destruction. | IA-01 assignments | SYS-022, SYS-089 | Must | T | PATCH without both fields returns 422. |
| PLT-INT-001.05 | Interactive reads MUST meet p95 under 300 ms and p99 under 800 ms. | User-perceived performance. | NFR-01 API latency | SYS-089 | Must | T | Load test at expected peak meets both percentiles. |

## 19. PLT-INT-002 — Webhooks

### 19.1 Interface profile

| Attribute | Value |
| :--- | :--- |
| Interface ID | PLT-INT-002 |
| Purpose | Push domain events from the event catalogue to subscribed partner endpoints so that client systems react without polling |
| Direction | Nucleus → Partner |
| Counterparty | Partner applications and client systems |
| Mechanism | HTTPS POST of CloudEvents 1.0 structured-mode JSON; subscriptions managed through `/v1/webhooks` |
| Trigger and cadence | On every subscribed event relayed from the transactional outbox |
| Authentication | HMAC-SHA256 signature header computed over timestamp and body with the subscription secret; optional mTLS to the partner endpoint |
| Idempotency key | CloudEvents `id` (unique per event) plus the event's catalogue idempotency key in `nucleusidempotencykey` |
| Owning process | PLT (outbox relay); events emitted by the processes listed in IA-02 |
| Phase | P1 |
| Data classification | Events carry identifiers and minimal facts only; Restricted values are never included; consumers fetch details through PLT-INT-001 under their own scope |

### 19.2 Payload specification

| Field | Type | Length | M/C/O | Description | Source object.field | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| specversion | string | 5 | M | CloudEvents version | — | `1.0` |
| id | string | 36 | M | Event identifier | outbox.outbox_id | UUID |
| source | string | 200 | M | Emitting tenant and module | outbox.aggregate | URI reference |
| type | string | 60 | M | Catalogue event name | outbox.event_type | Listed in IA-02 |
| subject | string | 60 | O | Business key | Event payload | — |
| time | timestamp | 30 | M | Occurrence time | envelope occurred_at | ISO 8601 |
| datacontenttype | string | 20 | M | `application/json` | — | — |
| dataschema | string | 200 | M | Schema URI with version | envelope schema_version | Published schema |
| tenantid / entityid / locationid | string | 36 | M | Envelope scope | envelope tenant_id, entity_id, location_id | Subscription scope covers them |
| actor / agentid | string | 36 | M / O | Who caused the event | envelope actor, agent_id | — |
| nucleusidempotencykey | string | 120 | M | Catalogue idempotency key | IA-02 idempotency key | — |
| data | object | — | M | Payload beyond the envelope | IA-02 payload column | Validates against `dataschema` |
| Nucleus-Signature | header | 200 | M | `t=<unix time>,v1=<hex HMAC>` | Subscription secret | Partner rejects if older than 5 minutes |

### 19.3 Sample payload

```http
POST /hooks/nucleus HTTP/1.1
Content-Type: application/cloudevents+json
Nucleus-Signature: t=1788326677,v1=5f2b9c0e7a41d8f63b2e9a1c4d7f0b3e6a9c2d5f8e1b4a7c0d3f6e9b2a5c8d1f

{ "specversion": "1.0", "id": "8c3f0e52-41b7-4d2e-9a6f-0b1c2d3e4f50",
  "source": "/tenants/t-vpi/finance", "type": "payroll.run.posted", "subject": "PR-2026-08-01",
  "time": "2026-09-02T11:04:39+05:30", "datacontenttype": "application/json",
  "dataschema": "https://schemas.nucleus.example/events/payroll.run.posted/1.0.0",
  "tenantid": "t-vpi", "entityid": "LE-01", "locationid": "LOC-BLR", "actor": "svc-integration",
  "nucleusidempotencykey": "PR-2026-08-01:ERP-JV-88214",
  "data": { "run_id": "PR-2026-08-01", "external_doc_no": "ERP-JV-88214", "posted_at": "2026-09-02T11:04:37+05:30" } }
```

### 19.4 Behaviour

| Aspect | Specification |
| :--- | :--- |
| Error handling and retries | Any 2xx is success. Other responses and timeouts (10 seconds) are retried per §5.5 and then extended to 24 hours total; afterwards the event is dead-lettered. A subscription failing continuously for 72 hours is paused and its owner notified. |
| Idempotency | Delivery is at least once; ordering is guaranteed only per `subject`; consumers deduplicate on `id` and `nucleusidempotencykey`. |
| Reconciliation report | Delivery log per subscription, inspectable and replayable through `/v1/webhooks`: emitted, delivered, retried, dead-lettered; replay of any event by `id` within its retention class (IA-02). |
| Ownership rules | Events are Nucleus-owned facts; partners own their endpoints and secrets rotation acknowledgement. Subscriptions are scoped no wider than the subscribing client's grants. |
| Service levels | 95% of events delivered within 30 seconds of the domain commit when the partner endpoint is healthy; outbox relay lag under 5 seconds at p95. |
| Versioning | `dataschema` carries the event schema version; new major versions of an event are published side by side for the deprecation period in §5.8. |

### 19.5 Sequence

```mermaid
sequenceDiagram
    autonumber
    participant SVC as Domain service
    participant OB as Outbox relay
    participant WH as Webhook dispatcher
    participant P as Partner endpoint
    SVC->>OB: Commit domain write and outbox row
    OB->>WH: Event for subscribed type
    WH->>WH: Build CloudEvent and sign
    WH->>P: POST event
    alt 2xx
        P-->>WH: Accepted
    else Error or timeout
        WH->>WH: Retry schedule, then dead-letter
    end
    WH->>WH: Record delivery log entry
```

### 19.6 Interface requirements and acceptance criteria

| ID | Requirement | Rationale | Source / trace | Realises SYS | Priority | Verification | Acceptance criterion |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PLT-INT-002.01 | Webhook deliveries MUST be signed, retried and inspectable. | Signed, retried, inspectable. | IA-01 webhooks | SYS-088 | Must | T | A partner endpoint returning 500 receives the documented retries; the log shows each attempt. |
| PLT-INT-002.02 | Events MUST be written to the outbox in the same transaction as the domain write. | No lost or phantom events. | DA-01 outbox | SYS-053 | Must | T | A rolled-back domain write emits no event. |
| PLT-INT-002.03 | Event payloads MUST NOT contain Restricted values. | Events travel to many consumers. | GOV-10 §5 | SYS-054 | Must | I | Schema review of all subscribable events finds no Restricted field. |
| PLT-INT-002.04 | Any delivered event MUST be replayable by `id` within its retention class. | Recovery after partner outages. | IA-02 retention | SYS-055 | Must | D | Replay of a 7-day-old `payroll.run.posted` succeeds. |

## 20. Traceability Summary

| Interface | Source flow (IA-03) | Rules | Events (IA-02) | Tests | Backlog / decisions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| FIN-INT-001 | Employee master | RL-510 – RL-516 | integration.sync.applied, integration.sync.conflict | TC-F510, T-28 | BL-102, OD-07, Q-15 |
| FIN-INT-002 | Salary journal | RL-321, RL-323, RL-324, RL-333, RL-520 – RL-524, RL-530, RL-531 | payroll.journal.ready, payroll.run.posted | TC-F521, TC-F530, T-29, TC-Y330 | BL-100, BL-101, BL-103, BL-130 |
| FIN-INT-003 | Cost centre, project and department master | RL-521 (dependency) | — | Covered by FIN-INT-003.01 – .05 | — |
| FIN-INT-004 | Bank disbursement | RL-322, RL-323, RL-333, RL-393 | payroll.run.approved, payroll.run.disbursed | TC-Y322, TC-Y393, T-30 | — |
| TIM-INT-001 | Biometric and access-control devices | RL-070 – RL-075, RL-140 | time.punch.ingested, time.exception.raised | TC-T70 – TC-T75, T-01 | — |
| SSV-INT-001 | Business messaging channel | RL-013 | leave.request.approved, payroll.run.disbursed | Channel parity suite | — |
| CMP-INT-001 – 004 | Statutory portals | RL-380, RL-381, RL-383 | compliance.form.generated, compliance.obligation.filed | TC-C380, TC-C381, TC-C383, T-32 | OD-14 |
| LCY-INT-001 | Background verification | RL-390, RL-391 | lifecycle.joining.started | Covered by LCY-INT-001.01 – .05 | — |
| EXP-INT-001 | E-signature | RL-394 | experience.letter.issued | Covered by EXP-INT-001.01 – .04 | — |
| PLT-INT-003, PLT-INT-004 | SSO and identity provider | RL-002 – RL-004 | people.worker.hired, people.assignment.changed | Covered by PLT-INT-003.01 – PLT-INT-004.04 | — |
| CTG-INT-001 | Contractor and vendor master | — | — | Covered by CTG-INT-001.01 – .04 | — |
| INT-INT-001 | MCP server | RL-001, RL-005 | agent.action.executed, agent.action.reversed | T-18 | OD-13 |
| PLT-INT-001 | Public REST | RL-004, RL-005 | — | T-18 | — |
| PLT-INT-002 | Webhooks | — | All subscribable IA-02 events | Covered by PLT-INT-002.01 – .04 | — |

### 20.1 Traceability to system requirements

Every requirement in this document carries a **Realises SYS** column naming the one to three system requirements in SRS-01 that it realises or refines; the choice is the most specific SYS ID by meaning, not by domain prefix. The table below reads that column the other way: for each SYS ID cited it lists the requirements here that realise it. In total, 99 requirements cite 53 distinct SYS IDs, and every cited ID exists in SRS-01 §11 or §12.

| SYS ID | SRS-01 group | Requirements in this document | Count |
| :--- | :--- | :--- | :--- |
| SYS-005 | 11.1 Tenancy, entities and residency | PLT-INT-110 | 1 |
| SYS-006 | 11.1 Tenancy, entities and residency | FIN-INT-002.02 | 1 |
| SYS-008 | 11.1 Tenancy, entities and residency | PLT-INT-112, PLT-INT-001.02 | 2 |
| SYS-009 | 11.2 Identity and principals | PLT-INT-004.03, INT-INT-001.03 | 2 |
| SYS-010 | 11.2 Identity and principals | INT-INT-001.03 | 1 |
| SYS-011 | 11.2 Identity and principals | PLT-INT-003.01 | 1 |
| SYS-012 | 11.2 Identity and principals | PLT-INT-004.01, PLT-INT-004.02 | 2 |
| SYS-015 | 11.3 Authorisation and data scope | PLT-INT-003.02 | 1 |
| SYS-017 | 11.3 Authorisation and data scope | INT-INT-001.05, PLT-INT-001.03 | 2 |
| SYS-018 | 11.3 Authorisation and data scope | INT-INT-001.05, PLT-INT-001.03 | 2 |
| SYS-019 | 11.3 Authorisation and data scope | PLT-INT-004.04 | 1 |
| SYS-022 | 11.4 Effective dating and bi-temporal data | FIN-INT-003.04, PLT-INT-001.04 | 2 |
| SYS-024 | 11.4 Effective dating and bi-temporal data | FIN-INT-002.03 | 1 |
| SYS-026 | 11.4 Effective dating and bi-temporal data | FIN-INT-001.09, FIN-INT-003.04, FIN-INT-003.05 | 3 |
| SYS-027 | 11.4 Effective dating and bi-temporal data | LCY-INT-001.05 | 1 |
| SYS-030 | 11.5 Money and calculation integrity | FIN-INT-002.10 | 1 |
| SYS-031 | 11.5 Money and calculation integrity | FIN-INT-002.07 | 1 |
| SYS-032 | 11.6 Audit and action ledger | FIN-INT-001.07, FIN-INT-002.04, EXP-INT-001.01 | 3 |
| SYS-033 | 11.6 Audit and action ledger | PLT-INT-108, FIN-INT-004.07, LCY-INT-001.04 | 3 |
| SYS-035 | 11.6 Audit and action ledger | INT-INT-001.02 | 1 |
| SYS-037 | 11.7 Workflow and approvals | LCY-INT-001.02, LCY-INT-001.03 | 2 |
| SYS-045 | 11.8 Rules, ledgers and locks | CMP-INT-002.01, CMP-INT-003.01, CMP-INT-004.02 | 3 |
| SYS-049 | 11.8 Rules, ledgers and locks | SSV-INT-001.06 | 1 |
| SYS-050 | 11.8 Rules, ledgers and locks | FIN-INT-002.06 | 1 |
| SYS-051 | 11.8 Rules, ledgers and locks | FIN-INT-002.01, FIN-INT-003.02, FIN-INT-003.03, FIN-INT-004.02, FIN-INT-004.04, CTG-INT-001.02 | 6 |
| SYS-052 | 11.8 Rules, ledgers and locks | FIN-INT-004.06, TIM-INT-001.04 | 2 |
| SYS-053 | 11.9 Events, outbox and recompute | PLT-INT-002.02 | 1 |
| SYS-054 | 11.9 Events, outbox and recompute | PLT-INT-002.03 | 1 |
| SYS-055 | 11.9 Events, outbox and recompute | PLT-INT-105, PLT-INT-002.04 | 2 |
| SYS-056 | 11.9 Events, outbox and recompute | FIN-INT-001.01 | 1 |
| SYS-058 | 11.9 Events, outbox and recompute | PLT-INT-109 | 1 |
| SYS-059 | 11.10 Configuration, extensibility and data load | EXP-INT-001.04 | 1 |
| SYS-061 | 11.10 Configuration, extensibility and data load | FIN-INT-001.06, FIN-INT-001.08 | 2 |
| SYS-062 | 11.11 Frontline capture and offline operation | TIM-INT-001.01, TIM-INT-001.06 | 2 |
| SYS-063 | 11.11 Frontline capture and offline operation | TIM-INT-001.03 | 1 |
| SYS-064 | 11.11 Frontline capture and offline operation | TIM-INT-001.02, TIM-INT-001.06 | 2 |
| SYS-065 | 11.11 Frontline capture and offline operation | TIM-INT-001.02 | 1 |
| SYS-068 | 11.12 Localisation and accessibility | TIM-INT-001.05 | 1 |
| SYS-070 | 11.13 Notifications and channels | SSV-INT-001.03 to SSV-INT-001.05 | 3 |
| SYS-071 | 11.13 Notifications and channels | SSV-INT-001.01, SSV-INT-001.06 | 2 |
| SYS-072 | 11.14 AI governance and tool surface | INT-INT-001.04 | 1 |
| SYS-073 | 11.14 AI governance and tool surface | INT-INT-001.01, INT-INT-001.04 | 2 |
| SYS-074 | 11.14 AI governance and tool surface | FIN-INT-004.01, CMP-INT-001.03 | 2 |
| SYS-075 | 11.14 AI governance and tool surface | INT-INT-001.01, INT-INT-001.02 | 2 |
| SYS-080 | 12.2 Hardware interfaces | TIM-INT-001.01 | 1 |
| SYS-081 | 12.2 Hardware interfaces | TIM-INT-001.07 | 1 |
| SYS-082 | 12.2 Hardware interfaces | TIM-INT-001.08 | 1 |
| SYS-083 | 12.3 Software interfaces | PLT-INT-003.01, PLT-INT-003.02, PLT-INT-004.01, PLT-INT-004.03, PLT-INT-004.04 | 5 |
| SYS-084 | 12.3 Software interfaces | PLT-INT-101, PLT-INT-103, PLT-INT-106, PLT-INT-107, FIN-INT-001.01 to FIN-INT-001.09, FIN-INT-002.02 to FIN-INT-002.10, FIN-INT-003.01 to FIN-INT-003.03, FIN-INT-003.05, CMP-INT-001.02, LCY-INT-001.01 to LCY-INT-001.05, EXP-INT-001.01 to EXP-INT-001.04, CTG-INT-001.01 to CTG-INT-001.04 | 40 |
| SYS-085 | 12.3 Software interfaces | FIN-INT-004.01 to FIN-INT-004.08 | 8 |
| SYS-086 | 12.3 Software interfaces | CMP-INT-001.01 to CMP-INT-001.04, CMP-INT-002.01, CMP-INT-003.01, CMP-INT-004.01, CMP-INT-004.02 | 8 |
| SYS-088 | 12.4 Communications interfaces | PLT-INT-102, PLT-INT-105, PLT-INT-111, SSV-INT-001.02, EXP-INT-001.02, PLT-INT-002.01 | 6 |
| SYS-089 | 12.4 Communications interfaces | PLT-INT-101, PLT-INT-103, PLT-INT-104, PLT-INT-109, PLT-INT-112, PLT-INT-001.01, PLT-INT-001.02, PLT-INT-001.04, PLT-INT-001.05 | 9 |

## Approval & Sign-off

| Role | Name | Date | Decision | Conditions / comments |
| :--- | :--- | :--- | :--- | :--- |
| Author | Dhanraj Dadhich | 2026-11-05 | Submitted | |
| Peer review moderator | *pending* | | | PR-xxxx |
| PQA (process compliance) | *pending* | | | |
| Architecture Review Board | *pending* | | | |

## Measurement Data Captured

| Measure | Value | Unit | Notes |
| :--- | :--- | :--- | :--- |
| Size | 18 interface IDs in 14 interface sections · 12 cross-interface requirements · 87 interface clauses | interfaces / requirements | 21 body sections, 15 Mermaid diagrams |
| Authoring effort | *to be recorded* | person-hours | |
| Review effort (preparation + meeting) | *pending review* | person-hours | From PR-xxxx |
| Review rate | *pending review* | items / hour | Compare with PPB-02 control limits |
| Requirement volatility | 0 | CRs since baseline | |

## Revision History

| Version | Date | Author | Change summary | CR ref | Approved by |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1.0.0 | 2026-11-05 | Dhanraj Dadhich | Consolidated release | CR-0001 | *pending* |
