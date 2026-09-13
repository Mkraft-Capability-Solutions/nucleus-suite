"use client";
import {useTranslation} from '@/context/I18nContext';

import { readData } from '../../services/workspace-data.mjs';

import React, { useState } from 'react';
import {
    Clock, Calendar as CalIcon, MapPin, ChevronLeft, ChevronRight,
    FileText, CheckCircle, AlertCircle, TrendingUp, Sparkles, Smartphone, ShieldCheck,
    RefreshCw, KeyRound, UserCheck, CheckCircle2, XCircle, Plus, Info, Building2
} from 'lucide-react';
import styles from './AttendanceView.module.css';
import { useHRMS } from '@/context/HRMSContext';

const AttendanceView = ({ onNavigate, onSelectConsole }) => {
    const {t: translateText}=useTranslation();

    const {
        attendance,
        attendanceAnomalies,
        punchIn,
        punchOut,
        gatePasses,
        requestGatePass,
        approveGatePass,
        timeOfficeLedger,
        recomputeAttendanceRecord,
        workerCategories,
        workCalendars,
        rulesetVersion,
        user,
        showToast
    } = useHRMS();

    const [activeTab, setActiveTab] = useState(readData("components.Clerio.AttendanceView", "initialState_1")); // 'monthly_ledger' | 'gate_pass' | 'time_office_ledger' | 'worker_categories'
    const [currentMonth, setCurrentMonth] = useState(readData("components.Clerio.AttendanceView", "initialState_2"));
    const [selectedPlant, setSelectedPlant] = useState(readData("components.Clerio.AttendanceView", "initialState_3"));

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

    const handleCreateGatePass = (e) => {
        e.preventDefault();
        const res = requestGatePass({
            ...readData("components.Clerio.AttendanceView", "res_fields_1"),
            employeeName: user?.name || readData("components.Clerio.AttendanceView", "fallback_1"),
            ...readData("components.Clerio.AttendanceView", "res_fields_2"),
            type: gpType,
            minutes: Number(gpDuration),
            reason: gpReason || `${gpType} gate permission request`
        });
        if (res.success) {
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
                                border: '1px solid rgba(45, 212, 168, 0.4)',
                                background: 'rgba(45, 212, 168, 0.12)',
                                color: '#2DD4A8',
                                fontWeight: 700
                            }}
                            title={readData("components.Clerio.AttendanceView", "AttendanceView_title_6")}
                        >
                            <TrendingUp size={15} />{readData("components.Clerio.AttendanceView", "AttendanceView_text_7")}</button>
                    )}
                    {attendance.status === 'present' ? (
                        <button className={styles.btnPrimary} style={{ background: '#ef4444' }} onClick={punchOut}>
                            <Clock size={16} />{readData("components.Clerio.AttendanceView", "AttendanceView_text_8")}</button>
                    ) : (
                        <button className={styles.btnPrimary} style={{ background: '#16a34a' }} onClick={punchIn}>
                            <Clock size={16} />{readData("components.Clerio.AttendanceView", "AttendanceView_text_9")}</button>
                    )}
                    <button
                        className={styles.btnSecondary}
                        onClick={() => setIsGatePassModalOpen(true)}
                        style={{ border: '1px solid rgba(37, 99, 235, 0.3)', color: '#2563eb' }}
                    >
                        <KeyRound size={15} />{readData("components.Clerio.AttendanceView", "AttendanceView_text_10")}</button>
                    <button className={styles.btnSecondary} onClick={() => showToast(translateText("components.Clerio.AttendanceView","text_bf34462856"),translateText("components.Clerio.AttendanceView","text_0bf6412031"), 'info')}>
                        <FileText size={16} />{readData("components.Clerio.AttendanceView", "AttendanceView_text_11")}</button>
                </div>
            </div>

            {/* Time-Office Engine Version & Rule Status Banner */}
            <div className={styles.engineBanner}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <ShieldCheck size={24} color="#2563eb" />
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
                    <CheckCircle size={14} color="#16a34a" />{readData("components.Clerio.AttendanceView", "AttendanceView_text_16")}</button>
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
                            <span className={styles.statSub} style={{ color: '#2563eb' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_26")}</span>
                        </div>
                        <div className={styles.statCard}>
                            <span className={styles.statLabel}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_27")}</span>
                            <span className={styles.statValue} style={{ fontSize: '1.2rem', color: usedMinutes > 180 ? '#f59e0b' : '#16a34a', marginTop: '0.2rem' }}>
                                {usedMinutes}{readData("components.Clerio.AttendanceView", "AttendanceView_text_28")}</span>
                            <span className={styles.statSub}>{remainingCount}{readData("components.Clerio.AttendanceView", "AttendanceView_text_29")}</span>
                        </div>
                    </div>

                    {/* AI Anomaly Detection Banner */}
                    <div className={styles.anomalyBanner}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Sparkles size={22} color="#d97706" />
                            <div>
                                <strong style={{ color: '#92400e' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_30")}</strong>
                                <div style={{ fontSize: '0.85rem', color: '#78350f' }}>
                                    {attendanceAnomalies.length}{readData("components.Clerio.AttendanceView", "AttendanceView_text_31")}</div>
                            </div>
                        </div>
                        <button className={styles.anomalyBtn} onClick={() => showToast(translateText("components.Clerio.AttendanceView","text_9f40e7d4cc"),translateText("components.Clerio.AttendanceView","text_13f6644330"), 'info')}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_32")}</button>
                    </div>

                    {/* Main Calendar View */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h3><CalIcon size={20} color="#2563eb" />{readData("components.Clerio.AttendanceView", "AttendanceView_text_33")}</h3>
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
                                        background: usedMinutes >= 240 ? '#ef4444' : usedMinutes > 180 ? '#f59e0b' : '#16a34a'
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
                                        background: usedCount >= 2 ? '#ef4444' : '#2563eb'
                                    }}
                                />
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_42")}</span>
                        </div>

                        <div className={styles.quotaCard} style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                            <KeyRound size={28} color="#2563eb" />
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
                                            <td style={{ color: '#16a34a', fontWeight: 600 }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_58")}{gp.minutes}{readData("components.Clerio.AttendanceView", "AttendanceView_text_59")}</td>
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
                                                    <div style={{ color: '#ef4444', fontSize: '0.75rem' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_75")}{rec.break_minutes}{readData("components.Clerio.AttendanceView", "AttendanceView_text_76")}</div>
                                                )}
                                                {rec.gate_pass_minutes > 0 && (
                                                    <div style={{ color: '#16a34a', fontSize: '0.75rem' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_77")}{rec.gate_pass_minutes}{readData("components.Clerio.AttendanceView", "AttendanceView_text_78")}</div>
                                                )}
                                                {rec.break_minutes === 0 && rec.gate_pass_minutes === 0 && readData("components.Clerio.AttendanceView", "fallback_4")}
                                            </td>
                                            <td>
                                                <strong style={{ color: '#2563eb' }}>{rec.formatted_net || `${rec.net_minutes}m`}</strong>
                                            </td>
                                            <td>
                                                {rec.ot_minutes > 0 ? (
                                                    <strong style={{ color: '#16a34a' }}>{rec.formatted_ot || `${rec.ot_minutes}m`}</strong>
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
                    <div className={styles.card} style={{ borderLeft: '4px solid #2563eb' }}>
                        <div className={styles.cardHeader}>
                            <div>
                                <h4 style={{ margin: 0, color: '#2563eb' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_80")}</h4>
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
                                <div style={{ fontSize: '0.75rem', color: '#16a34a' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_87")}</div>
                            </div>
                            <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px dashed #ef4444', padding: '0.85rem', borderRadius: '6px' }}>
                                <span style={{ fontSize: '0.72rem', color: '#b91c1c' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_88")}</span>
                                <div style={{ fontWeight: 600, color: '#b91c1c', marginTop: '0.2rem' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_89")}</div>
                                <div style={{ fontSize: '0.75rem', color: '#b91c1c' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_90")}</div>
                            </div>
                            <div style={{ background: 'var(--card-2)', padding: '0.85rem', borderRadius: '6px' }}>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-2)' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_91")}</span>
                                <div style={{ fontWeight: 600, marginTop: '0.2rem' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_92")}</div>
                                <div style={{ fontSize: '0.75rem', color: '#16a34a' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_93")}</div>
                            </div>
                            <div style={{ background: 'rgba(37, 99, 235, 0.08)', border: '1px solid #2563eb', padding: '0.85rem', borderRadius: '6px' }}>
                                <span style={{ fontSize: '0.72rem', color: '#2563eb' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_94")}</span>
                                <div style={{ fontWeight: 700, color: '#2563eb', marginTop: '0.2rem' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_95")}</div>
                                <div style={{ fontSize: '0.75rem', color: '#2563eb' }}>{readData("components.Clerio.AttendanceView", "AttendanceView_text_96")}</div>
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
                                <div style={{ fontSize: '0.72rem', color: '#2563eb', borderTop: '1px solid var(--line-soft)', paddingTop: '0.5rem', marginTop: 'auto' }}>
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

            {/* Gate Pass Request Modal */}
            {isGatePassModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsGatePassModalOpen(false)}>
                    <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <KeyRound size={20} color="#2563eb" />
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
        </div>
    );
};

export default AttendanceView;
