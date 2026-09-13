"use client";
import NextImage from 'next/image';

import { readData } from '../../services/workspace-data.mjs';

import React from 'react';
import { Search, Bell, Monitor, Plus } from 'lucide-react';
import styles from './Header.module.css';

const Header = () => {
    return (
        <header className={`${styles.header} glass-card`}>
            <div className={styles.logo}>
                <div className={styles.logoIcon}>{readData("components.Dashboard.Header", "Header_text_1")}</div>
                <span>{readData("components.Dashboard.Header", "Header_text_2")}</span>
            </div>

            <div className={styles.searchBar}>
                <Search className={styles.searchIcon} size={20} />
                <input
                    type="text"
                    placeholder={readData("components.Dashboard.Header", "Header_placeholder_3")}
                    className={styles.searchInput}
                />
                <div className={styles.shortcut}>{readData("components.Dashboard.Header", "Header_text_4")}</div>
            </div>

            <div className={styles.actions}>
                <button className={styles.actionBtn}>
                    <Plus size={20} />
                    <span>{readData("components.Dashboard.Header", "Header_text_5")}</span>
                </button>

                <button className={styles.iconBtn}>
                    <Bell size={20} />
                    <span className={styles.badge}>{readData("components.Dashboard.Header", "Header_text_6")}</span>
                </button>

                <button className={styles.iconBtn}>
                    <Monitor size={20} />
                </button>

                <div className={styles.profile}>
                    <NextImage unoptimized width={48} height={48}
                        src={readData("components.Dashboard.Header", "attribute_1")}
                        alt={readData("components.Dashboard.Header", "Header_alt_7")}
                        className={styles.avatar}
                    />
                    <span className={styles.profileName}>{readData("components.Dashboard.Header", "Header_text_8")}</span>
                </div>
            </div>
        </header>
    );
};

export default Header;
