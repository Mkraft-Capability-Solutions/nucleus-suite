"use client";

import { useTranslation } from '@/context/I18nContext';
import React, { useState, useEffect, useMemo } from 'react';
import Dialog from '@mui/material/Dialog';
import {
    X, User, Phone, Shield, Users, GraduationCap, Briefcase,
    HeartPulse, Plus, Trash2, CheckCircle2, ArrowRight, ArrowLeft, Lock, AlertCircle
} from 'lucide-react';
import styles from './EmployeeCreationWizard.module.css';
import { useHRMS } from '@/context/HRMSContext';
import { getPicklistOptions } from '@/lib/picklist-catalog';
import { useFormValidation, validateFormFields } from '@/hooks/useFormValidation';
import { useDuplicateCheck } from '@/hooks/useDuplicateCheck';

// Validation rules per tab
const TAB_RULES = {
    1: [
        { key: 'firstName',   label: 'First Name',    required: true, minLength: 1 },
        { key: 'lastName',    label: 'Last Name',     required: true, minLength: 1 },
        { key: 'gender',      label: 'Gender',        required: true },
        { key: 'dateOfBirth', label: 'Date of Birth', required: true, type: 'date' },
    ],
    2: [
        { key: 'mobile',        label: 'Primary Mobile',          required: true, type: 'phone' },
        { key: 'personalEmail', label: 'Personal Email',          required: true, type: 'email' },
        { key: 'emergencyName', label: 'Emergency Contact Name',  required: true, minLength: 2 },
        { key: 'emergencyPhone',label: 'Emergency Contact Phone', required: true, type: 'phone' },
        { key: 'presentAddr1',  label: 'Present Address Line 1',  required: true, minLength: 3 },
        { key: 'presentCity',   label: 'City',                    required: true, minLength: 2 },
        { key: 'presentState',  label: 'State',                   required: true },
        { key: 'presentPin',    label: 'PIN Code',                required: true, type: 'pin' },
    ],
    3: [
        { key: 'panToken',      label: 'PAN Number',              required: false, type: 'pan' },
        { key: 'aadhaarToken',  label: 'Aadhaar Number',          required: false, type: 'aadhaar' },
        { key: 'uan',           label: 'UAN (Universal Account Number)', required: false, type: 'uan' },
        { key: 'esiIp',         label: 'ESI IP Number',           required: false, type: 'esiIp' },
        { key: 'bankName',      label: 'Bank Name',               required: true, minLength: 2 },
        { key: 'accountToken',  label: 'Account Number',          required: true, minLength: 9, maxLength: 18 },
        { key: 'accountConfirm',label: 'Confirm Account Number',  required: true, matchKey: 'accountToken', matchLabel: 'Account Number' },
        { key: 'ifsc',          label: 'IFSC Code',               required: true, type: 'ifsc' },
        { key: 'accountType',   label: 'Account Type',            required: true },
    ],
    6: [
        { key: 'department',   label: 'Department',        required: true },
        { key: 'designation',  label: 'Designation',       required: true, minLength: 2 },
        { key: 'joiningDate',  label: 'Date of Joining',   required: true, type: 'date' },
        { key: 'manager',      label: 'Reporting Manager', required: true, minLength: 2 },
        { key: 'location',     label: 'Work Location',     required: true },
        { key: 'workerClass',  label: 'Worker Class',      required: true },
    ],
};
const ALL_RULES = Object.values(TAB_RULES).flat();

const FormErrorContext = React.createContext({ touchedFields: {}, formErrors: {} });

function FieldError({ fieldKey }) {
    const { touchedFields, formErrors } = React.useContext(FormErrorContext);
    const err = touchedFields[fieldKey] ? formErrors[fieldKey] : null;
    if (!err) return null;
    return <span className={styles.fieldError} role="alert"><AlertCircle size={12} /> {err}</span>;
}

