"use client";
import { readData } from '../../services/workspace-data.mjs';

import React from 'react';
import styles from './AttendanceWidget.module.css';

const AttendanceWidget = () => {
    return (
        <div className={`${styles.card} glass-card`}>
            <h3 className={styles.title}>{readData("components.Dashboard.AttendanceWidget", "AttendanceWidget_text_1")}</h3>

            <div className={styles.sessionGrid}>
                <div className={styles.sessionItem}>
                    <span className={styles.label}>{readData("components.Dashboard.AttendanceWidget", "AttendanceWidget_text_2")}</span>
                    <span className={styles.value}>{readData("components.Dashboard.AttendanceWidget", "AttendanceWidget_text_3")}</span>
                    <span className={styles.status}>{readData("components.Dashboard.AttendanceWidget", "AttendanceWidget_text_4")}</span>
                </div>

                <div className={styles.sessionItem}>
                    <span className={styles.label}>{readData("components.Dashboard.AttendanceWidget", "AttendanceWidget_text_5")}</span>
                    <span className={styles.value}>{readData("components.Dashboard.AttendanceWidget", "AttendanceWidget_text_6")}</span>
                    <div className={styles.durationBar}>
                        <div className={styles.durationProgress} style={{ width: '28%' }}></div>
                    </div>
                    <span className={styles.subtext}>{readData("components.Dashboard.AttendanceWidget", "AttendanceWidget_text_7")}</span>
                </div>

                <div className={styles.sessionItem}>
                    <span className={styles.label}>{readData("components.Dashboard.AttendanceWidget", "AttendanceWidget_text_8")}</span>
                    <button className={styles.punchBtn}>{readData("components.Dashboard.AttendanceWidget", "AttendanceWidget_text_9")}</button>
                </div>
            </div>

            <div className={styles.workingHours}>
                <div className={styles.whHeader}>
                    <span>{readData("components.Dashboard.AttendanceWidget", "AttendanceWidget_text_10")}</span>
                    <span>{readData("components.Dashboard.AttendanceWidget", "AttendanceWidget_text_11")}</span>
                </div>
                <div className={styles.whBar}>
                    <div className={styles.whProgress} style={{ width: '28%' }}></div>
                </div>
                <div className={styles.statusFooter}>{readData("components.Dashboard.AttendanceWidget", "AttendanceWidget_text_12")}<span className={styles.onTime}>{readData("components.Dashboard.AttendanceWidget", "AttendanceWidget_text_13")}</span>
                </div>
            </div>
        </div>
    );
};

export default AttendanceWidget;
