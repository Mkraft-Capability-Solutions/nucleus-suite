"use client";
import {useTranslation} from '@/context/I18nContext';

import { readData } from '../../services/workspace-data.mjs';

import React, { useState } from 'react';
import LayoutGrid from '@mui/icons-material/DashboardOutlined';
import Users from '@mui/icons-material/GroupsOutlined';
import UserPlus from '@mui/icons-material/PersonAddAltOutlined';
import CreditCard from '@mui/icons-material/PaymentsOutlined';
import BarChart3 from '@mui/icons-material/AssessmentOutlined';
import Settings from '@mui/icons-material/SettingsOutlined';
import Layers from '@mui/icons-material/LayersOutlined';
import Briefcase from '@mui/icons-material/WorkOutline';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import styles from './LeftDock.module.css';
import { useAuth } from '@/context/AuthContext';
import { canViewNavigationDomain } from '@/lib/navigation-access';

const PIN_KEY = 'nucleus_left_rail';
const SHOW_FEATURE_CATALOG = true;

const LeftDock = ({ activeDomain, activeTab = readData("components.Workspace.LeftDock", "defaultValue_1"), onSelectDomain, onToggleCatalog, showCatalog }) => {
    const {t: translateText}=useTranslation();

    const [isPinned, setIsPinned] = useState(() => {
        try { return localStorage.getItem(PIN_KEY) !== 'collapsed'; } catch { return true; }
    });
    const isHovered = isPinned;
    const togglePinned = () => setIsPinned((prev) => {
        const next = !prev;
        try { localStorage.setItem(PIN_KEY, next ? 'expanded' : 'collapsed'); } catch { /* per-viewer preference only */ }
        return next;
    });
    const { user, isModuleAllowed } = useAuth();

    // 6 Primary Categories matching exact user specification
    const dockItems = [
        { ...readData("components.Workspace.LeftDock", "dockItems_fields_1"), icon: LayoutGrid, ...readData("components.Workspace.LeftDock", "dockItems_fields_2") },
        { ...readData("components.Workspace.LeftDock", "dockItems_fields_5"), icon: Users, ...readData("components.Workspace.LeftDock", "dockItems_fields_6") },
        { ...readData("components.Workspace.LeftDock", "dockItems_fields_8"), icon: UserPlus, ...readData("components.Workspace.LeftDock", "dockItems_fields_9") },
        { ...readData("components.Workspace.LeftDock", "dockItems_fields_10"), icon: CreditCard, ...readData("components.Workspace.LeftDock", "dockItems_fields_11") },
        { ...readData("components.Workspace.LeftDock", "dockItems_fields_13"), icon: Briefcase, ...readData("components.Workspace.LeftDock", "dockItems_fields_14") },
        { ...readData("components.Workspace.LeftDock", "dockItems_fields_15"), icon: BarChart3, ...readData("components.Workspace.LeftDock", "dockItems_fields_16") },
        { ...readData("components.Workspace.LeftDock", "dockItems_fields_3"), icon: Layers, ...readData("components.Workspace.LeftDock", "dockItems_fields_4") },
    ];

    const isItemActive = (item) => {
        if (item.isCatalogToggle) return showCatalog;
        if (showCatalog) return false;
        if (item.id === 'dashboard' && (activeDomain === 'dashboard' || activeTab === 'dashboard')) return true;
        if (activeDomain === item.id) return true;
        if (item.aliases && item.aliases.includes(activeDomain)) return true;
        return false;
    };

    // The Feature Catalog entry is hidden: it repeated the module navigation (UI feedback, item 4).
    // Set SHOW_FEATURE_CATALOG to true to bring it back; search results still use the catalog view.
    const visibleDockItems = dockItems.filter((item) => item.isCatalogToggle ? SHOW_FEATURE_CATALOG : canViewNavigationDomain(item.id, isModuleAllowed, user));
    const canViewPlatform = canViewNavigationDomain('platform', isModuleAllowed, user);
    const isPlatformActive = !showCatalog && (activeDomain === 'platform' || activeDomain === 'settings' || activeTab === 'settings');

    return (
        <aside
            className={`${styles.dockContainer} ${isHovered ? styles.dockExpanded : ''}`}
            data-left-rail={isPinned ? 'open' : 'collapsed'}
            aria-label={readData("components.Workspace.LeftDock", "LeftDock_aria-label_18")}
        >
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
                            aria-current={isActive ? readData("components.Workspace.LeftDock", "display_2") : undefined}
                        >
                            <div className={styles.iconContainer}>
                                <Icon sx={{ fontSize: 20 }} strokeWidth={isActive ? readData("components.Workspace.LeftDock", "display_3") : readData("components.Workspace.LeftDock", "display_4")} />
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
                    title={!isHovered ? readData("components.Workspace.LeftDock", "display_5") : undefined}
                    aria-label={readData("components.Workspace.LeftDock", "LeftDock_aria-label_23")}
                >
                    <div className={styles.iconContainer}>
                        <Settings sx={{ fontSize: 20 }} strokeWidth={isPlatformActive ? readData("components.Workspace.LeftDock", "display_6") : readData("components.Workspace.LeftDock", "display_7")} />
                    </div>
                    <span className={styles.btnLabel}>{readData("components.Workspace.LeftDock", "LeftDock_text_24")}</span>
                    {!isHovered && <span className={styles.tooltip}>{readData("components.Workspace.LeftDock", "LeftDock_text_25")}</span>}
                    {isPlatformActive && <div className={styles.activeIndicator} />}
                </button>
            </div>}

            {/* Collapse sits at the bottom of the rail, matching the right rail */}
            <button
                type="button"
                className={styles.collapseBtn}
                onClick={togglePinned}
                aria-expanded={isPinned}
                title={isPinned ? translateText("components.Workspace.LeftDock.title_collapse_left_sidebar", "Collapse sidebar") : translateText("components.Workspace.LeftDock.title_expand_left_sidebar", "Expand sidebar")}
                aria-label={isPinned ? translateText("components.Workspace.LeftDock.title_collapse_left_sidebar", "Collapse sidebar") : translateText("components.Workspace.LeftDock.title_expand_left_sidebar", "Expand sidebar")}
            >
                {isPinned ? <PanelLeftClose size={20} aria-hidden="true" /> : <PanelLeftOpen size={20} aria-hidden="true" />}
            </button>
        </aside>
    );
};

export default LeftDock;
