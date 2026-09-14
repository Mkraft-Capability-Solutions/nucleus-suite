"use client";
import {useTranslation} from '@/context/I18nContext';

import { readData } from '../../services/workspace-data.mjs';

import React, { useState, useEffect } from 'react';
import {
    Clock, Calendar as CalIcon, MapPin, ChevronLeft, ChevronRight,
    FileText, CheckCircle, AlertCircle, TrendingUp, Sparkles, Smartphone, ShieldCheck,
    RefreshCw, KeyRound, UserCheck, CheckCircle2, XCircle, Plus, Info, Building2, UploadCloud
} from 'lucide-react';
import styles from './AttendanceView.module.css';
import { useHRMS } from '@/context/HRMSContext';

const AttendanceView = ({ onNavigate, onSelectConsole, activeSubFeature }) => {
    const {t: translateText}=useTranslation();

    const {
        attendance,
        attendanceAnomalies,
        punchIn,
        punchOut,
        gatePasses,
        requestGatePass,
        approveGatePass,
        attendanceRegularizations,
        requestRegularization,
        decideRegularization,
        timeOfficeLedger,
        recomputeAttendanceRecord,
        workerCategories,
        workCalendars,
        rulesetVersion,
        user,
        showToast
    } = useHRMS();

    const [activeTab, setActiveTab] = useState(readData("components.Clerio.AttendanceView", "initialState_1")); // 'monthly_ledger' | 'gate_pass' | 'regularization' | 'time_office_ledger' | 'worker_categories'
    const [currentMonth, setCurrentMonth] = useState(readData("components.Clerio.AttendanceView", "initialState_2"));
    const [selectedPlant, setSelectedPlant] = useState(readData("components.Clerio.AttendanceView", "initialState_3"));
    const [isAnomalyModalOpen, setIsAnomalyModalOpen] = useState(false);
    const [anomaliesList, setAnomaliesList] = useState([
        {
            id: 1,
            employee: "Amit Verma",
            type: "Buddy Punching Alert (Device IP Subnet Shift)",
            confidence: "94%",
            note: "Biometric device IP mismatch: Terminal logged from subnet 192.168.4.x instead of registered plant subnet 10.20.1.x."
        },
        {
            id: 2,
            employee: "Rahul Saxena",
            type: "Late Pattern (3 consecutive Mondays)",
            confidence: "88%",
            note: "Average delay: 48 minutes across shifts."
        }
    ]);

    useEffect(() => {
        if (!activeSubFeature) return;
        if (activeSubFeature === 'check_in_out' || activeSubFeature === 'my_attendance' || activeSubFeature === 'attendance_detail' || activeSubFeature === 'monthly_ledger') {
            setActiveTab('monthly_ledger');
        } else if (activeSubFeature === 'gate_passes' || activeSubFeature === 'gate_pass') {
            setActiveTab('gate_pass');
        } else if (activeSubFeature === 'regularizations' || activeSubFeature === 'attendance_regularization' || activeSubFeature === 'regularization') {
            setActiveTab('regularization');
        } else if (activeSubFeature === 'overtime_register' || activeSubFeature === 'attendance_exceptions' || activeSubFeature === 'recompute_monitor' || activeSubFeature === 'time_office_ledger') {
            setActiveTab('time_office_ledger');
        } else if (activeSubFeature === 'worker_categories' || activeSubFeature === 'team_history' || activeSubFeature === 'ops_rosters') {
            setActiveTab('worker_categories');
        }
    }, [activeSubFeature]);

    // Gate Pass Request Modal State
    const [isGatePassModalOpen, setIsGatePassModalOpen] = useState(false);
    const [gpDuration, setGpDuration] = useState(readData("components.Clerio.AttendanceView", "initialState_4"));
    const [gpType, setGpType] = useState(readData("components.Clerio.AttendanceView", "initialState_5"));
    const [gpReason, setGpReason] = useState('');

    // Gate pass quota summary for current user
    const userGatePasses = gatePasses.filter(gp => gp.employee_id === 'EMP-101' && gp.status !== 'REJECTED');
    const usedMinutes = userGatePasses.reduce((acc, gp) => acc + (gp.minutes || 0), 0);
    const usedCount = userGatePasses.length;
    const remainingMinutes = Math.max(0, 240 - usedMinutes);
    const remainingCount = Math.max(0, 2 - usedCount);

    // Regularization Workflow State
    const [isRegModalOpen, setIsRegModalOpen] = useState(false);
    const [regDate, setRegDate] = useState(new Date().toISOString().split('T')[0]);
    const [regKind, setRegKind] = useState('missing-punch');
    const [regReason, setRegReason] = useState('');
    const [regClaimedIn, setRegClaimedIn] = useState('09:00 AM');
    const [regClaimedOut, setRegClaimedOut] = useState('06:00 PM');
    const [regFilterStatus, setRegFilterStatus] = useState('ALL');

    const handleCreateRegularization = async (e) => {
        e.preventDefault();
        if (!regDate) {
            showToast('Validation Error', 'Attendance date is required', 'error');
            return;
        }
        if (!regReason.trim() || regReason.trim().length < 5) {
            showToast('Validation Error', 'Justification reason must be at least 5 characters', 'error');
            return;
        }
        if (requestRegularization) {
            await requestRegularization({
                employeeId: user?.id || 'EMP-101',
                employeeName: user?.name || 'Arjun Sharma',
                date: regDate,
                kind: regKind,
                reason: regReason.trim(),
                claimedIn: regClaimedIn,
                claimedOut: regClaimedOut
            });
        }
        setIsRegModalOpen(false);
        setRegReason('');
    };

    const handleCreateGatePass = (e) => {
        e.preventDefault();
        const errors = [];
        if (!gpType) errors.push('Gate pass type (Personal / Official Duty) is required');
        if (!gpDuration || Number(gpDuration) <= 0) errors.push('Duration is required — please select a valid duration');
        if (!gpReason.trim() || gpReason.trim().length < 5)
            errors.push('Reason must be at least 5 characters');

        if (errors.length > 0) {
            showToast('Validation Error', errors[0], 'error');
            return;
        }

        // Duplicate check — employee already has a pending gate pass today
        const todayStr = new Date().toISOString().split('T')[0];
        const existingToday = (gatePasses || []).filter(gp =>
            gp.employee_id === 'EMP-101' &&
            gp.status === 'PENDING' &&
            gp.date?.startsWith(todayStr)
        );
        if (existingToday.length > 0) {
            showToast('Duplicate Entry', 'You already have a pending gate pass request for today. Please wait for approval before submitting another.', 'error');
            return;
        }

        const res = requestGatePass({
            ...readData("components.Clerio.AttendanceView", "res_fields_1"),
            employeeName: user?.name || readData("components.Clerio.AttendanceView", "fallback_1"),
            ...readData("components.Clerio.AttendanceView", "res_fields_2"),
            type: gpType,
            minutes: Number(gpDuration),
            reason: gpReason.trim()
        });
        if (res.success) {
            try {
                fetch('/api/v1/gate-passes', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Idempotency-Key': crypto.randomUUID(),
                    },
                    body: JSON.stringify({
                        employeeId: user?.id || 'c668678c-ed74-4dbb-a98b-0287afc8f286',
                        date: todayStr,
                        minutes: Number(gpDuration) === 240 ? 240 : 120,
                        reason: gpReason.trim()
                    })
                }).catch(e => console.warn('Gate pass DB sync notice:', e));
            } catch {}
            setIsGatePassModalOpen(false);
            setGpReason('');
        }
    };


    // Mock Calendar Data
    const days = Array.from(readData("components.Clerio.AttendanceView", "days_3"), (_, i) => {
        const day = i + 1;
        let status = 'present';
        if (day % 7 === 0 || day % 7 === 6) status = 'weekend';
        else if (day === 14) status = 'absent';
        else if (day === 5 || day === 20) status = 'late';
        return { day, status };
    });

    return (
        <div className={styles.attendanceContainer}>
            {/* Header */}
            <div className={styles.headerRow}>
                <div className={styles.titleBlock}>
                    <h2>{readData("components.Clerio.AttendanceView", "AttendanceView_text_4")}</h2>
                    <p>{readData("components.Clerio.AttendanceView", "AttendanceView_text_5")}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {(onNavigate || onSelectConsole) && (
                        <button
                            className={styles.btnSecondary}
                            onClick={() => {
                                if (onSelectConsole) onSelectConsole('S3');
                                if (onNavigate) onNavigate('dashboard', 'dashboard', 's3');
                            }}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                border: '1px solid var(--line-glow)',
                                background: 'var(--signal-wash)',
                                color: 'var(--signal)',
                                fontWeight: 700
                            }}
                            title={readData("components.Clerio.AttendanceView", "AttendanceView_title_6")}
                        >
                            <TrendingUp size={15} />{readData("components.Clerio.AttendanceView", "AttendanceView_text_7")}</button>
                    )}
                    <button
                        className={styles.btnSecondary}
                        onClick={() => {
                            if (typeof window !== 'undefined') {
                                window.dispatchEvent(new CustomEvent('nucleus:open_bulk_upload'));
                            }
                        }}
                        title="Upload Biometric / Swipe Machine Punches in Bulk"
                    >
                        <UploadCloud size={15} /> Bulk Punches Upload
                    </button>
                    {attendance.status === 'present' ? (
                        <button className={styles.btnPrimary} style={{ background: 'var(--flag)', color: 'var(--on-signal)' }} onClick={punchOut}>
                            <Clock size={16} />{readData("components.Clerio.AttendanceView", "AttendanceView_text_8")}</button>
                    ) : (
                        <button className={styles.btnPrimary} style={{ background: 'var(--status-ok)', color: 'var(--on-signal)' }} onClick={punchIn}>
                            <Clock size={16} />{readData("components.Clerio.AttendanceView", "AttendanceView_text_9")}</button>
                    )}
                    <button
                        className={styles.btnSecondary}
                        onClick={() => setIsRegModalOpen(true)}
                        style={{ border: '1px solid var(--line-glow)', color: 'var(--signal)', fontWeight: 600 }}
                        title="Submit Attendance Regularization Request"
                    >
                        <UserCheck size={15} /> Request Regularization
                    </button>
                    <button
                        className={styles.btnSecondary}
                        onClick={() => setIsGatePassModalOpen(true)}
                        style={{ border: '1px solid var(--line-glow)', color: 'var(--signal)' }}
                    >
                        <KeyRound size={15} />{readData("components.Clerio.AttendanceView", "AttendanceView_text_10")}</button>
                    <button className={styles.btnSecondary} onClick={() => showToast(translateText("components.Clerio.AttendanceView","text_bf34462856"),translateText("components.Clerio.AttendanceView","text_0bf6412031"), 'info')}>
                        <FileText size={16} />{readData("components.Clerio.AttendanceView", "AttendanceView_text_11")}</button>
                </div>
            </div>

            {/* Time-Office Engine Version & Rule Status Banner */}
            <div className={styles.engineBanner}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <ShieldCheck size={24} color="var(--signal)" />
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <strong style={{ color: 'var(--text)', fontSize: '0.92rem' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_12")}</strong>
                            <span className={`${styles.badge} ${styles.badgeBlue}`}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_13")}{rulesetVersion || readData("components.Clerio.AttendanceView", "fallback_2")}</span>
                            <span className={`${styles.badge} ${styles.badgeTeal}`}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_14")}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginTop: '0.2rem' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_15")}</div>
                    </div>
                </div>
                <button
                    className={styles.btnSecondary}
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                    onClick={() => showToast(translateText("components.Clerio.AttendanceView","text_e1bbe08261"),translateText("components.Clerio.AttendanceView","text_06d3452f42"), 'success')}
                >
                    <CheckCircle size={14} color="var(--status-ok)" />{readData("components.Clerio.AttendanceView", "AttendanceView_text_16")}</button>
            </div>

            {/* Subnavigation Tabs */}
            <div className={styles.subnavTabs}>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'monthly_ledger' ? styles.tabBtnActive : ''}`}
                    onClick={() => setActiveTab('monthly_ledger')}
                >
                    <CalIcon size={15} />{readData("components.Clerio.AttendanceView", "AttendanceView_text_17")}</button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'gate_pass' ? styles.tabBtnActive : ''}`}
                    onClick={() => setActiveTab('gate_pass')}
                >
                    <KeyRound size={15} />{readData("components.Clerio.AttendanceView", "AttendanceView_text_18")}<span className={`${styles.badge} ${usedCount >= 2 ? styles.badgeCoral : styles.badgeBlue}`}>
                        {usedCount}{readData("components.Clerio.AttendanceView", "AttendanceView_text_19")}</span>
                </button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'regularization' ? styles.tabBtnActive : ''}`}
                    onClick={() => setActiveTab('regularization')}
                >
                    <UserCheck size={15} /> Regularizations
                    <span className={`${styles.badge} ${styles.badgePurple}`}>
                        {(attendanceRegularizations || []).filter(r => r.status === 'submitted' || r.status === 'supervisor_approved').length} Active
                    </span>
                </button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'time_office_ledger' ? styles.tabBtnActive : ''}`}
                    onClick={() => setActiveTab('time_office_ledger')}
                >
                    <RefreshCw size={15} />{readData("components.Clerio.AttendanceView", "AttendanceView_text_20")}<span className={`${styles.badge} ${styles.badgeTeal}`}>{timeOfficeLedger.length}{readData("components.Clerio.AttendanceView", "AttendanceView_text_21")}</span>
                </button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'worker_categories' ? styles.tabBtnActive : ''}`}
                    onClick={() => setActiveTab('worker_categories')}
                >
                    <Building2 size={15} />{readData("components.Clerio.AttendanceView", "AttendanceView_text_22")}</button>
            </div>

            {/* TAB 1: Monthly Calendar & Punches */}
            {activeTab === 'monthly_ledger' && (
                <>
                    {/* Top Stat Cards */}
                    <div className={styles.statsRow}>
                        <div className={styles.statCard}>
                            <span className={styles.statLabel}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_23")}</span>
                            <span className={styles.statValue}>{attendance.totalHours}</span>
                            <span className={styles.statSub}>
                                {attendance.status === 'present' ?translateText("components.Clerio.AttendanceView","text_48c93fbf08", {value1: String(attendance.punchInTime)}) : readData("components.Clerio.AttendanceView", "display_6")}
                            </span>
                        </div>
                        <div className={styles.statCard}>
                            <span className={styles.statLabel}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_24")}</span>
                            <span className={styles.statValue} style={{ fontSize: '1.2rem', marginTop: '0.2rem' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_25")}</span>
                            <span className={styles.statSub} style={{ color: 'var(--signal)' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_26")}</span>
                        </div>
                        <div className={styles.statCard}>
                            <span className={styles.statLabel}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_27")}</span>
                            <span className={styles.statValue} style={{ fontSize: '1.2rem', color: usedMinutes > 180 ? 'var(--pending)' : 'var(--status-ok)', marginTop: '0.2rem' }}>
                                {usedMinutes}{readData("components.Clerio.AttendanceView", "AttendanceView_text_28")}</span>
                            <span className={styles.statSub}>{remainingCount}{readData("components.Clerio.AttendanceView", "AttendanceView_text_29")}</span>
                        </div>
                    </div>

                    {/* AI Anomaly Detection Banner */}
                    <div className={styles.anomalyBanner}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Sparkles size={22} color="var(--pending)" />
                            <div>
                                <strong style={{ color: 'var(--pending)' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_30")}</strong>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-2)' }}>
                                    {anomaliesList.length} potential anomalies flagged for HR review (e.g. Device IP subnet shifts)</div>
                            </div>
                        </div>
                        <button className={styles.anomalyBtn} onClick={() => setIsAnomalyModalOpen(true)}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_32")}</button>
                    </div>

                    {/* Main Calendar View */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h3><CalIcon size={20} color="var(--signal)" />{readData("components.Clerio.AttendanceView", "AttendanceView_text_33")}</h3>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <button className={styles.btnSecondary} style={{ padding: '0.35rem 0.6rem' }}><ChevronLeft size={16} /></button>
                                <strong>{currentMonth}</strong>
                                <button className={styles.btnSecondary} style={{ padding: '0.35rem 0.6rem' }}><ChevronRight size={16} /></button>
                            </div>
                        </div>

                        <div className={styles.calendarGrid}>
                            {readData("components.Clerio.AttendanceView", "AttendanceView_34").map(d => (
                                <div key={d} className={styles.dayHeader}>
                                    {d}
                                </div>
                            ))}
                            {days.map(({ day, status }) => (
                                <div
                                    key={day}
                                    className={`${styles.dayCell} ${status === 'present' ? styles.dayPresent : status === 'absent' ? styles.dayAbsent : status === 'late' ? styles.dayLate : styles.dayWeekend}`}
                                >
                                    <span className={styles.dayNumber}>{day}</span>
                                    <span className={styles.dayStatus}>
                                        {status === 'present' ? readData("components.Clerio.AttendanceView", "display_7") : status === 'late' ? readData("components.Clerio.AttendanceView", "display_8") : status === 'absent' ? readData("components.Clerio.AttendanceView", "display_9") : readData("components.Clerio.AttendanceView", "display_10")}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* TAB 2: Gate Pass Quota & Ledger (Demo Point 11) */}
            {activeTab === 'gate_pass' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className={styles.quotaGrid}>
                        <div className={styles.quotaCard}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span className={styles.statLabel}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_35")}</span>
                                <span className={`${styles.badge} ${remainingMinutes === 0 ? styles.badgeCoral : styles.badgeTeal}`}>
                                    {remainingMinutes}{readData("components.Clerio.AttendanceView", "AttendanceView_text_36")}</span>
                            </div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                                {usedMinutes} <span style={{ fontSize: '0.85rem', color: 'var(--text-2)' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_37")}</span>
                            </div>
                            <div className={styles.progressBar}>
                                <div
                                    className={styles.progressFill}
                                    style={{
                                        width: `${Math.min(100, (usedMinutes / 240) * 100)}%`,
                                        background: usedMinutes >= 240 ? 'var(--flag)' : usedMinutes > 180 ? 'var(--pending)' : 'var(--status-ok)'
                                    }}
                                />
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_38")}</span>
                        </div>

                        <div className={styles.quotaCard}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span className={styles.statLabel}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_39")}</span>
                                <span className={`${styles.badge} ${remainingCount === 0 ? styles.badgeCoral : styles.badgeBlue}`}>
                                    {remainingCount}{readData("components.Clerio.AttendanceView", "AttendanceView_text_40")}</span>
                            </div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                                {usedCount} <span style={{ fontSize: '0.85rem', color: 'var(--text-2)' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_41")}</span>
                            </div>
                            <div className={styles.progressBar}>
                                <div
                                    className={styles.progressFill}
                                    style={{
                                        width: `${Math.min(100, (usedCount / 2) * 100)}%`,
                                        background: usedCount >= 2 ? 'var(--flag)' : 'var(--signal)'
                                    }}
                                />
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_42")}</span>
                        </div>

                        <div className={styles.quotaCard} style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                            <KeyRound size={28} color="var(--signal)" />
                            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_43")}</div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-2)', margin: 0 }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_44")}</p>
                            <button
                                className={styles.btnPrimary}
                                style={{ width: '100%', marginTop: '0.5rem' }}
                                onClick={() => setIsGatePassModalOpen(true)}
                                disabled={usedCount >= 2 || remainingMinutes <= 0}
                            >
                                <Plus size={15} />{readData("components.Clerio.AttendanceView", "AttendanceView_text_45")}</button>
                        </div>
                    </div>

                    {/* Gate Pass Ledger Table */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div>
                                <h3 style={{ margin: 0 }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_46")}</h3>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-2)', margin: '0.25rem 0 0' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_47")}</p>
                            </div>
                        </div>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>{readData("components.Clerio.AttendanceView", "AttendanceView_text_48")}</th>
                                        <th>{readData("components.Clerio.AttendanceView", "AttendanceView_text_49")}</th>
                                        <th>{readData("components.Clerio.AttendanceView", "AttendanceView_text_50")}</th>
                                        <th>{readData("components.Clerio.AttendanceView", "AttendanceView_text_51")}</th>
                                        <th>{readData("components.Clerio.AttendanceView", "AttendanceView_text_52")}</th>
                                        <th>{readData("components.Clerio.AttendanceView", "AttendanceView_text_53")}</th>
                                        <th>{readData("components.Clerio.AttendanceView", "AttendanceView_text_54")}</th>
                                        <th>{readData("components.Clerio.AttendanceView", "AttendanceView_text_55")}</th>
                                        <th>{readData("components.Clerio.AttendanceView", "AttendanceView_text_56")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {gatePasses.map(gp => (
                                        <tr key={gp.id}>
                                            <td><strong>{gp.id}</strong></td>
                                            <td>{gp.employee_name}</td>
                                            <td>{gp.date}</td>
                                            <td>
                                                <span className={`${styles.badge} ${gp.type === 'OFFICIAL' ? styles.badgeBlue : styles.badgeAmber}`}>
                                                    {gp.type}
                                                </span>
                                            </td>
                                            <td><strong>{gp.minutes}{readData("components.Clerio.AttendanceView", "AttendanceView_text_57")}</strong></td>
                                            <td style={{ maxWidth: 200, fontSize: '0.78rem' }}>{gp.reason}</td>
                                            <td style={{ fontSize: '0.78rem' }}>{gp.approved_by || readData("components.Clerio.AttendanceView", "fallback_3")}</td>
                                            <td>
                                                <span className={`${styles.badge} ${gp.status === 'APPROVED' ? styles.badgeTeal : styles.badgeAmber}`}>
                                                    {gp.status}
                                                </span>
                                            </td>
                                            <td style={{ color: 'var(--status-ok)', fontWeight: 600 }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_58")}{gp.minutes}{readData("components.Clerio.AttendanceView", "AttendanceView_text_59")}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: Time-Office Recompute Ledger (Demo Cases) */}
            {activeTab === 'time_office_ledger' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div>
                                <h3 style={{ margin: 0 }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_60")}</h3>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-2)', margin: '0.25rem 0 0' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_61")}</p>
                            </div>
                        </div>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>{readData("components.Clerio.AttendanceView", "AttendanceView_text_62")}</th>
                                        <th>{readData("components.Clerio.AttendanceView", "AttendanceView_text_63")}</th>
                                        <th>{readData("components.Clerio.AttendanceView", "AttendanceView_text_64")}</th>
                                        <th>{readData("components.Clerio.AttendanceView", "AttendanceView_text_65")}</th>
                                        <th>{readData("components.Clerio.AttendanceView", "AttendanceView_text_66")}</th>
                                        <th>{readData("components.Clerio.AttendanceView", "AttendanceView_text_67")}</th>
                                        <th>{readData("components.Clerio.AttendanceView", "AttendanceView_text_68")}</th>
                                        <th>{readData("components.Clerio.AttendanceView", "AttendanceView_text_69")}</th>
                                        <th>{readData("components.Clerio.AttendanceView", "AttendanceView_text_70")}</th>
                                        <th>{readData("components.Clerio.AttendanceView", "AttendanceView_text_71")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {timeOfficeLedger.map(rec => (
                                        <tr key={rec.id}>
                                            <td>
                                                <strong>{rec.employee_name}</strong>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-2)' }}>{rec.designation}</div>
                                            </td>
                                            <td>
                                                <span className={`${styles.badge} ${rec.worker_category_code === 'CONTRACT' ? styles.badgeAmber : rec.worker_category_code.startsWith('THIRD_PARTY') ? styles.badgePurple : styles.badgeBlue}`}>
                                                    {rec.worker_category_code}
                                                </span>
                                            </td>
                                            <td>{rec.attendance_date}</td>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{rec.shift_id_inferred}</div>
                                                {rec.shift_inferred && (
                                                    <span className={`${styles.badge} ${styles.badgeTeal}`} style={{ fontSize: '0.65rem' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_72")}</span>
                                                )}
                                            </td>
                                            <td>
                                                <strong>{Math.floor(rec.gross_minutes / 60)}{readData("components.Clerio.AttendanceView", "AttendanceView_text_73")}{rec.gross_minutes % 60}{readData("components.Clerio.AttendanceView", "AttendanceView_text_74")}</strong>
                                            </td>
                                            <td>
                                                {rec.break_minutes > 0 && (
                                                    <div style={{ color: 'var(--flag)', fontSize: '0.75rem' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_75")}{rec.break_minutes}{readData("components.Clerio.AttendanceView", "AttendanceView_text_76")}</div>
                                                )}
                                                {rec.gate_pass_minutes > 0 && (
                                                    <div style={{ color: 'var(--status-ok)', fontSize: '0.75rem' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_77")}{rec.gate_pass_minutes}{readData("components.Clerio.AttendanceView", "AttendanceView_text_78")}</div>
                                                )}
                                                {rec.break_minutes === 0 && rec.gate_pass_minutes === 0 && readData("components.Clerio.AttendanceView", "fallback_4")}
                                            </td>
                                            <td>
                                                <strong style={{ color: 'var(--signal)' }}>{rec.formatted_net || `${rec.net_minutes}m`}</strong>
                                            </td>
                                            <td>
                                                {rec.ot_minutes > 0 ? (
                                                    <strong style={{ color: 'var(--status-ok)' }}>{rec.formatted_ot || `${rec.ot_minutes}m`}</strong>
                                                ) : (
                                                    <span style={{ color: 'var(--text-3)' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_79")}</span>
                                                )}
                                            </td>
                                            <td>
                                                <span className={`${styles.badge} ${rec.status === 'present' ? styles.badgeTeal : styles.badgeCoral}`}>
                                                    {rec.status.toUpperCase()}
                                                </span>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-2)', marginTop: '0.2rem', maxWidth: 220 }}>
                                                    {rec.status_reason}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`${styles.badge} ${styles.badgeBlue}`} style={{ fontSize: '0.7rem' }}>
                                                    {rec.demo_point}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Inspector for Demo Point 1: Ramesh Kumar's Cross-Midnight Shift */}
                    <div className={styles.card} style={{ borderLeft: '4px solid var(--signal)' }}>
                        <div className={styles.cardHeader}>
                            <div>
                                <h4 style={{ margin: 0, color: 'var(--signal)' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_80")}</h4>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-2)', margin: '0.25rem 0 0' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_81")}<strong>{readData("components.Clerio.AttendanceView", "AttendanceView_text_82")}</strong>{readData("components.Clerio.AttendanceView", "AttendanceView_text_83")}</p>
                            </div>
                            <button
                                className={styles.btnSecondary}
                                onClick={() => showToast(translateText("components.Clerio.AttendanceView","text_c905026590"),translateText("components.Clerio.AttendanceView","text_de6042fe12"), 'success')}
                            >
                                <RefreshCw size={14} />{readData("components.Clerio.AttendanceView", "AttendanceView_text_84")}</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
                            <div style={{ background: 'var(--card-2)', padding: '0.85rem', borderRadius: '6px' }}>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-2)' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_85")}</span>
                                <div style={{ fontWeight: 600, marginTop: '0.2rem' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_86")}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--status-ok)' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_87")}</div>
                            </div>
                            <div style={{ background: 'var(--flag-wash)', border: '1px dashed var(--flag)', padding: '0.85rem', borderRadius: '6px' }}>
                                <span style={{ fontSize: '0.72rem', color: 'var(--flag)' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_88")}</span>
                                <div style={{ fontWeight: 600, color: 'var(--flag)', marginTop: '0.2rem' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_89")}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--flag)' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_90")}</div>
                            </div>
                            <div style={{ background: 'var(--card-2)', padding: '0.85rem', borderRadius: '6px' }}>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-2)' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_91")}</span>
                                <div style={{ fontWeight: 600, marginTop: '0.2rem' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_92")}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--status-ok)' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_93")}</div>
                            </div>
                            <div style={{ background: 'var(--signal-wash)', border: '1px solid var(--signal)', padding: '0.85rem', borderRadius: '6px' }}>
                                <span style={{ fontSize: '0.72rem', color: 'var(--signal)' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_94")}</span>
                                <div style={{ fontWeight: 700, color: 'var(--signal)', marginTop: '0.2rem' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_95")}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--signal)' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_96")}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: Worker Categories & Plant Calendars (Demo Points 2, 3, 4) */}
            {activeTab === 'worker_categories' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Plant Calendar Selector */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card)', padding: '1rem', borderRadius: 'var(--r-card)', border: '1px solid var(--line)' }}>
                        <div>
                            <strong>{readData("components.Clerio.AttendanceView", "AttendanceView_text_97")}</strong>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginLeft: '0.5rem' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_98")}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {Object.values(workCalendars).map(cal => (
                                <button
                                    key={cal.location_id}
                                    onClick={() => setSelectedPlant(cal.location_id)}
                                    className={`${styles.tabBtn} ${selectedPlant === cal.location_id ? styles.tabBtnActive : ''}`}
                                    style={{ border: '1px solid var(--line)' }}
                                >
                                    <MapPin size={13} /> {cal.location_name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 4 Worker Categories Grid */}
                    <div className={styles.categoryGrid}>
                        {Object.values(workerCategories).map(cat => (
                            <div key={cat.code} className={styles.categoryCard}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span className={`${styles.badge} ${cat.code === 'CONTRACT' ? styles.badgeAmber : cat.code.startsWith('THIRD_PARTY') ? styles.badgePurple : styles.badgeBlue}`}>
                                        {cat.code}
                                    </span>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-2)' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_99")}{cat.wage_type.toUpperCase()}
                                    </span>
                                </div>
                                <strong style={{ fontSize: '1rem', color: 'var(--text)' }}>{cat.label}</strong>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-2)', lineHeight: 1.5 }}>
                                    <div>{readData("components.Clerio.AttendanceView", "AttendanceView_text_100")}<strong>{readData("components.Clerio.AttendanceView", "AttendanceView_text_101")}</strong> {cat.has_rest_days ? readData("components.Clerio.AttendanceView", "display_11") : readData("components.Clerio.AttendanceView", "display_12")}</div>
                                    <div>{readData("components.Clerio.AttendanceView", "AttendanceView_text_102")}<strong>{readData("components.Clerio.AttendanceView", "AttendanceView_text_103")}</strong> {cat.ot_eligibility === 'all' ? readData("components.Clerio.AttendanceView", "display_13") : cat.ot_eligibility === 'restday_holiday_only' ? readData("components.Clerio.AttendanceView", "display_14") : readData("components.Clerio.AttendanceView", "display_15")}</div>
                                    <div>{readData("components.Clerio.AttendanceView", "AttendanceView_text_104")}<strong>{readData("components.Clerio.AttendanceView", "AttendanceView_text_105")}</strong> {cat.statutory_applicability.join(', ')}</div>
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--signal)', borderTop: '1px solid var(--line-soft)', paddingTop: '0.5rem', marginTop: 'auto' }}>
                                    {cat.code === 'CONTRACT' && readData("components.Clerio.AttendanceView", "fallback_5")}
                                    {cat.code === 'THIRD_PARTY_EMP' && readData("components.Clerio.AttendanceView", "fallback_6")}
                                    {cat.code === 'THIRD_PARTY_HELPER' && readData("components.Clerio.AttendanceView", "fallback_7")}
                                    {cat.code === 'PERM' && readData("components.Clerio.AttendanceView", "fallback_8")}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Selected Plant Holiday Calendar */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h4 style={{ margin: 0 }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_106")}{workCalendars[selectedPlant]?.location_name}{readData("components.Clerio.AttendanceView", "AttendanceView_text_107")}</h4>
                        </div>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>{readData("components.Clerio.AttendanceView", "AttendanceView_text_108")}</th>
                                        <th>{readData("components.Clerio.AttendanceView", "AttendanceView_text_109")}</th>
                                        <th>{readData("components.Clerio.AttendanceView", "AttendanceView_text_110")}</th>
                                        <th>{readData("components.Clerio.AttendanceView", "AttendanceView_text_111")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {workCalendars[selectedPlant]?.holidays_2026.map(h => (
                                        <tr key={h.date}>
                                            <td><strong>{h.date}</strong></td>
                                            <td>{h.name}</td>
                                            <td>
                                                <span className={`${styles.badge} ${h.type === 'national' ? styles.badgeTeal : styles.badgeBlue}`}>
                                                    {h.type.toUpperCase()}
                                                </span>
                                            </td>
                                            <td>{readData("components.Clerio.AttendanceView", "AttendanceView_text_112")}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: Attendance Regularization Requests */}
            {activeTab === 'regularization' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                <UserCheck size={20} color="var(--signal)" />
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Attendance Regularization Register</h3>
                                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-2)' }}>
                                        Two-tier approval workflow (Shift Supervisor → Time Office Admin) with automatic gross/net minutes recalculation upon sign-off.
                                    </p>
                                </div>
                            </div>
                            <button
                                className={styles.btnPrimary}
                                onClick={() => setIsRegModalOpen(true)}
                                style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
                            >
                                <Plus size={15} /> New Request
                            </button>
                        </div>

                        {/* Status Filter Chips */}
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                            {['ALL', 'submitted', 'supervisor_approved', 'approved', 'rejected'].map(st => (
                                <button
                                    key={st}
                                    onClick={() => setRegFilterStatus(st)}
                                    style={{
                                        padding: '0.3rem 0.75rem',
                                        fontSize: '0.78rem',
                                        borderRadius: 'var(--r-pill)',
                                        border: regFilterStatus === st ? '1px solid var(--signal)' : '1px solid var(--line)',
                                        background: regFilterStatus === st ? 'var(--signal-wash)' : 'var(--card-2)',
                                        color: regFilterStatus === st ? 'var(--signal-ink)' : 'var(--text-2)',
                                        cursor: 'pointer',
                                        fontWeight: regFilterStatus === st ? 600 : 500,
                                        textTransform: 'capitalize'
                                    }}
                                >
                                    {st === 'ALL' ? 'All Requests' : st.replace('_', ' ')}
                                </button>
                            ))}
                        </div>

                        {/* Requests Table */}
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Request ID & Date</th>
                                        <th>Employee</th>
                                        <th>Exception Type</th>
                                        <th>Claimed Punches</th>
                                        <th>Justification</th>
                                        <th>Workflow Status</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(attendanceRegularizations || [])
                                        .filter(r => regFilterStatus === 'ALL' || r.status === regFilterStatus)
                                        .map(r => (
                                            <tr key={r.id}>
                                                <td>
                                                    <strong>{r.id}</strong>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-2)', fontFamily: 'var(--f-num, monospace)' }}>{r.date}</div>
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{r.employee_name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{r.employee_id}</div>
                                                </td>
                                                <td>
                                                    <span className={`${styles.badge} ${styles.badgeBlue}`} style={{ textTransform: 'capitalize' }}>
                                                        {r.kind ? r.kind.replace('-', ' ') : 'Exception'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ fontSize: '0.8rem', fontFamily: 'var(--f-num, monospace)' }}>
                                                        In: <strong>{r.claimedIn || '09:00 AM'}</strong>
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', fontFamily: 'var(--f-num, monospace)' }}>
                                                        Out: <strong>{r.claimedOut || '06:00 PM'}</strong>
                                                    </div>
                                                </td>
                                                <td style={{ maxWidth: '220px' }}>
                                                    <span style={{ fontSize: '0.82rem', color: 'var(--text-2)' }}>{r.reason}</span>
                                                </td>
                                                <td>
                                                    {r.status === 'submitted' && (
                                                        <span className={`${styles.badge} ${styles.badgeAmber}`}>
                                                            Pending Supervisor
                                                        </span>
                                                    )}
                                                    {r.status === 'supervisor_approved' && (
                                                        <span className={`${styles.badge} ${styles.badgePurple}`}>
                                                            Pending Time Office
                                                        </span>
                                                    )}
                                                    {r.status === 'approved' && (
                                                        <span className={`${styles.badge} ${styles.badgeTeal}`}>
                                                            Fully Approved
                                                        </span>
                                                    )}
                                                    {r.status === 'rejected' && (
                                                        <span className={`${styles.badge} ${styles.badgeCoral}`}>
                                                            Rejected
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    {r.status === 'submitted' && (
                                                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                                            <button
                                                                className={styles.btnPrimary}
                                                                style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', background: 'var(--signal)' }}
                                                                onClick={() => decideRegularization(r.id, 'supervisor', true)}
                                                                title="Shift Supervisor Tier 1 Approval"
                                                            >
                                                                <CheckCircle2 size={13} /> Supv Approve
                                                            </button>
                                                            <button
                                                                className={styles.btnSecondary}
                                                                style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', color: 'var(--flag)' }}
                                                                onClick={() => decideRegularization(r.id, 'supervisor', false)}
                                                            >
                                                                <XCircle size={13} /> Reject
                                                            </button>
                                                        </div>
                                                    )}
                                                    {r.status === 'supervisor_approved' && (
                                                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                                            <button
                                                                className={styles.btnPrimary}
                                                                style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', background: 'var(--status-ok)' }}
                                                                onClick={() => decideRegularization(r.id, 'time_office', true)}
                                                                title="Time Office Admin Final Recalculation Approval"
                                                            >
                                                                <CheckCircle2 size={13} /> Admin Settle
                                                            </button>
                                                            <button
                                                                className={styles.btnSecondary}
                                                                style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', color: 'var(--flag)' }}
                                                                onClick={() => decideRegularization(r.id, 'time_office', false)}
                                                            >
                                                                <XCircle size={13} /> Reject
                                                            </button>
                                                        </div>
                                                    )}
                                                    {(r.status === 'approved' || r.status === 'rejected') && (
                                                        <span style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>Settled</span>
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

            {/* Gate Pass Request Modal */}
            {isGatePassModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsGatePassModalOpen(false)}>
                    <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <KeyRound size={20} color="var(--signal)" />
                                <h3 style={{ margin: 0 }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_113")}</h3>
                            </div>
                            <button
                                onClick={() => setIsGatePassModalOpen(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)' }}
                            >{readData("components.Clerio.AttendanceView", "AttendanceView_text_114")}</button>
                        </div>

                        <div style={{ background: 'var(--card-2)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.78rem' }}>
                            <div>{readData("components.Clerio.AttendanceView", "AttendanceView_text_115")}<strong>{readData("components.Clerio.AttendanceView", "AttendanceView_text_116")}</strong>{readData("components.Clerio.AttendanceView", "AttendanceView_text_117")}<strong>{usedMinutes}{readData("components.Clerio.AttendanceView", "AttendanceView_text_118")}</strong></div>
                            <div>{readData("components.Clerio.AttendanceView", "AttendanceView_text_119")}<strong>{usedCount}{readData("components.Clerio.AttendanceView", "AttendanceView_text_120")}</strong></div>
                        </div>

                        <form onSubmit={handleCreateGatePass} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label className={styles.formLabel}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_121")}</label>
                                <select
                                    value={gpType}
                                    onChange={e => setGpType(e.target.value)}
                                    style={{ width: '100%', padding: '0.5rem', background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-control)', color: 'var(--text)' }}
                                >
                                    <option value="PERSONAL">{readData("components.Clerio.AttendanceView", "AttendanceView_text_122")}</option>
                                    <option value="OFFICIAL">{readData("components.Clerio.AttendanceView", "AttendanceView_text_123")}</option>
                                </select>
                            </div>

                            <div>
                                <label className={styles.formLabel}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_124")}</label>
                                <select
                                    value={gpDuration}
                                    onChange={e => setGpDuration(Number(e.target.value))}
                                    style={{ width: '100%', padding: '0.5rem', background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-control)', color: 'var(--text)' }}
                                >
                                    <option value={30}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_125")}</option>
                                    <option value={45}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_126")}</option>
                                    <option value={60}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_127")}</option>
                                    <option value={90}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_128")}</option>
                                    <option value={120}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_129")}</option>
                                    <option value={180}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_130")}</option>
                                </select>
                            </div>

                            <div>
                                <label className={styles.formLabel}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_131")}</label>
                                <textarea
                                    className={styles.textarea}
                                    style={{ height: '80px' }}
                                    placeholder={readData("components.Clerio.AttendanceView", "AttendanceView_placeholder_132")}
                                    value={gpReason}
                                    onChange={e => setGpReason(e.target.value)}
                                    required
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <button
                                    type="button"
                                    className={styles.btnSecondary}
                                    onClick={() => setIsGatePassModalOpen(false)}
                                >{readData("components.Clerio.AttendanceView", "AttendanceView_text_133")}</button>
                                <button
                                    type="submit"
                                    className={styles.btnPrimary}
                                >{readData("components.Clerio.AttendanceView", "AttendanceView_text_134")}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Attendance Regularization Request Modal */}
            {isRegModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsRegModalOpen(false)}>
                    <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <UserCheck size={20} color="var(--signal)" />
                                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Request Regularization</h3>
                            </div>
                            <button
                                onClick={() => setIsRegModalOpen(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)' }}
                            >
                                <XCircle size={18} />
                            </button>
                        </div>

                        <div style={{ background: 'var(--card-2)', padding: '0.75rem', borderRadius: 'var(--r-control)', fontSize: '0.78rem', border: '1px solid var(--line)' }}>
                            <div>Employee: <strong>{user?.name || 'Arjun Sharma'}</strong> ({user?.id || 'EMP-101'})</div>
                            <div style={{ marginTop: '0.25rem', color: 'var(--text-2)' }}>Policy: Missing punch requests require two-tier approval before net work hours are credited.</div>
                        </div>

                        <form onSubmit={handleCreateRegularization} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label className={styles.formLabel}>Attendance Exception Date</label>
                                <input
                                    type="date"
                                    value={regDate}
                                    onChange={e => setRegDate(e.target.value)}
                                    max={new Date().toISOString().split('T')[0]}
                                    style={{ width: '100%', padding: '0.5rem', background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-control)', color: 'var(--text)' }}
                                    required
                                />
                            </div>

                            <div>
                                <label className={styles.formLabel}>Exception Category</label>
                                <select
                                    value={regKind}
                                    onChange={e => setRegKind(e.target.value)}
                                    style={{ width: '100%', padding: '0.5rem', background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-control)', color: 'var(--text)' }}
                                >
                                    <option value="missing-punch">Missing Punch (Terminal failure / Forgot to punch)</option>
                                    <option value="official-duty">Official Duty (Client visit / External assignment)</option>
                                    <option value="late-arrival">Late Arrival (Transit delay / Emergency)</option>
                                    <option value="system-failure">System / Network Outage at Turnstile</option>
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div>
                                    <label className={styles.formLabel}>Claimed In-Time</label>
                                    <input
                                        type="text"
                                        placeholder="09:00 AM"
                                        value={regClaimedIn}
                                        onChange={e => setRegClaimedIn(e.target.value)}
                                        style={{ width: '100%', padding: '0.5rem', background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-control)', color: 'var(--text)' }}
                                    />
                                </div>
                                <div>
                                    <label className={styles.formLabel}>Claimed Out-Time</label>
                                    <input
                                        type="text"
                                        placeholder="06:00 PM"
                                        value={regClaimedOut}
                                        onChange={e => setRegClaimedOut(e.target.value)}
                                        style={{ width: '100%', padding: '0.5rem', background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-control)', color: 'var(--text)' }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={styles.formLabel}>Justification Reason <span style={{ color: 'var(--flag)' }}>*</span></label>
                                <textarea
                                    className={styles.textarea}
                                    style={{ height: '70px' }}
                                    placeholder="Explain the circumstance for supervisor and time-office review..."
                                    value={regReason}
                                    onChange={e => setRegReason(e.target.value)}
                                    required
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <button
                                    type="button"
                                    className={styles.btnSecondary}
                                    onClick={() => setIsRegModalOpen(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className={styles.btnPrimary}
                                    style={{ background: 'var(--signal)' }}
                                >
                                    Submit Request
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* AI Anomaly Review Queue Modal */}
            {isAnomalyModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsAnomalyModalOpen(false)}>
                    <div className={styles.modalCard} style={{ maxWidth: '640px', width: '95%' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Sparkles size={20} color="var(--pending)" />
                                <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text)' }}>
                                    AI Shift & Anomaly Intelligence — Review Queue
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsAnomalyModalOpen(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', fontSize: '1.2rem', padding: '0.2rem 0.5rem' }}
                            >✕</button>
                        </div>

                        <div style={{ fontSize: '0.85rem', color: 'var(--text-2)', lineHeight: 1.4 }}>
                            The AI Shift & Anomaly engine flagged the following potential anomalies from biometric logs, IP subnet mismatches, and multi-shift timing heuristics.
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                            {anomaliesList.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: 'var(--card-2)', borderRadius: 'var(--r-control)', color: 'var(--status-ok)' }}>
                                    <CheckCircle2 size={40} style={{ margin: '0 auto 0.5rem', display: 'block' }} />
                                    <strong style={{ fontSize: '1rem' }}>All anomalies resolved</strong>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginTop: '0.35rem' }}>
                                        No pending biometric or schedule anomalies require HR review.
                                    </div>
                                </div>
                            ) : (
                                anomaliesList.map((item) => (
                                    <div key={item.id} style={{ background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-control)', padding: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            <div>
                                                <strong style={{ fontSize: '0.92rem', color: 'var(--text)' }}>{item.employee}</strong>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--pending)', fontWeight: 600, marginTop: '2px' }}>
                                                    {item.type}
                                                </div>
                                            </div>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: '12px', background: 'var(--pending-wash, rgba(245, 158, 11, 0.15))', color: 'var(--pending)' }}>
                                                {item.confidence} Confidence
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-2)', background: 'var(--surface)', padding: '0.5rem 0.65rem', borderRadius: '4px', borderLeft: '3px solid var(--pending)' }}>
                                            {item.note}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                                            <button
                                                type="button"
                                                className={styles.btnSecondary}
                                                style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                                                onClick={() => {
                                                    setAnomaliesList(prev => prev.filter(a => a.id !== item.id));
                                                    showToast('Waived', `Flag for ${item.employee} marked as false positive with audit note.`, 'info');
                                                }}
                                            >
                                                Waive / False Positive
                                            </button>
                                            <button
                                                type="button"
                                                className={styles.btnSecondary}
                                                style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                                                onClick={() => {
                                                    setAnomaliesList(prev => prev.filter(a => a.id !== item.id));
                                                    showToast('Escalated', `Dispatched investigation requisition to Plant Supervisor for ${item.employee}.`, 'info');
                                                }}
                                            >
                                                Escalate to Supervisor
                                            </button>
                                            <button
                                                type="button"
                                                className={styles.btnPrimary}
                                                style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', background: 'var(--signal)' }}
                                                onClick={() => {
                                                    setAnomaliesList(prev => prev.filter(a => a.id !== item.id));
                                                    showToast('Resolved & Recomputed', `Attendance entry for ${item.employee} recomputed and verified.`, 'success');
                                                }}
                                            >
                                                Resolve & Recompute
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--line)', paddingTop: '0.75rem' }}>
                            {anomaliesList.length > 0 ? (
                                <button
                                    type="button"
                                    className={styles.btnSecondary}
                                    style={{ fontSize: '0.8rem' }}
                                    onClick={() => {
                                        setAnomaliesList([]);
                                        showToast('All Resolved', 'Batch recomputed all flagged anomalies across shifts.', 'success');
                                    }}
                                >
                                    Resolve All Flagged ({anomaliesList.length})
                                </button>
                            ) : <div />}
                            <button
                                type="button"
                                className={styles.btnSecondary}
                                style={{ fontSize: '0.8rem' }}
                                onClick={() => setIsAnomalyModalOpen(false)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendanceView;
