"use client";
import {useTranslation} from '@/context/I18nContext';

import NextImage from 'next/image';

import { readData } from '../../services/workspace-data.mjs';

import React, { useState } from 'react';
import {
    Sparkles, Heart, Sun, Flame, MessageSquare, ThumbsUp,
    Compass, Award, ShieldCheck, Plus, CheckCircle2, Zap
} from 'lucide-react';
import styles from './ExperienceView.module.css';
import { useHRMS } from '@/context/HRMSContext';
import { launchAction } from '@/lib/action-launcher';

const ExperienceView = () => {
    const {t: translateText}=useTranslation();

    const { mciScore, vedicFramework, socialFeed, addKudos, showToast } = useHRMS();
    const [activeTab, setActiveTab] = useState(readData("components.Clerio.ExperienceView", "initialState_1"));
    const [newPost, setNewPost] = useState('');

    const handleShareKudos = (e) => {
        e.preventDefault();
        if (!newPost.trim()) return;
        showToast(translateText("components.Clerio.ExperienceView","text_95e02cd741"),translateText("components.Clerio.ExperienceView","text_9778b2c25d"), 'success');
        setNewPost('');
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.headerRow}>
                <div className={styles.titleBlock}>
                    <h2>{readData("components.Clerio.ExperienceView", "ExperienceView_text_1")}</h2>
                    <p>{readData("components.Clerio.ExperienceView", "ExperienceView_text_2")}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className={styles.btnSecondary} onClick={() => showToast(translateText("components.Clerio.ExperienceView","text_737e78b17e"),translateText("components.Clerio.ExperienceView","text_95d6d0a015"), 'info')}>
                        <Award size={16} />{readData("components.Clerio.ExperienceView", "ExperienceView_text_3")}</button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className={styles.tabNav}>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'mci' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('mci')}
                >
                    <Sparkles size={16} />{readData("components.Clerio.ExperienceView", "ExperienceView_text_4")}</button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'vedic' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('vedic')}
                >
                    <Sun size={16} />{readData("components.Clerio.ExperienceView", "ExperienceView_text_5")}</button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'social' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('social')}
                >
                    <MessageSquare size={16} />{readData("components.Clerio.ExperienceView", "ExperienceView_text_6")}</button>
            </div>

            {/* Tab 1: Nucleus Capability Index (NCI) */}
            {activeTab === 'mci' && (
                <div className={styles.container}>
                    <div className={styles.mciHeroCard}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                            <div>
                                <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--signal-ink)', fontWeight: '700' }}>{readData("components.Clerio.ExperienceView", "ExperienceView_text_7")}</span>
                                <h1 style={{ fontSize: '2.5rem', margin: '0.35rem 0', fontWeight: '800' }}>{readData("components.Clerio.ExperienceView", "ExperienceView_text_8")}</h1>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <span style={{ background: 'var(--card-2)', padding: '0.35rem 0.85rem', borderRadius: '10px', fontSize: '0.88rem', fontWeight: '600' }}>{readData("components.Clerio.ExperienceView", "ExperienceView_text_9")}</span>
                                    <span style={{ background: 'var(--status-ok-wash)', color: 'var(--status-ok-ink)', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700' }}>{readData("components.Clerio.ExperienceView", "ExperienceView_text_10")}</span>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right', maxWidth: '380px' }}>
                                <div style={{ fontSize: '0.82rem', background: 'var(--card-2)', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)' }}>
                                    <code>{readData("components.Clerio.ExperienceView", "ExperienceView_text_11")}</code>
                                    <div style={{ marginTop: '0.4rem', opacity: 0.85, fontSize: '0.75rem' }}>{readData("components.Clerio.ExperienceView", "ExperienceView_text_12")}</div>
                                </div>
                            </div>
                        </div>

                        {/* 5 Core Dimension Weights */}
                        <div className={styles.dimensionGrid}>
                            <div className={styles.dimCard}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                    <strong style={{ fontSize: '0.88rem' }}>{readData("components.Clerio.ExperienceView", "ExperienceView_text_13")}</strong>
                                    <span style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--info)' }}>{readData("components.Clerio.ExperienceView", "ExperienceView_text_14")}</span>
                                </div>
                                <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>{readData("components.Clerio.ExperienceView", "ExperienceView_text_15")}</div>
                            </div>
                            <div className={styles.dimCard}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                    <strong style={{ fontSize: '0.88rem' }}>{readData("components.Clerio.ExperienceView", "ExperienceView_text_16")}</strong>
                                    <span style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--info)' }}>{readData("components.Clerio.ExperienceView", "ExperienceView_text_17")}</span>
                                </div>
                                <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>{readData("components.Clerio.ExperienceView", "ExperienceView_text_18")}</div>
                            </div>
                            <div className={styles.dimCard}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                    <strong style={{ fontSize: '0.88rem' }}>{readData("components.Clerio.ExperienceView", "ExperienceView_text_19")}</strong>
                                    <span style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--info)' }}>{readData("components.Clerio.ExperienceView", "ExperienceView_text_20")}</span>
                                </div>
                                <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>{readData("components.Clerio.ExperienceView", "ExperienceView_text_21")}</div>
                            </div>
                            <div className={styles.dimCard}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                    <strong style={{ fontSize: '0.88rem' }}>{readData("components.Clerio.ExperienceView", "ExperienceView_text_22")}</strong>
                                    <span style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--info)' }}>{readData("components.Clerio.ExperienceView", "ExperienceView_text_23")}</span>
                                </div>
                                <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>{readData("components.Clerio.ExperienceView", "ExperienceView_text_24")}</div>
                            </div>
                            <div className={styles.dimCard}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                    <strong style={{ fontSize: '0.88rem' }}>{readData("components.Clerio.ExperienceView", "ExperienceView_text_25")}</strong>
                                    <span style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--info)' }}>{readData("components.Clerio.ExperienceView", "ExperienceView_text_26")}</span>
                                </div>
                                <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>{readData("components.Clerio.ExperienceView", "ExperienceView_text_27")}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab 2: Vedic Wisdom & Wellbeing Framework */}
            {activeTab === 'vedic' && (
                <div className={styles.container}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h3><Sun size={20} color="#f59e0b" />{readData("components.Clerio.ExperienceView", "ExperienceView_text_28")}</h3>
                            <span style={{ fontSize: '0.85rem', color: '#d97706', fontWeight: '700' }}>{readData("components.Clerio.ExperienceView", "ExperienceView_text_29")}</span>
                        </div>
                        <p style={{ color: 'var(--text-3)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>{readData("components.Clerio.ExperienceView", "ExperienceView_text_30")}</p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
                            <div style={{ background: 'var(--pending-wash)', border: '1px solid var(--pending)', borderRadius: 'var(--r-card)', padding: '1.5rem' }}>
                                <strong style={{ color: 'var(--pending)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <Flame size={18} color="var(--pending)" />{readData("components.Clerio.ExperienceView", "ExperienceView_text_31")}</strong>
                                <p style={{ fontSize: '0.88rem', color: 'var(--text)', margin: '0 0 1rem' }}>
                                    {vedicFramework.energyRhythm}
                                </p>
                                <button className={styles.btnSecondary} style={{ fontSize: '0.8rem' }} onClick={() => launchAction('focusBlock')}>{readData("components.Clerio.ExperienceView", "ExperienceView_text_32")}</button>
                            </div>

                            <div style={{ background: 'var(--signal-wash)', border: '1px solid var(--signal)', borderRadius: 'var(--r-card)', padding: '1.5rem' }}>
                                <strong style={{ color: 'var(--signal-ink)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <Compass size={18} color="var(--signal)" />{readData("components.Clerio.ExperienceView", "ExperienceView_text_33")}</strong>
                                <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--signal)', margin: '0.25rem 0', fontFamily: 'var(--f-num)' }}>
                                    {vedicFramework.purposeAlignment}
                                </div>
                                <p style={{ fontSize: '0.82rem', color: 'var(--text)', margin: 0 }}>{readData("components.Clerio.ExperienceView", "ExperienceView_text_34")}</p>
                            </div>

                            <div style={{ background: 'var(--info-wash)', border: '1px solid var(--info)', borderRadius: 'var(--r-card)', padding: '1.5rem' }}>
                                <strong style={{ color: 'var(--info)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <Sparkles size={18} color="var(--info)" />{readData("components.Clerio.ExperienceView", "ExperienceView_text_35")}</strong>
                                <p style={{ fontSize: '0.88rem', color: 'var(--text)', margin: '0 0 1rem' }}>{readData("components.Clerio.ExperienceView", "ExperienceView_text_36")}{vedicFramework.currentDhruvaGoal}{readData("components.Clerio.ExperienceView", "ExperienceView_text_37")}</p>
                            </div>
                        </div>

                        {/* Differential Privacy Guarantee Box (Blueprint page 20) */}
                        <div style={{ marginTop: '1.5rem', background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                            <ShieldCheck size={24} color="var(--signal)" style={{ flexShrink: 0, marginTop: '2px' }} />
                            <div>
                                <strong style={{ color: 'var(--text)', fontSize: '0.92rem', display: 'block', marginBottom: '0.25rem' }}>{readData("components.Clerio.ExperienceView", "ExperienceView_text_38")}</strong>
                                <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-2)', lineHeight: 1.5 }}>{readData("components.Clerio.ExperienceView", "ExperienceView_text_39")}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab 3: Social Feed & Peer Recognition */}
            {activeTab === 'social' && (
                <div className={styles.container}>
                    {/* Kudos composer */}
                    <div className={styles.card}>
                        <h3 style={{ margin: '0 0 1rem', fontSize: '1.05rem', color: 'var(--text)' }}>{readData("components.Clerio.ExperienceView", "ExperienceView_text_40")}</h3>
                        <form onSubmit={handleShareKudos} style={{ display: 'flex', gap: '0.75rem' }}>
                            <input
                                type="text"
                                placeholder={readData("components.Clerio.ExperienceView", "ExperienceView_placeholder_41")}
                                value={newPost}
                                onChange={(e) => setNewPost(e.target.value)}
                                style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: 'var(--r-control)', border: '1px solid var(--line)', background: 'var(--card-2)', color: 'var(--text)', outline: 'none', fontSize: '0.9rem' }}
                            />
                            <button type="submit" className={styles.btnPrimary}>{readData("components.Clerio.ExperienceView", "ExperienceView_text_42")}</button>
                        </form>
                    </div>

                    {/* Feed List */}
                    <div className={styles.feedGrid}>
                        {socialFeed.map((post) => (
                            <div key={post.id} className={styles.feedCard}>
                                <NextImage unoptimized width={48} height={48} src={post.avatar} className={styles.avatar} alt={post.author} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                                        <div>
                                            <strong style={{ color: 'var(--text)' }}>{post.author}</strong>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginLeft: '0.5rem' }}>{post.role}{readData("components.Clerio.ExperienceView", "ExperienceView_text_43")}{post.time}</span>
                                        </div>
                                    </div>

                                    <p style={{ color: 'var(--text)', fontSize: '0.95rem', margin: '0.5rem 0' }}>{post.text}</p>

                                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                        {post.tags.map((t, idx) => (
                                            <span key={idx} style={{ background: 'var(--info-wash)', color: 'var(--info)', padding: '0.2rem 0.5rem', borderRadius: 'var(--r-data)', fontSize: '0.75rem', fontWeight: '600' }}>
                                                {t}
                                            </span>
                                        ))}
                                    </div>

                                    <button
                                        className={styles.btnSecondary}
                                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                                        onClick={() => addKudos(post.id)}
                                    >
                                        <ThumbsUp size={14} color="#2563eb" /> {post.kudos}{readData("components.Clerio.ExperienceView", "ExperienceView_text_44")}</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExperienceView;
