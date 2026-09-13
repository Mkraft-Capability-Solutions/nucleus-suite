"use client";
import NextImage from 'next/image';

import { readData } from '../../services/workspace-data.mjs';

import React from 'react';
import { Cloud, Mic, Camera } from 'lucide-react';
import styles from './HeroSection.module.css';

const HeroSection = () => {
    return (
        <section className={styles.hero}>
            <div className={styles.content}>
                <div className={styles.greetingGroup}>
                    <div className={styles.avatarWrapper}>
                        <NextImage unoptimized width={48} height={48}
                            src={readData("components.Dashboard.HeroSection", "attribute_1")}
                            alt={readData("components.Dashboard.HeroSection", "HeroSection_alt_1")}
                            className={styles.heroAvatar}
                        />
                        <div className={styles.onlineStatus}></div>
                        <button className={styles.cameraBtn}>
                            <Camera size={16} />
                        </button>
                    </div>

                    <div className={styles.greetingText}>
                        <h1>{readData("components.Dashboard.HeroSection", "HeroSection_text_2")}</h1>
                        <p>{readData("components.Dashboard.HeroSection", "HeroSection_text_3")}</p>

                        <div className={`${styles.aiInsight} glass-card`}>
                            <span className={styles.aiIcon}>{readData("components.Dashboard.HeroSection", "HeroSection_text_4")}</span>
                            <p>{readData("components.Dashboard.HeroSection", "HeroSection_text_5")}</p>
                        </div>
                    </div>
                </div>

                <div className={styles.infoGroup}>
                    <div className={`${styles.dateCard} glass-card`}>
                        <h2>{readData("components.Dashboard.HeroSection", "HeroSection_text_6")}</h2>
                        <p>{readData("components.Dashboard.HeroSection", "HeroSection_text_7")}</p>
                        <div className={styles.timeLocation}>
                            <span>{readData("components.Dashboard.HeroSection", "HeroSection_text_8")}</span>
                            <span className={styles.separator}>{readData("components.Dashboard.HeroSection", "HeroSection_text_9")}</span>
                            <span>{readData("components.Dashboard.HeroSection", "HeroSection_text_10")}</span>
                        </div>
                        <div className={styles.weather}>
                            <Cloud size={20} />
                            <span>{readData("components.Dashboard.HeroSection", "HeroSection_text_11")}</span>
                        </div>
                    </div>
                </div>
            </div>

            <button className={`${styles.voiceBtn} animate-pulse-glow`}>
                <Mic size={32} color="white" />
            </button>
        </section>
    );
};

export default HeroSection;
