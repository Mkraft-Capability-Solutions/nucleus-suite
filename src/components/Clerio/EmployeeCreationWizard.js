"use client";
import React, { useState, useEffect } from 'react';
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
                    Please resolve {errorsInTab.length} required or invalid field{errorsInTab.length > 1 ? 's' : ''} in this tab:
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
    const { showToast } = useHRMS();
    const [activeTab, setActiveTab] = useState(1);
    const [formErrors, setFormErrors] = useState({});
    const [touchedFields, setTouchedFields] = useState({});
    const { isDuplicate, findDuplicate } = useDuplicateCheck(existingEmployees);

    // Form state covering all 12 sections of FRM-PPL-01
    const [formData, setFormData] = useState({
        // Section 1: Identity
        employeeCode: '',  // auto-generated on mount
        salutation: 'Mr',
        firstName: '',
        middleName: '',
        lastName: '',
        fullLegalName: '',
        nameAsPerBank: '',
        formerName: '',
        gender: 'Male',
        dateOfBirth: '',
        bloodGroup: 'O+',
        maritalStatus: 'Single',
        marriageDate: '',
        nationality: 'Indian',
        placeOfBirth: '',
        motherTongue: 'Hindi',
        socialCategory: 'General',
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
        emergencyRelation: 'Spouse',
        emergencyPhone: '',
        emergencySecondaryName: '',
        emergencySecondaryRelation: 'Parent',
        emergencySecondaryPhone: '',

        // Section 4: Address
        presentAddr1: '',
        presentAddr2: '',
        presentCity: '',
        presentDistrict: '',
        presentState: 'KA',
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
            { name: '', relation: 'Spouse', dob: '', gender: 'Female', insured: true }
        ],
        nominees: [
            { name: '', relation: 'Spouse', dob: '', sharePercent: 100, scheme: 'PF', guardianName: '', address: '' }
        ],

        // Section 8: Education (Repeating)
        education: [
            { level: 'B.Tech / B.E.', degree: 'Computer Science', institute: 'VTU University', passingYear: '2020', score: '8.5 CGPA' }
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
        department: 'Engineering',
        designation: 'Software Engineer',
        joiningDate: new Date().toISOString().split('T')[0],
        manager: 'Ananya Roy',
        location: 'Bangalore Plant',
        workerClass: 'Permanent Full-Time',
        status: 'Active',
        effectiveFrom: new Date().toISOString().split('T')[0],
        changeReason: 'New hire onboarding',

        // Section 13: Labour Law & OT Classification (Demo Points 2, 3, 4, 7, 8)
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
            const names = (initialData.name || '').split(' ');
            const first = names[0] || '';
            const last = names.slice(1).join(' ') || '';
            setFormData(prev => ({
                ...prev,
                employeeCode: initialData.id || prev.employeeCode,
                firstName: first || prev.firstName,
                lastName: last || prev.lastName,
                fullLegalName: initialData.name || prev.fullLegalName,
                nameAsPerBank: initialData.name || prev.nameAsPerBank,
                department: initialData.dept || initialData.department || prev.department,
                designation: initialData.role || initialData.designation || prev.designation,
                manager: initialData.manager || prev.manager,
                location: initialData.location || prev.location,
                workerClass: initialData.band || prev.workerClass,
                status: initialData.status || prev.status,
                accountToken: initialData.accountNumber || prev.accountToken || '987654321098',
                accountConfirm: initialData.accountNumber || prev.accountConfirm || '987654321098',
                pan: initialData.pan || prev.pan || 'ABCDE1234F',
                aadhaar: initialData.aadhaar || prev.aadhaar || '987654321098',
                uan: initialData.uan || prev.uan || '100123456789',
                mobilePhone: initialData.phone || prev.mobilePhone || '9876543210',
                personalEmail: initialData.personalEmail || prev.personalEmail || `${(first || 'emp').toLowerCase()}@gmail.com`,
                emergencyContactName: initialData.emergencyContact || prev.emergencyContactName || 'Family Member',
                emergencyContactPhone: initialData.emergencyPhone || prev.emergencyContactPhone || '9876511223',
                addressLine1: initialData.address || prev.addressLine1 || 'Tech Park Campus',
                city: initialData.city || prev.city || 'Bangalore',
                state: initialData.state || prev.state || 'Karnataka',
                pinCode: initialData.pinCode || prev.pinCode || '560100',
                bankName: initialData.bankName || prev.bankName || 'HDFC Bank',
                ifsc: initialData.ifsc || prev.ifsc || 'HDFC0000123',
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

    if (!isOpen) return null;

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

    const touchField = (key) => setTouchedFields(prev => ({ ...prev, [key]: true }));
    const getFieldError = (key) => touchedFields[key] ? formErrors[key] ?? '' : '';
    const ic = (key) => `${styles.input} ${getFieldError(key) ? styles.inputError : ''}`;
    const sc = (key) => `${styles.select} ${getFieldError(key) ? styles.inputError : ''}`;

    const tabErrorCount = (tabNum) => {
        const rules = TAB_RULES[tabNum] || [];
        return rules.filter(r => !!formErrors[r.key]).length;
    };

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
            details: formData
        };

        if (onSave) onSave(newEmployee);
        showToast(mode === 'edit' ? 'Employee Updated' : 'Employee Created', `${newEmployee.name} (${newEmployee.id}) ${mode === 'edit' ? 'updated' : 'created'} successfully.`, 'success');
        onClose();
    };

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
                    <button className={styles.closeBtn} onClick={onClose} type="button" title="Close"><X size={20} /></button>
                </div>

                {/* Tabs - Form Step Navigation fitting perfectly within modal window */}
                <div className={styles.tabs} role="tablist" aria-label="Employee Creation Wizard Steps">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 1}
                        title="1. Identity & Personal Attributes"
                        className={`${styles.tabBtn} ${activeTab === 1 ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab(1)}
                    >
                        <User size={14} className={styles.tabIcon} />
                        <span className={styles.tabLabel}>1. Identity</span>
                        {tabErrorCount(1) > 0 && <span className={styles.tabErrorBadge}>{tabErrorCount(1)}</span>}
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 2}
                        title="2. Contact & Address Details"
                        className={`${styles.tabBtn} ${activeTab === 2 ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab(2)}
                    >
                        <Phone size={14} className={styles.tabIcon} />
                        <span className={styles.tabLabel}>2. Contact</span>
                        {tabErrorCount(2) > 0 && <span className={styles.tabErrorBadge}>{tabErrorCount(2)}</span>}
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 3}
                        title="3. Statutory IDs & Bank Details"
                        className={`${styles.tabBtn} ${activeTab === 3 ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab(3)}
                    >
                        <Shield size={14} className={styles.tabIcon} />
                        <span className={styles.tabLabel}>3. Statutory</span>
                        {tabErrorCount(3) > 0 && <span className={styles.tabErrorBadge}>{tabErrorCount(3)}</span>}
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 4}
                        title="4. Family & Nominees"
                        className={`${styles.tabBtn} ${activeTab === 4 ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab(4)}
                    >
                        <Users size={14} className={styles.tabIcon} />
                        <span className={styles.tabLabel}>4. Family</span>
                        {tabErrorCount(4) > 0 && <span className={styles.tabErrorBadge}>{tabErrorCount(4)}</span>}
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 5}
                        title="5. Education & Work Experience"
                        className={`${styles.tabBtn} ${activeTab === 5 ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab(5)}
                    >
                        <GraduationCap size={14} className={styles.tabIcon} />
                        <span className={styles.tabLabel}>5. Education</span>
                        {tabErrorCount(5) > 0 && <span className={styles.tabErrorBadge}>{tabErrorCount(5)}</span>}
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 6}
                        title="6. Placement, Medical & Facilities Control"
                        className={`${styles.tabBtn} ${activeTab === 6 ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab(6)}
                    >
                        <Briefcase size={14} className={styles.tabIcon} />
                        <span className={styles.tabLabel}>6. Placement</span>
                        {tabErrorCount(6) > 0 && <span className={styles.tabErrorBadge}>{tabErrorCount(6)}</span>}
                    </button>
                </div>

                {/* Form Content Body */}
                <form onSubmit={handleSubmit} className={styles.body}>
                    {/* TAB 1: IDENTITY & PERSONAL */}
                    {activeTab === 1 && (
                        <div className={styles.sectionGroup}>
                            <TabErrorBanner tabNum={1} />
                            <div className={styles.sectionTitle}>Identity Attributes</div>
                            <div className={styles.formGrid}>
                                {/* Employee Code — Read Only, Auto-Generated */}
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>
                                        Employee Code
                                        <span className={styles.autoTag}><Lock size={11} /> Auto-assigned</span>
                                    </span>
                                    <div className={styles.readOnlyId}>
                                        <Lock size={13} />
                                        <span>{formData.employeeCode || 'Generating…'}</span>
                                    </div>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Salutation</span>
                                    <select className={styles.select} value={formData.salutation} onChange={e => handleChange('salutation', e.target.value)}>
                                        {(getPicklistOptions('PL_SALUTATION').length > 0 ? getPicklistOptions('PL_SALUTATION') : [{value: 'Mr', label: 'Mr'}, {value: 'Ms', label: 'Ms'}, {value: 'Mrs', label: 'Mrs'}, {value: 'Dr', label: 'Dr'}]).map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>First Name <span className={styles.required}>*</span></span>
                                    <input className={ic('firstName')} value={formData.firstName} onChange={e => updateFirstName(e.target.value)} onBlur={() => touchField('firstName')} required />
                                    <FieldError fieldKey="firstName" />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Middle Name</span>
                                    <input className={styles.input} value={formData.middleName} onChange={e => handleChange('middleName', e.target.value)} />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Last Name <span className={styles.required}>*</span></span>
                                    <input className={ic('lastName')} value={formData.lastName} onChange={e => updateLastName(e.target.value)} onBlur={() => touchField('lastName')} required />
                                    <FieldError fieldKey="lastName" />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Full Name (Aadhaar match)</span>
                                    <input className={styles.input} value={formData.fullLegalName} onChange={e => handleChange('fullLegalName', e.target.value)} />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Gender <span className={styles.required}>*</span></span>
                                    <select className={sc('gender')} value={formData.gender} onChange={e => handleChange('gender', e.target.value)} onBlur={() => touchField('gender')}>
                                        {(getPicklistOptions('PL_GENDER').length > 0 ? getPicklistOptions('PL_GENDER') : [{value: 'Male', label: 'Male'}, {value: 'Female', label: 'Female'}, {value: 'Other', label: 'Other'}]).map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                    <FieldError fieldKey="gender" />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Date of Birth <span className={styles.required}>*</span></span>
                                    <input type="date" className={ic('dateOfBirth')} value={formData.dateOfBirth} onChange={e => handleChange('dateOfBirth', e.target.value)} onBlur={() => touchField('dateOfBirth')} required />
                                    <FieldError fieldKey="dateOfBirth" />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Blood Group</span>
                                    <select className={styles.select} value={formData.bloodGroup} onChange={e => handleChange('bloodGroup', e.target.value)}>
                                        {(getPicklistOptions('PL_BLOOD_GROUP').length > 0 ? getPicklistOptions('PL_BLOOD_GROUP') : [{value: 'A+', label: 'A+'}, {value: 'A-', label: 'A-'}, {value: 'B+', label: 'B+'}, {value: 'B-', label: 'B-'}, {value: 'O+', label: 'O+'}, {value: 'O-', label: 'O-'}, {value: 'AB+', label: 'AB+'}, {value: 'AB-', label: 'AB-'}]).map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Marital Status</span>
                                    <select className={styles.select} value={formData.maritalStatus} onChange={e => handleChange('maritalStatus', e.target.value)}>
                                        {(getPicklistOptions('PL_MARITAL_STATUS').length > 0 ? getPicklistOptions('PL_MARITAL_STATUS') : [{value: 'Single', label: 'Single'}, {value: 'Married', label: 'Married'}, {value: 'Divorced', label: 'Divorced'}, {value: 'Widowed', label: 'Widowed'}]).map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </label>
                                {formData.maritalStatus === 'Married' && (
                                    <label className={styles.field}>
                                        <span className={styles.fieldLabel}>Marriage Date</span>
                                        <input type="date" className={styles.input} value={formData.marriageDate} onChange={e => handleChange('marriageDate', e.target.value)} />
                                    </label>
                                )}
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Nationality</span>
                                    <input className={styles.input} value={formData.nationality} onChange={e => handleChange('nationality', e.target.value)} />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Social Category</span>
                                    <select className={styles.select} value={formData.socialCategory} onChange={e => handleChange('socialCategory', e.target.value)}>
                                        {(getPicklistOptions('PL_SOCIAL_CAT').length > 0 ? getPicklistOptions('PL_SOCIAL_CAT') : [{value: 'General', label: 'General'}, {value: 'OBC', label: 'OBC'}, {value: 'SC', label: 'SC'}, {value: 'ST', label: 'ST'}]).map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            <div className={styles.sectionTitle} style={{ marginTop: '1rem' }}>Family Identity</div>
                            <div className={styles.formGrid}>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Father&apos;s Name</span>
                                    <input className={styles.input} value={formData.fatherName} onChange={e => handleChange('fatherName', e.target.value)} />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Mother&apos;s Name</span>
                                    <input className={styles.input} value={formData.motherName} onChange={e => handleChange('motherName', e.target.value)} />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Spouse Name</span>
                                    <input className={styles.input} value={formData.spouseName} onChange={e => handleChange('spouseName', e.target.value)} />
                                </label>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: CONTACT & ADDRESS */}
                    {activeTab === 2 && (
                        <div className={styles.sectionGroup}>
                            <TabErrorBanner tabNum={2} />
                            <div className={styles.sectionTitle}>Contact Info</div>
                            <div className={styles.formGrid}>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Primary Mobile (WhatsApp) <span className={styles.required}>*</span></span>
                                    <input
                                        className={ic('mobile')}
                                        maxLength={10}
                                        placeholder="9876543210"
                                        value={formData.mobile}
                                        onChange={e => handleChange('mobile', e.target.value.replace(/\D/g, ''))}
                                        onBlur={() => touchField('mobile')}
                                        required
                                    />
                                    <FieldError fieldKey="mobile" />
                                    <span className={styles.formatHint}>10-digit Indian mobile number (e.g. 9876543210)</span>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Official Email</span>
                                    <input type="email" className={styles.input} placeholder="name@company.com" value={formData.officialEmail} onChange={e => handleChange('officialEmail', e.target.value)} />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Personal Email <span className={styles.required}>*</span></span>
                                    <input
                                        type="email"
                                        className={ic('personalEmail')}
                                        placeholder="name@gmail.com"
                                        value={formData.personalEmail}
                                        onChange={e => handleChange('personalEmail', e.target.value)}
                                        onBlur={() => touchField('personalEmail')}
                                        required
                                    />
                                    <FieldError fieldKey="personalEmail" />
                                    <span className={styles.formatHint}>Format: name@domain.com</span>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Emergency Contact Name <span className={styles.required}>*</span></span>
                                    <input
                                        className={ic('emergencyName')}
                                        placeholder="Contact person full name"
                                        value={formData.emergencyName}
                                        onChange={e => handleChange('emergencyName', e.target.value)}
                                        onBlur={() => touchField('emergencyName')}
                                        required
                                    />
                                    <FieldError fieldKey="emergencyName" />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Emergency Relation</span>
                                    <input className={styles.input} value={formData.emergencyRelation} onChange={e => handleChange('emergencyRelation', e.target.value)} />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Emergency Phone <span className={styles.required}>*</span></span>
                                    <input
                                        className={ic('emergencyPhone')}
                                        maxLength={10}
                                        placeholder="9876543210"
                                        value={formData.emergencyPhone}
                                        onChange={e => handleChange('emergencyPhone', e.target.value.replace(/\D/g, ''))}
                                        onBlur={() => touchField('emergencyPhone')}
                                        required
                                    />
                                    <FieldError fieldKey="emergencyPhone" />
                                    <span className={styles.formatHint}>10-digit mobile number</span>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Secondary Emergency Name</span>
                                    <input className={styles.input} placeholder="Secondary contact name" value={formData.emergencySecondaryName || ''} onChange={e => handleChange('emergencySecondaryName', e.target.value)} />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Secondary Relation</span>
                                    <select className={styles.select} value={formData.emergencySecondaryRelation || 'Parent'} onChange={e => handleChange('emergencySecondaryRelation', e.target.value)}>
                                        <option value="Parent">Parent</option>
                                        <option value="Sibling">Sibling</option>
                                        <option value="Spouse">Spouse</option>
                                        <option value="Friend">Friend</option>
                                        <option value="Guardian">Guardian</option>
                                    </select>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Secondary Phone</span>
                                    <input className={styles.input} placeholder="9876543210" value={formData.emergencySecondaryPhone || ''} onChange={e => handleChange('emergencySecondaryPhone', e.target.value)} />
                                </label>
                            </div>

                            <div className={styles.sectionTitle} style={{ marginTop: '1rem' }}>Address Details</div>
                            <div className={styles.formGrid}>
                                <label className={styles.field} style={{ gridColumn: 'span 2' }}>
                                    <span className={styles.fieldLabel}>Present Address Line 1 <span className={styles.required}>*</span></span>
                                    <input
                                        className={ic('presentAddr1')}
                                        placeholder="Flat/House No, Street, Landmark"
                                        value={formData.presentAddr1}
                                        onChange={e => handleChange('presentAddr1', e.target.value)}
                                        onBlur={() => touchField('presentAddr1')}
                                        required
                                    />
                                    <FieldError fieldKey="presentAddr1" />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>City <span className={styles.required}>*</span></span>
                                    <input
                                        className={ic('presentCity')}
                                        placeholder="e.g. Bangalore"
                                        value={formData.presentCity}
                                        onChange={e => handleChange('presentCity', e.target.value)}
                                        onBlur={() => touchField('presentCity')}
                                        required
                                    />
                                    <FieldError fieldKey="presentCity" />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>State <span className={styles.required}>*</span></span>
                                    <select className={sc('presentState')} value={formData.presentState} onChange={e => handleChange('presentState', e.target.value)} onBlur={() => touchField('presentState')}>
                                        <option value="KA">Karnataka</option>
                                        <option value="MH">Maharashtra</option>
                                        <option value="DL">Delhi</option>
                                        <option value="TN">Tamil Nadu</option>
                                        <option value="TS">Telangana</option>
                                        <option value="GJ">Gujarat</option>
                                        <option value="WB">West Bengal</option>
                                        <option value="UP">Uttar Pradesh</option>
                                        <option value="HR">Haryana</option>
                                    </select>
                                    <FieldError fieldKey="presentState" />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>PIN Code <span className={styles.required}>*</span></span>
                                    <input
                                        className={ic('presentPin')}
                                        maxLength={6}
                                        placeholder="560001"
                                        value={formData.presentPin}
                                        onChange={e => handleChange('presentPin', e.target.value.replace(/\D/g, ''))}
                                        onBlur={() => touchField('presentPin')}
                                        required
                                    />
                                    <FieldError fieldKey="presentPin" />
                                    <span className={styles.formatHint}>6-digit postal code (e.g. 560001)</span>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: STATUTORY & BANK */}
                    {activeTab === 3 && (
                        <div className={styles.sectionGroup}>
                            <TabErrorBanner tabNum={3} />
                            <div className={styles.sectionTitle}>Statutory Numbers & Tax Identification</div>
                            <div className={styles.formGrid}>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Aadhaar Number (12 digit)</span>
                                    <input
                                        className={ic('aadhaarToken')}
                                        maxLength={12}
                                        placeholder="123456789012"
                                        value={formData.aadhaarToken}
                                        onChange={e => handleChange('aadhaarToken', e.target.value.replace(/\D/g, ''))}
                                        onBlur={() => touchField('aadhaarToken')}
                                    />
                                    <FieldError fieldKey="aadhaarToken" />
                                    <span className={styles.formatHint}>12 numeric digits without spaces</span>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>PAN Number (10 char)</span>
                                    <input
                                        className={ic('panToken')}
                                        maxLength={10}
                                        placeholder="ABCDE1234F"
                                        value={formData.panToken}
                                        onChange={e => handleChange('panToken', e.target.value.toUpperCase())}
                                        onBlur={() => touchField('panToken')}
                                    />
                                    <FieldError fieldKey="panToken" />
                                    <span className={styles.formatHint}>Format: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)</span>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>UAN (Universal Account No)</span>
                                    <input
                                        className={ic('uan')}
                                        maxLength={12}
                                        placeholder="100123456789"
                                        value={formData.uan}
                                        onChange={e => handleChange('uan', e.target.value.replace(/\D/g, ''))}
                                        onBlur={() => touchField('uan')}
                                    />
                                    <FieldError fieldKey="uan" />
                                    <span className={styles.formatHint}>12 numeric digits</span>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>ESI IP Number (17 digit)</span>
                                    <input
                                        className={ic('esiIp')}
                                        maxLength={17}
                                        placeholder="31000123450001234"
                                        value={formData.esiIp}
                                        onChange={e => handleChange('esiIp', e.target.value.replace(/\D/g, ''))}
                                        onBlur={() => touchField('esiIp')}
                                    />
                                    <FieldError fieldKey="esiIp" />
                                    <span className={styles.formatHint}>17 numeric digits</span>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Passport Number</span>
                                    <input className={styles.input} placeholder="e.g. Z1234567" value={formData.passportToken} onChange={e => handleChange('passportToken', e.target.value.toUpperCase())} />
                                </label>
                            </div>

                            <div className={styles.sectionTitle} style={{ marginTop: '1rem' }}>Bank Disbursement Details</div>
                            <div className={styles.formGrid}>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Bank Name <span className={styles.required}>*</span></span>
                                    <input
                                        className={ic('bankName')}
                                        placeholder="e.g. HDFC Bank, ICICI Bank, SBI"
                                        value={formData.bankName}
                                        onChange={e => handleChange('bankName', e.target.value)}
                                        onBlur={() => touchField('bankName')}
                                        required
                                    />
                                    <FieldError fieldKey="bankName" />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>IFSC Code <span className={styles.required}>*</span></span>
                                    <input
                                        className={ic('ifsc')}
                                        maxLength={11}
                                        placeholder="HDFC0000123"
                                        value={formData.ifsc}
                                        onChange={e => handleChange('ifsc', e.target.value.toUpperCase())}
                                        onBlur={() => touchField('ifsc')}
                                        required
                                    />
                                    <FieldError fieldKey="ifsc" />
                                    <span className={styles.formatHint}>Format: 4 letters, 0, 6 characters (e.g. HDFC0000123)</span>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Account Number (Tokenised) <span className={styles.required}>*</span></span>
                                    <input
                                        type="password"
                                        className={ic('accountToken')}
                                        placeholder="Enter 9–18 digit account number"
                                        value={formData.accountToken}
                                        onChange={e => handleChange('accountToken', e.target.value)}
                                        onBlur={() => touchField('accountToken')}
                                        required
                                    />
                                    <FieldError fieldKey="accountToken" />
                                    <span className={styles.formatHint}>Between 9 and 18 digits</span>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Confirm Account Number <span className={styles.required}>*</span></span>
                                    <input
                                        type="password"
                                        className={ic('accountConfirm')}
                                        placeholder="Re-enter account number"
                                        value={formData.accountConfirm}
                                        onChange={e => handleChange('accountConfirm', e.target.value)}
                                        onBlur={() => touchField('accountConfirm')}
                                        required
                                    />
                                    <FieldError fieldKey="accountConfirm" />
                                    <span className={styles.formatHint}>Must match Account Number exactly</span>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Account Type <span className={styles.required}>*</span></span>
                                    <select
                                        className={sc('accountType')}
                                        value={formData.accountType}
                                        onChange={e => handleChange('accountType', e.target.value)}
                                        onBlur={() => touchField('accountType')}
                                        required
                                    >
                                        <option value="Savings">Savings</option>
                                        <option value="Current">Current</option>
                                        <option value="Salary">Salary</option>
                                    </select>
                                    <FieldError fieldKey="accountType" />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Payment Mode</span>
                                    <select className={styles.select} value={formData.paymentMode} onChange={e => handleChange('paymentMode', e.target.value)}>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                        <option value="Cheque">Cheque</option>
                                        <option value="Cash">Cash</option>
                                    </select>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* TAB 4: FAMILY & NOMINEES */}
                    {activeTab === 4 && (
                        <div className={styles.sectionGroup}>
                            <TabErrorBanner tabNum={4} />
                            <div className={styles.sectionTitle}>Dependants (Medical & Benefits)</div>
                            <table className={styles.repeatingTable}>
                                <thead>
                                    <tr>
                                        <th>Name</th><th>Relation</th><th>DOB</th><th>Gender</th><th>Insurance</th><th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {formData.dependants.map((dep, idx) => (
                                        <tr key={idx}>
                                            <td><input className={styles.input} value={dep.name} onChange={e => updateRow('dependants', idx, 'name', e.target.value)} placeholder="Dependant Name" /></td>
                                            <td>
                                                <select className={styles.select} value={dep.relation} onChange={e => updateRow('dependants', idx, 'relation', e.target.value)}>
                                                    <option>Spouse</option><option>Child</option><option>Father</option><option>Mother</option>
                                                </select>
                                            </td>
                                            <td><input type="date" className={styles.input} value={dep.dob} onChange={e => updateRow('dependants', idx, 'dob', e.target.value)} /></td>
                                            <td>
                                                <select className={styles.select} value={dep.gender} onChange={e => updateRow('dependants', idx, 'gender', e.target.value)}>
                                                    <option>Male</option><option>Female</option>
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
                                <Plus size={14} /> Add Dependant Row
                            </button>

                            <div className={styles.sectionTitle} style={{ marginTop: '1.5rem' }}>Statutory Nominees (PF, Gratuity, Insurance)</div>
                            <table className={styles.repeatingTable}>
                                <thead>
                                    <tr>
                                        <th>Nominee Name</th><th>Relation</th><th>DOB</th><th>Share %</th><th>Scheme</th><th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {formData.nominees.map((nom, idx) => (
                                        <tr key={idx}>
                                            <td><input className={styles.input} value={nom.name} onChange={e => updateRow('nominees', idx, 'name', e.target.value)} placeholder="Nominee Name" /></td>
                                            <td>
                                                <select className={styles.select} value={nom.relation} onChange={e => updateRow('nominees', idx, 'relation', e.target.value)}>
                                                    <option>Spouse</option><option>Child</option><option>Father</option><option>Mother</option>
                                                </select>
                                            </td>
                                            <td><input type="date" className={styles.input} value={nom.dob} onChange={e => updateRow('nominees', idx, 'dob', e.target.value)} /></td>
                                            <td><input type="number" className={styles.input} style={{ width: '80px' }} value={nom.sharePercent} onChange={e => updateRow('nominees', idx, 'sharePercent', parseFloat(e.target.value) || 0)} /></td>
                                            <td>
                                                <select className={styles.select} value={nom.scheme} onChange={e => updateRow('nominees', idx, 'scheme', e.target.value)}>
                                                    <option>PF</option><option>Gratuity</option><option>Insurance</option><option>All</option>
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
                                <Plus size={14} /> Add Nominee Row
                            </button>
                        </div>
                    )}

                    {/* TAB 5: EDUCATION & EXPERIENCE */}
                    {activeTab === 5 && (
                        <div className={styles.sectionGroup}>
                            <TabErrorBanner tabNum={5} />
                            <div className={styles.sectionTitle}>Education Qualifications</div>
                            <table className={styles.repeatingTable}>
                                <thead>
                                    <tr>
                                        <th>Level</th><th>Degree</th><th>Institute / Board</th><th>Year</th><th>Score</th><th>Action</th>
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
                                            <td><input className={styles.input} value={edu.degree} onChange={e => updateRow('education', idx, 'degree', e.target.value)} placeholder="B.Tech" /></td>
                                            <td><input className={styles.input} value={edu.institute} onChange={e => updateRow('education', idx, 'institute', e.target.value)} placeholder="University Name" /></td>
                                            <td><input className={styles.input} style={{ width: '80px' }} value={edu.passingYear} onChange={e => updateRow('education', idx, 'passingYear', e.target.value)} placeholder="2022" /></td>
                                            <td><input className={styles.input} style={{ width: '90px' }} value={edu.score} onChange={e => updateRow('education', idx, 'score', e.target.value)} placeholder="8.5 CGPA" /></td>
                                            <td><button type="button" className={styles.removeBtn} onClick={() => removeRow('education', idx)}><Trash2 size={13} /></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <button type="button" className={styles.addBtn} onClick={() => addRow('education', { level: "Bachelor's", degree: '', institute: '', passingYear: '', score: '' })}>
                                <Plus size={14} /> Add Qualification
                            </button>

                            <div className={styles.sectionTitle} style={{ marginTop: '1.5rem' }}>Prior Experience History</div>
                            <table className={styles.repeatingTable}>
                                <thead>
                                    <tr>
                                        <th>Previous Employer</th><th>Designation</th><th>From Date</th><th>To Date</th><th>Prev UAN</th><th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {formData.experience.map((exp, idx) => (
                                        <tr key={idx}>
                                            <td><input className={styles.input} value={exp.employer} onChange={e => updateRow('experience', idx, 'employer', e.target.value)} placeholder="Company Ltd" /></td>
                                            <td><input className={styles.input} value={exp.designation} onChange={e => updateRow('experience', idx, 'designation', e.target.value)} placeholder="Sr Engineer" /></td>
                                            <td><input type="date" className={styles.input} value={exp.fromDate} onChange={e => updateRow('experience', idx, 'fromDate', e.target.value)} /></td>
                                            <td><input type="date" className={styles.input} value={exp.toDate} onChange={e => updateRow('experience', idx, 'toDate', e.target.value)} /></td>
                                            <td><input className={styles.input} value={exp.prevUan} onChange={e => updateRow('experience', idx, 'prevUan', e.target.value)} placeholder="100..." /></td>
                                            <td><button type="button" className={styles.removeBtn} onClick={() => removeRow('experience', idx)}><Trash2 size={13} /></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <button type="button" className={styles.addBtn} onClick={() => addRow('experience', { employer: '', designation: '', fromDate: '', toDate: '', prevUan: '' })}>
                                <Plus size={14} /> Add Experience Row
                            </button>
                        </div>
                    )}

                    {/* TAB 6: MEDICAL, SITE & PLACEMENT */}
                    {activeTab === 6 && (
                        <div className={styles.sectionGroup}>
                            <TabErrorBanner tabNum={6} />
                            <div className={styles.sectionTitle}>Assignment & Placement Details</div>
                            <div className={styles.formGrid}>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Department <span className={styles.required}>*</span></span>
                                    <select className={sc('department')} value={formData.department} onChange={e => handleChange('department', e.target.value)} onBlur={() => touchField('department')}>
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
                                    <span className={styles.fieldLabel}>Designation <span className={styles.required}>*</span></span>
                                    <input className={ic('designation')} placeholder="e.g. Senior Software Engineer" value={formData.designation} onChange={e => handleChange('designation', e.target.value)} onBlur={() => touchField('designation')} required />
                                    <FieldError fieldKey="designation" />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Date of Joining <span className={styles.required}>*</span></span>
                                    <input type="date" className={ic('joiningDate')} value={formData.joiningDate} onChange={e => handleChange('joiningDate', e.target.value)} onBlur={() => touchField('joiningDate')} required />
                                    <FieldError fieldKey="joiningDate" />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Reporting Manager <span className={styles.required}>*</span></span>
                                    <input
                                        className={ic('manager')}
                                        list="manager-suggestions"
                                        placeholder="Select or type manager name"
                                        value={formData.manager}
                                        onChange={e => handleChange('manager', e.target.value)}
                                        onBlur={() => touchField('manager')}
                                        required
                                    />
                                    <datalist id="manager-suggestions">
                                        {Array.from(new Set([
                                            ...existingEmployees.map(e => e.name || `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.id).filter(Boolean),
                                            'Kavita Rao', 'Arjun Mehta', 'Priya Sharma', 'Rahul Verma', 'Sneha Patel'
                                        ])).map(m => (
                                            <option key={m} value={m} />
                                        ))}
                                    </datalist>
                                    <FieldError fieldKey="manager" />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Work Location <span className={styles.required}>*</span></span>
                                    <select className={sc('location')} value={formData.location} onChange={e => handleChange('location', e.target.value)} onBlur={() => touchField('location')} required>
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
                                    <span className={styles.fieldLabel}>Worker Class <span className={styles.required}>*</span></span>
                                    <select className={sc('workerClass')} value={formData.workerClass} onChange={e => handleChange('workerClass', e.target.value)} onBlur={() => touchField('workerClass')} required>
                                        <option value="Permanent Full-Time">Permanent Full-Time</option>
                                        <option value="Probationer">Probationer</option>
                                        <option value="Contractor">Contractor</option>
                                        <option value="Trainee">Trainee</option>
                                    </select>
                                    <FieldError fieldKey="workerClass" />
                                </label>
                            </div>

                            {/* Labour Law & OT Classification — Demo Points 2, 3, 4, 7, 8, 13 */}
                            <div className={styles.sectionTitle} style={{ marginTop: '1rem' }}>Labour Law & OT Classification</div>
                            <div className={styles.formGrid}>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Worker Category</span>
                                    <select className={styles.select} value={formData.workerCategory} onChange={e => {
                                        const cat = e.target.value;
                                        handleChange('workerCategory', cat);
                                        // Auto-set rest day eligibility based on category
                                        if (cat === 'CONTRACT' || cat === 'THIRD_PARTY_HELPER') handleChange('hasRestDays', false);
                                        else handleChange('hasRestDays', true);
                                        if (cat === 'TRAINEE_DET' || cat === 'TRAINEE_GET') { handleChange('isTrainee', true); handleChange('traineeType', cat === 'TRAINEE_DET' ? 'DET' : 'GET'); }
                                        else { handleChange('isTrainee', false); handleChange('traineeType', ''); }
                                    }}>
                                        <option value="PERM">Permanent Employee</option>
                                        <option value="CONTRACT">Contractual (Daily Wage — No Rest Day)</option>
                                        <option value="THIRD_PARTY_EMP">3rd Party Employee (With Rest Days)</option>
                                        <option value="THIRD_PARTY_HELPER">3rd Party Helper (No Rest Days)</option>
                                        <option value="TRAINEE_DET">Trainee — DET (Graduate Engineer)</option>
                                        <option value="TRAINEE_GET">Trainee — GET (Diploma Engineer)</option>
                                    </select>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Rest Day Eligibility</span>
                                    <select className={styles.select} value={formData.hasRestDays ? 'YES' : 'NO'} onChange={e => handleChange('hasRestDays', e.target.value === 'YES')}>
                                        <option value="YES">Yes — Weekly Off Applies</option>
                                        <option value="NO">No — Paid for All Working Days</option>
                                    </select>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>OT Eligibility</span>
                                    <select className={styles.select} value={formData.otEligibility} onChange={e => handleChange('otEligibility', e.target.value)}>
                                        <option value="ALL_DAYS">All Days (Regular + Rest Days)</option>
                                        <option value="REST_HOLIDAYS_ONLY">Rest Days &amp; Holidays Only</option>
                                        <option value="NONE">Not Eligible for OT</option>
                                    </select>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Salary Location Scope</span>
                                    <select className={styles.select} value={formData.salaryLocationScope} onChange={e => handleChange('salaryLocationScope', e.target.value)}>
                                        <option value="PLANT">Plant (Attendance + Salary at Plant)</option>
                                        <option value="HO">Head Office (Attendance at Plant, Salary at HO)</option>
                                    </select>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Default Assigned Shift</span>
                                    <select className={styles.select} value={formData.assignedShift} onChange={e => handleChange('assignedShift', e.target.value)}>
                                        <option value="A">A Shift (08:00 AM – 08:00 PM, 12 Hrs)</option>
                                        <option value="B">B Shift (08:00 PM – 08:00 AM, 12 Hrs)</option>
                                        <option value="GENERAL">General Shift (09:00 AM – 06:00 PM, 9 Hrs)</option>
                                        <option value="AUTO_DETECT">Auto-Detect from Punch Time</option>
                                    </select>
                                </label>
                            </div>

                            <div className={styles.sectionTitle} style={{ marginTop: '1rem' }}>Site &amp; Facilities</div>
                            <div className={styles.formGrid}>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Biometric Enrolment ID</span>
                                    <input className={styles.input} placeholder="BIO-9081" value={formData.biometricEnrolId} onChange={e => handleChange('biometricEnrolId', e.target.value)} />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Access Card Number</span>
                                    <input className={styles.input} placeholder="AC-1029" value={formData.accessCardNo} onChange={e => handleChange('accessCardNo', e.target.value)} />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Locker Number</span>
                                    <input className={styles.input} placeholder="L-402" value={formData.lockerNo} onChange={e => handleChange('lockerNo', e.target.value)} />
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Footer buttons */}
                    <div className={styles.footer}>
                        <div>
                            {activeTab > 1 && (
                                <button type="button" className={styles.btnSecondary} onClick={() => setActiveTab(prev => prev - 1)}>
                                    <ArrowLeft size={16} style={{ display: 'inline', marginRight: '4px' }} /> Previous
                                </button>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancel</button>
                            {activeTab < 6 ? (
                                <button type="button" className={styles.btnPrimary} onClick={() => setActiveTab(prev => prev + 1)}>
                                    Next Tab <ArrowRight size={16} style={{ display: 'inline', marginLeft: '4px' }} />
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
