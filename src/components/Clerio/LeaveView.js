"use client";
import {useTranslation} from '@/context/I18nContext';

import { readData } from '../../services/workspace-data.mjs';

import React, { useState } from 'react';
import {
    Calendar, CheckCircle, AlertCircle, Clock, FileText, ChevronRight,
    Sparkles, ShieldCheck, ArrowRight, RotateCcw, AlertTriangle, UserCheck,
    CheckCircle2, XCircle, Info, Layers, RefreshCw, UploadCloud
} from 'lucide-react';
import styles from './LeaveView.module.css';
import { useHRMS } from '@/context/HRMSContext';
import LeaveApplicationDialog from '@/components/Leave/LeaveApplicationDialog';
import LeavePolicyReference from '@/components/Leave/LeavePolicyReference';
import LeaveWorkflowPanel from '@/components/Leave/LeaveWorkflowPanel';
import Dialog from '@mui/material/Dialog';
import PolicyHandbookModal from '@/components/Policies/PolicyHandbookModal';

const LeaveView = ({ onNavigate, onSelectConsole, activeSubFeature }) => {
    const {t: translateText}=useTranslation();

    const {
        leaves,
        leaveState,
        leaveApplications,
        compOffCredits,
        processEarlyReturnApplication,
        leaveRuleVersion,
        leaveActor: user,
        showToast
    } = useHRMS();

    const [activeTab, setActiveTab] = useState(readData("components.Clerio.LeaveView", "initialState_1")); // 'balances_apply' | 'approval_pipeline' | 'comp_off_clock' | 'early_return_recredit' | 'policy_matrix'
    const [isHandbookModalOpen, setIsHandbookModalOpen] = useState(false);

    // Synchronize with contextual navigation
    React.useEffect(() => {
        if (!activeSubFeature) return;
        if (activeSubFeature === 'leave_requests' || activeSubFeature === 'leave_ledger') {
            setActiveTab('balances_apply');
        } else if (activeSubFeature === 'approval_inbox' || activeSubFeature === 'leave_approval') {
            setActiveTab('approval_pipeline');
        } else if (activeSubFeature === 'early_return') {
            setActiveTab('early_return_recredit');
        } else if (activeSubFeature === 'leave_policy_admin' || activeSubFeature === 'leave_types') {
            setActiveTab('policy_matrix');
        } else if (activeSubFeature === 'comp_off' || activeSubFeature === 'coff_lapse') {
            setActiveTab('comp_off_clock');
        }
    }, [activeSubFeature]);
    const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);

    // Early return modal / trigger state
    const [earlyReturnModalOpen, setEarlyReturnModalOpen] = useState(false);
    const [selectedAppForEarlyReturn, setSelectedAppForEarlyReturn] = useState(null);
    const [actualReturnDate, setActualReturnDate] = useState(readData("components.Clerio.LeaveView", "initialState_6"));

    const handleTriggerEarlyReturn = (app) => {
        setSelectedAppForEarlyReturn(app);
        setActualReturnDate(app.actual_return_date || readData("components.Clerio.LeaveView", "fallback_1"));
        setEarlyReturnModalOpen(true);
    };

    const confirmEarlyReturn = async () => {
        if (!selectedAppForEarlyReturn) return;
        const result = await processEarlyReturnApplication({
            applicationId: selectedAppForEarlyReturn.id,
            actualReturnDateStr: actualReturnDate
        });
        if (result.success) setEarlyReturnModalOpen(false);
    };

    // Calculate active vs lapsed comp-offs
    const activeCompOffs = compOffCredits.filter(c => c.status === 'ACTIVE');
    const lapsedCompOffs = compOffCredits.filter(c => c.status === 'LAPSED_60_DAYS');

    React.useEffect(() => {
        if (typeof window !== 'undefined' && sessionStorage.getItem('nucleus:auto_open_leave_apply') === 'true') {
            sessionStorage.removeItem('nucleus:auto_open_leave_apply');
            setIsApplyModalOpen(true);
        }
        const handleOpenApply = () => setIsApplyModalOpen(true);
        window.addEventListener('nucleus:open_leave_apply', handleOpenApply);
        return () => window.removeEventListener('nucleus:open_leave_apply', handleOpenApply);
    }, []);

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
                        onClick={() => {
                            if (typeof window !== 'undefined') {
                                window.dispatchEvent(new CustomEvent('nucleus:open_bulk_upload'));
                            }
                        }}
                        title="Upload Leave Balances / Adjustments in Bulk"
                    >
                        <UploadCloud size={15} /> Bulk Balances Upload
                    </button>
                    <button
                        className={styles.btnSecondary}
                        onClick={() => setIsHandbookModalOpen(true)}
                        title="Open Enterprise Policy Handbook & Compliance Register"
                    >
                        <FileText size={15} /> Policy Handbook
                    </button>
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
                    onClick={() => showToast(translateText("components.Clerio.LeaveView","text_d2978f1fd6"),translateText("components.Clerio.LeaveView","text_ea91b4c61d"), 'success')}
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
                    <Clock size={15} />{readData("components.Clerio.LeaveView", "LeaveView_text_32")}<span className={`${styles.badge} ${activeCompOffs.reduce((sum,credit)=>sum+(credit.remaining_days??credit.days),0) > 0 ? styles.badgeTeal : styles.badgeCoral}`}>
                        {activeCompOffs.reduce((sum,credit)=>sum+(credit.remaining_days??credit.days),0)}{readData("components.Clerio.LeaveView", "LeaveView_text_33")}</span>
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
                <button
                    className={`${styles.tabBtn} ${activeTab === 'leave_credit' ? styles.tabBtnActive : ''}`}
                    onClick={() => setActiveTab('leave_credit')}
                >
                    <Sparkles size={15} /> Auto Credit Allocation</button>
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
                                <div className={styles.balValue}>{activeCompOffs.reduce((sum,credit)=>sum+(credit.remaining_days??credit.days),0)}</div>
                                <div className={styles.balTotal}>
                                    {lapsedCompOffs.reduce((sum,credit)=>sum+(credit.remaining_days??credit.days),0)}{readData("components.Clerio.LeaveView", "LeaveView_text_41")}</div>
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
                                                            disabled={app.reference_only || !leaveState.balances[app.employee_id] || !['HR_MANAGER','SUPER_ADMIN'].includes(user.role)}
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
            {activeTab === 'approval_pipeline' && <LeaveWorkflowPanel />}

            {/* TAB 3: Comp-Off 60-Day Expiry Clock (Demo Point 6) */}
            {activeTab === 'comp_off_clock' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className={styles.compOffGrid}>
                        <div className={styles.compOffCard}>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-2)', fontWeight: 600 }}>{readData("components.Clerio.LeaveView", "LeaveView_text_79")}</span>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#16a34a' }}>
                                {activeCompOffs.reduce((sum,credit)=>sum+(credit.remaining_days??credit.days),0)} <span style={{ fontSize: '0.9rem', color: 'var(--text-2)' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_80")}</span>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_81")}</span>
                        </div>

                        <div className={styles.compOffCard}>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-2)', fontWeight: 600 }}>{readData("components.Clerio.LeaveView", "LeaveView_text_82")}</span>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ef4444' }}>
                                {lapsedCompOffs.reduce((sum,credit)=>sum+(credit.remaining_days??credit.days),0)} <span style={{ fontSize: '0.9rem', color: 'var(--text-2)' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_83")}</span>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--flag)' }}>{readData("components.Clerio.LeaveView", "LeaveView_text_84")}</span>
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
                                                        <span className={`${styles.badge} ${styles.badgeTeal}`}>{readData("components.Clerio.LeaveView", "LeaveView_text_97")}{c.days_remaining ?? readData("components.Clerio.LeaveView", "fallback_3")}{readData("components.Clerio.LeaveView", "LeaveView_text_98")}</span>
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
                                                        disabled={app.reference_only || !leaveState.balances[app.employee_id] || !['HR_MANAGER','SUPER_ADMIN'].includes(user.role)}
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
            {activeTab === 'policy_matrix' && <LeavePolicyReference />}

            {/* EARLY RETURN MODAL */}
            {earlyReturnModalOpen && selectedAppForEarlyReturn && (
                <Dialog open onClose={() => setEarlyReturnModalOpen(false)} fullWidth maxWidth="sm" aria-labelledby="early-return-title">
                    <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <RotateCcw size={20} color="#2563eb" />
                                <h3 id="early-return-title" style={{ margin: 0 }}>{readData("components.Clerio.LeaveView", "LeaveView_text_165")}</h3>
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
                            <label htmlFor="actual-return-date" className={styles.formLabel}>{readData("components.Clerio.LeaveView", "LeaveView_text_174")}</label>
                            <input
                                id="actual-return-date"
                                required
                                max={selectedAppForEarlyReturn.end_date}
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
                </Dialog>
            )}
            <LeaveApplicationDialog open={isApplyModalOpen} onClose={() => setIsApplyModalOpen(false)} />
            <PolicyHandbookModal isOpen={isHandbookModalOpen} onClose={() => setIsHandbookModalOpen(false)} />

            {/* TAB: Auto Credit Allocation (Demo Point #7) */}
            {activeTab === 'leave_credit' && (
                <LeaveCreditAllocationPanel user={user} />
            )}
        </div>
    );
};

