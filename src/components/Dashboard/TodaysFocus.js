"use client";
import { readData } from '../../services/workspace-data.mjs';

import React from 'react';
import { MoreVertical, RefreshCw, Play, Clock, Calendar, AlertCircle } from 'lucide-react';
import styles from './TodaysFocus.module.css';

const TodaysFocus = () => {
    return (
        <div className={`${styles.container} glass-card`}>
            <div className={styles.header}>
                <div className={styles.titleGroup}>
                    <span className={styles.sparkles}>{readData("components.Dashboard.TodaysFocus", "TodaysFocus_text_1")}</span>
                    <h2>{readData("components.Dashboard.TodaysFocus", "TodaysFocus_text_2")}</h2>
                    <span className={styles.subtitle}>{readData("components.Dashboard.TodaysFocus", "TodaysFocus_text_3")}</span>
                </div>
                <div className={styles.actions}>
                    <button className={styles.iconBtn}><RefreshCw size={18} /></button>
                    <button className={styles.iconBtn}><MoreVertical size={18} /></button>
                </div>
            </div>

            <div className={styles.taskList}>
                {/* High Priority Task */}
                <div className={`${styles.taskItem} ${styles.highPriority}`}>
                    <div className={styles.taskHeader}>
                        <div className={styles.checkboxWrapper}>
                            <input type="checkbox" className={styles.checkbox} />
                            <span className={styles.priorityLabel}>{readData("components.Dashboard.TodaysFocus", "TodaysFocus_text_4")}</span>
                            <h3>{readData("components.Dashboard.TodaysFocus", "TodaysFocus_text_5")}</h3>
                        </div>
                        <span className={styles.dueDate}>{readData("components.Dashboard.TodaysFocus", "TodaysFocus_text_6")}</span>
                    </div>

                    <div className={styles.aiSuggestion}>
                        <AlertCircle size={16} className={styles.aiIcon} />
                        <p><strong>{readData("components.Dashboard.TodaysFocus", "TodaysFocus_text_7")}</strong>{readData("components.Dashboard.TodaysFocus", "TodaysFocus_text_8")}</p>
                    </div>

                    <div className={styles.impact}>{readData("components.Dashboard.TodaysFocus", "TodaysFocus_text_9")}</div>

                    <div className={styles.taskActions}>
                        <button className={styles.primaryBtn}><Play size={14} />{readData("components.Dashboard.TodaysFocus", "TodaysFocus_text_10")}</button>
                        <button className={styles.secondaryBtn}><Clock size={14} />{readData("components.Dashboard.TodaysFocus", "TodaysFocus_text_11")}</button>
                        <button className={styles.secondaryBtn}><Calendar size={14} />{readData("components.Dashboard.TodaysFocus", "TodaysFocus_text_12")}</button>
                    </div>
                </div>

                {/* Medium Priority Task */}
                <div className={styles.taskItem}>
                    <div className={styles.taskHeader}>
                        <div className={styles.checkboxWrapper}>
                            <input type="checkbox" className={styles.checkbox} />
                            <span className={`${styles.priorityLabel} ${styles.medium}`}>{readData("components.Dashboard.TodaysFocus", "TodaysFocus_text_13")}</span>
                            <h3>{readData("components.Dashboard.TodaysFocus", "TodaysFocus_text_14")}</h3>
                        </div>
                        <span className={styles.dueDate}>{readData("components.Dashboard.TodaysFocus", "TodaysFocus_text_15")}</span>
                    </div>
                    <div className={styles.metaInfo}>
                        <span>{readData("components.Dashboard.TodaysFocus", "TodaysFocus_text_16")}</span>
                        <span>{readData("components.Dashboard.TodaysFocus", "TodaysFocus_text_17")}</span>
                        <span>{readData("components.Dashboard.TodaysFocus", "TodaysFocus_text_18")}</span>
                    </div>
                </div>

                {/* Add more tasks button */}
                <div className={styles.footer}>
                    <button className={styles.addBtn}>{readData("components.Dashboard.TodaysFocus", "TodaysFocus_text_19")}</button>
                    <button className={styles.viewAllBtn}>{readData("components.Dashboard.TodaysFocus", "TodaysFocus_text_20")}</button>
                </div>
            </div>
        </div>
    );
};

export default TodaysFocus;
