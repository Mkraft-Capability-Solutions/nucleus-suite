
import { readData } from './workspace-data.mjs';
/**
 * NUCLEUS HRMS · ESTABLISHMENT CONTROL, ASSETS & RECOGNITION SERVICE
 * Ruleset Version: v4.0.0-ESTABLISHMENT-2026.09
 * 
 * Implements MultipliersKraft Blueprint Addendum A:
 * - Demo Point 25 (G7): Department-wise Approved Manpower & Sanctioned Headcount Ceilings
 * - Demo Point 24 (G7): Recruitment: Replacement Requisition against Vacated Position Code vs New Addition
 * - Demo Point 21 (G8): HR Letter Template Engine (Appointment, Increment, Promotion, Relieving)
 * - Demo Point 23 (G8): Induction & Hardware Asset Allocation Register with Serial Numbers
 * - Demo Points 18, 19, 20 (G8): Recognition Awards, Employee Referral Portal & Event Broadcasts
 */

export const ESTABLISHMENT_RULESET_VERSION = 'v4.0.0-ESTABLISHMENT-2026.09';

// ============================================================================
// 1. DEMO POINT 25: APPROVED MANPOWER & SANCTIONED STRENGTH (Gap G7)
// ============================================================================

export const DEFAULT_SANCTIONED_QUOTAS = readData("services.establishmentService", "DEFAULT_SANCTIONED_QUOTAS_1");

/**
 * Calculates current department establishment capacity.
 */
export function calculateDepartmentCapacity(deptName, employees = [], openPositions = [], quotas = DEFAULT_SANCTIONED_QUOTAS) {
    const quotaInfo = quotas[deptName] || readData("services.establishmentService", "quotaInfo_2");
    const sanctioned = quotaInfo.sanctioned;

    const currentHeadcount = employees.filter(e => e.dept === deptName && e.status === 'Active').length;
    const activeOpenReqs = openPositions.filter(p => p.dept === deptName && p.status !== 'Filled').length;
    const totalCommitted = currentHeadcount + activeOpenReqs;
    const availableVacancies = Math.max(0, sanctioned - totalCommitted);
    const utilizationRate = Math.round((totalCommitted / sanctioned) * 100);
    const isAtCapacity = totalCommitted >= sanctioned;

    return {
        department: deptName,
        sanctioned,
        currentHeadcount,
        activeOpenReqs,
        totalCommitted,
        availableVacancies,
        utilizationRate,
        isAtCapacity,
        quotaInfo
    };
}

// ============================================================================
// 2. DEMO POINT 24: REPLACEMENT VS NEW ADDITION REQUISITION (Gap G7)
// ============================================================================

/**
 * Validates a job requisition creation against establishment limits.
 * - REPLACEMENT: Requires valid vacated position code; does not consume additional sanctioned quota.
 * - NEW_ADDITION: Must have available vacancy under sanctioned ceiling (unless Executive Waiver).
 */
