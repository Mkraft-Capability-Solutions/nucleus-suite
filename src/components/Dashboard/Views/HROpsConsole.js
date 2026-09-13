"use client";
import {useTranslation} from '@/context/I18nContext';

import { readData } from '../../../services/workspace-data.mjs';

import React, { useState } from 'react';
import {
    AlertTriangle, CheckCircle, Clock, Calendar, FileText, UserCheck,
    Send, UserPlus, ArrowRight, ShieldAlert, Check, X
} from 'lucide-react';
import NucleusChart from '@/components/Charts/NucleusChart';
import { NUCLEUS_COLORS } from '@/components/Charts/theme';
import shared from '../DashboardShared.module.css';
import ApprovalActionModal from '../Modals/ApprovalActionModal';
import { useHRMS } from '@/context/HRMSContext';
import { launchAction } from '@/lib/action-launcher';

export default function HROpsConsole({ onNavigate }) {
    const {t: translateText}=useTranslation();

    const [dismissAnomaly, setDismissAnomaly] = useState(false);
    const [approvalList, setApprovalList] = useState(readData("components.Dashboard.Views.HROpsConsole", "approvalList_1"));

    const { showToast } = useHRMS();
    const [modalItem, setModalItem] = useState(null);
    const [modalAction, setModalAction] = useState(readData("components.Dashboard.Views.HROpsConsole", "initialState_1"));
    const [isModalOpen, setIsModalOpen] = useState(false);

    const openApprovalModal = (item, action = readData("components.Dashboard.Views.HROpsConsole", "defaultValue_2")) => {
        setModalItem(item);
        setModalAction(action);
        setIsModalOpen(true);
    };

    const handleModalSubmit = ({ id, actionType, remarks, rerouteTargetName, item }) => {
        setApprovalList(prev => prev.filter(a => a.id !== id));
        if (actionType === 'approve') {
            showToast?.(translateText("components.Dashboard.Views.HROpsConsole","text_e847085d37"),translateText("components.Dashboard.Views.HROpsConsole","text_91801f7d34", {value1: String(item.name), value2: String(item.type), value3: String(remarks ? ` • Note: ${remarks}` : '')}), 'success');
        } else if (actionType === 'reject') {
            showToast?.(translateText("components.Dashboard.Views.HROpsConsole","text_584cb388ca"),translateText("components.Dashboard.Views.HROpsConsole","text_b29b6843fd", {value1: String(item.name), value2: String(item.type), value3: String(remarks)}), 'error');
        } else if (actionType === 'reroute') {
            showToast?.(translateText("components.Dashboard.Views.HROpsConsole","text_800e839576"),translateText("components.Dashboard.Views.HROpsConsole","text_b32ed95084", {value1: String(item.name), value2: String(item.type), value3: String(rerouteTargetName), value4: String(remarks)}), 'info');
        }
    };

    // 1. Onboarding Pipeline Funnel
    const onboardingStages = [
        readData("components.Dashboard.Views.HROpsConsole", "onboardingStages_2"),
        { ...readData("components.Dashboard.Views.HROpsConsole", "onboardingStages_fields_3"), color: NUCLEUS_COLORS.teal, ...readData("components.Dashboard.Views.HROpsConsole", "onboardingStages_fields_4") },
        { ...readData("components.Dashboard.Views.HROpsConsole", "onboardingStages_fields_5"), color: NUCLEUS_COLORS.sky, ...readData("components.Dashboard.Views.HROpsConsole", "onboardingStages_fields_6") },
        { ...readData("components.Dashboard.Views.HROpsConsole", "onboardingStages_fields_7"), color: NUCLEUS_COLORS.amber, ...readData("components.Dashboard.Views.HROpsConsole", "onboardingStages_fields_8") },
        { ...readData("components.Dashboard.Views.HROpsConsole", "onboardingStages_fields_9"), color: NUCLEUS_COLORS.violet, ...readData("components.Dashboard.Views.HROpsConsole", "onboardingStages_fields_10") }
    ];

    const onboardingFunnelOption = {
        tooltip: {
            ...readData("components.Dashboard.Views.HROpsConsole", "tooltip_fields_11"),
            formatter: (params) => {
                const s = onboardingStages.find(st => st.name === params.name) || params.data;
                return `
                    <div style="font-weight:700;margin-bottom:4px;color:${params.color || readData("components.Dashboard.Views.HROpsConsole", "fallback_1")}">${params.name}</div>
                    <div style="font-size:11px;color:#94A3B8;">Candidates: <strong style="color:#FFF">${params.value}</strong></div>
                    <div style="font-size:11px;color:#94A3B8;">Stage Conversion: <strong style="color:#05CD99">${s.rate || readData("components.Dashboard.Views.HROpsConsole", "fallback_2")}</strong></div>
                    ${s.drop ? `<div style="font-size:11px;color:#F43F5E;">Drop-off: <strong>${s.drop}</strong> candidates</div>` : ''}
                `;
            }
        },
        series: [{
            ...readData("components.Dashboard.Views.HROpsConsole", "series_fields_14"),
            data: onboardingStages.map(s => ({
                value: s.value,
                name: s.name,
                itemStyle: { color: s.color }
            }))
        }]
    };

    // 2. Absence Density Calendar Heatmap (12 Weeks x 7 Days)
    const days = readData("components.Dashboard.Views.HROpsConsole", "days_18");
    const weeks = Array.from(readData("components.Dashboard.Views.HROpsConsole", "weeks_19"), (_, i) => `Wk ${i + 1}`);
    const calendarData = readData("components.Dashboard.Views.HROpsConsole", "calendarData_20");

    const calendarHeatmapOption = {
        tooltip: {
            ...readData("components.Dashboard.Views.HROpsConsole", "tooltip_fields_23"),
            formatter: (p) => `${weeks[p.value[0]]} ${days[p.value[1]]}: <strong>${p.value[2]}</strong> absences`
        },
        ...readData("components.Dashboard.Views.HROpsConsole", "calendarHeatmapOption_fields_21"),
        xAxis: {
            ...readData("components.Dashboard.Views.HROpsConsole", "xAxis_fields_25"),
            data: weeks,
            axisLabel: { color: NUCLEUS_COLORS.textMuted, ...readData("components.Dashboard.Views.HROpsConsole", "axisLabel_fields_27") },
            ...readData("components.Dashboard.Views.HROpsConsole", "xAxis_fields_26")
        },
        yAxis: {
            ...readData("components.Dashboard.Views.HROpsConsole", "yAxis_fields_29"),
            data: days,
            axisLabel: { color: NUCLEUS_COLORS.textPrimary, ...readData("components.Dashboard.Views.HROpsConsole", "axisLabel_fields_31") },
            ...readData("components.Dashboard.Views.HROpsConsole", "yAxis_fields_30")
        },
        ...readData("components.Dashboard.Views.HROpsConsole", "calendarHeatmapOption_fields_22"),
        series: [{
            ...readData("components.Dashboard.Views.HROpsConsole", "series_fields_34"),
            data: calendarData,
            ...readData("components.Dashboard.Views.HROpsConsole", "series_fields_35")
        }]
    };

    // 3. Requests by Type (Horizontal Bar)
    const requestsByTypeOption = {
        ...readData("components.Dashboard.Views.HROpsConsole", "requestsByTypeOption_fields_37"),
        yAxis: {
            ...readData("components.Dashboard.Views.HROpsConsole", "yAxis_fields_41"),
            axisLabel: { color: NUCLEUS_COLORS.textPrimary, ...readData("components.Dashboard.Views.HROpsConsole", "axisLabel_fields_43") }
        },
        series: [{
            ...readData("components.Dashboard.Views.HROpsConsole", "series_fields_44"),
            data: [
                { ...readData("components.Dashboard.Views.HROpsConsole", "data_fields_46"), itemStyle: { color: NUCLEUS_COLORS.slate } },
                { ...readData("components.Dashboard.Views.HROpsConsole", "data_fields_47"), itemStyle: { color: NUCLEUS_COLORS.sky } },
                { ...readData("components.Dashboard.Views.HROpsConsole", "data_fields_48"), itemStyle: { color: NUCLEUS_COLORS.sky } },
                { ...readData("components.Dashboard.Views.HROpsConsole", "data_fields_49"), itemStyle: { color: NUCLEUS_COLORS.amber } },
                { ...readData("components.Dashboard.Views.HROpsConsole", "data_fields_50"), itemStyle: { color: NUCLEUS_COLORS.amber } },
                { ...readData("components.Dashboard.Views.HROpsConsole", "data_fields_51"), itemStyle: { color: NUCLEUS_COLORS.teal } },
            ],
            label: {
                ...readData("components.Dashboard.Views.HROpsConsole", "label_fields_52"),
                color: NUCLEUS_COLORS.textPrimary,
                ...readData("components.Dashboard.Views.HROpsConsole", "label_fields_53")
            },
            ...readData("components.Dashboard.Views.HROpsConsole", "series_fields_45")
        }]
    };

    return (
        <div className={shared.dashboardCanvas}>
            {/* Scope & Quick Action Bar */}
            <div className={shared.scopeBar}>
                <div className={shared.scopeLeft}>
                    <h2 className={shared.screenTitle}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_54")}</h2>
                    <span className={shared.scopeMetadata}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_55")}</span>
                    <span className={`${shared.pillBadge} ${shared.pillAmber}`}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_56")}{approvalList.length}</span>
                    <span className={`${shared.pillBadge} ${shared.pillCoral}`}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_57")}</span>
                    <span className={`${shared.pillBadge} ${shared.pillTeal}`}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_58")}</span>
                </div>
                <div className={shared.scopeRight}>
                    <button className={`${shared.scopeBtn} ${shared.scopeBtnPrimary}`} onClick={() => launchAction('employee')}>
                        <UserPlus size={14} />{readData("components.Dashboard.Views.HROpsConsole", "content_text_59")}</button>
                </div>
            </div>

            {/* 6 Operational KPIs */}
            <div className={shared.grid12}>
                <div className={shared.kpiTile} style={{ gridColumn: 'span 2' }}>
                    <span className={shared.kpiLabel}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_60")}</span>
                    <div className={shared.kpiValueRow}>
                        <span className={shared.kpiValue}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_61")}</span>
                        <span className={`${shared.kpiDelta} ${shared.deltaPositive}`}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_62")}</span>
                    </div>
                    <span className={shared.kpiSub}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_63")}</span>
                </div>

                <div className={shared.kpiTile} style={{ gridColumn: 'span 2' }}>
                    <span className={shared.kpiLabel}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_64")}</span>
                    <div className={shared.kpiValueRow}>
                        <span className={shared.kpiValue}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_65")}</span>
                        <span className={`${shared.kpiDelta} ${shared.deltaAttention}`}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_66")}</span>
                    </div>
                    <span className={shared.kpiSub}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_67")}</span>
                </div>

                <div className={shared.kpiTile} style={{ gridColumn: 'span 2' }}>
                    <span className={shared.kpiLabel}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_68")}</span>
                    <div className={shared.kpiValueRow}>
                        <span className={shared.kpiValue}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_69")}</span>
                        <span className={`${shared.kpiDelta} ${shared.deltaRisk}`}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_70")}</span>
                    </div>
                    <span className={shared.kpiSub}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_71")}</span>
                </div>

                <div className={shared.kpiTile} style={{ gridColumn: 'span 2' }}>
                    <span className={shared.kpiLabel}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_72")}</span>
                    <div className={shared.kpiValueRow}>
                        <span className={shared.kpiValue}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_73")}</span>
                        <span className={`${shared.kpiDelta} ${shared.deltaAttention}`}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_74")}</span>
                    </div>
                    <span className={shared.kpiSub}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_75")}</span>
                </div>

                <div className={shared.kpiTile} style={{ gridColumn: 'span 2' }}>
                    <span className={shared.kpiLabel}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_76")}</span>
                    <div className={shared.kpiValueRow}>
                        <span className={shared.kpiValue}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_77")}</span>
                        <span className={`${shared.kpiDelta} ${shared.deltaNeutral}`}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_78")}</span>
                    </div>
                    <span className={shared.kpiSub}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_79")}</span>
                </div>

                <div className={shared.kpiTile} style={{ gridColumn: 'span 2' }}>
                    <span className={shared.kpiLabel}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_80")}</span>
                    <div className={shared.kpiValueRow}>
                        <span className={shared.kpiValue}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_81")}</span>
                        <span className={`${shared.kpiDelta} ${shared.deltaNeutral}`}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_82")}</span>
                    </div>
                    <span className={shared.kpiSub}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_83")}</span>
                </div>
            </div>

            {/* P2 Anomaly Ribbon (Full Width Amber) */}
            {!dismissAnomaly && (
                <div className={shared.anomalyRibbon}>
                    <div className={shared.anomalyContent}>
                        <span className={shared.anomalyBadge}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_84")}</span>
                        <span className={shared.anomalyText}>
                            <strong>{readData("components.Dashboard.Views.HROpsConsole", "content_text_85")}</strong>{readData("components.Dashboard.Views.HROpsConsole", "content_text_86")}<strong>{readData("components.Dashboard.Views.HROpsConsole", "content_text_87")}</strong>{readData("components.Dashboard.Views.HROpsConsole", "content_text_88")}</span>
                    </div>
                    <div className={shared.anomalyActions}>
                        <button className={shared.btnAnomalyPrimary} disabled title={readData("components.Dashboard.Views.HROpsConsole", "unavailableAction")}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_89")}</button>
                        <button className={shared.btnAnomalySecondary} onClick={() => setDismissAnomaly(true)}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_90")}</button>
                    </div>
                </div>
            )}

            {/* Work Queue & Operational Widgets */}
            <div className={shared.grid12}>
                {/* 1. Approvals Waiting on You (col-4) */}
                <div className={`${shared.widgetCard} ${shared.col4}`}>
                    <div className={shared.cardTitleRow}>
                        <div className={shared.cardTitleLeft}>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_91")}</h3>
                            <span className={shared.cardSublabel}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_92")}{approvalList.length}{readData("components.Dashboard.Views.HROpsConsole", "content_text_93")}</span>
                        </div>
                    </div>
                    <div className={shared.cardBody}>
                        <table className={shared.dataTable}>
                            <tbody>
                                {approvalList.map(app => (
                                    <tr key={app.id}>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{app.name}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-2)' }}>{app.type}</div>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.35rem', flexWrap: 'wrap' }}>
                                                <span className={`${shared.pillBadge} ${app.isBreach ? shared.pillCoral : shared.pillSlate}`} style={{ marginRight: '0.2rem' }}>
                                                    {app.age} {app.isBreach ? readData("components.Dashboard.Views.HROpsConsole", "display_3") : ''}
                                                </span>
                                                <button
                                                    className={shared.btnRowAction}
                                                    style={{
                                                        color: '#05CD99',
                                                        borderColor: 'rgba(45, 212, 168, 0.35)',
                                                        background: 'rgba(45, 212, 168, 0.08)',
                                                        fontSize: '0.7rem',
                                                        padding: '0.2rem 0.5rem'
                                                    }}
                                                    onClick={() => openApprovalModal(app, 'approve')}
                                                    title={readData("components.Dashboard.Views.HROpsConsole", "content_title_94")}
                                                >{readData("components.Dashboard.Views.HROpsConsole", "content_text_95")}</button>
                                                <button
                                                    className={shared.btnRowAction}
                                                    style={{
                                                        color: '#F43F5E',
                                                        borderColor: 'rgba(244, 63, 94, 0.35)',
                                                        background: 'rgba(244, 63, 94, 0.08)',
                                                        fontSize: '0.7rem',
                                                        padding: '0.2rem 0.5rem'
                                                    }}
                                                    onClick={() => openApprovalModal(app, 'reject')}
                                                    title={readData("components.Dashboard.Views.HROpsConsole", "content_title_96")}
                                                >{readData("components.Dashboard.Views.HROpsConsole", "content_text_97")}</button>
                                                <button
                                                    className={shared.btnRowAction}
                                                    style={{
                                                        color: 'var(--agent)',
                                                        borderColor: 'rgba(155, 140, 255, 0.35)',
                                                        background: 'rgba(155, 140, 255, 0.08)',
                                                        fontSize: '0.7rem',
                                                        padding: '0.2rem 0.5rem'
                                                    }}
                                                    onClick={() => openApprovalModal(app, 'reroute')}
                                                    title={readData("components.Dashboard.Views.HROpsConsole", "content_title_98")}
                                                >{readData("components.Dashboard.Views.HROpsConsole", "content_text_99")}</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 2. Onboarding Pipeline Funnel (col-4) */}
                <div className={`${shared.widgetCard} ${shared.col4}`}>
                    <div className={shared.cardTitleRow}>
                        <div className={shared.cardTitleLeft}>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_100")}</h3>
                            <span className={shared.cardSublabel}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_101")}</span>
                        </div>
                        <div className={shared.cardTools}>
                            <span className={`${shared.pillBadge} ${shared.pillTeal}`}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_102")}</span>
                        </div>
                    </div>
                    <div className={shared.cardBody} style={{ justifyContent: 'space-between', gap: '0.65rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: '0.65rem', alignItems: 'center' }}>
                            <div style={{ height: 200, width: '100%' }}>
                                <NucleusChart option={onboardingFunnelOption} style={{ height: 200 }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                {onboardingStages.map((stage) => (
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
                                            <strong style={{ color: '#FFFFFF', fontSize: '0.76rem' }}>{stage.value}</strong>
                                            <span style={{ fontSize: '0.68rem', color: 'var(--text-2)' }}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_103")}{stage.rate}{readData("components.Dashboard.Views.HROpsConsole", "content_text_104")}</span>
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
                            <span style={{ color: 'var(--text-2)' }}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_105")}</span>
                            <span style={{ color: '#05CD99', fontWeight: 700 }}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_106")}</span>
                        </div>
                    </div>
                </div>

                {/* 3. Helpdesk SLA Bullets (col-4) */}
                <div className={`${shared.widgetCard} ${shared.col4}`}>
                    <div className={shared.cardTitleRow}>
                        <div className={shared.cardTitleLeft}>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_107")}</h3>
                            <span className={shared.cardSublabel}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_108")}</span>
                        </div>
                    </div>
                    <div className={shared.cardBody} style={{ gap: '1.25rem', justifyContent: 'center' }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.35rem' }}>
                                <span>{readData("components.Dashboard.Views.HROpsConsole", "content_text_109")}</span>
                                <strong>{readData("components.Dashboard.Views.HROpsConsole", "content_text_110")}<span style={{ color: 'var(--text-2)', fontWeight: 400 }}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_111")}</span></strong>
                            </div>
                            <div style={{ height: 8, background: '#14263D', borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{ width: '82%', height: '100%', background: '#F2A93B' }} />
                            </div>
                        </div>

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.35rem' }}>
                                <span>{readData("components.Dashboard.Views.HROpsConsole", "content_text_112")}</span>
                                <strong>{readData("components.Dashboard.Views.HROpsConsole", "content_text_113")}<span style={{ color: 'var(--text-2)', fontWeight: 400 }}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_114")}</span></strong>
                            </div>
                            <div style={{ height: 8, background: '#14263D', borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{ width: '94%', height: '100%', background: '#05CD99' }} />
                            </div>
                        </div>

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.35rem' }}>
                                <span>{readData("components.Dashboard.Views.HROpsConsole", "content_text_115")}</span>
                                <strong>{readData("components.Dashboard.Views.HROpsConsole", "content_text_116")}<span style={{ color: 'var(--text-2)', fontWeight: 400 }}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_117")}</span></strong>
                            </div>
                            <div style={{ height: 8, background: '#14263D', borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{ width: '6%', height: '100%', background: '#F2647E' }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. Absence Density Calendar Heatmap (col-6) */}
                <div className={`${shared.widgetCard} ${shared.col6}`}>
                    <div className={shared.cardTitleRow}>
                        <div className={shared.cardTitleLeft}>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_118")}</h3>
                            <span className={shared.cardSublabel}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_119")}</span>
                        </div>
                        <div className={shared.cardTools}>
                            <span className={`${shared.periodPill} ${shared.periodPillActive}`}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_120")}</span>
                        </div>
                    </div>
                    <div className={shared.cardBody}>
                        <NucleusChart option={calendarHeatmapOption} style={{ height: 220 }} />
                    </div>
                </div>

                {/* 5. Documents & Renewals Expiry Table (col-6) */}
                <div className={`${shared.widgetCard} ${shared.col6}`}>
                    <div className={shared.cardTitleRow}>
                        <div className={shared.cardTitleLeft}>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_121")}</h3>
                            <span className={shared.cardSublabel}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_122")}</span>
                        </div>
                    </div>
                    <div className={shared.cardBody}>
                        <table className={shared.dataTable}>
                            <thead>
                                <tr>
                                    <th>{readData("components.Dashboard.Views.HROpsConsole", "content_text_123")}</th>
                                    <th>{readData("components.Dashboard.Views.HROpsConsole", "content_text_124")}</th>
                                    <th>{readData("components.Dashboard.Views.HROpsConsole", "content_text_125")}</th>
                                    <th>{readData("components.Dashboard.Views.HROpsConsole", "content_text_126")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>{readData("components.Dashboard.Views.HROpsConsole", "content_text_127")}</td>
                                    <td>{readData("components.Dashboard.Views.HROpsConsole", "content_text_128")}</td>
                                    <td>{readData("components.Dashboard.Views.HROpsConsole", "content_text_129")}</td>
                                    <td><span className={`${shared.pillBadge} ${shared.pillCoral}`}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_130")}</span></td>
                                </tr>
                                <tr>
                                    <td>{readData("components.Dashboard.Views.HROpsConsole", "content_text_131")}</td>
                                    <td>{readData("components.Dashboard.Views.HROpsConsole", "content_text_132")}</td>
                                    <td>{readData("components.Dashboard.Views.HROpsConsole", "content_text_133")}</td>
                                    <td><span className={`${shared.pillBadge} ${shared.pillAmber}`}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_134")}</span></td>
                                </tr>
                                <tr>
                                    <td>{readData("components.Dashboard.Views.HROpsConsole", "content_text_135")}</td>
                                    <td>{readData("components.Dashboard.Views.HROpsConsole", "content_text_136")}</td>
                                    <td>{readData("components.Dashboard.Views.HROpsConsole", "content_text_137")}</td>
                                    <td><span className={`${shared.pillBadge} ${shared.pillSky}`}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_138")}</span></td>
                                </tr>
                                <tr>
                                    <td>{readData("components.Dashboard.Views.HROpsConsole", "content_text_139")}</td>
                                    <td>{readData("components.Dashboard.Views.HROpsConsole", "content_text_140")}</td>
                                    <td>{readData("components.Dashboard.Views.HROpsConsole", "content_text_141")}</td>
                                    <td><span className={`${shared.pillBadge} ${shared.pillTeal}`}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_142")}</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 6. Requests by Type (col-6) */}
                <div className={`${shared.widgetCard} ${shared.col6}`}>
                    <div className={shared.cardTitleRow}>
                        <div className={shared.cardTitleLeft}>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_143")}</h3>
                            <span className={shared.cardSublabel}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_144")}</span>
                        </div>
                    </div>
                    <div className={shared.cardBody}>
                        <NucleusChart option={requestsByTypeOption} style={{ height: 230 }} />
                    </div>
                </div>

                {/* 7. This Week's People Moments (col-6) */}
                <div className={`${shared.widgetCard} ${shared.col6}`}>
                    <div className={shared.cardTitleRow}>
                        <div className={shared.cardTitleLeft}>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_145")}</h3>
                            <span className={shared.cardSublabel}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_146")}</span>
                        </div>
                    </div>
                    <div className={shared.cardBody}>
                        <table className={shared.dataTable}>
                            <tbody>
                                <tr>
                                    <td>
                                        <strong>{readData("components.Dashboard.Views.HROpsConsole", "content_text_147")}</strong>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-2)' }}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_148")}</div>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <button className={shared.btnRowAction} onClick={() => launchAction('kudos', readData("components.Dashboard.Views.HROpsConsole", "content_149"))}>
                                            <Send size={12} />{readData("components.Dashboard.Views.HROpsConsole", "content_text_150")}</button>
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <strong>{readData("components.Dashboard.Views.HROpsConsole", "content_text_151")}</strong>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-2)' }}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_152")}</div>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <button className={shared.btnRowAction} onClick={() => launchAction('probation', readData("components.Dashboard.Views.HROpsConsole", "content_153"))}>
                                            <Check size={12} />{readData("components.Dashboard.Views.HROpsConsole", "content_text_154")}</button>
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <strong>{readData("components.Dashboard.Views.HROpsConsole", "content_text_155")}</strong>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-2)' }}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_156")}</div>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <button className={shared.btnRowAction} onClick={() => launchAction('returnPlan', readData("components.Dashboard.Views.HROpsConsole", "content_157"))}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_158")}</button>
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <strong>{readData("components.Dashboard.Views.HROpsConsole", "content_text_159")}</strong>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-2)' }}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_160")}</div>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <span className={`${shared.pillBadge} ${shared.pillTeal}`}>{readData("components.Dashboard.Views.HROpsConsole", "content_text_161")}</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Approval Action Modal (Reject with compulsory remark, Re-route with compulsory target & remark, Approve with optional remark) */}
            <ApprovalActionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                item={modalItem}
                initialAction={modalAction}
                onSubmit={handleModalSubmit}
            />
        </div>
    );
}
