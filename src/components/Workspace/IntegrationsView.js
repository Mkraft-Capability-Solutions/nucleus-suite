"use client";
import {useTranslation} from '@/context/I18nContext';

import { readData } from '../../services/workspace-data.mjs';

import React, { useState } from 'react';
import {
    Puzzle, Terminal, Webhook, Building2, Key, CheckCircle2,
    Copy, Plus, RefreshCw, Layers, ShieldCheck, Sparkles
} from 'lucide-react';
import styles from './IntegrationsView.module.css';
import { useHRMS } from '@/context/HRMSContext';
import { launchAction } from '@/lib/action-launcher';

const IntegrationsView = () => {
    const {t: translateText}=useTranslation();

    const { connectors, apiKeys, showToast } = useHRMS();
    const [activeTab, setActiveTab] = useState(readData("components.Workspace.IntegrationsView", "initialState_1"));

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.headerRow}>
                <div className={styles.titleBlock}>
                    <h2>{readData("components.Workspace.IntegrationsView", "IntegrationsView_text_1")}</h2>
                    <p>{readData("components.Workspace.IntegrationsView", "IntegrationsView_text_2")}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className={styles.btnSecondary} onClick={() => showToast(translateText("components.Workspace.IntegrationsView","text_9d5e294999"),translateText("components.Workspace.IntegrationsView","text_9cd953818a"), 'info')}>
                        <Terminal size={16} />{readData("components.Workspace.IntegrationsView", "IntegrationsView_text_3")}</button>
                    <button className={styles.btnPrimary} onClick={() => launchAction('apiKey')}>
                        <Key size={16} />{readData("components.Workspace.IntegrationsView", "IntegrationsView_text_4")}</button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className={styles.tabNav}>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'connectors' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('connectors')}
                >
                    <Puzzle size={16} />{readData("components.Workspace.IntegrationsView", "IntegrationsView_text_5")}</button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'api' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('api')}
                >
                    <Terminal size={16} />{readData("components.Workspace.IntegrationsView", "IntegrationsView_text_6")}</button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'partner' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('partner')}
                >
                    <Building2 size={16} />{readData("components.Workspace.IntegrationsView", "IntegrationsView_text_7")}</button>
            </div>

            {/* Tab 1: Connectors */}
            {activeTab === 'connectors' && (
                <div className={styles.connectorsGrid}>
                    {connectors.map((c) => (
                        <div key={c.id} className={styles.connectorCard}>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '0.78rem', color: 'var(--info)', fontWeight: '700', textTransform: 'uppercase' }}>
                                        {c.category}
                                    </span>
                                    <span style={{ background: 'var(--signal-wash)', color: 'var(--signal-ink)', padding: '0.2rem 0.5rem', borderRadius: 'var(--r-control, 4px)', fontSize: '0.75rem', fontWeight: '700' }}>
                                        {c.status}
                                    </span>
                                </div>
                                <strong style={{ fontSize: '1.05rem', color: 'var(--text)', display: 'block' }}>{c.name}</strong>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginTop: '0.35rem' }}>{readData("components.Workspace.IntegrationsView", "IntegrationsView_text_8")}<strong>{c.syncTime}</strong>
                                </div>
                            </div>

                            <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.5rem' }}>
                                <button className={styles.btnSecondary} style={{ width: '100%', fontSize: '0.8rem', padding: '0.4rem', justifyContent: 'center' }} onClick={() => launchAction('connector', { provider: c.name })}>{readData("components.Workspace.IntegrationsView", "IntegrationsView_text_9")}</button>
                                <button className={styles.btnPrimary} style={{ width: '100%', fontSize: '0.8rem', padding: '0.4rem', justifyContent: 'center' }} onClick={() => showToast(translateText("components.Workspace.IntegrationsView","text_169dcd164f"),translateText("components.Workspace.IntegrationsView","text_d6d697b11c", {value1: String(c.name)}), 'success')}>{readData("components.Workspace.IntegrationsView", "IntegrationsView_text_10")}</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Tab 2: API Sandbox & Webhooks */}
            {activeTab === 'api' && (
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h3><Terminal size={20} color="var(--info)" />{readData("components.Workspace.IntegrationsView", "IntegrationsView_text_11")}</h3>
                        <span style={{ fontSize: '0.85rem', color: 'var(--signal)', fontWeight: '700' }}>{readData("components.Workspace.IntegrationsView", "IntegrationsView_text_12")}</span>
                    </div>

                    <div style={{ background: 'var(--card-2)', border: '1px solid var(--line)', color: 'var(--text)', padding: '1.25rem', borderRadius: 'var(--r-card, 10px)', fontFamily: 'var(--f-num, monospace)', fontSize: '0.85rem', overflowX: 'auto', marginBottom: '1.5rem' }}>
                        <div style={{ color: 'var(--text-2)', marginBottom: '0.5rem' }}>{readData("components.Workspace.IntegrationsView", "IntegrationsView_text_13")}</div>
                        <div>{`{`}</div>
                        <div style={{ paddingLeft: '1rem', color: 'var(--info)' }}>{readData("components.Workspace.IntegrationsView", "IntegrationsView_text_14")}</div>
                        <div style={{ paddingLeft: '1rem', color: 'var(--info)' }}>{readData("components.Workspace.IntegrationsView", "IntegrationsView_text_15")}</div>
                        <div style={{ paddingLeft: '1rem', color: 'var(--info)' }}>{readData("components.Workspace.IntegrationsView", "IntegrationsView_text_16")}</div>
                        <div style={{ paddingLeft: '1rem', color: 'var(--info)' }}>{readData("components.Workspace.IntegrationsView", "IntegrationsView_text_17")}</div>
                        <div style={{ paddingLeft: '1rem', color: 'var(--agent)' }}>{readData("components.Workspace.IntegrationsView", "IntegrationsView_text_18")}</div>
                        <div>{`}`}</div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <strong>{readData("components.Workspace.IntegrationsView", "IntegrationsView_text_19")}</strong>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-2)' }}>{apiKeys[0].name}{readData("components.Workspace.IntegrationsView", "IntegrationsView_text_20")}{apiKeys[0].prefix}{readData("components.Workspace.IntegrationsView", "IntegrationsView_text_21")}</div>
                        </div>
                        <button className={styles.btnSecondary} onClick={() => showToast(translateText("components.Workspace.IntegrationsView","text_8d525e5f15"),translateText("components.Workspace.IntegrationsView","text_4241b54bbc"), 'success')}>
                            <Copy size={14} />{readData("components.Workspace.IntegrationsView", "IntegrationsView_text_22")}</button>
                    </div>
                </div>
            )}

            {/* Tab 3: White-Label Partner Channel */}
            {activeTab === 'partner' && (
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h3><Building2 size={20} color="var(--info)" />{readData("components.Workspace.IntegrationsView", "IntegrationsView_text_23")}</h3>
                        <span style={{ background: 'var(--info-wash)', color: 'var(--info)', border: '1px solid var(--line)', padding: '0.3rem 0.7rem', borderRadius: 'var(--r-control, 6px)', fontSize: '0.82rem', fontWeight: '700' }}>{readData("components.Workspace.IntegrationsView", "IntegrationsView_text_24")}</span>
                    </div>
                    <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>{readData("components.Workspace.IntegrationsView", "IntegrationsView_text_25")}</p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
                        <div style={{ background: 'var(--card-2)', padding: '1.25rem', borderRadius: 'var(--r-card, 12px)', border: '1px solid var(--line)' }}>
                            <strong style={{ color: 'var(--text)' }}>{readData("components.Workspace.IntegrationsView", "IntegrationsView_text_26")}</strong>
                            <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--info)', margin: '0.35rem 0', fontFamily: 'var(--f-num)' }}>{readData("components.Workspace.IntegrationsView", "IntegrationsView_text_27")}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{readData("components.Workspace.IntegrationsView", "IntegrationsView_text_28")}</div>
                        </div>

                        <div style={{ background: 'var(--card-2)', padding: '1.25rem', borderRadius: 'var(--r-card, 12px)', border: '1px solid var(--line)' }}>
                            <strong style={{ color: 'var(--text)' }}>{readData("components.Workspace.IntegrationsView", "IntegrationsView_text_29")}</strong>
                            <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--signal)', margin: '0.6rem 0' }}>{readData("components.Workspace.IntegrationsView", "IntegrationsView_text_30")}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--signal)' }}>{readData("components.Workspace.IntegrationsView", "IntegrationsView_text_31")}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IntegrationsView;
