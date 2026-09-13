"use client";
import {useTranslation} from '@/context/I18nContext';

import NextImage from 'next/image';

import { readData } from '../../../services/workspace-data.mjs';

import React, { useState } from 'react';
import {
    Clock, Calendar, DollarSign, Award, BookOpen, Search,
    ArrowRight, Check, Sparkles, LogOut, Plus, CheckCircle2,
    FileText, PlusCircle, Send, Briefcase, Layers, X, UserCheck,
    Users, Target, HelpCircle, ShieldCheck
} from 'lucide-react';
import NucleusChart from '@/components/Charts/NucleusChart';
import { NUCLEUS_COLORS } from '@/components/Charts/theme';
import shared from '../DashboardShared.module.css';
import { useHRMS } from '@/context/HRMSContext';

export default function EmployeeHome({ onNavigate }) {
    const {t: translateText}=useTranslation();

    const { showToast } = useHRMS();
    const [isClockedIn, setIsClockedIn] = useState(true);
    const [query, setQuery] = useState('');
    const [showPolicyAnswer, setShowPolicyAnswer] = useState(true);

    // Weekly Timesheet State
    const [timesheetStatus, setTimesheetStatus] = useState(readData("components.Dashboard.Views.EmployeeHome", "initialState_1")); // 'draft' | 'submitted'
    const [dailyEntries, setDailyEntries] = useState(readData("components.Dashboard.Views.EmployeeHome", "dailyEntries_1"));
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [newLogProject, setNewLogProject] = useState(readData("components.Dashboard.Views.EmployeeHome", "initialState_2"));
    const [newLogTask, setNewLogTask] = useState('');
    const [newLogHours, setNewLogHours] = useState(readData("components.Dashboard.Views.EmployeeHome", "initialState_3"));
    const [newLogBillable, setNewLogBillable] = useState(true);

    const totalHours = dailyEntries.reduce((acc, curr) => acc + curr.hours, 0);
    const billableHours = dailyEntries.filter(e => e.billable).reduce((acc, curr) => acc + curr.hours, 0);
    const billablePercent = totalHours > 0 ? Math.round((billableHours / totalHours) * 100) : 0;

    const handleSubmitTimesheet = () => {
        setTimesheetStatus('submitted');
        showToast?.(translateText("components.Dashboard.Views.EmployeeHome","text_fd2ecb1c57"),translateText("components.Dashboard.Views.EmployeeHome","text_051f8272b5", {value1: String(totalHours.toFixed(1))}), 'success');
    };

    const handleAddLog = (e) => {
        e.preventDefault();
        if (!newLogTask.trim()) {
            showToast?.(translateText("components.Dashboard.Views.EmployeeHome","text_432bef80e7"),translateText("components.Dashboard.Views.EmployeeHome","text_9e12fe321d"), 'warning');
            return;
        }
        const hoursNum = parseFloat(newLogHours) || readData("components.Dashboard.Views.EmployeeHome", "fallback_1");
        const newEntry = {
            id: Date.now(),
            ...readData("components.Dashboard.Views.EmployeeHome", "newEntry_fields_2"),
            project: newLogProject,
            task: newLogTask.trim(),
            hours: hoursNum,
            billable: newLogBillable,
            ...readData("components.Dashboard.Views.EmployeeHome", "newEntry_fields_3")
        };
        setDailyEntries(prev => [...prev, newEntry]);
        setNewLogTask('');
        setIsLogModalOpen(false);
        showToast?.(translateText("components.Dashboard.Views.EmployeeHome","text_6ff44d14c8"),translateText("components.Dashboard.Views.EmployeeHome","text_fc41832be5", {value1: String(hoursNum), value2: String(newLogProject)}), 'success');
    };

    // 1. Concentric Rings Leave Balance (W08)
    const leaveRingsOption = {
        ...readData("components.Dashboard.Views.EmployeeHome", "leaveRingsOption_fields_4"),
        legend: {
            ...readData("components.Dashboard.Views.EmployeeHome", "legend_fields_6"),
            textStyle: { color: NUCLEUS_COLORS.textMuted, ...readData("components.Dashboard.Views.EmployeeHome", "textStyle_fields_8") }
        },
        series: [
            {
                ...readData("components.Dashboard.Views.EmployeeHome", "series_fields_9"),
                data: [
                    { ...readData("components.Dashboard.Views.EmployeeHome", "data_fields_13"), itemStyle: { color: NUCLEUS_COLORS.teal } },
                    readData("components.Dashboard.Views.EmployeeHome", "data_14")
                ]
            },
            {
                ...readData("components.Dashboard.Views.EmployeeHome", "series_fields_15"),
                data: [
                    { ...readData("components.Dashboard.Views.EmployeeHome", "data_fields_19"), itemStyle: { color: NUCLEUS_COLORS.sky } },
                    readData("components.Dashboard.Views.EmployeeHome", "data_20")
                ]
            },
            {
                ...readData("components.Dashboard.Views.EmployeeHome", "series_fields_21"),
                label: {
                    ...readData("components.Dashboard.Views.EmployeeHome", "label_fields_24"),
                    color: NUCLEUS_COLORS.textPrimary
                },
                data: [
                    { ...readData("components.Dashboard.Views.EmployeeHome", "data_fields_25"), itemStyle: { color: NUCLEUS_COLORS.amber } },
                    readData("components.Dashboard.Views.EmployeeHome", "data_26")
                ]
            }
        ]
    };

    // 2. Personal Attendance Heatmap (8 Weeks)
    const weeks = Array.from(readData("components.Dashboard.Views.EmployeeHome", "weeks_27"), (_, i) => `Wk ${i + 1}`);
    const days = readData("components.Dashboard.Views.EmployeeHome", "days_28");
    const personalHeatData = readData("components.Dashboard.Views.EmployeeHome", "personalHeatData_29");

    const personalAttendanceOption = {
        tooltip: {
            ...readData("components.Dashboard.Views.EmployeeHome", "tooltip_fields_32"),
            formatter: (p) => `${weeks[p.value[0]]} ${days[p.value[1]]}: <strong>${p.value[2]}h</strong> logged`
        },
        ...readData("components.Dashboard.Views.EmployeeHome", "personalAttendanceOption_fields_30"),
        xAxis: {
            ...readData("components.Dashboard.Views.EmployeeHome", "xAxis_fields_34"),
            data: weeks,
            axisLabel: { color: NUCLEUS_COLORS.textMuted, ...readData("components.Dashboard.Views.EmployeeHome", "axisLabel_fields_35") }
        },
        yAxis: {
            ...readData("components.Dashboard.Views.EmployeeHome", "yAxis_fields_36"),
            data: days,
            axisLabel: { color: NUCLEUS_COLORS.textPrimary, ...readData("components.Dashboard.Views.EmployeeHome", "axisLabel_fields_37") }
        },
        ...readData("components.Dashboard.Views.EmployeeHome", "personalAttendanceOption_fields_31"),
        series: [{
            ...readData("components.Dashboard.Views.EmployeeHome", "series_fields_39"),
            data: personalHeatData,
            ...readData("components.Dashboard.Views.EmployeeHome", "series_fields_40")
        }]
    };

    return (
        <div className={shared.dashboardCanvas}>
            {/* Employee Self-Service Quick Navigation Hub */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                flexWrap: 'wrap',
                padding: '0.85rem 1.15rem',
                background: 'var(--card)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                marginBottom: '1rem',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)'
            }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#05CD99', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <ShieldCheck size={14} />{readData("components.Dashboard.Views.EmployeeHome", "content_text_42")}</span>

                <button
                    onClick={() => onNavigate && onNavigate('leaves')}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.38rem 0.75rem',
                        borderRadius: '8px',
                        background: 'rgba(45, 212, 168, 0.12)',
                        border: '1px solid rgba(45, 212, 168, 0.35)',
                        color: '#05CD99',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                    }}
                >
                    <Calendar size={13} />{readData("components.Dashboard.Views.EmployeeHome", "content_text_43")}</button>

                <button
                    onClick={() => onNavigate && onNavigate('projects')}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.38rem 0.75rem',
                        borderRadius: '8px',
                        background: 'rgba(79, 182, 245, 0.12)',
                        border: '1px solid rgba(79, 182, 245, 0.35)',
                        color: '#4FB6F5',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                    }}
                >
                    <Briefcase size={13} />{readData("components.Dashboard.Views.EmployeeHome", "content_text_44")}</button>

                <button
                    onClick={() => onNavigate && onNavigate('team')}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.38rem 0.75rem',
                        borderRadius: '8px',
                        background: 'rgba(155, 140, 255, 0.12)',
                        border: '1px solid rgba(155, 140, 255, 0.35)',
                        color: 'var(--agent)',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                    }}
                >
                    <Users size={13} />{readData("components.Dashboard.Views.EmployeeHome", "content_text_45")}</button>

                <button
                    onClick={() => onNavigate && onNavigate('payroll')}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.38rem 0.75rem',
                        borderRadius: '8px',
                        background: 'rgba(242, 169, 59, 0.12)',
                        border: '1px solid rgba(242, 169, 59, 0.35)',
                        color: 'var(--pending)',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                    }}
                >
                    <DollarSign size={13} />{readData("components.Dashboard.Views.EmployeeHome", "content_text_46")}</button>

                <button
                    onClick={() => onNavigate && onNavigate('attendance')}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.38rem 0.75rem',
                        borderRadius: '8px',
                        background: 'var(--card-2)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: 'var(--text)',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                    }}
                >
                    <Clock size={13} />{readData("components.Dashboard.Views.EmployeeHome", "content_text_47")}</button>

                <button
                    onClick={() => onNavigate && onNavigate('performance')}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.38rem 0.75rem',
                        borderRadius: '8px',
                        background: 'var(--card-2)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: 'var(--text)',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                    }}
                >
                    <Target size={13} />{readData("components.Dashboard.Views.EmployeeHome", "content_text_48")}</button>

                <button
                    onClick={() => onNavigate && onNavigate('helpdesk')}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.38rem 0.75rem',
                        borderRadius: '8px',
                        background: 'var(--card-2)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: 'var(--text)',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                    }}
                >
                    <HelpCircle size={13} />{readData("components.Dashboard.Views.EmployeeHome", "content_text_49")}</button>
            </div>

            {/* 3 Primary Daily Cards */}
            <div className={shared.grid12}>
                {/* 1. Today's Punch & Clock-in (col-4) */}
                <div className={`${shared.widgetCard} ${shared.col4}`}>
                    <div className={shared.cardTitleRow}>
                        <div className={shared.cardTitleLeft}>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_50")}</h3>
                            <span className={shared.cardSublabel}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_51")}</span>
                        </div>
                    </div>
                    <div className={shared.cardBody} style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                        <div style={{
                            width: 130,
                            height: 130,
                            borderRadius: '50%',
                            border: '7px solid #05CD99',
                            borderRightColor: '#1C3450',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0.75rem 0'
                        }}>
                            <span style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text)' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_52")}</span>
                            <span style={{ fontSize: '0.7rem', color: '#05CD99', fontWeight: 600 }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_53")}</span>
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-2)', marginTop: '0.25rem' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_54")}<strong>{readData("components.Dashboard.Views.EmployeeHome", "content_text_55")}</strong>{readData("components.Dashboard.Views.EmployeeHome", "content_text_56")}<strong>{readData("components.Dashboard.Views.EmployeeHome", "content_text_57")}</strong>{readData("components.Dashboard.Views.EmployeeHome", "content_text_58")}<strong>{readData("components.Dashboard.Views.EmployeeHome", "content_text_59")}</strong>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: '0.15rem' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_60")}<strong>{readData("components.Dashboard.Views.EmployeeHome", "content_text_61")}</strong>{readData("components.Dashboard.Views.EmployeeHome", "content_text_62")}</div>
                    </div>
                </div>

                {/* 2. Concentric Rings Leave Balance (col-4) */}
                <div className={`${shared.widgetCard} ${shared.col4}`}>
                    <div className={shared.cardTitleRow}>
                        <div className={shared.cardTitleLeft}>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_63")}</h3>
                            <span className={shared.cardSublabel}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_64")}</span>
                        </div>
                        <button
                            onClick={() => onNavigate && onNavigate('leaves')}
                            style={{
                                background: 'rgba(45, 212, 168, 0.12)',
                                border: '1px solid rgba(45, 212, 168, 0.35)',
                                color: '#05CD99',
                                borderRadius: '6px',
                                padding: '0.22rem 0.55rem',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                            }}
                            title={readData("components.Dashboard.Views.EmployeeHome", "content_title_65")}
                        >{readData("components.Dashboard.Views.EmployeeHome", "content_text_66")}</button>
                    </div>
                    <div className={shared.cardBody}>
                        <NucleusChart option={leaveRingsOption} style={{ height: 210 }} />
                    </div>
                </div>

                {/* 3. September Payslip Summary (col-4) */}
                <div className={`${shared.widgetCard} ${shared.col4}`}>
                    <div className={shared.cardTitleRow}>
                        <div className={shared.cardTitleLeft}>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_67")}</h3>
                            <span className={shared.cardSublabel}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_68")}</span>
                        </div>
                        <button
                            onClick={() => onNavigate && onNavigate('payroll')}
                            style={{
                                background: 'rgba(79, 182, 245, 0.12)',
                                border: '1px solid rgba(79, 182, 245, 0.35)',
                                color: '#4FB6F5',
                                borderRadius: '6px',
                                padding: '0.22rem 0.55rem',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                            }}
                            title={readData("components.Dashboard.Views.EmployeeHome", "content_title_69")}
                        >{readData("components.Dashboard.Views.EmployeeHome", "content_text_70")}</button>
                    </div>
                    <div className={shared.cardBody} style={{ gap: '0.65rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                            <span style={{ color: 'var(--text-2)' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_71")}</span>
                            <strong>{readData("components.Dashboard.Views.EmployeeHome", "content_text_72")}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                            <span style={{ color: 'var(--text-2)' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_73")}</span>
                            <strong style={{ color: '#F2647E' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_74")}</strong>
                        </div>
                        <div style={{ height: 1, background: '#1C3450', margin: '0.25rem 0' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 800 }}>
                            <span style={{ color: 'var(--text)' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_75")}</span>
                            <strong style={{ color: '#05CD99' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_76")}</strong>
                        </div>
                        <div style={{
                            marginTop: '0.5rem',
                            padding: '0.55rem 0.75rem',
                            background: 'var(--card-2)',
                            borderRadius: '6px',
                            border: '1px solid #1C3450',
                            fontSize: '0.72rem',
                            color: 'var(--text-2)'
                        }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_77")}<strong>{readData("components.Dashboard.Views.EmployeeHome", "content_text_78")}</strong>{readData("components.Dashboard.Views.EmployeeHome", "content_text_79")}<strong>{readData("components.Dashboard.Views.EmployeeHome", "content_text_80")}</strong>{readData("components.Dashboard.Views.EmployeeHome", "content_text_81")}</div>
                    </div>
                </div>
            </div>

            {/* Ask Nucleus Policy Bar & Answer (P7 Grounded Policy Answer) */}
            <div className={shared.aiNarrativeCard}>
                <div className={shared.narrativeHeader}>
                    <span className={shared.narrativeBadge}>
                        <Sparkles size={14} />{readData("components.Dashboard.Views.EmployeeHome", "content_text_82")}</span>
                    <span className={shared.narrativeTime}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_83")}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', margin: '0.25rem 0' }}>
                    <input
                        type="text"
                        placeholder={readData("components.Dashboard.Views.EmployeeHome", "content_placeholder_84")}
                        value={query || readData("components.Dashboard.Views.EmployeeHome", "fallback_2")}
                        onChange={(e) => setQuery(e.target.value)}
                        style={{
                            flex: 1,
                            padding: '0.5rem 0.85rem',
                            background: 'var(--card-2)',
                            border: '1px solid #1C3450',
                            borderRadius: '6px',
                            color: 'var(--text)',
                            fontSize: '0.82rem'
                        }}
                    />
                    <button className={shared.scopeBtnPrimary} style={{ padding: '0.5rem 1rem', borderRadius: 6, cursor: 'pointer', border: 'none', fontWeight: 700 }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_85")}</button>
                </div>

                {showPolicyAnswer && (
                    <div style={{ marginTop: '0.4rem' }}>
                        <p className={shared.narrativeBody} style={{ margin: 0 }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_86")}<strong>{readData("components.Dashboard.Views.EmployeeHome", "content_text_87")}</strong>{readData("components.Dashboard.Views.EmployeeHome", "content_text_88")}<strong>{readData("components.Dashboard.Views.EmployeeHome", "content_text_89")}</strong>{readData("components.Dashboard.Views.EmployeeHome", "content_text_90")}<strong>{readData("components.Dashboard.Views.EmployeeHome", "content_text_91")}</strong>{readData("components.Dashboard.Views.EmployeeHome", "content_text_92")}</p>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-2)', marginTop: '0.4rem' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_93")}<em>{readData("components.Dashboard.Views.EmployeeHome", "content_text_94")}</em>
                        </div>
                        <div className={shared.narrativeFooter}>
                            <button
                                className={shared.narrativeBtn}
                                onClick={() => onNavigate && onNavigate('leaves')}
                            >{readData("components.Dashboard.Views.EmployeeHome", "content_text_95")}</button>
                            <button
                                className={shared.narrativeBtn}
                                onClick={() => onNavigate && onNavigate('helpdesk')}
                            >{readData("components.Dashboard.Views.EmployeeHome", "content_text_96")}</button>
                        </div>
                    </div>
                )}
            </div>

            {/* 2. Timesheet & Project Hours Suite */}
            <div className={shared.grid12}>
                {/* 1. Weekly Timesheet & Project Logging (col-8) */}
                <div className={`${shared.widgetCard} ${shared.col8}`}>
                    <div className={shared.cardTitleRow}>
                        <div className={shared.cardTitleLeft}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                <Clock size={16} color="#05CD99" />
                                <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_97")}</h3>
                            </div>
                            <span className={shared.cardSublabel}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_98")}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <button
                                onClick={() => onNavigate && onNavigate('projects')}
                                style={{
                                    background: 'rgba(79, 182, 245, 0.12)',
                                    border: '1px solid rgba(79, 182, 245, 0.35)',
                                    color: '#4FB6F5',
                                    borderRadius: '6px',
                                    padding: '0.22rem 0.55rem',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                                title={readData("components.Dashboard.Views.EmployeeHome", "content_title_99")}
                            >{readData("components.Dashboard.Views.EmployeeHome", "content_text_100")}</button>
                            {timesheetStatus === 'submitted' ? (
                                <span className={`${shared.pillBadge} ${shared.pillTeal}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <CheckCircle2 size={12} />{readData("components.Dashboard.Views.EmployeeHome", "content_text_101")}</span>
                            ) : (
                                <span className={`${shared.pillBadge} ${shared.pillAmber}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <Clock size={12} />{readData("components.Dashboard.Views.EmployeeHome", "content_text_102")}{Math.max(0, 40 - totalHours).toFixed(1)}{readData("components.Dashboard.Views.EmployeeHome", "content_text_103")}</span>
                            )}
                        </div>
                    </div>

                    <div className={shared.cardBody} style={{ gap: '0.95rem' }}>
                        {/* Daily Hours Strip */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(5, 1fr)',
                            gap: '0.5rem',
                            background: 'var(--card-2)',
                            padding: '0.65rem',
                            borderRadius: '10px',
                            border: '1px solid rgba(255, 255, 255, 0.06)'
                        }}>
                            {[
                                readData("components.Dashboard.Views.EmployeeHome", "content_104"),
                                readData("components.Dashboard.Views.EmployeeHome", "content_105"),
                                readData("components.Dashboard.Views.EmployeeHome", "content_106"),
                                readData("components.Dashboard.Views.EmployeeHome", "content_107"),
                                { ...readData("components.Dashboard.Views.EmployeeHome", "content_fields_108"), hours: dailyEntries.filter(e => e.day === 'Fri').reduce((a, c) => a + c.hours, 0), ...readData("components.Dashboard.Views.EmployeeHome", "content_fields_109") },
                            ].map(d => (
                                <div
                                    key={d.day}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '0.2rem',
                                        padding: '0.45rem 0.25rem',
                                        borderRadius: '7px',
                                        background: d.status === 'active' ? 'rgba(45, 212, 168, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                                        border: d.status === 'active' ? '1px solid rgba(45, 212, 168, 0.35)' : '1px solid rgba(255, 255, 255, 0.05)',
                                        textAlign: 'center'
                                    }}
                                >
                                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: d.status === 'active' ? '#05CD99' : '#94A3B8' }}>{d.day.toUpperCase()}</span>
                                    <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)' }}>{d.hours.toFixed(1)}{readData("components.Dashboard.Views.EmployeeHome", "content_text_110")}</span>
                                    <span style={{ fontSize: '0.62rem', color: d.status === 'active' ? '#05CD99' : '#4FB6F5', fontWeight: 600 }}>
                                        {d.status === 'active' ? readData("components.Dashboard.Views.EmployeeHome", "display_4") : readData("components.Dashboard.Views.EmployeeHome", "display_5")}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Timesheet Task Entries Table */}
                        <div style={{ overflowX: 'auto' }}>
                            <table className={shared.dataTable}>
                                <thead>
                                    <tr>
                                        <th style={{ width: '15%' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_111")}</th>
                                        <th style={{ width: '45%' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_112")}</th>
                                        <th style={{ width: '15%' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_113")}</th>
                                        <th style={{ width: '12%', textAlign: 'right' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_114")}</th>
                                        <th style={{ width: '13%', textAlign: 'right' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_115")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dailyEntries.map(e => (
                                        <tr key={e.id}>
                                            <td style={{ fontSize: '0.74rem', color: 'var(--text-2)' }}>
                                                <strong>{e.day}</strong>{readData("components.Dashboard.Views.EmployeeHome", "content_text_116")}{e.date}
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.8rem' }}>{e.project}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-2)' }}>{e.task}</div>
                                            </td>
                                            <td>
                                                <span className={`${shared.pillBadge} ${e.billable ? shared.pillTeal : shared.pillSlate}`} style={{ fontSize: '0.65rem' }}>
                                                    {e.billable ? readData("components.Dashboard.Views.EmployeeHome", "display_6") : readData("components.Dashboard.Views.EmployeeHome", "display_7")}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text)' }}>
                                                {e.hours.toFixed(1)}{readData("components.Dashboard.Views.EmployeeHome", "content_text_117")}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                <span className={`${shared.pillBadge} ${e.status === 'Approved' ? shared.pillTeal : shared.pillSky}`} style={{ fontSize: '0.65rem' }}>
                                                    {e.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Bottom Summary Bar & Action Buttons */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '0.75rem',
                            paddingTop: '0.65rem',
                            borderTop: '1px solid rgba(255, 255, 255, 0.08)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                <div>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-2)' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_118")}</span>
                                    <strong style={{ fontSize: '0.9rem', color: '#05CD99' }}>{totalHours.toFixed(1)}{readData("components.Dashboard.Views.EmployeeHome", "content_text_119")}</strong>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_120")}</span>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-2)' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_121")}</span>
                                    <strong style={{ fontSize: '0.9rem', color: '#4FB6F5' }}>{billableHours.toFixed(1)}{readData("components.Dashboard.Views.EmployeeHome", "content_text_122")}{billablePercent}{readData("components.Dashboard.Views.EmployeeHome", "content_text_123")}</strong>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <button
                                    className={shared.btnRowAction}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                        padding: '0.4rem 0.8rem',
                                        background: 'var(--card-2)',
                                        border: '1px solid rgba(255, 255, 255, 0.12)',
                                        color: 'var(--text)',
                                        fontSize: '0.76rem',
                                        fontWeight: 600
                                    }}
                                    onClick={() => setIsLogModalOpen(true)}
                                >
                                    <Plus size={13} color="#05CD99" />{readData("components.Dashboard.Views.EmployeeHome", "content_text_124")}</button>
                                {timesheetStatus === 'submitted' ? (
                                    <button
                                        className={shared.btnRowAction}
                                        style={{
                                            padding: '0.4rem 0.9rem',
                                            background: 'rgba(45, 212, 168, 0.15)',
                                            border: '1px solid rgba(45, 212, 168, 0.35)',
                                            color: '#05CD99',
                                            fontSize: '0.76rem',
                                            fontWeight: 700,
                                            cursor: 'default'
                                        }}
                                        disabled
                                    >{readData("components.Dashboard.Views.EmployeeHome", "content_text_125")}</button>
                                ) : (
                                    <button
                                        className={shared.btnRowAction}
                                        style={{
                                            padding: '0.4rem 0.9rem',
                                            background: '#05CD99',
                                            border: '1px solid #05CD99',
                                            color: '#060D18',
                                            fontSize: '0.76rem',
                                            fontWeight: 700,
                                            boxShadow: '0 2px 10px rgba(45, 212, 168, 0.25)'
                                        }}
                                        onClick={handleSubmitTimesheet}
                                    >
                                        <Send size={13} />{readData("components.Dashboard.Views.EmployeeHome", "content_text_126")}</button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Timesheet Project Allocation & Billability (col-4) */}
                <div className={`${shared.widgetCard} ${shared.col4}`}>
                    <div className={shared.cardTitleRow}>
                        <div className={shared.cardTitleLeft}>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_127")}</h3>
                            <span className={shared.cardSublabel}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_128")}</span>
                        </div>
                        <span className={`${shared.pillBadge} ${shared.pillSky}`}>{billablePercent}{readData("components.Dashboard.Views.EmployeeHome", "content_text_129")}</span>
                    </div>

                    <div className={shared.cardBody} style={{ gap: '0.85rem' }}>
                        {/* Allocation Progress Bars */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '0.3rem' }}>
                                <span style={{ color: 'var(--text)', fontWeight: 600 }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_130")}</span>
                                <strong style={{ color: '#05CD99' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_131")}</strong>
                            </div>
                            <div style={{ height: 7, background: 'var(--card-2)', borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{ width: '63%', height: '100%', background: '#05CD99' }} />
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-2)', marginTop: '0.15rem' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_132")}</div>
                        </div>

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '0.3rem' }}>
                                <span style={{ color: 'var(--text)', fontWeight: 600 }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_133")}</span>
                                <strong style={{ color: '#4FB6F5' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_134")}</strong>
                            </div>
                            <div style={{ height: 7, background: 'var(--card-2)', borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{ width: '22%', height: '100%', background: '#4FB6F5' }} />
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-2)', marginTop: '0.15rem' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_135")}</div>
                        </div>

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '0.3rem' }}>
                                <span style={{ color: 'var(--text)', fontWeight: 600 }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_136")}</span>
                                <strong style={{ color: '#9B8CFF' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_137")}</strong>
                            </div>
                            <div style={{ height: 7, background: 'var(--card-2)', borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{ width: '15%', height: '100%', background: '#9B8CFF' }} />
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-2)', marginTop: '0.15rem' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_138")}</div>
                        </div>

                        {/* Sign-off & Policy Box */}
                        <div style={{
                            padding: '0.75rem',
                            background: 'var(--card-2)',
                            borderRadius: '8px',
                            border: '1px solid rgba(28, 52, 80, 0.6)',
                            marginTop: '0.25rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)' }}>
                                <UserCheck size={14} color="#05CD99" />{readData("components.Dashboard.Views.EmployeeHome", "content_text_139")}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-2)', marginTop: '0.25rem', lineHeight: 1.4 }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_140")}<strong>{readData("components.Dashboard.Views.EmployeeHome", "content_text_141")}</strong>{readData("components.Dashboard.Views.EmployeeHome", "content_text_142")}<strong>{readData("components.Dashboard.Views.EmployeeHome", "content_text_143")}</strong>{readData("components.Dashboard.Views.EmployeeHome", "content_text_144")}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Row: My Goals + Personal Attendance Heatmap + Learning */}
            <div className={shared.grid12}>
                {/* 1. My Goals (col-4) */}
                <div className={`${shared.widgetCard} ${shared.col4}`}>
                    <div className={shared.cardTitleRow}>
                        <div className={shared.cardTitleLeft}>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_145")}</h3>
                            <span className={shared.cardSublabel}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_146")}</span>
                        </div>
                    </div>
                    <div className={shared.cardBody} style={{ gap: '0.85rem', justifyContent: 'center' }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '0.3rem' }}>
                                <span>{readData("components.Dashboard.Views.EmployeeHome", "content_text_147")}</span>
                                <strong>{readData("components.Dashboard.Views.EmployeeHome", "content_text_148")}</strong>
                            </div>
                            <div style={{ height: 7, background: 'var(--card-2)', borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{ width: '74%', height: '100%', background: '#05CD99' }} />
                            </div>
                        </div>

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '0.3rem' }}>
                                <span>{readData("components.Dashboard.Views.EmployeeHome", "content_text_149")}</span>
                                <strong>{readData("components.Dashboard.Views.EmployeeHome", "content_text_150")}</strong>
                            </div>
                            <div style={{ height: 7, background: 'var(--card-2)', borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{ width: '46%', height: '100%', background: '#4FB6F5' }} />
                            </div>
                        </div>

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '0.3rem' }}>
                                <span>{readData("components.Dashboard.Views.EmployeeHome", "content_text_151")}</span>
                                <strong style={{ color: '#05CD99' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_152")}</strong>
                            </div>
                            <div style={{ height: 7, background: 'var(--card-2)', borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{ width: '100%', height: '100%', background: '#05CD99' }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Personal Attendance Heatmap (col-4) */}
                <div className={`${shared.widgetCard} ${shared.col4}`}>
                    <div className={shared.cardTitleRow}>
                        <div className={shared.cardTitleLeft}>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_153")}</h3>
                            <span className={shared.cardSublabel}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_154")}</span>
                        </div>
                    </div>
                    <div className={shared.cardBody}>
                        <NucleusChart option={personalAttendanceOption} style={{ height: 210 }} />
                    </div>
                </div>

                {/* 3. Learning on Magnetix (col-4) */}
                <div className={`${shared.widgetCard} ${shared.col4}`}>
                    <div className={shared.cardTitleRow}>
                        <div className={shared.cardTitleLeft}>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_155")}</h3>
                            <span className={shared.cardSublabel}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_156")}</span>
                        </div>
                    </div>
                    <div className={shared.cardBody}>
                        <table className={shared.dataTable}>
                            <tbody>
                                <tr>
                                    <td>
                                        <strong>{readData("components.Dashboard.Views.EmployeeHome", "content_text_157")}</strong>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-2)' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_158")}</div>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <span className={`${shared.pillBadge} ${shared.pillCoral}`}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_159")}</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <strong>{readData("components.Dashboard.Views.EmployeeHome", "content_text_160")}</strong>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-2)' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_161")}</div>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <span className={`${shared.pillBadge} ${shared.pillTeal}`}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_162")}</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <strong>{readData("components.Dashboard.Views.EmployeeHome", "content_text_163")}</strong>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-2)' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_164")}</div>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <span className={`${shared.pillBadge} ${shared.pillViolet}`}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_165")}</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* 4. My Reporting Line & Engineering Pod Structure */}
            <div className={shared.widgetCard} style={{ marginTop: '0.25rem' }}>
                <div className={shared.cardTitleRow}>
                    <div className={shared.cardTitleLeft}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <Users size={16} color="#9B8CFF" />
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_166")}</h3>
                        </div>
                        <span className={shared.cardSublabel}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_167")}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => onNavigate && onNavigate('team')}
                            style={{
                                background: 'rgba(155, 140, 255, 0.12)',
                                border: '1px solid rgba(155, 140, 255, 0.35)',
                                color: 'var(--agent)',
                                borderRadius: '6px',
                                padding: '0.3rem 0.75rem',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem'
                            }}
                        >
                            <Users size={13} />{readData("components.Dashboard.Views.EmployeeHome", "content_text_168")}</button>
                        <button
                            onClick={() => onNavigate && onNavigate('people_core')}
                            style={{
                                background: 'var(--card-2)',
                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                color: 'var(--text)',
                                borderRadius: '6px',
                                padding: '0.3rem 0.75rem',
                                fontSize: '0.74rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >{readData("components.Dashboard.Views.EmployeeHome", "content_text_169")}</button>
                    </div>
                </div>

                <div className={shared.cardBody}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                        gap: '1.25rem',
                        width: '100%'
                    }}>
                        {/* Reporting Chain */}
                        <div style={{
                            padding: '1rem',
                            background: 'var(--card-2)',
                            borderRadius: '10px',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.85rem'
                        }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_170")}</span>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                                <NextImage unoptimized width={48} height={48}
                                    src={readData("components.Dashboard.Views.EmployeeHome", "attribute_8")}
                                    alt={readData("components.Dashboard.Views.EmployeeHome", "content_alt_171")}
                                    style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid #05CD99' }}
                                />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                        <strong style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_172")}</strong>
                                        <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: 4, background: 'rgba(45, 212, 168, 0.15)', color: '#05CD99', fontWeight: 700 }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_173")}</span>
                                    </div>
                                    <span style={{ fontSize: '0.76rem', color: 'var(--text-2)' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_174")}</span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_175")}</span>
                                </div>
                            </div>

                            <div style={{ height: 1, background: 'var(--card-2)' }} />

                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-2)' }}>
                                <span>{readData("components.Dashboard.Views.EmployeeHome", "content_text_176")}<strong style={{ color: 'var(--text)' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_177")}</strong></span>
                                <span>{readData("components.Dashboard.Views.EmployeeHome", "content_text_178")}<strong style={{ color: '#05CD99' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_179")}</strong></span>
                            </div>
                        </div>

                        {/* Pod Colleagues */}
                        <div style={{
                            padding: '1rem',
                            background: 'var(--card-2)',
                            borderRadius: '10px',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.85rem'
                        }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_180")}</span>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                                {readData("components.Dashboard.Views.EmployeeHome", "content_181").map((tm) => (
                                    <div key={tm.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#05CD99' }} />
                                            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{tm.name}</span>
                                            <span style={{ color: 'var(--text-3)', fontSize: '0.72rem' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_182")}{tm.role}</span>
                                        </div>
                                        <span style={{ color: '#4FB6F5', fontSize: '0.7rem' }}>{tm.pod}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Log Project Time Modal */}
            {isLogModalOpen && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'var(--overlay)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '1.25rem'
                }} onClick={() => setIsLogModalOpen(false)}>
                    <div
                        style={{
                            background: 'var(--card)',
                            border: '1px solid rgba(45, 212, 168, 0.3)',
                            borderRadius: '16px',
                            width: '100%',
                            maxWidth: '480px',
                            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '1.25rem 1.5rem',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                            background: 'rgba(255, 255, 255, 0.02)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: 10,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'rgba(45, 212, 168, 0.15)',
                                    border: '1px solid rgba(45, 212, 168, 0.35)',
                                    color: '#05CD99'
                                }}>
                                    <Clock size={18} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_183")}</h3>
                                    <div style={{ fontSize: '0.74rem', color: 'var(--text-2)', marginTop: '0.15rem' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_184")}</div>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsLogModalOpen(false)}
                                style={{
                                    background: 'transparent',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    borderRadius: 8,
                                    width: 32,
                                    height: 32,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-2)',
                                    cursor: 'pointer'
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Body Form */}
                        <form onSubmit={handleAddLog} style={{ padding: '1.35rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                            {/* Project Select */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.4rem' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_185")}</label>
                                <select
                                    value={newLogProject}
                                    onChange={e => setNewLogProject(e.target.value)}
                                    style={{
                                        background: 'var(--card-2)',
                                        border: '1px solid rgba(255, 255, 255, 0.12)',
                                        borderRadius: 8,
                                        padding: '0.65rem 0.85rem',
                                        color: 'var(--text)',
                                        fontSize: '0.82rem',
                                        width: '100%',
                                        boxSizing: 'border-box'
                                    }}
                                >
                                    <option value="Project Alpha (Core HRMS)">{readData("components.Dashboard.Views.EmployeeHome", "content_text_186")}</option>
                                    <option value="DevOps &amp; Cloud Pod">{readData("components.Dashboard.Views.EmployeeHome", "content_text_187")}</option>
                                    <option value="Platform Architecture">{readData("components.Dashboard.Views.EmployeeHome", "content_text_188")}</option>
                                    <option value="General Admin &amp; Townhalls">{readData("components.Dashboard.Views.EmployeeHome", "content_text_189")}</option>
                                </select>
                            </div>

                            {/* Task Description */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.4rem' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_190")}</label>
                                <textarea
                                    rows={3}
                                    value={newLogTask}
                                    onChange={e => setNewLogTask(e.target.value)}
                                    placeholder={readData("components.Dashboard.Views.EmployeeHome", "content_placeholder_191")}
                                    style={{
                                        background: 'var(--card-2)',
                                        border: '1px solid rgba(255, 255, 255, 0.12)',
                                        borderRadius: 8,
                                        padding: '0.65rem 0.85rem',
                                        color: 'var(--text)',
                                        fontSize: '0.82rem',
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        resize: 'none',
                                        fontFamily: 'inherit'
                                    }}
                                />
                            </div>

                            {/* Hours and Billable Row */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.4rem' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_192")}</label>
                                    <input
                                        type="number"
                                        required
                                        step="0.5"
                                        min="0.5"
                                        max="16"
                                        value={newLogHours}
                                        onChange={e => setNewLogHours(e.target.value)}
                                        style={{
                                            background: 'var(--card-2)',
                                            border: '1px solid rgba(255, 255, 255, 0.12)',
                                            borderRadius: 8,
                                            padding: '0.65rem 0.85rem',
                                            color: 'var(--text)',
                                            fontSize: '0.82rem',
                                            width: '100%',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.4rem' }}>{readData("components.Dashboard.Views.EmployeeHome", "content_text_193")}</label>
                                    <div
                                        onClick={() => setNewLogBillable(!newLogBillable)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            height: '38px',
                                            padding: '0 0.85rem',
                                            borderRadius: 8,
                                            background: newLogBillable ? 'rgba(45, 212, 168, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                            border: newLogBillable ? '1px solid rgba(45, 212, 168, 0.4)' : '1px solid rgba(255, 255, 255, 0.12)',
                                            cursor: 'pointer',
                                            userSelect: 'none'
                                        }}
                                    >
                                        <div style={{
                                            width: 14,
                                            height: 14,
                                            borderRadius: 3,
                                            background: newLogBillable ? '#05CD99' : 'transparent',
                                            border: newLogBillable ? 'none' : '1.5px solid #94A3B8',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            {newLogBillable && <Check size={11} color="#060D18" strokeWidth={3} />}
                                        </div>
                                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: newLogBillable ? '#05CD99' : '#94A3B8' }}>
                                            {newLogBillable ? readData("components.Dashboard.Views.EmployeeHome", "display_9") : readData("components.Dashboard.Views.EmployeeHome", "display_10")}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Buttons */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                gap: '0.65rem',
                                marginTop: '0.5rem',
                                paddingTop: '1rem',
                                borderTop: '1px solid rgba(255, 255, 255, 0.08)'
                            }}>
                                <button
                                    type="button"
                                    onClick={() => setIsLogModalOpen(false)}
                                    style={{
                                        background: 'transparent',
                                        border: '1px solid rgba(255, 255, 255, 0.12)',
                                        borderRadius: 8,
                                        padding: '0.55rem 1.1rem',
                                        color: 'var(--text-2)',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >{readData("components.Dashboard.Views.EmployeeHome", "content_text_194")}</button>
                                <button
                                    type="submit"
                                    style={{
                                        background: '#05CD99',
                                        color: '#060D18',
                                        border: '1px solid #05CD99',
                                        borderRadius: 8,
                                        padding: '0.55rem 1.25rem',
                                        fontSize: '0.8rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.45rem',
                                        boxShadow: '0 4px 14px rgba(45, 212, 168, 0.25)'
                                    }}
                                >
                                    <PlusCircle size={14} />{readData("components.Dashboard.Views.EmployeeHome", "content_text_195")}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
