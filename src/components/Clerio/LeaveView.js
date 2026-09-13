"use client";
import { readData } from '../../services/workspace-data.mjs';

import React, { useState } from 'react';
import {
    Calendar, CheckCircle, AlertCircle, Clock, FileText, ChevronRight,
    Sparkles, ShieldCheck, ArrowRight, RotateCcw, AlertTriangle, UserCheck,
    CheckCircle2, XCircle, Info, Layers, RefreshCw
} from 'lucide-react';
import styles from './LeaveView.module.css';
import { useHRMS } from '@/context/HRMSContext';
import { inclusiveDays } from '@/lib/form-validation';
import { launchAction } from '@/lib/action-launcher';

const LeaveApplicationModal = ({ isOpen, onClose, onSubmit, leaveTypeCode, setLeaveTypeCode, startDate, setStartDate, endDate, setEndDate, sandwichEnabled, setSandwichEnabled, reason, setReason }) => {
    if (!isOpen) return null;
    return (
        <div className={styles.modalOverlay} onMouseDown={onClose} role="presentation">
            <section className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="leave-application-title" onMouseDown={(event) => event.stopPropagation()}>
                <header className={styles.modalHeader}>
                    <div><span className={styles.modalKicker}>{readData("components.Clerio.LeaveView", "LeaveApplicationModal_text_1")}</span><h3 id="leave-application-title">{readData("components.Clerio.LeaveView", "LeaveApplicationModal_text_2")}</h3><p>{readData("components.Clerio.LeaveView", "LeaveApplicationModal_text_3")}</p></div>
                    <button type="button" className={styles.iconButton} onClick={onClose} aria-label={readData("components.Clerio.LeaveView", "LeaveApplicationModal_aria-label_4")}><XCircle size={18} /></button>
                </header>
                <div className={styles.alertBox}><AlertCircle size={19} /><span><strong>{readData("components.Clerio.LeaveView", "LeaveApplicationModal_text_5")}</strong>{readData("components.Clerio.LeaveView", "LeaveApplicationModal_text_6")}</span></div>
                <form onSubmit={onSubmit} className={styles.formGrid}>
                    <div className={styles.formGroup}><label className={styles.formLabel} htmlFor="leave-type">{readData("components.Clerio.LeaveView", "LeaveApplicationModal_text_7")}</label><select id="leave-type" required className={styles.formSelect} value={leaveTypeCode} onChange={(event) => setLeaveTypeCode(event.target.value)}><option value="PRIVILEGE">{readData("components.Clerio.LeaveView", "LeaveApplicationModal_text_8")}</option><option value="COMP_OFF">{readData("components.Clerio.LeaveView", "LeaveApplicationModal_text_9")}</option><option value="CASUAL">{readData("components.Clerio.LeaveView", "LeaveApplicationModal_text_10")}</option><option value="SICK">{readData("components.Clerio.LeaveView", "LeaveApplicationModal_text_11")}</option><option value="WELLNESS">{readData("components.Clerio.LeaveView", "LeaveApplicationModal_text_12")}</option><option value="LOP">{readData("components.Clerio.LeaveView", "LeaveApplicationModal_text_13")}</option></select></div>
                    <div className={styles.formGroup}><label className={styles.formLabel} htmlFor="leave-start-date">{readData("components.Clerio.LeaveView", "LeaveApplicationModal_text_14")}</label><input id="leave-start-date" type="date" className={styles.formInput} value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></div>
                    <div className={styles.formGroup}><label className={styles.formLabel} htmlFor="leave-end-date">{readData("components.Clerio.LeaveView", "LeaveApplicationModal_text_15")}</label><input id="leave-end-date" type="date" min={startDate || undefined} className={styles.formInput} value={endDate} onChange={(event) => setEndDate(event.target.value)} required /></div>
                    <label className={`${styles.formGroup} ${styles.modalWide}`}><span className={styles.checkboxLabel}><input type="checkbox" checked={sandwichEnabled} onChange={(event) => setSandwichEnabled(event.target.checked)} />{readData("components.Clerio.LeaveView", "LeaveApplicationModal_text_16")}</span></label>
                    <div className={`${styles.formGroup} ${styles.modalWide}`}><label className={styles.formLabel} htmlFor="leave-reason">{readData("components.Clerio.LeaveView", "LeaveApplicationModal_text_17")}</label><textarea id="leave-reason" className={styles.formTextarea} value={reason} onChange={(event) => setReason(event.target.value)} required /></div>
                    <footer className={`${styles.modalFooter} ${styles.modalWide}`}><button type="button" className={styles.btnSecondary} onClick={onClose}>{readData("components.Clerio.LeaveView", "LeaveApplicationModal_text_18")}</button><button type="submit" className={styles.btnPrimary}>{readData("components.Clerio.LeaveView", "LeaveApplicationModal_text_19")}</button></footer>
                </form>
            </section>
        </div>
    );
};

