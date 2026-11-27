#!/bin/bash

# Define the root directory name
ROOT_DIR="HRMS_Requirements_Documentation"

echo "=========================================================="
echo "Creating Enterprise HRMS Documentation Folder Structure..."
echo "Target Root: ./$ROOT_DIR"
echo "=========================================================="

# Helper function to create subfolders and engineering templates
create_module_folder() {
    local path="$1"
    local name="$2"
    
    # Create the functional subfolders
    mkdir -p "$path/Use_Cases_and_User_Stories"
    mkdir -p "$path/Functional_Requirements_FRD"
    mkdir -p "$path/Data_Models_and_Schemas"
    mkdir -p "$path/Wireframes_and_UI_UX"
    
    # Generate a standard README template inside the folder
    cat << EOF > "$path/README.md"
# ${name//_/ } Documentation

## Document Inventory Checklist
- [ ] Use Cases & User Stories (Actors, Pre-conditions, Alternate flows)
- [ ] Functional Requirement Documents (FRD) & Business Rules
- [ ] Data Dictionaries, Schemas & JSON payloads
- [ ] UI/UX Mockups & Interaction Wireframes

Place all raw requirement assets and specifications for this functional track here.
EOF
}

# -----------------------------------------------------------------------------
# 01_Project_Governance_and_Framework
# -----------------------------------------------------------------------------
echo "📁 Structuring: 01_Project_Governance_and_Framework..."
create_module_folder "$ROOT_DIR/01_Project_Governance_and_Framework/Vision_and_Scope_Document" "Vision_and_Scope_Document"
create_module_folder "$ROOT_DIR/01_Project_Governance_and_Framework/Business_Architecture_and_Glossary" "Business_Architecture_and_Glossary"
create_module_folder "$ROOT_DIR/01_Project_Governance_and_Framework/Stakeholder_Matrix_and_Personas" "Stakeholder_Matrix_and_Personas"
create_module_folder "$ROOT_DIR/01_Project_Governance_and_Framework/Change_Management_Strategy" "Change_Management_Strategy"

# -----------------------------------------------------------------------------
# 02_Core_HR_and_Organization_Management
# -----------------------------------------------------------------------------
echo "📁 Structuring: 02_Core_HR_and_Organization_Management..."
create_module_folder "$ROOT_DIR/02_Core_HR_and_Organization_Management/OM-01_Legal_Entity_and_Company_Structure" "OM-01_Legal_Entity_and_Company_Structure"
create_module_folder "$ROOT_DIR/02_Core_HR_and_Organization_Management/OM-02_Cost_Center_and_Department_Hierarchies" "OM-02_Cost_Center_and_Department_Hierarchies"
create_module_folder "$ROOT_DIR/02_Core_HR_and_Organization_Management/OM-03_Job_Architecture_Profiles_and_Families" "OM-03_Job_Architecture_Profiles_and_Families"
create_module_folder "$ROOT_DIR/02_Core_HR_and_Organization_Management/OM-04_Position_Management_and_Headcount_Control" "OM-04_Position_Management_and_Headcount_Control"
create_module_folder "$ROOT_DIR/02_Core_HR_and_Organization_Management/EE-01_Employee_Master_Data_and_Profiles" "EE-01_Employee_Master_Data_and_Profiles"
create_module_folder "$ROOT_DIR/02_Core_HR_and_Organization_Management/EE-02_Worker_Types_Contractor_vs_Regular" "EE-02_Worker_Types_Contractor_vs_Regular"
create_module_folder "$ROOT_DIR/02_Core_HR_and_Organization_Management/EE-03_Lifecycle_Events_Hire_Transfer_Termination" "EE-03_Lifecycle_Events_Hire_Transfer_Termination"
create_module_folder "$ROOT_DIR/02_Core_HR_and_Organization_Management/EE-04_Global_Assignment_and_Expatriate_Management" "EE-04_Global_Assignment_and_Expatriate_Management"

