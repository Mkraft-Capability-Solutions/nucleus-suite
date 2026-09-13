"use client";
import { readData } from '../../../services/workspace-data.mjs';

import React, { useState } from 'react';
import {
    UserPlus, Clock, DollarSign, Award, Users, Filter,
    CheckCircle2, ArrowUpRight, ArrowDownRight, ShieldCheck, Briefcase
} from 'lucide-react';
import NucleusChart from '@/components/Charts/NucleusChart';
import { NUCLEUS_COLORS } from '@/components/Charts/theme';
import shared from '../DashboardShared.module.css';

export default function TalentAcquisition({ onNavigate }) {
    const [selectedFunction, setSelectedFunction] = useState(readData("components.Dashboard.Views.TalentAcquisition", "initialState_1"));

    // 1. Hiring Funnel Stage Conversion
    const hiringStages = [
        { ...readData("components.Dashboard.Views.TalentAcquisition", "hiringStages_fields_1"), color: NUCLEUS_COLORS.teal, ...readData("components.Dashboard.Views.TalentAcquisition", "hiringStages_fields_2") },
        { ...readData("components.Dashboard.Views.TalentAcquisition", "hiringStages_fields_3"), color: NUCLEUS_COLORS.sky, ...readData("components.Dashboard.Views.TalentAcquisition", "hiringStages_fields_4") },
        { ...readData("components.Dashboard.Views.TalentAcquisition", "hiringStages_fields_5"), color: NUCLEUS_COLORS.violet, ...readData("components.Dashboard.Views.TalentAcquisition", "hiringStages_fields_6") },
        { ...readData("components.Dashboard.Views.TalentAcquisition", "hiringStages_fields_7"), color: NUCLEUS_COLORS.amber, ...readData("components.Dashboard.Views.TalentAcquisition", "hiringStages_fields_8") },
        readData("components.Dashboard.Views.TalentAcquisition", "hiringStages_9")
    ];

    const funnelOption = {
        tooltip: {
            ...readData("components.Dashboard.Views.TalentAcquisition", "tooltip_fields_10"),
            formatter: (params) => {
                const s = hiringStages.find(st => st.name === params.name) || params.data;
                return `
                    <div style="font-weight:700;margin-bottom:4px;color:${params.color || readData("components.Dashboard.Views.TalentAcquisition", "fallback_1")}">${params.name}</div>
                    <div style="font-size:11px;color:#94A3B8;">Candidates: <strong style="color:#FFF">${params.value.toLocaleString()}</strong></div>
                    <div style="font-size:11px;color:#94A3B8;">Stage Conversion: <strong style="color:#05CD99">${s.rate || readData("components.Dashboard.Views.TalentAcquisition", "fallback_2")}</strong></div>
                    ${s.drop ? `<div style="font-size:11px;color:#F43F5E;">Stage Drop: <strong>${s.drop}</strong> candidates</div>` : ''}
                `;
            }
        },
        series: [
            {
                ...readData("components.Dashboard.Views.TalentAcquisition", "series_fields_13"),
                label: {
                    ...readData("components.Dashboard.Views.TalentAcquisition", "label_fields_15"),
                    formatter: (params) => params.value >= 1000 ? `${(params.value / 1000).toFixed(1)}k` : `${params.value}`,
                    ...readData("components.Dashboard.Views.TalentAcquisition", "label_fields_16")
                },
                ...readData("components.Dashboard.Views.TalentAcquisition", "series_fields_14"),
                data: hiringStages.map(s => ({
                    value: s.value,
                    name: s.name,
                    itemStyle: { color: s.color }
                }))
            }
        ]
    };

    // 2. Offer to Joining Drop-off Waterfall
    const offerWaterfallOption = {
        tooltip: {
            ...readData("components.Dashboard.Views.TalentAcquisition", "tooltip_fields_20"),
            formatter: (params) => {
                const tar = params.find(p => p.seriesName === 'Candidates');
                if (!tar) return '';
                return `<strong>${tar.name}</strong>: ${tar.value} candidates`;
            }
        },
        xAxis: {
            ...readData("components.Dashboard.Views.TalentAcquisition", "xAxis_fields_22"),
            axisLabel: { color: NUCLEUS_COLORS.textMuted, ...readData("components.Dashboard.Views.TalentAcquisition", "axisLabel_fields_24") }
        },
        ...readData("components.Dashboard.Views.TalentAcquisition", "offerWaterfallOption_fields_19"),
        series: [
            readData("components.Dashboard.Views.TalentAcquisition", "series_26"),
            {
                ...readData("components.Dashboard.Views.TalentAcquisition", "series_fields_27"),
                data: [
                    { ...readData("components.Dashboard.Views.TalentAcquisition", "data_fields_29"), itemStyle: { color: NUCLEUS_COLORS.sky } },
                    { ...readData("components.Dashboard.Views.TalentAcquisition", "data_fields_30"), itemStyle: { color: NUCLEUS_COLORS.coral } },
                    { ...readData("components.Dashboard.Views.TalentAcquisition", "data_fields_31"), itemStyle: { color: NUCLEUS_COLORS.coral } },
                    { ...readData("components.Dashboard.Views.TalentAcquisition", "data_fields_32"), itemStyle: { color: NUCLEUS_COLORS.amber } },
                    { ...readData("components.Dashboard.Views.TalentAcquisition", "data_fields_33"), itemStyle: { color: NUCLEUS_COLORS.teal } }
                ],
                ...readData("components.Dashboard.Views.TalentAcquisition", "series_fields_28")
            }
        ]
    };

    // 3. Candidate Experience Radar
    const candidateExpRadarOption = {
        ...readData("components.Dashboard.Views.TalentAcquisition", "candidateExpRadarOption_fields_35"),
        series: [{
            ...readData("components.Dashboard.Views.TalentAcquisition", "series_fields_37"),
            data: [
                {
                    ...readData("components.Dashboard.Views.TalentAcquisition", "data_fields_38"),
                    itemStyle: { color: NUCLEUS_COLORS.teal },
                    ...readData("components.Dashboard.Views.TalentAcquisition", "data_fields_39")
                }
            ]
        }]
    };

    return (
        <div className={shared.dashboardWrapper}>
            {/* Header */}
            <div className={shared.pageHeader}>
                <div>
                    <div className={shared.badgeRow}>
                        <span className={`${shared.badge} ${shared.badgeTeal}`}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_42")}</span>
                        <span className={`${shared.badge} ${shared.badgeSky}`}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_43")}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-2)' }}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_44")}</span>
                    </div>
                    <h1 className={shared.screenTitle}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_45")}</h1>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <select
                        value={selectedFunction}
                        onChange={(e) => setSelectedFunction(e.target.value)}
                        className={shared.periodSelect}
                    >
                        <option value="All">{readData("components.Dashboard.Views.TalentAcquisition", "content_text_46")}</option>
                        <option value="Engineering">{readData("components.Dashboard.Views.TalentAcquisition", "content_text_47")}</option>
                        <option value="Sales">{readData("components.Dashboard.Views.TalentAcquisition", "content_text_48")}</option>
                        <option value="Finance">{readData("components.Dashboard.Views.TalentAcquisition", "content_text_49")}</option>
                    </select>
                    <button onClick={() => onNavigate && onNavigate('recruitment')} className={shared.primaryBtn}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_50")}</button>
                </div>
            </div>

            {/* 6 Recruitment KPIs */}
            <div className={shared.kpiGrid}>
                <div className={shared.kpiCard}>
                    <div className={shared.kpiLabel}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_51")}</div>
                    <div className={shared.kpiValue}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_52")}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--pending)' }}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_53")}</div>
                </div>
                <div className={shared.kpiCard}>
                    <div className={shared.kpiLabel}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_54")}</div>
                    <div className={shared.kpiValue}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_55")}</div>
                    <div className={`${shared.kpiDelta} ${shared.deltaPositive}`}>
                        <ArrowDownRight size={13} />{readData("components.Dashboard.Views.TalentAcquisition", "content_text_56")}</div>
                </div>
                <div className={shared.kpiCard}>
                    <div className={shared.kpiLabel}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_57")}</div>
                    <div className={shared.kpiValue}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_58")}</div>
                    <div className={`${shared.kpiDelta} ${shared.deltaNegative}`}>
                        <ArrowUpRight size={13} />{readData("components.Dashboard.Views.TalentAcquisition", "content_text_59")}</div>
                </div>
                <div className={shared.kpiCard}>
                    <div className={shared.kpiLabel}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_60")}</div>
                    <div className={shared.kpiValue}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_61")}</div>
                    <div className={`${shared.kpiDelta} ${shared.deltaPositive}`}>
                        <ArrowUpRight size={13} />{readData("components.Dashboard.Views.TalentAcquisition", "content_text_62")}</div>
                </div>
                <div className={shared.kpiCard}>
                    <div className={shared.kpiLabel}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_63")}</div>
                    <div className={shared.kpiValue}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_64")}</div>
                    <div style={{ fontSize: '0.7rem', color: '#F2647E' }}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_65")}</div>
                </div>
                <div className={shared.kpiCard}>
                    <div className={shared.kpiLabel}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_66")}</div>
                    <div className={shared.kpiValue}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_67")}</div>
                    <div style={{ fontSize: '0.7rem', color: '#9B8CFF' }}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_68")}</div>
                </div>
            </div>

            {/* Funnel + Sourcing Channels + Match Ready */}
            <div className={shared.grid12} style={{ marginBottom: '1.25rem' }}>
                <div className={`${shared.card} ${shared.col4}`} style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className={shared.cardHeader} style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_69")}</h3>
                            <p className={shared.cardSubtitle}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_70")}</p>
                        </div>
                        <span className={`${shared.pillBadge || shared.badge} ${shared.pillTeal || shared.badgeTeal}`}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_71")}</span>
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.65rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: '0.65rem', alignItems: 'center' }}>
                            <div style={{ height: 200, width: '100%' }}>
                                <NucleusChart option={funnelOption} style={{ height: 200 }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                {hiringStages.map((stage) => (
                                    <div
                                        key={stage.name}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '0.3rem 0.55rem',
                                            borderRadius: '6px',
                                            background: 'rgba(255, 255, 255, 0.03)',
                                            border: '1px solid rgba(255, 255, 255, 0.06)',
                                            fontSize: '0.72rem'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                                            <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: stage.color, flexShrink: 0 }} />
                                            <span style={{ color: 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {stage.name}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                                            <strong style={{ color: '#FFFFFF', fontSize: '0.76rem' }}>{stage.value.toLocaleString()}</strong>
                                            <span style={{ fontSize: '0.68rem', color: 'var(--text-2)' }}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_72")}{stage.rate}{readData("components.Dashboard.Views.TalentAcquisition", "content_text_73")}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.35rem 0.65rem',
                            borderRadius: '6px',
                            background: 'rgba(45, 212, 168, 0.06)',
                            border: '1px solid rgba(45, 212, 168, 0.16)',
                            fontSize: '0.72rem',
                            marginTop: 'auto'
                        }}>
                            <span style={{ color: 'var(--text-2)' }}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_74")}</span>
                            <span style={{ color: '#05CD99', fontWeight: 700 }}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_75")}</span>
                        </div>
                    </div>
                </div>

                <div className={`${shared.card} ${shared.col4}`}>
                    <div className={shared.cardHeader}>
                        <div>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_76")}</h3>
                            <p className={shared.cardSubtitle}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_77")}</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', padding: '0.5rem 0' }}>
                        {[
                            { ...readData("components.Dashboard.Views.TalentAcquisition", "content_fields_78"), color: NUCLEUS_COLORS.teal, ...readData("components.Dashboard.Views.TalentAcquisition", "content_fields_79") },
                            { ...readData("components.Dashboard.Views.TalentAcquisition", "content_fields_80"), color: NUCLEUS_COLORS.sky, ...readData("components.Dashboard.Views.TalentAcquisition", "content_fields_81") },
                            { ...readData("components.Dashboard.Views.TalentAcquisition", "content_fields_82"), color: NUCLEUS_COLORS.coral, ...readData("components.Dashboard.Views.TalentAcquisition", "content_fields_83") },
                            { ...readData("components.Dashboard.Views.TalentAcquisition", "content_fields_84"), color: NUCLEUS_COLORS.violet, ...readData("components.Dashboard.Views.TalentAcquisition", "content_fields_85") },
                            { ...readData("components.Dashboard.Views.TalentAcquisition", "content_fields_86"), color: NUCLEUS_COLORS.amber, ...readData("components.Dashboard.Views.TalentAcquisition", "content_fields_87") }
                        ].map((src, idx) => (
                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                                    <span style={{ color: 'var(--text)', fontWeight: 600 }}>{src.name}</span>
                                    <span style={{ color: 'var(--text-2)' }}>{src.hires}{readData("components.Dashboard.Views.TalentAcquisition", "content_text_88")}{src.cost}</span>
                                </div>
                                <div style={{ height: 6, background: '#14263D', borderRadius: 3, overflow: 'hidden' }}>
                                    <div style={{ width: `${src.pct}%`, height: '100%', background: src.color }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className={`${shared.card} ${shared.col4}`}>
                    <div className={shared.cardHeader}>
                        <div>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_89")}</h3>
                            <p className={shared.cardSubtitle}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_90")}</p>
                        </div>
                        <span className={`${shared.badge} ${shared.badgeViolet}`}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_91")}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                        {readData("components.Dashboard.Views.TalentAcquisition", "content_92").map((c, i) => (
                            <div key={i} style={{
                                padding: '0.5rem 0.65rem',
                                background: 'var(--card-2)',
                                border: '1px solid rgba(28, 52, 80, 0.45)',
                                borderRadius: '6px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div>
                                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>{c.name}</div>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-2)' }}>{c.role}{readData("components.Dashboard.Views.TalentAcquisition", "content_text_93")}{c.match}</div>
                                </div>
                                <div style={{
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    color: '#9B8CFF',
                                    background: 'rgba(155, 140, 255, 0.12)',
                                    padding: '0.15rem 0.4rem',
                                    borderRadius: '4px'
                                }}>
                                    {c.score}{readData("components.Dashboard.Views.TalentAcquisition", "content_text_94")}</div>
                            </div>
                        ))}
                    </div>
                    <div style={{
                        marginTop: '0.75rem',
                        fontSize: '0.68rem',
                        color: '#5C7896',
                        lineHeight: 1.3,
                        borderTop: '1px solid #1C3450',
                        paddingTop: '0.5rem'
                    }}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_95")}<em>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_96")}</em>
                    </div>
                </div>
            </div>

            {/* Aged Requisitions Table (The Blocker Column is the Product) */}
            <div className={shared.card} style={{ marginBottom: '1.25rem' }}>
                <div className={shared.cardHeader}>
                    <div>
                        <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_97")}</h3>
                        <p className={shared.cardSubtitle}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_98")}</p>
                    </div>
                    <span className={`${shared.badge} ${shared.badgeCoral}`}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_99")}</span>
                </div>
                <div className={shared.tableWrapper}>
                    <table className={shared.table}>
                        <thead>
                            <tr>
                                <th>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_100")}</th>
                                <th>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_101")}</th>
                                <th>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_102")}</th>
                                <th>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_103")}</th>
                                <th>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_104")}</th>
                                <th>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_105")}</th>
                                <th>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_106")}</th>
                                <th>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_107")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><strong>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_108")}</strong></td>
                                <td>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_109")}</td>
                                <td>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_110")}</td>
                                <td><span style={{ color: '#F2647E', fontWeight: 700 }}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_111")}</span></td>
                                <td>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_112")}</td>
                                <td>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_113")}</td>
                                <td>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_114")}</td>
                                <td><span className={`${shared.badge} ${shared.badgeCoral}`}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_115")}</span></td>
                            </tr>
                            <tr>
                                <td><strong>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_116")}</strong></td>
                                <td>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_117")}</td>
                                <td>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_118")}</td>
                                <td><span style={{ color: '#F2647E', fontWeight: 700 }}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_119")}</span></td>
                                <td>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_120")}</td>
                                <td>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_121")}</td>
                                <td>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_122")}</td>
                                <td><span className={`${shared.badge} ${shared.badgeCoral}`}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_123")}</span></td>
                            </tr>
                            <tr>
                                <td><strong>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_124")}</strong></td>
                                <td>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_125")}</td>
                                <td>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_126")}</td>
                                <td><span style={{ color: 'var(--pending)', fontWeight: 700 }}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_127")}</span></td>
                                <td>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_128")}</td>
                                <td>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_129")}</td>
                                <td>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_130")}</td>
                                <td><span className={`${shared.badge} ${shared.badgeAmber}`}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_131")}</span></td>
                            </tr>
                            <tr>
                                <td><strong>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_132")}</strong></td>
                                <td>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_133")}</td>
                                <td>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_134")}</td>
                                <td>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_135")}</td>
                                <td>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_136")}</td>
                                <td>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_137")}</td>
                                <td>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_138")}</td>
                                <td><span className={`${shared.badge} ${shared.badgeTeal}`}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_139")}</span></td>
                            </tr>
                            <tr>
                                <td><strong>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_140")}</strong></td>
                                <td>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_141")}</td>
                                <td>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_142")}</td>
                                <td>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_143")}</td>
                                <td>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_144")}</td>
                                <td>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_145")}</td>
                                <td>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_146")}</td>
                                <td><span className={`${shared.badge} ${shared.badgeTeal}`}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_147")}</span></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Bottom Grid: Offer Leakage Waterfall + Candidate Experience Radar */}
            <div className={shared.grid12}>
                <div className={`${shared.card} ${shared.col7}`}>
                    <div className={shared.cardHeader}>
                        <div>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_148")}</h3>
                            <p className={shared.cardSubtitle}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_149")}</p>
                        </div>
                    </div>
                    <NucleusChart option={offerWaterfallOption} height="260px" />
                </div>

                <div className={`${shared.card} ${shared.col5}`}>
                    <div className={shared.cardHeader}>
                        <div>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_150")}</h3>
                            <p className={shared.cardSubtitle}>{readData("components.Dashboard.Views.TalentAcquisition", "content_text_151")}</p>
                        </div>
                    </div>
                    <NucleusChart option={candidateExpRadarOption} height="260px" />
                </div>
            </div>
        </div>
    );
}
