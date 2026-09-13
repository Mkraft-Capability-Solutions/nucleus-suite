"use client";
import { readData } from '../../../services/workspace-data.mjs';

import React, { useState } from 'react';
import {
    TrendingUp, Award, Users, AlertTriangle, ShieldCheck,
    Layers, ArrowUpRight, CheckCircle2, Filter, Sparkles
} from 'lucide-react';
import NucleusChart from '@/components/Charts/NucleusChart';
import { NUCLEUS_COLORS } from '@/components/Charts/theme';
import shared from '../DashboardShared.module.css';

export default function PerformanceTalent({ onNavigate }) {
    const [selectedFunction, setSelectedFunction] = useState(readData("components.Dashboard.Views.PerformanceTalent", "initialState_1"));
    const [selectedCell, setSelectedCell] = useState(null);

    // 1. Rating Distribution vs Guided Curve
    const ratingDistributionOption = {
        ...readData("components.Dashboard.Views.PerformanceTalent", "ratingDistributionOption_fields_1"),
        legend: {
            ...readData("components.Dashboard.Views.PerformanceTalent", "legend_fields_4"),
            textStyle: { color: NUCLEUS_COLORS.textMuted, ...readData("components.Dashboard.Views.PerformanceTalent", "textStyle_fields_6") }
        },
        ...readData("components.Dashboard.Views.PerformanceTalent", "ratingDistributionOption_fields_2"),
        series: [
            {
                ...readData("components.Dashboard.Views.PerformanceTalent", "series_fields_9"),
                itemStyle: { color: NUCLEUS_COLORS.teal },
                ...readData("components.Dashboard.Views.PerformanceTalent", "series_fields_10")
            },
            {
                ...readData("components.Dashboard.Views.PerformanceTalent", "series_fields_12"),
                itemStyle: { color: NUCLEUS_COLORS.sky },
                ...readData("components.Dashboard.Views.PerformanceTalent", "series_fields_13")
            }
        ]
    };

    // 2. Competency Profile Radar (Average vs Role Bar)
    const competencyRadarOption = {
        legend: {
            ...readData("components.Dashboard.Views.PerformanceTalent", "legend_fields_17"),
            textStyle: { color: NUCLEUS_COLORS.textMuted, ...readData("components.Dashboard.Views.PerformanceTalent", "textStyle_fields_19") }
        },
        ...readData("components.Dashboard.Views.PerformanceTalent", "competencyRadarOption_fields_16"),
        series: [{
            ...readData("components.Dashboard.Views.PerformanceTalent", "series_fields_21"),
            data: [
                {
                    ...readData("components.Dashboard.Views.PerformanceTalent", "data_fields_22"),
                    itemStyle: { color: NUCLEUS_COLORS.teal },
                    ...readData("components.Dashboard.Views.PerformanceTalent", "data_fields_23")
                },
                {
                    ...readData("components.Dashboard.Views.PerformanceTalent", "data_fields_26"),
                    itemStyle: { color: NUCLEUS_COLORS.sky },
                    ...readData("components.Dashboard.Views.PerformanceTalent", "data_fields_27")
                }
            ]
        }]
    };

    // 9-Box Grid Cell Definitions
    const nineBoxCells = readData("components.Dashboard.Views.PerformanceTalent", "nineBoxCells_30");

    return (
        <div className={shared.dashboardWrapper}>
            {/* Header */}
            <div className={shared.pageHeader}>
                <div>
                    <div className={shared.badgeRow}>
                        <span className={`${shared.badge} ${shared.badgeTeal}`}>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_31")}</span>
                        <span className={`${shared.badge} ${shared.badgeSky}`}>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_32")}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-2)' }}>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_33")}</span>
                    </div>
                    <h1 className={shared.screenTitle}>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_34")}</h1>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <select
                        value={selectedFunction}
                        onChange={(e) => setSelectedFunction(e.target.value)}
                        className={shared.periodSelect}
                    >
                        <option value="Engineering">{readData("components.Dashboard.Views.PerformanceTalent", "content_text_35")}</option>
                        <option value="Product">{readData("components.Dashboard.Views.PerformanceTalent", "content_text_36")}</option>
                        <option value="Sales">{readData("components.Dashboard.Views.PerformanceTalent", "content_text_37")}</option>
                    </select>
                    <button onClick={() => onNavigate && onNavigate('performance')} className={shared.primaryBtn}>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_38")}</button>
                </div>
            </div>

            {/* 4 Performance KPIs */}
            <div className={shared.kpiGrid}>
                <div className={shared.kpiCard}>
                    <div className={shared.kpiLabel}>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_39")}</div>
                    <div className={shared.kpiValue}>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_40")}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--pending)' }}>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_41")}</div>
                </div>
                <div className={shared.kpiCard}>
                    <div className={shared.kpiLabel}>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_42")}</div>
                    <div className={shared.kpiValue}>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_43")}</div>
                    <div style={{ fontSize: '0.7rem', color: '#F2647E' }}>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_44")}</div>
                </div>
                <div className={shared.kpiCard}>
                    <div className={shared.kpiLabel}>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_45")}</div>
                    <div className={shared.kpiValue}>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_46")}</div>
                    <div style={{ fontSize: '0.7rem', color: '#9B8CFF' }}>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_47")}</div>
                </div>
                <div className={shared.kpiCard}>
                    <div className={shared.kpiLabel}>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_48")}</div>
                    <div className={shared.kpiValue}>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_49")}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--pending)' }}>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_50")}</div>
                </div>
            </div>

            {/* 9-Box Grid + Distribution + Competency Radar */}
            <div className={shared.grid12} style={{ marginBottom: '1.25rem' }}>
                {/* 9-Box Talent Grid */}
                <div className={`${shared.card} ${shared.col5}`}>
                    <div className={shared.cardHeader}>
                        <div>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_51")}</h3>
                            <p className={shared.cardSubtitle}>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_52")}</p>
                        </div>
                        <span className={`${shared.badge} ${shared.badgeTeal}`}>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_53")}</span>
                    </div>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '0.5rem',
                        marginTop: '0.5rem'
                    }}>
                        {nineBoxCells.map((cell) => (
                            <div
                                key={cell.id}
                                onClick={() => setSelectedCell(cell.name)}
                                style={{
                                    background: selectedCell === cell.name ? 'rgba(45, 212, 168, 0.2)' : 'rgba(0,0,0,0.25)',
                                    border: selectedCell === cell.name ? '1px solid #05CD99' : '1px solid rgba(28, 52, 80, 0.5)',
                                    borderRadius: '6px',
                                    padding: '0.85rem 0.5rem',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: cell.color }}>
                                    {cell.count}
                                </div>
                                <div style={{ fontSize: '0.74rem', color: 'var(--text)', fontWeight: 600, marginTop: '0.2rem' }}>
                                    {cell.name}
                                </div>
                                <div style={{ fontSize: '0.65rem', color: '#5C7896', marginTop: '0.1rem' }}>
                                    {cell.perf}{readData("components.Dashboard.Views.PerformanceTalent", "content_text_54")}{cell.pot}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{
                        marginTop: '0.85rem',
                        fontSize: '0.7rem',
                        color: 'var(--text-2)',
                        display: 'flex',
                        justifyContent: 'space-between'
                    }}>
                        <span>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_55")}</span>
                        <span>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_56")}</span>
                    </div>
                </div>

                {/* Rating Distribution vs Guided Curve */}
                <div className={`${shared.card} ${shared.col4}`}>
                    <div className={shared.cardHeader}>
                        <div>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_57")}</h3>
                            <p className={shared.cardSubtitle}>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_58")}</p>
                        </div>
                    </div>
                    <NucleusChart option={ratingDistributionOption} height="280px" />
                </div>

                {/* Competency Radar */}
                <div className={`${shared.card} ${shared.col3}`}>
                    <div className={shared.cardHeader}>
                        <div>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_59")}</h3>
                            <p className={shared.cardSubtitle}>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_60")}</p>
                        </div>
                    </div>
                    <NucleusChart option={competencyRadarOption} height="280px" />
                </div>
            </div>

            {/* AI Calibration Bias Checks + Succession Table */}
            <div className={shared.grid12} style={{ marginBottom: '1.25rem' }}>
                {/* 4 AI Bias Flags */}
                <div className={`${shared.card} ${shared.col6}`}>
                    <div className={shared.cardHeader}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Sparkles size={16} color="#9B8CFF" />
                                <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_61")}</h3>
                            </div>
                            <p className={shared.cardSubtitle}>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_62")}</p>
                        </div>
                        <span className={`${shared.badge} ${shared.badgeViolet}`}>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_63")}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        {readData("components.Dashboard.Views.PerformanceTalent", "content_64").map((flag, idx) => (
                            <div key={idx} style={{
                                padding: '0.65rem 0.75rem',
                                background: 'var(--card-2)',
                                border: '1px solid rgba(155, 140, 255, 0.25)',
                                borderRadius: '6px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div>
                                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>{flag.title}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-2)', marginTop: '0.2rem' }}>{flag.text}</div>
                                </div>
                                <button className={shared.textBtn} style={{ fontSize: '0.72rem', color: '#9B8CFF', whiteSpace: 'nowrap' }}>
                                    {flag.action}{readData("components.Dashboard.Views.PerformanceTalent", "content_text_65")}</button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Succession Cover for Critical Roles Table */}
                <div className={`${shared.card} ${shared.col6}`}>
                    <div className={shared.cardHeader}>
                        <div>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_66")}</h3>
                            <p className={shared.cardSubtitle}>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_67")}</p>
                        </div>
                    </div>
                    <div className={shared.tableWrapper}>
                        <table className={shared.table}>
                            <thead>
                                <tr>
                                    <th>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_68")}</th>
                                    <th>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_69")}</th>
                                    <th>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_70")}</th>
                                    <th>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_71")}</th>
                                    <th>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_72")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><strong>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_73")}</strong></td>
                                    <td>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_74")}</td>
                                    <td>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_75")}</td>
                                    <td>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_76")}</td>
                                    <td><span className={`${shared.badge} ${shared.badgeTeal}`}>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_77")}</span></td>
                                </tr>
                                <tr>
                                    <td><strong>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_78")}</strong></td>
                                    <td>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_79")}</td>
                                    <td>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_80")}</td>
                                    <td>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_81")}</td>
                                    <td><span className={`${shared.badge} ${shared.badgeCoral}`}>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_82")}</span></td>
                                </tr>
                                <tr>
                                    <td><strong>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_83")}</strong></td>
                                    <td>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_84")}</td>
                                    <td>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_85")}</td>
                                    <td>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_86")}</td>
                                    <td><span className={`${shared.badge} ${shared.badgeAmber}`}>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_87")}</span></td>
                                </tr>
                                <tr>
                                    <td><strong>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_88")}</strong></td>
                                    <td>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_89")}</td>
                                    <td>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_90")}</td>
                                    <td>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_91")}</td>
                                    <td><span className={`${shared.badge} ${shared.badgeTeal}`}>{readData("components.Dashboard.Views.PerformanceTalent", "content_text_92")}</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