# -----------------------------------------------------------------------------
# 03_Compensation_and_Benefits
# -----------------------------------------------------------------------------
echo "📁 Structuring: 03_Compensation_and_Benefits..."
create_module_folder "$ROOT_DIR/03_Compensation_and_Benefits/COMP-01_Salary_Structures_and_Grade_Ranges" "COMP-01_Salary_Structures_and_Grade_Ranges"
create_module_folder "$ROOT_DIR/03_Compensation_and_Benefits/COMP-02_Variable_Pay_Merit_and_Bonus_Cycles" "COMP-02_Variable_Pay_Merit_and_Bonus_Cycles"
create_module_folder "$ROOT_DIR/03_Compensation_and_Benefits/COMP-03_Executive_Compensation_and_Equity" "COMP-03_Executive_Compensation_and_Equity"
create_module_folder "$ROOT_DIR/03_Compensation_and_Benefits/BEN-01_Health_Insurance_Enrollment" "BEN-01_Health_Insurance_Enrollment"
create_module_folder "$ROOT_DIR/03_Compensation_and_Benefits/BEN-02_Retirement_and_Pension_Plans" "BEN-02_Retirement_and_Pension_Plans"
create_module_folder "$ROOT_DIR/03_Compensation_and_Benefits/BEN-03_Flexible_Spending_and_Perks" "BEN-03_Flexible_Spending_and_Perks"

# -----------------------------------------------------------------------------
# 04_Time_and_Attendance_Management
# -----------------------------------------------------------------------------
echo "📁 Structuring: 04_Time_and_Attendance_Management..."
create_module_folder "$ROOT_DIR/04_Time_and_Attendance_Management/TIME-01_Work_Schedules_and_Shift_Patterns" "TIME-01_Work_Schedules_and_Shift_Patterns"
create_module_folder "$ROOT_DIR/04_Time_and_Attendance_Management/TIME-02_Absence_Accruals_and_Time_Off_Requests" "TIME-02_Absence_Accruals_and_Time_Off_Requests"
create_module_folder "$ROOT_DIR/04_Time_and_Attendance_Management/TIME-03_Timesheet_Submission_and_Approvals" "TIME-03_Timesheet_Submission_and_Approvals"
create_module_folder "$ROOT_DIR/04_Time_and_Attendance_Management/TIME-04_Biometric_and_Geo-Fencing_Integrations" "TIME-04_Biometric_and_Geo-Fencing_Integrations"
create_module_folder "$ROOT_DIR/04_Time_and_Attendance_Management/TIME-05_Overtime_and_Premium_Pay_Rules" "TIME-05_Overtime_and_Premium_Pay_Rules"

# -----------------------------------------------------------------------------
# 05_Global_Payroll_Engine
# -----------------------------------------------------------------------------
echo "📁 Structuring: 05_Global_Payroll_Engine..."
create_module_folder "$ROOT_DIR/05_Global_Payroll_Engine/PAY-01_Gross-to-Net_Calculation_Rules" "PAY-01_Gross-to-Net_Calculation_Rules"
create_module_folder "$ROOT_DIR/05_Global_Payroll_Engine/PAY-02_Taxation_and_Statutory_Deductions_by_Country" "PAY-02_Taxation_and_Statitudes_by_Country"
create_module_folder "$ROOT_DIR/05_Global_Payroll_Engine/PAY-03_Banking_Offsets_and_Direct_Deposit_Routing" "PAY-03_Banking_Offsets_and_Direct_Deposit_Routing"
create_module_folder "$ROOT_DIR/05_Global_Payroll_Engine/PAY-04_Retroactive_Pay_Adjustments" "PAY-04_Retroactive_Pay_Adjustments"
create_module_folder "$ROOT_DIR/05_Global_Payroll_Engine/PAY-05_Off-Cycle_and_On-Demand_Payroll" "PAY-05_Off-Cycle_and_On-Demand_Payroll"
create_module_folder "$ROOT_DIR/05_Global_Payroll_Engine/PAY-06_Year-End_Processing_and_Tax_Filing" "PAY-06_Year-End_Processing_and_Tax_Filing"

