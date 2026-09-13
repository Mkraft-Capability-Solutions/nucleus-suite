"use client";
import { readData } from '../../../services/workspace-data.mjs';

import React, { useState } from 'react';
import {
    Check, Sparkles, MessageSquare, AlertCircle, Clock, Users,
    Calendar, ShieldAlert, Award, FileText, ChevronRight
} from 'lucide-react';
import NucleusChart from '@/components/Charts/NucleusChart';
import { NUCLEUS_COLORS } from '@/components/Charts/theme';
import shared from '../DashboardShared.module.css';
import ApprovalActionModal from '../Modals/ApprovalActionModal';
import { launchAction } from '@/lib/action-launcher';

export default function ManagerCockpit({ onNavigate }) {
    const [approvals, setApprovals] = useState(readData("components.Dashboard.Views.ManagerCockpit", "approvals_1"));
    const [undoToast, setUndoToast] = useState(null);
    const [modalItem, setModalItem] = useState(null);
    const [modalAction, setModalAction] = useState(readData("components.Dashboard.Views.ManagerCockpit", "initialState_1"));
    const [isModalOpen, setIsModalOpen] = useState(false);

    const openApprovalModal = (item, action = readData("components.Dashboard.Views.ManagerCockpit", "defaultValue_2")) => {
        setModalItem(item);
        setModalAction(action);
        setIsModalOpen(true);
    };

    const handleModalSubmit = ({ id, actionType, remarks, rerouteTargetName, item }) => {
        setApprovals(prev => prev.filter(a => a.id !== id));
        if (actionType === 'approve') {
            setUndoToast(`✓ Approved ${item.name} (${item.type})${remarks ? ` • Note: ${remarks}` : ''}`);
        } else if (actionType === 'reject') {
            setUndoToast(`✕ Rejected ${item.name} (${item.type}) • Reason: ${remarks}`);
        } else if (actionType === 'reroute') {
            setUndoToast(`↷ Re-routed ${item.name} (${item.type}) to ${rerouteTargetName} • Note: ${remarks}`);
        }
        setTimeout(() => setUndoToast(null), 4500);
    };

    // 1. Team Capacity Next 4 Weeks (Stacked Bar)
    const capacityOption = {
        ...readData("components.Dashboard.Views.ManagerCockpit", "capacityOption_fields_2"),
        legend: {
            ...readData("components.Dashboard.Views.ManagerCockpit", "legend_fields_5"),
            textStyle: { color: NUCLEUS_COLORS.textMuted, ...readData("components.Dashboard.Views.ManagerCockpit", "textStyle_fields_7") }
        },
        ...readData("components.Dashboard.Views.ManagerCockpit", "capacityOption_fields_3"),
        xAxis: {
            ...readData("components.Dashboard.Views.ManagerCockpit", "xAxis_fields_9"),
            axisLabel: { color: NUCLEUS_COLORS.textPrimary, ...readData("components.Dashboard.Views.ManagerCockpit", "axisLabel_fields_11") }
        },
        yAxis: {
            ...readData("components.Dashboard.Views.ManagerCockpit", "yAxis_fields_12"),
            splitLine: { lineStyle: { color: NUCLEUS_COLORS.lineMuted } }
        },
        series: [
            {
                ...readData("components.Dashboard.Views.ManagerCockpit", "series_fields_14"),
                itemStyle: { color: NUCLEUS_COLORS.teal }
            },
            {
                ...readData("components.Dashboard.Views.ManagerCockpit", "series_fields_16"),
                itemStyle: { color: NUCLEUS_COLORS.amber }
            },
            {
                ...readData("components.Dashboard.Views.ManagerCockpit", "series_fields_18"),
                itemStyle: { color: NUCLEUS_COLORS.sky }
            }
        ]
    };

    // 2. Team Skill Coverage Radar
    const skillRadarOption = {
        ...readData("components.Dashboard.Views.ManagerCockpit", "skillRadarOption_fields_20"),
        series: [{
            ...readData("components.Dashboard.Views.ManagerCockpit", "series_fields_22"),
            data: [{
                ...readData("components.Dashboard.Views.ManagerCockpit", "data_fields_23"),
                itemStyle: { color: NUCLEUS_COLORS.teal },
                ...readData("components.Dashboard.Views.ManagerCockpit", "data_fields_24")
            }]
        }]
    };

    return (
        <div className={shared.dashboardCanvas}>
            {/* Scope & Quick Actions */}
            <div className={shared.scopeBar}>
                <div className={shared.scopeLeft}>
                    <h2 className={shared.screenTitle}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_27")}</h2>
                    <span className={shared.scopeMetadata}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_28")}</span>
                    <span className={shared.scopePill}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_29")}</span>
                </div>
                <div className={shared.scopeRight}>
                    <button className={shared.scopeBtn} disabled title={readData("components.Dashboard.Views.ManagerCockpit", "unavailableAction")}>
                        <FileText size={14} />{readData("components.Dashboard.Views.ManagerCockpit", "content_text_30")}</button>
                    <button className={`${shared.scopeBtn} ${shared.scopeBtnPrimary}`} onClick={() => launchAction('oneOnOne')}>
                        <MessageSquare size={14} />{readData("components.Dashboard.Views.ManagerCockpit", "content_text_31")}</button>
                </div>
            </div>

            {/* Undo Toast */}
            {undoToast && (
                <div style={{
                    padding: '0.6rem 1rem',
                    background: 'var(--card-2)',
                    border: '1px solid #05CD99',
                    borderRadius: '6px',
                    color: 'var(--text)',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <span>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_32")}{undoToast}</span>
                    <span style={{ color: '#05CD99', fontWeight: 700, cursor: 'pointer' }} onClick={() => setUndoToast(null)}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_33")}</span>
                </div>
            )}

            {/* 4 Team Action KPIs */}
            <div className={shared.grid12}>
                <div className={shared.kpiTile} style={{ gridColumn: 'span 3' }}>
                    <span className={shared.kpiLabel}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_34")}</span>
                    <div className={shared.kpiValueRow}>
                        <span className={shared.kpiValue}>{approvals.length}</span>
                        <span className={`${shared.kpiDelta} ${shared.deltaRisk}`}>
                            <AlertCircle size={14} />{readData("components.Dashboard.Views.ManagerCockpit", "content_text_35")}</span>
                    </div>
                    <span className={shared.kpiSub}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_36")}</span>
                </div>

                <div className={shared.kpiTile} style={{ gridColumn: 'span 3' }}>
                    <span className={shared.kpiLabel}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_37")}</span>
                    <div className={shared.kpiValueRow}>
                        <span className={shared.kpiValue}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_38")}</span>
                        <span className={`${shared.kpiDelta} ${shared.deltaAttention}`}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_39")}</span>
                    </div>
                    <span className={shared.kpiSub}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_40")}</span>
                </div>

                <div className={shared.kpiTile} style={{ gridColumn: 'span 3' }}>
                    <span className={shared.kpiLabel}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_41")}</span>
                    <div className={shared.kpiValueRow}>
                        <span className={shared.kpiValue}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_42")}</span>
                        <span className={`${shared.kpiDelta} ${shared.deltaNeutral}`}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_43")}</span>
                    </div>
                    <span className={shared.kpiSub}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_44")}</span>
                </div>

                <div className={shared.kpiTile} style={{ gridColumn: 'span 3' }}>
                    <span className={shared.kpiLabel}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_45")}</span>
                    <div className={shared.kpiValueRow}>
                        <span className={shared.kpiValue}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_46")}</span>
                        <span className={`${shared.kpiDelta} ${shared.deltaPositive}`}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_47")}</span>
                    </div>
                    <span className={shared.kpiSub}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_48")}</span>
                </div>
            </div>

            {/* The Weekly Brief is Three Items, Capped */}
            <div className={shared.aiNarrativeCard}>
                <div className={shared.narrativeHeader}>
                    <span className={shared.narrativeBadge}>
                        <Sparkles size={14} />{readData("components.Dashboard.Views.ManagerCockpit", "content_text_49")}</span>
                    <span className={shared.narrativeTime}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_50")}</span>
                </div>
                <p className={shared.narrativeBody}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_51")}<strong>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_52")}</strong>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_53")}<strong>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_54")}</strong>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_55")}<strong>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_56")}</strong>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_57")}</p>
            </div>

            {/* Row: Inline Approvals + Capacity + Skill Coverage */}
            <div className={shared.grid12}>
                {/* 1. Inline 1-Click Approvals (col-5) */}
                <div className={`${shared.widgetCard} ${shared.col5 || readData("components.Dashboard.Views.ManagerCockpit", "fallback_1")}`} style={{ gridColumn: 'span 5' }}>
                    <div className={shared.cardTitleRow}>
                        <div className={shared.cardTitleLeft}>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_58")}</h3>
                            <span className={shared.cardSublabel}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_59")}</span>
                        </div>
                    </div>
                    <div className={shared.cardBody}>
                        {approvals.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-2)', fontSize: '0.8rem' }}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_60")}</div>
                        ) : (
                            <table className={shared.dataTable}>
                                <tbody>
                                    {approvals.map(a => (
                                        <tr key={a.id}>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{a.name}</div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-2)' }}>{a.type}</div>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.35rem', flexWrap: 'wrap' }}>
                                                    <span className={`${shared.pillBadge} ${a.isSLA ? shared.pillCoral : shared.pillSlate}`} style={{ marginRight: 4 }}>
                                                        {a.age} {a.isSLA ? readData("components.Dashboard.Views.ManagerCockpit", "display_3") : ''}
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
                                                        onClick={() => openApprovalModal(a, 'approve')}
                                                        title={readData("components.Dashboard.Views.ManagerCockpit", "content_title_61")}
                                                    >{readData("components.Dashboard.Views.ManagerCockpit", "content_text_62")}</button>
                                                    <button
                                                        className={shared.btnRowAction}
                                                        style={{
                                                            color: '#F43F5E',
                                                            borderColor: 'rgba(244, 63, 94, 0.35)',
                                                            background: 'rgba(244, 63, 94, 0.08)',
                                                            fontSize: '0.7rem',
                                                            padding: '0.2rem 0.5rem'
                                                        }}
                                                        onClick={() => openApprovalModal(a, 'reject')}
                                                        title={readData("components.Dashboard.Views.ManagerCockpit", "content_title_63")}
                                                    >{readData("components.Dashboard.Views.ManagerCockpit", "content_text_64")}</button>
                                                    <button
                                                        className={shared.btnRowAction}
                                                        style={{
                                                            color: 'var(--agent)',
                                                            borderColor: 'rgba(155, 140, 255, 0.35)',
                                                            background: 'rgba(155, 140, 255, 0.08)',
                                                            fontSize: '0.7rem',
                                                            padding: '0.2rem 0.5rem'
                                                        }}
                                                        onClick={() => openApprovalModal(a, 'reroute')}
                                                        title={readData("components.Dashboard.Views.ManagerCockpit", "content_title_65")}
                                                    >{readData("components.Dashboard.Views.ManagerCockpit", "content_text_66")}</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* 2. Team Capacity Next 4 Weeks (col-4) */}
                <div className={`${shared.widgetCard} ${shared.col4}`}>
                    <div className={shared.cardTitleRow}>
                        <div className={shared.cardTitleLeft}>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_67")}</h3>
                            <span className={shared.cardSublabel}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_68")}</span>
                        </div>
                    </div>
                    <div className={shared.cardBody}>
                        <NucleusChart option={capacityOption} style={{ height: 230 }} />
                    </div>
                </div>

                {/* 3. Team Skill Coverage Radar (col-3) */}
                <div className={`${shared.widgetCard} ${shared.col3}`}>
                    <div className={shared.cardTitleRow}>
                        <div className={shared.cardTitleLeft}>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_69")}</h3>
                            <span className={shared.cardSublabel}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_70")}</span>
                        </div>
                    </div>
                    <div className={shared.cardBody}>
                        <NucleusChart option={skillRadarOption} style={{ height: 230 }} />
                    </div>
                </div>
            </div>

            {/* "My Team" Roster Table with Signals Column */}
            <div className={shared.widgetCard} style={{ width: '100%' }}>
                <div className={shared.cardTitleRow}>
                    <div className={shared.cardTitleLeft}>
                        <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_71")}</h3>
                        <span className={shared.cardSublabel}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_72")}</span>
                    </div>
                </div>
                <div className={shared.cardBody}>
                    <table className={shared.dataTable}>
                        <thead>
                            <tr>
                                <th>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_73")}</th>
                                <th>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_74")}</th>
                                <th>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_75")}</th>
                                <th>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_76")}</th>
                                <th>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_77")}</th>
                                <th>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_78")}</th>
                                <th>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_79")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><strong>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_80")}</strong></td>
                                <td>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_81")}</td>
                                <td>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_82")}</td>
                                <td><span className={`${shared.pillBadge} ${shared.pillTeal}`}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_83")}</span></td>
                                <td>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_84")}</td>
                                <td>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_85")}</td>
                                <td><span style={{ color: 'var(--text-2)' }}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_86")}</span></td>
                            </tr>
                            <tr>
                                <td><strong>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_87")}</strong></td>
                                <td>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_88")}</td>
                                <td>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_89")}</td>
                                <td><span className={`${shared.pillBadge} ${shared.pillTeal}`}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_90")}</span></td>
                                <td>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_91")}</td>
                                <td><span className={`${shared.pillBadge} ${shared.pillCoral}`}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_92")}</span></td>
                                <td><span className={`${shared.pillBadge} ${shared.pillCoral}`}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_93")}</span></td>
                            </tr>
                            <tr>
                                <td><strong>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_94")}</strong></td>
                                <td>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_95")}</td>
                                <td>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_96")}</td>
                                <td><span className={`${shared.pillBadge} ${shared.pillAmber}`}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_97")}</span></td>
                                <td>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_98")}</td>
                                <td>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_99")}</td>
                                <td>
                                    <span className={`${shared.pillBadge} ${shared.pillViolet}`}>
                                        <Sparkles size={11} style={{ marginRight: 3 }} />{readData("components.Dashboard.Views.ManagerCockpit", "content_text_100")}</span>
                                </td>
                            </tr>
                            <tr>
                                <td><strong>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_101")}</strong></td>
                                <td>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_102")}</td>
                                <td>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_103")}</td>
                                <td><span className={`${shared.pillBadge} ${shared.pillTeal}`}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_104")}</span></td>
                                <td>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_105")}</td>
                                <td><span className={`${shared.pillBadge} ${shared.pillTeal}`}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_106")}</span></td>
                                <td><span className={`${shared.pillBadge} ${shared.pillTeal}`}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_107")}</span></td>
                            </tr>
                            <tr>
                                <td><strong>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_108")}</strong></td>
                                <td>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_109")}</td>
                                <td>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_110")}</td>
                                <td><span className={`${shared.pillBadge} ${shared.pillTeal}`}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_111")}</span></td>
                                <td>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_112")}</td>
                                <td>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_113")}</td>
                                <td><span className={`${shared.pillBadge} ${shared.pillAmber}`}>{readData("components.Dashboard.Views.ManagerCockpit", "content_text_114")}</span></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Approval Action Modal */}
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
