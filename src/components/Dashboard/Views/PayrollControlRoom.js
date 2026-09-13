"use client";
import { readData } from '../../../services/workspace-data.mjs';

import React, { useEffect, useState } from 'react';
import {
    Lock, CheckCircle2, AlertOctagon, FileCheck, IndianRupee, ShieldCheck,
    Calendar, ArrowDownRight, ArrowUpRight, Sparkles, AlertCircle
} from 'lucide-react';
import NucleusChart from '@/components/Charts/NucleusChart';
import { NUCLEUS_COLORS } from '@/components/Charts/theme';
import shared from '../DashboardShared.module.css';
import { launchAction } from '@/lib/action-launcher';

export default function PayrollControlRoom({ onNavigate }) {
    const [blockingExceptionsCleared, setBlockingExceptionsCleared] = useState(false);
    const [releaseAuthorized, setReleaseAuthorized] = useState(false);

    useEffect(() => {
        const applyRelease = (event) => {
            if (event.detail?.action === 'payrollRelease') setReleaseAuthorized(true);
        };
        window.addEventListener('nucleus:action-completed', applyRelease);
        return () => window.removeEventListener('nucleus:action-completed', applyRelease);
    }, []);

    // 8-stage stepper definition
    const steps = readData("components.Dashboard.Views.PayrollControlRoom", "steps_1");

    // 1. Waterfall Bridge (Why the cost moved Aug to Sep bridge, ₹ lakh)
    const waterfallOption = {
        tooltip: {
            ...readData("components.Dashboard.Views.PayrollControlRoom", "tooltip_fields_3"),
            formatter: (params) => {
                const tar = params[1] || params[0];
                return `${tar.name}: <strong>₹${tar.value} L</strong>`;
            }
        },
        ...readData("components.Dashboard.Views.PayrollControlRoom", "waterfallOption_fields_2"),
        xAxis: {
            ...readData("components.Dashboard.Views.PayrollControlRoom", "xAxis_fields_6"),
            axisLabel: { color: NUCLEUS_COLORS.textMuted, ...readData("components.Dashboard.Views.PayrollControlRoom", "axisLabel_fields_8") }
        },
        yAxis: {
            ...readData("components.Dashboard.Views.PayrollControlRoom", "yAxis_fields_9"),
            splitLine: { lineStyle: { color: NUCLEUS_COLORS.lineMuted } }
        },
        series: [
            // Invisible base for waterfall offset
            readData("components.Dashboard.Views.PayrollControlRoom", "series_11"),
            {
                ...readData("components.Dashboard.Views.PayrollControlRoom", "series_fields_12"),
                label: { ...readData("components.Dashboard.Views.PayrollControlRoom", "label_fields_14"), color: NUCLEUS_COLORS.textPrimary, ...readData("components.Dashboard.Views.PayrollControlRoom", "label_fields_15") },
                data: [
                    { ...readData("components.Dashboard.Views.PayrollControlRoom", "data_fields_16"), itemStyle: { color: NUCLEUS_COLORS.sky } },
                    { ...readData("components.Dashboard.Views.PayrollControlRoom", "data_fields_17"), itemStyle: { color: NUCLEUS_COLORS.coral } },
                    { ...readData("components.Dashboard.Views.PayrollControlRoom", "data_fields_18"), itemStyle: { color: NUCLEUS_COLORS.teal } },
                    { ...readData("components.Dashboard.Views.PayrollControlRoom", "data_fields_19"), itemStyle: { color: NUCLEUS_COLORS.coral } },
                    { ...readData("components.Dashboard.Views.PayrollControlRoom", "data_fields_20"), itemStyle: { color: NUCLEUS_COLORS.coral } },
                    { ...readData("components.Dashboard.Views.PayrollControlRoom", "data_fields_21"), itemStyle: { color: NUCLEUS_COLORS.teal } },
                    { ...readData("components.Dashboard.Views.PayrollControlRoom", "data_fields_22"), itemStyle: { color: NUCLEUS_COLORS.teal } },
                    { ...readData("components.Dashboard.Views.PayrollControlRoom", "data_fields_23"), itemStyle: { color: NUCLEUS_COLORS.sky } }
                ],
                ...readData("components.Dashboard.Views.PayrollControlRoom", "series_fields_13")
            }
        ]
    };

    // 2. Cost Composition Donut
    const costDonutOption = {
        ...readData("components.Dashboard.Views.PayrollControlRoom", "costDonutOption_fields_24"),
        legend: {
            ...readData("components.Dashboard.Views.PayrollControlRoom", "legend_fields_26"),
            textStyle: { color: NUCLEUS_COLORS.textMuted, ...readData("components.Dashboard.Views.PayrollControlRoom", "textStyle_fields_27") }
        },
        series: [{
            ...readData("components.Dashboard.Views.PayrollControlRoom", "series_fields_28"),
            label: {
                ...readData("components.Dashboard.Views.PayrollControlRoom", "label_fields_32"),
                color: NUCLEUS_COLORS.textPrimary
            },
            data: [
                { ...readData("components.Dashboard.Views.PayrollControlRoom", "data_fields_33"), itemStyle: { color: NUCLEUS_COLORS.teal } },
                { ...readData("components.Dashboard.Views.PayrollControlRoom", "data_fields_34"), itemStyle: { color: NUCLEUS_COLORS.sky } },
                { ...readData("components.Dashboard.Views.PayrollControlRoom", "data_fields_35"), itemStyle: { color: NUCLEUS_COLORS.amber } },
                { ...readData("components.Dashboard.Views.PayrollControlRoom", "data_fields_36"), itemStyle: { color: NUCLEUS_COLORS.violet } },
                { ...readData("components.Dashboard.Views.PayrollControlRoom", "data_fields_37"), itemStyle: { color: NUCLEUS_COLORS.coral } }
            ]
        }]
    };

    // 3. Cost Per Employee by Function (Grouped Bar)
    const costByFunctionOption = {
        ...readData("components.Dashboard.Views.PayrollControlRoom", "costByFunctionOption_fields_38"),
        xAxis: {
            ...readData("components.Dashboard.Views.PayrollControlRoom", "xAxis_fields_41"),
            axisLabel: { color: NUCLEUS_COLORS.textPrimary, ...readData("components.Dashboard.Views.PayrollControlRoom", "axisLabel_fields_43") }
        },
        yAxis: {
            ...readData("components.Dashboard.Views.PayrollControlRoom", "yAxis_fields_44"),
            splitLine: { lineStyle: { color: NUCLEUS_COLORS.lineMuted } }
        },
        series: [{
            ...readData("components.Dashboard.Views.PayrollControlRoom", "series_fields_46"),
            data: [
                { ...readData("components.Dashboard.Views.PayrollControlRoom", "data_fields_48"), itemStyle: { color: NUCLEUS_COLORS.teal } },
                { ...readData("components.Dashboard.Views.PayrollControlRoom", "data_fields_49"), itemStyle: { color: NUCLEUS_COLORS.sky } },
                { ...readData("components.Dashboard.Views.PayrollControlRoom", "data_fields_50"), itemStyle: { color: NUCLEUS_COLORS.amber } },
                { ...readData("components.Dashboard.Views.PayrollControlRoom", "data_fields_51"), itemStyle: { color: NUCLEUS_COLORS.sky } },
                { ...readData("components.Dashboard.Views.PayrollControlRoom", "data_fields_52"), itemStyle: { color: NUCLEUS_COLORS.slate } },
                { ...readData("components.Dashboard.Views.PayrollControlRoom", "data_fields_53"), itemStyle: { color: NUCLEUS_COLORS.teal } }
            ],
            ...readData("components.Dashboard.Views.PayrollControlRoom", "series_fields_47"),
            label: { ...readData("components.Dashboard.Views.PayrollControlRoom", "label_fields_54"), color: NUCLEUS_COLORS.textMuted, ...readData("components.Dashboard.Views.PayrollControlRoom", "label_fields_55") }
        }]
    };

    // 4. Payroll Accuracy Line (Off-cycle corrections per 1,000 payslips)
    const accuracyOption = {
        ...readData("components.Dashboard.Views.PayrollControlRoom", "accuracyOption_fields_56"),
        xAxis: {
            ...readData("components.Dashboard.Views.PayrollControlRoom", "xAxis_fields_59"),
            axisLabel: { color: NUCLEUS_COLORS.textMuted, ...readData("components.Dashboard.Views.PayrollControlRoom", "axisLabel_fields_61") }
        },
        yAxis: {
            ...readData("components.Dashboard.Views.PayrollControlRoom", "yAxis_fields_62"),
            splitLine: { lineStyle: { color: NUCLEUS_COLORS.lineMuted } }
        },
        series: [{
            ...readData("components.Dashboard.Views.PayrollControlRoom", "series_fields_63"),
            itemStyle: { color: NUCLEUS_COLORS.teal },
            ...readData("components.Dashboard.Views.PayrollControlRoom", "series_fields_64")
        }]
    };

    return (
        <div className={shared.dashboardCanvas}>
            {/* Scope & Stepper Spine */}
            <div className={shared.scopeBar}>
                <div className={shared.scopeLeft}>
                    <h2 className={shared.screenTitle}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_68")}</h2>
                    <span className={shared.scopeMetadata}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_69")}</span>
                    <span className={shared.scopePill}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_70")}</span>
                    <span className={shared.scopePill}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_71")}</span>
                </div>
                <div className={shared.scopeRight}>
                    <button className={shared.scopeBtn} onClick={() => launchAction('payrollPreview', readData("components.Dashboard.Views.PayrollControlRoom", "content_72"))}>
                        <FileCheck size={14} />{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_73")}</button>
                    <button
                        className={`${shared.scopeBtn} ${shared.scopeBtnPrimary}`}
                        disabled={!blockingExceptionsCleared || releaseAuthorized}
                        style={{ opacity: blockingExceptionsCleared && !releaseAuthorized ? 1 : 0.6 }}
                        onClick={() => launchAction('payrollRelease', { ...readData("components.Dashboard.Views.PayrollControlRoom", "content_fields_74"), exceptionSummary: blockingExceptionsCleared ? readData("components.Dashboard.Views.PayrollControlRoom", "display_1") : readData("components.Dashboard.Views.PayrollControlRoom", "display_2") })}
                    >
                        <Lock size={14} /> {releaseAuthorized ? readData("components.Dashboard.Views.PayrollControlRoom", "display_3") : readData("components.Dashboard.Views.PayrollControlRoom", "display_4")}
                    </button>
                </div>
            </div>

            {/* 8-Stage Cycle Stepper Spine */}
            <div style={{
                display: 'flex',
                background: 'var(--card, #0E1D30)',
                border: '1px solid var(--line, #1C3450)',
                borderRadius: '8px',
                padding: '0.85rem 1rem',
                overflowX: 'auto',
                gap: '0.5rem',
                justifyContent: 'space-between'
            }}>
                {steps.map((s, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '130px' }}>
                        <div style={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            background: s.status === 'completed' ? '#05CD99' : s.status === 'active' ? '#F2A93B' : '#1C3450',
                            color: s.status === 'completed' || s.status === 'active' ? '#060D18' : '#93A6BF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.68rem',
                            fontWeight: 800
                        }}>
                            {s.status === 'completed' ? readData("components.Dashboard.Views.PayrollControlRoom", "display_5") : idx + 1}
                        </div>
                        <div>
                            <div style={{ fontSize: '0.74rem', fontWeight: 600, color: s.status === 'active' ? '#F2A93B' : '#E6EDF6' }}>
                                {s.label}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#93A6BF' }}>{s.date}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* 4 Control KPIs */}
            <div className={shared.grid12}>
                <div className={shared.kpiTile} style={{ gridColumn: 'span 3' }}>
                    <span className={shared.kpiLabel}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_75")}</span>
                    <div className={shared.kpiValueRow}>
                        <span className={shared.kpiValue}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_76")}</span>
                        <span className={`${shared.kpiDelta} ${shared.deltaPositive}`}>
                            <ArrowDownRight size={14} />{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_77")}</span>
                    </div>
                    <span className={shared.kpiSub}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_78")}</span>
                </div>

                <div className={shared.kpiTile} style={{ gridColumn: 'span 3' }}>
                    <span className={shared.kpiLabel}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_79")}</span>
                    <div className={shared.kpiValueRow}>
                        <span className={shared.kpiValue}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_80")}</span>
                        <span className={`${shared.kpiDelta} ${shared.deltaNeutral}`}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_81")}</span>
                    </div>
                    <span className={shared.kpiSub}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_82")}</span>
                </div>

                <div className={shared.kpiTile} style={{ gridColumn: 'span 3' }}>
                    <span className={shared.kpiLabel}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_83")}</span>
                    <div className={shared.kpiValueRow}>
                        <span className={shared.kpiValue}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_84")}</span>
                        <span className={`${shared.kpiDelta} ${shared.deltaAttention}`}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_85")}</span>
                    </div>
                    <span className={shared.kpiSub}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_86")}</span>
                </div>

                <div className={shared.kpiTile} style={{ gridColumn: 'span 3' }}>
                    <span className={shared.kpiLabel}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_87")}</span>
                    <div className={shared.kpiValueRow}>
                        <span className={shared.kpiValue}>{blockingExceptionsCleared ? readData("components.Dashboard.Views.PayrollControlRoom", "display_6") : readData("components.Dashboard.Views.PayrollControlRoom", "display_7")}</span>
                        <span className={`${shared.kpiDelta} ${blockingExceptionsCleared ? shared.deltaPositive : shared.deltaRisk}`}>
                            {blockingExceptionsCleared ? readData("components.Dashboard.Views.PayrollControlRoom", "display_8") : readData("components.Dashboard.Views.PayrollControlRoom", "display_9")}
                        </span>
                    </div>
                    <span className={shared.kpiSub}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_88")}</span>
                </div>
            </div>

            {/* Charts Row: Waterfall & Donut */}
            <div className={shared.grid12}>
                {/* 1. Waterfall Bridge (col-7) */}
                <div className={`${shared.widgetCard} ${shared.col8}`}>
                    <div className={shared.cardTitleRow}>
                        <div className={shared.cardTitleLeft}>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_89")}</h3>
                            <span className={shared.cardSublabel}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_90")}</span>
                        </div>
                    </div>
                    <div className={shared.cardBody}>
                        <NucleusChart option={waterfallOption} style={{ height: 260 }} />
                    </div>
                </div>

                {/* 2. Cost Composition Donut (col-5) */}
                <div className={`${shared.widgetCard} ${shared.col4}`}>
                    <div className={shared.cardTitleRow}>
                        <div className={shared.cardTitleLeft}>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_91")}</h3>
                            <span className={shared.cardSublabel}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_92")}</span>
                        </div>
                    </div>
                    <div className={shared.cardBody}>
                        <NucleusChart option={costDonutOption} style={{ height: 260 }} />
                    </div>
                </div>
            </div>

            {/* Exceptions Table & Statutory Calendar */}
            <div className={shared.grid12}>
                {/* Exceptions to Clear Before Lock (col-7) */}
                <div className={`${shared.widgetCard} ${shared.col7 || readData("components.Dashboard.Views.PayrollControlRoom", "fallback_1")}`} style={{ gridColumn: 'span 7' }}>
                    <div className={shared.cardTitleRow}>
                        <div className={shared.cardTitleLeft}>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_93")}</h3>
                            <span className={shared.cardSublabel}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_94")}</span>
                        </div>
                        <button
                            className={shared.btnRowAction}
                            onClick={() => setBlockingExceptionsCleared(!blockingExceptionsCleared)}
                        >
                            {blockingExceptionsCleared ? readData("components.Dashboard.Views.PayrollControlRoom", "display_10") : readData("components.Dashboard.Views.PayrollControlRoom", "display_11")}
                        </button>
                    </div>
                    <div className={shared.cardBody}>
                        <table className={shared.dataTable}>
                            <thead>
                                <tr>
                                    <th>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_95")}</th>
                                    <th>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_96")}</th>
                                    <th>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_97")}</th>
                                    <th>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_98")}</th>
                                    <th>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_99")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style={{ opacity: blockingExceptionsCleared ? 0.4 : 1 }}>
                                    <td>
                                        <strong>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_100")}</strong>
                                        <div style={{ fontSize: '0.7rem', color: '#93A6BF' }}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_101")}</div>
                                    </td>
                                    <td>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_102")}</td>
                                    <td>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_103")}</td>
                                    <td><span className={`${shared.pillBadge} ${shared.pillViolet}`}><Sparkles size={11} style={{ marginRight: 3 }} />{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_104")}</span></td>
                                    <td><span className={`${shared.pillBadge} ${shared.pillCoral}`}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_105")}</span></td>
                                </tr>
                                <tr style={{ opacity: blockingExceptionsCleared ? 0.4 : 1 }}>
                                    <td>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_106")}</td>
                                    <td>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_107")}</td>
                                    <td>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_108")}</td>
                                    <td>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_109")}</td>
                                    <td><span className={`${shared.pillBadge} ${shared.pillCoral}`}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_110")}</span></td>
                                </tr>
                                <tr style={{ opacity: blockingExceptionsCleared ? 0.4 : 1 }}>
                                    <td>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_111")}</td>
                                    <td>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_112")}</td>
                                    <td>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_113")}</td>
                                    <td>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_114")}</td>
                                    <td><span className={`${shared.pillBadge} ${shared.pillCoral}`}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_115")}</span></td>
                                </tr>
                                <tr>
                                    <td>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_116")}</td>
                                    <td>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_117")}</td>
                                    <td>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_118")}</td>
                                    <td><span className={`${shared.pillBadge} ${shared.pillViolet}`}><Sparkles size={11} style={{ marginRight: 3 }} />{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_119")}</span></td>
                                    <td><span className={`${shared.pillBadge} ${shared.pillAmber}`}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_120")}</span></td>
                                </tr>
                                <tr>
                                    <td>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_121")}</td>
                                    <td>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_122")}</td>
                                    <td>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_123")}</td>
                                    <td>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_124")}</td>
                                    <td><span className={`${shared.pillBadge} ${shared.pillAmber}`}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_125")}</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Indian Statutory Calendar (col-5) */}
                <div className={`${shared.widgetCard} ${shared.col5 || readData("components.Dashboard.Views.PayrollControlRoom", "fallback_2")}`} style={{ gridColumn: 'span 5' }}>
                    <div className={shared.cardTitleRow}>
                        <div className={shared.cardTitleLeft}>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_126")}</h3>
                            <span className={shared.cardSublabel}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_127")}</span>
                        </div>
                    </div>
                    <div className={shared.cardBody}>
                        <table className={shared.dataTable}>
                            <tbody>
                                <tr>
                                    <td><strong>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_128")}</strong>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_129")}</td>
                                    <td>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_130")}</td>
                                    <td><span className={`${shared.pillBadge} ${shared.pillCoral}`}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_131")}</span></td>
                                </tr>
                                <tr>
                                    <td><strong>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_132")}</strong>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_133")}</td>
                                    <td>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_134")}</td>
                                    <td><span className={`${shared.pillBadge} ${shared.pillCoral}`}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_135")}</span></td>
                                </tr>
                                <tr>
                                    <td><strong>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_136")}</strong>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_137")}</td>
                                    <td>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_138")}</td>
                                    <td><span className={`${shared.pillBadge} ${shared.pillAmber}`}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_139")}</span></td>
                                </tr>
                                <tr>
                                    <td><strong>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_140")}</strong>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_141")}</td>
                                    <td>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_142")}</td>
                                    <td><span className={`${shared.pillBadge} ${shared.pillSky}`}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_143")}</span></td>
                                </tr>
                                <tr>
                                    <td><strong>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_144")}</strong>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_145")}</td>
                                    <td>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_146")}</td>
                                    <td><span className={`${shared.pillBadge} ${shared.pillTeal}`}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_147")}</span></td>
                                </tr>
                                <tr>
                                    <td><strong>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_148")}</strong>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_149")}</td>
                                    <td>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_150")}</td>
                                    <td><span className={`${shared.pillBadge} ${shared.pillSlate}`}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_151")}</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Bottom Row: Cost per employee & Payroll Accuracy */}
            <div className={shared.grid12}>
                <div className={`${shared.widgetCard} ${shared.col6}`}>
                    <div className={shared.cardTitleRow}>
                        <div className={shared.cardTitleLeft}>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_152")}</h3>
                            <span className={shared.cardSublabel}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_153")}</span>
                        </div>
                    </div>
                    <div className={shared.cardBody}>
                        <NucleusChart option={costByFunctionOption} style={{ height: 220 }} />
                    </div>
                </div>

                <div className={`${shared.widgetCard} ${shared.col6}`}>
                    <div className={shared.cardTitleRow}>
                        <div className={shared.cardTitleLeft}>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_154")}</h3>
                            <span className={shared.cardSublabel}>{readData("components.Dashboard.Views.PayrollControlRoom", "content_text_155")}</span>
                        </div>
                    </div>
                    <div className={shared.cardBody}>
                        <NucleusChart option={accuracyOption} style={{ height: 220 }} />
                    </div>
                </div>
            </div>
        </div>
    );
}
