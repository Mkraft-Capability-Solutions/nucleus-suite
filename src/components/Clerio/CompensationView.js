"use client";
import {useTranslation} from '@/context/I18nContext';

import { readData } from '../../services/workspace-data.mjs';

import React, { useEffect, useState } from 'react';
import {
    Coins, TrendingUp, ShieldCheck, HeartHandshake, Sliders,
    Download, CheckCircle2, ChevronRight, Scale
} from 'lucide-react';
import styles from './CompensationView.module.css';
import { useHRMS } from '@/context/HRMSContext';
import { launchAction } from '@/lib/action-launcher';

const CompensationView = () => {
    const {t: translateText}=useTranslation();

    const { compensationData, showToast } = useHRMS();
    const [benefits, setBenefits] = useState(compensationData.flexBenefits);
    const [benefitsLocked, setBenefitsLocked] = useState(false);

    useEffect(() => {
        const applyBenefitLock = (event) => {
            if (event.detail?.action === 'benefitLock') setBenefitsLocked(true);
        };
        window.addEventListener('nucleus:action-completed', applyBenefitLock);
        return () => window.removeEventListener('nucleus:action-completed', applyBenefitLock);
    }, []);

    const toggleBenefit = (id) => {
        setBenefits(prev => prev.map(b => b.id === id ? { ...b, selected: !b.selected } : b));
        showToast(translateText("components.Clerio.CompensationView","text_b4cf1c716d"),translateText("components.Clerio.CompensationView","text_709991b8bf"), 'info');
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.headerRow}>
                <div className={styles.titleBlock}>
                    <h2>{readData("components.Clerio.CompensationView", "CompensationView_text_1")}</h2>
                    <p>{readData("components.Clerio.CompensationView", "CompensationView_text_2")}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className={styles.btnSecondary} onClick={() => showToast(translateText("components.Clerio.CompensationView","text_b5b9434a68"),translateText("components.Clerio.CompensationView","text_48269108c6"), 'success')}>
                        <Download size={16} />{readData("components.Clerio.CompensationView", "CompensationView_text_3")}</button>
                    <button className={styles.btnPrimary} onClick={() => launchAction('compCycle')}>
                        <TrendingUp size={16} />{readData("components.Clerio.CompensationView", "CompensationView_text_4")}</button>
                </div>
            </div>

            {/* Stats */}
            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <span className={styles.statLabel}>{readData("components.Clerio.CompensationView", "CompensationView_text_5")}</span>
                    <span className={styles.statValue}>{compensationData.currentCTC}</span>
                    <span className={styles.statSub}>{readData("components.Clerio.CompensationView", "CompensationView_text_6")}{compensationData.band}</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statLabel}>{readData("components.Clerio.CompensationView", "CompensationView_text_7")}</span>
                    <span className={styles.statValue}>{compensationData.compaRatio}</span>
                    <span className={styles.statSub} style={{ color: '#2563eb' }}>{compensationData.marketBenchmark}</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statLabel}>{readData("components.Clerio.CompensationView", "CompensationView_text_8")}</span>
                    <span className={styles.statValue} style={{ fontSize: '1.25rem', marginTop: '0.25rem' }}>{compensationData.salaryRange}</span>
                    <span className={styles.statSub}>{readData("components.Clerio.CompensationView", "CompensationView_text_9")}</span>
                </div>
            </div>

            {/* Compensation Band Visualizer */}
            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <h3><Scale size={20} color="var(--info)" />{readData("components.Clerio.CompensationView", "CompensationView_text_10")}</h3>
                    <span style={{ fontSize: '0.85rem', color: 'var(--signal)', fontWeight: '700' }}>{readData("components.Clerio.CompensationView", "CompensationView_text_11")}</span>
                </div>

                <div style={{ padding: '1rem 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-2)', marginBottom: '0.5rem' }}>
                        <span>{readData("components.Clerio.CompensationView", "CompensationView_text_12")}</span>
                        <span>{readData("components.Clerio.CompensationView", "CompensationView_text_13")}</span>
                        <span>{readData("components.Clerio.CompensationView", "CompensationView_text_14")}</span>
                    </div>

                    <div style={{ height: '14px', background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: '7px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', left: '0%', width: '100%', height: '100%', background: 'linear-gradient(90deg, #93c5fd, #3b82f6, #1d4ed8)' }}></div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.75rem' }}>
                        <span style={{ background: 'var(--info-wash)', color: 'var(--info)', border: '1px solid var(--line)', padding: '0.35rem 0.75rem', borderRadius: 'var(--r-control, 6px)', fontWeight: '700', fontSize: '0.85rem' }}>{readData("components.Clerio.CompensationView", "CompensationView_text_15")}</span>
                    </div>
                </div>
            </div>

            {/* Flex Benefits Self-Service Selection */}
            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <h3><HeartHandshake size={20} color="var(--agent)" />{readData("components.Clerio.CompensationView", "CompensationView_text_16")}</h3>
                    <button className={styles.btnSecondary} disabled={benefitsLocked} onClick={() => launchAction('benefitLock', { benefits: benefits.filter(benefit => benefit.selected).map(benefit => benefit.name).join(', '), ...readData("components.Clerio.CompensationView", "CompensationView_fields_17") })}>
                        {benefitsLocked ? readData("components.Clerio.CompensationView", "display_1") : readData("components.Clerio.CompensationView", "display_2")}
                    </button>
                </div>
                <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>{readData("components.Clerio.CompensationView", "CompensationView_text_18")}</p>

                {benefits.map((b) => (
                    <div key={b.id} className={styles.flexItem}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <input
                                type="checkbox"
                                checked={b.selected}
                                disabled={benefitsLocked}
                                onChange={() => toggleBenefit(b.id)}
                                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                            />
                            <div>
                                <strong style={{ color: 'var(--text)', fontSize: '0.95rem' }}>{b.name}</strong>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{readData("components.Clerio.CompensationView", "CompensationView_text_19")}</div>
                            </div>
                        </div>
                        <strong style={{ color: 'var(--info)', fontSize: '0.95rem' }}>{b.value}</strong>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CompensationView;
