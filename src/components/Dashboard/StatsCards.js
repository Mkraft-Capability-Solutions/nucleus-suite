"use client";
import { readData } from '../../services/workspace-data.mjs';

import React from 'react';
import { CheckCircle, Calendar, Clock, Award } from 'lucide-react';
import styles from './StatsCards.module.css';

const StatsCards = () => {
    const cards = [
        {
            ...readData("components.Dashboard.StatsCards", "cards_fields_1"),
            icon: <CheckCircle size={24} style={{ color: 'var(--status-ok)' }} />
        },
        {
            ...readData("components.Dashboard.StatsCards", "cards_fields_2"),
            icon: <Calendar size={24} style={{ color: 'var(--pending)' }} />
        },
        {
            ...readData("components.Dashboard.StatsCards", "cards_fields_3"),
            icon: <Clock size={24} style={{ color: 'var(--signal)' }} />
        },
        {
            ...readData("components.Dashboard.StatsCards", "cards_fields_4"),
            icon: <Award size={24} style={{ color: 'var(--agent)' }} />
        }
    ];

    return (
        <div className={styles.grid}>
            {cards.map((card, index) => (
                <div key={index} className={`${styles.card} glass-card`}>
                    <div className={styles.header}>
                        <span className={styles.iconWrapper}>{card.icon}</span>
                        <span className={styles.title}>{card.title}</span>
                    </div>

                    <div className={styles.content}>
                        <h3>{card.value}</h3>
                        <p>{card.subtext}</p>
                    </div>

                    <div className={styles.progressWrapper}>
                        <div className={styles.progressBg}>
                            <div
                                className={`${styles.progressBar} ${styles[card.color]}`}
                                style={{ width: `${card.progress}%` }}
                            ></div>
                        </div>
                    </div>

                    <div className={styles.footer}>
                        <button className={styles.aiBtn}>{readData("components.Dashboard.StatsCards", "StatsCards_text_5")}</button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default StatsCards;
