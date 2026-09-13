"use client";
import { readData } from '../../services/workspace-data.mjs';

import React from 'react';
import { Video } from 'lucide-react';
import styles from './UpcomingEvents.module.css';

const UpcomingEvents = () => {
    return (
        <div className={`${styles.card} glass-card`}>
            <h3 className={styles.title}>{readData("components.Dashboard.UpcomingEvents", "UpcomingEvents_text_1")}</h3>

            <div className={styles.timeline}>
                {/* Event 1 */}
                <div className={styles.eventItem}>
                    <div className={styles.timeIndicator}>
                        <div className={styles.dot}></div>
                        <div className={styles.line}></div>
                    </div>
                    <div className={styles.eventContent}>
                        <span className={styles.time}>{readData("components.Dashboard.UpcomingEvents", "UpcomingEvents_text_2")}</span>
                        <h4>{readData("components.Dashboard.UpcomingEvents", "UpcomingEvents_text_3")}</h4>
                        <p>{readData("components.Dashboard.UpcomingEvents", "UpcomingEvents_text_4")}</p>
                        <button className={styles.joinBtn}>{readData("components.Dashboard.UpcomingEvents", "UpcomingEvents_text_5")}</button>
                    </div>
                </div>

                {/* Event 2 */}
                <div className={styles.eventItem}>
                    <div className={styles.timeIndicator}>
                        <div className={styles.dot}></div>
                    </div>
                    <div className={styles.eventContent}>
                        <span className={styles.time}>{readData("components.Dashboard.UpcomingEvents", "UpcomingEvents_text_6")}</span>
                        <h4>{readData("components.Dashboard.UpcomingEvents", "UpcomingEvents_text_7")}</h4>
                        <p>{readData("components.Dashboard.UpcomingEvents", "UpcomingEvents_text_8")}</p>
                        <div className={styles.links}>
                            <a href="#" className={styles.link}>{readData("components.Dashboard.UpcomingEvents", "UpcomingEvents_text_9")}</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UpcomingEvents;
