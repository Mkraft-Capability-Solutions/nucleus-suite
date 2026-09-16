"use client";
import { readData } from '../../services/workspace-data.mjs';

import React, { useState } from 'react';
import {
    Target, Award, TrendingUp, CheckCircle, Clock, Zap, MessageSquare,
    Sparkles, Plus, Grid, ShieldAlert, UserCheck, ChevronRight
} from 'lucide-react';
import styles from './PerformanceView.module.css';
import { useHRMS } from '@/context/HRMSContext';
import { launchAction } from '@/lib/action-launcher';

const PerformanceView = ({ onNavigate, onSelectConsole }) => {
    const { okrs, addGoal, talentMatrix, showToast } = useHRMS();
    const [activeSection, setActiveSection] = useState(readData("components.Workspace.PerformanceView", "initialState_1"));

    return (
        <div className={styles.perfContainer}>
            {/* Header */}
            <div className={styles.headerRow}>
                <div className={styles.titleBlock}>
                    <h2>{readData("components.Workspace.PerformanceView", "PerformanceView_text_1")}</h2>
                    <p>{readData("components.Workspace.PerformanceView", "PerformanceView_text_2")}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {(onNavigate || onSelectConsole) && (
                        <button
                            className={styles.btnSecondary}
                            onClick={() => {
                                if (onSelectConsole) onSelectConsole('S6');
                                if (onNavigate) onNavigate('dashboard', 'dashboard', 's6');
                            }}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                border: '1px solid rgba(155, 140, 255, 0.4)',
                                background: 'rgba(155, 140, 255, 0.12)',
                                color: '#9B8CFF',
                                fontWeight: 700
                            }}
                            title={readData("components.Workspace.PerformanceView", "PerformanceView_title_3")}
                        >
                            <TrendingUp size={15} />{readData("components.Workspace.PerformanceView", "PerformanceView_text_4")}</button>
                    )}
                    <button className={styles.btnSecondary} onClick={() => launchAction('feedback360')}>
                        <MessageSquare size={16} />{readData("components.Workspace.PerformanceView", "PerformanceView_text_5")}</button>
                    <button className={styles.btnPrimary} onClick={() => launchAction('okr')}>
                        <Plus size={16} />{readData("components.Workspace.PerformanceView", "PerformanceView_text_6")}</button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className={styles.tabNav}>
                <button
                    className={`${styles.tabBtn} ${activeSection === 'okrs' ? styles.activeTab : ''}`}
                    onClick={() => setActiveSection('okrs')}
                >
                    <Target size={16} />{readData("components.Workspace.PerformanceView", "PerformanceView_text_7")}</button>
                <button
                    className={`${styles.tabBtn} ${activeSection === 'ninebox' ? styles.activeTab : ''}`}
                    onClick={() => setActiveSection('ninebox')}
                >
                    <Grid size={16} />{readData("components.Workspace.PerformanceView", "PerformanceView_text_8")}</button>
                <button
                    className={`${styles.tabBtn} ${activeSection === 'coach' ? styles.activeTab : ''}`}
                    onClick={() => setActiveSection('coach')}
                >
                    <Sparkles size={16} />{readData("components.Workspace.PerformanceView", "PerformanceView_text_9")}</button>
                <button
                    className={`${styles.tabBtn} ${activeSection === 'succession' ? styles.activeTab : ''}`}
                    onClick={() => setActiveSection('succession')}
                >
                    <ShieldAlert size={16} />{readData("components.Workspace.PerformanceView", "PerformanceView_text_10")}</button>
            </div>

            {/* Section 1: Cascading OKRs */}
            {activeSection === 'okrs' && (
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h3><Target size={20} color="var(--info)" />{readData("components.Workspace.PerformanceView", "PerformanceView_text_11")}</h3>
                        <span style={{ fontSize: '0.85rem', color: 'var(--signal)', fontWeight: '700' }}>{readData("components.Workspace.PerformanceView", "PerformanceView_text_12")}</span>
                    </div>

                    {okrs.map((okr) => (
                        <div key={okr.id} className={styles.okrItem}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <div>
                                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--info)', textTransform: 'uppercase' }}>
                                        {okr.level}
                                    </span>
                                    <strong style={{ display: 'block', fontSize: '1.05rem', color: 'var(--text)' }}>{okr.title}</strong>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--info)' }}>{okr.progress}{readData("components.Workspace.PerformanceView", "PerformanceView_text_13")}</div>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{readData("components.Workspace.PerformanceView", "PerformanceView_text_14")}{okr.weight}{readData("components.Workspace.PerformanceView", "PerformanceView_text_15")}</span>
                                </div>
                            </div>

                            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                {okr.keyResults.map((kr, idx) => (
                                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.88rem' }}>
                                        <span style={{ flex: 2, color: 'var(--text)' }}>{kr.label}</span>
                                        <div className={styles.progressTrack}>
                                            <div className={styles.progressBar} style={{ width: `${kr.progress}%` }}></div>
                                        </div>
                                        <strong style={{ width: '40px', textAlign: 'right', fontSize: '0.82rem', color: 'var(--text)' }}>{kr.progress}{readData("components.Workspace.PerformanceView", "PerformanceView_text_16")}</strong>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Section 2: 9-Box Calibration Workbench */}
            {activeSection === 'ninebox' && (
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h3><Grid size={20} color="var(--info)" />{readData("components.Workspace.PerformanceView", "PerformanceView_text_17")}</h3>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-2)' }}>{readData("components.Workspace.PerformanceView", "PerformanceView_text_18")}</span>
                    </div>

                    <div className={styles.nineBoxGrid}>
                        {/* High Potential Row */}
                        <div className={styles.nineBoxCell}>
                            <span className={styles.cellTitle}>{readData("components.Workspace.PerformanceView", "PerformanceView_text_19")}</span>
                            <div className={styles.cellTalent}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{readData("components.Workspace.PerformanceView", "PerformanceView_text_20")}</span>
                            </div>
                        </div>
                        <div className={styles.nineBoxCell} style={{ background: 'var(--info-wash)', borderColor: 'var(--line)' }}>
                            <span className={styles.cellTitle} style={{ color: 'var(--info)' }}>{readData("components.Workspace.PerformanceView", "PerformanceView_text_21")}</span>
                            <div className={styles.cellTalent}>
                                <div className={styles.talentChip}>
                                    <UserCheck size={14} color="var(--info)" />{readData("components.Workspace.PerformanceView", "PerformanceView_text_22")}</div>
                            </div>
                        </div>
                        <div className={styles.nineBoxCell} style={{ background: 'var(--signal-wash)', borderColor: 'var(--line)' }}>
                            <span className={styles.cellTitle} style={{ color: 'var(--signal-ink)' }}>{readData("components.Workspace.PerformanceView", "PerformanceView_text_23")}</span>
                            <div className={styles.cellTalent}>
                                <div className={styles.talentChip} style={{ border: '2px solid var(--signal)' }}>
                                    <Sparkles size={14} color="var(--signal)" />{readData("components.Workspace.PerformanceView", "PerformanceView_text_24")}</div>
                            </div>
                        </div>

                        {/* Mid Potential Row */}
                        <div className={styles.nineBoxCell}>
                            <span className={styles.cellTitle}>{readData("components.Workspace.PerformanceView", "PerformanceView_text_25")}</span>
                        </div>
                        <div className={styles.nineBoxCell}>
                            <span className={styles.cellTitle}>{readData("components.Workspace.PerformanceView", "PerformanceView_text_26")}</span>
                            <div className={styles.cellTalent}>
                                <div className={styles.talentChip}>
                                    <UserCheck size={14} color="var(--text-2)" />{readData("components.Workspace.PerformanceView", "PerformanceView_text_27")}</div>
                            </div>
                        </div>
                        <div className={styles.nineBoxCell} style={{ background: 'var(--signal-wash)', borderColor: 'var(--line)' }}>
                            <span className={styles.cellTitle} style={{ color: 'var(--signal-ink)' }}>{readData("components.Workspace.PerformanceView", "PerformanceView_text_28")}</span>
                            <div className={styles.cellTalent}>
                                <div className={styles.talentChip}>
                                    <UserCheck size={14} color="var(--signal)" />{readData("components.Workspace.PerformanceView", "PerformanceView_text_29")}</div>
                            </div>
                        </div>

                        {/* Low Potential Row */}
                        <div className={styles.nineBoxCell}>
                            <span className={styles.cellTitle}>{readData("components.Workspace.PerformanceView", "PerformanceView_text_30")}</span>
                        </div>
                        <div className={styles.nineBoxCell}>
                            <span className={styles.cellTitle}>{readData("components.Workspace.PerformanceView", "PerformanceView_text_31")}</span>
                        </div>
                        <div className={styles.nineBoxCell}>
                            <span className={styles.cellTitle}>{readData("components.Workspace.PerformanceView", "PerformanceView_text_32")}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Section 3: AI Manager Coach */}
            {activeSection === 'coach' && (
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h3><Sparkles size={20} color="var(--agent)" />{readData("components.Workspace.PerformanceView", "PerformanceView_text_33")}</h3>
                        <span style={{ fontSize: '0.85rem', color: 'var(--agent)', fontWeight: '600' }}>{readData("components.Workspace.PerformanceView", "PerformanceView_text_34")}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ background: 'var(--agent-wash)', border: '1px solid var(--line)', borderRadius: 'var(--r-card, 8px)', padding: '1.25rem' }}>
                            <strong style={{ color: 'var(--agent)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Sparkles size={16} />{readData("components.Workspace.PerformanceView", "PerformanceView_text_35")}</strong>
                            <p style={{ fontSize: '0.88rem', color: 'var(--text)', margin: '0.5rem 0' }}>{readData("components.Workspace.PerformanceView", "PerformanceView_text_36")}</p>
                            <button className={styles.btnPrimary} style={{ background: 'var(--agent)', fontSize: '0.8rem', padding: '0.35rem 0.85rem' }} onClick={() => launchAction('growthAction')}>{readData("components.Workspace.PerformanceView", "PerformanceView_text_37")}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Section 4: Succession Risk Scorer */}
            {activeSection === 'succession' && (
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h3><ShieldAlert size={20} color="var(--flag)" />{readData("components.Workspace.PerformanceView", "PerformanceView_text_38")}</h3>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ background: 'var(--flag-wash)', border: '1px solid var(--line)', borderRadius: 'var(--r-card, 8px)', padding: '1.25rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <strong style={{ color: 'var(--flag)' }}>{readData("components.Workspace.PerformanceView", "PerformanceView_text_39")}</strong>
                                <span style={{ color: 'var(--flag)', fontWeight: '700', fontSize: '0.85rem' }}>{readData("components.Workspace.PerformanceView", "PerformanceView_text_40")}</span>
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text)', margin: '0.4rem 0' }}>{readData("components.Workspace.PerformanceView", "PerformanceView_text_41")}<strong>{readData("components.Workspace.PerformanceView", "PerformanceView_text_42")}</strong>{readData("components.Workspace.PerformanceView", "PerformanceView_text_43")}<strong>{readData("components.Workspace.PerformanceView", "PerformanceView_text_44")}</strong>{readData("components.Workspace.PerformanceView", "PerformanceView_text_45")}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PerformanceView;