export function validateRequisitionCreation({
    dept,
    requisitionType = 'NEW_ADDITION', // 'NEW_ADDITION' or 'REPLACEMENT'
    vacatedPositionCode = '',
    previousIncumbentId = '',
    title,
    employees = [],
    openPositions = [],
    quotas = DEFAULT_SANCTIONED_QUOTAS,
    isExecutiveWaiver = false,
    waiverReason = ''
}) {
    const errors = [];
    const warnings = [];

    const capacity = calculateDepartmentCapacity(dept, employees, openPositions, quotas);

    if (requisitionType === 'REPLACEMENT') {
        if (!vacatedPositionCode || vacatedPositionCode.trim().length === 0) {
            errors.push('Replacement requisition strictly requires specifying the Vacated Position Code (e.g. POS-DES-104).');
        }
        if (!previousIncumbentId || previousIncumbentId.trim().length === 0) {
            warnings.push('Previous incumbent ID should be provided for succession tracking.');
        }
        // Replacement does NOT consume extra quota as it occupies an existing vacated slot
    } else {
        // NEW_ADDITION: Must respect sanctioned ceiling
        if (capacity.isAtCapacity && !isExecutiveWaiver) {
            errors.push(`Cannot create new position addition: ${dept} department is at 100% sanctioned capacity (${capacity.totalCommitted}/${capacity.sanctioned} filled or committed). Requires Board Expansion Waiver.`);
        } else if (capacity.isAtCapacity && isExecutiveWaiver) {
            if (!waiverReason || waiverReason.trim().length < 10) {
                errors.push('Executive expansion waiver requires documented board justification of at least 10 characters.');
            } else {
                warnings.push(`Executive Headcount Expansion Waiver applied. New headcount expands sanctioned capacity beyond ${capacity.sanctioned}.`);
            }
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        computed: {
            dept,
            requisitionType,
            vacatedPositionCode: requisitionType === 'REPLACEMENT' ? vacatedPositionCode : null,
            previousIncumbentId: requisitionType === 'REPLACEMENT' ? previousIncumbentId : null,
            title,
            isExecutiveWaiver,
            waiverReason: isExecutiveWaiver ? waiverReason : null,
            capacityAfterRequisition: requisitionType === 'NEW_ADDITION' ? capacity.totalCommitted + 1 : capacity.totalCommitted
        }
    };
}

// ============================================================================
// 3. DEMO POINT 23: HARDWARE ASSET REGISTER & SERIAL NUMBER TRACKING (Gap G8)
// ============================================================================

export const ASSET_TYPES = readData("services.establishmentService", "ASSET_TYPES_3");

export const INITIAL_ASSET_REGISTER = readData("services.establishmentService", "INITIAL_ASSET_REGISTER_4");

export function getEmployeeAssignedAssets(empId, register = INITIAL_ASSET_REGISTER) {
    return register.filter(a => a.assignedToEmployeeId === empId && a.status === 'ASSIGNED');
}

// ============================================================================
// 4. DEMO POINT 21: HR LETTER TEMPLATE MERGE ENGINE (Gap G8)
// ============================================================================

export const LETTER_TEMPLATES = {
    APPOINTMENT: {
        ...readData("services.establishmentService", "APPOINTMENT_fields_5"),
        templateText: `Ref: NUC/HR/OFFER/2026/{{ref_code}}
Date: {{current_date}}

Dear {{employee_name}},

On behalf of Nucleus Technologies India Pvt Ltd, we are pleased to offer you the position of {{designation}} in our {{department}} team, based at our {{location}} office.

1. COMMENCEMENT OF EMPLOYMENT:
Your employment will commence on {{join_date}}. You will report to {{reporting_manager}}.

2. COMPENSATION & EMOLUMENTS:
You will be entitled to an Annual Cost to Company (CTC) of INR {{annual_ctc}} (Rupees {{annual_ctc_words}}), payable as an approximate Monthly Gross Wage of INR {{monthly_gross}}, subject to statutory deductions (PF, ESI, TDS, PT) per prevailing laws.

3. PROBATION & CONFIRMATION:
You will be on probation for a period of 90 (ninety) days from your joining date, post which your performance will be evaluated for regular employment confirmation.

Welcome to Nucleus! We look forward to your impactful contributions.

Sincerely,
For Nucleus Technologies India Pvt Ltd
Corporate Human Resources`
    },

    INCREMENT: {
        ...readData("services.establishmentService", "INCREMENT_fields_7"),
        templateText: `Ref: NUC/HR/APPRAISAL/2026/{{ref_code}}
Date: {{current_date}}

Dear {{employee_name}},

In recognition of your valuable contributions and performance during the past year (Performance Rating: {{performance_band}}), the Management is pleased to revise your compensation structure.

Effective {{effective_date}}, your Annual Cost to Company (CTC) is revised as follows:
• Previous Annual CTC: INR {{current_ctc}}
• Revision Percentage: {{hike_percentage}}%
• Revised Annual CTC:  INR {{revised_ctc}}

All other terms and conditions of your employment contract remain unaltered.

We appreciate your commitment to Nucleus and look forward to your continued excellence.

Sincerely,
Compensation & Benefits Committee
Nucleus Technologies India Pvt Ltd`
    },

    PROMOTION: {
        ...readData("services.establishmentService", "PROMOTION_fields_9"),
        templateText: `Ref: NUC/HR/PROMO/2026/{{ref_code}}
Date: {{current_date}}

Dear {{employee_name}},

We take great pride in congratulating you on your well-deserved promotion to {{promoted_designation}} in the {{department}} department, effective {{effective_date}}.

In this elevated role (Compensation Band: {{new_band}}), you will be entrusted with expanded operational responsibilities, technical leadership, and mentorship across the team.

Congratulations on this significant milestone in your career at Nucleus!

Warm regards,
Head of Human Resources
Nucleus Technologies India Pvt Ltd`
    },

    RELIEVING: {
        ...readData("services.establishmentService", "RELIEVING_fields_11"),
        templateText: `Ref: NUC/HR/RELIEVING/2026/{{ref_code}}
Date: {{current_date}}

TO WHOMSOEVER IT MAY CONCERN

This is to certify that {{employee_name}} (Employee ID: {{employee_id}}) was employed with Nucleus Technologies India Pvt Ltd from {{join_date}} to {{relieving_date}}.

At the time of leaving the organization, {{employee_name}} was designated as {{designation}} in our {{department}} team.

During their tenure with us, their character and conduct were found to be exemplary. All company assets and clearances have been completed satisfactorily, and {{employee_name}} has been officially relieved of their duties at the close of business on {{relieving_date}}.

We wish {{employee_name}} every success in all future professional endeavors.

For Nucleus Technologies India Pvt Ltd
Authorized Signatory — People Operations`
    }
};

/**
 * Merges variables into an HR letter template.
 */
export function renderLetterTemplate(templateId, employee = {}, customFields = {}) {
    const template = LETTER_TEMPLATES[templateId] || LETTER_TEMPLATES.APPOINTMENT;
    let rendered = template.templateText;
    const emp = employee || {};

    const data = {
        ref_code: Math.floor(10000 + Math.random() * 90000),
        current_date: new Date().toLocaleDateString('en-GB', readData("services.establishmentService", "current_date_14")),
        employee_name: emp.name || 'Employee',
        employee_id: emp.id || 'EMP-000',
        designation: emp.role || 'Staff Specialist',
        department: emp.dept || 'Engineering',
        location: emp.location || 'Bengaluru HQ',
        join_date: emp.joinDate || '01 Jan 2024',
        annual_ctc: ((emp.grossSalaryNumeric || 80000) * 12).toLocaleString(),
        ...readData("services.establishmentService", "data_fields_13"),
        monthly_gross: (emp.grossSalaryNumeric || 80000).toLocaleString(),
        reporting_manager: emp.manager || 'Executive Leadership',
        effective_date: customFields.effective_date || '01 March 2026',
        current_ctc: customFields.current_ctc || ((emp.grossSalaryNumeric || 80000) * 12).toLocaleString(),
        revised_ctc: customFields.revised_ctc || Math.round((emp.grossSalaryNumeric || 80000) * 12 * 1.15).toLocaleString(),
        hike_percentage: customFields.hike_percentage || '15',
        performance_band: customFields.performance_band || 'Exceptional (Band A1)',
        previous_designation: emp.role || 'Developer',
        promoted_designation: customFields.promoted_designation || `Lead ${emp.role || 'Specialist'}`,
        new_band: customFields.new_band || 'L5 - Lead Principal',
        relieving_date: customFields.relieving_date || new Date().toLocaleDateString('en-GB'),
        ...customFields
    };

    Object.entries(data).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        rendered = rendered.replace(regex, value);
    });

    return {
        templateId,
        title: template.title,
        renderedText: rendered,
        metadata: data,
        generatedAt: new Date().toISOString()
    };
}

// ============================================================================
// 5. DEMO POINTS 18, 19, 20: RECOGNITION, REFERRALS & EVENT BROADCASTS (Gap G8)
// ============================================================================

export const RECOGNITION_AWARD_TYPES = readData("services.establishmentService", "RECOGNITION_AWARD_TYPES_15");

export const INITIAL_RECOGNITIONS = readData("services.establishmentService", "INITIAL_RECOGNITIONS_16");

export const INITIAL_REFERRALS = readData("services.establishmentService", "INITIAL_REFERRALS_17");
