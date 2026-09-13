"use client";
import { readData } from '../../../services/workspace-data.mjs';

import React, { useState } from 'react';
import {
    BookOpen, Sparkles, Award, TrendingUp, CheckCircle2,
    ArrowUpRight, Users, ShieldCheck, Layers, FileText
} from 'lucide-react';
import NucleusChart from '@/components/Charts/NucleusChart';
import { NUCLEUS_COLORS } from '@/components/Charts/theme';
import shared from '../DashboardShared.module.css';

export default function MagnetixCapability({ onNavigate }) {
    const [selectedSkillFamily, setSelectedSkillFamily] = useState(readData("components.Dashboard.Views.MagnetixCapability", "initialState_1"));

    // 1. Capability Movement Radar (Baseline vs Post-Programme)
    const capabilityMovementOption = {
        legend: {
            ...readData("components.Dashboard.Views.MagnetixCapability", "legend_fields_2"),
            textStyle: { color: NUCLEUS_COLORS.textMuted, ...readData("components.Dashboard.Views.MagnetixCapability", "textStyle_fields_4") }
        },
        ...readData("components.Dashboard.Views.MagnetixCapability", "capabilityMovementOption_fields_1"),
        series: [{
            ...readData("components.Dashboard.Views.MagnetixCapability", "series_fields_6"),
            data: [
                {
                    ...readData("components.Dashboard.Views.MagnetixCapability", "data_fields_7"),
                    itemStyle: { color: NUCLEUS_COLORS.sky },
                    ...readData("components.Dashboard.Views.MagnetixCapability", "data_fields_8")
                },
                {
                    ...readData("components.Dashboard.Views.MagnetixCapability", "data_fields_11"),
                    itemStyle: { color: NUCLEUS_COLORS.teal },
                    ...readData("components.Dashboard.Views.MagnetixCapability", "data_fields_12")
                }
            ]
        }]
    };

    // 2. Programme Conversion Funnel
    const ldStages = [
        { ...readData("components.Dashboard.Views.MagnetixCapability", "ldStages_fields_15"), color: NUCLEUS_COLORS.sky, ...readData("components.Dashboard.Views.MagnetixCapability", "ldStages_fields_16") },
        { ...readData("components.Dashboard.Views.MagnetixCapability", "ldStages_fields_17"), color: NUCLEUS_COLORS.teal, ...readData("components.Dashboard.Views.MagnetixCapability", "ldStages_fields_18") },
        { ...readData("components.Dashboard.Views.MagnetixCapability", "ldStages_fields_19"), color: NUCLEUS_COLORS.violet, ...readData("components.Dashboard.Views.MagnetixCapability", "ldStages_fields_20") },
        { ...readData("components.Dashboard.Views.MagnetixCapability", "ldStages_fields_21"), color: NUCLEUS_COLORS.amber, ...readData("components.Dashboard.Views.MagnetixCapability", "ldStages_fields_22") },
        readData("components.Dashboard.Views.MagnetixCapability", "ldStages_23")
    ];

    const programmeFunnelOption = {
        tooltip: {
            ...readData("components.Dashboard.Views.MagnetixCapability", "tooltip_fields_24"),
            formatter: (params) => {
                const s = ldStages.find(st => st.name === params.name) || params.data;
                return `
                    <div style="font-weight:700;margin-bottom:4px;color:${params.color || readData("components.Dashboard.Views.MagnetixCapability", "fallback_1")}">${params.name}</div>
                    <div style="font-size:11px;color:#94A3B8;">Learners: <strong style="color:#FFF">${params.value.toLocaleString()}</strong></div>
                    <div style="font-size:11px;color:#94A3B8;">Stage Conversion: <strong style="color:#05CD99">${s.rate || readData("components.Dashboard.Views.MagnetixCapability", "fallback_2")}</strong></div>
                    ${s.drop ? `<div style="font-size:11px;color:#F43F5E;">Stage Drop: <strong>${s.drop}</strong> learners</div>` : ''}
                `;
            }
        },
        series: [
            {
                ...readData("components.Dashboard.Views.MagnetixCapability", "series_fields_27"),
                label: {
                    ...readData("components.Dashboard.Views.MagnetixCapability", "label_fields_29"),
                    formatter: (params) => params.value >= 1000 ? `${(params.value / 1000).toFixed(1)}k` : `${params.value}`,
                    ...readData("components.Dashboard.Views.MagnetixCapability", "label_fields_30")
                },
                ...readData("components.Dashboard.Views.MagnetixCapability", "series_fields_28"),
                data: ldStages.map(s => ({
                    value: s.value,
                    name: s.name,
                    itemStyle: { color: s.color }
                }))
            }
        ]
    };

    // 3. Learning Hours by Function (Horizontal Bar)
    const learningHoursOption = {
        ...readData("components.Dashboard.Views.MagnetixCapability", "learningHoursOption_fields_33"),
        yAxis: {
            ...readData("components.Dashboard.Views.MagnetixCapability", "yAxis_fields_37"),
            axisLabel: { color: NUCLEUS_COLORS.textMuted, ...readData("components.Dashboard.Views.MagnetixCapability", "axisLabel_fields_39") }
        },
        series: [{
            ...readData("components.Dashboard.Views.MagnetixCapability", "series_fields_40"),
            data: [
                { ...readData("components.Dashboard.Views.MagnetixCapability", "data_fields_42"), itemStyle: { color: NUCLEUS_COLORS.teal } },
                { ...readData("components.Dashboard.Views.MagnetixCapability", "data_fields_43"), itemStyle: { color: NUCLEUS_COLORS.sky } },
                { ...readData("components.Dashboard.Views.MagnetixCapability", "data_fields_44"), itemStyle: { color: NUCLEUS_COLORS.violet } },
                { ...readData("components.Dashboard.Views.MagnetixCapability", "data_fields_45"), itemStyle: { color: NUCLEUS_COLORS.amber } },
                readData("components.Dashboard.Views.MagnetixCapability", "data_46")
            ],
            ...readData("components.Dashboard.Views.MagnetixCapability", "series_fields_41")
        }]
    };

    return (
        <div className={shared.dashboardWrapper}>
            {/* Header */}
            <div className={shared.pageHeader}>
                <div>
                    <div className={shared.badgeRow}>
                        <span className={`${shared.badge} ${shared.badgeTeal}`}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_48")}</span>
                        <span className={`${shared.badge} ${shared.badgeSky}`}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_49")}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-2)' }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_50")}</span>
                    </div>
                    <h1 className={shared.screenTitle}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_51")}</h1>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button onClick={() => onNavigate && onNavigate('learning')} className={shared.primaryBtn}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_52")}</button>
                </div>
            </div>

            {/* 4 Capability KPIs */}
            <div className={shared.kpiGrid}>
                <div className={shared.kpiCard}>
                    <div className={shared.kpiLabel}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_53")}</div>
                    <div className={shared.kpiValue}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_54")}</div>
                    <div className={`${shared.kpiDelta} ${shared.deltaPositive}`}>
                        <ArrowUpRight size={13} />{readData("components.Dashboard.Views.MagnetixCapability", "content_text_55")}</div>
                </div>
                <div className={shared.kpiCard}>
                    <div className={shared.kpiLabel}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_56")}</div>
                    <div className={shared.kpiValue}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_57")}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--pending)' }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_58")}</div>
                </div>
                <div className={shared.kpiCard}>
                    <div className={shared.kpiLabel}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_59")}</div>
                    <div className={shared.kpiValue}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_60")}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text)' }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_61")}</div>
                </div>
                <div className={shared.kpiCard}>
                    <div className={shared.kpiLabel}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_62")}</div>
                    <div className={shared.kpiValue}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_63")}</div>
                    <div style={{ fontSize: '0.7rem', color: '#05CD99' }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_64")}</div>
                </div>
            </div>

            {/* Skill Coverage Matrix by Function */}
            <div className={shared.card} style={{ marginBottom: '1.25rem' }}>
                <div className={shared.cardHeader}>
                    <div>
                        <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_65")}</h3>
                        <p className={shared.cardSubtitle}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_66")}</p>
                    </div>
                    <span className={`${shared.badge} ${shared.badgeTeal}`}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_67")}</span>
                </div>
                <div className={shared.tableWrapper}>
                    <table className={shared.table}>
                        <thead>
                            <tr>
                                <th>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_68")}</th>
                                <th>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_69")}</th>
                                <th>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_70")}</th>
                                <th>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_71")}</th>
                                <th>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_72")}</th>
                                <th>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_73")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><strong>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_74")}</strong></td>
                                <td><span style={{ color: '#05CD99', fontWeight: 700 }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_75")}</span></td>
                                <td><span style={{ color: 'var(--pending)', fontWeight: 700 }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_76")}</span></td>
                                <td><span style={{ color: '#05CD99', fontWeight: 700 }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_77")}</span></td>
                                <td><span style={{ color: '#F2647E', fontWeight: 700 }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_78")}</span></td>
                                <td><span style={{ color: '#F2647E', fontWeight: 700 }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_79")}</span></td>
                            </tr>
                            <tr>
                                <td><strong>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_80")}</strong></td>
                                <td><span style={{ color: 'var(--pending)', fontWeight: 700 }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_81")}</span></td>
                                <td><span style={{ color: '#05CD99', fontWeight: 700 }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_82")}</span></td>
                                <td><span style={{ color: '#05CD99', fontWeight: 700 }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_83")}</span></td>
                                <td><span style={{ color: '#F2647E', fontWeight: 700 }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_84")}</span></td>
                                <td><span style={{ color: '#F2647E', fontWeight: 700 }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_85")}</span></td>
                            </tr>
                            <tr>
                                <td><strong>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_86")}</strong></td>
                                <td><span style={{ color: '#05CD99', fontWeight: 700 }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_87")}</span></td>
                                <td><span style={{ color: '#F2647E', fontWeight: 700 }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_88")}</span></td>
                                <td><span style={{ color: '#F2647E', fontWeight: 700 }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_89")}</span></td>
                                <td><span style={{ color: '#05CD99', fontWeight: 700 }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_90")}</span></td>
                                <td><span style={{ color: 'var(--pending)', fontWeight: 700 }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_91")}</span></td>
                            </tr>
                            <tr>
                                <td><strong>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_92")}</strong></td>
                                <td><span style={{ color: 'var(--pending)', fontWeight: 700 }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_93")}</span></td>
                                <td><span style={{ color: 'var(--pending)', fontWeight: 700 }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_94")}</span></td>
                                <td><span style={{ color: '#F2647E', fontWeight: 700 }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_95")}</span></td>
                                <td><span style={{ color: 'var(--pending)', fontWeight: 700 }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_96")}</span></td>
                                <td><span style={{ color: '#F2647E', fontWeight: 700 }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_97")}</span></td>
                            </tr>
                            <tr>
                                <td><strong>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_98")}</strong></td>
                                <td><span style={{ color: '#05CD99', fontWeight: 700 }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_99")}</span></td>
                                <td><span style={{ color: 'var(--pending)', fontWeight: 700 }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_100")}</span></td>
                                <td><span style={{ color: '#F2647E', fontWeight: 700 }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_101")}</span></td>
                                <td><span style={{ color: '#F2647E', fontWeight: 700 }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_102")}</span></td>
                                <td><span style={{ color: 'var(--pending)', fontWeight: 700 }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_103")}</span></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Radar + Funnel + Hours */}
            <div className={shared.grid12} style={{ marginBottom: '1.25rem' }}>
                <div className={`${shared.card} ${shared.col4}`}>
                    <div className={shared.cardHeader}>
                        <div>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_104")}</h3>
                            <p className={shared.cardSubtitle}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_105")}</p>
                        </div>
                    </div>
                    <NucleusChart option={capabilityMovementOption} height="280px" />
                </div>

                <div className={`${shared.card} ${shared.col4}`} style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className={shared.cardHeader} style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_106")}</h3>
                            <p className={shared.cardSubtitle}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_107")}</p>
                        </div>
                        <span className={`${shared.pillBadge || shared.badge} ${shared.pillTeal || shared.badgeTeal}`}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_108")}</span>
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.65rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: '0.65rem', alignItems: 'center' }}>
                            <div style={{ height: 200, width: '100%' }}>
                                <NucleusChart option={programmeFunnelOption} style={{ height: 200 }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                {ldStages.map((stage) => (
                                    <div
                                        key={stage.name}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '0.3rem 0.55rem',
                                            borderRadius: '6px',
                                            background: 'var(--card-2)',
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
                                            <span style={{ fontSize: '0.68rem', color: 'var(--text-2)' }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_109")}{stage.rate}{readData("components.Dashboard.Views.MagnetixCapability", "content_text_110")}</span>
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
                            <span style={{ color: 'var(--text-2)' }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_111")}</span>
                            <span style={{ color: '#05CD99', fontWeight: 700 }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_112")}</span>
                        </div>
                    </div>
                </div>

                <div className={`${shared.card} ${shared.col4}`}>
                    <div className={shared.cardHeader}>
                        <div>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_113")}</h3>
                            <p className={shared.cardSubtitle}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_114")}</p>
                        </div>
                    </div>
                    <NucleusChart option={learningHoursOption} height="280px" />
                </div>
            </div>

            {/* Gap to Path Generator + Does Learning Show Up in the Work Table */}
            <div className={shared.grid12}>
                {/* Gap to Path AI Callout */}
                <div className={`${shared.card} ${shared.col5}`}>
                    <div className={shared.cardHeader}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Sparkles size={16} color="#9B8CFF" />
                                <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_115")}</h3>
                            </div>
                            <p className={shared.cardSubtitle}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_116")}</p>
                        </div>
                        <span className={`${shared.badge} ${shared.badgeViolet}`}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_117")}</span>
                    </div>
                    <div style={{
                        padding: '1rem',
                        background: 'rgba(155, 140, 255, 0.08)',
                        border: '1px solid rgba(155, 140, 255, 0.3)',
                        borderRadius: '8px'
                    }}>
                        <h4 style={{ fontSize: '0.85rem', color: 'var(--text)', margin: '0 0 0.5rem' }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_118")}</h4>
                        <p style={{ fontSize: '0.74rem', color: 'var(--text-2)', lineHeight: 1.5, margin: 0 }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_119")}<strong>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_120")}</strong>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_121")}</p>
                        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                            <button className={shared.primaryBtn} style={{ fontSize: '0.74rem' }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_122")}</button>
                            <button className={shared.secondaryBtn} style={{ fontSize: '0.74rem' }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_123")}</button>
                        </div>
                    </div>
                </div>

                {/* Does Learning Show Up in the Work? (Real Business Signals) */}
                <div className={`${shared.card} ${shared.col7}`}>
                    <div className={shared.cardHeader}>
                        <div>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_124")}</h3>
                            <p className={shared.cardSubtitle}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_125")}</p>
                        </div>
                        <span className={`${shared.badge} ${shared.badgeTeal}`}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_126")}</span>
                    </div>
                    <div className={shared.tableWrapper}>
                        <table className={shared.table}>
                            <thead>
                                <tr>
                                    <th>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_127")}</th>
                                    <th>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_128")}</th>
                                    <th>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_129")}</th>
                                    <th>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_130")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><strong>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_131")}</strong></td>
                                    <td>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_132")}</td>
                                    <td>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_133")}</td>
                                    <td><span style={{ color: '#05CD99', fontWeight: 600 }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_134")}</span></td>
                                </tr>
                                <tr>
                                    <td><strong>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_135")}</strong></td>
                                    <td>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_136")}</td>
                                    <td>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_137")}</td>
                                    <td><span style={{ color: '#05CD99', fontWeight: 600 }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_138")}</span></td>
                                </tr>
                                <tr>
                                    <td><strong>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_139")}</strong></td>
                                    <td>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_140")}</td>
                                    <td>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_141")}</td>
                                    <td><span style={{ color: '#05CD99', fontWeight: 600 }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_142")}</span></td>
                                </tr>
                                <tr>
                                    <td><strong>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_143")}</strong></td>
                                    <td>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_144")}</td>
                                    <td>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_145")}</td>
                                    <td><span style={{ color: '#5C7896', fontStyle: 'italic' }}>{readData("components.Dashboard.Views.MagnetixCapability", "content_text_146")}</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
