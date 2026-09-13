"use client";
import { readData } from '../../../services/workspace-data.mjs';

import React, { useState } from 'react';
import {
    Sparkles, ShieldCheck, Database, Sliders, CheckCircle2,
    AlertTriangle, ArrowUpRight, Search, FileText, Lock, Eye, Play
} from 'lucide-react';
import NucleusChart from '@/components/Charts/NucleusChart';
import { NUCLEUS_COLORS } from '@/components/Charts/theme';
import shared from '../DashboardShared.module.css';
import { launchAction } from '@/lib/action-launcher';

export default function NucleusIntelligence({ onNavigate }) {
    const [query, setQuery] = useState(
        readData("components.Dashboard.Views.NucleusIntelligence", "initialState_1")
    );
    const [savedToast, setSavedToast] = useState(false);

    // Generated First-Year Attrition Chart
    const attritionShiftOption = {
        ...readData("components.Dashboard.Views.NucleusIntelligence", "attritionShiftOption_fields_1"),
        legend: {
            ...readData("components.Dashboard.Views.NucleusIntelligence", "legend_fields_4"),
            textStyle: { color: NUCLEUS_COLORS.textMuted, ...readData("components.Dashboard.Views.NucleusIntelligence", "textStyle_fields_6") }
        },
        ...readData("components.Dashboard.Views.NucleusIntelligence", "attritionShiftOption_fields_2"),
        series: [
            {
                ...readData("components.Dashboard.Views.NucleusIntelligence", "series_fields_9"),
                itemStyle: { color: NUCLEUS_COLORS.sky },
                ...readData("components.Dashboard.Views.NucleusIntelligence", "series_fields_10")
            },
            {
                ...readData("components.Dashboard.Views.NucleusIntelligence", "series_fields_12"),
                itemStyle: { color: NUCLEUS_COLORS.violet },
                ...readData("components.Dashboard.Views.NucleusIntelligence", "series_fields_13")
            }
        ]
    };

    const handleSaveWidget = () => {
        setSavedToast(true);
        setTimeout(() => setSavedToast(false), 3500);
    };

    return (
        <div className={shared.dashboardWrapper}>
            {/* Header */}
            <div className={shared.pageHeader}>
                <div>
                    <div className={shared.badgeRow}>
                        <span className={`${shared.badge} ${shared.badgeViolet}`}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_15")}</span>
                        <span className={`${shared.badge} ${shared.badgeTeal}`}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_16")}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-2)' }}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_17")}</span>
                    </div>
                    <h1 className={shared.screenTitle}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_18")}</h1>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button className={shared.secondaryBtn} onClick={() => onNavigate && onNavigate('settings')}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_19")}</button>
                    <button className={shared.primaryBtn} onClick={() => launchAction('widget')}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_20")}</button>
                </div>
            </div>

            {savedToast && (
                <div style={{
                    padding: '0.65rem 1rem',
                    background: 'rgba(155, 140, 255, 0.15)',
                    border: '1px solid #9B8CFF',
                    borderRadius: '6px',
                    color: '#9B8CFF',
                    fontSize: '0.78rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <CheckCircle2 size={16} />
                    <span>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_21")}</span>
                </div>
            )}

            {/* Natural Language Query Bar & Evidence Box (W25) */}
            <div className={shared.card} style={{ marginBottom: '1.25rem', border: '1px solid rgba(155, 140, 255, 0.35)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{
                        width: 34,
                        height: 34,
                        borderRadius: 6,
                        background: 'rgba(155, 140, 255, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#9B8CFF'
                    }}>
                        <Sparkles size={18} />
                    </div>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        style={{
                            flex: 1,
                            background: 'var(--card-2)',
                            border: '1px solid #1C3450',
                            borderRadius: '6px',
                            padding: '0.6rem 0.85rem',
                            color: 'var(--text)',
                            fontSize: '0.85rem',
                            fontWeight: 500
                        }}
                    />
                    <button className={shared.primaryBtn} style={{ background: '#9B8CFF', color: '#060D18', fontWeight: 700 }}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_22")}</button>
                </div>

                {/* AI Synthesized Answer */}
                <div style={{
                    background: 'rgba(155, 140, 255, 0.06)',
                    borderLeft: '3px solid #9B8CFF',
                    padding: '0.85rem 1rem',
                    borderRadius: '0 6px 6px 0'
                }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text)', lineHeight: 1.55, margin: 0 }}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_23")}<strong>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_24")}</strong>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_25")}<em>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_26")}</em>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_27")}</p>
                    <div style={{
                        marginTop: '0.65rem',
                        fontSize: '0.7rem',
                        color: 'var(--text-2)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_28")}<strong>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_29")}</strong>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_30")}</span>
                        <div style={{ display: 'flex', gap: '0.65rem' }}>
                            <button onClick={() => launchAction('widget')} className={shared.textBtn} style={{ color: '#05CD99' }}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_31")}</button>
                            <button className={shared.textBtn} style={{ color: '#4FB6F5' }}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_32")}</button>
                            <button className={shared.textBtn} style={{ color: 'var(--text-2)' }}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_33")}</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Generated Chart + Overnight Model Findings */}
            <div className={shared.grid12} style={{ marginBottom: '1.25rem' }}>
                <div className={`${shared.card} ${shared.col7}`}>
                    <div className={shared.cardHeader}>
                        <div>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_34")}</h3>
                            <p className={shared.cardSubtitle}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_35")}</p>
                        </div>
                        <span className={`${shared.badge} ${shared.badgeViolet}`}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_36")}</span>
                    </div>
                    <NucleusChart option={attritionShiftOption} height="280px" />
                </div>

                <div className={`${shared.card} ${shared.col5}`}>
                    <div className={shared.cardHeader}>
                        <div>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_37")}</h3>
                            <p className={shared.cardSubtitle}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_38")}</p>
                        </div>
                        <span className={`${shared.badge} ${shared.badgeCoral}`}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_39")}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {[
                            { ...readData("components.Dashboard.Views.NucleusIntelligence", "content_fields_40"), badge: shared.badgeCoral },
                            { ...readData("components.Dashboard.Views.NucleusIntelligence", "content_fields_41"), badge: shared.badgeCoral },
                            { ...readData("components.Dashboard.Views.NucleusIntelligence", "content_fields_42"), badge: shared.badgeAmber },
                            { ...readData("components.Dashboard.Views.NucleusIntelligence", "content_fields_43"), badge: shared.badgeAmber },
                            { ...readData("components.Dashboard.Views.NucleusIntelligence", "content_fields_44"), badge: shared.badgeSky },
                            { ...readData("components.Dashboard.Views.NucleusIntelligence", "content_fields_45"), badge: shared.badgeTeal },
                        ].map((f, i) => (
                            <div key={i} style={{
                                padding: '0.5rem 0.65rem',
                                background: 'var(--card-2)',
                                border: '1px solid rgba(28, 52, 80, 0.45)',
                                borderRadius: '6px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span className={`${shared.badge} ${f.badge}`} style={{ fontSize: '0.62rem' }}>{f.sev}</span>
                                    <span style={{ fontSize: '0.74rem', color: 'var(--text)' }}>{f.text}</span>
                                </div>
                                <span style={{ fontSize: '0.68rem', color: '#5C7896' }}>{f.domain}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Autonomous Agents Permissions + Model Register */}
            <div className={shared.grid12}>
                {/* Agent Permission & Governance Table */}
                <div className={`${shared.card} ${shared.col6}`}>
                    <div className={shared.cardHeader}>
                        <div>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_46")}</h3>
                            <p className={shared.cardSubtitle}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_47")}</p>
                        </div>
                        <span className={`${shared.badge} ${shared.badgeTeal}`}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_48")}</span>
                    </div>
                    <div className={shared.tableWrapper}>
                        <table className={shared.table}>
                            <thead>
                                <tr>
                                    <th>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_49")}</th>
                                    <th>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_50")}</th>
                                    <th>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_51")}</th>
                                    <th>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_52")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><strong>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_53")}</strong></td>
                                    <td>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_54")}</td>
                                    <td>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_55")}</td>
                                    <td><span className={`${shared.badge} ${shared.badgeAmber}`}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_56")}</span></td>
                                </tr>
                                <tr>
                                    <td><strong>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_57")}</strong></td>
                                    <td>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_58")}</td>
                                    <td>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_59")}</td>
                                    <td><span className={`${shared.badge} ${shared.badgeTeal}`}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_60")}</span></td>
                                </tr>
                                <tr>
                                    <td><strong>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_61")}</strong></td>
                                    <td>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_62")}</td>
                                    <td>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_63")}</td>
                                    <td><span className={`${shared.badge} ${shared.badgeTeal}`}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_64")}</span></td>
                                </tr>
                                <tr>
                                    <td><strong>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_65")}</strong></td>
                                    <td>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_66")}</td>
                                    <td>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_67")}</td>
                                    <td><span className={`${shared.badge} ${shared.badgeTeal}`}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_68")}</span></td>
                                </tr>
                                <tr>
                                    <td><strong>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_69")}</strong></td>
                                    <td>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_70")}</td>
                                    <td>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_71")}</td>
                                    <td><span className={`${shared.badge} ${shared.badgeAmber}`}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_72")}</span></td>
                                </tr>
                                <tr style={{ background: 'rgba(242, 100, 126, 0.08)' }}>
                                    <td><strong style={{ color: '#F2647E' }}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_73")}</strong></td>
                                    <td>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_74")}</td>
                                    <td>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_75")}</td>
                                    <td><span className={`${shared.badge} ${shared.badgeCoral}`}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_76")}</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Model Register Table */}
                <div className={`${shared.card} ${shared.col6}`}>
                    <div className={shared.cardHeader}>
                        <div>
                            <h3 className={shared.cardTitle}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_77")}</h3>
                            <p className={shared.cardSubtitle}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_78")}</p>
                        </div>
                        <span className={`${shared.badge} ${shared.badgeViolet}`}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_79")}</span>
                    </div>
                    <div className={shared.tableWrapper}>
                        <table className={shared.table}>
                            <thead>
                                <tr>
                                    <th>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_80")}</th>
                                    <th>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_81")}</th>
                                    <th>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_82")}</th>
                                    <th>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_83")}</th>
                                    <th>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_84")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><strong>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_85")}</strong></td>
                                    <td>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_86")}</td>
                                    <td>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_87")}</td>
                                    <td><span style={{ color: '#05CD99', fontWeight: 700 }}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_88")}</span></td>
                                    <td>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_89")}</td>
                                </tr>
                                <tr>
                                    <td><strong>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_90")}</strong></td>
                                    <td>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_91")}</td>
                                    <td>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_92")}</td>
                                    <td><span style={{ color: '#05CD99', fontWeight: 700 }}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_93")}</span></td>
                                    <td>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_94")}</td>
                                </tr>
                                <tr>
                                    <td><strong>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_95")}</strong></td>
                                    <td>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_96")}</td>
                                    <td>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_97")}</td>
                                    <td><span style={{ color: '#05CD99', fontWeight: 700 }}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_98")}</span></td>
                                    <td>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_99")}</td>
                                </tr>
                                <tr>
                                    <td><strong>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_100")}</strong></td>
                                    <td>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_101")}</td>
                                    <td>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_102")}</td>
                                    <td><span style={{ color: '#05CD99', fontWeight: 700 }}>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_103")}</span></td>
                                    <td>{readData("components.Dashboard.Views.NucleusIntelligence", "content_text_104")}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
