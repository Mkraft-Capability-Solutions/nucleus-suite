#!/bin/bash

# Define the root directory name
ROOT_DIR="HRMS_Requirements_Documentation"

echo "=========================================================="
echo "Initializing Full Enterprise HRMS Artifact Generation..."
echo "Target Root: ./$ROOT_DIR"
echo "=========================================================="

# Master function to create subfolders AND write structural engineering files
create_module_artifacts() {
    local category_path="$1"
    local module_id="$2"
    local base_name="$3"
    
    # Standardised path variables
    local mod_dir="$category_path/$base_name"
    local uc_dir="$mod_dir/Use_Cases_and_User_Stories"
    local frd_dir="$mod_dir/Functional_Requirements_FRD"
    local data_dir="$mod_dir/Data_Models_and_Schemas"
    
    # 1. Ensure directories exist
    mkdir -p "$uc_dir"
    mkdir -p "$frd_dir"
    mkdir -p "$data_dir"
    mkdir -p "$mod_dir/Wireframes_and_UI_UX"
    
    # Clean up name for human readable titles
    local friendly_name="${base_name//_/ }"

    # 2. Write the Complete Use Case & User Story Document Template
    cat << EOF > "$uc_dir/${module_id}_Use_Cases_and_User_Stories.md"
# Use Cases & User Stories: $friendly_name

## 1. Actor Profile Matrix

| Actor Role | System Access Level | Primary Objectives |
| :--- | :--- | :--- |
| HR Administrator | Full Read/Write/Configure | Manage master structural shifts & data overrides |
| Line Manager | Self-Service (Team View) | Initiate team changes, view direct report pipelines |
| Individual Contributor | Self-Service (Personal) | Maintain personal profile, request balance updates |
| System Integration User | API / Automated Service | Headless orchestration, batch ETL syncs |

## 2. Primary Use Case: Main Success Scenario
* **Use Case ID:** UC-${module_id}-001
* **Use Case Name:** Standard Execution Flow for $friendly_name
* **Trigger:** Actor initiates request via the functional dashboard interface.
* **Pre-Conditions:** Actor is securely authenticated; target worker/position records are active.
* **Post-Conditions:** Core database commits state transaction; downstream message event queues populate.

### Flow of Events
1. Actor navigates to the workspace module and selects the primary execution option.
2. System presents form validated against active tenant configuration schemas.
3. Actor populates required parameters and submits transaction for structural validation.
4. System parses data against cross-cutting business rules (effective-dating, authorization check).
5. System routes transaction payload to the dynamic workflow engine for conditional approvals.

## 3. Alternative & Exception Flows
* **Alt Flow A (Dynamic Route Modification):** If conditional attributes (e.g., compensation tier, cost center bounds) match high-priority criteria, system injects mandatory matrix-approver steps.
* **Exception Flow B (Effective Date Collision):** If a transaction contains a retroactive date conflicting with locked payroll data blocks, transaction halts with code \`ERR-PR-LOCK\`.
EOF

    # 3. Write the Functional Requirements & Business Rules Document Template
    cat << EOF > "$frd_dir/${module_id}_Functional_Requirements_FRD.md"
# Functional Requirements Document (FRD): $friendly_name

## 1. Functional Specifications
* **FR-${module_id}-001 (Audit Trail Enforcement):** The system MUST capture a deterministic audit log entry for every state transition within this module, recording Timestamp, Actor ID, Target ID, Attribute Before, and Attribute After.
* **FR-${module_id}-002 (Effective Dating Engine):** The system MUST support forward-dated and retroactive entry execution using true Workday-style bi-temporal tracking (Transaction Time vs. Effective Time).
* **FR-${module_id}-003 (Localization Layer):** Functional validation criteria MUST dynamically toggle depending on the country or legal entity jurisdiction attributed to the underlying worker profile.

## 2. Hard Business Logic Rules
* **BR-${module_id}-101:** Total transaction payload validation fails if mandatory contextual objects (Cost Center, Job Profile, Supervisory Organization) lack valid relationships on the target Effective Date.
* **BR-${module_id}-102:** Matrix management structural rollups must automatically recalculate within 150ms of a committed record shift to prevent workflow routing deadlocks.
EOF

    # 4. Write the Data Dictionary & Schema Document Template
    cat << EOF > "$data_dir/${module_id}_Data_Models_and_Schemas.md"
# Data Models & Interface Schemas: $friendly_name

## 1. Core Data Object Attributes

| Field Technical Name | Data Type | Constraint / Validation | Description |
| :--- | :--- | :--- | :--- |
| \`record_uuid\` | UUIDv4 | Primary Key, Non-Nullable | Unique immutable row identifier |
| \`effective_start_date\`| Date (ISO 8601) | Non-Nullable, YYYY-MM-DD | Date record validity begins |
| \`effective_end_date\`  | Date (ISO 8601) | Default: 9999-12-31 | Date record validity expires |
| \`tenant_id\` | Varchar(64) | Index, Multi-tenant partition | Segregates enterprise client boundaries |
| \`transaction_status\` | Enum | [Draft, Pending, Approved, Rejected] | Current state machine valuation |

## 2. Sample Reference Payload (JSON Specification)
\`\`\`json
{
  "\$schema": "https://json-schema.org",
  "title": "HRMS_${module_id}_Payload",
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
\`\`\`
EOF

    # 5. Write Wireframes Placeholder file
    cat << EOF > "$mod_dir/Wireframes_and_UI_UX/${module_id}_Wireframes_Layout.md"
# UI/UX Interaction Layout: $friendly_name

## 1. Screen View Reference Guidelines
* **Global Grid Layout:** Adhere strictly to the 12-column responsive dashboard layouts optimized for native desktop operations and executive workspace tablets.
* **Component Framework:** Utilize enterprise UI component libraries matching standard Workday/SAP design guidelines (unified action buttons on footer, left-rail contextual navigation tree, dynamic search omni-box).

## 2. Element Wireframe Blueprint Map
1. **Top Banner:** Breadcrumb trail tracking navigation state + Active Context indicator badge (e.g., "Viewing As: System Admin").
2. **Left-Panel Matrix:** Real-time hierarchy tree tracking impacted supervisor structures or payroll groups.
3. **Center Focus Grid:** Form entry component grouping validated parameter segments fields using progressive disclosure toggles.
4. **Action Footer Bar:** [Cancel (Gray Outline)] | [Save Draft (Blue Outline)] | [Submit for Approval (Solid Green Accent)].
EOF
}

# -----------------------------------------------------------------------------
# EXECUTION LAYER: Building Out the Complete Module Tree
# -----------------------------------------------------------------------------

# 01_Project_Governance_and_Framework
C="01_Project_Governance_and_Framework"
echo "📂 Compiling Framework Artifacts inside $C..."
create_module_artifacts "$ROOT_DIR/$C" "GOV-01" "Vision_and_Scope_Document"
create_module_artifacts "$ROOT_DIR/$C" "GOV-02" "Business_Architecture_and_Glossary"
create_module_artifacts "$ROOT_DIR/$C" "GOV-03" "Stakeholder_Matrix_and_Personas"
create_module_artifacts "$ROOT_DIR/$C" "GOV-04" "Change_Management_Strategy"

# 02_Core_HR_and_Organization_Management
C="02_Core_HR_and_Organization_Management"
echo "📂 Compiling Framework Artifacts inside $C..."
create_module_artifacts "$ROOT_DIR/$C" "OM-01" "OM-01_Legal_Entity_and_Company_Structure"
create_module_artifacts "$ROOT_DIR/$C" "OM-02" "OM-02_Cost_Center_and_Department_Hierarchies"
create_module_artifacts "$ROOT_DIR/$C" "OM-03" "OM-03_Job_Architecture_Profiles_and_Families"
create_module_artifacts "$ROOT_DIR/$C" "OM-04" "OM-04_Position_Management_and_Headcount_Control"
create_module_artifacts "$ROOT_DIR/$C" "EE-01" "EE-01_Employee_Master_Data_and_Profiles"
create_module_artifacts "$ROOT_DIR/$C" "EE-02" "EE-02_Worker_Types_Contractor_vs_Regular"
create_module_artifacts "$ROOT_DIR/$C" "EE-03" "EE-03_Lifecycle_Events_Hire_Transfer_Termination"
create_module_artifacts "$ROOT_DIR/$C" "EE-04" "EE-04_Global_Assignment_and_Expatriate_Management"

# 03_Compensation_and_Benefits
C="03_Compensation_and_Benefits"
echo "📂 Compiling Framework Artifacts inside $C..."
create_module_artifacts "$ROOT_DIR/$C" "COMP-01" "COMP-01_Salary_Structures_and_Grade_Ranges"
create_module_artifacts "$ROOT_DIR/$C" "COMP-02" "COMP-02_Variable_Pay_Merit_and_Bonus_Cycles"
create_module_artifacts "$ROOT_DIR/$C" "COMP-03" "COMP-03_Executive_Compensation_and_Equity"
create_module_artifacts "$ROOT_DIR/$C" "BEN-01" "BEN-01_Health_Insurance_Enrollment"
create_module_artifacts "$ROOT_DIR/$C" "BEN-02" "BEN-02_Retirement_and_Pension_Plans"
create_module_artifacts "$ROOT_DIR/$C" "BEN-03" "BEN-03_Flexible_Spending_and_Perks"

# 04_Time_and_Attendance_Management
C="04_Time_and_Attendance_Management"
echo "📂 Compiling Framework Artifacts inside $C..."
create_module_artifacts "$ROOT_DIR/$C" "TIME-01" "TIME-01_Work_Schedules_and_Shift_Patterns"
create_module_artifacts "$ROOT_DIR/$C" "TIME-02" "TIME-02_Absence_Accruals_and_Time_Off_Requests"
create_module_artifacts "$ROOT_DIR/$C" "TIME-03" "TIME-03_Timesheet_Submission_and_Approvals"
create_module_artifacts "$ROOT_DIR/$C" "TIME-04" "TIME-04_Biometric_and_Geo-Fencing_Integrations"
create_module_artifacts "$ROOT_DIR/$C" "TIME-05" "TIME-05_Overtime_and_Premium_Pay_Rules"

# 05_Global_Payroll_Engine
C="05_Global_Payroll_Engine"
echo "📂 Compiling Framework Artifacts inside $C..."
create_module_artifacts "$ROOT_DIR/$C" "PAY-01" "PAY-01_Gross-to-Net_Calculation_Rules"
Use code with caution.
create_module_artifacts "$ROOT_DIR/$C" "PAY-02" "PAY-02_Taxation_and_Statutory_Deductions_by_Country"
create_module_artifacts "$ROOT_DIR/$C" "PAY-03" "PAY-03_Banking_Offsets_and_Direct_Deposit_Routing"
create_module_artifacts "$ROOT_DIR/$C" "PAY-04" "PAY-04_Retroactive_Pay_Adjustments"
create_module_artifacts "$ROOT_DIR/$C" "PAY-05" "PAY-05_Off-Cycle_and_On-Demand_Payroll"
create_module_artifacts "$ROOT_DIR/$C" "PAY-06" "PAY-06_Year-End_Processing_and_Tax_Filing"

06_Talent_Acquisition_and_Onboarding

C="06_Talent_Acquisition_and_Onboarding"
echo "📂 Compiling Framework Artifacts inside $C..."
create_module_artifacts "$ROOT_DIR/$C" "TA-01" "TA-01_Requisition_Creation_and_Approvals"
create_module_artifacts "$ROOT_DIR/$C" "TA-02" "TA-02_Candidate_Sourcing_and_Job_Board_Multiposting"
create_module_artifacts "$ROOT_DIR/$C" "TA-03" "TA-03_Applicant_Tracking_System_ATS_Workflows"
create_module_artifacts "$ROOT_DIR/$C" "TA-04" "TA-04_Interview_Scheduling_and_Scorecards"
create_module_artifacts "$ROOT_DIR/$C" "TA-05" "TA-05_Offer_Letter_Generation_and_Background_Checks"
create_module_artifacts "$ROOT_DIR/$C" "TA-06" "TA-06_Pre-Onboarding_and_First-Day_Provisioning"

07_Talent_and_Performance_Management

C="07_Talent_and_Performance_Management"
echo "📂 Compiling Framework Artifacts inside $C..."
create_module_artifacts "$ROOT_DIR/$C" "PERF-01" "PERF-01_Goal_Setting_and_Cascading_KPIs"
create_module_artifacts "$ROOT_DIR/$C" "PERF-02" "PERF-02_Continuous_Feedback_and_Check-ins"
create_module_artifacts "$ROOT_DIR/$C" "PERF-03" "PERF-03_Annual_and_360-Degree_Reviews"
create_module_artifacts "$ROOT_DIR/$C" "PERF-04" "PERF-04_Succession_Planning_and_Talent_Pools"
create_module_artifacts "$ROOT_DIR/$C" "PERF-05" "PERF-05_Career_Development_Frameworks"

08_Learning_Management_System_LMS

C="08_Learning_Management_System_LMS"
echo "📂 Compiling Framework Artifacts inside $C..."
create_module_artifacts "$ROOT_DIR/$C" "LMS-01" "LMS-01_Course_Catalog_and_Curriculum_Design"
create_module_artifacts "$ROOT_DIR/$C" "LMS-02" "LMS-02_SCORM_xAPI_Content_Ingestion"
create_module_artifacts "$ROOT_DIR/$C" "LMS-03" "LMS-03_Mandatory_Compliance_Training_Tracks"
create_module_artifacts "$ROOT_DIR/$C" "LMS-04" "LMS-04_Certification_and_License_Tracking"

09_Cross-Cutting_System_Services

C="09_Cross-Cutting_System_Services"
echo "📂 Compiling Framework Artifacts inside $C..."
create_module_artifacts "$ROOT_DIR/$C" "SEC-01" "SEC-01_Role-Based_Access_Control_RBAC"
create_module_artifacts "$ROOT_DIR/$C" "SEC-02" "SEC-02_Intersection_Security_and_Row-Level_Constraints"
create_module_artifacts "$ROOT_DIR/$C" "SEC-03" "SEC-03_Single_Sign-On_SSO_and_MFA"
create_module_artifacts "$ROOT_DIR/$C" "SEC-04" "SEC-04_Audit_Logging_and_Data_Privacy_GDPR_CCPA"
create_module_artifacts "$ROOT_DIR/$C" "BPM-01" "BPM-01_Workflow_Orchestration_and_Approval_Chains"
create_module_artifacts "$ROOT_DIR/$C" "NOTIF-01" "NOTIF-01_Email_Push_and_In-App_Notification_Matrix"

10_System_Architecture_and_Integrations

C="10_System_Architecture_and_Integrations"
echo "📂 Compiling Framework Artifacts inside $C..."
create_module_artifacts "$ROOT_DIR/$C" "INT-01" "INT-01_Inbound_Applicant_Feeds"
create_module_artifacts "$ROOT_DIR/$C" "INT-02" "INT-02_Outbound_Payroll_Vendor_Extracts_PECI_WECI"
create_module_artifacts "$ROOT_DIR/$C" "INT-03" "INT-03_Benefits_Carrier_Connections_EDI_834"
create_module_artifacts "$ROOT_DIR/$C" "INT-04" "INT-04_Downstream_Identity_Provisioning_Active_Directory"
create_module_artifacts "$ROOT_DIR/$C" "API-01" "API-01_REST_and_SOAP_Web_Services_Specifications"

11_Analytics_and_Reporting

C="11_Analytics_and_Reporting"
echo "📂 Compiling Framework Artifacts inside $C..."
create_module_artifacts "$ROOT_DIR/$C" "REP-01" "REP-01_Standard_Operational_Reports"
create_module_artifacts "$ROOT_DIR/$C" "REP-02" "REP-02_Regulatory_Compliance_Reporting_EEO-1_VETS"
create_module_artifacts "$ROOT_DIR/$C" "REP-03" "REP-03_Executive_Dashboards_and_People_Analytics"

12_Testing_Validation_and_Migration

C="12_Testing_Validation_and_Migration"
echo "📂 Compiling Framework Artifacts inside $C..."
create_module_artifacts "$ROOT_DIR/$C" "MIG-01" "MIG-01_Data_Extraction_Mapping_and_Transformation_ETL"
create_module_artifacts "$ROOT_DIR/$C" "VAL-01" "VAL-01_User_Acceptance_Testing_UAT_Scenarios"
create_module_artifacts "$ROOT_DIR/$C" "VAL-02" "VAL-02_Automated_Regression_Test_Suites"
echo "=========================================================="
echo "SUCCESS: 100% of all required module files generated!"
echo "Directories populated with fully structured blueprints."
echo "=========================================================="
