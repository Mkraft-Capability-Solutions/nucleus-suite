"use client";
import React, { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import {
    X, User, Phone, Shield, Users, GraduationCap, Briefcase,
    HeartPulse, Plus, Trash2, CheckCircle2, ArrowRight, ArrowLeft
} from 'lucide-react';
import styles from './EmployeeCreationWizard.module.css';
import { useHRMS } from '@/context/HRMSContext';

export default function EmployeeCreationWizard({ isOpen, onClose, onSave }) {
    const { showToast } = useHRMS();
    const [activeTab, setActiveTab] = useState(1);

    // Form state covering all 12 sections of FRM-PPL-01
    const [formData, setFormData] = useState({
        // Section 1: Identity
        employeeCode: `EMP-${Math.floor(10000 + Math.random() * 90000)}`,
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
        changeReason: 'New hire onboarding'
    });

    if (!isOpen) return null;

    const handleChange = (field, val) => {
        setFormData(prev => ({ ...prev, [field]: val }));
    };

    // Helper to compute full name
    const updateFirstName = (val) => {
        setFormData(prev => ({
            ...prev,
            firstName: val,
            fullLegalName: `${val} ${prev.lastName}`.trim(),
            nameAsPerBank: `${val} ${prev.lastName}`.trim()
        }));
    };

    const updateLastName = (val) => {
        setFormData(prev => ({
            ...prev,
            lastName: val,
            fullLegalName: `${prev.firstName} ${val}`.trim(),
            nameAsPerBank: `${prev.firstName} ${val}`.trim()
        }));
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
        if (!formData.firstName || !formData.lastName || !formData.mobile) {
            showToast('Validation Error', 'First name, last name, and primary mobile are required.', 'error');
            return;
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
            details: formData
        };

        if (onSave) onSave(newEmployee);
        showToast('Employee Created', `${newEmployee.name} (${newEmployee.id}) created successfully.`, 'success');
        onClose();
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.titleGroup}>
                        <h2><User size={20} color="#38bdf8" /> Add Employee Master (FRM-PPL-01)</h2>
                        <p>Complete 117-field statutory employee onboarding wizard</p>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose} type="button"><X size={20} /></button>
                </div>

                {/* Tabs */}
                <div className={styles.tabs}>
                    <button type="button" className={`${styles.tabBtn} ${activeTab === 1 ? styles.activeTab : ''}`} onClick={() => setActiveTab(1)}>
                        <User size={15} /> 1. Identity & Personal
                    </button>
                    <button type="button" className={`${styles.tabBtn} ${activeTab === 2 ? styles.activeTab : ''}`} onClick={() => setActiveTab(2)}>
                        <Phone size={15} /> 2. Contact & Address
                    </button>
                    <button type="button" className={`${styles.tabBtn} ${activeTab === 3 ? styles.activeTab : ''}`} onClick={() => setActiveTab(3)}>
                        <Shield size={15} /> 3. Statutory & Bank
                    </button>
                    <button type="button" className={`${styles.tabBtn} ${activeTab === 4 ? styles.activeTab : ''}`} onClick={() => setActiveTab(4)}>
                        <Users size={15} /> 4. Family & Nominees
                    </button>
                    <button type="button" className={`${styles.tabBtn} ${activeTab === 5 ? styles.activeTab : ''}`} onClick={() => setActiveTab(5)}>
                        <GraduationCap size={15} /> 5. Education & Experience
                    </button>
                    <button type="button" className={`${styles.tabBtn} ${activeTab === 6 ? styles.activeTab : ''}`} onClick={() => setActiveTab(6)}>
                        <Briefcase size={15} /> 6. Medical, Site & Control
                    </button>
                </div>

                {/* Form Content Body */}
                <form onSubmit={handleSubmit} className={styles.body}>
                    {/* TAB 1: IDENTITY & PERSONAL */}
                    {activeTab === 1 && (
                        <div className={styles.sectionGroup}>
                            <div className={styles.sectionTitle}>Identity Attributes</div>
                            <div className={styles.formGrid}>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Employee Code <span className={styles.required}>*</span></span>
                                    <input className={styles.input} value={formData.employeeCode} onChange={e => handleChange('employeeCode', e.target.value)} required />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Salutation</span>
                                    <select className={styles.select} value={formData.salutation} onChange={e => handleChange('salutation', e.target.value)}>
                                        <option>Mr</option><option>Ms</option><option>Mrs</option><option>Dr</option>
                                    </select>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>First Name <span className={styles.required}>*</span></span>
                                    <input className={styles.input} value={formData.firstName} onChange={e => updateFirstName(e.target.value)} required />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Middle Name</span>
                                    <input className={styles.input} value={formData.middleName} onChange={e => handleChange('middleName', e.target.value)} />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Last Name <span className={styles.required}>*</span></span>
                                    <input className={styles.input} value={formData.lastName} onChange={e => updateLastName(e.target.value)} required />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Full Name (Aadhaar match)</span>
                                    <input className={styles.input} value={formData.fullLegalName} onChange={e => handleChange('fullLegalName', e.target.value)} />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Gender <span className={styles.required}>*</span></span>
                                    <select className={styles.select} value={formData.gender} onChange={e => handleChange('gender', e.target.value)}>
                                        <option>Male</option><option>Female</option><option>Other</option>
                                    </select>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Date of Birth <span className={styles.required}>*</span></span>
                                    <input type="date" className={styles.input} value={formData.dateOfBirth} onChange={e => handleChange('dateOfBirth', e.target.value)} required />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Blood Group <span className={styles.required}>*</span></span>
                                    <select className={styles.select} value={formData.bloodGroup} onChange={e => handleChange('bloodGroup', e.target.value)}>
                                        <option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>O+</option><option>O-</option><option>AB+</option><option>AB-</option>
                                    </select>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Marital Status</span>
                                    <select className={styles.select} value={formData.maritalStatus} onChange={e => handleChange('maritalStatus', e.target.value)}>
                                        <option>Single</option><option>Married</option><option>Divorced</option><option>Widowed</option>
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
                                        <option>General</option><option>OBC</option><option>SC</option><option>ST</option>
                                    </select>
                                </label>
                            </div>

                            <div className={styles.sectionTitle} style={{ marginTop: '1rem' }}>Family Identity</div>
                            <div className={styles.formGrid}>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Father's Name <span className={styles.required}>*</span></span>
                                    <input className={styles.input} value={formData.fatherName} onChange={e => handleChange('fatherName', e.target.value)} required />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Mother's Name <span className={styles.required}>*</span></span>
                                    <input className={styles.input} value={formData.motherName} onChange={e => handleChange('motherName', e.target.value)} required />
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
                            <div className={styles.sectionTitle}>Contact Info</div>
                            <div className={styles.formGrid}>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Primary Mobile (WhatsApp) <span className={styles.required}>*</span></span>
                                    <input className={styles.input} placeholder="+91 9876543210" value={formData.mobile} onChange={e => handleChange('mobile', e.target.value)} required />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Official Email</span>
                                    <input type="email" className={styles.input} placeholder="name@company.com" value={formData.officialEmail} onChange={e => handleChange('officialEmail', e.target.value)} />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Personal Email</span>
                                    <input type="email" className={styles.input} placeholder="name@gmail.com" value={formData.personalEmail} onChange={e => handleChange('personalEmail', e.target.value)} />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Emergency Contact Name <span className={styles.required}>*</span></span>
                                    <input className={styles.input} value={formData.emergencyName} onChange={e => handleChange('emergencyName', e.target.value)} required />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Emergency Relation</span>
                                    <input className={styles.input} value={formData.emergencyRelation} onChange={e => handleChange('emergencyRelation', e.target.value)} />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Emergency Phone <span className={styles.required}>*</span></span>
                                    <input className={styles.input} value={formData.emergencyPhone} onChange={e => handleChange('emergencyPhone', e.target.value)} required />
                                </label>
                            </div>

                            <div className={styles.sectionTitle} style={{ marginTop: '1rem' }}>Address Details</div>
                            <div className={styles.formGrid}>
                                <label className={styles.field} style={{ gridColumn: 'span 2' }}>
                                    <span className={styles.fieldLabel}>Present Address Line 1 <span className={styles.required}>*</span></span>
                                    <input className={styles.input} value={formData.presentAddr1} onChange={e => handleChange('presentAddr1', e.target.value)} required />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>City <span className={styles.required}>*</span></span>
                                    <input className={styles.input} value={formData.presentCity} onChange={e => handleChange('presentCity', e.target.value)} required />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>State <span className={styles.required}>*</span></span>
                                    <select className={styles.select} value={formData.presentState} onChange={e => handleChange('presentState', e.target.value)}>
                                        <option value="KA">Karnataka</option><option value="MH">Maharashtra</option><option value="DL">Delhi</option><option value="TN">Tamil Nadu</option><option value="TS">Telangana</option>
                                    </select>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>PIN Code <span className={styles.required}>*</span></span>
                                    <input className={styles.input} maxLength={6} value={formData.presentPin} onChange={e => handleChange('presentPin', e.target.value)} required />
                                </label>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: STATUTORY & BANK */}
                    {activeTab === 3 && (
                        <div className={styles.sectionGroup}>
                            <div className={styles.sectionTitle}>Statutory Numbers & Tax Identification</div>
                            <div className={styles.formGrid}>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Aadhaar Number (12 digit token)</span>
                                    <input className={styles.input} maxLength={12} placeholder="1234 5678 9012" value={formData.aadhaarToken} onChange={e => handleChange('aadhaarToken', e.target.value)} />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>PAN Number (10 char)</span>
                                    <input className={styles.input} maxLength={10} placeholder="ABCDE1234F" value={formData.panToken} onChange={e => handleChange('panToken', e.target.value.toUpperCase())} />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>UAN (Universal Account No)</span>
                                    <input className={styles.input} maxLength={12} placeholder="100123456789" value={formData.uan} onChange={e => handleChange('uan', e.target.value)} />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>ESI IP Number (17 digit)</span>
                                    <input className={styles.input} maxLength={17} value={formData.esiIp} onChange={e => handleChange('esiIp', e.target.value)} />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Passport Number</span>
                                    <input className={styles.input} value={formData.passportToken} onChange={e => handleChange('passportToken', e.target.value)} />
                                </label>
                            </div>

                            <div className={styles.sectionTitle} style={{ marginTop: '1rem' }}>Bank Disbursement Details</div>
                            <div className={styles.formGrid}>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Bank Name <span className={styles.required}>*</span></span>
                                    <input className={styles.input} value={formData.bankName} onChange={e => handleChange('bankName', e.target.value)} required />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>IFSC Code <span className={styles.required}>*</span></span>
                                    <input className={styles.input} value={formData.ifsc} onChange={e => handleChange('ifsc', e.target.value.toUpperCase())} required />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Account Number (Tokenised) <span className={styles.required}>*</span></span>
                                    <input type="password" className={styles.input} value={formData.accountToken} onChange={e => handleChange('accountToken', e.target.value)} required />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Account Type</span>
                                    <select className={styles.select} value={formData.accountType} onChange={e => handleChange('accountType', e.target.value)}>
                                        <option>Savings</option><option>Current</option><option>Salary</option>
                                    </select>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Payment Mode</span>
                                    <select className={styles.select} value={formData.paymentMode} onChange={e => handleChange('paymentMode', e.target.value)}>
                                        <option>Bank Transfer</option><option>Cheque</option><option>Cash</option>
                                    </select>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* TAB 4: FAMILY & NOMINEES */}
                    {activeTab === 4 && (
                        <div className={styles.sectionGroup}>
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
                                                    <option>High School</option><option>Diploma</option><option>Bachelor's</option><option>Master's</option><option>Doctorate</option>
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
                            <div className={styles.sectionTitle}>Assignment & Placement Details</div>
                            <div className={styles.formGrid}>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Department <span className={styles.required}>*</span></span>
                                    <select className={styles.select} value={formData.department} onChange={e => handleChange('department', e.target.value)}>
                                        <option>Engineering</option><option>Product</option><option>Human Resources</option><option>Finance</option><option>Operations</option>
                                    </select>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Designation <span className={styles.required}>*</span></span>
                                    <input className={styles.input} value={formData.designation} onChange={e => handleChange('designation', e.target.value)} required />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Date of Joining <span className={styles.required}>*</span></span>
                                    <input type="date" className={styles.input} value={formData.joiningDate} onChange={e => handleChange('joiningDate', e.target.value)} required />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Reporting Manager <span className={styles.required}>*</span></span>
                                    <input className={styles.input} value={formData.manager} onChange={e => handleChange('manager', e.target.value)} required />
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Work Location <span className={styles.required}>*</span></span>
                                    <select className={styles.select} value={formData.location} onChange={e => handleChange('location', e.target.value)}>
                                        <option>Bangalore Plant</option><option>Mumbai Corporate HQ</option><option>Delhi Logistics Hub</option>
                                    </select>
                                </label>
                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>Worker Class <span className={styles.required}>*</span></span>
                                    <select className={styles.select} value={formData.workerClass} onChange={e => handleChange('workerClass', e.target.value)}>
                                        <option>Permanent Full-Time</option><option>Probationer</option><option>Contractor</option><option>Trainee</option>
                                    </select>
                                </label>
                            </div>

                            <div className={styles.sectionTitle} style={{ marginTop: '1rem' }}>Site & Facilities</div>
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
                                    <CheckCircle2 size={16} style={{ display: 'inline', marginRight: '4px' }} /> Save & Onboard Employee
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