# -----------------------------------------------------------------------------
# 06_Talent_Acquisition_and_Onboarding
# -----------------------------------------------------------------------------
echo "📁 Structuring: 06_Talent_Acquisition_and_Onboarding..."
create_module_folder "$ROOT_DIR/06_Talent_Acquisition_and_Onboarding/TA-01_Requisition_Creation_and_Approvals" "TA-01_Requisition_Creation_and_Approvals"
create_module_folder "$ROOT_DIR/06_Talent_Acquisition_and_Onboarding/TA-02_Candidate_Sourcing_and_Job_Board_Multiposting" "TA-02_Candidate_Sourcing_and_Job_Board_Multiposting"
create_module_folder "$ROOT_DIR/06_Talent_Acquisition_and_Onboarding/TA-03_Applicant_Tracking_System_ATS_Workflows" "TA-03_Applicant_Tracking_System_ATS_Workflows"
create_module_folder "$ROOT_DIR/06_Talent_Acquisition_and_Onboarding/TA-04_Interview_Scheduling_and_Scorecards" "TA-04_Interview_Scheduling_and_Scorecards"
create_module_folder "$ROOT_DIR/06_Talent_Acquisition_and_Onboarding/TA-05_Offer_Letter_Generation_and_Background_Checks" "TA-05_Offer_Letter_Generation_and_Background_Checks"
create_module_folder "$ROOT_DIR/06_Talent_Acquisition_and_Onboarding/TA-06_Pre-Onboarding_and_First-Day_Provisioning" "TA-06_Pre-Onboarding_and_First-Day_Provisioning"

# -----------------------------------------------------------------------------
# 07_Talent_and_Performance_Management
# -----------------------------------------------------------------------------
echo "📁 Structuring: 07_Talent_and_Performance_Management..."
create_module_folder "$ROOT_DIR/07_Talent_and_Performance_Management/PERF-01_Goal_Setting_and_Cascading_KPIs" "PERF-01_Goal_Setting_and_Cascading_KPIs"
create_module_folder "$ROOT_DIR/07_Talent_and_Performance_Management/PERF-02_Continuous_Feedback_and_Check-ins" "PERF-02_Continuous_Feedback_and_Check-ins"
create_module_folder "$ROOT_DIR/07_Talent_and_Performance_Management/PERF-03_Annual_and_360-Degree_Reviews" "PERF-03_Annual_and_360-Degree_Reviews"
create_module_folder "$ROOT_DIR/07_Talent_and_Performance_Management/PERF-04_Succession_Planning_and_Talent_Pools" "PERF-04_Succession_Planning_and_Talent_Pools"
create_module_folder "$ROOT_DIR/07_Talent_and_Performance_Management/PERF-05_Career_Development_Frameworks" "PERF-05_Career_Development_Frameworks"

# -----------------------------------------------------------------------------
# 08_Learning_Management_System_LMS
# -----------------------------------------------------------------------------
echo "📁 Structuring: 08_Learning_Management_System_LMS..."
create_module_folder "$ROOT_DIR/08_Learning_Management_System_LMS/LMS-01_Course_Catalog_and_Curriculum_Design" "LMS-01_Course_Catalog_and_Curriculum_Design"
create_module_folder "$ROOT_DIR/08_Learning_Management_System_LMS/LMS-02_SCORM_xAPI_Content_Ingestion" "LMS-02_SCORM_xAPI_Content_Ingestion"
create_module_folder "$ROOT_DIR/08_Learning_Management_System_LMS/LMS-03_Mandatory_Compliance_Training_Tracks" "LMS-03_Mandatory_Compliance_Training_Tracks"
create_module_folder "$ROOT_DIR/08_Learning_Management_System_LMS/LMS-04_Certification_and_License_Tracking" "LMS-04_Certification_and_License_Tracking"

Use code with caution.

-----------------------------------------------------------------------------


09_Cross-Cutting_System_Services


-----------------------------------------------------------------------------

