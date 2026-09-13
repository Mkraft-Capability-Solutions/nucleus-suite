"use client";
import { readData } from '../../../services/workspace-data.mjs';

import React, { useEffect, useState } from 'react';
import {
    Clock, AlertTriangle, Users, Calendar, CheckCircle2,
    ArrowUpRight, ArrowDownRight, Sparkles, Filter, RefreshCw, ShieldCheck, KeyRound
} from 'lucide-react';
import NucleusChart from '@/components/Charts/NucleusChart';
import { NUCLEUS_COLORS } from '@/components/Charts/theme';
import shared from '../DashboardShared.module.css';
import { useHRMS } from '@/context/HRMSContext';
import { launchAction } from '@/lib/action-launcher';

export default function AttendanceIntelligence({ onNavigate }) {
    const { timeOfficeLedger, gatePasses, rulesetVersion } = useHRMS();
    const [selectedSite, setSelectedSite] = useState(readData("components.Dashboard.Views.AttendanceIntelligence", "initialState_1"));
    const [autoFilled, setAutoFilled] = useState(false);
    const [toastMessage, setToastMessage] = useState(null);

    // 1. Dual-Axis Attendance vs Absenteeism Trend
    const attendanceTrendOption = {
        ...readData("components.Dashboard.Views.AttendanceIntelligence", "attendanceTrendOption_fields_1"),
        legend: {
            ...readData("components.Dashboard.Views.AttendanceIntelligence", "legend_fields_4"),
            textStyle: { color: NUCLEUS_COLORS.textMuted, ...readData("components.Dashboard.Views.AttendanceIntelligence", "textStyle_fields_6") }
        },
        ...readData("components.Dashboard.Views.AttendanceIntelligence", "attendanceTrendOption_fields_2"),
        series: [
            {
                ...readData("components.Dashboard.Views.AttendanceIntelligence", "series_fields_9"),
                itemStyle: { color: NUCLEUS_COLORS.teal },
                ...readData("components.Dashboard.Views.AttendanceIntelligence", "series_fields_10")
            },
            {
                ...readData("components.Dashboard.Views.AttendanceIntelligence", "series_fields_14"),
                itemStyle: { color: NUCLEUS_COLORS.coral },
                ...readData("components.Dashboard.Views.AttendanceIntelligence", "series_fields_15")
            }
        ]
    };

    // 2. Site Punctuality Profile Radar
    const punctualityRadarOption = {
        ...readData("components.Dashboard.Views.AttendanceIntelligence", "punctualityRadarOption_fields_18"),
        series: [{
            ...readData("components.Dashboard.Views.AttendanceIntelligence", "series_fields_20"),
            data: [
                {
                    ...readData("components.Dashboard.Views.AttendanceIntelligence", "data_fields_21"),
                    itemStyle: { color: NUCLEUS_COLORS.sky },
                    ...readData("components.Dashboard.Views.AttendanceIntelligence", "data_fields_22")
                }
            ]
        }]
    };

    // 3. Department Overtime Hours (Horizontal Bar)
    const overtimeBarOption = {
        ...readData("components.Dashboard.Views.AttendanceIntelligence", "overtimeBarOption_fields_25"),
        yAxis: {
            ...readData("components.Dashboard.Views.AttendanceIntelligence", "yAxis_fields_29"),
            axisLabel: { color: NUCLEUS_COLORS.textMuted, ...readData("components.Dashboard.Views.AttendanceIntelligence", "axisLabel_fields_31") }
        },
        series: [{
            ...readData("components.Dashboard.Views.AttendanceIntelligence", "series_fields_32"),
            data: [
                { ...readData("components.Dashboard.Views.AttendanceIntelligence", "data_fields_34"), itemStyle: { color: NUCLEUS_COLORS.teal } },
                { ...readData("components.Dashboard.Views.AttendanceIntelligence", "data_fields_35"), itemStyle: { color: NUCLEUS_COLORS.sky } },
                { ...readData("components.Dashboard.Views.AttendanceIntelligence", "data_fields_36"), itemStyle: { color: NUCLEUS_COLORS.violet } },
                { ...readData("components.Dashboard.Views.AttendanceIntelligence", "data_fields_37"), itemStyle: { color: NUCLEUS_COLORS.amber } },
                { ...readData("components.Dashboard.Views.AttendanceIntelligence", "data_fields_38"), itemStyle: { color: NUCLEUS_COLORS.coral } }
            ],
            ...readData("components.Dashboard.Views.AttendanceIntelligence", "series_fields_33")
        }]
    };

    // 4. Shift Coverage Tomorrow Data
    const shiftSchedule = [
        { ...readData("components.Dashboard.Views.AttendanceIntelligence", "shiftSchedule_fields_40"), ros: autoFilled ? 12 : 12, ...readData("components.Dashboard.Views.AttendanceIntelligence", "shiftSchedule_fields_41") },
        { ...readData("components.Dashboard.Views.AttendanceIntelligence", "shiftSchedule_fields_42"), ros: autoFilled ? 34 : 34, ...readData("components.Dashboard.Views.AttendanceIntelligence", "shiftSchedule_fields_43") },
        { ...readData("components.Dashboard.Views.AttendanceIntelligence", "shiftSchedule_fields_44"), ros: autoFilled ? 58 : 52, gap: autoFilled ? 0 : -6 },
        { ...readData("components.Dashboard.Views.AttendanceIntelligence", "shiftSchedule_fields_45"), ros: autoFilled ? 62 : 62, ...readData("components.Dashboard.Views.AttendanceIntelligence", "shiftSchedule_fields_46") },
        { ...readData("components.Dashboard.Views.AttendanceIntelligence", "shiftSchedule_fields_47"), ros: autoFilled ? 60 : 60, ...readData("components.Dashboard.Views.AttendanceIntelligence", "shiftSchedule_fields_48") },
        { ...readData("components.Dashboard.Views.AttendanceIntelligence", "shiftSchedule_fields_49"), ros: autoFilled ? 54 : 49, gap: autoFilled ? 0 : -5 },
        { ...readData("components.Dashboard.Views.AttendanceIntelligence", "shiftSchedule_fields_50"), ros: autoFilled ? 38 : 38, ...readData("components.Dashboard.Views.AttendanceIntelligence", "shiftSchedule_fields_51") },
        { ...readData("components.Dashboard.Views.AttendanceIntelligence", "shiftSchedule_fields_52"), ros: autoFilled ? 22 : 22, ...readData("components.Dashboard.Views.AttendanceIntelligence", "shiftSchedule_fields_53") },
        { ...readData("components.Dashboard.Views.AttendanceIntelligence", "shiftSchedule_fields_54"), ros: autoFilled ? 14 : 11, gap: autoFilled ? 0 : -3 },
        { ...readData("components.Dashboard.Views.AttendanceIntelligence", "shiftSchedule_fields_55"), ros: autoFilled ? 8 : 8, ...readData("components.Dashboard.Views.AttendanceIntelligence", "shiftSchedule_fields_56") },
    ];

    useEffect(() => {
        const applyRoster = (event) => {
            if (event.detail?.action === 'roster') {
                setAutoFilled(true);
                setToastMessage('The reviewed roster proposal is now applied.');
                setTimeout(() => setToastMessage(null), 4000);
            }
        };
        window.addEventListener('nucleus:action-completed', applyRoster);
        return () => window.removeEventListener('nucleus:action-completed', applyRoster);
    }, []);

    return (
        <div className={shared.dashboardWrapper}>
            {/* Header / Sub-Nav Bar */}
            <div className={shared.pageHeader}>
                <div>
                    <div className={shared.badgeRow}>
                        <span className={`${shared.badge} ${shared.badgeTeal}`}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_57")}</span>
                        <span className={`${shared.badge} ${shared.badgeSky}`}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_58")}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-2)' }}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_59")}</span>
                    </div>
                    <h1 className={shared.screenTitle}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_60")}</h1>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <select
                        value={selectedSite}
                        onChange={(e) => setSelectedSite(e.target.value)}
                        className={shared.periodSelect}
                    >
                        <option value="All">{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_61")}</option>
                        <option value="Bengaluru">{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_62")}</option>
                        <option value="Pune">{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_63")}</option>
                        <option value="Hyderabad">{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_64")}</option>
                        <option value="Chennai">{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_65")}</option>
                    </select>
                    <button
                        onClick={() => onNavigate && onNavigate('attendance')}
                        className={shared.primaryBtn}
                    >{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_66")}</button>
                </div>
            </div>

            {toastMessage && (
                <div style={{
                    padding: '0.65rem 1rem',
                    background: 'rgba(45, 212, 168, 0.12)',
                    border: '1px solid #05CD99',
                    borderRadius: '6px',
                    color: '#05CD99',
                    fontSize: '0.78rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <CheckCircle2 size={16} />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* 6 Pulse KPIs */}
            <div className={shared.kpiGrid}>
                <div className={shared.kpiCard}>
                    <div className={shared.kpiLabel}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_67")}</div>
                    <div className={shared.kpiValue}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_68")}</div>
                    <div className={`${shared.kpiDelta} ${shared.deltaPositive}`}>
                        <ArrowUpRight size={13} />{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_69")}</div>
                </div>
                <div className={shared.kpiCard}>
                    <div className={shared.kpiLabel}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_70")}</div>
                    <div className={shared.kpiValue}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_71")}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-2)' }}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_72")}</div>
                </div>
                <div className={shared.kpiCard}>
                    <div className={shared.kpiLabel}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_73")}</div>
                    <div className={shared.kpiValue}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_74")}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--pending)' }}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_75")}</div>
                </div>
                <div className={shared.kpiCard}>
                    <div className={shared.kpiLabel}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_76")}</div>
                    <div className={shared.kpiValue}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_77")}</div>
                    <div className={`${shared.kpiDelta} ${shared.deltaNegative}`}>
                        <ArrowUpRight size={13} />{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_78")}</div>
                </div>
                <div className={shared.kpiCard}>
                    <div className={shared.kpiLabel}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_79")}</div>
                    <div className={shared.kpiValue}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_80")}</div>
                    <div style={{ fontSize: '0.7rem', color: '#F2647E' }}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_81")}</div>
                </div>
                <div className={shared.kpiCard}>
                    <div className={shared.kpiLabel}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_82")}</div>
                    <div className={shared.kpiValue}>{autoFilled ? readData("components.Dashboard.Views.AttendanceIntelligence", "display_2") : readData("components.Dashboard.Views.AttendanceIntelligence", "display_3")}</div>
                    <div style={{ fontSize: '0.7rem', color: autoFilled ? '#05CD99' : '#F2A93B' }}>
                        {autoFilled ? readData("components.Dashboard.Views.AttendanceIntelligence", "display_4") : readData("components.Dashboard.Views.AttendanceIntelligence", "display_5")}
                    </div>
                </div>
            </div>

            {/* Shift Coverage Tomorrow (W11 Roster Strip) */}
            <div className={shared.card} style={{ marginBottom: '1.25rem' }}>
                <div className={shared.cardHeader}>
                    <div>
                        <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_83")}</h3>
                        <p className={shared.cardSubtitle}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_84")}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{
                            fontSize: '0.7rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            background: autoFilled ? 'rgba(45, 212, 168, 0.15)' : 'rgba(242, 169, 59, 0.15)',
                            color: autoFilled ? '#05CD99' : '#F2A93B',
                            fontWeight: 600
                        }}>
                            {autoFilled ? readData("components.Dashboard.Views.AttendanceIntelligence", "display_6") : readData("components.Dashboard.Views.AttendanceIntelligence", "display_7")}
                        </span>
                        <button
                        onClick={() => launchAction('roster', { site: selectedSite })}
                            disabled={autoFilled}
                            className={shared.primaryBtn}
                            style={{ fontSize: '0.74rem', padding: '0.35rem 0.75rem', opacity: autoFilled ? 0.5 : 1 }}
                        >
                            <Sparkles size={13} style={{ marginRight: 4 }} />
                            {autoFilled ? readData("components.Dashboard.Views.AttendanceIntelligence", "display_8") : readData("components.Dashboard.Views.AttendanceIntelligence", "display_9")}
                        </button>
                    </div>
                </div>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(10, 1fr)',
                    gap: '0.5rem',
                    overflowX: 'auto',
                    padding: '0.5rem 0'
                }}>
                    {shiftSchedule.map((slot, idx) => (
                        <div
                            key={idx}
                            style={{
                                background: 'var(--card-2)',
                                border: slot.gap < 0 ? '1px solid #F2647E' : '1px solid #1C3450',
                                borderRadius: '6px',
                                padding: '0.6rem 0.4rem',
                                textAlign: 'center'
                            }}
                        >
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-2)', fontWeight: 600 }}>{slot.time}</div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginTop: '0.25rem' }}>
                                {slot.ros} <span style={{ fontSize: '0.68rem', color: '#5C7896' }}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_85")}{slot.req}</span>
                            </div>
                            <div style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                marginTop: '0.2rem',
                                color: slot.gap < 0 ? '#F2647E' : '#05CD99'
                            }}>
                                {slot.gap < 0 ? `${slot.gap} gap` : readData("components.Dashboard.Views.AttendanceIntelligence", "display_10")}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Middle Grid: Trend + Radar + Overtime */}
            <div className={shared.grid12} style={{ marginBottom: '1.25rem' }}>
                <div className={`${shared.card} ${shared.col8}`}>
                    <div className={shared.cardHeader}>
                        <div>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_86")}</h3>
                            <p className={shared.cardSubtitle}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_87")}</p>
                        </div>
                    </div>
                    <NucleusChart option={attendanceTrendOption} height="280px" />
                </div>

                <div className={`${shared.card} ${shared.col4}`}>
                    <div className={shared.cardHeader}>
                        <div>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_88")}</h3>
                            <p className={shared.cardSubtitle}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_89")}</p>
                        </div>
                    </div>
                    <NucleusChart option={punctualityRadarOption} height="280px" />
                </div>
            </div>

            {/* AI Pattern Findings + Overtime Bar */}
            <div className={shared.grid12} style={{ marginBottom: '1.25rem' }}>
                {/* 3 AI Pattern Findings */}
                <div className={`${shared.card} ${shared.col6}`}>
                    <div className={shared.cardHeader}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <Sparkles size={16} color="#9B8CFF" />
                                    <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_90")}</h3>
                                </div>
                                <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    padding: '0.18rem 0.55rem',
                                    borderRadius: '9999px',
                                    background: 'rgba(155, 140, 255, 0.15)',
                                    border: '1px solid rgba(155, 140, 255, 0.35)',
                                    color: 'var(--agent)',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    letterSpacing: '0.02em',
                                    boxShadow: '0 0 12px rgba(155, 140, 255, 0.15)'
                                }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#9B8CFF', display: 'inline-block', boxShadow: '0 0 6px #9B8CFF' }} />{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_91")}</span>
                            </div>
                            <p className={shared.cardSubtitle}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_92")}</p>
                        </div>
                        <span className={`${shared.badge} ${shared.badgeViolet}`}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_93")}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{
                            padding: '0.75rem',
                            background: 'rgba(242, 100, 126, 0.08)',
                            border: '1px solid rgba(242, 100, 126, 0.3)',
                            borderRadius: '6px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <strong style={{ fontSize: '0.78rem', color: '#F2647E' }}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_94")}</strong>
                                <button className={shared.textBtn} style={{ fontSize: '0.7rem', color: '#F2647E' }} onClick={() => launchAction('anomalyReview', readData("components.Dashboard.Views.AttendanceIntelligence", "content_95"))}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_96")}</button>
                            </div>
                            <p style={{ fontSize: '0.72rem', color: 'var(--text)', margin: '0.3rem 0 0' }}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_97")}</p>
                        </div>

                        <div style={{
                            padding: '0.75rem',
                            background: 'rgba(242, 169, 59, 0.08)',
                            border: '1px solid rgba(242, 169, 59, 0.3)',
                            borderRadius: '6px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <strong style={{ fontSize: '0.78rem', color: 'var(--pending)' }}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_98")}</strong>
                                <button className={shared.textBtn} style={{ fontSize: '0.7rem', color: 'var(--pending)' }} onClick={() => launchAction('roster', readData("components.Dashboard.Views.AttendanceIntelligence", "content_99"))}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_100")}</button>
                            </div>
                            <p style={{ fontSize: '0.72rem', color: 'var(--text)', margin: '0.3rem 0 0' }}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_101")}</p>
                        </div>

                        <div style={{
                            padding: '0.75rem',
                            background: 'rgba(155, 140, 255, 0.08)',
                            border: '1px solid rgba(155, 140, 255, 0.3)',
                            borderRadius: '6px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <strong style={{ fontSize: '0.78rem', color: '#9B8CFF' }}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_102")}</strong>
                                <button className={shared.textBtn} style={{ fontSize: '0.7rem', color: '#9B8CFF' }} onClick={() => launchAction('wellbeing')}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_103")}</button>
                            </div>
                            <p style={{ fontSize: '0.72rem', color: 'var(--text)', margin: '0.3rem 0 0' }}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_104")}</p>
                        </div>
                    </div>
                </div>

                {/* Overtime by Department Bar */}
                <div className={`${shared.card} ${shared.col6}`}>
                    <div className={shared.cardHeader}>
                        <div>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_105")}</h3>
                            <p className={shared.cardSubtitle}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_106")}</p>
                        </div>
                    </div>
                    <NucleusChart option={overtimeBarOption} height="260px" />
                </div>
            </div>

            {/* Regularisation Requests Pending Table */}
            <div className={shared.card}>
                <div className={shared.cardHeader}>
                    <div>
                        <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_107")}</h3>
                        <p className={shared.cardSubtitle}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_108")}</p>
                    </div>
                    <button onClick={() => onNavigate && onNavigate('attendance')} className={shared.textBtn}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_109")}</button>
                </div>
                <div className={shared.tableWrapper}>
                    <table className={shared.table}>
                        <thead>
                            <tr>
                                <th>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_110")}</th>
                                <th>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_111")}</th>
                                <th>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_112")}</th>
                                <th>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_113")}</th>
                                <th>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_114")}</th>
                                <th>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_115")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><strong>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_116")}</strong></td>
                                <td>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_117")}</td>
                                <td>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_118")}</td>
                                <td>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_119")}</td>
                                <td>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_120")}</td>
                                <td><span className={`${shared.badge} ${shared.badgeCoral}`}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_121")}</span></td>
                            </tr>
                            <tr>
                                <td><strong>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_122")}</strong></td>
                                <td>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_123")}</td>
                                <td>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_124")}</td>
                                <td>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_125")}</td>
                                <td>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_126")}</td>
                                <td><span className={`${shared.badge} ${shared.badgeAmber}`}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_127")}</span></td>
                            </tr>
                            <tr>
                                <td><strong>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_128")}</strong></td>
                                <td>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_129")}</td>
                                <td>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_130")}</td>
                                <td>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_131")}</td>
                                <td>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_132")}</td>
                                <td><span className={`${shared.badge} ${shared.badgeAmber}`}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_133")}</span></td>
                            </tr>
                            <tr>
                                <td><strong>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_134")}</strong></td>
                                <td>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_135")}</td>
                                <td>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_136")}</td>
                                <td>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_137")}</td>
                                <td>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_138")}</td>
                                <td><span className={`${shared.badge} ${shared.badgeTeal}`}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_139")}</span></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Time-Office Deterministic Policy & Cross-Midnight Roster (Sprint 1) */}
            <div className={shared.card} style={{ marginTop: '1.25rem', border: '1px solid rgba(45, 212, 168, 0.3)' }}>
                <div className={shared.cardHeader}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <ShieldCheck size={18} color="#05CD99" />
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_140")}</h3>
                            <span className={`${shared.badge} ${shared.badgeTeal}`}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_141")}{rulesetVersion || readData("components.Dashboard.Views.AttendanceIntelligence", "fallback_1")}</span>
                        </div>
                        <p className={shared.cardSubtitle}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_142")}</p>
                    </div>
                    <button
                        onClick={() => onNavigate && onNavigate('attendance')}
                        className={shared.primaryBtn}
                        style={{ fontSize: '0.74rem', padding: '0.35rem 0.75rem', background: '#2563eb' }}
                    >{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_143")}</button>
                </div>
                <div className={shared.tableWrapper}>
                    <table className={shared.table}>
                        <thead>
                            <tr>
                                <th>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_144")}</th>
                                <th>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_145")}</th>
                                <th>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_146")}</th>
                                <th>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_147")}</th>
                                <th>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_148")}</th>
                                <th>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_149")}</th>
                                <th>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_150")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(timeOfficeLedger || []).map(entry => (
                                <tr key={entry.id}>
                                    <td>
                                        <strong>{entry.employee_name}</strong>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-2)' }}>{entry.designation}</div>
                                    </td>
                                    <td>
                                        <span className={`${shared.badge} ${entry.worker_category_code === 'CONTRACT' ? shared.badgeAmber : entry.worker_category_code.startsWith('THIRD_PARTY') ? shared.badgeViolet : shared.badgeSky}`}>
                                            {entry.worker_category_code}
                                        </span>
                                        <div style={{ fontSize: '0.68rem', color: '#5C7896', marginTop: 2 }}>{entry.location_id}</div>
                                    </td>
                                    <td>
                                        <div>{entry.attendance_date}</div>
                                        <div style={{ fontSize: '0.68rem', color: '#05CD99', fontWeight: 600 }}>
                                            {entry.shift_id_inferred} {entry.shift_inferred && readData("components.Dashboard.Views.AttendanceIntelligence", "fallback_2")}
                                        </div>
                                    </td>
                                    <td>
                                        <div><strong>{Math.floor(entry.gross_minutes / 60)}{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_151")}{entry.gross_minutes % 60}{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_152")}</strong>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_153")}</div>
                                        {entry.break_minutes > 0 && (
                                            <div style={{ fontSize: '0.68rem', color: '#F2647E' }}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_154")}{entry.break_minutes}{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_155")}</div>
                                        )}
                                        {entry.gate_pass_minutes > 0 && (
                                            <div style={{ fontSize: '0.68rem', color: '#05CD99' }}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_156")}{entry.gate_pass_minutes}{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_157")}</div>
                                        )}
                                    </td>
                                    <td>
                                        <strong style={{ color: '#4FB6F5', fontSize: '0.85rem' }}>{entry.formatted_net || `${entry.net_minutes}m`}</strong>
                                    </td>
                                    <td>
                                        {entry.ot_minutes > 0 ? (
                                            <span style={{ color: '#05CD99', fontWeight: 700 }}>
                                                {entry.formatted_ot || `${entry.ot_minutes}m`}{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_158")}</span>
                                        ) : (
                                            <span style={{ color: '#5C7896' }}>{readData("components.Dashboard.Views.AttendanceIntelligence", "content_text_159")}</span>
                                        )}
                                    </td>
                                    <td>
                                        <span className={`${shared.badge} ${entry.status === 'present' ? shared.badgeTeal : shared.badgeCoral}`}>
                                            {entry.status.toUpperCase()}
                                        </span>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text)', marginTop: 3, maxWidth: 220 }}>
                                            {entry.status_reason}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
