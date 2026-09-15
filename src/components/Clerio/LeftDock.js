"use client";
import {useTranslation} from '@/context/I18nContext';

import { readData } from '../../services/workspace-data.mjs';

import BrandLogo from '@/components/BrandLogo';
import React, { useState } from 'react';
import LayoutGrid from '@mui/icons-material/DashboardOutlined';
import Users from '@mui/icons-material/GroupsOutlined';
import UserPlus from '@mui/icons-material/PersonAddAltOutlined';
import CreditCard from '@mui/icons-material/PaymentsOutlined';
import BarChart3 from '@mui/icons-material/AssessmentOutlined';
import Settings from '@mui/icons-material/SettingsOutlined';
import Layers from '@mui/icons-material/LayersOutlined';
import Briefcase from '@mui/icons-material/WorkOutline';
import styles from './LeftDock.module.css';
import { useAuth } from '@/context/AuthContext';
import { canViewNavigationDomain } from '@/lib/navigation-access';

const LeftDock = ({ activeDomain, activeTab = readData("components.Clerio.LeftDock", "defaultValue_1"), onSelectDomain, onToggleCatalog, showCatalog }) => {
    const {t: translateText}=useTranslation();

    const [isHovered, setIsHovered] = useState(false);
    const { user, isModuleAllowed } = useAuth();

    // 6 Primary Categories matching exact user specification
    const dockItems = [
        { ...readData("components.Clerio.LeftDock", "dockItems_fields_1"), icon: LayoutGrid, ...readData("components.Clerio.LeftDock", "dockItems_fields_2") },
        { ...readData("components.Clerio.LeftDock", "dockItems_fields_3"), icon: Layers, ...readData("components.Clerio.LeftDock", "dockItems_fields_4") },
        { ...readData("components.Clerio.LeftDock", "dockItems_fields_5"), icon: Users, ...readData("components.Clerio.LeftDock", "dockItems_fields_6") },
        { ...readData("components.Clerio.LeftDock", "dockItems_fields_8"), icon: UserPlus, ...readData("components.Clerio.LeftDock", "dockItems_fields_9") },
        { ...readData("components.Clerio.LeftDock", "dockItems_fields_10"), icon: CreditCard, ...readData("components.Clerio.LeftDock", "dockItems_fields_11") },
        { ...readData("components.Clerio.LeftDock", "dockItems_fields_13"), icon: Briefcase, ...readData("components.Clerio.LeftDock", "dockItems_fields_14") },
        { ...readData("components.Clerio.LeftDock", "dockItems_fields_15"), icon: BarChart3, ...readData("components.Clerio.LeftDock", "dockItems_fields_16") },
    ];

    const isItemActive = (item) => {
        if (item.isCatalogToggle) return showCatalog;
        if (showCatalog) return false;
        if (item.id === 'dashboard' && (activeDomain === 'dashboard' || activeTab === 'dashboard')) return true;
        if (activeDomain === item.id) return true;
        if (item.aliases && item.aliases.includes(activeDomain)) return true;
        return false;
    };

    const visibleDockItems = dockItems.filter((item) => item.isCatalogToggle || canViewNavigationDomain(item.id, isModuleAllowed, user));
    const canViewPlatform = canViewNavigationDomain('platform', isModuleAllowed, user);
    const isPlatformActive = !showCatalog && (activeDomain === 'platform' || activeDomain === 'settings' || activeTab === 'settings');

    return (
        <aside
            className={`${styles.dockContainer} ${isHovered ? styles.dockExpanded : ''}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            aria-label={readData("components.Clerio.LeftDock", "LeftDock_aria-label_18")}
        >
            {/* Top: Logo Mark & Brand Title */}
            <button type="button" aria-label={translateText("components.Clerio.LeftDock","text_0ab6910b45")}
                className={styles.logoWrapper}
                onClick={() => onSelectDomain('dashboard')}
                title={readData("components.Clerio.LeftDock", "LeftDock_title_19")}
            >
                <div className={styles.logoMark}>
                    <BrandLogo size={48} />
                </div>
                <div className={styles.brandText}>
                    <span className={styles.brandTitle}>{readData("components.Clerio.LeftDock", "LeftDock_text_21")}</span>
                    <span className={styles.brandSubtitle}>{readData("components.Clerio.LeftDock", "LeftDock_text_22")}</span>
                </div>
            </button>

            {/* Middle: Domain Stack */}
            <nav className={styles.dockNav} role="navigation">
                {visibleDockItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = isItemActive(item);

                    return (
                        <button
                            key={item.id}
                            className={`${styles.dockBtn} ${isActive ? styles.dockBtnActive : ''}`}
                            onClick={() => {
                                if (item.isCatalogToggle) {
                                    if (onToggleCatalog) onToggleCatalog();
                                } else {
                                    onSelectDomain(item.id);
                                }
                            }}
                            title={!isHovered ? item.label : undefined}
                            aria-label={item.label}
                            aria-current={isActive ? readData("components.Clerio.LeftDock", "display_2") : undefined}
                        >
                            <div className={styles.iconContainer}>
                                <Icon sx={{ fontSize: 20 }} strokeWidth={isActive ? readData("components.Clerio.LeftDock", "display_3") : readData("components.Clerio.LeftDock", "display_4")} />
                            </div>
                            <span className={styles.btnLabel}>{translateText(item.label)}</span>
                            {!isHovered && <span className={styles.tooltip}>{translateText(item.label)}</span>}
                            {isActive && <div className={styles.activeIndicator} />}
                        </button>
                    );
                })}
            </nav>

            {/* Bottom: Platform */}
            {canViewPlatform && <div className={styles.dockBottom}>
                <div className={styles.divider} />
                <button
                    className={`${styles.dockBtn} ${isPlatformActive ? styles.dockBtnActive : ''}`}
                    onClick={() => onSelectDomain('platform')}
                    title={!isHovered ? readData("components.Clerio.LeftDock", "display_5") : undefined}
                    aria-label={readData("components.Clerio.LeftDock", "LeftDock_aria-label_23")}
                >
                    <div className={styles.iconContainer}>
                        <Settings sx={{ fontSize: 20 }} strokeWidth={isPlatformActive ? readData("components.Clerio.LeftDock", "display_6") : readData("components.Clerio.LeftDock", "display_7")} />
                    </div>
                    <span className={styles.btnLabel}>{readData("components.Clerio.LeftDock", "LeftDock_text_24")}</span>
                    {!isHovered && <span className={styles.tooltip}>{readData("components.Clerio.LeftDock", "LeftDock_text_25")}</span>}
                    {isPlatformActive && <div className={styles.activeIndicator} />}
                </button>
            </div>}
        </aside>
    );
};

export default LeftDock;
