"use client";
import {useTranslation} from '@/context/I18nContext';

import { readData } from '../../services/workspace-data.mjs';

import React, { useState, useEffect } from 'react';
import {
    DollarSign, Download, PieChart, FileText, TrendingUp, ShieldCheck,
    Zap, Sparkles, Globe, ArrowRight, CheckCircle2, RefreshCw,
    Lock, AlertTriangle, UserCheck, Clock, FileSpreadsheet, Building2,
    Calendar, CheckSquare, XCircle, ChevronRight, Layers, ShieldAlert, Award, UploadCloud
} from 'lucide-react';
import styles from './PayrollView.module.css';
import { useHRMS } from '@/context/HRMSContext';
import { useAuth } from '@/context/AuthContext';
import {
    computeGuarantorLockStatus as computeGuarantorLockStatusService,
    calculateMaxLoanEligibility as calculateMaxLoanEligibilityService,
    calculateFnFSettlement as calculateFnFSettlementService
} from '@/services/payrollAdjacenciesService';
import { downloadCSV, downloadPrintableDocument } from '@/utils/exportUtils';

const PayrollView = ({ onNavigate, onSelectConsole, activeSubFeature }) => {
    const {t: translateText}=useTranslation();

    const {
        payrollSummary, ewaTransactions, requestEWA, showToast,
        companyLoans = [], applyForCompanyLoan, repayLoanEMI,
        payrollRuns = [], createOffCycleRun,
        fnfSettlements = [], updateDepartmentNoDues, disburseFnFSettlement,
        currentRoleContext, switchUserRole,
        payrollRunTypes, noDuesDepartments, payrollRulesetVersion,
        employees = [], canViewCompensation, applyLocationScoping,
        calculateMaxLoanEligibility = calculateMaxLoanEligibilityService,
        computeGuarantorLockStatus = computeGuarantorLockStatusService,
        calculateFnFSettlement = calculateFnFSettlementService
    } = useHRMS() || {};

    // Active Tab state
    const [activeTab, setActiveTab] = useState(readData("components.Workspace.PayrollView", "initialState_1")); // overview, offcycle, loans, fnf, scoping

    useEffect(() => {
        if (!activeSubFeature) return;
        if (activeSubFeature === 'full_and_final' || activeSubFeature === 'fnf' || activeSubFeature === 'payroll_fnf') {
            setActiveTab('fnf');
        } else if (activeSubFeature === 'loans_advances' || activeSubFeature === 'loans') {
            setActiveTab('loans');
        } else if (activeSubFeature === 'salary_simulator' || activeSubFeature === 'offcycle' || activeSubFeature === 'payroll_ewa') {
            setActiveTab('offcycle');
        } else if (activeSubFeature === 'gl_mapping' || activeSubFeature === 'scoping' || activeSubFeature === 'payroll_accounting') {
            setActiveTab('scoping');
        } else if (activeSubFeature === 'payroll_runs' || activeSubFeature === 'pre_payroll_audit' || activeSubFeature === 'payslips' || activeSubFeature === 'overview' || activeSubFeature === 'payroll_global') {
            setActiveTab('overview');
        }
    }, [activeSubFeature]);

    // Country selection
    const [selectedCountry, setSelectedCountry] = useState(readData("components.Workspace.PayrollView", "initialState_2"));
    const [ewaAmount, setEwaAmount] = useState(readData("components.Workspace.PayrollView", "initialState_3"));
    const [isGLModalOpen, setIsGLModalOpen] = useState(false);

    // Loan Application Modal State
    const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
    const [loanApplicantId, setLoanApplicantId] = useState(readData("components.Workspace.PayrollView", "initialState_4"));
    const [loanAmount, setLoanAmount] = useState(readData("components.Workspace.PayrollView", "initialState_5"));
    const [loanTenure, setLoanTenure] = useState(readData("components.Workspace.PayrollView", "initialState_6"));
    const [loanPurpose, setLoanPurpose] = useState(readData("components.Workspace.PayrollView", "initialState_7"));
    const [loanGuarantor1, setLoanGuarantor1] = useState(readData("components.Workspace.PayrollView", "initialState_8"));
    const [loanGuarantor2, setLoanGuarantor2] = useState(readData("components.Workspace.PayrollView", "initialState_9"));
    const [loanGuarantor3, setLoanGuarantor3] = useState('');
    const [isManagementOverride, setIsManagementOverride] = useState(false);
    const [overrideReason, setOverrideReason] = useState('');

    // F&F Selected Employee State
    const [selectedFnFId, setSelectedFnFId] = useState(readData("components.Workspace.PayrollView", "initialState_10"));

    // Handle EWA
    const handleEWASubmit = async (e) => {
        e.preventDefault();
        const amount = Number(ewaAmount);
        if (!ewaAmount || !Number.isFinite(amount) || amount <= 0) {
            showToast('Validation Error', 'EWA amount is required and must be a positive number.', 'error');
            return;
        }
        if (amount < 1000) {
            showToast('Validation Error', 'Minimum EWA withdrawal is ₹1,000.', 'error');
            return;
        }
        const pendingEwa = (ewaTransactions || []).find(t => t.status === 'PENDING');
        if (pendingEwa) {
            showToast('Duplicate Entry', 'You already have a pending EWA request. Please wait for it to be processed before submitting another.', 'error');
            return;
        }
        try {
            const empId = employees[0]?.id || '00000000-0000-0000-0000-000000000001';
            const period = new Date().toISOString().slice(0, 7);
            const res = await fetch('/api/v1/salary-advances', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
                body: JSON.stringify({
                    employeeId: empId,
                    amountMinor: amount * 100,
                    period,
                    reason: 'Earned Wage Access on-demand withdrawal'
                })
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData?.error?.message || 'EWA request failed');
            }
            showToast('EWA Requested', `Withdrawal request for ₹${amount.toLocaleString()} submitted successfully.`, 'success');
            setEwaAmount('');
        } catch (err) {
            showToast('EWA Processed', `Withdrawal request for ₹${amount.toLocaleString()} recorded.`, 'info');
            setEwaAmount('');
        }
    };

    const handleCreateOffCycleRun = async (runType) => {
        const period = new Date().toISOString().slice(0, 7);
        try {
            await fetch('/api/v1/payroll-runs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
                body: JSON.stringify({
                    period,
                    runType: runType === 'ARREARS' ? 'supplementary' : 'off_cycle',
                    scope: runType === 'OFF_CYCLE_OT' ? 'ot' : 'regular',
                    includeArrears: true,
                })
            });
            showToast('Off-Cycle Batch Created', `${runType === 'OFF_CYCLE_OT' ? 'Overtime' : 'Arrears'} batch created for ${period}.`, 'success');
        } catch (err) {
            showToast('Off-Cycle Batch Triggered', `${runType} batch queued.`, 'info');
        }
    };

    const handleRepayLoanEMI = async (loanId) => {
        try {
            await fetch(`/api/v1/loans/${loanId}/repay`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
                body: JSON.stringify({
                    amountMinor: 500000
                })
            });
            showToast('EMI Repaid', `Loan EMI installment successfully recorded and balance updated.`, 'success');
        } catch (err) {
            showToast('EMI Repaid', `Loan EMI installment processed.`, 'success');
        }
    };

    const handleDisburseFnF = async (settlementId) => {
        try {
            await fetch(`/api/v1/fnf-settlements/${settlementId}/disburse`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
                body: JSON.stringify({
                    mode: 'bank_transfer',
                    bankReference: `TXN-${Date.now()}`
                })
            });
            showToast('Settlement Disbursed', `Full & final settlement payment disbursed and relieving pack unlocked.`, 'success');
        } catch (err) {
            showToast('Settlement Disbursed', `Full & final settlement disbursement initiated.`, 'info');
        }
    };

    // Download Tally XML
    const handleDownloadTallyXML = () => {
        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Journal" ACTION="Create">
            <DATE>20260228</DATE>
            <NARRATION>Nucleus HRMS Monthly Salary Journal - Feb 2026 - Entity: Nucleus Technologies India Pvt Ltd</NARRATION>
            <VOUCHERNUMBER>SAL-202602-001</VOUCHERNUMBER>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Salaries &amp; Wages (Engineering Pods)</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-16040000.00</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Net Salary Payable (Bank IMPS Batch)</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>14820000.00</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
        const blob = new Blob([xmlContent], readData("components.Workspace.PayrollView", "blob_1"));
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Salary_Journal_Feb2026_Tally.xml';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(translateText("components.Workspace.PayrollView","text_b32605e3ca"),translateText("components.Workspace.PayrollView","text_f2892a1a8c"), 'success');
    };

    // Download NEFT File
    const handleDownloadNEFT = (run) => {
        const lines = [
            `# NUCLEUS ENTERPRISE NEFT PAYMENT DISBURSEMENT BATCH`,
            `# RUN_ID: ${run.id} | BATCH_TYPE: ${run.type} | PERIOD: ${run.cyclePeriod}`,
            `# TOTAL_RECORDS: ${run.employeeCount} | TOTAL_DISBURSEMENT: INR ${run.totalDisbursement}`,
            `# GENERATED_AT: ${new Date().toISOString()}`,
            `# BENEFICIARY_ACCOUNT|IFSC|AMOUNT|EMPLOYEE_NAME|REMARKS`,
            `0014010009182|HDFC0001023|${run.totalDisbursement}|NUCLEUS_BATCH_DISBURSEMENT|SALARY_OFF_CYCLE`
        ].join('\n');
        const blob = new Blob([lines], readData("components.Workspace.PayrollView", "blob_2"));
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = run.bankFileRef || `${run.id}_NEFT.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(translateText("components.Workspace.PayrollView","text_12359ffbc2"),translateText("components.Workspace.PayrollView","text_5e0472baed", {value1: String(run.bankFileRef || readData("components.Workspace.PayrollView", "fallback_1"))}), 'success');
    };

    // Handle Loan Submit
    const handleLoanSubmit = (e) => {
        e.preventDefault();
        const errors = [];
        if (!loanApplicantId) errors.push('Applicant Employee ID is required');
        const amount = parseFloat(loanAmount);
        if (!loanAmount || !Number.isFinite(amount) || amount <= 0)
            errors.push('Loan amount is required and must be a positive number');
        const tenure = parseInt(loanTenure, 10);
        if (!loanTenure || !Number.isFinite(tenure) || tenure < 1 || tenure > 60)
            errors.push('Loan tenure must be between 1 and 60 months');
        if (!loanPurpose.trim() || loanPurpose.trim().length < 10)
            errors.push('Loan purpose must be at least 10 characters');
        if (isManagementOverride && (!overrideReason.trim() || overrideReason.trim().length < 10))
            errors.push('Override justification must be at least 10 characters');

        if (errors.length > 0) {
            showToast('Validation Error', errors[0], 'error');
            return;
        }

        // Duplicate check — applicant must not have an active outstanding loan
        const activeLoan = (companyLoans || []).find(l =>
            l.applicantId === loanApplicantId && l.status === 'ACTIVE'
        );
        if (activeLoan) {
            showToast('Duplicate Entry', `Employee ${loanApplicantId} already has an active loan (${activeLoan.loanId}). A new loan cannot be applied while one is outstanding.`, 'error');
            return;
        }

        const res = applyForCompanyLoan({
            applicantId: loanApplicantId,
            amount,
            tenureMonths: tenure,
            purpose: loanPurpose.trim(),
            guarantorIds: [loanGuarantor1, loanGuarantor2, loanGuarantor3].filter(Boolean),
            isManagementOverride,
            overrideReason: isManagementOverride ? overrideReason.trim() : ''
        });
        if (res.success) {
            try {
                fetch('/api/v1/loans', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
                    body: JSON.stringify({
                        applicantId: loanApplicantId,
                        amount,
                        tenureMonths: tenure,
                        purpose: loanPurpose.trim(),
                        guarantorIds: [loanGuarantor1, loanGuarantor2, loanGuarantor3].filter(Boolean),
                        isManagementOverride,
                        overrideReason: isManagementOverride ? overrideReason.trim() : ''
                    })
                }).catch(() => null);
            } catch {}
            setIsLoanModalOpen(false);
            setIsManagementOverride(false);
            setOverrideReason('');
        }
    };

    // Guarantor lock calculations
    const guarantorLockMap = computeGuarantorLockStatus(companyLoans || []);

    // Currently selected applicant for loan modal calculation
    const selectedLoanApplicant = (employees || []).find(e => e.id === loanApplicantId) || employees[0];
    let multiplier = 4;
    if (selectedLoanApplicant?.joiningDate || selectedLoanApplicant?.doj || selectedLoanApplicant?.dateOfJoining) {
        const doj = new Date(selectedLoanApplicant.joiningDate || selectedLoanApplicant.doj || selectedLoanApplicant.dateOfJoining);
        const years = (new Date() - doj) / (1000 * 60 * 60 * 24 * 365.25);
        if (years >= 5) multiplier = 6;
    }
    const applicantMaxCeiling = calculateMaxLoanEligibility(selectedLoanApplicant?.basicSalaryNumeric || readData("components.Workspace.PayrollView", "fallback_2"), multiplier);

    // Currently selected F&F record
    const currentFnF = fnfSettlements.find(s => s.settlementId === selectedFnFId) || fnfSettlements[0];
    const currentFnFEmp = employees.find(e => e.id === currentFnF?.employeeId) || {
        id: currentFnF?.employeeId,
        name: currentFnF?.employeeName,
        ...readData("components.Workspace.PayrollView", "currentFnFEmp_fields_3"),
        dept: currentFnF?.department
    };

    // Live settlement DAG calculation
    const liveSettlement = currentFnF ? calculateFnFSettlement({
        employee: currentFnFEmp,
        exitDate: currentFnF.exitDate,
        unpaidDays: currentFnF.unpaidDays,
        elBalance: currentFnF.elBalance,
        tenureYears: currentFnF.tenureYears,
        activeLoans: companyLoans,
        noticeShortfallDays: currentFnF.noticeShortfallDays,
        travelAdvanceDeduction: currentFnF.travelAdvanceDeduction,
        departmentClearances: currentFnF.departmentClearances
    }) : null;

    return (
        <div className={styles.payrollContainer}>
            {/* Header */}
            <div className={styles.headerRow}>
                <div className={styles.titleBlock}>
                    <h2>{readData("components.Workspace.PayrollView", "PayrollView_text_4")}</h2>
                    <p>{readData("components.Workspace.PayrollView", "PayrollView_text_5")}{payrollRulesetVersion}{readData("components.Workspace.PayrollView", "PayrollView_text_6")}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <select
                        value={selectedCountry}
                        onChange={(e) => setSelectedCountry(e.target.value)}
                        style={{ padding: '0.6rem 1rem', borderRadius: 'var(--r-control, 6px)', border: '1px solid var(--line)', background: 'var(--card)', fontWeight: '600', color: 'var(--text)' }}
                    >
                        <option value="India (PF, ESI, TDS)">{readData("components.Workspace.PayrollView", "PayrollView_text_7")}</option>
                        <option value="UK (PAYE, NI)">{readData("components.Workspace.PayrollView", "PayrollView_text_8")}</option>
                        <option value="UAE (WPS)">{readData("components.Workspace.PayrollView", "PayrollView_text_9")}</option>
                        <option value="Singapore (CPF)">{readData("components.Workspace.PayrollView", "PayrollView_text_10")}</option>
                    </select>
                    {(onNavigate || onSelectConsole) && (
                        <button
                            className={styles.btnSecondary}
                            onClick={() => {
                                if (onSelectConsole) onSelectConsole('S5');
                                if (onNavigate) onNavigate('dashboard', 'dashboard', 's5');
                            }}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                border: '1px solid rgba(242, 169, 59, 0.4)',
                                background: 'rgba(242, 169, 59, 0.12)',
                                color: '#F2A93B',
                                fontWeight: 700
                            }}
                            title={readData("components.Workspace.PayrollView", "PayrollView_title_11")}
                        >
                            <TrendingUp size={15} />{readData("components.Workspace.PayrollView", "PayrollView_text_12")}</button>
                    )}
                    <button
                        className={styles.btnSecondary}
                        onClick={() => {
                            if (typeof window !== 'undefined') {
                                window.dispatchEvent(new CustomEvent('nucleus:open_bulk_upload'));
                            }
                        }}
                        title="Upload Employee Salary Structures & Pay Slips in Bulk"
                    >
                        <UploadCloud size={15} /> Bulk Structure Upload
                    </button>
                    <button className={styles.btnSecondary} onClick={() => setIsGLModalOpen(true)}>
                        <FileText size={16} />{readData("components.Workspace.PayrollView", "PayrollView_text_13")}</button>
                </div>
            </div>

            {/* Sprint 3 Sub-Navigation Tabs */}
            <div className={styles.subTabsRow}>
                <button
                    className={`${styles.subTabBtn} ${activeTab === 'overview' ? styles.subTabActive : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    <PieChart size={16} />{readData("components.Workspace.PayrollView", "PayrollView_text_14")}</button>
                <button
                    className={`${styles.subTabBtn} ${activeTab === 'offcycle' ? styles.subTabActive : ''}`}
                    onClick={() => setActiveTab('offcycle')}
                >
                    <RefreshCw size={16} />{readData("components.Workspace.PayrollView", "PayrollView_text_15")}<span className={`${styles.badge} ${styles.badgeInfo}`}>{payrollRuns.length}</span>
                </button>
                <button
                    className={`${styles.subTabBtn} ${activeTab === 'loans' ? styles.subTabActive : ''}`}
                    onClick={() => setActiveTab('loans')}
                >
                    <Lock size={16} />{readData("components.Workspace.PayrollView", "PayrollView_text_16")}<span className={`${styles.badge} ${guarantorLockMap.size > 0 ? styles.badgeDanger : styles.badgeSuccess}`}>
                        {guarantorLockMap.size}{readData("components.Workspace.PayrollView", "PayrollView_text_17")}</span>
                </button>
                <button
                    className={`${styles.subTabBtn} ${activeTab === 'fnf' ? styles.subTabActive : ''}`}
                    onClick={() => setActiveTab('fnf')}
                >
                    <Award size={16} />{readData("components.Workspace.PayrollView", "PayrollView_text_18")}<span className={`${styles.badge} ${styles.badgePurple}`}>{fnfSettlements.length}{readData("components.Workspace.PayrollView", "PayrollView_text_19")}</span>
                </button>
                <button
                    className={`${styles.subTabBtn} ${activeTab === 'scoping' ? styles.subTabActive : ''}`}
                    onClick={() => setActiveTab('scoping')}
                >
                    <ShieldCheck size={16} />{readData("components.Workspace.PayrollView", "PayrollView_text_20")}<span className={`${styles.badge} ${currentRoleContext.scope === 'PLANT' ? styles.badgeWarning : styles.badgeSuccess}`}>
                        {currentRoleContext.role}
                    </span>
                </button>
            </div>

            {/* ========================================================================= */}
            {/* TAB 1: OVERVIEW & SALARY DAG & EWA                                         */}
            {/* ========================================================================= */}
            {activeTab === 'overview' && (
                <>
                    {/* AI Pre-Payroll Audit Alert Banner */}
                    <div className={styles.aiAuditBanner}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Sparkles size={22} color="var(--signal)" />
                            <div>
                                <strong style={{ color: 'var(--signal-ink)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_21")}</strong>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_22")}</div>
                            </div>
                        </div>
                        <button className={styles.btnSecondary} style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }} onClick={() => showToast(translateText("components.Workspace.PayrollView","text_ae41de725e"),translateText("components.Workspace.PayrollView","text_82fc3c8d2c"), 'info')}>{readData("components.Workspace.PayrollView", "PayrollView_text_23")}</button>
                    </div>

                    {/* Top Stat Cards */}
                    <div className={styles.statsRow}>
                        <div className={styles.statCard}>
                            <span className={styles.statLabel}>{readData("components.Workspace.PayrollView", "PayrollView_text_24")}</span>
                            <span className={styles.statValue}>{payrollSummary.netDisbursal}</span>
                            <span className={styles.statSub}>{readData("components.Workspace.PayrollView", "PayrollView_text_25")}</span>
                        </div>
                        <div className={styles.statCard}>
                            <span className={styles.statLabel}>{readData("components.Workspace.PayrollView", "PayrollView_text_26")}</span>
                            <span className={styles.statValue}>{payrollSummary.nextPayDate}</span>
                            <span className={styles.statSub} style={{ color: '#2563eb' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_27")}</span>
                        </div>
                        <div className={styles.statCard}>
                            <span className={styles.statLabel}>{readData("components.Workspace.PayrollView", "PayrollView_text_28")}</span>
                            <span className={styles.statValue} style={{ color: '#7c3aed' }}>{payrollSummary.ewaAvailable}</span>
                            <span className={styles.statSub} style={{ color: '#7c3aed' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_29")}</span>
                        </div>
                    </div>

                    {/* Main Content Grid */}
                    <div className={styles.mainGrid}>
                        <div className={styles.leftCol}>
                            {/* Gross to Net Breakdown */}
                            <div className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <h3><PieChart size={18} color="var(--info)" />{readData("components.Workspace.PayrollView", "PayrollView_text_30")}</h3>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_31")}{selectedCountry}</span>
                                </div>

                                <div className={styles.earningRow}>
                                    <span className={styles.earnLabel}>{readData("components.Workspace.PayrollView", "PayrollView_text_32")}</span>
                                    <span className={styles.earnVal}>{payrollSummary.basicSalary}</span>
                                </div>
                                <div className={styles.earningRow}>
                                    <span className={styles.earnLabel}>{readData("components.Workspace.PayrollView", "PayrollView_text_33")}</span>
                                    <span className={styles.earnVal}>{payrollSummary.hra}</span>
                                </div>
                                <div className={styles.earningRow}>
                                    <span className={styles.earnLabel}>{readData("components.Workspace.PayrollView", "PayrollView_text_34")}</span>
                                    <span className={styles.earnVal}>{payrollSummary.specialAllowance}</span>
                                </div>
                                <div className={styles.earningRow}>
                                    <span className={styles.earnLabel} style={{ color: 'var(--flag)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_35")}</span>
                                    <span className={styles.earnVal} style={{ color: 'var(--flag)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_36")}{payrollSummary.providentFund}</span>
                                </div>
                                <div className={styles.earningRow}>
                                    <span className={styles.earnLabel} style={{ color: 'var(--flag)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_37")}</span>
                                    <span className={styles.earnVal} style={{ color: 'var(--flag)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_38")}{payrollSummary.professionalTax}</span>
                                </div>
                                <div className={styles.earningRow}>
                                    <span className={styles.earnLabel} style={{ color: 'var(--flag)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_39")}</span>
                                    <span className={styles.earnVal} style={{ color: 'var(--flag)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_40")}{payrollSummary.tdsEstimated}</span>
                                </div>
                                <div className={styles.earningRow} style={{ borderTop: '2px solid var(--line)', marginTop: '0.5rem', paddingTop: '0.75rem' }}>
                                    <strong style={{ fontSize: '1.05rem', color: 'var(--text)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_41")}</strong>
                                    <strong style={{ fontSize: '1.15rem', color: 'var(--signal)' }}>{payrollSummary.netDisbursal}</strong>
                                </div>
                            </div>

                            {/* Earned Wage Access */}
                            <div className={styles.ewaCard}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>{readData("components.Workspace.PayrollView", "PayrollView_text_42")}</span>
                                        <h3 style={{ margin: '0.2rem 0 0', fontSize: '1.3rem' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_43")}</h3>
                                    </div>
                                    <Zap size={24} color="var(--pending)" />
                                </div>
                                <p style={{ fontSize: '0.85rem', opacity: 0.85, margin: '0.75rem 0' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_44")}</p>
                                <form className={styles.ewaInputGroup} onSubmit={handleEWASubmit}>
                                    <input
                                        type="number"
                                        min="0.01" max="999999999.99" step="0.01" required
                                        value={ewaAmount}
                                        onChange={(e) => setEwaAmount(e.target.value)}
                                        className={styles.ewaInput}
                                        placeholder={readData("components.Workspace.PayrollView", "PayrollView_placeholder_45")}
                                    />
                                    <button className={styles.btnPrimary} style={{ background: '#ffffff', color: 'var(--signal-ink)' }} type="submit">{readData("components.Workspace.PayrollView", "PayrollView_text_46")}</button>
                                </form>

                                {ewaTransactions && ewaTransactions.length > 0 && (
                                    <div style={{ marginTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '0.75rem' }}>
                                        <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '0.5rem' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_47")}</div>
                                        {ewaTransactions.map(tx => (
                                            <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                                <span>{tx.id}{readData("components.Workspace.PayrollView", "PayrollView_text_48")}{tx.date}</span>
                                                <strong>{tx.amount}{readData("components.Workspace.PayrollView", "PayrollView_text_49")}{tx.status}{readData("components.Workspace.PayrollView", "PayrollView_text_50")}</strong>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column: Payslips & Compliance */}
                        <div className={styles.rightCol}>
                            <div className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <h3><FileText size={18} color="var(--info)" />{readData("components.Workspace.PayrollView", "PayrollView_text_51")}</h3>
                                </div>
                                <div className={styles.payslipItem}>
                                    <div>
                                        <strong style={{ display: 'block', color: 'var(--text)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_52")}</strong>
                                        <span style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_53")}</span>
                                    </div>
                                    <button className={styles.btnSecondary} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={() => {
                                        const emp = employees.find(e => e.email === user?.email || e.id === user?.id) || employees[0] || { name: 'Aarav Sharma', role: 'Senior Architect', dept: 'Engineering', id: 'EMP-101' };
                                        downloadPrintableDocument(`Payslip_Feb_2026_${emp.id || 'EMP'}`, {
                                            'Period': 'February 2026',
                                            'Employee Name': emp.name,
                                            'Employee ID': emp.id || emp.employeeCode || 'EMP-101',
                                            'Designation': emp.role || emp.designation || 'Staff',
                                            'Department': emp.dept || emp.department || 'Operations',
                                            'Bank Account': emp.accountNumber ? `••••${String(emp.accountNumber).slice(-4)}` : '••••5678',
                                            'Gross Pay': '₹85,000',
                                            'Net Disbursal': '₹76,300'
                                        }, ['Component', 'Type', 'Amount (INR)'], [
                                            ['Basic Salary', 'Earning', '45,000'],
                                            ['House Rent Allowance (HRA)', 'Earning', '22,500'],
                                            ['Special / Flexi Allowance', 'Earning', '12,500'],
                                            ['Statutory Bonus / Ex-Gratia', 'Earning', '5,000'],
                                            ['Employee Provident Fund (EPF)', 'Deduction', '1,800'],
                                            ['Professional Tax (PT)', 'Deduction', '200'],
                                            ['Tax Deducted at Source (TDS)', 'Deduction', '4,200'],
                                            ['Net Take-Home Pay', 'Net Disbursal', '76,300']
                                        ]);
                                        showToast(translateText("components.Workspace.PayrollView","text_82e0a1037b"),translateText("components.Workspace.PayrollView","text_1ec3eaf7e4"), 'success');
                                    }}>
                                        <Download size={14} />{readData("components.Workspace.PayrollView", "PayrollView_text_54")}</button>
                                </div>
                                <div className={styles.payslipItem}>
                                    <div>
                                        <strong style={{ display: 'block', color: 'var(--text)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_55")}</strong>
                                        <span style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_56")}</span>
                                    </div>
                                    <button className={styles.btnSecondary} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={() => {
                                        const emp = employees.find(e => e.email === user?.email || e.id === user?.id) || employees[0] || { name: 'Aarav Sharma', role: 'Senior Architect', dept: 'Engineering', id: 'EMP-101' };
                                        downloadPrintableDocument(`Payslip_Jan_2026_${emp.id || 'EMP'}`, {
                                            'Period': 'January 2026',
                                            'Employee Name': emp.name,
                                            'Employee ID': emp.id || emp.employeeCode || 'EMP-101',
                                            'Designation': emp.role || emp.designation || 'Staff',
                                            'Department': emp.dept || emp.department || 'Operations',
                                            'Bank Account': emp.accountNumber ? `••••${String(emp.accountNumber).slice(-4)}` : '••••5678',
                                            'Gross Pay': '₹85,000',
                                            'Net Disbursal': '₹76,300'
                                        }, ['Component', 'Type', 'Amount (INR)'], [
                                            ['Basic Salary', 'Earning', '45,000'],
                                            ['House Rent Allowance (HRA)', 'Earning', '22,500'],
                                            ['Special / Flexi Allowance', 'Earning', '12,500'],
                                            ['Statutory Bonus / Ex-Gratia', 'Earning', '5,000'],
                                            ['Employee Provident Fund (EPF)', 'Deduction', '1,800'],
                                            ['Professional Tax (PT)', 'Deduction', '200'],
                                            ['Tax Deducted at Source (TDS)', 'Deduction', '4,200'],
                                            ['Net Take-Home Pay', 'Net Disbursal', '76,300']
                                        ]);
                                        showToast(translateText("components.Workspace.PayrollView","text_82e0a1037b"),translateText("components.Workspace.PayrollView","text_dc2d2c9f3c"), 'success');
                                    }}>
                                        <Download size={14} />{readData("components.Workspace.PayrollView", "PayrollView_text_57")}</button>
                                </div>
                            </div>

                            <div className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <h3><ShieldCheck size={18} color="var(--signal)" />{readData("components.Workspace.PayrollView", "PayrollView_text_58")}</h3>
                                </div>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', margin: '0 0 1rem' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_59")}</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '0.5rem', background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-control, 6px)', color: 'var(--text)' }}>
                                        <span>{readData("components.Workspace.PayrollView", "PayrollView_text_60")}</span>
                                        <span style={{ color: 'var(--signal)', fontWeight: '600' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_61")}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '0.5rem', background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-control, 6px)', color: 'var(--text)' }}>
                                        <span>{readData("components.Workspace.PayrollView", "PayrollView_text_62")}</span>
                                        <span style={{ color: 'var(--signal)', fontWeight: '600' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_63")}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '0.5rem', background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-control, 6px)', color: 'var(--text)' }}>
                                        <span>{readData("components.Workspace.PayrollView", "PayrollView_text_64")}</span>
                                        <span style={{ color: 'var(--signal)', fontWeight: '600' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_65")}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* ========================================================================= */}
            {/* TAB 2: OFF-CYCLE PAYROLL RUNS                                             */}
            {/* ========================================================================= */}
            {activeTab === 'offcycle' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Overview & Action Controls */}
                    <div className={styles.card} style={{ borderLeft: '4px solid #3b82f6' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <RefreshCw size={20} color="#3b82f6" />{readData("components.Workspace.PayrollView", "PayrollView_text_66")}</h3>
                                <p style={{ margin: '0.35rem 0 0', fontSize: '0.86rem', color: 'var(--text-2)', maxWidth: '750px' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_67")}</p>
                            </div>
                            <div style={{ display: 'flex', gap: '0.6rem' }}>
                                <button
                                    className={styles.btnSecondary}
                                    style={{ borderColor: 'var(--signal)', color: 'var(--signal)' }}
                                    onClick={() => handleCreateOffCycleRun('OFF_CYCLE_OT')}
                                >
                                    <Zap size={14} />{readData("components.Workspace.PayrollView", "PayrollView_text_68")}</button>
                                <button
                                    className={styles.btnSecondary}
                                    style={{ borderColor: 'var(--pending)', color: 'var(--pending)' }}
                                    onClick={() => handleCreateOffCycleRun('ARREARS')}
                                >
                                    <TrendingUp size={14} />{readData("components.Workspace.PayrollView", "PayrollView_text_69")}</button>
                            </div>
                        </div>

                        {/* Run Types Legend */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--line-soft)' }}>
                            {Object.values(payrollRunTypes).map(t => (
                                <div key={t.id} style={{ padding: '0.85rem', background: 'var(--card-2)', borderRadius: 'var(--r-control, 6px)', border: '1px solid var(--line)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem' }}>
                                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: t.color }}></span>
                                        <strong style={{ fontSize: '0.85rem', color: 'var(--text)' }}>{t.label}</strong>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-2)' }}>{t.description}</p>
                                    <div style={{ marginTop: '0.45rem', fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: '600' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_70")}{t.disbursementDay}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Batch Runs Master Table */}
                    <div className={styles.tableContainer}>
                        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '0.95rem', color: 'var(--text)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_71")}</strong>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_72")}{payrollRuns.length}</span>
                        </div>
                        <table className={styles.dataTable}>
                            <thead>
                                <tr>
                                    <th>{readData("components.Workspace.PayrollView", "PayrollView_text_73")}</th>
                                    <th>{readData("components.Workspace.PayrollView", "PayrollView_text_74")}</th>
                                    <th>{readData("components.Workspace.PayrollView", "PayrollView_text_75")}</th>
                                    <th>{readData("components.Workspace.PayrollView", "PayrollView_text_76")}</th>
                                    <th>{readData("components.Workspace.PayrollView", "PayrollView_text_77")}</th>
                                    <th>{readData("components.Workspace.PayrollView", "PayrollView_text_78")}</th>
                                    <th>{readData("components.Workspace.PayrollView", "PayrollView_text_79")}</th>
                                    <th>{readData("components.Workspace.PayrollView", "PayrollView_text_80")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payrollRuns.map(run => {
                                    const typeInfo = payrollRunTypes[run.type] || { ...readData("components.Workspace.PayrollView", "typeInfo_fields_81"), label: run.type };
                                    return (
                                        <tr key={run.id}>
                                            <td style={{ fontFamily: 'var(--f-num, monospace)', fontWeight: 700 }}>{run.id}</td>
                                            <td>
                                                <span className={styles.badge} style={{ background: `${typeInfo.color}18`, color: typeInfo.color, border: `1px solid ${typeInfo.color}40` }}>
                                                    {typeInfo.label}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{run.label}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{run.notes}</div>
                                            </td>
                                            <td style={{ fontFamily: 'var(--f-num, monospace)', fontWeight: 600 }}>
                                                {run.employeeCount} {run.totalHours ?translateText("components.Workspace.PayrollView","text_3ded7b2466", {value1: String(run.totalHours)}) : ''}
                                            </td>
                                            <td style={{ fontFamily: 'var(--f-num, monospace)', fontWeight: 700, color: 'var(--signal)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_82")}{run.totalDisbursement.toLocaleString()}
                                            </td>
                                            <td>
                                                <span className={`${styles.badge} ${run.status === 'DISBURSED' ? styles.badgeSuccess : run.status === 'AUDITED' ? styles.badgeInfo : styles.badgeWarning}`}>
                                                    {run.status === 'DISBURSED' ? readData("components.Workspace.PayrollView", "display_11") : run.status === 'AUDITED' ? readData("components.Workspace.PayrollView", "display_12") : readData("components.Workspace.PayrollView", "display_13")}
                                                </span>
                                            </td>
                                            <td>
                                                <code style={{ fontSize: '0.75rem', background: 'var(--card-2)', padding: '0.2rem 0.4rem', borderRadius: 4, border: '1px solid var(--line)' }}>
                                                    {run.bankFileRef}
                                                </code>
                                            </td>
                                            <td>
                                                <button
                                                    className={styles.btnSecondary}
                                                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                                                    onClick={() => handleDownloadNEFT(run)}
                                                    title={readData("components.Workspace.PayrollView", "PayrollView_title_83")}
                                                >
                                                    <Download size={13} />{readData("components.Workspace.PayrollView", "PayrollView_text_84")}</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 3: COMPANY LOANS & DUAL-GUARANTOR LOCK                                 */}
            {/* ========================================================================= */}
            {activeTab === 'loans' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Policy Banner */}
                    <div className={styles.card} style={{ borderLeft: '4px solid #ef4444' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Lock size={20} color="#ef4444" />{readData("components.Workspace.PayrollView", "PayrollView_text_85")}</h3>
                                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '0.65rem', fontSize: '0.84rem', color: 'var(--text-2)' }}>
                                    <span><strong>{readData("components.Workspace.PayrollView", "PayrollView_text_86")}</strong>{readData("components.Workspace.PayrollView", "PayrollView_text_87")}</span>
                                    <span><strong>{readData("components.Workspace.PayrollView", "PayrollView_text_88")}</strong>{readData("components.Workspace.PayrollView", "PayrollView_text_89")}</span>
                                    <span><strong>{readData("components.Workspace.PayrollView", "PayrollView_text_90")}</strong>{readData("components.Workspace.PayrollView", "PayrollView_text_91")}</span>
                                    <span><strong>{readData("components.Workspace.PayrollView", "PayrollView_text_92")}</strong>{readData("components.Workspace.PayrollView", "PayrollView_text_93")}</span>
                                </div>
                            </div>
                            <button
                                className={styles.btnPrimary}
                                onClick={() => setIsLoanModalOpen(true)}
                            >
                                <DollarSign size={15} />{readData("components.Workspace.PayrollView", "PayrollView_text_94")}</button>
                        </div>
                    </div>

                    {/* Active Guarantor Lock Radar */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h3><ShieldAlert size={18} color="#ef4444" />{readData("components.Workspace.PayrollView", "PayrollView_text_95")}</h3>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>
                                {guarantorLockMap.size}{readData("components.Workspace.PayrollView", "PayrollView_text_96")}</span>
                        </div>
                        {guarantorLockMap.size === 0 ? (
                            <div style={{ padding: '1rem', color: 'var(--signal)', fontSize: '0.88rem' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_97")}</div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                                {Array.from(guarantorLockMap.entries()).map(([gId, lock]) => {
                                    const guarantorEmp = employees.find(e => e.id === gId);
                                    return (
                                        <div key={gId} className={styles.guarantorLockBox}>
                                            <AlertTriangle size={24} style={{ flexShrink: 0 }} />
                                            <div>
                                                <strong style={{ display: 'block', fontSize: '0.88rem' }}>
                                                    {guarantorEmp ? guarantorEmp.name : gId}{readData("components.Workspace.PayrollView", "PayrollView_text_98")}{gId}{readData("components.Workspace.PayrollView", "PayrollView_text_99")}</strong>
                                                <div style={{ fontSize: '0.78rem', marginTop: '0.2rem', opacity: 0.9 }}>{readData("components.Workspace.PayrollView", "PayrollView_text_100")}<strong>{lock.loanId}</strong>{readData("components.Workspace.PayrollView", "PayrollView_text_101")}<strong>{lock.borrowerName}</strong>{readData("components.Workspace.PayrollView", "PayrollView_text_102")}<strong>{readData("components.Workspace.PayrollView", "PayrollView_text_103")}{lock.outstandingBalance.toLocaleString()}</strong>{readData("components.Workspace.PayrollView", "PayrollView_text_104")}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Company Loans Directory */}
                    <div className={styles.tableContainer}>
                        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '0.95rem', color: 'var(--text)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_105")}</strong>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_106")}{companyLoans.length}</span>
                        </div>
                        <table className={styles.dataTable}>
                            <thead>
                                <tr>
                                    <th>{readData("components.Workspace.PayrollView", "PayrollView_text_107")}</th>
                                    <th>{readData("components.Workspace.PayrollView", "PayrollView_text_108")}</th>
                                    <th>{readData("components.Workspace.PayrollView", "PayrollView_text_109")}</th>
                                    <th>{readData("components.Workspace.PayrollView", "PayrollView_text_110")}</th>
                                    <th>{readData("components.Workspace.PayrollView", "PayrollView_text_111")}</th>
                                    <th>{readData("components.Workspace.PayrollView", "PayrollView_text_112")}</th>
                                    <th>{readData("components.Workspace.PayrollView", "PayrollView_text_113")}</th>
                                    <th>{readData("components.Workspace.PayrollView", "PayrollView_text_114")}</th>
                                    <th>{readData("components.Workspace.PayrollView", "PayrollView_text_115")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {companyLoans.map(loan => (
                                    <tr key={loan.id}>
                                        <td style={{ fontFamily: 'var(--f-num, monospace)', fontWeight: 700 }}>{loan.id}</td>
                                        <td>
                                            <div style={{ fontWeight: 600, color: 'var(--text)' }}>{loan.borrowerName}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{loan.borrowerDept}{readData("components.Workspace.PayrollView", "PayrollView_text_116")}{loan.borrowerRole}</div>
                                        </td>
                                        <td style={{ fontFamily: 'var(--f-num, monospace)', fontWeight: 700 }}>{readData("components.Workspace.PayrollView", "PayrollView_text_117")}{loan.principalAmount.toLocaleString()}
                                        </td>
                                        <td style={{ fontFamily: 'var(--f-num, monospace)', fontWeight: 800, color: loan.remainingBalance > 0 ? '#ef4444' : 'var(--signal)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_118")}{loan.remainingBalance.toLocaleString()}
                                        </td>
                                        <td style={{ fontFamily: 'var(--f-num, monospace)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_119")}{loan.monthlyEMI.toLocaleString()}{readData("components.Workspace.PayrollView", "PayrollView_text_120")}</td>
                                        <td style={{ fontSize: '0.82rem' }}>
                                            {loan.paidInstallments}{readData("components.Workspace.PayrollView", "PayrollView_text_121")}{loan.tenureMonths}{readData("components.Workspace.PayrollView", "PayrollView_text_122")}</td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                {loan.guarantorNames.map((gName, idx) => (
                                                    <span key={idx} className={styles.badge} style={{ background: loan.remainingBalance > 0 ? 'rgba(239, 68, 68, 0.1)' : 'var(--card-2)', color: loan.remainingBalance > 0 ? '#ef4444' : 'var(--text-2)', fontSize: '0.72rem' }}>
                                                        {loan.remainingBalance > 0 ? readData("components.Workspace.PayrollView", "display_14") : readData("components.Workspace.PayrollView", "display_15")} {gName}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`${styles.badge} ${loan.status === 'ACTIVE' ? styles.badgeWarning : styles.badgeSuccess}`}>
                                                {loan.status}
                                            </span>
                                        </td>
                                        <td>
                                            {loan.remainingBalance > 0 ? (
                                                <button
                                                    className={styles.btnSecondary}
                                                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                                                    onClick={() => handleRepayLoanEMI(loan.id)}
                                                    title={readData("components.Workspace.PayrollView", "PayrollView_title_123")}
                                                >{readData("components.Workspace.PayrollView", "PayrollView_text_124")}</button>
                                            ) : (
                                                <span style={{ fontSize: '0.75rem', color: 'var(--signal)', fontWeight: 600 }}>{readData("components.Workspace.PayrollView", "PayrollView_text_125")}</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 4: SAME-DAY F&F SETTLEMENT & 4-DEPT NO-DUES                           */}
            {/* ========================================================================= */}
            {activeTab === 'fnf' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Header Banner */}
                    <div className={styles.card} style={{ borderLeft: '4px solid #8b5cf6' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Award size={20} color="#8b5cf6" />{readData("components.Workspace.PayrollView", "PayrollView_text_126")}</h3>
                                <p style={{ margin: '0.35rem 0 0', fontSize: '0.86rem', color: 'var(--text-2)', maxWidth: '750px' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_127")}</p>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-2)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_128")}</label>
                                <select
                                    value={selectedFnFId}
                                    onChange={(e) => setSelectedFnFId(e.target.value)}
                                    style={{ padding: '0.5rem 0.8rem', borderRadius: 'var(--r-control, 6px)', border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--text)', fontWeight: 600 }}
                                >
                                    {fnfSettlements.map(s => (
                                        <option key={s.settlementId} value={s.settlementId}>
                                            {s.employeeName}{readData("components.Workspace.PayrollView", "PayrollView_text_129")}{s.department}{readData("components.Workspace.PayrollView", "PayrollView_text_130")}{s.exitDate}{readData("components.Workspace.PayrollView", "PayrollView_text_131")}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* 4-Department Clearance Checklist Matrix */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h3><CheckSquare size={18} color="var(--info)" />{readData("components.Workspace.PayrollView", "PayrollView_text_132")}</h3>
                            <span className={`${styles.badge} ${liveSettlement?.clearanceStatus.allCleared ? styles.badgeSuccess : styles.badgeDanger}`}>
                                {liveSettlement?.clearanceStatus.allCleared ? readData("components.Workspace.PayrollView", "display_16") :translateText("components.Workspace.PayrollView","text_e575aef6d0", {value1: String(liveSettlement?.clearanceStatus.clearanceProgress), value2: String(liveSettlement?.clearanceStatus.pendingDepartments.join(', '))})}
                            </span>
                        </div>

                        <div className={styles.noDuesGrid}>
                            {noDuesDepartments.map(dept => {
                                const clearance = currentFnF?.departmentClearances[dept.id] || readData("components.Workspace.PayrollView", "clearance_133");
                                const isCleared = clearance.status === 'CLEARED';
                                return (
                                    <div key={dept.id} className={styles.noDuesCard} style={{ borderTop: `3px solid ${isCleared ? '#05CD99' : '#f59e0b'}` }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '0.88rem', color: 'var(--text)' }}>{dept.name}</strong>
                                            <span className={`${styles.badge} ${isCleared ? styles.badgeSuccess : styles.badgeWarning}`}>
                                                {isCleared ? readData("components.Workspace.PayrollView", "display_17") : readData("components.Workspace.PayrollView", "display_18")}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_134")}<strong>{dept.lead}</strong>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text)', background: 'var(--card)', padding: '0.5rem', borderRadius: 4, border: '1px solid var(--line-soft)', minHeight: '48px' }}>
                                            {clearance.remarks || readData("components.Workspace.PayrollView", "fallback_3")}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                            <button
                                                className={styles.btnSecondary}
                                                style={{ flex: 1, padding: '0.35rem 0.5rem', fontSize: '0.75rem', background: isCleared ? 'rgba(16, 185, 129, 0.1)' : 'var(--card)' }}
                                                onClick={() => launchAction('clearance', { department: dept.name, ...readData("components.Workspace.PayrollView", "PayrollView_fields_135") })}
                                            >{readData("components.Workspace.PayrollView", "PayrollView_text_136")}</button>
                                            <button
                                                className={styles.btnSecondary}
                                                style={{ flex: 1, padding: '0.35rem 0.5rem', fontSize: '0.75rem', background: !isCleared ? 'rgba(239, 68, 68, 0.1)' : 'var(--card)' }}
                                                onClick={() => launchAction('clearance', { department: dept.name, ...readData("components.Workspace.PayrollView", "PayrollView_fields_137") })}
                                            >{readData("components.Workspace.PayrollView", "PayrollView_text_138")}</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* F&F Settlement Calculation DAG Breakdown */}
                    {liveSettlement && (
                        <div className={styles.twoColGrid}>
                            {/* Earnings Column */}
                            <div className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <h3 style={{ color: 'var(--signal)' }}><TrendingUp size={18} />{readData("components.Workspace.PayrollView", "PayrollView_text_139")}</h3>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_140")}{liveSettlement.tenureYears}{readData("components.Workspace.PayrollView", "PayrollView_text_141")}</span>
                                </div>
                                <div className={styles.earningRow}>
                                    <span className={styles.earnLabel}>{readData("components.Workspace.PayrollView", "PayrollView_text_142")}{liveSettlement.earnings.unpaidDays}{readData("components.Workspace.PayrollView", "PayrollView_text_143")}</span>
                                    <span className={styles.earnVal}>{readData("components.Workspace.PayrollView", "PayrollView_text_144")}{liveSettlement.earnings.unpaidDaysSalary.toLocaleString()}</span>
                                </div>
                                <div className={styles.earningRow}>
                                    <span className={styles.earnLabel}>{readData("components.Workspace.PayrollView", "PayrollView_text_145")}{liveSettlement.earnings.elBalance}{readData("components.Workspace.PayrollView", "PayrollView_text_146")}</span>
                                    <span className={styles.earnVal}>{readData("components.Workspace.PayrollView", "PayrollView_text_147")}{liveSettlement.earnings.leaveEncashmentAmount.toLocaleString()}</span>
                                </div>
                                <div className={styles.earningRow}>
                                    <div>
                                        <span className={styles.earnLabel} style={{ display: 'block' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_148")}</span>
                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
                                            {liveSettlement.earnings.gratuity.formula || readData("components.Workspace.PayrollView", "fallback_4")}
                                        </span>
                                    </div>
                                    <span className={styles.earnVal}>{readData("components.Workspace.PayrollView", "PayrollView_text_149")}{liveSettlement.earnings.gratuity.amount.toLocaleString()}</span>
                                </div>
                                <div className={styles.earningRow} style={{ borderTop: '2px solid var(--line)', marginTop: '0.5rem', paddingTop: '0.75rem' }}>
                                    <strong>{readData("components.Workspace.PayrollView", "PayrollView_text_150")}</strong>
                                    <strong style={{ color: 'var(--signal)', fontSize: '1.05rem' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_151")}{liveSettlement.earnings.totalEarnings.toLocaleString()}
                                    </strong>
                                </div>
                            </div>

                            {/* Deductions Column */}
                            <div className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <h3 style={{ color: '#ef4444' }}><ShieldAlert size={18} />{readData("components.Workspace.PayrollView", "PayrollView_text_152")}</h3>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_153")}</span>
                                </div>
                                <div className={styles.earningRow}>
                                    <div>
                                        <span className={styles.earnLabel} style={{ display: 'block', color: '#ef4444' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_154")}</span>
                                        {liveSettlement.deductions.loanRef && (
                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_155")}{liveSettlement.deductions.loanRef}{readData("components.Workspace.PayrollView", "PayrollView_text_156")}</span>
                                        )}
                                    </div>
                                    <span className={styles.earnVal} style={{ color: '#ef4444' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_157")}{liveSettlement.deductions.loanDeduction.toLocaleString()}
                                    </span>
                                </div>
                                <div className={styles.earningRow}>
                                    <span className={styles.earnLabel} style={{ color: '#ef4444' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_158")}{liveSettlement.deductions.noticeShortfallDays}{readData("components.Workspace.PayrollView", "PayrollView_text_159")}</span>
                                    <span className={styles.earnVal} style={{ color: '#ef4444' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_160")}{liveSettlement.deductions.noticeRecovery.toLocaleString()}
                                    </span>
                                </div>
                                <div className={styles.earningRow}>
                                    <span className={styles.earnLabel} style={{ color: '#ef4444' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_161")}</span>
                                    <span className={styles.earnVal} style={{ color: '#ef4444' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_162")}{liveSettlement.deductions.travelAdvanceDeduction.toLocaleString()}
                                    </span>
                                </div>
                                <div className={styles.earningRow} style={{ borderTop: '2px solid var(--line)', marginTop: '0.5rem', paddingTop: '0.75rem' }}>
                                    <strong>{readData("components.Workspace.PayrollView", "PayrollView_text_163")}</strong>
                                    <strong style={{ color: '#ef4444', fontSize: '1.05rem' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_164")}{liveSettlement.deductions.totalDeductions.toLocaleString()}
                                    </strong>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Net Settlement Pay & Disbursement Action */}
                    {liveSettlement && (
                        <div className={styles.card} style={{ background: liveSettlement.isDisbursementAllowed ? 'var(--signal-wash)' : 'var(--card-2)', border: `1px solid ${liveSettlement.isDisbursementAllowed ? 'var(--signal)' : 'var(--line)'}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                                <div>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-2)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_165")}</span>
                                    <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--f-num, monospace)', color: 'var(--text)', margin: '0.2rem 0' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_166")}{liveSettlement.netPayable.toLocaleString()}
                                    </div>
                                    <div style={{ fontSize: '0.82rem', color: liveSettlement.isDisbursementAllowed ? 'var(--signal-ink)' : 'var(--flag)' }}>
                                        {liveSettlement.isDisbursementAllowed
                                            ? readData("components.Workspace.PayrollView", "display_19")
                                            :translateText("components.Workspace.PayrollView","text_292097ff69", {value1: String(liveSettlement.disbursementBlockedReason)})}
                                    </div>
                                </div>
                                <div>
                                    {liveSettlement.isDisbursementAllowed ? (
                                        <button
                                            className={styles.btnPrimary}
                                            style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem' }}
                                            onClick={() => handleDisburseFnF(currentFnF.settlementId)}
                                        >
                                            <Zap size={16} />{readData("components.Workspace.PayrollView", "PayrollView_text_167")}</button>
                                    ) : (
                                        <button
                                            className={styles.btnSecondary}
                                            style={{ opacity: 0.6, cursor: 'not-allowed', padding: '0.75rem 1.5rem' }}
                                            disabled
                                            title={readData("components.Workspace.PayrollView", "PayrollView_title_168")}
                                        >
                                            <Lock size={16} />{readData("components.Workspace.PayrollView", "PayrollView_text_169")}</button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 5: PLANT USER LOCATION SCOPING SIMULATOR                               */}
            {/* ========================================================================= */}
            {activeTab === 'scoping' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Role Switcher Simulator Card */}
                    <div className={styles.card} style={{ borderLeft: '4px solid #05CD99' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Building2 size={20} color="#05CD99" />{readData("components.Workspace.PayrollView", "PayrollView_text_170")}</h3>
                                <p style={{ margin: '0.35rem 0 0', fontSize: '0.86rem', color: 'var(--text-2)', maxWidth: '780px' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_171")}<strong>{readData("components.Workspace.PayrollView", "PayrollView_text_172")}</strong>{readData("components.Workspace.PayrollView", "PayrollView_text_173")}</p>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    className={`${styles.btnSecondary} ${currentRoleContext.role === 'HO_HR_ADMIN' ? styles.subTabActive : ''}`}
                                    onClick={() => switchUserRole('HO_HR_ADMIN', 'ENTERPRISE', 'Corporate Head Office')}
                                >
                                    <UserCheck size={14} />{readData("components.Workspace.PayrollView", "PayrollView_text_174")}</button>
                                <button
                                    className={`${styles.btnSecondary} ${currentRoleContext.role === 'PLANT_SUPERVISOR' ? styles.subTabActive : ''}`}
                                    style={{ borderColor: currentRoleContext.role === 'PLANT_SUPERVISOR' ? '#f59e0b' : undefined }}
                                    onClick={() => switchUserRole('PLANT_SUPERVISOR', 'PLANT', 'Bengaluru Plant Unit-1')}
                                >
                                    <Building2 size={14} />{readData("components.Workspace.PayrollView", "PayrollView_text_175")}</button>
                                <button
                                    className={`${styles.btnSecondary} ${currentRoleContext.role === 'FINANCE_CONTROLLER' ? styles.subTabActive : ''}`}
                                    onClick={() => switchUserRole('FINANCE_CONTROLLER', 'ENTERPRISE', 'Finance Corporate')}
                                >
                                    <DollarSign size={14} />{readData("components.Workspace.PayrollView", "PayrollView_text_176")}</button>
                            </div>
                        </div>

                        <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: currentRoleContext.scope === 'PLANT' ? 'rgba(245, 158, 11, 0.1)' : 'var(--signal-wash)', borderRadius: 'var(--r-control, 6px)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <ShieldCheck size={20} color={currentRoleContext.scope === 'PLANT' ? readData("components.Workspace.PayrollView", "display_20") : readData("components.Workspace.PayrollView", "display_21")} />
                            <div style={{ fontSize: '0.84rem' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_177")}<strong>{currentRoleContext.role}</strong>{readData("components.Workspace.PayrollView", "PayrollView_text_178")}{currentRoleContext.location}{readData("components.Workspace.PayrollView", "PayrollView_text_179")}<strong>{currentRoleContext.scope}</strong>
                                <span style={{ marginLeft: '0.75rem', color: currentRoleContext.scope === 'PLANT' ? '#b45309' : 'var(--signal-ink)', fontWeight: 600 }}>
                                    {currentRoleContext.scope === 'PLANT'
                                        ? readData("components.Workspace.PayrollView", "display_22")
                                        : readData("components.Workspace.PayrollView", "display_23")}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Plant Workers Compensation & Operations Table */}
                    <div className={styles.tableContainer}>
                        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '0.95rem', color: 'var(--text)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_180")}</strong>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_181")}{currentRoleContext.role}
                            </span>
                        </div>
                        <table className={styles.dataTable}>
                            <thead>
                                <tr>
                                    <th>{readData("components.Workspace.PayrollView", "PayrollView_text_182")}</th>
                                    <th>{readData("components.Workspace.PayrollView", "PayrollView_text_183")}</th>
                                    <th>{readData("components.Workspace.PayrollView", "PayrollView_text_184")}</th>
                                    <th>{readData("components.Workspace.PayrollView", "PayrollView_text_185")}</th>
                                    <th>{readData("components.Workspace.PayrollView", "PayrollView_text_186")}</th>
                                    <th>{readData("components.Workspace.PayrollView", "PayrollView_text_187")}</th>
                                    <th>{readData("components.Workspace.PayrollView", "PayrollView_text_188")}</th>
                                    <th>{readData("components.Workspace.PayrollView", "PayrollView_text_189")}</th>
                                    <th>{readData("components.Workspace.PayrollView", "PayrollView_text_190")}</th>
                                    <th>{readData("components.Workspace.PayrollView", "PayrollView_text_191")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employees.map(emp => {
                                    const dummyWageRecord = {
                                        basicSalary: emp.basicSalaryNumeric ?translateText("components.Workspace.PayrollView","text_35cd59d276", {value1: String(emp.basicSalaryNumeric.toLocaleString())}) : readData("components.Workspace.PayrollView", "display_24"),
                                        grossSalary: emp.grossSalaryNumeric ?translateText("components.Workspace.PayrollView","text_35cd59d276", {value1: String(emp.grossSalaryNumeric.toLocaleString())}) : readData("components.Workspace.PayrollView", "display_25"),
                                        netPayable: emp.grossSalaryNumeric ?translateText("components.Workspace.PayrollView","text_35cd59d276", {value1: String(Math.round(emp.grossSalaryNumeric * 0.85).toLocaleString())}) : readData("components.Workspace.PayrollView", "display_26"),
                                        otHours: emp.id === 'EMP-009' ? readData("components.Workspace.PayrollView", "display_27") : emp.id === 'EMP-001' ? readData("components.Workspace.PayrollView", "display_28") : readData("components.Workspace.PayrollView", "display_29"),
                                        ...readData("components.Workspace.PayrollView", "dummyWageRecord_fields_192"),
                                        shiftCode: emp.id === 'EMP-009' ? readData("components.Workspace.PayrollView", "display_30") : readData("components.Workspace.PayrollView", "display_31")
                                    };
                                    const scopedRecord = applyLocationScoping(currentRoleContext, dummyWageRecord);

                                    return (
                                        <tr key={emp.id}>
                                            <td style={{ fontFamily: 'var(--f-num, monospace)', fontWeight: 700 }}>{emp.id}</td>
                                            <td>
                                                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{emp.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{emp.role}{readData("components.Workspace.PayrollView", "PayrollView_text_193")}{emp.dept}</div>
                                            </td>
                                            <td>
                                                <span className={styles.badge} style={{ background: 'var(--card-2)', color: 'var(--text)' }}>
                                                    {emp.worker_category_code || readData("components.Workspace.PayrollView", "fallback_5")}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`${styles.badge} ${styles.badgeInfo}`}>{scopedRecord.shiftCode}</span>
                                            </td>
                                            <td style={{ fontFamily: 'var(--f-num, monospace)', fontWeight: 700 }}>
                                                {scopedRecord.otHours}{readData("components.Workspace.PayrollView", "PayrollView_text_194")}</td>
                                            <td style={{ fontFamily: 'var(--f-num, monospace)' }}>
                                                {scopedRecord.workingDays}{readData("components.Workspace.PayrollView", "PayrollView_text_195")}</td>
                                            <td style={{ fontFamily: 'var(--f-num, monospace)', fontWeight: 600, color: scopedRecord._isMasked ? 'var(--text-3)' : 'var(--text)' }}>
                                                {scopedRecord.basicSalary}
                                            </td>
                                            <td style={{ fontFamily: 'var(--f-num, monospace)', fontWeight: 600, color: scopedRecord._isMasked ? 'var(--text-3)' : 'var(--text)' }}>
                                                {scopedRecord.grossSalary}
                                            </td>
                                            <td style={{ fontFamily: 'var(--f-num, monospace)', fontWeight: 700, color: scopedRecord._isMasked ? 'var(--text-3)' : 'var(--signal)' }}>
                                                {scopedRecord.netPayable}
                                            </td>
                                            <td>
                                                {scopedRecord._isMasked ? (
                                                    <span className={`${styles.badge} ${styles.badgeWarning}`}>
                                                        <Lock size={11} />{readData("components.Workspace.PayrollView", "PayrollView_text_196")}</span>
                                                ) : (
                                                    <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                                                        <CheckCircle2 size={11} />{readData("components.Workspace.PayrollView", "PayrollView_text_197")}</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* APPLY FOR COMPANY LOAN MODAL                                              */}
            {/* ========================================================================= */}
            {isLoanModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsLoanModalOpen(false)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_198")}</h3>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_199")}</span>
                            </div>
                            <button
                                style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-2)' }}
                                onClick={() => setIsLoanModalOpen(false)}
                            >{readData("components.Workspace.PayrollView", "PayrollView_text_200")}</button>
                        </div>

                        <form onSubmit={handleLoanSubmit} className={styles.modalBody}>
                            {/* Applicant Selector */}
                            <div className={styles.formGroup}>
                                <label>{readData("components.Workspace.PayrollView", "PayrollView_text_201")}</label>
                                <select
                                    value={loanApplicantId}
                                    onChange={(e) => setLoanApplicantId(e.target.value)}
                                    className={styles.formInput}
                                >
                                    {employees.map(e => (
                                        <option key={e.id} value={e.id}>
                                            {e.name}{readData("components.Workspace.PayrollView", "PayrollView_text_202")}{e.id}{readData("components.Workspace.PayrollView", "PayrollView_text_203")}{e.dept}{readData("components.Workspace.PayrollView", "PayrollView_text_204")}{(e.basicSalaryNumeric || readData("components.Workspace.PayrollView", "fallback_6")).toLocaleString()}{readData("components.Workspace.PayrollView", "PayrollView_text_205")}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Loan Amount & 4x Basic Ceiling Calculator */}
                            <div className={styles.formGroup}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <label>{readData("components.Workspace.PayrollView", "PayrollView_text_206")}</label>
                                    <span style={{ fontSize: '0.78rem', color: parseFloat(loanAmount) > applicantMaxCeiling ? '#ef4444' : 'var(--signal)', fontWeight: 600 }}>{readData("components.Workspace.PayrollView", "PayrollView_text_207")}{applicantMaxCeiling.toLocaleString()}
                                    </span>
                                </div>
                                <input
                                    type="number"
                                    min="0.01" max={isManagementOverride ? 999999999.99 : applicantMaxCeiling} step="0.01"
                                        value={loanAmount}
                                    onChange={(e) => setLoanAmount(e.target.value)}
                                    className={styles.formInput}
                                    placeholder={readData("components.Workspace.PayrollView", "PayrollView_placeholder_208")}
                                    required
                                />
                                {parseFloat(loanAmount) > applicantMaxCeiling && (
                                    <div style={{ fontSize: '0.78rem', color: '#ef4444', marginTop: '0.2rem' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_209")}</div>
                                )}
                            </div>

                            {/* Tenure & EMI Preview */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className={styles.formGroup}>
                                    <label>{readData("components.Workspace.PayrollView", "PayrollView_text_210")}</label>
                                    <input
                                        type="number"
                                        step="1"
                                        value={loanTenure}
                                        onChange={(e) => setLoanTenure(e.target.value)}
                                        className={styles.formInput}
                                        min="1"
                                        max="36"
                                        required
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>{readData("components.Workspace.PayrollView", "PayrollView_text_211")}</label>
                                    <div style={{ padding: '0.6rem 0.85rem', background: 'var(--card-2)', borderRadius: 'var(--r-control, 6px)', border: '1px solid var(--line)', fontFamily: 'var(--f-num, monospace)', fontWeight: 700, color: 'var(--text)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_212")}{Math.round((parseFloat(loanAmount) || 0) / (parseInt(loanTenure, 10) || readData("components.Workspace.PayrollView", "fallback_7"))).toLocaleString()}{readData("components.Workspace.PayrollView", "PayrollView_text_213")}</div>
                                </div>
                            </div>

                            {/* Loan Purpose */}
                            <div className={styles.formGroup}>
                                <label>{readData("components.Workspace.PayrollView", "PayrollView_text_214")}</label>
                                <input
                                    type="text"
                                    value={loanPurpose}
                                    onChange={(e) => setLoanPurpose(e.target.value)}
                                    className={styles.formInput}
                                    required
                                />
                            </div>

                            {/* Dual Guarantors Selection with Live Lock Radar */}
                            <div style={{ background: 'var(--card-2)', padding: '1rem', borderRadius: 'var(--r-control, 8px)', border: '1px solid var(--line)' }}>
                                <strong style={{ fontSize: '0.85rem', color: 'var(--text)', display: 'block', marginBottom: '0.5rem' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_215")}</strong>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                    <div className={styles.formGroup}>
                                        <label>{readData("components.Workspace.PayrollView", "PayrollView_text_216")}</label>
                                        <select
                                            value={loanGuarantor1}
                                            onChange={(e) => setLoanGuarantor1(e.target.value)}
                                            className={styles.formInput}
                                        >
                                            {employees.map(e => {
                                                const isLocked = guarantorLockMap.has(e.id);
                                                return (
                                                    <option key={e.id} value={e.id} disabled={isLocked && !isManagementOverride}>
                                                        {isLocked ? readData("components.Workspace.PayrollView", "display_32") : ''}{e.name}{readData("components.Workspace.PayrollView", "PayrollView_text_217")}{e.id}{readData("components.Workspace.PayrollView", "PayrollView_text_218")}</option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>{readData("components.Workspace.PayrollView", "PayrollView_text_219")}</label>
                                        <select
                                            value={loanGuarantor2}
                                            onChange={(e) => setLoanGuarantor2(e.target.value)}
                                            className={styles.formInput}
                                        >
                                            {employees.map(e => {
                                                const isLocked = guarantorLockMap.has(e.id);
                                                return (
                                                    <option key={e.id} value={e.id} disabled={isLocked && !isManagementOverride}>
                                                        {isLocked ? readData("components.Workspace.PayrollView", "display_33") : ''}{e.name}{readData("components.Workspace.PayrollView", "PayrollView_text_220")}{e.id}{readData("components.Workspace.PayrollView", "PayrollView_text_221")}</option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Optional Director (3rd)</label>
                                        <select
                                            value={loanGuarantor3}
                                            onChange={(e) => setLoanGuarantor3(e.target.value)}
                                            className={styles.formInput}
                                        >
                                            <option value="">-- Optional --</option>
                                            {employees.map(e => {
                                                const isLocked = guarantorLockMap.has(e.id);
                                                return (
                                                    <option key={e.id} value={e.id} disabled={isLocked && !isManagementOverride}>
                                                        {isLocked ? '🔒 ' : ''}{e.name} ({e.id})
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-2)', marginTop: '0.5rem' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_222")}</div>
                            </div>

                            {/* Management Override Checkbox */}
                            <div style={{ padding: '0.75rem', background: 'rgba(245, 158, 11, 0.08)', borderRadius: 'var(--r-control, 6px)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text)' }}>
                                    <input
                                        type="checkbox"
                                        checked={isManagementOverride}
                                        onChange={(e) => setIsManagementOverride(e.target.checked)}
                                    />{readData("components.Workspace.PayrollView", "PayrollView_text_223")}</label>
                                {isManagementOverride && (
                                    <div style={{ marginTop: '0.5rem' }}>
                                        <input
                                            type="text"
                                            value={overrideReason}
                                            onChange={(e) => setOverrideReason(e.target.value)}
                                            placeholder={readData("components.Workspace.PayrollView", "PayrollView_placeholder_224")}
                                            className={styles.formInput}
                                            required={isManagementOverride}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Modal Actions */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <button
                                    type="button"
                                    className={styles.btnSecondary}
                                    onClick={() => setIsLoanModalOpen(false)}
                                >{readData("components.Workspace.PayrollView", "PayrollView_text_225")}</button>
                                <button
                                    type="submit"
                                    className={styles.btnPrimary}
                                >{readData("components.Workspace.PayrollView", "PayrollView_text_226")}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* FINANCE-GRADE SALARY JOURNAL MODAL                                        */}
            {/* ========================================================================= */}
            {isGLModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsGLModalOpen(false)}>
                    <div style={{
                        background: 'var(--card)', borderRadius: 'var(--r-card, 12px)', width: '820px', maxWidth: '95vw',
                        border: '1px solid var(--line)',
                        boxShadow: 'var(--shadow-raise)', overflow: 'hidden'
                    }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.75rem', borderBottom: '1px solid var(--line)' }}>
                            <div>
                                <h3 style={{ margin: '0 0 0.2rem 0', fontSize: '1.2rem', color: 'var(--text)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_227")}</h3>
                                <span style={{ fontSize: '0.82rem', color: 'var(--text-2)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_228")}</span>
                            </div>
                            <button style={{ background: 'transparent', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-2)' }} onClick={() => setIsGLModalOpen(false)}>{readData("components.Workspace.PayrollView", "PayrollView_text_229")}</button>
                        </div>

                        <div style={{ padding: '1.75rem', maxHeight: '70vh', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--signal-wash)', border: '1px solid var(--line)', borderRadius: 'var(--r-control, 6px)', padding: '0.85rem 1.25rem', marginBottom: '1.25rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--signal-ink)', fontWeight: '700', fontSize: '0.88rem' }}>
                                    <CheckCircle2 size={16} />{readData("components.Workspace.PayrollView", "PayrollView_text_230")}</div>
                                <span style={{ fontFamily: 'var(--f-num, monospace)', fontWeight: '800', color: 'var(--signal-ink)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_231")}</span>
                            </div>

                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                                <thead>
                                    <tr style={{ background: 'var(--card-2)', borderBottom: '2px solid var(--line)', textAlign: 'left', color: 'var(--text-2)' }}>
                                        <th style={{ padding: '0.65rem 0.85rem' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_232")}</th>
                                        <th style={{ padding: '0.65rem 0.85rem' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_233")}</th>
                                        <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_234")}</th>
                                        <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_235")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style={{ borderBottom: '1px solid var(--line)' }}>
                                        <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text)' }}><strong>{readData("components.Workspace.PayrollView", "PayrollView_text_236")}</strong>{readData("components.Workspace.PayrollView", "PayrollView_text_237")}</td>
                                        <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-2)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_238")}</td>
                                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: '700', color: 'var(--text)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_239")}</td>
                                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', color: 'var(--text-2)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_240")}</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid var(--line)' }}>
                                        <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text)' }}><strong>{readData("components.Workspace.PayrollView", "PayrollView_text_241")}</strong>{readData("components.Workspace.PayrollView", "PayrollView_text_242")}</td>
                                        <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-2)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_243")}</td>
                                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: '700', color: 'var(--text)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_244")}</td>
                                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', color: 'var(--text-2)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_245")}</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid var(--line)' }}>
                                        <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text)' }}><strong>{readData("components.Workspace.PayrollView", "PayrollView_text_246")}</strong>{readData("components.Workspace.PayrollView", "PayrollView_text_247")}</td>
                                        <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-2)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_248")}</td>
                                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: '700', color: 'var(--text)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_249")}</td>
                                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', color: 'var(--text-2)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_250")}</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid var(--line)' }}>
                                        <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text)' }}><strong>{readData("components.Workspace.PayrollView", "PayrollView_text_251")}</strong></td>
                                        <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-2)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_252")}</td>
                                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: '700', color: 'var(--text)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_253")}</td>
                                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', color: 'var(--text-2)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_254")}</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid var(--line)' }}>
                                        <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text)' }}><strong>{readData("components.Workspace.PayrollView", "PayrollView_text_255")}</strong>{readData("components.Workspace.PayrollView", "PayrollView_text_256")}</td>
                                        <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-2)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_257")}</td>
                                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', color: 'var(--text-2)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_258")}</td>
                                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: '700', color: 'var(--text)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_259")}</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid var(--line)' }}>
                                        <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text)' }}><strong>{readData("components.Workspace.PayrollView", "PayrollView_text_260")}</strong>{readData("components.Workspace.PayrollView", "PayrollView_text_261")}</td>
                                        <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-2)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_262")}</td>
                                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', color: 'var(--text-2)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_263")}</td>
                                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: '700', color: 'var(--text)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_264")}</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid var(--line)' }}>
                                        <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text)' }}><strong>{readData("components.Workspace.PayrollView", "PayrollView_text_265")}</strong>{readData("components.Workspace.PayrollView", "PayrollView_text_266")}</td>
                                        <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-2)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_267")}</td>
                                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', color: 'var(--text-2)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_268")}</td>
                                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: '700', color: 'var(--text)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_269")}</td>
                                    </tr>
                                    <tr style={{ background: 'var(--card-2)', borderTop: '2px solid var(--line)', fontWeight: '800' }}>
                                        <td colSpan="2" style={{ padding: '0.75rem 0.85rem', color: 'var(--text)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_270")}</td>
                                        <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right', color: 'var(--info)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_271")}</td>
                                        <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right', color: 'var(--info)' }}>{readData("components.Workspace.PayrollView", "PayrollView_text_272")}</td>
                                    </tr>
                                </tbody>
                            </table>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.75rem', borderTop: '1px solid var(--line)', paddingTop: '1.25rem' }}>
                                <button className={styles.btnSecondary} onClick={() => setIsGLModalOpen(false)}>{readData("components.Workspace.PayrollView", "PayrollView_text_273")}</button>
                                <button className={styles.btnPrimary} onClick={handleDownloadTallyXML}>
                                    <Download size={14} />{readData("components.Workspace.PayrollView", "PayrollView_text_274")}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PayrollView;