echo "📁 Structuring: 09_Cross-Cutting_System_Services..."
create_module_folder "$ROOT_DIR/09_Cross-Cutting_System_Services/SEC-01_Role-Based_Access_Control_RBAC" "SEC-01_Role-Based_Access_Control_RBAC"
create_module_folder "$ROOT_DIR/09_Cross-Cutting_System_Services/SEC-02_Intersection_Security_and_Row-Level_Constraints" "SEC-02_Intersection_Security_and_Row-Level_Constraints"
create_module_folder "$ROOT_DIR/09_Cross-Cutting_System_Services/SEC-03_Single_Sign-On_SSO_and_MFA" "SEC-03_Single_Sign-On_SSO_and_MFA"
create_module_folder "$ROOT_DIR/09_Cross-Cutting_System_Services/SEC-04_Audit_Logging_and_Data_Privacy_GDPR_CCPA" "SEC-04_Audit_Logging_and_Data_Privacy_GDPR_CCPA"
create_module_folder "$ROOT_DIR/09_Cross-Cutting_System_Services/BPM-01_Workflow_Orchestration_and_Approval_Chains" "BPM-01_Workflow_Orchestration_and_Approval_Chains"
create_module_folder "$ROOT_DIR/09_Cross-Cutting_System_Services/NOTIF-01_Email_Push_and_In-App_Notification_Matrix" "NOTIF-01_Email_Push_and_In-App_Notification_Matrix"

-----------------------------------------------------------------------------


10_System_Architecture_and_Integrations


-----------------------------------------------------------------------------

echo "📁 Structuring: 10_System_Architecture_and_Integrations..."
create_module_folder "$ROOT_DIR/10_System_Architecture_and_Integrations/INT-01_Inbound_Applicant_Feeds" "INT-01_Inbound_Applicant_Feeds"
create_module_folder "$ROOT_DIR/10_System_Architecture_and_Integrations/INT-02_Outbound_Payroll_Vendor_Extracts_PECI_WECI" "INT-02_Outbound_Payroll_Vendor_Extracts_PECI_WECI"
create_module_folder "$ROOT_DIR/10_System_Architecture_and_Integrations/INT-03_Benefits_Carrier_Connections_EDI_834" "INT-03_Benefits_Carrier_Connections_EDI_834"
create_module_folder "$ROOT_DIR/10_System_Architecture_and_Integrations/INT-04_Downstream_Identity_Provisioning_Active_Directory" "INT-04_Downstream_Identity_Provisioning_Active_Directory"
create_module_folder "$ROOT_DIR/10_System_Architecture_and_Integrations/API-01_REST_and_SOAP_Web_Services_Specifications" "API-01_REST_and_SOAP_Web_Services_Specifications"

-----------------------------------------------------------------------------


11_Analytics_and_Reporting


-----------------------------------------------------------------------------

echo "📁 Structuring: 11_Analytics_and_Reporting..."
create_module_folder "$ROOT_DIR/11_Analytics_and_Reporting/REP-01_Standard_Operational_Reports" "REP-01_Standard_Operational_Reports"
create_module_folder "$ROOT_DIR/11_Analytics_and_Reporting/REP-02_Regulatory_Compliance_Reporting_EEO-1_VETS" "REP-02_Regulatory_Compliance_Reporting_EEO-1_VETS"
create_module_folder "$ROOT_DIR/11_Analytics_and_Reporting/REP-03_Executive_Dashboards_and_People_Analytics" "REP-03_Executive_Dashboards_and_People_Analytics"

-----------------------------------------------------------------------------


12_Testing_Validation_and_Migration


-----------------------------------------------------------------------------

echo "📁 Structuring: 12_Testing_Validation_and_Migration..."
create_module_folder "$ROOT_DIR/12_Testing_Validation_and_Migration/MIG-01_Data_Extraction_Mapping_and_Transformation_ETL" "MIG-01_Data_Extraction_Mapping_and_Transformation_ETL"
create_module_folder "$ROOT_DIR/12_Testing_Validation_and_Migration/VAL-01_User_Acceptance_Testing_UAT_Scenarios" "VAL-01_User_Acceptance_Testing_UAT_Scenarios"
create_module_folder "$ROOT_DIR/12_Testing_Validation_and_Migration/VAL-02_Automated_Regression_Test_Suites" "VAL-02_Automated_Regression_Test_Suites"
echo "=========================================================="
echo "SUCCESS: Full HRMS requirements blueprint folder set created!"
echo "=========================================================="