const LeaveView = () => {
    const {
        leaves,
        leaveApplications,
        compOffCredits,
        applyLeaveWithWorkflow,
        advanceLeaveApproval,
        processEarlyReturnApplication,
        leaveRuleVersion,
        user,
        showToast
    } = useHRMS();

    const [activeTab, setActiveTab] = useState(readData("components.Clerio.LeaveView", "initialState_1")); // 'balances_apply' | 'approval_pipeline' | 'comp_off_clock' | 'early_return_recredit' | 'policy_matrix'
    const [leaveTypeCode, setLeaveTypeCode] = useState(readData("components.Clerio.LeaveView", "initialState_2"));
    const [startDate, setStartDate] = useState(readData("components.Clerio.LeaveView", "initialState_3"));
    const [endDate, setEndDate] = useState(readData("components.Clerio.LeaveView", "initialState_4"));
    const [sandwichEnabled, setSandwichEnabled] = useState(true);
    const [reason, setReason] = useState(readData("components.Clerio.LeaveView", "initialState_5"));
    const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);

    // Early return modal / trigger state
    const [earlyReturnModalOpen, setEarlyReturnModalOpen] = useState(false);
    const [selectedAppForEarlyReturn, setSelectedAppForEarlyReturn] = useState(null);
    const [actualReturnDate, setActualReturnDate] = useState(readData("components.Clerio.LeaveView", "initialState_6"));

    const handleApplyWorkflow = (e) => {
        e.preventDefault();
        if (!e.currentTarget.reportValidity() || inclusiveDays(startDate, endDate) === null) return;
        const res = applyLeaveWithWorkflow({
            leaveTypeCode,
            startDateStr: startDate,
            endDateStr: endDate,
            reason,
            sandwichRuleEnabled: sandwichEnabled,
            employee: user
        });
        if (res.success) {
            setIsApplyModalOpen(false);
            setActiveTab('approval_pipeline');
        }
    };

    const handleTriggerEarlyReturn = (app) => {
        setSelectedAppForEarlyReturn(app);
        setActualReturnDate(app.actual_return_date || readData("components.Clerio.LeaveView", "fallback_1"));
        setEarlyReturnModalOpen(true);
    };

    const confirmEarlyReturn = () => {
        if (!selectedAppForEarlyReturn) return;
        processEarlyReturnApplication({
            applicationId: selectedAppForEarlyReturn.id,
            actualReturnDateStr: actualReturnDate
        });
        setEarlyReturnModalOpen(false);
    };

    // Calculate active vs lapsed comp-offs
    const activeCompOffs = compOffCredits.filter(c => c.status === 'ACTIVE');
    const lapsedCompOffs = compOffCredits.filter(c => c.status === 'LAPSED_60_DAYS');

    return (
        <div className={styles.leaveContainer}>

            {/* HEADER */}
            <div className={styles.headerRow}>
                <div className={styles.titleBlock}>
                    <h2>{readData("components.Clerio.LeaveView", "LeaveView_text_20")}</h2>
                    <p>{readData("components.Clerio.LeaveView", "LeaveView_text_21")}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button
                        className={styles.btnSecondary}
                        onClick={() => showToast('Policy Handbook', 'Opening 2026 Statutory Leave Policy Document...', 'info')}
                    >
                        <FileText size={15} />{readData("components.Clerio.LeaveView", "LeaveView_text_22")}</button>
                    <button
                        className={styles.btnPrimary}
                        onClick={() => setIsApplyModalOpen(true)}
                    >
                        <Calendar size={15} />{readData("components.Clerio.LeaveView", "LeaveView_text_23")}</button>
                </div>
            </div>

            {/* ENGINE STATUS BANNER */}
            <div className={styles.engineBanner}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <ShieldCheck size={24} color="#2563eb" />
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <strong style={{ color: 'var(--text)', fontSize: '0.92rem' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_24")}</strong>
                            <span className={`${styles.badge} ${styles.badgeBlue}`}>{readData("components.Clerio.LeaveView", "LeaveView_text_25")}{leaveRuleVersion || readData("components.Clerio.LeaveView", "fallback_2")}</span>
                            <span className={`${styles.badge} ${styles.badgeTeal}`}>{readData("components.Clerio.LeaveView", "LeaveView_text_26")}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginTop: '0.2rem' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_27")}</div>
                    </div>
                </div>
                <button
                    className={styles.btnSecondary}
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                    onClick={() => showToast('Engine Status', 'All 3 Leave Demo Points passing deterministic assertions.', 'success')}
                >
                    <CheckCircle size={14} color="#16a34a" />{readData("components.Clerio.LeaveView", "LeaveView_text_28")}</button>
            </div>

            {/* SUBNAV TABS */}
            <div className={styles.subnavTabs}>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'balances_apply' ? styles.tabBtnActive : ''}`}
                    onClick={() => setActiveTab('balances_apply')}
                >
                    <Calendar size={15} />{readData("components.Clerio.LeaveView", "LeaveView_text_29")}</button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'approval_pipeline' ? styles.tabBtnActive : ''}`}
                    onClick={() => setActiveTab('approval_pipeline')}
                >
                    <Layers size={15} />{readData("components.Clerio.LeaveView", "LeaveView_text_30")}<span className={`${styles.badge} ${styles.badgeAmber}`}>
                        {leaveApplications.filter(a => a.status.startsWith('PENDING')).length}{readData("components.Clerio.LeaveView", "LeaveView_text_31")}</span>
                </button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'comp_off_clock' ? styles.tabBtnActive : ''}`}
                    onClick={() => setActiveTab('comp_off_clock')}
                >
                    <Clock size={15} />{readData("components.Clerio.LeaveView", "LeaveView_text_32")}<span className={`${styles.badge} ${activeCompOffs.length > 0 ? styles.badgeTeal : styles.badgeCoral}`}>
                        {activeCompOffs.length}{readData("components.Clerio.LeaveView", "LeaveView_text_33")}</span>
                </button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'early_return_recredit' ? styles.tabBtnActive : ''}`}
                    onClick={() => setActiveTab('early_return_recredit')}
                >
                    <RotateCcw size={15} />{readData("components.Clerio.LeaveView", "LeaveView_text_34")}</button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'policy_matrix' ? styles.tabBtnActive : ''}`}
                    onClick={() => setActiveTab('policy_matrix')}
                >
                    <ShieldCheck size={15} />{readData("components.Clerio.LeaveView", "LeaveView_text_35")}</button>
            </div>

            {/* TAB 1: Balances & Apply Leave */}
            {activeTab === 'balances_apply' && (
                <>
                    {/* BALANCE CARDS ROW */}
                    <div className={styles.balanceRow}>
                        <div className={styles.balanceCard}>
                            <div className={styles.balInfo}>
                                <div className={styles.balLabel}>{readData("components.Clerio.LeaveView", "LeaveView_text_36")}</div>
                                <div className={styles.balValue}>{leaves.privilege.available}</div>
                                <div className={styles.balTotal}>{readData("components.Clerio.LeaveView", "LeaveView_text_37")}{leaves.privilege.total}{readData("components.Clerio.LeaveView", "LeaveView_text_38")}</div>
                            </div>
                            <div className={`${styles.balIcon} ${styles.cardPrivilege}`}>{readData("components.Clerio.LeaveView", "LeaveView_text_39")}</div>
                        </div>
                        <div className={styles.balanceCard}>
                            <div className={styles.balInfo}>
                                <div className={styles.balLabel}>{readData("components.Clerio.LeaveView", "LeaveView_text_40")}</div>
                                <div className={styles.balValue}>{activeCompOffs.length}</div>
                                <div className={styles.balTotal}>
                                    {lapsedCompOffs.length}{readData("components.Clerio.LeaveView", "LeaveView_text_41")}</div>
                            </div>
                            <div className={`${styles.balIcon}`} style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#b45309' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_42")}</div>
                        </div>
                        <div className={styles.balanceCard}>
                            <div className={styles.balInfo}>
                                <div className={styles.balLabel}>{readData("components.Clerio.LeaveView", "LeaveView_text_43")}</div>
                                <div className={styles.balValue}>{leaves.casual.available}</div>
                                <div className={styles.balTotal}>{readData("components.Clerio.LeaveView", "LeaveView_text_44")}{leaves.casual.total}</div>
                            </div>
                            <div className={`${styles.balIcon} ${styles.cardCasual}`}>{readData("components.Clerio.LeaveView", "LeaveView_text_45")}</div>
                        </div>
                    </div>

                    {/* MAIN CONTENT GRID */}
                    <div className={styles.mainGrid}>
                        {/* LEFT: APPLY LEAVE ACTION */}
                        <div className={styles.leftCol}>
                            <div className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <h3>{readData("components.Clerio.LeaveView", "LeaveView_text_46")}</h3>
                                </div>
                                <p className={styles.requestCopy}>{readData("components.Clerio.LeaveView", "LeaveView_text_47")}</p>
                                <button type="button" className={styles.btnPrimary} onClick={() => setIsApplyModalOpen(true)}><Calendar size={15} />{readData("components.Clerio.LeaveView", "LeaveView_text_48")}</button>
                            </div>
                        </div>

                        {/* RIGHT: RECENT HISTORY */}
                        <div className={styles.rightCol}>
                            <div className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <h3>{readData("components.Clerio.LeaveView", "LeaveView_text_49")}</h3>
                                </div>
                                <div className={styles.historyList}>
                                    {leaveApplications.map((app) => (
                                        <div key={app.id} className={`${styles.historyItem} ${app.status === 'APPROVED' ? styles.statusApproved : app.status === 'SHORT_CLOSED' ? styles.statusApproved : styles.statusPending}`}>
                                            <div>
                                                <div className={styles.histType}>{app.leave_type_label}</div>
                                                <div className={styles.histDate}>{app.start_date}{readData("components.Clerio.LeaveView", "LeaveView_text_50")}{app.end_date}{readData("components.Clerio.LeaveView", "LeaveView_text_51")}{app.chargeable_days}{readData("components.Clerio.LeaveView", "LeaveView_text_52")}</div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-2)', marginTop: 2 }}>{app.reason}</div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <span className={`${styles.histBadge} ${app.status === 'APPROVED' ? styles.badgeApproved : styles.badgePending}`}>
                                                    {app.status}
                                                </span>
                                                {app.status === 'APPROVED' && !app.actual_return_date && (
                                                    <div style={{ marginTop: '0.4rem' }}>
                                                        <button
                                                            onClick={() => handleTriggerEarlyReturn(app)}
                                                            className={styles.btnSecondary}
                                                            style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem' }}
                                                        >
                                                            <RotateCcw size={12} />{readData("components.Clerio.LeaveView", "LeaveView_text_53")}</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* TAB 2: 3-Level Sequential Approval Pipeline (Demo Point 5) */}
            {activeTab === 'approval_pipeline' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div>
                                <h3 style={{ margin: 0 }}>{readData("components.Clerio.LeaveView", "LeaveView_text_54")}</h3>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-2)', margin: '0.25rem 0 0' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_55")}<strong>{readData("components.Clerio.LeaveView", "LeaveView_text_56")}</strong>{readData("components.Clerio.LeaveView", "LeaveView_text_57")}<strong>{readData("components.Clerio.LeaveView", "LeaveView_text_58")}</strong>{readData("components.Clerio.LeaveView", "LeaveView_text_59")}<strong>{readData("components.Clerio.LeaveView", "LeaveView_text_60")}</strong>{readData("components.Clerio.LeaveView", "LeaveView_text_61")}</p>
                            </div>
                        </div>
                    </div>

                    {leaveApplications.map(app => {
                        const isPendingSupervisor = app.status === 'PENDING_SUPERVISOR';
                        const isPendingHOD = app.status === 'PENDING_HOD';
                        const isPendingHR = app.status === 'PENDING_HR_HEAD';
                        const isApproved = app.status === 'APPROVED' || app.status === 'SHORT_CLOSED';

                        return (
                            <div key={app.id} className={styles.pipelineCard}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <strong style={{ fontSize: '1rem' }}>{app.employee_name}</strong>
                                            <span className={`${styles.badge} ${styles.badgeBlue}`}>{app.leave_type_label}</span>
                                            <span className={`${styles.badge} ${styles.badgeAmber}`}>{app.chargeable_days}{readData("components.Clerio.LeaveView", "LeaveView_text_62")}</span>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginTop: '0.25rem' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_63")}<strong>{app.start_date}{readData("components.Clerio.LeaveView", "LeaveView_text_64")}{app.end_date}</strong>{readData("components.Clerio.LeaveView", "LeaveView_text_65")}{app.reason}
                                        </div>
                                    </div>
                                    <div>
                                        <span className={`${styles.badge} ${isApproved ? styles.badgeTeal : styles.badgeAmber}`}>{readData("components.Clerio.LeaveView", "LeaveView_text_66")}{app.status}
                                        </span>
                                    </div>
                                </div>

                                {/* 3-Step Visual Tracker */}
                                <div className={styles.pipelineSteps}>
                                    {/* Step 1: Supervisor */}
                                    <div className={`${styles.stepNode} ${isPendingSupervisor ? styles.stepPending : styles.stepCompleted}`}>
                                        <UserCheck size={14} />
                                        <span>{readData("components.Clerio.LeaveView", "LeaveView_text_67")}</span>
                                        {isPendingSupervisor ? readData("components.Clerio.LeaveView", "display_7") : readData("components.Clerio.LeaveView", "display_8")}
                                    </div>
                                    <ArrowRight size={14} color="var(--text-3)" />

                                    {/* Step 2: HOD */}
                                    <div className={`${styles.stepNode} ${isPendingHOD ? styles.stepPending : isPendingHR || isApproved ? styles.stepCompleted : styles.stepWaiting}`}>
                                        <UserCheck size={14} />
                                        <span>{readData("components.Clerio.LeaveView", "LeaveView_text_68")}</span>
                                        {isPendingHOD ? readData("components.Clerio.LeaveView", "display_9") : isPendingHR || isApproved ? readData("components.Clerio.LeaveView", "display_10") : readData("components.Clerio.LeaveView", "display_11")}
                                    </div>
                                    <ArrowRight size={14} color="var(--text-3)" />

                                    {/* Step 3: HR Head */}
                                    <div className={`${styles.stepNode} ${isPendingHR ? styles.stepPending : isApproved ? styles.stepCompleted : styles.stepWaiting}`}>
                                        <ShieldCheck size={14} />
                                        <span>{readData("components.Clerio.LeaveView", "LeaveView_text_69")}</span>
                                        {isPendingHR ? readData("components.Clerio.LeaveView", "display_12") : isApproved ? readData("components.Clerio.LeaveView", "display_13") : readData("components.Clerio.LeaveView", "display_14")}
                                    </div>
                                </div>

                                {/* Audit & Approval Actions */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--line-soft)', paddingTop: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>
                                        {app.approval_history && app.approval_history.length > 0 ? (
                                            <div>{readData("components.Clerio.LeaveView", "LeaveView_text_70")}<strong>{app.approval_history[app.approval_history.length - 1]?.action}</strong>{readData("components.Clerio.LeaveView", "LeaveView_text_71")}{app.approval_history[app.approval_history.length - 1]?.reviewer}{readData("components.Clerio.LeaveView", "LeaveView_text_72")}{app.approval_history[app.approval_history.length - 1]?.remarks}{readData("components.Clerio.LeaveView", "LeaveView_text_73")}</div>
                                        ) : (
                                            readData("components.Clerio.LeaveView", "display_15")
                                        )}
                                    </div>

                                    {/* Live Actions to advance pipeline */}
                                    {!isApproved && app.status !== 'REJECTED' && (
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button
                                                className={styles.btnSecondary}
                                                style={{ fontSize: '0.75rem', color: '#ef4444' }}
                                                onClick={() => launchAction('leaveDecision', { employee: app.employeeName || app.employee || app.name || '', ...readData("components.Clerio.LeaveView", "LeaveView_fields_74") })}
                                            >
                                                <XCircle size={13} />{readData("components.Clerio.LeaveView", "LeaveView_text_75")}</button>
                                            <button
                                                className={styles.btnPrimary}
                                                style={{ fontSize: '0.75rem', background: '#16a34a' }}
                                                onClick={() => launchAction('leaveDecision', { employee: app.employeeName || app.employee || app.name || '', ...readData("components.Clerio.LeaveView", "LeaveView_fields_76") })}
                                            >
                                                <CheckCircle2 size={13} />{readData("components.Clerio.LeaveView", "LeaveView_text_77")}{app.current_approval_tier}{readData("components.Clerio.LeaveView", "LeaveView_text_78")}</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* TAB 3: Comp-Off 60-Day Expiry Clock (Demo Point 6) */}
            {activeTab === 'comp_off_clock' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className={styles.compOffGrid}>
                        <div className={styles.compOffCard}>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-2)', fontWeight: 600 }}>{readData("components.Clerio.LeaveView", "LeaveView_text_79")}</span>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#16a34a' }}>
                                {activeCompOffs.length} <span style={{ fontSize: '0.9rem', color: 'var(--text-2)' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_80")}</span>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_81")}</span>
                        </div>

                        <div className={styles.compOffCard}>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-2)', fontWeight: 600 }}>{readData("components.Clerio.LeaveView", "LeaveView_text_82")}</span>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ef4444' }}>
                                {lapsedCompOffs.length} <span style={{ fontSize: '0.9rem', color: 'var(--text-2)' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_83")}</span>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: '#b91c1c' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_84")}</span>
                        </div>

                        <div className={styles.compOffCard}>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-2)', fontWeight: 600 }}>{readData("components.Clerio.LeaveView", "LeaveView_text_85")}</span>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_86")}</div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_87")}</span>
                        </div>
                    </div>

                    {/* Comp-Off Individual Clock Ledger */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div>
                                <h3 style={{ margin: 0 }}>{readData("components.Clerio.LeaveView", "LeaveView_text_88")}</h3>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-2)', margin: '0.25rem 0 0' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_89")}</p>
                            </div>
                        </div>

                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>{readData("components.Clerio.LeaveView", "LeaveView_text_90")}</th>
                                        <th>{readData("components.Clerio.LeaveView", "LeaveView_text_91")}</th>
                                        <th>{readData("components.Clerio.LeaveView", "LeaveView_text_92")}</th>
                                        <th>{readData("components.Clerio.LeaveView", "LeaveView_text_93")}</th>
                                        <th>{readData("components.Clerio.LeaveView", "LeaveView_text_94")}</th>
                                        <th>{readData("components.Clerio.LeaveView", "LeaveView_text_95")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {compOffCredits.map(c => {
                                        const isLapsed = c.status === 'LAPSED_60_DAYS';
                                        return (
                                            <tr key={c.id}>
                                                <td><strong>{c.id}</strong></td>
                                                <td>{c.credited_at}</td>
                                                <td>{c.source}</td>
                                                <td><strong>{c.expires_at}</strong></td>
                                                <td>
                                                    {isLapsed ? (
                                                        <span className={`${styles.badge} ${styles.badgeCoral}`}>{readData("components.Clerio.LeaveView", "LeaveView_text_96")}</span>
                                                    ) : (
                                                        <span className={`${styles.badge} ${styles.badgeTeal}`}>{readData("components.Clerio.LeaveView", "LeaveView_text_97")}{c.days_remaining || readData("components.Clerio.LeaveView", "fallback_3")}{readData("components.Clerio.LeaveView", "LeaveView_text_98")}</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <span className={`${styles.badge} ${isLapsed ? styles.badgeCoral : styles.badgeBlue}`}>
                                                        {c.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: Early Return Re-Credit (Demo Point 5) */}
            {activeTab === 'early_return_recredit' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className={styles.card} style={{ borderLeft: '4px solid #2563eb' }}>
                        <div className={styles.cardHeader}>
                            <div>
                                <h4 style={{ margin: 0, color: '#2563eb' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_99")}</h4>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-2)', margin: '0.25rem 0 0' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_100")}<strong>{readData("components.Clerio.LeaveView", "LeaveView_text_101")}</strong>{readData("components.Clerio.LeaveView", "LeaveView_text_102")}</p>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '0.75rem' }}>
                            <div style={{ background: 'var(--card-2)', padding: '0.85rem', borderRadius: '6px' }}>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-2)' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_103")}</span>
                                <div style={{ fontWeight: 600, marginTop: '0.2rem' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_104")}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_105")}</div>
                            </div>

                            <div style={{ background: 'rgba(37, 99, 235, 0.08)', border: '1px dashed #2563eb', padding: '0.85rem', borderRadius: '6px' }}>
                                <span style={{ fontSize: '0.72rem', color: '#2563eb' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_106")}</span>
                                <div style={{ fontWeight: 600, color: '#2563eb', marginTop: '0.2rem' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_107")}</div>
                                <div style={{ fontSize: '0.75rem', color: '#2563eb' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_108")}</div>
                            </div>

                            <div style={{ background: 'rgba(45, 212, 168, 0.12)', border: '1px solid #05CD99', padding: '0.85rem', borderRadius: '6px' }}>
                                <span style={{ fontSize: '0.72rem', color: '#0f766e' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_109")}</span>
                                <div style={{ fontWeight: 700, color: '#0f766e', marginTop: '0.2rem' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_110")}</div>
                                <div style={{ fontSize: '0.75rem', color: '#0f766e' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_111")}</div>
                            </div>

                            <div style={{ background: 'var(--card-2)', padding: '0.85rem', borderRadius: '6px' }}>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-2)' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_112")}</span>
                                <div style={{ fontWeight: 600, marginTop: '0.2rem' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_113")}</div>
                                <div style={{ fontSize: '0.75rem', color: '#16a34a' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_114")}</div>
                            </div>
                        </div>
                    </div>

                    {/* Applications Eligible for Early Return */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h4 style={{ margin: 0 }}>{readData("components.Clerio.LeaveView", "LeaveView_text_115")}</h4>
                        </div>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>{readData("components.Clerio.LeaveView", "LeaveView_text_116")}</th>
                                        <th>{readData("components.Clerio.LeaveView", "LeaveView_text_117")}</th>
                                        <th>{readData("components.Clerio.LeaveView", "LeaveView_text_118")}</th>
                                        <th>{readData("components.Clerio.LeaveView", "LeaveView_text_119")}</th>
                                        <th>{readData("components.Clerio.LeaveView", "LeaveView_text_120")}</th>
                                        <th>{readData("components.Clerio.LeaveView", "LeaveView_text_121")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leaveApplications.map(app => (
                                        <tr key={app.id}>
                                            <td><strong>{app.id}</strong></td>
                                            <td>{app.employee_name}</td>
                                            <td>{app.start_date}{readData("components.Clerio.LeaveView", "LeaveView_text_122")}{app.end_date}</td>
                                            <td>{app.chargeable_days}{readData("components.Clerio.LeaveView", "LeaveView_text_123")}</td>
                                            <td>
                                                <span className={`${styles.badge} ${app.status === 'SHORT_CLOSED' ? styles.badgeTeal : styles.badgeBlue}`}>
                                                    {app.status}
                                                </span>
                                                {app.actual_return_date && (
                                                    <div style={{ fontSize: '0.7rem', color: '#16a34a', marginTop: 2 }}>{readData("components.Clerio.LeaveView", "LeaveView_text_124")}{app.actual_return_date}{readData("components.Clerio.LeaveView", "LeaveView_text_125")}</div>
                                                )}
                                            </td>
                                            <td>
                                                {app.status === 'APPROVED' && (
                                                    <button
                                                        className={styles.btnSecondary}
                                                        style={{ fontSize: '0.72rem', color: '#2563eb' }}
                                                        onClick={() => handleTriggerEarlyReturn(app)}
                                                    >
                                                        <RotateCcw size={13} />{readData("components.Clerio.LeaveView", "LeaveView_text_126")}</button>
                                                )}
                                                {app.status === 'SHORT_CLOSED' && (
                                                    <span style={{ fontSize: '0.75rem', color: '#0f766e', fontWeight: 600 }}>{readData("components.Clerio.LeaveView", "LeaveView_text_127")}</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 5: Policy Matrix, Band Rules & Sandwich Matrix (Demo Point 7) */}
            {activeTab === 'policy_matrix' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div>
                                <h3 style={{ margin: 0 }}>{readData("components.Clerio.LeaveView", "LeaveView_text_128")}</h3>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-2)', margin: '0.25rem 0 0' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_129")}</p>
                            </div>
                        </div>

                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>{readData("components.Clerio.LeaveView", "LeaveView_text_130")}</th>
                                        <th>{readData("components.Clerio.LeaveView", "LeaveView_text_131")}</th>
                                        <th>{readData("components.Clerio.LeaveView", "LeaveView_text_132")}</th>
                                        <th>{readData("components.Clerio.LeaveView", "LeaveView_text_133")}</th>
                                        <th>{readData("components.Clerio.LeaveView", "LeaveView_text_134")}</th>
                                        <th>{readData("components.Clerio.LeaveView", "LeaveView_text_135")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td><strong>{readData("components.Clerio.LeaveView", "LeaveView_text_136")}</strong></td>
                                        <td>{readData("components.Clerio.LeaveView", "LeaveView_text_137")}</td>
                                        <td><strong style={{ color: '#2563eb' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_138")}</strong></td>
                                        <td>{readData("components.Clerio.LeaveView", "LeaveView_text_139")}</td>
                                        <td>{readData("components.Clerio.LeaveView", "LeaveView_text_140")}</td>
                                        <td>{readData("components.Clerio.LeaveView", "LeaveView_text_141")}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>{readData("components.Clerio.LeaveView", "LeaveView_text_142")}</strong></td>
                                        <td>{readData("components.Clerio.LeaveView", "LeaveView_text_143")}</td>
                                        <td><strong style={{ color: '#16a34a' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_144")}</strong></td>
                                        <td>{readData("components.Clerio.LeaveView", "LeaveView_text_145")}</td>
                                        <td>{readData("components.Clerio.LeaveView", "LeaveView_text_146")}</td>
                                        <td>{readData("components.Clerio.LeaveView", "LeaveView_text_147")}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>{readData("components.Clerio.LeaveView", "LeaveView_text_148")}</strong></td>
                                        <td>{readData("components.Clerio.LeaveView", "LeaveView_text_149")}</td>
                                        <td><strong style={{ color: 'var(--text-3)' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_150")}</strong></td>
                                        <td>{readData("components.Clerio.LeaveView", "LeaveView_text_151")}</td>
                                        <td>{readData("components.Clerio.LeaveView", "LeaveView_text_152")}</td>
                                        <td>{readData("components.Clerio.LeaveView", "LeaveView_text_153")}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Sandwich Rule Policy Card */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <AlertTriangle size={18} color="#d97706" />
                                <h4 style={{ margin: 0 }}>{readData("components.Clerio.LeaveView", "LeaveView_text_154")}</h4>
                            </div>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.6 }}>
                            <p style={{ margin: 0 }}>
                                <strong>{readData("components.Clerio.LeaveView", "LeaveView_text_155")}</strong>{readData("components.Clerio.LeaveView", "LeaveView_text_156")}</p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                                <div style={{ background: 'var(--card-2)', padding: '0.85rem', borderRadius: '6px' }}>
                                    <strong style={{ fontSize: '0.8rem', color: '#16a34a' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_157")}</strong>
                                    <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_158")}<strong>{readData("components.Clerio.LeaveView", "LeaveView_text_159")}</strong>{readData("components.Clerio.LeaveView", "LeaveView_text_160")}</div>
                                </div>
                                <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid #f59e0b', padding: '0.85rem', borderRadius: '6px' }}>
                                    <strong style={{ fontSize: '0.8rem', color: '#b45309' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_161")}</strong>
                                    <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_162")}<strong>{readData("components.Clerio.LeaveView", "LeaveView_text_163")}</strong>{readData("components.Clerio.LeaveView", "LeaveView_text_164")}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* EARLY RETURN MODAL */}
            {earlyReturnModalOpen && selectedAppForEarlyReturn && (
                <div className={styles.modalOverlay} onClick={() => setEarlyReturnModalOpen(false)}>
                    <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <RotateCcw size={20} color="#2563eb" />
                                <h3 style={{ margin: 0 }}>{readData("components.Clerio.LeaveView", "LeaveView_text_165")}</h3>
                            </div>
                            <button
                                onClick={() => setEarlyReturnModalOpen(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)' }}
                            >{readData("components.Clerio.LeaveView", "LeaveView_text_166")}</button>
                        </div>

                        <div style={{ background: 'var(--card-2)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.78rem' }}>
                            <div>{readData("components.Clerio.LeaveView", "LeaveView_text_167")}<strong>{selectedAppForEarlyReturn.id}</strong>{readData("components.Clerio.LeaveView", "LeaveView_text_168")}{selectedAppForEarlyReturn.employee_name}{readData("components.Clerio.LeaveView", "LeaveView_text_169")}</div>
                            <div>{readData("components.Clerio.LeaveView", "LeaveView_text_170")}<strong>{selectedAppForEarlyReturn.start_date}{readData("components.Clerio.LeaveView", "LeaveView_text_171")}{selectedAppForEarlyReturn.end_date}{readData("components.Clerio.LeaveView", "LeaveView_text_172")}{selectedAppForEarlyReturn.chargeable_days}{readData("components.Clerio.LeaveView", "LeaveView_text_173")}</strong></div>
                        </div>

                        <div>
                            <label className={styles.formLabel}>{readData("components.Clerio.LeaveView", "LeaveView_text_174")}</label>
                            <input
                                type="date"
                                className={styles.formInput}
                                value={actualReturnDate}
                                onChange={(e) => setActualReturnDate(e.target.value)}
                            />
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-2)', marginTop: '0.25rem', display: 'block' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_175")}{selectedAppForEarlyReturn.end_date}{readData("components.Clerio.LeaveView", "LeaveView_text_176")}</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <button
                                type="button"
                                className={styles.btnSecondary}
                                onClick={() => setEarlyReturnModalOpen(false)}
                            >{readData("components.Clerio.LeaveView", "LeaveView_text_177")}</button>
                            <button
                                type="button"
                                className={styles.btnPrimary}
                                onClick={confirmEarlyReturn}
                            >{readData("components.Clerio.LeaveView", "LeaveView_text_178")}</button>
                        </div>
                    </div>
                </div>
            )}
            <LeaveApplicationModal isOpen={isApplyModalOpen} onClose={() => setIsApplyModalOpen(false)} onSubmit={handleApplyWorkflow} leaveTypeCode={leaveTypeCode} setLeaveTypeCode={setLeaveTypeCode} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} sandwichEnabled={sandwichEnabled} setSandwichEnabled={setSandwichEnabled} reason={reason} setReason={setReason} />
        </div>
    );
};

export default LeaveView;
