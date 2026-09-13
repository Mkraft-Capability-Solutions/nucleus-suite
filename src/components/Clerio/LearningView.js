"use client";
import {useTranslation} from '@/context/I18nContext';

import { readData } from '../../services/workspace-data.mjs';

import React, { useState } from 'react';
import {
    GraduationCap, BookOpen, Play, CheckCircle2, Award,
    Sparkles, ExternalLink, ShieldCheck, Clock
} from 'lucide-react';
import styles from './LearningView.module.css';
import { useHRMS } from '@/context/HRMSContext';
import { launchAction } from '@/lib/action-launcher';

const LearningView = ({ onNavigate, onSelectConsole }) => {
    const {t: translateText}=useTranslation();

    const { courses, setCourses, showToast } = useHRMS();

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.headerRow}>
                <div className={styles.titleBlock}>
                    <h2>{readData("components.Clerio.LearningView", "LearningView_text_1")}</h2>
                    <p>{readData("components.Clerio.LearningView", "LearningView_text_2")}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {(onNavigate || onSelectConsole) && (
                        <button
                            className={styles.btnSecondary}
                            onClick={() => {
                                if (onSelectConsole) onSelectConsole('S9');
                                if (onNavigate) onNavigate('dashboard', 'dashboard', 's9');
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
                            title={readData("components.Clerio.LearningView", "LearningView_title_3")}
                        >
                            <Sparkles size={15} />{readData("components.Clerio.LearningView", "LearningView_text_4")}</button>
                    )}
                    <button className={styles.btnSecondary} onClick={() => showToast(translateText("components.Clerio.LearningView","text_c608981d8d"),translateText("components.Clerio.LearningView","text_37e8f75dea"), 'info')}>
                        <ExternalLink size={16} />{readData("components.Clerio.LearningView", "LearningView_text_5")}</button>
                    <button className={styles.btnPrimary} onClick={() => launchAction('learningPath')}>
                        <Sparkles size={16} />{readData("components.Clerio.LearningView", "LearningView_text_6")}</button>
                </div>
            </div>

            {/* Courses Grid */}
            <div className={styles.courseGrid}>
                {courses.map((course) => (
                    <div key={course.id} className={styles.courseCard}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <span style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: '700', textTransform: 'uppercase' }}>
                                    {course.category}
                                </span>
                                <span style={{
                                    fontSize: '0.75rem',
                                    fontWeight: '700',
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '6px',
                                    background: course.badge === 'Certified' || course.badge === 'Compliant' ? '#dcfce7' : '#eff6ff',
                                    color: course.badge === 'Certified' || course.badge === 'Compliant' ? '#166534' : '#1d4ed8'
                                }}>
                                    {course.badge}
                                </span>
                            </div>

                            <strong style={{ fontSize: '1.05rem', color: '#0f172a', display: 'block' }}>{course.title}</strong>
                            <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.35rem' }}>{readData("components.Clerio.LearningView", "LearningView_text_7")}<strong>{course.provider}</strong>{readData("components.Clerio.LearningView", "LearningView_text_8")}{course.duration}
                            </div>
                        </div>

                        <div style={{ marginTop: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: '600' }}>
                                <span>{readData("components.Clerio.LearningView", "LearningView_text_9")}</span>
                                <span>{course.progress}{readData("components.Clerio.LearningView", "LearningView_text_10")}</span>
                            </div>
                            <div className={styles.progressBarTrack}>
                                <div className={styles.progressBarFill} style={{ width: `${course.progress}%` }}></div>
                            </div>

                            <button
                                className={styles.btnPrimary}
                                style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem', padding: '0.5rem' }}
                                onClick={() => showToast(translateText("components.Clerio.LearningView","text_19ff47baa3"),translateText("components.Clerio.LearningView","text_933253e7ee", {value1: String(course.title)}), 'info')}
                            >
                                <Play size={14} /> {course.progress === 100 ? readData("components.Clerio.LearningView", "display_1") : readData("components.Clerio.LearningView", "display_2")}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* L&D Impact ROI Section */}
            <div className={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Award size={20} color="#2563eb" />{readData("components.Clerio.LearningView", "LearningView_text_11")}</h3>
                        <p style={{ margin: '0.35rem 0 0', color: '#64748b', fontSize: '0.88rem' }}>{readData("components.Clerio.LearningView", "LearningView_text_12")}<strong>{readData("components.Clerio.LearningView", "LearningView_text_13")}</strong>{readData("components.Clerio.LearningView", "LearningView_text_14")}</p>
                    </div>
                    <span style={{ background: '#dcfce7', color: '#166534', padding: '0.4rem 0.8rem', borderRadius: '10px', fontWeight: '700', fontSize: '0.85rem' }}>{readData("components.Clerio.LearningView", "LearningView_text_15")}</span>
                </div>
            </div>
        </div>
    );
};

export default LearningView;
