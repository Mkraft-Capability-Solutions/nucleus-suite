"use client";
import { readData } from '../../../services/workspace-data.mjs';

import React, { useState } from 'react';
import {
    Sparkles, ArrowUpRight, ArrowDownRight, Share2, Bookmark,
    TrendingUp, Users, DollarSign, Award, Heart, Layers, ExternalLink,
    Clock, UserPlus, UserMinus, Filter, ChevronDown, ArrowRight, MoreHorizontal
} from 'lucide-react';
import NucleusChart from '@/components/Charts/NucleusChart';
import { NUCLEUS_COLORS } from '@/components/Charts/theme';
import shared from '../DashboardShared.module.css';

export default function PeopleCommandCentre({ onNavigate }) {
    const [selectedPeriod, setSelectedPeriod] = useState(readData("components.Dashboard.Views.PeopleCommandCentre", "initialState_1"));
    const [showEvidenceModal, setShowEvidenceModal] = useState(false);

    // 1. Org Health Index Radar (Q2 vs Q1)
    const orgHealthRadarOption = {
        legend: {
            ...readData("components.Dashboard.Views.PeopleCommandCentre", "legend_fields_2"),
            textStyle: { color: NUCLEUS_COLORS.textMuted, ...readData("components.Dashboard.Views.PeopleCommandCentre", "textStyle_fields_4") }
        },
        ...readData("components.Dashboard.Views.PeopleCommandCentre", "orgHealthRadarOption_fields_1"),
        series: [{
            ...readData("components.Dashboard.Views.PeopleCommandCentre", "series_fields_6"),
            data: [
                {
                    ...readData("components.Dashboard.Views.PeopleCommandCentre", "data_fields_7"),
                    itemStyle: { color: NUCLEUS_COLORS.teal },
                    ...readData("components.Dashboard.Views.PeopleCommandCentre", "data_fields_8")
                },
                {
                    ...readData("components.Dashboard.Views.PeopleCommandCentre", "data_fields_11"),
                    itemStyle: { color: NUCLEUS_COLORS.sky },
                    ...readData("components.Dashboard.Views.PeopleCommandCentre", "data_fields_12")
                }
            ]
        }]
    };

    // 2. Headcount Actual & Forecast with 80% Violet Prediction Band
    const headcountForecastOption = {
        tooltip: {
            ...readData("components.Dashboard.Views.PeopleCommandCentre", "tooltip_fields_17"),
            formatter: (params) => {
                let res = `<strong>${params[0].axisValue}</strong><br/>`;
                params.forEach(p => {
                    res += `${p.marker} ${p.seriesName}: <strong>${p.value}</strong><br/>`;
                });
                return res;
            }
        },
        legend: {
            ...readData("components.Dashboard.Views.PeopleCommandCentre", "legend_fields_18"),
            textStyle: { color: NUCLEUS_COLORS.textMuted, ...readData("components.Dashboard.Views.PeopleCommandCentre", "textStyle_fields_20") }
        },
        ...readData("components.Dashboard.Views.PeopleCommandCentre", "headcountForecastOption_fields_16"),
        yAxis: {
            ...readData("components.Dashboard.Views.PeopleCommandCentre", "yAxis_fields_22"),
            splitLine: { lineStyle: { color: NUCLEUS_COLORS.lineMuted, ...readData("components.Dashboard.Views.PeopleCommandCentre", "lineStyle_fields_23") } }
        },
        series: [
            {
                ...readData("components.Dashboard.Views.PeopleCommandCentre", "series_fields_24"),
                itemStyle: { color: NUCLEUS_COLORS.teal },
                ...readData("components.Dashboard.Views.PeopleCommandCentre", "series_fields_25")
            },
            {
                ...readData("components.Dashboard.Views.PeopleCommandCentre", "series_fields_28"),
                itemStyle: { color: NUCLEUS_COLORS.sky },
                ...readData("components.Dashboard.Views.PeopleCommandCentre", "series_fields_29")
            },
            {
                ...readData("components.Dashboard.Views.PeopleCommandCentre", "series_fields_32"),
                itemStyle: { color: NUCLEUS_COLORS.violet },
                lineStyle: { ...readData("components.Dashboard.Views.PeopleCommandCentre", "lineStyle_fields_35"), color: NUCLEUS_COLORS.violet },
                ...readData("components.Dashboard.Views.PeopleCommandCentre", "series_fields_33")
            }
        ]
    };

    // 3. Talent Flow Sankey (12 Months)
    const talentFlowOption = {
        ...readData("components.Dashboard.Views.PeopleCommandCentre", "talentFlowOption_fields_37"),
        series: [{
            ...readData("components.Dashboard.Views.PeopleCommandCentre", "series_fields_39"),
            data: [
                { ...readData("components.Dashboard.Views.PeopleCommandCentre", "data_fields_42"), itemStyle: { color: NUCLEUS_COLORS.teal } },
                { ...readData("components.Dashboard.Views.PeopleCommandCentre", "data_fields_43"), itemStyle: { color: NUCLEUS_COLORS.sky } },
                { ...readData("components.Dashboard.Views.PeopleCommandCentre", "data_fields_44"), itemStyle: { color: NUCLEUS_COLORS.amber } },
                readData("components.Dashboard.Views.PeopleCommandCentre", "data_45"),
                { ...readData("components.Dashboard.Views.PeopleCommandCentre", "data_fields_46"), itemStyle: { color: NUCLEUS_COLORS.coral } },
                { ...readData("components.Dashboard.Views.PeopleCommandCentre", "data_fields_47"), itemStyle: { color: NUCLEUS_COLORS.amber } },
                { ...readData("components.Dashboard.Views.PeopleCommandCentre", "data_fields_48"), itemStyle: { color: NUCLEUS_COLORS.slate } }
            ],
            ...readData("components.Dashboard.Views.PeopleCommandCentre", "series_fields_40"),
            label: {
                color: NUCLEUS_COLORS.textPrimary,
                ...readData("components.Dashboard.Views.PeopleCommandCentre", "label_fields_51")
            }
        }]
    };

    // 4. Attrition by Function (Horizontal Bar, Sorted Descending)
    const attritionByFunctionOption = {
        ...readData("components.Dashboard.Views.PeopleCommandCentre", "attritionByFunctionOption_fields_52"),
        yAxis: {
            ...readData("components.Dashboard.Views.PeopleCommandCentre", "yAxis_fields_56"),
            axisLabel: { color: NUCLEUS_COLORS.textPrimary, ...readData("components.Dashboard.Views.PeopleCommandCentre", "axisLabel_fields_58") }
        },
        series: [{
            ...readData("components.Dashboard.Views.PeopleCommandCentre", "series_fields_59"),
            data: [
                { ...readData("components.Dashboard.Views.PeopleCommandCentre", "data_fields_61"), itemStyle: { color: NUCLEUS_COLORS.teal } },
                { ...readData("components.Dashboard.Views.PeopleCommandCentre", "data_fields_62"), itemStyle: { color: NUCLEUS_COLORS.teal } },
                { ...readData("components.Dashboard.Views.PeopleCommandCentre", "data_fields_63"), itemStyle: { color: NUCLEUS_COLORS.amber } },
                { ...readData("components.Dashboard.Views.PeopleCommandCentre", "data_fields_64"), itemStyle: { color: NUCLEUS_COLORS.amber } },
                { ...readData("components.Dashboard.Views.PeopleCommandCentre", "data_fields_65"), itemStyle: { color: NUCLEUS_COLORS.coral } },
                { ...readData("components.Dashboard.Views.PeopleCommandCentre", "data_fields_66"), itemStyle: { color: NUCLEUS_COLORS.coral } }
            ],
            label: {
                ...readData("components.Dashboard.Views.PeopleCommandCentre", "label_fields_67"),
                color: NUCLEUS_COLORS.textPrimary,
                ...readData("components.Dashboard.Views.PeopleCommandCentre", "label_fields_68")
            },
            ...readData("components.Dashboard.Views.PeopleCommandCentre", "series_fields_60")
        }]
    };

    // 5. Pay Position vs Performance (3-Variable Bubble: Compa-Ratio x Performance x Headcount)
    const payVsPerformanceOption = {
        tooltip: {
            formatter: (params) => {
                const data = params.value;
                return `<strong>${data[3]}</strong><br/>Compa-Ratio: ${data[0]}%<br/>Performance Score: ${data[1]}/5.0<br/>Headcount: ${data[2]}`;
            }
        },
        ...readData("components.Dashboard.Views.PeopleCommandCentre", "payVsPerformanceOption_fields_69"),
        xAxis: {
            ...readData("components.Dashboard.Views.PeopleCommandCentre", "xAxis_fields_71"),
            splitLine: { lineStyle: { color: NUCLEUS_COLORS.lineMuted } }
        },
        yAxis: {
            ...readData("components.Dashboard.Views.PeopleCommandCentre", "yAxis_fields_73"),
            splitLine: { lineStyle: { color: NUCLEUS_COLORS.lineMuted } }
        },
        series: [{
            ...readData("components.Dashboard.Views.PeopleCommandCentre", "series_fields_74"),
            symbolSize: (val) => Math.sqrt(val[2]) * 3.2,
            data: [
                [94, 4.3, 412, 'Engineering', NUCLEUS_COLORS.teal],
                [102, 3.8, 214, 'Sales', NUCLEUS_COLORS.sky],
                [88, 3.6, 268, 'Support', NUCLEUS_COLORS.coral],
                [112, 4.1, 104, 'Finance', NUCLEUS_COLORS.amber],
                [96, 3.9, 198, 'Operations', NUCLEUS_COLORS.violet]
            ],
            itemStyle: {
                color: (p) => p.value[4],
                ...readData("components.Dashboard.Views.PeopleCommandCentre", "itemStyle_fields_75")
            },
            label: {
                ...readData("components.Dashboard.Views.PeopleCommandCentre", "label_fields_76"),
                formatter: (p) => p.value[3],
                ...readData("components.Dashboard.Views.PeopleCommandCentre", "label_fields_77"),
                color: NUCLEUS_COLORS.textPrimary,
                ...readData("components.Dashboard.Views.PeopleCommandCentre", "label_fields_78")
            }
        }]
    };

    // 6. Attrition Heatmap: Function x Location
    const locations = readData("components.Dashboard.Views.PeopleCommandCentre", "locations_79");
    const functions = readData("components.Dashboard.Views.PeopleCommandCentre", "functions_80");
    const heatData = readData("components.Dashboard.Views.PeopleCommandCentre", "heatData_81");

    const attritionHeatmapOption = {
        tooltip: {
            ...readData("components.Dashboard.Views.PeopleCommandCentre", "tooltip_fields_83"),
            formatter: (p) => `${functions[p.value[1]]} at ${locations[p.value[0]]}: <strong>${p.value[2]}%</strong> attrition`
        },
        ...readData("components.Dashboard.Views.PeopleCommandCentre", "attritionHeatmapOption_fields_82"),
        xAxis: {
            ...readData("components.Dashboard.Views.PeopleCommandCentre", "xAxis_fields_85"),
            data: locations,
            axisLabel: { color: NUCLEUS_COLORS.textMuted, ...readData("components.Dashboard.Views.PeopleCommandCentre", "axisLabel_fields_87") },
            ...readData("components.Dashboard.Views.PeopleCommandCentre", "xAxis_fields_86")
        },
        yAxis: {
            ...readData("components.Dashboard.Views.PeopleCommandCentre", "yAxis_fields_89"),
            data: functions,
            axisLabel: { color: NUCLEUS_COLORS.textPrimary, ...readData("components.Dashboard.Views.PeopleCommandCentre", "axisLabel_fields_91") },
            ...readData("components.Dashboard.Views.PeopleCommandCentre", "yAxis_fields_90")
        },
        visualMap: {
            ...readData("components.Dashboard.Views.PeopleCommandCentre", "visualMap_fields_93"),
            textStyle: { color: NUCLEUS_COLORS.textMuted, ...readData("components.Dashboard.Views.PeopleCommandCentre", "textStyle_fields_95") }
        },
        series: [{
            ...readData("components.Dashboard.Views.PeopleCommandCentre", "series_fields_96"),
            data: heatData,
            label: {
                ...readData("components.Dashboard.Views.PeopleCommandCentre", "label_fields_97"),
                formatter: (p) => `${p.value[2]}%`,
                ...readData("components.Dashboard.Views.PeopleCommandCentre", "label_fields_98")
            }
        }]
    };

    return (
        <div className={shared.dashboardCanvas}>
            {/* 4 Executive KPI Tiles matching screenshot layout */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '12px',
                width: '100%'
            }}>
                {/* 1. Headcount */}
                <div className={shared.kpiTile}>
                    <div className={shared.kpiTopRow}>
                        <div className={shared.kpiIconSquircle}>
                            <Users size={18} />
                        </div>
                        <span className={`${shared.kpiDelta} ${shared.deltaPositive}`}>
                            <ArrowUpRight size={13} />{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_99")}</span>
                    </div>
                    <div className={shared.kpiValueRow}>
                        <span className={shared.kpiValue}>{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_100")}</span>
                    </div>
                    <span className={shared.kpiLabel}>{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_101")}</span>
                </div>

                {/* 2. Attrition */}
                <div className={shared.kpiTile}>
                    <div className={shared.kpiTopRow}>
                        <div className={`${shared.kpiIconSquircle} ${shared.kpiIconSky}`}>
                            <UserMinus size={18} />
                        </div>
                        <span className={`${shared.kpiDelta} ${shared.deltaRisk}`}>
                            <ArrowDownRight size={13} />{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_102")}</span>
                    </div>
                    <div className={shared.kpiValueRow}>
                        <span className={shared.kpiValue}>{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_103")}<span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-2, #94A3B8)', marginLeft: 2 }}>{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_104")}</span>
                        </span>
                    </div>
                    <span className={shared.kpiLabel}>{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_105")}</span>
                </div>

                {/* 3. Attendance */}
                <div className={shared.kpiTile}>
                    <div className={shared.kpiTopRow}>
                        <div className={shared.kpiIconSquircle}>
                            <Clock size={18} />
                        </div>
                        <span className={`${shared.kpiDelta} ${shared.deltaPositive}`}>
                            <ArrowUpRight size={13} />{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_106")}</span>
                    </div>
                    <div className={shared.kpiValueRow}>
                        <span className={shared.kpiValue}>{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_107")}<span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-2, #94A3B8)', marginLeft: 2 }}>{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_108")}</span>
                        </span>
                    </div>
                    <span className={shared.kpiLabel}>{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_109")}</span>
                </div>

                {/* 4. New Hires */}
                <div className={shared.kpiTile}>
                    <div className={shared.kpiTopRow}>
                        <div className={`${shared.kpiIconSquircle} ${shared.kpiIconSky}`}>
                            <UserPlus size={18} />
                        </div>
                        <span className={`${shared.kpiDelta} ${shared.deltaPositive}`}>
                            <ArrowUpRight size={13} />{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_110")}</span>
                    </div>
                    <div className={shared.kpiValueRow}>
                        <span className={shared.kpiValue}>{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_111")}</span>
                    </div>
                    <span className={shared.kpiLabel}>{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_112")}</span>
                </div>
            </div>

            {/* P1 AI Narrative Signal Card: Nucleus AI Insight */}
            <div className={shared.aiNarrativeCard}>
                <div className={shared.narrativeHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <span className={shared.narrativeBadge}>{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_113")}</span>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#9B8CFF', display: 'inline-block' }} />
                    </div>
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1.25rem',
                    flexWrap: 'wrap'
                }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flex: 1, minWidth: '280px' }}>
                        <div className={shared.kpiIconSquircle} style={{
                            background: 'rgba(155, 140, 255, 0.15)',
                            borderColor: 'rgba(155, 140, 255, 0.3)',
                            color: '#C4B5FD',
                            width: 42,
                            height: 42,
                            flexShrink: 0
                        }}>
                            <Sparkles size={20} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <div style={{
                                fontSize: '0.94rem',
                                fontWeight: 600,
                                color: 'var(--text, #F1F5F9)',
                                lineHeight: 1.45
                            }}>{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_114")}</div>
                            <div style={{
                                fontSize: '0.82rem',
                                color: 'var(--text-2, #94A3B8)'
                            }}>{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_115")}</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                        <button
                            className={`${shared.narrativeBtn} ${shared.narrativeBtnPrimary}`}
                            disabled title={readData("components.Dashboard.Views.PeopleCommandCentre", "unavailableAction")}
                        >{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_116")}<ArrowRight size={14} />
                        </button>
                        <button
                            className={shared.narrativeBtn}
                            onClick={() => setShowEvidenceModal(!showEvidenceModal)}
                        >{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_117")}</button>
                    </div>
                </div>
                {showEvidenceModal && (
                    <div style={{
                        marginTop: '0.5rem',
                        padding: '0.75rem',
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: '6px',
                        border: '1px solid rgba(155, 140, 255, 0.2)',
                        fontSize: '0.76rem',
                        color: '#CAD6DD'
                    }}>
                        <strong>{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_118")}</strong>{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_119")}<code>{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_120")}</code>{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_121")}<strong>{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_122")}</strong>{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_123")}</div>
                )}
            </div>

            {/* Visual Charts Grid */}
            <div className={shared.grid12}>
                {/* 1. Workforce Momentum (col-7) */}
                <div className={`${shared.widgetCard} ${shared.col7}`}>
                    <div className={shared.cardTitleRow}>
                        <div className={shared.cardTitleLeft}>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_124")}</h3>
                            <span style={{ fontSize: '0.68rem', letterSpacing: '0.06em', color: 'var(--text-3, #64748B)', fontWeight: 700, textTransform: 'uppercase' }}>{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_125")}</span>
                        </div>
                        <div className={shared.cardTools}>
                            <button style={{ background: 'transparent', border: 'none', color: 'var(--text-3, #64748B)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.2rem' }}>
                                <MoreHorizontal size={16} />
                            </button>
                        </div>
                    </div>
                    <div className={shared.cardBody}>
                        <NucleusChart option={headcountForecastOption} style={{ height: 260 }} />
                    </div>
                </div>

                {/* 2. Org Health Index Radar (col-5) */}
                <div className={`${shared.widgetCard} ${shared.col5}`}>
                    <div className={shared.cardTitleRow}>
                        <div className={shared.cardTitleLeft}>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_126")}</h3>
                            <span style={{ fontSize: '0.68rem', letterSpacing: '0.06em', color: 'var(--text-3, #64748B)', fontWeight: 700, textTransform: 'uppercase' }}>{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_127")}</span>
                        </div>
                        <div className={shared.cardTools}>
                            <button style={{ background: 'transparent', border: 'none', color: 'var(--text-3, #64748B)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.2rem' }}>
                                <MoreHorizontal size={16} />
                            </button>
                        </div>
                    </div>
                    <div className={shared.cardBody}>
                        <NucleusChart option={orgHealthRadarOption} style={{ height: 260 }} />
                    </div>
                </div>

                {/* 3. Talent Flow Sankey (col-6) */}
                <div className={`${shared.widgetCard} ${shared.col6}`}>
                    <div className={shared.cardTitleRow}>
                        <div className={shared.cardTitleLeft}>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_128")}</h3>
                            <span className={shared.cardSublabel}>{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_129")}</span>
                        </div>
                        <div className={shared.cardTools}>
                            <span className={`${shared.periodPill} ${shared.periodPillActive}`}>{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_130")}</span>
                        </div>
                    </div>
                    <div className={shared.cardBody}>
                        <NucleusChart option={talentFlowOption} style={{ height: 280 }} />
                    </div>
                </div>

                {/* 4. Attrition by Function (col-6) */}
                <div className={`${shared.widgetCard} ${shared.col6}`}>
                    <div className={shared.cardTitleRow}>
                        <div className={shared.cardTitleLeft}>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_131")}</h3>
                            <span className={shared.cardSublabel}>{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_132")}</span>
                        </div>
                        <div className={shared.cardTools}>
                            <span className={`${shared.periodPill} ${shared.periodPillActive}`}>{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_133")}</span>
                        </div>
                    </div>
                    <div className={shared.cardBody}>
                        <NucleusChart option={attritionByFunctionOption} style={{ height: 280 }} />
                    </div>
                </div>

                {/* 5. Pay Position vs Performance Bubble (col-6) */}
                <div className={`${shared.widgetCard} ${shared.col6}`}>
                    <div className={shared.cardTitleRow}>
                        <div className={shared.cardTitleLeft}>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_134")}</h3>
                            <span className={shared.cardSublabel}>{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_135")}</span>
                        </div>
                    </div>
                    <div className={shared.cardBody}>
                        <NucleusChart option={payVsPerformanceOption} style={{ height: 270 }} />
                    </div>
                </div>

                {/* 6. Attrition Heatmap: Function x Location (col-6) */}
                <div className={`${shared.widgetCard} ${shared.col6}`}>
                    <div className={shared.cardTitleRow}>
                        <div className={shared.cardTitleLeft}>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_136")}</h3>
                            <span className={shared.cardSublabel}>{readData("components.Dashboard.Views.PeopleCommandCentre", "content_text_137")}</span>
                        </div>
                    </div>
                    <div className={shared.cardBody}>
                        <NucleusChart option={attritionHeatmapOption} style={{ height: 270 }} />
                    </div>
                </div>
            </div>
        </div>
    );
}