function TabErrorBanner({ tabNum }) {
  const { t } = useTranslation();
    const { formErrors } = React.useContext(FormErrorContext);
    const rules = TAB_RULES[tabNum] || [];
    const errorsInTab = rules
        .map(r => ({ key: r.key, label: r.label, error: formErrors[r.key] }))
        .filter(item => Boolean(item.error));

    if (errorsInTab.length === 0) return null;

    return (
        <div className={styles.tabErrorBanner} role="alert">
            <AlertCircle size={18} className={styles.tabErrorIcon} />
            <div className={styles.tabErrorContent}>
                <div className={styles.tabErrorTitle}>
                    
                    {t("components.Workspace.EmployeeCreationWizard.text_please_resolve", "Please resolve")} {errorsInTab.length}  {t("components.Workspace.EmployeeCreationWizard.text_required_or_invalid_field", "required or invalid field")}{errorsInTab.length > 1 ? 's' : ''}  {t("components.Workspace.EmployeeCreationWizard.text_in_this_tab", "in this tab:")}
                </div>
                <ul className={styles.tabErrorList}>
                    {errorsInTab.map(item => (
                        <li key={item.key}>
                            <strong>{item.label}:</strong> {item.error}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

export default function EmployeeCreationWizard({
    isOpen,
    onClose,
    onSave,
    existingEmployees = [],
    mode = 'create',
    initialData = null
}) {
    const { t } = useTranslation();
    const { showToast } = useHRMS();
    const [activeTab, setActiveTab] = useState(1);
    const [formErrors, setFormErrors] = useState({});
    const [touchedFields, setTouchedFields] = useState({});
    const { isDuplicate, findDuplicate } = useDuplicateCheck(existingEmployees);

    // Form state covering all 12 sections of FRM-PPL-01
    const [formData, setFormData] = useState({
        // Section 1: Identity
        employeeCode: '',  // auto-generated on mount
        salutation: '',
        firstName: '',
        middleName: '',
        lastName: '',
        fullLegalName: '',
        nameAsPerBank: '',
        formerName: '',
        gender: '',
        dateOfBirth: '',
        bloodGroup: '',
        maritalStatus: '',
        marriageDate: '',
        nationality: 'Indian',
        placeOfBirth: '',
        motherTongue: 'Hindi',
        socialCategory: '',
        religion: '',
        isDifferentlyAbled: false,
        disabilityType: '',
        disabilityPercent: '',
        isExServiceman: false,

        // Section 2: Family
        fatherName: '',
        motherName: '',
        spouseName: '',

        // Section 3: Contact
        mobile: '',
        altMobile: '',
        personalEmail: '',
        officialEmail: '',
        emergencyName: '',
        emergencyRelation: '',
        emergencyPhone: '',
        emergencySecondaryName: '',
        emergencySecondaryRelation: '',
        emergencySecondaryPhone: '',

        // Section 4: Address
        presentAddr1: '',
        presentAddr2: '',
        presentCity: '',
        presentDistrict: '',
        presentState: '',
        presentPin: '',
        presentCountry: 'India',
        permanentSameAsPresent: true,
        permanentAddress: '',
        accommodationType: 'Own',

        // Section 5: Statutory IDs
        aadhaarToken: '',
        panToken: '',
        uan: '',
        esiIp: '',
        passportToken: '',
        passportExpiry: '',
        drivingLicence: '',
        voterId: '',
        npsPran: '',
        isInternationalWorker: false,
        countryOfOrigin: '',
        workPermitNo: '',

        // Section 6: Bank
        bankName: 'HDFC Bank',
        bankBranch: 'MG Road, Bangalore',
        accountToken: '',
        accountConfirm: '',
        ifsc: 'HDFC0000123',
        accountType: 'Savings',
        paymentMode: 'Bank Transfer',

        // Section 7: Family & Nominees (Repeating Arrays)
        dependants: [
            { name: '', relation: '', dob: '', gender: '', insured: true }
        ],
        nominees: [
            { name: '', relation: '', dob: '', sharePercent: 100, scheme: 'PF', guardianName: '', address: '' }
        ],

        // Section 8: Education (Repeating)
        education: [
            { level: '', degree: 'Computer Science', institute: 'VTU University', passingYear: '2020', score: '8.5 CGPA' }
        ],

        // Section 9: Experience (Repeating)
        experience: [
            { employer: '', designation: '', fromDate: '', toDate: '', lastCtc: '', reasonForLeaving: '', prevUan: '' }
        ],

        // Section 10: Medical & Safety
        medicalExamDate: '',
        fitnessStatus: 'Fit',
        safetyInductionDate: '',

        // Section 11: Site & Facilities
        biometricEnrolId: '',
        accessCardNo: '',
        transportRoute: '',
        canteenEligible: true,
        uniformSize: 'L',
        lockerNo: '',

        // Section 12: Control & Placement
        department: '',
        designation: '',
        joiningDate: new Date().toISOString().split('T')[0],
        manager: '',
        location: '',
        workerClass: '',
        status: 'Active',
        effectiveFrom: new Date().toISOString().split('T')[0],
        changeReason: 'New hire onboarding',

        // Section 13: Labour Law & OT Classification
        workerCategory: 'PERM',           // PERM | CONTRACT | THIRD_PARTY_EMP | THIRD_PARTY_HELPER | TRAINEE_DET | TRAINEE_GET
        hasRestDays: true,                // false for daily-wage contractual, 3rd-party helpers
        otEligibility: 'ALL_DAYS',        // ALL_DAYS | REST_HOLIDAYS_ONLY | NONE
        salaryLocationScope: 'PLANT',     // PLANT | HO (HO employees: attendance at plant, salary at HO)
        assignedShift: 'A',               // A | B | C | GENERAL | AUTO_DETECT
        isTrainee: false,
        traineeType: '',                  // DET | GET
    });

    // Auto-generate employee code on mount or load initialData for edit
    useEffect(() => {
        if (!isOpen) return;
        if (mode === 'edit' && initialData) {
            const d = initialData.details || {};
            const names = (initialData.name || d.fullLegalName || `${d.firstName || ''} ${d.lastName || ''}`).trim().split(/\s+/);
            const first = d.firstName || names[0] || '';
            const last = d.lastName || names.slice(1).join(' ') || '';
            setFormData(prev => ({
                ...prev,
                ...d,
                employeeCode: initialData.id || d.employeeCode || prev.employeeCode,
                firstName: first || prev.firstName,
                lastName: last || prev.lastName,
                fullLegalName: initialData.name || d.fullLegalName || `${first} ${last}`.trim() || prev.fullLegalName,
                nameAsPerBank: initialData.name || d.nameAsPerBank || `${first} ${last}`.trim() || prev.nameAsPerBank,
                department: initialData.dept || initialData.department || d.department || prev.department,
                designation: initialData.role || initialData.designation || d.designation || prev.designation,
                manager: initialData.manager || d.manager || prev.manager,
                location: initialData.location || d.location || prev.location,
                workerClass: initialData.band || d.workerClass || d.workerCategory || prev.workerClass,
                status: initialData.status || d.status || prev.status,
                accountToken: d.accountToken || d.accountNumber || initialData.accountNumber || prev.accountToken || '987654321098',
                accountConfirm: d.accountConfirm || d.accountToken || initialData.accountNumber || prev.accountConfirm || '987654321098',
                pan: d.pan || d.panToken || initialData.pan || prev.pan || 'ABCDE1234F',
                aadhaar: d.aadhaar || d.aadhaarToken || initialData.aadhaar || prev.aadhaar || '987654321098',
                uan: d.uan || initialData.uan || prev.uan || '100123456789',
                mobile: d.mobile || d.mobilePhone || initialData.phone || prev.mobile || '9876543210',
                personalEmail: d.personalEmail || initialData.personalEmail || prev.personalEmail || `${(first || 'emp').toLowerCase()}@gmail.com`,
                emergencyName: d.emergencyName || d.emergencyContactName || initialData.emergencyContact || prev.emergencyName || 'Family Member',
                emergencyPhone: d.emergencyPhone || d.emergencyContactPhone || initialData.emergencyPhone || prev.emergencyPhone || '9876511223',
                presentAddr1: d.presentAddr1 || d.addressLine1 || initialData.address || prev.presentAddr1 || 'Tech Park Campus',
                presentCity: d.presentCity || d.city || initialData.city || prev.presentCity || 'Bangalore',
                presentState: d.presentState || d.state || initialData.state || prev.presentState || 'KA',
                presentPin: d.presentPin || d.pinCode || initialData.pinCode || prev.presentPin || '560100',
                bankName: d.bankName || initialData.bankName || prev.bankName || 'HDFC Bank',
                ifsc: d.ifsc || initialData.ifsc || prev.ifsc || 'HDFC0000123',
            }));
        } else {
            const existing = existingEmployees.map(e => {
                const m = String(e.id ?? '').match(/(\d+)$/);
                return m ? parseInt(m[1], 10) : 0;
            });
            const maxExisting = existing.length > 0 ? Math.max(...existing) : 10000;
            const nextCode = `EMP-${String(maxExisting + 1).padStart(5, '0')}`;
            setFormData(prev => ({ ...prev, employeeCode: nextCode }));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, mode, initialData]);

    const handleChange = (field, val) => {
        setFormData(prev => {
            const next = { ...prev, [field]: val };
            // If user enters accountToken and accountConfirm was untouched or empty, keep in sync
            if (field === 'accountToken' && !touchedFields.accountConfirm && (!prev.accountConfirm || prev.accountConfirm === prev.accountToken)) {
                next.accountConfirm = val;
            }
            return next;
        });
        // Clear error for this field when user edits it
        if (formErrors[field]) setFormErrors(prev => { const n = {...prev}; delete n[field]; return n; });
    };

    const [isCustomManager, setIsCustomManager] = useState(false);
    const [customManagerText, setCustomManagerText] = useState('');

    const touchField = (key) => setTouchedFields(prev => ({ ...prev, [key]: true }));
    const getFieldError = (key) => touchedFields[key] ? formErrors[key] ?? '' : '';
    const ic = (key) => `${styles.input} ${getFieldError(key) ? styles.inputError : ''}`;
    const sc = (key) => `${styles.select} ${getFieldError(key) ? styles.inputError : ''}`;

    const tabErrorCount = (tabNum) => {
        const rules = TAB_RULES[tabNum] || [];
        return rules.filter(r => Boolean(formErrors[r.key])).length;
    };

    const isTabComplete = (tabNum) => {
        const rules = TAB_RULES[tabNum] || [];
        return rules.every(r => {
            const val = formData[r.key];
            if (!r.required) return true;
            if (val === undefined || val === null || val === '') return false;
            return true;
        }) && tabErrorCount(tabNum) === 0;
    };

    const managerOptions = useMemo(() => {
        const list = [];
        const seen = new Set();

        // Contextual filtering (Active users only, exclude self)
        const scopedEmployees = (existingEmployees || []).filter(emp => {
            // Self-exclusion
            if (formData.employeeCode && (emp.id === formData.employeeCode || emp.employeeCode === formData.employeeCode)) {
                return false;
            }
            // Status filter: strictly active
            const status = String(emp.status || '').toLowerCase();
            if (status.includes('inactive') || status.includes('resigned') || status.includes('terminated')) {
                return false;
            }
            return true;
        });

        scopedEmployees.forEach(emp => {
            const name = emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
            if (name && !seen.has(name)) {
                seen.add(name);
                const roleDesc = emp.role || emp.designation || emp.dept || 'Staff';
                const codeDesc = emp.id || emp.employeeCode ? ` (${emp.id || emp.employeeCode})` : '';
                list.push({
                    value: name,
                    code: emp.id || emp.employeeCode,
                    label: `${name} — ${roleDesc}${codeDesc}`
                });
            }
        });

        list.sort((a, b) => (a.label || a.value).localeCompare(b.label || b.value));

        if (formData.manager && !seen.has(formData.manager)) {
            list.unshift({ value: formData.manager, label: `${formData.manager} (Assigned)` });
        }

        return list;
    }, [existingEmployees, formData.manager, formData.employeeCode]);

    // Helper to compute full name
    const updateFirstName = (val) => {
        setFormData(prev => ({
            ...prev,
            firstName: val,
            fullLegalName: `${val} ${prev.lastName}`.trim(),
            nameAsPerBank: `${val} ${prev.lastName}`.trim()
        }));
        if (formErrors.firstName) setFormErrors(prev => { const n = {...prev}; delete n.firstName; return n; });
    };

    const updateLastName = (val) => {
        setFormData(prev => ({
            ...prev,
            lastName: val,
            fullLegalName: `${prev.firstName} ${val}`.trim(),
            nameAsPerBank: `${prev.firstName} ${val}`.trim()
        }));
        if (formErrors.lastName) setFormErrors(prev => { const n = {...prev}; delete n.lastName; return n; });
    };

    // Repeating Row Handlers
    const addRow = (arrayField, defaultObj) => {
        setFormData(prev => ({ ...prev, [arrayField]: [...prev[arrayField], defaultObj] }));
    };

    const removeRow = (arrayField, index) => {
        setFormData(prev => ({
            ...prev,
            [arrayField]: prev[arrayField].filter((_, i) => i !== index)
        }));
    };

    const updateRow = (arrayField, index, key, value) => {
        setFormData(prev => {
            const updated = [...prev[arrayField]];
            updated[index] = { ...updated[index], [key]: value };
            return { ...prev, [arrayField]: updated };
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Validate ALL fields across all tabs
        const errs = validateFormFields(formData, ALL_RULES);
        setFormErrors(errs);

        // Mark all rule fields as touched so errors show
        const allTouched = {};
        ALL_RULES.forEach(r => { allTouched[r.key] = true; });
        setTouchedFields(allTouched);

        if (Object.keys(errs).length > 0) {
            // Navigate to the first tab that has errors
            for (let tab = 1; tab <= 6; tab++) {
                const rules = TAB_RULES[tab] || [];
                if (rules.some(r => !!errs[r.key])) {
                    setActiveTab(tab);
                    break;
                }
            }
            showToast('Validation Error', 'Please fix all highlighted errors before saving.', 'error');
            return;
        }

        if (mode !== 'edit') {
            // Duplicate check
            const dupCheck = findDuplicate([
                { field: 'id',    value: formData.employeeCode, label: 'Employee Code' },
                { field: 'mobile', value: formData.mobile,      label: 'Mobile Number' },
            ]);
            // Also check email manually since field key differs
            const emailDup = existingEmployees.some(e =>
                e.details?.personalEmail &&
                e.details.personalEmail.toLowerCase() === formData.personalEmail.toLowerCase()
            );
            if (dupCheck) {
                showToast('Duplicate Entry', `${dupCheck.label} "${formData[dupCheck.field === 'id' ? 'employeeCode' : String(dupCheck.field)]}" already exists.`, 'error');
                return;
            }
            if (emailDup) {
                showToast('Duplicate Entry', `An employee with email "${formData.personalEmail}" already exists.`, 'error');
                return;
            }
        }

        // Sanitize repeating arrays before saving
        const sanitizedDetails = {
            ...formData,
            experience: (formData.experience || []).filter(e => e && e.employer && e.employer.trim() !== ''),
            education: (formData.education || []).map((edu, idx) => ({
                ...edu,
                isHighest: edu.isHighest !== undefined ? edu.isHighest : idx === 0,
                yearOfPassing: edu.yearOfPassing || edu.passingYear || 2020
            }))
        };

        const newEmployee = {
            id: formData.employeeCode,
            name: `${formData.firstName} ${formData.lastName}`.trim(),
            role: formData.designation,
            dept: formData.department,
            manager: formData.manager,
            location: formData.location,
            status: formData.status,
            band: formData.workerClass,
            mobile: formData.mobile,
            details: sanitizedDetails
        };

        if (onSave) onSave(newEmployee);
        showToast(mode === 'edit' ? 'Employee Updated' : 'Employee Created', `${newEmployee.name} (${newEmployee.id}) ${mode === 'edit' ? 'updated' : 'created'} successfully.`, 'success');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <FormErrorContext.Provider value={{ touchedFields, formErrors }}>
            <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.titleGroup}>
                        <h2><User size={20} className={styles.headerIcon} /> {mode === 'edit' ? `Edit Employee Profile (${formData.employeeCode})` : 'Add Employee Master (FRM-PPL-01)'}</h2>
                        <p>{mode === 'edit' ? `Update details and statutory information for ${formData.fullLegalName || formData.employeeCode}` : 'Complete 117-field statutory employee onboarding wizard'}</p>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose} type="button" title={t("components.Workspace.EmployeeCreationWizard.title_close", "Close")}><X size={20} /></button>
                </div>

                {/* Tabs - Form Step Navigation fitting perfectly within modal window */}
                <div className={styles.tabs} role="tablist" aria-label={t("components.Workspace.EmployeeCreationWizard.aria-label_employee_creation_wizard_steps", "Employee Creation Wizard Steps")}>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 1}
                        title={t("components.Workspace.EmployeeCreationWizard.title_1_identity_personal_attributes", "1. Identity & Personal Attributes")}
                        className={`${styles.tabBtn} ${activeTab === 1 ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab(1)}
                    >
                        <User size={14} className={styles.tabIcon} />
                        <span className={styles.tabLabel}>{t("components.Workspace.EmployeeCreationWizard.text_1_identity", "1. Identity")}</span>
                        {tabErrorCount(1) > 0 && <span className={styles.tabErrorBadge}>{tabErrorCount(1)}</span>}
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 2}
                        title={t("components.Workspace.EmployeeCreationWizard.title_2_contact_address_details", "2. Contact & Address Details")}
                        className={`${styles.tabBtn} ${activeTab === 2 ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab(2)}
                    >
                        <Phone size={14} className={styles.tabIcon} />
                        <span className={styles.tabLabel}>{t("components.Workspace.EmployeeCreationWizard.text_2_contact", "2. Contact")}</span>
                        {tabErrorCount(2) > 0 && <span className={styles.tabErrorBadge}>{tabErrorCount(2)}</span>}
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 3}
                        title={t("components.Workspace.EmployeeCreationWizard.title_3_statutory_ids_bank_details", "3. Statutory IDs & Bank Details")}
                        className={`${styles.tabBtn} ${activeTab === 3 ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab(3)}
                    >
                        <Shield size={14} className={styles.tabIcon} />
                        <span className={styles.tabLabel}>{t("components.Workspace.EmployeeCreationWizard.text_3_statutory", "3. Statutory")}</span>
                        {tabErrorCount(3) > 0 && <span className={styles.tabErrorBadge}>{tabErrorCount(3)}</span>}
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 4}
                        title={t("components.Workspace.EmployeeCreationWizard.title_4_family_nominees", "4. Family & Nominees")}
                        className={`${styles.tabBtn} ${activeTab === 4 ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab(4)}
                    >
                        <Users size={14} className={styles.tabIcon} />
                        <span className={styles.tabLabel}>{t("components.Workspace.EmployeeCreationWizard.text_4_family", "4. Family")}</span>
                        {tabErrorCount(4) > 0 && <span className={styles.tabErrorBadge}>{tabErrorCount(4)}</span>}
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 5}
                        title={t("components.Workspace.EmployeeCreationWizard.title_5_education_work_experience", "5. Education & Work Experience")}
                        className={`${styles.tabBtn} ${activeTab === 5 ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab(5)}
                    >
                        <GraduationCap size={14} className={styles.tabIcon} />
                        <span className={styles.tabLabel}>{t("components.Workspace.EmployeeCreationWizard.text_5_education", "5. Education")}</span>
                        {tabErrorCount(5) > 0 && <span className={styles.tabErrorBadge}>{tabErrorCount(5)}</span>}
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 6}
                        title={t("components.Workspace.EmployeeCreationWizard.title_6_placement_medical_facilities_control", "6. Placement, Medical & Facilities Control")}
                        className={`${styles.tabBtn} ${activeTab === 6 ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab(6)}
                    >
                        <Briefcase size={14} className={styles.tabIcon} />
                        <span className={styles.tabLabel}>{t("components.Workspace.EmployeeCreationWizard.text_6_placement", "6. Placement")}</span>
                        {tabErrorCount(6) > 0 && <span className={styles.tabErrorBadge}>{tabErrorCount(6)}</span>}
                    </button>
                </div>

                {/* Form Content Body */}
                <form onSubmit={handleSubmit} className={styles.body}>
                    {/* TAB 1: IDENTITY & PERSONAL */}
                    {activeTab === 1 && (
                        <div className={styles.sectionGroup}>
                            <TabErrorBanner tabNum={1} />
                            <div className={styles.sectionTitle}>{t("components.Workspace.EmployeeCreationWizard.text_identity_attributes", "Identity Attributes")}</div>
                            <div className={styles.formGrid}>
                                {/* Employee Code — Read Only, Auto-Generated */}
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>
                                        
                                        {t("components.Workspace.EmployeeCreationWizard.text_employee_code", "Employee Code")}
                                        <span className={styles.autoTag}><Lock size={11} />  {t("components.Workspace.EmployeeCreationWizard.text_auto-assigned", "Auto-assigned")}</span>
                                    </span>
                                    <div className={styles.readOnlyId}>
                                        <Lock size={13} />
                                        <span>{formData.employeeCode || 'Generating…'}</span>
                                    </div>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_salutation", "Salutation")}</span>
                                    <select className={styles.select} value={formData.salutation} onChange={e => handleChange('salutation', e.target.value)}>
                                        <option value="">{t("components.Workspace.EmployeeCreationWizard.text_select_salutation", "Select Salutation")}</option>
                                        {(getPicklistOptions('PL_SALUTATION').length > 0 ? getPicklistOptions('PL_SALUTATION') : [{value: 'Mr', label: 'Mr'}, {value: 'Ms', label: 'Ms'}, {value: 'Mrs', label: 'Mrs'}, {value: 'Dr', label: 'Dr'}]).map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_first_name", "First Name")} <span className={styles.required}>*</span></span>
                                    <input className={ic('firstName')} value={formData.firstName} onChange={e => updateFirstName(e.target.value)} onBlur={() => touchField('firstName')} required />
                                    <FieldError fieldKey="firstName" />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_middle_name", "Middle Name")}</span>
                                    <input className={styles.input} value={formData.middleName} onChange={e => handleChange('middleName', e.target.value)} />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_last_name", "Last Name")} <span className={styles.required}>*</span></span>
                                    <input className={ic('lastName')} value={formData.lastName} onChange={e => updateLastName(e.target.value)} onBlur={() => touchField('lastName')} required />
                                    <FieldError fieldKey="lastName" />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_full_name_aadhaar_match", "Full Name (Aadhaar match)")}</span>
                                    <input className={styles.input} value={formData.fullLegalName} onChange={e => handleChange('fullLegalName', e.target.value)} />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_gender", "Gender")} <span className={styles.required}>*</span></span>
                                    <select className={sc('gender')} value={formData.gender} onChange={e => handleChange('gender', e.target.value)} onBlur={() => touchField('gender')}>
                                        <option value="">{t("components.Workspace.EmployeeCreationWizard.text_select_gender", "Select Gender")}</option>
                                        {(getPicklistOptions('PL_GENDER').length > 0 ? getPicklistOptions('PL_GENDER') : [{value: 'Male', label: 'Male'}, {value: 'Female', label: 'Female'}, {value: 'Other', label: 'Other'}]).map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                    <FieldError fieldKey="gender" />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_date_of_birth", "Date of Birth")} <span className={styles.required}>*</span></span>
                                    <input type="date" className={ic('dateOfBirth')} value={formData.dateOfBirth} onChange={e => handleChange('dateOfBirth', e.target.value)} onBlur={() => touchField('dateOfBirth')} required />
                                    <FieldError fieldKey="dateOfBirth" />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_blood_group", "Blood Group")}</span>
                                    <select className={styles.select} value={formData.bloodGroup} onChange={e => handleChange('bloodGroup', e.target.value)}>
                                        <option value="">{t("components.Workspace.EmployeeCreationWizard.text_select_blood_group", "Select Blood Group")}</option>
                                        {(getPicklistOptions('PL_BLOOD_GROUP').length > 0 ? getPicklistOptions('PL_BLOOD_GROUP') : [{value: 'A+', label: 'A+'}, {value: 'A-', label: 'A-'}, {value: 'B+', label: 'B+'}, {value: 'B-', label: 'B-'}, {value: 'O+', label: 'O+'}, {value: 'O-', label: 'O-'}, {value: 'AB+', label: 'AB+'}, {value: 'AB-', label: 'AB-'}]).map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_marital_status", "Marital Status")}</span>
                                    <select className={styles.select} value={formData.maritalStatus} onChange={e => handleChange('maritalStatus', e.target.value)}>
                                        <option value="">{t("components.Workspace.EmployeeCreationWizard.text_select_marital_status", "Select Marital Status")}</option>
                                        {(getPicklistOptions('PL_MARITAL_STATUS').length > 0 ? getPicklistOptions('PL_MARITAL_STATUS') : [{value: 'Single', label: 'Single'}, {value: 'Married', label: 'Married'}, {value: 'Divorced', label: 'Divorced'}, {value: 'Widowed', label: 'Widowed'}]).map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </label>
                                {formData.maritalStatus === 'Married' && (
                                    <label className={styles.field}>
                                        <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_marriage_date", "Marriage Date")}</span>
                                        <input type="date" className={styles.input} value={formData.marriageDate} onChange={e => handleChange('marriageDate', e.target.value)} />
                                    </label>
                                )}
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_nationality", "Nationality")}</span>
                                    <input className={styles.input} value={formData.nationality} onChange={e => handleChange('nationality', e.target.value)} />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_social_category", "Social Category")}</span>
                                    <select className={styles.select} value={formData.socialCategory} onChange={e => handleChange('socialCategory', e.target.value)}>
                                        <option value="">{t("components.Workspace.EmployeeCreationWizard.text_select_social_category", "Select Social Category")}</option>
                                        {(getPicklistOptions('PL_SOCIAL_CAT').length > 0 ? getPicklistOptions('PL_SOCIAL_CAT') : [{value: 'General', label: 'General'}, {value: 'OBC', label: 'OBC'}, {value: 'SC', label: 'SC'}, {value: 'ST', label: 'ST'}]).map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            <div className={styles.sectionTitle} style={{ marginTop: '1rem' }}>{t("components.Workspace.EmployeeCreationWizard.text_family_identity", "Family Identity")}</div>
                            <div className={styles.formGrid}>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_fatheraposs_name", "Father&apos;s Name")}</span>
                                    <input className={styles.input} value={formData.fatherName} onChange={e => handleChange('fatherName', e.target.value)} />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_motheraposs_name", "Mother&apos;s Name")}</span>
                                    <input className={styles.input} value={formData.motherName} onChange={e => handleChange('motherName', e.target.value)} />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_spouse_name", "Spouse Name")}</span>
                                    <input className={styles.input} value={formData.spouseName} onChange={e => handleChange('spouseName', e.target.value)} />
                                </label>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: CONTACT & ADDRESS */}
                    {activeTab === 2 && (
                        <div className={styles.sectionGroup}>
                            <TabErrorBanner tabNum={2} />
                            <div className={styles.sectionTitle}>{t("components.Workspace.EmployeeCreationWizard.text_contact_info", "Contact Info")}</div>
                            <div className={styles.formGrid}>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_primary_mobile_whatsapp", "Primary Mobile (WhatsApp)")} <span className={styles.required}>*</span></span>
                                    <input
                                        className={ic('mobile')}
                                        maxLength={10}
                                        placeholder={t("components.Workspace.EmployeeCreationWizard.placeholder_9876543210", "9876543210")}
                                        value={formData.mobile}
                                        onChange={e => handleChange('mobile', e.target.value.replace(/\D/g, ''))}
                                        onBlur={() => touchField('mobile')}
                                        required
                                    />
                                    <FieldError fieldKey="mobile" />
                                    <span className={styles.formatHint}>{t("components.Workspace.EmployeeCreationWizard.text_10-digit_indian_mobile_number_eg_9876543", "10-digit Indian mobile number (e.g. 9876543210)")}</span>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_official_email", "Official Email")}</span>
                                    <input type="email" className={styles.input} placeholder={t("components.Workspace.EmployeeCreationWizard.placeholder_namecompanycom", "name@company.com")} value={formData.officialEmail} onChange={e => handleChange('officialEmail', e.target.value)} />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_personal_email", "Personal Email")} <span className={styles.required}>*</span></span>
                                    <input
                                        type="email"
                                        className={ic('personalEmail')}
                                        placeholder={t("components.Workspace.EmployeeCreationWizard.placeholder_namegmailcom", "name@gmail.com")}
                                        value={formData.personalEmail}
                                        onChange={e => handleChange('personalEmail', e.target.value)}
                                        onBlur={() => touchField('personalEmail')}
                                        required
                                    />
                                    <FieldError fieldKey="personalEmail" />
                                    <span className={styles.formatHint}>{t("components.Workspace.EmployeeCreationWizard.text_format_namedomaincom", "Format: name@domain.com")}</span>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_emergency_contact_name", "Emergency Contact Name")} <span className={styles.required}>*</span></span>
                                    <input
                                        className={ic('emergencyName')}
                                        placeholder={t("components.Workspace.EmployeeCreationWizard.placeholder_contact_person_full_name", "Contact person full name")}
                                        value={formData.emergencyName}
                                        onChange={e => handleChange('emergencyName', e.target.value)}
                                        onBlur={() => touchField('emergencyName')}
                                        required
                                    />
                                    <FieldError fieldKey="emergencyName" />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_emergency_relation", "Emergency Relation")}</span>
                                    <input className={styles.input} value={formData.emergencyRelation} onChange={e => handleChange('emergencyRelation', e.target.value)} />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_emergency_phone", "Emergency Phone")} <span className={styles.required}>*</span></span>
                                    <input
                                        className={ic('emergencyPhone')}
                                        maxLength={10}
                                        placeholder={t("components.Workspace.EmployeeCreationWizard.placeholder_9876543210", "9876543210")}
                                        value={formData.emergencyPhone}
                                        onChange={e => handleChange('emergencyPhone', e.target.value.replace(/\D/g, ''))}
                                        onBlur={() => touchField('emergencyPhone')}
                                        required
                                    />
                                    <FieldError fieldKey="emergencyPhone" />
                                    <span className={styles.formatHint}>{t("components.Workspace.EmployeeCreationWizard.text_10-digit_mobile_number", "10-digit mobile number")}</span>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_secondary_emergency_name", "Secondary Emergency Name")}</span>
                                    <input className={styles.input} placeholder={t("components.Workspace.EmployeeCreationWizard.placeholder_secondary_contact_name", "Secondary contact name")} value={formData.emergencySecondaryName || ''} onChange={e => handleChange('emergencySecondaryName', e.target.value)} />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_secondary_relation", "Secondary Relation")}</span>
                                    <select className={styles.select} value={formData.emergencySecondaryRelation || 'Parent'} onChange={e => handleChange('emergencySecondaryRelation', e.target.value)}>
                                        <option value="Parent">{t("components.Workspace.EmployeeCreationWizard.text_parent", "Parent")}</option>
                                        <option value="Sibling">{t("components.Workspace.EmployeeCreationWizard.text_sibling", "Sibling")}</option>
                                        <option value="Spouse">{t("components.Workspace.EmployeeCreationWizard.text_spouse", "Spouse")}</option>
                                        <option value="Friend">{t("components.Workspace.EmployeeCreationWizard.text_friend", "Friend")}</option>
                                        <option value="Guardian">{t("components.Workspace.EmployeeCreationWizard.text_guardian", "Guardian")}</option>
                                    </select>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_secondary_phone", "Secondary Phone")}</span>
                                    <input className={styles.input} placeholder={t("components.Workspace.EmployeeCreationWizard.placeholder_9876543210", "9876543210")} value={formData.emergencySecondaryPhone || ''} onChange={e => handleChange('emergencySecondaryPhone', e.target.value)} />
                                </label>
                            </div>

                            <div className={styles.sectionTitle} style={{ marginTop: '1rem' }}>{t("components.Workspace.EmployeeCreationWizard.text_address_details", "Address Details")}</div>
                            <div className={styles.formGrid}>
                                <label className={styles.field} style={{ gridColumn: 'span 2' }}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_present_address_line_1", "Present Address Line 1")} <span className={styles.required}>*</span></span>
                                    <input
                                        className={ic('presentAddr1')}
                                        placeholder={t("components.Workspace.EmployeeCreationWizard.placeholder_flathouse_no_street_landmark", "Flat/House No, Street, Landmark")}
                                        value={formData.presentAddr1}
                                        onChange={e => handleChange('presentAddr1', e.target.value)}
                                        onBlur={() => touchField('presentAddr1')}
                                        required
                                    />
                                    <FieldError fieldKey="presentAddr1" />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_city", "City")} <span className={styles.required}>*</span></span>
                                    <input
                                        className={ic('presentCity')}
                                        placeholder={t("components.Workspace.EmployeeCreationWizard.placeholder_eg_bangalore", "e.g. Bangalore")}
                                        value={formData.presentCity}
                                        onChange={e => handleChange('presentCity', e.target.value)}
                                        onBlur={() => touchField('presentCity')}
                                        required
                                    />
                                    <FieldError fieldKey="presentCity" />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_state", "State")} <span className={styles.required}>*</span></span>
                                    <select className={sc('presentState')} value={formData.presentState} onChange={e => handleChange('presentState', e.target.value)} onBlur={() => touchField('presentState')}>
                                        <option value="">{t("components.Workspace.EmployeeCreationWizard.text_select_state", "Select State")}</option>
                                        <option value="KA">{t("components.Workspace.EmployeeCreationWizard.text_karnataka", "Karnataka")}</option>
                                        <option value="MH">{t("components.Workspace.EmployeeCreationWizard.text_maharashtra", "Maharashtra")}</option>
                                        <option value="DL">{t("components.Workspace.EmployeeCreationWizard.text_delhi", "Delhi")}</option>
                                        <option value="TN">{t("components.Workspace.EmployeeCreationWizard.text_tamil_nadu", "Tamil Nadu")}</option>
                                        <option value="TS">{t("components.Workspace.EmployeeCreationWizard.text_telangana", "Telangana")}</option>
                                        <option value="GJ">{t("components.Workspace.EmployeeCreationWizard.text_gujarat", "Gujarat")}</option>
                                        <option value="WB">{t("components.Workspace.EmployeeCreationWizard.text_west_bengal", "West Bengal")}</option>
                                        <option value="UP">{t("components.Workspace.EmployeeCreationWizard.text_uttar_pradesh", "Uttar Pradesh")}</option>
                                        <option value="HR">{t("components.Workspace.EmployeeCreationWizard.text_haryana", "Haryana")}</option>
                                    </select>
                                    <FieldError fieldKey="presentState" />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_pin_code", "PIN Code")} <span className={styles.required}>*</span></span>
                                    <input
                                        className={ic('presentPin')}
                                        maxLength={6}
                                        placeholder={t("components.Workspace.EmployeeCreationWizard.placeholder_560001", "560001")}
                                        value={formData.presentPin}
                                        onChange={e => handleChange('presentPin', e.target.value.replace(/\D/g, ''))}
                                        onBlur={() => touchField('presentPin')}
                                        required
                                    />
                                    <FieldError fieldKey="presentPin" />
                                    <span className={styles.formatHint}>{t("components.Workspace.EmployeeCreationWizard.text_6-digit_postal_code_eg_560001", "6-digit postal code (e.g. 560001)")}</span>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: STATUTORY & BANK */}
                    {activeTab === 3 && (
                        <div className={styles.sectionGroup}>
                            <TabErrorBanner tabNum={3} />
                            <div className={styles.sectionTitle}>{t("components.Workspace.EmployeeCreationWizard.text_statutory_numbers_tax_identification", "Statutory Numbers & Tax Identification")}</div>
                            <div className={styles.formGrid}>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_aadhaar_number_12_digit", "Aadhaar Number (12 digit)")}</span>
                                    <input
                                        className={ic('aadhaarToken')}
                                        maxLength={12}
                                        placeholder={t("components.Workspace.EmployeeCreationWizard.placeholder_123456789012", "123456789012")}
                                        value={formData.aadhaarToken}
                                        onChange={e => handleChange('aadhaarToken', e.target.value.replace(/\D/g, ''))}
                                        onBlur={() => touchField('aadhaarToken')}
                                    />
                                    <FieldError fieldKey="aadhaarToken" />
                                    <span className={styles.formatHint}>{t("components.Workspace.EmployeeCreationWizard.text_12_numeric_digits_without_spaces", "12 numeric digits without spaces")}</span>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_pan_number_10_char", "PAN Number (10 char)")}</span>
                                    <input
                                        className={ic('panToken')}
                                        maxLength={10}
                                        placeholder={t("components.Workspace.EmployeeCreationWizard.placeholder_abcde1234f", "ABCDE1234F")}
                                        value={formData.panToken}
                                        onChange={e => handleChange('panToken', e.target.value.toUpperCase())}
                                        onBlur={() => touchField('panToken')}
                                    />
                                    <FieldError fieldKey="panToken" />
                                    <span className={styles.formatHint}>{t("components.Workspace.EmployeeCreationWizard.text_format_5_letters_4_digits_1_letter_eg_ab", "Format: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)")}</span>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_uan_universal_account_no", "UAN (Universal Account No)")}</span>
                                    <input
                                        className={ic('uan')}
                                        maxLength={12}
                                        placeholder={t("components.Workspace.EmployeeCreationWizard.placeholder_100123456789", "100123456789")}
                                        value={formData.uan}
                                        onChange={e => handleChange('uan', e.target.value.replace(/\D/g, ''))}
                                        onBlur={() => touchField('uan')}
                                    />
                                    <FieldError fieldKey="uan" />
                                    <span className={styles.formatHint}>{t("components.Workspace.EmployeeCreationWizard.text_12_numeric_digits", "12 numeric digits")}</span>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_esi_ip_number_17_digit", "ESI IP Number (17 digit)")}</span>
                                    <input
                                        className={ic('esiIp')}
                                        maxLength={17}
                                        placeholder={t("components.Workspace.EmployeeCreationWizard.placeholder_31000123450001234", "31000123450001234")}
                                        value={formData.esiIp}
                                        onChange={e => handleChange('esiIp', e.target.value.replace(/\D/g, ''))}
                                        onBlur={() => touchField('esiIp')}
                                    />
                                    <FieldError fieldKey="esiIp" />
                                    <span className={styles.formatHint}>{t("components.Workspace.EmployeeCreationWizard.text_17_numeric_digits", "17 numeric digits")}</span>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_passport_number", "Passport Number")}</span>
                                    <input className={styles.input} placeholder={t("components.Workspace.EmployeeCreationWizard.placeholder_eg_z1234567", "e.g. Z1234567")} value={formData.passportToken} onChange={e => handleChange('passportToken', e.target.value.toUpperCase())} />
                                </label>
                            </div>

                            <div className={styles.sectionTitle} style={{ marginTop: '1rem' }}>{t("components.Workspace.EmployeeCreationWizard.text_bank_disbursement_details", "Bank Disbursement Details")}</div>
                            <div className={styles.formGrid}>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_bank_name", "Bank Name")} <span className={styles.required}>*</span></span>
                                    <input
                                        className={ic('bankName')}
                                        placeholder={t("components.Workspace.EmployeeCreationWizard.placeholder_eg_hdfc_bank_icici_bank_sbi", "e.g. HDFC Bank, ICICI Bank, SBI")}
                                        value={formData.bankName}
                                        onChange={e => handleChange('bankName', e.target.value)}
                                        onBlur={() => touchField('bankName')}
                                        required
                                    />
                                    <FieldError fieldKey="bankName" />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_ifsc_code", "IFSC Code")} <span className={styles.required}>*</span></span>
                                    <input
                                        className={ic('ifsc')}
                                        maxLength={11}
                                        placeholder={t("components.Workspace.EmployeeCreationWizard.placeholder_hdfc0000123", "HDFC0000123")}
                                        value={formData.ifsc}
                                        onChange={e => handleChange('ifsc', e.target.value.toUpperCase())}
                                        onBlur={() => touchField('ifsc')}
                                        required
                                    />
                                    <FieldError fieldKey="ifsc" />
                                    <span className={styles.formatHint}>{t("components.Workspace.EmployeeCreationWizard.text_format_4_letters_0_6_characters_eg_hdfc0", "Format: 4 letters, 0, 6 characters (e.g. HDFC0000123)")}</span>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_account_number_tokenised", "Account Number (Tokenised)")} <span className={styles.required}>*</span></span>
                                    <input
                                        type="password"
                                        className={ic('accountToken')}
                                        placeholder={t("components.Workspace.EmployeeCreationWizard.placeholder_enter_918_digit_account_number", "Enter 9–18 digit account number")}
                                        value={formData.accountToken}
                                        onChange={e => handleChange('accountToken', e.target.value)}
                                        onBlur={() => touchField('accountToken')}
                                        required
                                    />
                                    <FieldError fieldKey="accountToken" />
                                    <span className={styles.formatHint}>{t("components.Workspace.EmployeeCreationWizard.text_between_9_and_18_digits", "Between 9 and 18 digits")}</span>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_confirm_account_number", "Confirm Account Number")} <span className={styles.required}>*</span></span>
                                    <input
                                        type="password"
                                        className={ic('accountConfirm')}
                                        placeholder={t("components.Workspace.EmployeeCreationWizard.placeholder_re-enter_account_number", "Re-enter account number")}
                                        value={formData.accountConfirm}
                                        onChange={e => handleChange('accountConfirm', e.target.value)}
                                        onBlur={() => touchField('accountConfirm')}
                                        required
                                    />
                                    <FieldError fieldKey="accountConfirm" />
                                    <span className={styles.formatHint}>{t("components.Workspace.EmployeeCreationWizard.text_must_match_account_number_exactly", "Must match Account Number exactly")}</span>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_account_type", "Account Type")} <span className={styles.required}>*</span></span>
                                    <select
                                        className={sc('accountType')}
                                        value={formData.accountType}
                                        onChange={e => handleChange('accountType', e.target.value)}
                                        onBlur={() => touchField('accountType')}
                                        required
                                    >
                                        <option value="Savings">{t("components.Workspace.EmployeeCreationWizard.text_savings", "Savings")}</option>
                                        <option value="Current">{t("components.Workspace.EmployeeCreationWizard.text_current", "Current")}</option>
                                        <option value="Salary">{t("components.Workspace.EmployeeCreationWizard.text_salary", "Salary")}</option>
                                    </select>
                                    <FieldError fieldKey="accountType" />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_payment_mode", "Payment Mode")}</span>
                                    <select className={styles.select} value={formData.paymentMode} onChange={e => handleChange('paymentMode', e.target.value)}>
                                        <option value="Bank Transfer">{t("components.Workspace.EmployeeCreationWizard.text_bank_transfer", "Bank Transfer")}</option>
                                        <option value="Cheque">{t("components.Workspace.EmployeeCreationWizard.text_cheque", "Cheque")}</option>
                                        <option value="Cash">{t("components.Workspace.EmployeeCreationWizard.text_cash", "Cash")}</option>
                                    </select>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* TAB 4: FAMILY & NOMINEES */}
                    {activeTab === 4 && (
                        <div className={styles.sectionGroup}>
                            <TabErrorBanner tabNum={4} />
                            <div className={styles.sectionTitle}>{t("components.Workspace.EmployeeCreationWizard.text_dependants_medical_benefits", "Dependants (Medical & Benefits)")}</div>
                            <table className={styles.repeatingTable}>
                                <thead>
                                    <tr>
                                        <th>{t("components.Workspace.EmployeeCreationWizard.text_name", "Name")}</th><th>{t("components.Workspace.EmployeeCreationWizard.text_relation", "Relation")}</th><th>{t("components.Workspace.EmployeeCreationWizard.text_dob", "DOB")}</th><th>{t("components.Workspace.EmployeeCreationWizard.text_gender", "Gender")}</th><th>{t("components.Workspace.EmployeeCreationWizard.text_insurance", "Insurance")}</th><th>{t("components.Workspace.EmployeeCreationWizard.text_action", "Action")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {formData.dependants.map((dep, idx) => (
                                        <tr key={idx}>
                                            <td><input className={styles.input} value={dep.name} onChange={e => updateRow('dependants', idx, 'name', e.target.value)} placeholder={t("components.Workspace.EmployeeCreationWizard.placeholder_dependant_name", "Dependant Name")} /></td>
                                            <td>
                                                <select className={styles.select} value={dep.relation} onChange={e => updateRow('dependants', idx, 'relation', e.target.value)}>
                                                    <option>{t("components.Workspace.EmployeeCreationWizard.text_spouse", "Spouse")}</option><option>{t("components.Workspace.EmployeeCreationWizard.text_child", "Child")}</option><option>{t("components.Workspace.EmployeeCreationWizard.text_father", "Father")}</option><option>{t("components.Workspace.EmployeeCreationWizard.text_mother", "Mother")}</option>
                                                </select>
                                            </td>
                                            <td><input type="date" className={styles.input} value={dep.dob} onChange={e => updateRow('dependants', idx, 'dob', e.target.value)} /></td>
                                            <td>
                                                <select className={styles.select} value={dep.gender} onChange={e => updateRow('dependants', idx, 'gender', e.target.value)}>
                                                    <option>{t("components.Workspace.EmployeeCreationWizard.text_male", "Male")}</option><option>{t("components.Workspace.EmployeeCreationWizard.text_female", "Female")}</option>
                                                </select>
                                            </td>
                                            <td>
                                                <input type="checkbox" checked={dep.insured} onChange={e => updateRow('dependants', idx, 'insured', e.target.checked)} />
                                            </td>
                                            <td>
                                                <button type="button" className={styles.removeBtn} onClick={() => removeRow('dependants', idx)}><Trash2 size={13} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <button type="button" className={styles.addBtn} onClick={() => addRow('dependants', { name: '', relation: 'Child', dob: '', gender: 'Male', insured: true })}>
                                <Plus size={14} />  {t("components.Workspace.EmployeeCreationWizard.text_add_dependant_row", "Add Dependant Row")}
                            </button>

                            <div className={styles.sectionTitle} style={{ marginTop: '1.5rem' }}>{t("components.Workspace.EmployeeCreationWizard.text_statutory_nominees_pf_gratuity_insurance", "Statutory Nominees (PF, Gratuity, Insurance)")}</div>
                            <table className={styles.repeatingTable}>
                                <thead>
                                    <tr>
                                        <th>{t("components.Workspace.EmployeeCreationWizard.text_nominee_name", "Nominee Name")}</th><th>{t("components.Workspace.EmployeeCreationWizard.text_relation", "Relation")}</th><th>{t("components.Workspace.EmployeeCreationWizard.text_dob", "DOB")}</th><th>{t("components.Workspace.EmployeeCreationWizard.text_share", "Share %")}</th><th>{t("components.Workspace.EmployeeCreationWizard.text_scheme", "Scheme")}</th><th>{t("components.Workspace.EmployeeCreationWizard.text_action", "Action")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {formData.nominees.map((nom, idx) => (
                                        <tr key={idx}>
                                            <td><input className={styles.input} value={nom.name} onChange={e => updateRow('nominees', idx, 'name', e.target.value)} placeholder={t("components.Workspace.EmployeeCreationWizard.placeholder_nominee_name", "Nominee Name")} /></td>
                                            <td>
                                                <select className={styles.select} value={nom.relation} onChange={e => updateRow('nominees', idx, 'relation', e.target.value)}>
                                                    <option>{t("components.Workspace.EmployeeCreationWizard.text_spouse", "Spouse")}</option><option>{t("components.Workspace.EmployeeCreationWizard.text_child", "Child")}</option><option>{t("components.Workspace.EmployeeCreationWizard.text_father", "Father")}</option><option>{t("components.Workspace.EmployeeCreationWizard.text_mother", "Mother")}</option>
                                                </select>
                                            </td>
                                            <td><input type="date" className={styles.input} value={nom.dob} onChange={e => updateRow('nominees', idx, 'dob', e.target.value)} /></td>
                                            <td><input type="number" className={styles.input} style={{ width: '80px' }} value={nom.sharePercent} onChange={e => updateRow('nominees', idx, 'sharePercent', parseFloat(e.target.value) || 0)} /></td>
                                            <td>
                                                <select className={styles.select} value={nom.scheme} onChange={e => updateRow('nominees', idx, 'scheme', e.target.value)}>
                                                    <option>{t("components.Workspace.EmployeeCreationWizard.text_pf", "PF")}</option><option>{t("components.Workspace.EmployeeCreationWizard.text_gratuity", "Gratuity")}</option><option>{t("components.Workspace.EmployeeCreationWizard.text_insurance", "Insurance")}</option><option>{t("components.Workspace.EmployeeCreationWizard.text_all", "All")}</option>
                                                </select>
                                            </td>
                                            <td>
                                                <button type="button" className={styles.removeBtn} onClick={() => removeRow('nominees', idx)}><Trash2 size={13} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <button type="button" className={styles.addBtn} onClick={() => addRow('nominees', { name: '', relation: 'Spouse', dob: '', sharePercent: 100, scheme: 'PF', guardianName: '', address: '' })}>
                                <Plus size={14} />  {t("components.Workspace.EmployeeCreationWizard.text_add_nominee_row", "Add Nominee Row")}
                            </button>
                        </div>
                    )}

                    {/* TAB 5: EDUCATION & EXPERIENCE */}
                    {activeTab === 5 && (
                        <div className={styles.sectionGroup}>
                            <TabErrorBanner tabNum={5} />
                            <div className={styles.sectionTitle}>{t("components.Workspace.EmployeeCreationWizard.text_education_qualifications", "Education Qualifications")}</div>
                            <table className={styles.repeatingTable}>
                                <thead>
                                    <tr>
                                        <th>{t("components.Workspace.EmployeeCreationWizard.text_level", "Level")}</th><th>{t("components.Workspace.EmployeeCreationWizard.text_degree", "Degree")}</th><th>{t("components.Workspace.EmployeeCreationWizard.text_institute_board", "Institute / Board")}</th><th>{t("components.Workspace.EmployeeCreationWizard.text_year", "Year")}</th><th>{t("components.Workspace.EmployeeCreationWizard.text_score", "Score")}</th><th>{t("components.Workspace.EmployeeCreationWizard.text_action", "Action")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {formData.education.map((edu, idx) => (
                                        <tr key={idx}>
                                            <td>
                                                <select className={styles.select} value={edu.level} onChange={e => updateRow('education', idx, 'level', e.target.value)}>
                                                    {(getPicklistOptions('PL_EDU_LEVEL').length > 0 ? getPicklistOptions('PL_EDU_LEVEL') : [{value: 'High School', label: 'High School'}, {value: 'Diploma', label: 'Diploma'}, {value: "Bachelor's", label: "Bachelor's"}, {value: "Master's", label: "Master's"}, {value: 'Doctorate', label: 'Doctorate'}]).map(opt => (
                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td><input className={styles.input} value={edu.degree} onChange={e => updateRow('education', idx, 'degree', e.target.value)} placeholder={t("components.Workspace.EmployeeCreationWizard.placeholder_btech", "B.Tech")} /></td>
                                            <td><input className={styles.input} value={edu.institute} onChange={e => updateRow('education', idx, 'institute', e.target.value)} placeholder={t("components.Workspace.EmployeeCreationWizard.placeholder_university_name", "University Name")} /></td>
                                            <td><input className={styles.input} style={{ width: '80px' }} value={edu.passingYear} onChange={e => updateRow('education', idx, 'passingYear', e.target.value)} placeholder={t("components.Workspace.EmployeeCreationWizard.placeholder_2022", "2022")} /></td>
                                            <td><input className={styles.input} style={{ width: '90px' }} value={edu.score} onChange={e => updateRow('education', idx, 'score', e.target.value)} placeholder={t("components.Workspace.EmployeeCreationWizard.placeholder_85_cgpa", "8.5 CGPA")} /></td>
                                            <td><button type="button" className={styles.removeBtn} onClick={() => removeRow('education', idx)}><Trash2 size={13} /></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <button type="button" className={styles.addBtn} onClick={() => addRow('education', { level: "Bachelor's", degree: '', institute: '', passingYear: '', score: '' })}>
                                <Plus size={14} />  {t("components.Workspace.EmployeeCreationWizard.text_add_qualification", "Add Qualification")}
                            </button>

                            <div className={styles.sectionTitle} style={{ marginTop: '1.5rem' }}>{t("components.Workspace.EmployeeCreationWizard.text_prior_experience_history", "Prior Experience History")}</div>
                            <table className={styles.repeatingTable}>
                                <thead>
                                    <tr>
                                        <th>{t("components.Workspace.EmployeeCreationWizard.text_previous_employer", "Previous Employer")}</th><th>{t("components.Workspace.EmployeeCreationWizard.text_designation", "Designation")}</th><th>{t("components.Workspace.EmployeeCreationWizard.text_from_date", "From Date")}</th><th>{t("components.Workspace.EmployeeCreationWizard.text_to_date", "To Date")}</th><th>{t("components.Workspace.EmployeeCreationWizard.text_prev_uan", "Prev UAN")}</th><th>{t("components.Workspace.EmployeeCreationWizard.text_action", "Action")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {formData.experience.map((exp, idx) => (
                                        <tr key={idx}>
                                            <td><input className={styles.input} value={exp.employer} onChange={e => updateRow('experience', idx, 'employer', e.target.value)} placeholder={t("components.Workspace.EmployeeCreationWizard.placeholder_company_ltd", "Company Ltd")} /></td>
                                            <td><input className={styles.input} value={exp.designation} onChange={e => updateRow('experience', idx, 'designation', e.target.value)} placeholder={t("components.Workspace.EmployeeCreationWizard.placeholder_sr_engineer", "Sr Engineer")} /></td>
                                            <td><input type="date" className={styles.input} value={exp.fromDate} onChange={e => updateRow('experience', idx, 'fromDate', e.target.value)} /></td>
                                            <td><input type="date" className={styles.input} value={exp.toDate} onChange={e => updateRow('experience', idx, 'toDate', e.target.value)} /></td>
                                            <td><input className={styles.input} value={exp.prevUan} onChange={e => updateRow('experience', idx, 'prevUan', e.target.value)} placeholder={t("components.Workspace.EmployeeCreationWizard.placeholder_100", "100...")} /></td>
                                            <td><button type="button" className={styles.removeBtn} onClick={() => removeRow('experience', idx)}><Trash2 size={13} /></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <button type="button" className={styles.addBtn} onClick={() => addRow('experience', { employer: '', designation: '', fromDate: '', toDate: '', prevUan: '' })}>
                                <Plus size={14} />  {t("components.Workspace.EmployeeCreationWizard.text_add_experience_row", "Add Experience Row")}
                            </button>
                        </div>
                    )}

                    {/* TAB 6: MEDICAL, SITE & PLACEMENT */}
                    {activeTab === 6 && (
                        <div className={styles.sectionGroup}>
                            <TabErrorBanner tabNum={6} />
                            <div className={styles.sectionTitle}>{t("components.Workspace.EmployeeCreationWizard.text_assignment_placement_details", "Assignment & Placement Details")}</div>
                            <div className={styles.formGrid}>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_department", "Department")} <span className={styles.required}>*</span></span>
                                    <select className={sc('department')} value={formData.department} onChange={e => handleChange('department', e.target.value)} onBlur={() => touchField('department')}>
                                        <option value="">{t("components.Workspace.EmployeeCreationWizard.text_select_department", "Select Department")}</option>
                                        {Array.from(new Set([
                                            ...existingEmployees.map(e => e.dept || e.department).filter(Boolean),
                                            'Engineering', 'Product', 'Human Resources', 'Finance', 'Operations', 'Quality', 'Production', 'Maintenance', 'Safety', 'Purchase'
                                        ])).map(dept => (
                                            <option key={dept} value={dept}>{dept}</option>
                                        ))}
                                    </select>
                                    <FieldError fieldKey="department" />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_designation", "Designation")} <span className={styles.required}>*</span></span>
                                    <input className={ic('designation')} placeholder={t("components.Workspace.EmployeeCreationWizard.placeholder_eg_senior_software_engineer", "e.g. Senior Software Engineer")} value={formData.designation} onChange={e => handleChange('designation', e.target.value)} onBlur={() => touchField('designation')} required />
                                    <FieldError fieldKey="designation" />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_date_of_joining", "Date of Joining")} <span className={styles.required}>*</span></span>
                                    <input type="date" className={ic('joiningDate')} value={formData.joiningDate} onChange={e => handleChange('joiningDate', e.target.value)} onBlur={() => touchField('joiningDate')} required />
                                    <FieldError fieldKey="joiningDate" />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_reporting_manager", "Reporting Manager")} <span className={styles.required}>*</span></span>
                                    <select
                                        className={sc('manager')}
                                        value={isCustomManager ? '__CUSTOM__' : (formData.manager || '')}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val === '__CUSTOM__') {
                                                setIsCustomManager(true);
                                            } else {
                                                setIsCustomManager(false);
                                                handleChange('manager', val);
                                            }
                                        }}
                                        onBlur={() => touchField('manager')}
                                        required
                                    >
                                        <option value="">{t("components.Workspace.EmployeeCreationWizard.text_select_reporting_manager", "Select Reporting Manager")}</option>
                                        {managerOptions.map(m => (
                                            <option key={m.value} value={m.value}>
                                                {m.label}
                                            </option>
                                        ))}
                                        <option value="__CUSTOM__">{t("components.Workspace.EmployeeCreationWizard.text_add_other_custom_manager", "+ Add Other / Custom Manager...")}</option>
                                    </select>
                                    {isCustomManager && (
                                        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                                            <input
                                                className={styles.input}
                                                placeholder={t("components.Workspace.EmployeeCreationWizard.placeholder_enter_manager_name_or_employee_code", "Enter Manager Name or Employee Code")}
                                                value={customManagerText}
                                                onChange={e => {
                                                    const text = e.target.value;
                                                    setCustomManagerText(text);
                                                    handleChange('manager', text);
                                                }}
                                                autoFocus
                                            />
                                            <button
                                                type="button"
                                                className={styles.btnSecondary}
                                                style={{ whiteSpace: 'nowrap' }}
                                                onClick={() => {
                                                    setIsCustomManager(false);
                                                    handleChange('manager', '');
                                                }}
                                            >
                                                
                                                {t("components.Workspace.EmployeeCreationWizard.text_from_list", "From List")}
                                            </button>
                                        </div>
                                    )}
                                    <FieldError fieldKey="manager" />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_work_location", "Work Location")} <span className={styles.required}>*</span></span>
                                    <select className={sc('location')} value={formData.location} onChange={e => handleChange('location', e.target.value)} onBlur={() => touchField('location')} required>
                                        <option value="">{t("components.Workspace.EmployeeCreationWizard.text_select_work_location", "Select Work Location")}</option>
                                        {Array.from(new Set([
                                            ...existingEmployees.map(e => e.location).filter(Boolean),
                                            'Bangalore Plant', 'Mumbai Corporate HQ', 'Delhi Logistics Hub', 'Pune Factory', 'Chennai Office'
                                        ])).map(loc => (
                                            <option key={loc} value={loc}>{loc}</option>
                                        ))}
                                    </select>
                                    <FieldError fieldKey="location" />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_worker_class", "Worker Class")} <span className={styles.required}>*</span></span>
                                    <select className={sc('workerClass')} value={formData.workerClass} onChange={e => handleChange('workerClass', e.target.value)} onBlur={() => touchField('workerClass')} required>
                                        <option value="">{t("components.Workspace.EmployeeCreationWizard.text_select_worker_class", "Select Worker Class")}</option>
                                        <option value="Permanent Full-Time">{t("components.Workspace.EmployeeCreationWizard.text_permanent_full-time", "Permanent Full-Time")}</option>
                                        <option value="Probationer">{t("components.Workspace.EmployeeCreationWizard.text_probationer", "Probationer")}</option>
                                        <option value="Contractor">{t("components.Workspace.EmployeeCreationWizard.text_contractor", "Contractor")}</option>
                                        <option value="Trainee">{t("components.Workspace.EmployeeCreationWizard.text_trainee", "Trainee")}</option>
                                    </select>
                                    <FieldError fieldKey="workerClass" />
                                </label>
                            </div>

                            {/* Labour Law & OT Classification */}
                            <div className={styles.sectionTitle} style={{ marginTop: '1rem' }}>{t("components.Workspace.EmployeeCreationWizard.text_labour_law_ot_classification", "Labour Law & OT Classification")}</div>
                            <div className={styles.formGrid}>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_worker_category", "Worker Category")}</span>
                                    <select className={styles.select} value={formData.workerCategory} onChange={e => {
                                        const cat = e.target.value;
                                        handleChange('workerCategory', cat);
                                        // Auto-set rest day eligibility based on category
                                        if (cat === 'CONTRACT' || cat === 'THIRD_PARTY_HELPER') handleChange('hasRestDays', false);
                                        else handleChange('hasRestDays', true);
                                        if (cat === 'TRAINEE_DET' || cat === 'TRAINEE_GET') { handleChange('isTrainee', true); handleChange('traineeType', cat === 'TRAINEE_DET' ? 'DET' : 'GET'); }
                                        else { handleChange('isTrainee', false); handleChange('traineeType', ''); }
                                    }}>
                                        <option value="">{t("components.Workspace.EmployeeCreationWizard.text_select_worker_category", "Select Worker Category")}</option>
                                        <option value="PERM">{t("components.Workspace.EmployeeCreationWizard.text_permanent_employee", "Permanent Employee")}</option>
                                        <option value="CONTRACT">{t("components.Workspace.EmployeeCreationWizard.text_contractual_daily_wage_no_rest_day", "Contractual (Daily Wage — No Rest Day)")}</option>
                                        <option value="THIRD_PARTY_EMP">{t("components.Workspace.EmployeeCreationWizard.text_3rd_party_employee_with_rest_days", "3rd Party Employee (With Rest Days)")}</option>
                                        <option value="THIRD_PARTY_HELPER">{t("components.Workspace.EmployeeCreationWizard.text_3rd_party_helper_no_rest_days", "3rd Party Helper (No Rest Days)")}</option>
                                        <option value="TRAINEE_DET">{t("components.Workspace.EmployeeCreationWizard.text_trainee_det_graduate_engineer", "Trainee — DET (Graduate Engineer)")}</option>
                                        <option value="TRAINEE_GET">{t("components.Workspace.EmployeeCreationWizard.text_trainee_get_diploma_engineer", "Trainee — GET (Diploma Engineer)")}</option>
                                    </select>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_rest_day_eligibility", "Rest Day Eligibility")}</span>
                                    <select className={styles.select} value={formData.hasRestDays ? 'YES' : 'NO'} onChange={e => handleChange('hasRestDays', e.target.value === 'YES')}>
                                        <option value="YES">{t("components.Workspace.EmployeeCreationWizard.text_yes_weekly_off_applies", "Yes — Weekly Off Applies")}</option>
                                        <option value="NO">{t("components.Workspace.EmployeeCreationWizard.text_no_paid_for_all_working_days", "No — Paid for All Working Days")}</option>
                                    </select>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_ot_eligibility", "OT Eligibility")}</span>
                                    <select className={styles.select} value={formData.otEligibility} onChange={e => handleChange('otEligibility', e.target.value)}>
                                        <option value="">{t("components.Workspace.EmployeeCreationWizard.text_select_ot_eligibility", "Select OT Eligibility")}</option>
                                        <option value="ALL_DAYS">{t("components.Workspace.EmployeeCreationWizard.text_all_days_regular_rest_days", "All Days (Regular + Rest Days)")}</option>
                                        <option value="REST_HOLIDAYS_ONLY">{t("components.Workspace.EmployeeCreationWizard.text_rest_days_amp_holidays_only", "Rest Days &amp; Holidays Only")}</option>
                                        <option value="NONE">{t("components.Workspace.EmployeeCreationWizard.text_not_eligible_for_ot", "Not Eligible for OT")}</option>
                                    </select>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_salary_location_scope", "Salary Location Scope")}</span>
                                    <select className={styles.select} value={formData.salaryLocationScope} onChange={e => handleChange('salaryLocationScope', e.target.value)}>
                                        <option value="">{t("components.Workspace.EmployeeCreationWizard.text_select_salary_location_scope", "Select Salary Location Scope")}</option>
                                        <option value="PLANT">{t("components.Workspace.EmployeeCreationWizard.text_plant_attendance_salary_at_plant", "Plant (Attendance + Salary at Plant)")}</option>
                                        <option value="HO">{t("components.Workspace.EmployeeCreationWizard.text_head_office_attendance_at_plant_salary_a", "Head Office (Attendance at Plant, Salary at HO)")}</option>
                                    </select>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_default_assigned_shift", "Default Assigned Shift")}</span>
                                    <select className={styles.select} value={formData.assignedShift} onChange={e => handleChange('assignedShift', e.target.value)}>
                                        <option value="">{t("components.Workspace.EmployeeCreationWizard.text_select_assigned_shift", "Select Assigned Shift")}</option>
                                        <option value="A">{t("components.Workspace.EmployeeCreationWizard.text_a_shift_0800_am_0800_pm_12_hrs", "A Shift (08:00 AM – 08:00 PM, 12 Hrs)")}</option>
                                        <option value="B">{t("components.Workspace.EmployeeCreationWizard.text_b_shift_0800_pm_0800_am_12_hrs", "B Shift (08:00 PM – 08:00 AM, 12 Hrs)")}</option>
                                        <option value="GENERAL">{t("components.Workspace.EmployeeCreationWizard.text_general_shift_0900_am_0600_pm_9_hrs", "General Shift (09:00 AM – 06:00 PM, 9 Hrs)")}</option>
                                        <option value="AUTO_DETECT">{t("components.Workspace.EmployeeCreationWizard.text_auto-detect_from_punch_time", "Auto-Detect from Punch Time")}</option>
                                    </select>
                                </label>
                            </div>

                            <div className={styles.sectionTitle} style={{ marginTop: '1rem' }}>{t("components.Workspace.EmployeeCreationWizard.text_site_amp_facilities", "Site &amp; Facilities")}</div>
                            <div className={styles.formGrid}>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_biometric_enrolment_id", "Biometric Enrolment ID")}</span>
                                    <input className={styles.input} placeholder={t("components.Workspace.EmployeeCreationWizard.placeholder_bio-9081", "BIO-9081")} value={formData.biometricEnrolId} onChange={e => handleChange('biometricEnrolId', e.target.value)} />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_access_card_number", "Access Card Number")}</span>
                                    <input className={styles.input} placeholder={t("components.Workspace.EmployeeCreationWizard.placeholder_ac-1029", "AC-1029")} value={formData.accessCardNo} onChange={e => handleChange('accessCardNo', e.target.value)} />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>{t("components.Workspace.EmployeeCreationWizard.text_locker_number", "Locker Number")}</span>
                                    <input className={styles.input} placeholder={t("components.Workspace.EmployeeCreationWizard.placeholder_l-402", "L-402")} value={formData.lockerNo} onChange={e => handleChange('lockerNo', e.target.value)} />
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Footer buttons */}
                    <div className={styles.footer}>
                        <div>
                            {activeTab > 1 ? (
                                <button type="button" className={styles.btnSecondary} onClick={() => setActiveTab(prev => prev - 1)}>
                                    <ArrowLeft size={16} style={{ display: 'inline', marginRight: '4px' }} />  {t("components.Workspace.EmployeeCreationWizard.text_back", "Back")}
                                </button>
                            ) : (
                                <button type="button" className={styles.btnSecondary} onClick={onClose}>
                                    <ArrowLeft size={16} style={{ display: 'inline', marginRight: '4px' }} />  {t("components.Workspace.EmployeeCreationWizard.text_back_to_directory", "Back to Directory")}
                                </button>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button type="button" className={styles.btnSecondary} onClick={onClose}>{t("components.Workspace.EmployeeCreationWizard.text_cancel", "Cancel")}</button>
                            {activeTab < 6 ? (
                                <button type="button" className={styles.btnPrimary} onClick={() => setActiveTab(prev => prev + 1)}>
                                    
                                    {t("components.Workspace.EmployeeCreationWizard.text_next_tab", "Next Tab")} <ArrowRight size={16} style={{ display: 'inline', marginLeft: '4px' }} />
                                </button>
                            ) : (
                                <button type="submit" className={styles.btnPrimary}>
                                    <CheckCircle2 size={16} style={{ display: 'inline', marginRight: '4px' }} /> {mode === 'edit' ? 'Save Changes' : 'Save & Onboard Employee'}
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </div>
        </FormErrorContext.Provider>
    );
}
