"use client";

import { useTranslation } from '@/context/I18nContext';
import React, { useState } from 'react';
import {
    User, Mail, Phone, MapPin, Building2, Briefcase, Calendar,
    ShieldCheck, CreditCard, Clock, FileText, CheckCircle2,
    X, Printer, Award, Lock, ExternalLink, Download, AlertCircle
} from 'lucide-react';
import styles from './EmployeeDossierModal.module.css';
import { downloadCSV, downloadPrintableDocument } from '@/utils/exportUtils';

export default function EmployeeDossierModal({ employee, onClose, onEdit }) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('overview'); // overview, contact, placement, bank, leaves, docs

    if (!employee) return null;

    const initials = (employee.name || 'Emp')
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    const handlePrint = () => {
        downloadPrintableDocument(`Employee_Dossier_${employee.id || 'EMP'}`, {
            'Employee ID': employee.id || employee.employeeCode || 'EMP-101',
            'Full Name': employee.name,
            'Designation': employee.role || employee.designation || 'Staff',
            'Department': employee.dept || employee.department || 'Operations',
            'Location': employee.location || 'Bengaluru Facility',
            'Status': employee.status || 'Active',
            'Email': employee.email || employee.workEmail || 'user@nucleus.com',
            'Phone': employee.phone || employee.mobile || '+91 98765 43210'
        }, ['Category', 'Profile Detail', 'Verification Status'], [
            ['Employment Band', employee.band || 'L3 / Specialist', 'Verified'],
            ['Joining Date', employee.joiningDate || '2024-01-15', 'HR Confirmed'],
            ['Reporting Manager', employee.manager || 'Executive Leadership', 'Assigned'],
            ['PAN / Tax ID', employee.panNumber || '••••3421', 'KYC Verified'],
            ['Bank Account', employee.accountNumber ? `••••${String(employee.accountNumber).slice(-4)}` : '••••5678', 'Direct Deposit Active'],
            ['PF / UAN Number', employee.uanNumber || '100904567890', 'EPFO Linked'],
            ['Emergency Contact', employee.emergencyContactName || 'Family Member', 'Recorded'],
            ['Compliance Clearance', '100% Verified', 'Audit Passed']
        ]);
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.employeeProfile}>
                        <div className={styles.avatar}>
                            {initials}
                        </div>
                        <div className={styles.empDetails}>
                            <h2>{employee.name}</h2>
                            <div className={styles.empMeta}>
                                <span className={styles.empCodeBadge}>{employee.id}</span>
                                <span>·</span>
                                <span>{employee.role || employee.designation || 'Staff'}</span>
                                <span>·</span>
                                <span>{employee.dept || employee.department || 'Operations'}</span>
                                <span>·</span>
                                <span className={styles.statusActive}>{employee.status || 'Active'}</span>
                            </div>
                        </div>
                    </div>
                    <div className={styles.headerActions}>
                        <button className={styles.btnPrint} onClick={handlePrint}>
                            <Printer size={15} />  {t("components.Workspace.EmployeeDossierModal.text_print_dossier", "Print Dossier")}
                        </button>
                        {onEdit && (
                            <button
                                className={styles.btnPrint}
                                style={{ background: 'var(--signal)', color: 'var(--on-signal)', borderColor: 'var(--signal-ink)' }}
                                onClick={() => {
                                    onClose();
                                    onEdit(employee);
                                }}
                            >
                                
                                {t("components.Workspace.EmployeeDossierModal.text_edit_profile", "Edit Profile")}
                            </button>
                        )}
                        <button className={styles.btnClose} onClick={onClose} aria-label={t("components.Workspace.EmployeeDossierModal.aria-label_close_dossier", "Close dossier")}>
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className={styles.tabBar}>
                    <button
                        className={`${styles.tabBtn} ${activeTab === 'overview' ? styles.activeTabBtn : ''}`}
                        onClick={() => setActiveTab('overview')}
                    >
                        <User size={15} />  {t("components.Workspace.EmployeeDossierModal.text_overview_identity", "Overview & Identity")}
                    </button>
                    <button
                        className={`${styles.tabBtn} ${activeTab === 'contact' ? styles.activeTabBtn : ''}`}
                        onClick={() => setActiveTab('contact')}
                    >
                        <Phone size={15} />  {t("components.Workspace.EmployeeDossierModal.text_contact_address", "Contact & Address")}
                    </button>
                    <button
                        className={`${styles.tabBtn} ${activeTab === 'placement' ? styles.activeTabBtn : ''}`}
                        onClick={() => setActiveTab('placement')}
                    >
                        <Briefcase size={15} />  {t("components.Workspace.EmployeeDossierModal.text_job_hierarchy", "Job & Hierarchy")}
                    </button>
                    <button
                        className={`${styles.tabBtn} ${activeTab === 'bank' ? styles.activeTabBtn : ''}`}
                        onClick={() => setActiveTab('bank')}
                    >
                        <CreditCard size={15} />  {t("components.Workspace.EmployeeDossierModal.text_bank_compensation", "Bank & Compensation")}
                    </button>
                    <button
                        className={`${styles.tabBtn} ${activeTab === 'leaves' ? styles.activeTabBtn : ''}`}
                        onClick={() => setActiveTab('leaves')}
                    >
                        <Clock size={15} />  {t("components.Workspace.EmployeeDossierModal.text_leaves_balances", "Leaves & Balances")}
                    </button>
                    <button
                        className={`${styles.tabBtn} ${activeTab === 'docs' ? styles.activeTabBtn : ''}`}
                        onClick={() => setActiveTab('docs')}
                    >
                        <FileText size={15} />  {t("components.Workspace.EmployeeDossierModal.text_compliance_vault", "Compliance & Vault")}
                    </button>
                </div>

                {/* Tab Content */}
                <div className={styles.contentBody}>
                    {activeTab === 'overview' && (
                        <div className={styles.sectionGrid}>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>{t("components.Workspace.EmployeeDossierModal.text_full_name", "Full Name")}</span>
                                <span className={styles.infoValue}>{employee.name}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>{t("components.Workspace.EmployeeDossierModal.text_employee_code", "Employee Code")}</span>
                                <span className={styles.infoValue}>{employee.id}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>{t("components.Workspace.EmployeeDossierModal.text_worker_class_band", "Worker Class / Band")}</span>
                                <span className={styles.infoValue}>{employee.band || 'M4 (Middle Management)'}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>{t("components.Workspace.EmployeeDossierModal.text_gender_blood_group", "Gender / Blood Group")}</span>
                                <span className={styles.infoValue}>{employee.gender || 'Male'} · {employee.bloodGroup || 'O+'}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>{t("components.Workspace.EmployeeDossierModal.text_date_of_birth", "Date of Birth")}</span>
                                <span className={styles.infoValue}>{employee.dob || '1992-08-14'}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>{t("components.Workspace.EmployeeDossierModal.text_nationality_marital_status", "Nationality / Marital Status")}</span>
                                <span className={styles.infoValue}>{t("components.Workspace.EmployeeDossierModal.text_indian", "Indian ·")} {employee.maritalStatus || 'Married'}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>{t("components.Workspace.EmployeeDossierModal.text_pan_card", "PAN Card")}</span>
                                <span className={styles.infoValue}><code>{employee.pan || 'ABCDE1234F'}</code>  {t("components.Workspace.EmployeeDossierModal.text_verified", "(Verified)")}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>{t("components.Workspace.EmployeeDossierModal.text_aadhaar_uid", "Aadhaar UID")}</span>
                                <span className={styles.infoValue}><code>{t("components.Workspace.EmployeeDossierModal.text_text", "•••• ••••")} {employee.aadhaar ? employee.aadhaar.slice(-4) : '9012'}</code></span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>{t("components.Workspace.EmployeeDossierModal.text_universal_account_no_uan", "Universal Account No (UAN)")}</span>
                                <span className={styles.infoValue}><code>{employee.uan || '100123456789'}</code></span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>{t("components.Workspace.EmployeeDossierModal.text_esic_ip_number", "ESIC IP Number")}</span>
                                <span className={styles.infoValue}><code>{employee.esic || '31-00-123456-000-0001'}</code></span>
                            </div>
                        </div>
                    )}

                    {activeTab === 'contact' && (
                        <div className={styles.sectionGrid}>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>{t("components.Workspace.EmployeeDossierModal.text_work_email", "Work Email")}</span>
                                <span className={styles.infoValue}>{employee.workEmail || `${(employee.name || 'emp').toLowerCase().replace(/\s+/g, '.')}@nucleus.com`}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>{t("components.Workspace.EmployeeDossierModal.text_personal_email", "Personal Email")}</span>
                                <span className={styles.infoValue}>{employee.personalEmail || `${(employee.name || 'emp').toLowerCase().replace(/\s+/g, '')}@gmail.com`}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>{t("components.Workspace.EmployeeDossierModal.text_mobile_number", "Mobile Number")}</span>
                                <span className={styles.infoValue}>{employee.phone || '+91 98765 43210'}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>{t("components.Workspace.EmployeeDossierModal.text_emergency_contact", "Emergency Contact")}</span>
                                <span className={styles.infoValue}>{employee.emergencyContact || 'Sunita Sharma (Spouse)'} · {employee.emergencyPhone || '+91 98765 11223'}</span>
                            </div>
                            <div className={styles.infoItem} style={{ gridColumn: '1 / -1' }}>
                                <span className={styles.infoLabel}>{t("components.Workspace.EmployeeDossierModal.text_present_residential_address", "Present Residential Address")}</span>
                                <span className={styles.infoValue}>{t("components.Workspace.EmployeeDossierModal.text_flat_402_green_glen_layout_bellandur_ban", "Flat 402, Green Glen Layout, Bellandur, Bangalore, Karnataka - 560103")}</span>
                            </div>
                            <div className={styles.infoItem} style={{ gridColumn: '1 / -1' }}>
                                <span className={styles.infoLabel}>{t("components.Workspace.EmployeeDossierModal.text_permanent_address", "Permanent Address")}</span>
                                <span className={styles.infoValue}>{t("components.Workspace.EmployeeDossierModal.text_flat_402_green_glen_layout_bellandur_ban", "Flat 402, Green Glen Layout, Bellandur, Bangalore, Karnataka - 560103")}</span>
                            </div>
                        </div>
                    )}

                    {activeTab === 'placement' && (
                        <div className={styles.sectionGrid}>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>{t("components.Workspace.EmployeeDossierModal.text_legal_entity", "Legal Entity")}</span>
                                <span className={styles.infoValue}>{t("components.Workspace.EmployeeDossierModal.text_nucleus_hr_solutions_india_pvt_ltd", "Nucleus HR Solutions India Pvt Ltd")}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>{t("components.Workspace.EmployeeDossierModal.text_work_location_plant", "Work Location / Plant")}</span>
                                <span className={styles.infoValue}>{employee.location || 'Bangalore Electronic City Plant 1'}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>{t("components.Workspace.EmployeeDossierModal.text_department", "Department")}</span>
                                <span className={styles.infoValue}>{employee.dept || employee.department || 'Operations'}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>{t("components.Workspace.EmployeeDossierModal.text_designation_role", "Designation / Role")}</span>
                                <span className={styles.infoValue}>{employee.role || employee.designation || 'Specialist'}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>{t("components.Workspace.EmployeeDossierModal.text_reporting_manager", "Reporting Manager")}</span>
                                <span className={styles.infoValue}>{employee.manager || 'Rajesh Varma (VP Ops)'}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>{t("components.Workspace.EmployeeDossierModal.text_date_of_joining", "Date of Joining")}</span>
                                <span className={styles.infoValue}>{employee.joiningDate || '2023-04-10'}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>{t("components.Workspace.EmployeeDossierModal.text_employment_category", "Employment Category")}</span>
                                <span className={styles.infoValue}>{t("components.Workspace.EmployeeDossierModal.text_full-time_regular_confirmed", "Full-Time Regular (Confirmed)")}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>{t("components.Workspace.EmployeeDossierModal.text_shift_assignment", "Shift Assignment")}</span>
                                <span className={styles.infoValue}>{t("components.Workspace.EmployeeDossierModal.text_general_plant_shift_0800_-_2000", "General Plant Shift (08:00 - 20:00)")}</span>
                            </div>
                            <div className={styles.infoItem} style={{ gridColumn: '1 / -1' }}>
                                <span className={styles.infoLabel}>{t("components.Workspace.EmployeeDossierModal.text_labour_law_rest_day_policy", "Labour Law & Rest Day Policy")}</span>
                                <div style={{ marginTop: '0.35rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: 4, background: 'var(--signal-wash)', color: 'var(--signal-ink)', fontWeight: 600 }}>
                                        
                                        {t("components.Workspace.EmployeeDossierModal.text_weekly_rest_day_sunday_paid", "Weekly Rest Day: Sunday (Paid)")}
                                    </span>
                                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: 4, background: 'var(--info-wash)', color: 'var(--info)', fontWeight: 600 }}>
                                        
                                        {t("components.Workspace.EmployeeDossierModal.text_overtime_rest_days_public_holidays_doubl", "Overtime: Rest Days & Public Holidays (Double Rate)")}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'bank' && (
                        <div>
                            <div className={styles.statCardGrid}>
                                <div className={styles.statCard}>
                                    <span className={styles.statTitle}>{t("components.Workspace.EmployeeDossierModal.text_basic_salary", "Basic Salary")}</span>
                                    <span className={styles.statNum}>{t("components.Workspace.EmployeeDossierModal.text_45000", "₹45,000")}</span>
                                    <span className={styles.statSub}>{t("components.Workspace.EmployeeDossierModal.text_monthly_base", "Monthly Base")}</span>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statTitle}>{t("components.Workspace.EmployeeDossierModal.text_company_loan_limit", "Company Loan Limit")}</span>
                                    <span className={styles.statNum}>{t("components.Workspace.EmployeeDossierModal.text_180000", "₹1,80,000")}</span>
                                    <span className={styles.statSub}>{t("components.Workspace.EmployeeDossierModal.text_standard_statutory_policy", "Standard Statutory Policy")}</span>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statTitle}>{t("components.Workspace.EmployeeDossierModal.text_active_loans", "Active Loans")}</span>
                                    <span className={styles.statNum} style={{ color: 'var(--text)' }}>0</span>
                                    <span className={styles.statSub}>{t("components.Workspace.EmployeeDossierModal.text_eligible_for_loan_advance", "Eligible for Loan & Advance")}</span>
                                </div>
                            </div>

                            <div className={styles.sectionGrid}>
                                <div className={styles.infoItem}>
                                    <span className={styles.infoLabel}>{t("components.Workspace.EmployeeDossierModal.text_bank_name", "Bank Name")}</span>
                                    <span className={styles.infoValue}>{employee.bankName || 'HDFC Bank Ltd'}</span>
                                </div>
                                <div className={styles.infoItem}>
                                    <span className={styles.infoLabel}>{t("components.Workspace.EmployeeDossierModal.text_account_number", "Account Number")}</span>
                                    <span className={styles.infoValue}><code>{t("components.Workspace.EmployeeDossierModal.text_text", "•••• ••••")} {employee.accountNumber ? employee.accountNumber.slice(-4) : '7891'}</code></span>
                                </div>
                                <div className={styles.infoItem}>
                                    <span className={styles.infoLabel}>{t("components.Workspace.EmployeeDossierModal.text_ifsc_code", "IFSC Code")}</span>
                                    <span className={styles.infoValue}><code>{employee.ifsc || 'HDFC0001234'}</code></span>
                                </div>
                                <div className={styles.infoItem}>
                                    <span className={styles.infoLabel}>{t("components.Workspace.EmployeeDossierModal.text_disbursement_mode", "Disbursement Mode")}</span>
                                    <span className={styles.infoValue}>{t("components.Workspace.EmployeeDossierModal.text_direct_corporate_neft_nach", "Direct Corporate NEFT / NACH")}</span>
                                </div>
                                <div className={styles.infoItem}>
                                    <span className={styles.infoLabel}>{t("components.Workspace.EmployeeDossierModal.text_salary_masking_status", "Salary Masking Status")}</span>
                                    <span className={styles.infoValue}>{t("components.Workspace.EmployeeDossierModal.text_ho_generated_plant_masked", "HO Generated · Plant Masked")}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'leaves' && (
                        <div>
                            <div className={styles.statCardGrid}>
                                <div className={styles.statCard}>
                                    <span className={styles.statTitle}>{t("components.Workspace.EmployeeDossierModal.text_earned_leave_el", "Earned Leave (EL)")}</span>
                                    <span className={styles.statNum}>{t("components.Workspace.EmployeeDossierModal.text_145", "14.5")}</span>
                                    <span className={styles.statSub}>{t("components.Workspace.EmployeeDossierModal.text_auto-accrued_policy", "Auto-accrued Policy")}</span>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statTitle}>{t("components.Workspace.EmployeeDossierModal.text_casual_leave_cl", "Casual Leave (CL)")}</span>
                                    <span className={styles.statNum}>{t("components.Workspace.EmployeeDossierModal.text_40", "4.0")}</span>
                                    <span className={styles.statSub}>{t("components.Workspace.EmployeeDossierModal.text_max_2_month_non-merge", "Max 2 / Month · Non-merge")}</span>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statTitle}>{t("components.Workspace.EmployeeDossierModal.text_sick_leave_sl", "Sick Leave (SL)")}</span>
                                    <span className={styles.statNum}>{t("components.Workspace.EmployeeDossierModal.text_50", "5.0")}</span>
                                    <span className={styles.statSub}>{t("components.Workspace.EmployeeDossierModal.text_medical_certificate_gt2d", "Medical Certificate &gt;2d")}</span>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statTitle}>{t("components.Workspace.EmployeeDossierModal.text_comp-off_coff", "Comp-Off (COFF)")}</span>
                                    <span className={styles.statNum}>{t("components.Workspace.EmployeeDossierModal.text_10", "1.0")}</span>
                                    <span className={styles.statSub}>{t("components.Workspace.EmployeeDossierModal.text_60-day_auto-lapse", "60-day Auto-Lapse")}</span>
                                </div>
                            </div>

                            <div className={styles.infoItem} style={{ marginBottom: '1rem' }}>
                                <span className={styles.infoLabel}>{t("components.Workspace.EmployeeDossierModal.text_gate_pass_allowance", "Gate Pass Allowance")}</span>
                                <span className={styles.infoValue}>{t("components.Workspace.EmployeeDossierModal.text_4_hours_monthly_allowance_2_passes_max_m", "4 Hours monthly allowance (2 passes max / month) · 180 mins remaining")}</span>
                            </div>

                            <div className={styles.tableWrap}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>{t("components.Workspace.EmployeeDossierModal.text_leave_period", "Leave Period")}</th>
                                            <th>{t("components.Workspace.EmployeeDossierModal.text_type", "Type")}</th>
                                            <th>{t("components.Workspace.EmployeeDossierModal.text_applied_days", "Applied Days")}</th>
                                            <th>{t("components.Workspace.EmployeeDossierModal.text_actual_utilized", "Actual Utilized")}</th>
                                            <th>{t("components.Workspace.EmployeeDossierModal.text_auto_re-credited", "Auto Re-credited")}</th>
                                            <th>{t("components.Workspace.EmployeeDossierModal.text_approval_chain", "Approval Chain")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>{t("components.Workspace.EmployeeDossierModal.text_2026-08-10_to_2026-08-16", "2026-08-10 to 2026-08-16")}</td>
                                            <td>{t("components.Workspace.EmployeeDossierModal.text_el", "EL")}</td>
                                            <td>{t("components.Workspace.EmployeeDossierModal.text_7_days", "7 Days")}</td>
                                            <td>{t("components.Workspace.EmployeeDossierModal.text_5_days", "5 Days")}</td>
                                            <td><span style={{ color: 'var(--signal)', fontWeight: 700 }}>{t("components.Workspace.EmployeeDossierModal.text_2_days_re-credited", "+2 Days Re-credited")}</span></td>
                                            <td><span style={{ fontSize: '0.75rem', color: 'var(--status-ok)' }}>{t("components.Workspace.EmployeeDossierModal.text_supervisor_hod_hr_head", "Supervisor ✓ · HOD ✓ · HR Head ✓")}</span></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'docs' && (
                        <div>
                            <div className={styles.tableWrap}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>{t("components.Workspace.EmployeeDossierModal.text_document_statutory_register", "Document / Statutory Register")}</th>
                                            <th>{t("components.Workspace.EmployeeDossierModal.text_legal_reference", "Legal Reference")}</th>
                                            <th>{t("components.Workspace.EmployeeDossierModal.text_status", "Status")}</th>
                                            <th>{t("components.Workspace.EmployeeDossierModal.text_action", "Action")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td><strong>{t("components.Workspace.EmployeeDossierModal.text_factory_act_form_f", "Factory Act Form F")}</strong>  {t("components.Workspace.EmployeeDossierModal.text_gratuity_nomination", "(Gratuity Nomination)")}</td>
                                            <td>{t("components.Workspace.EmployeeDossierModal.text_factory_act_1948_statutory_gratuity_comp", "Factory Act 1948 · Statutory Gratuity Compliance")}</td>
                                            <td><span className={styles.statusActive}>{t("components.Workspace.EmployeeDossierModal.text_executed_nominated", "Executed & Nominated")}</span></td>
                                            <td><button className={styles.btnPrint} style={{ padding: '0.2rem 0.5rem' }} onClick={() => {
                                                const meta = employee.metadata || {};
                                                downloadPrintableDocument(`Form_F_Gratuity_Nomination_${employee.id}`, {
                                                    'Employee Code': employee.id || employee.employeeCode,
                                                    'Full Legal Name': employee.name,
                                                    'Father / Spouse Name': meta.fatherName || 'Shri R. Sharma',
                                                    'Permanent Address': meta.permanentAddress || employee.address || '12, Indiranagar, Bengaluru, KA',
                                                    'Department & Designation': `${employee.department || 'Engineering'} · ${employee.role || employee.designation || 'Staff'}`,
                                                    'Date of Appointment': meta.joiningDate || '2026-01-15',
                                                    'Nominee Name': meta.emergencyContactName || 'Pooja Sharma',
                                                    'Relationship with Employee': 'Spouse',
                                                    'Nominee Age / DOB': '32 Years',
                                                    'Proportion of Gratuity': '100%',
                                                    'Statutory Act': 'Payment of Gratuity Act 1972 & Factory Act 1948 Rule 6'
                                                }, ['Particulars', 'Statutory Record Details'], [
                                                    ['Establishment Name', 'Nucleus Manufacturing & Technology Facilities Ltd.'],
                                                    ['Registration / Factory License', 'FAC-KA-BNG-2026-0988'],
                                                    ['Employee Provident Fund (UAN)', meta.uanNumber || '100904567890'],
                                                    ['Statutory Gratuity Trust ID', 'GRAT-TRUST-IND-01'],
                                                    ['Verification Status', 'Executed & Nominated by Employee']
                                                ]);
                                            }}><Download size={13} />  {t("components.Workspace.EmployeeDossierModal.text_view_form", "View Form")}</button></td>
                                        </tr>
                                        <tr>
                                            <td><strong>{t("components.Workspace.EmployeeDossierModal.text_signed_appointment_letter", "Signed Appointment Letter")}</strong></td>
                                            <td>{t("components.Workspace.EmployeeDossierModal.text_template_scr-015_hr_letter_lifecycle", "Template SCR-015 · HR Letter Lifecycle")}</td>
                                            <td><span className={styles.statusActive}>{t("components.Workspace.EmployeeDossierModal.text_signed_sealed", "Signed & Sealed")}</span></td>
                                            <td><button className={styles.btnPrint} style={{ padding: '0.2rem 0.5rem' }} onClick={() => {
                                                const meta = employee.metadata || {};
                                                downloadPrintableDocument(`Appointment_Letter_${employee.id}`, {
                                                    'Candidate / Employee ID': employee.id || employee.employeeCode,
                                                    'Employee Name': employee.name,
                                                    'Designation': employee.role || employee.designation || 'Specialist',
                                                    'Department': employee.department || 'Operations',
                                                    'Location': employee.location || 'Bengaluru Corporate Office',
                                                    'Effective Date of Joining': meta.joiningDate || '2026-01-15',
                                                    'Worker Class / Band': employee.band || meta.workerClass || 'Permanent Full-Time',
                                                    'Reporting Manager': employee.manager || 'Ananya Roy',
                                                    'Annual Compensation (CTC)': meta.grossCtc ? `₹${Number(meta.grossCtc).toLocaleString('en-IN')}` : '₹24,00,000'
                                                }, ['Appointment Clause', 'Terms & Conditions'], [
                                                    ['Role Responsibilities', 'Defined as per Position Master Register & Supervisory SLA'],
                                                    ['Probation Period', '6 Months from Effective Joining Date with Quarterly Review'],
                                                    ['Notice Period', '60 Days for Confirmation Staff / 30 Days during Probation'],
                                                    ['Statutory Benefits', 'Coverage under EPF Act 1952, ESI Act 1948 & Gratuity Act 1972'],
                                                    ['Confidentiality & IP', 'Execution of Standard Nucleus Proprietary Rights Agreement']
                                                ]);
                                            }}><Download size={13} />  {t("components.Workspace.EmployeeDossierModal.text_download", "Download")}</button></td>
                                        </tr>
                                        <tr>
                                            <td><strong>{t("components.Workspace.EmployeeDossierModal.text_form_28_muster_roll_extraction", "Form 28 / Muster Roll Extraction")}</strong></td>
                                            <td>{t("components.Workspace.EmployeeDossierModal.text_statutory_form_28_compliance", "Statutory Form 28 Compliance")}</td>
                                            <td><span className={styles.statusActive}>{t("components.Workspace.EmployeeDossierModal.text_current_period_synced", "Current Period Synced")}</span></td>
                                            <td><button className={styles.btnPrint} style={{ padding: '0.2rem 0.5rem' }} onClick={() => {
                                                const meta = employee.metadata || {};
                                                downloadPrintableDocument(`Form_28_Muster_Roll_${employee.id}`, {
                                                    'Employee Token': employee.id || employee.employeeCode,
                                                    'Worker Name': employee.name,
                                                    'Workstation / Department': employee.department || 'Operations',
                                                    'Assigned Shift': 'General Shift (09:00 - 18:00)',
                                                    'Factory Location': employee.location || 'Bengaluru Facility',
                                                    'Statutory Register': 'Form 28 - Adult Worker Register (Rule 88)',
                                                    'Reporting Period': 'September 2026'
                                                }, ['Audit Metric', 'Reported Value', 'Statutory Compliance Rule'], [
                                                    ['Scheduled Working Days', '26 Days', 'Factories Act Section 51'],
                                                    ['Days Present & Punched', '24 Days', 'Biometric Verified / GPS Geo-Fenced'],
                                                    ['Weekly Rest Days Taken', '4 Days', 'Section 52 (Mandatory Rest Day)'],
                                                    ['Overtime Hours Recorded', '0.0 Hours', 'Section 59 (Double Wages for OT)'],
                                                    ['Approved Paid Leave', '2 Days (CL)', 'Factories Act Annual Leave with Wages'],
                                                    ['Compliance Status', '100% Verified', 'Audit Passed · Inspector Signature Ready']
                                                ]);
                                            }}><ExternalLink size={13} />  {t("components.Workspace.EmployeeDossierModal.text_inspect", "Inspect")}</button></td>
                                        </tr>
                                        <tr>
                                            <td><strong>{t("components.Workspace.EmployeeDossierModal.text_pan_aadhaar_kyc_bundle", "PAN & Aadhaar KYC Bundle")}</strong></td>
                                            <td>{t("components.Workspace.EmployeeDossierModal.text_it_act_epfo_uidai", "IT Act & EPFO UIDAI")}</td>
                                            <td><span className={styles.statusActive}>{t("components.Workspace.EmployeeDossierModal.text_100_aadhaar_verified", "100% Aadhaar Verified")}</span></td>
                                            <td><button className={styles.btnPrint} style={{ padding: '0.2rem 0.5rem' }}><CheckCircle2 size={13} />  {t("components.Workspace.EmployeeDossierModal.text_validated", "Validated")}</button></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className={styles.footer}>
                    <button className={styles.btnPrint} onClick={onClose}>
                        
                        {t("components.Workspace.EmployeeDossierModal.text_close", "Close")}
                    </button>
                    {onEdit && (
                        <button
                            className={styles.btnPrint}
                            style={{ background: 'var(--signal)', color: 'var(--on-signal)', borderColor: 'var(--signal-ink)' }}
                            onClick={() => {
                                onClose();
                                onEdit(employee);
                            }}
                        >
                            
                            {t("components.Workspace.EmployeeDossierModal.text_edit_employee_profile", "Edit Employee Profile")}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
