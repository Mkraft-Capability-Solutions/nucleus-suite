# Data Models & Interface Schemas: TA-03 Applicant Tracking System ATS Workflows

## 1. Core Data Object Attributes

| Field Technical Name | Data Type | Constraint / Validation | Description |
| :--- | :--- | :--- | :--- |
| `record_uuid` | UUIDv4 | Primary Key, Non-Nullable | Unique immutable row identifier |
| `effective_start_date`| Date (ISO 8601) | Non-Nullable, YYYY-MM-DD | Date record validity begins |
| `effective_end_date`  | Date (ISO 8601) | Default: 9999-12-31 | Date record validity expires |
| `tenant_id` | Varchar(64) | Index, Multi-tenant partition | Segregates enterprise client boundaries |
| `transaction_status` | Enum | [Draft, Pending, Approved, Rejected] | Current state machine valuation |

## 2. Sample Reference Payload (JSON Specification)
```json
{
  "$schema": "https://json-schema.org",
  "title": "HRMS_TA-03_Payload",
  "type": "object",
  "properties": {
    "transactionId": { "type": "string", "format": "uuid" },
    "effectiveDate": { "type": "string", "format": "date" },
    "contextualEntity": {
      "type": "object",
      "properties": {
        "sourceId": { "type": "string" },
        "typeCode": { "type": "string" }
      },
      "required": ["sourceId", "typeCode"]
    }
  },
  "required": ["transactionId", "effectiveDate", "contextualEntity"]
}
```