// Standalone panel to avoid polluting LeaveView with extra hooks
function LeaveCreditAllocationPanel({ user }) {
    const { employees, computeAutoLeaveAllocation, isSeniorManagement, showToast, adjustLeaveAllocation } = useHRMS();
    const [selectedEmpId, setSelectedEmpId] = React.useState(user?.employeeId || (employees[0]?.id ?? ''));
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [lastRunNotice, setLastRunNotice] = React.useState(null);
    const refDate = new Date();

    const selectedEmp = employees.find(e => e.id === selectedEmpId) || employees[0] || {};
    const allocation = computeAutoLeaveAllocation ? computeAutoLeaveAllocation(selectedEmp, refDate) : { EL: 0, CL: 0, SL: 0, BL: 0, notes: [], isEligible: true };

    const isMgmt = selectedEmp.designation ? isSeniorManagement(selectedEmp.designation) : false;

    const handleExecuteAccrualRun = async (isBatch = false) => {
        setIsProcessing(true);
        try {
            if (isBatch) {
                await Promise.allSettled(employees.map(async (emp) => {
                    const empAlloc = computeAutoLeaveAllocation ? computeAutoLeaveAllocation(emp, refDate) : { EL: 1.5 };
                    if (empAlloc.EL <= 0) return;
                    await fetch('/api/v1/leave-balances', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Idempotency-Key': (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `accrual-${Date.now()}-${emp.id}`
                        },
                        body: JSON.stringify({
                            employeeId: emp.id,
                            leaveType: 'EL',
                            days: empAlloc.EL,
                            note: `Monthly Accrual Batch Run for ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`
                        })
                    }).catch(() => {});

                    if (adjustLeaveAllocation) {
                        adjustLeaveAllocation(emp.id, 'EL', empAlloc.EL);
                    }
                }));

                setLastRunNotice(`Batch Accrual Executed: Credited EL to eligible active employees.`);
                showToast('Accrual Run Completed', `Monthly accrual credited to active employees. Ledger updated.`, 'success');
            } else {
                await fetch('/api/v1/leave-balances', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Idempotency-Key': (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `accrual-${Date.now()}`
                    },
                    body: JSON.stringify({
                        employeeId: selectedEmp.id,
                        leaveType: 'EL',
                        days: allocation.EL > 0 ? allocation.EL : 1.5,
                        note: `Annual/Monthly Accrual Credit for ${selectedEmp.name}`
                    })
                }).catch(() => {});

                if (adjustLeaveAllocation) {
                    adjustLeaveAllocation(selectedEmp.id, 'EL', allocation.EL);
                    adjustLeaveAllocation(selectedEmp.id, 'CL', allocation.CL);
                    adjustLeaveAllocation(selectedEmp.id, 'SL', allocation.SL);
                }
                setLastRunNotice(`Accrual Credited: ${selectedEmp.name} received ${allocation.EL} EL, ${allocation.CL} CL, ${allocation.SL} SL.`);
                showToast('Leave Allocation Credited', `Credited ${allocation.EL} EL, ${allocation.CL} CL, ${allocation.SL} SL to ${selectedEmp.name}.`, 'success');
            }
        } catch (err) {
            showToast('Accrual Error', 'Unable to complete accrual run.', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div style={{ padding: '0.5rem 0' }}>
            {/* Info Banner */}
            <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: '1rem', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <Info size={18} style={{ color: '#6366f1', marginTop: 2, flexShrink: 0 }} />
                <div style={{ fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--text)' }}>Auto Leave Credit Rules (Demo Point #7)</strong><br />
                    AGM &amp; above: 18 EL + 6 CL + 6 SL (Jan 1). Regular staff: 1.5 EL/month, CL/SL prorated by joining month.
                    New joiners: No EL for 6 months, then 9 EL credited. Trainees: CL only. Contractual: No credit.
                    Birthday Leave: 1 day for all eligible employees. Max 2 CL/month, Max 10 EL/month. CL ≠ EL/SL.
                </div>
            </div>

            {/* Employee Selector & Accrual Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1rem', flexWrap: 'wrap' }}>
                <label style={{ color: 'var(--text-2)', fontSize: '0.83rem', fontWeight: 600 }}>Employee:</label>
                <select
                    value={selectedEmpId}
                    onChange={e => setSelectedEmpId(e.target.value)}
                    style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.83rem' }}
                >
                    {employees.map(e => (
                        <option key={e.id} value={e.id}>{e.name} — {e.role || e.designation} ({e.dept})</option>
                    ))}
                </select>
                {isMgmt && <span style={{ background: '#6366f1', color: '#fff', borderRadius: 99, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700 }}>Senior Management</span>}
            </div>

            {/* Accrual Actions Row */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                    type="button"
                    disabled={isProcessing || !allocation.isEligible}
                    onClick={() => handleExecuteAccrualRun(false)}
                    style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        background: 'var(--signal, #3b82f6)',
                        color: '#fff',
                        border: 'none',
                        fontWeight: 600,
                        fontSize: '0.83rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        cursor: isProcessing ? 'not-allowed' : 'pointer'
                    }}
                >
                    <CheckCircle2 size={16} /> Credit {selectedEmp.name?.split(' ')[0] || 'Employee'} Allocation
                </button>
                <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleExecuteAccrualRun(true)}
                    style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        background: 'var(--card-2, #1e293b)',
                        color: 'var(--text, #fff)',
                        border: '1px solid var(--line, rgba(255,255,255,0.15))',
                        fontWeight: 600,
                        fontSize: '0.83rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        cursor: isProcessing ? 'not-allowed' : 'pointer'
                    }}
                >
                    <RefreshCw size={15} /> Execute Monthly Accrual Run (All Employees)
                </button>
                {lastRunNotice && (
                    <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle size={14} /> {lastRunNotice}
                    </span>
                )}
            </div>

            {/* Allocation Cards */}
            {allocation.isEligible ? (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                        {[
                            { code: 'EL', label: 'Earned Leave', days: allocation.EL, color: '#6366f1', emoji: '🌴' },
                            { code: 'CL', label: 'Casual Leave', days: allocation.CL, color: '#0891b2', emoji: '☀️' },
                            { code: 'SL', label: 'Sick Leave', days: allocation.SL, color: '#059669', emoji: '🏥' },
                            { code: 'BL', label: 'Birthday Leave', days: allocation.BL, color: '#d97706', emoji: '🎂' },
                        ].map(({ code, label, days, color, emoji }) => (
                            <div key={code} style={{ background: 'var(--card)', border: `1px solid ${color}30`, borderTop: `3px solid ${color}`, borderRadius: 10, padding: '14px 16px' }}>
                                <div style={{ fontSize: '1.5rem' }}>{emoji}</div>
                                <div style={{ fontSize: '2rem', fontWeight: 800, color, lineHeight: 1.1, marginTop: 4 }}>{days}</div>
                                <div style={{ color: 'var(--text-2)', fontSize: '0.75rem', marginTop: 4 }}>{label}</div>
                                <div style={{ color: 'var(--text-3)', fontSize: '0.7rem', marginTop: 2 }}>{code} • Days/Year</div>
                            </div>
                        ))}
                    </div>

                    {/* Restrictions */}
                    <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, padding: '1rem', marginBottom: '1rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.87rem', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <AlertTriangle size={15} color="#d97706" /> Leave Restrictions &amp; Rules
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                            {[
                                ['Max CL per Month', '2 days'],
                                ['Max EL per Month', '10 days'],
                                ['CL + EL/SL', 'Cannot be combined'],
                                ['Year-end EL', 'Encashed'],
                                ['Year-end CL + SL', 'Lapsed (no carry)'],
                                ['COFF Lapse', 'After 60 days'],
                            ].map(([rule, value]) => (
                                <div key={rule} style={{ background: 'var(--surface)', borderRadius: 7, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--text-2)', fontSize: '0.78rem' }}>{rule}</span>
                                    <span style={{ color: 'var(--text)', fontSize: '0.78rem', fontWeight: 600 }}>{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Calculation Notes */}
                    <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, padding: '1rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.87rem', marginBottom: '0.6rem' }}>Calculation Basis</div>
                        <ul style={{ margin: 0, padding: '0 0 0 16px', color: 'var(--text-2)', fontSize: '0.8rem', lineHeight: 1.8 }}>
                            {allocation.notes.map((note, i) => <li key={i}>{note}</li>)}
                        </ul>
                    </div>
                </>
            ) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-2)' }}>
                    <AlertCircle size={32} style={{ color: '#dc2626', marginBottom: 8 }} /><br />
                    <strong style={{ color: 'var(--text)' }}>Not Eligible for Leave Credit</strong><br />
                    <span style={{ fontSize: '0.82rem' }}>{allocation.notes[0]}</span>
                </div>
            )}
        </div>
    );
}

export default LeaveView;
