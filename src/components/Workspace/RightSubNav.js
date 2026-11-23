"use client";
import { readData } from '../../services/workspace-data.mjs';

import React from 'react';
import { getNavigationDomains } from '@/lib/workspace-navigation';
import X from '@mui/icons-material/Close';
import ChevronRight from '@mui/icons-material/ChevronRight';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import TrendingUp from '@mui/icons-material/TrendingUp';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/context/I18nContext';
import { canViewNavigationItem } from '@/lib/navigation-access';
import { stripConsoleCode } from '@/lib/display-codes';
import styles from './RightSubNav.module.css';

const ROLE_PERMITTED_CONSOLES = readData("components.Workspace.RightSubNav", "ROLE_PERMITTED_CONSOLES_1");

const RightSubNav = ({
    activeDomain,
    activeSubFeature,
    onSelectSubFeature,
    isOpen = true,
    onClose
}) => {
  const { t } = useTranslation();
    const { t: translateText } = useTranslation();
    const { user, isConsoleAllowed, isModuleAllowed, isNavItemEnabled } = useAuth();
    const [collapsedGroups, setCollapsedGroups] = React.useState({});
    const [isPanelCollapsed, setPanelCollapsedState] = React.useState(() => {
        try { return localStorage.getItem('nucleus_right_rail') === 'collapsed'; } catch { return false; }
    });
    const setIsPanelCollapsed = (value) => {
        setPanelCollapsedState(value);
        try { localStorage.setItem('nucleus_right_rail', value ? 'collapsed' : 'expanded'); } catch { /* per-viewer preference only */ }
    };

    if (!isOpen) return null;

    // Primary Categories with Exact Sub Modules
    const domainConfigs = Object.fromEntries(getNavigationDomains().map(domain => [domain.id, { ...domain, title: domain.label, subtitle: domain.desc || domain.badge }]));

    // Support aliases for smooth transitions
    const resolvedDomain =
        activeDomain === 'people' ? 'core_hr' :
        activeDomain === 'payroll' ? 'payroll_finance' :
        activeDomain === 'analytics' ? 'analytics_ai' :
        activeDomain === 'compliance' ? 'core_hr' :
        activeDomain === 'helpdesk' ? 'core_hr' :
        activeDomain === 'settings' ? 'platform' :
        activeDomain;

    const userRole = user?.role || readData("components.Workspace.RightSubNav", "fallback_1");
    const permittedConsoleIds = (ROLE_PERMITTED_CONSOLES[userRole] || readData("components.Workspace.RightSubNav", "permittedConsoleIds_129")).filter((consoleId) => isConsoleAllowed(consoleId, userRole, user?.id || user?.email));

    const rawConfig = domainConfigs[resolvedDomain] || domainConfigs.core_hr;
    const domainConfig = resolvedDomain === 'dashboard' ? {
        ...rawConfig,
        title: t("components.Workspace.RightSubNav.text_consoles", "Consoles"),
        subtitle: userRole === 'SUPER_ADMIN'
            ? t("components.Workspace.RightSubNav.text_universal_access", "Universal access · {count}", { count: permittedConsoleIds.length })
            : t("components.Workspace.RightSubNav.text_role_access", "{role} · {count}", { role: userRole.replace(/_/g, ' ').toLowerCase(), count: permittedConsoleIds.length }),
        groups: rawConfig.groups
            .map((g, index) => ({
                ...g,
                heading: index === 0 ? t("components.Workspace.RightSubNav.text_exec_ops", "Executive & operational") : g.heading,
                items: g.items.filter(item => permittedConsoleIds.includes(item.id.toUpperCase()))
            }))
            .filter(g => g.items.length > 0)
    } : rawConfig;
    const currentConfig = {
        ...domainConfig,
        groups: domainConfig.groups
            .map((group) => ({ ...group, items: group.items.filter((item) => canViewNavigationItem(item, isModuleAllowed, user, isNavItemEnabled)) }))
            .filter((group) => group.items.length > 0),
    };

    // Default: only the first group (and the group holding the open page) is expanded; explicit toggles override.
    const isGroupCollapsed = (group, index) => {
        if (Object.hasOwn(collapsedGroups, group.heading)) return collapsedGroups[group.heading];
        if (group.items.some((item) => item.id === activeSubFeature)) return false;
        return index !== 0;
    };
    const toggleGroup = (heading) => {
        const index = currentConfig.groups.findIndex((g) => g.heading === heading);
        const current = index >= 0 && isGroupCollapsed(currentConfig.groups[index], index);
        setCollapsedGroups(prev => ({ ...prev, [heading]: !current }));
    };

    const allCollapsed = currentConfig.groups.length > 0 && currentConfig.groups.every((g, i) => isGroupCollapsed(g, i));
    const toggleAllGroups = () => {
        if (allCollapsed) {
            const next = {};
            currentConfig.groups.forEach(g => { next[g.heading] = false; });
            setCollapsedGroups(next);
        } else {
            const next = {};
            currentConfig.groups.forEach(g => { next[g.heading] = true; });
            setCollapsedGroups(next);
        }
    };

    if (isPanelCollapsed) {
        return (
            <aside className={styles.rightNavCollapsed} data-right-rail="collapsed" aria-label={t("components.Workspace.RightSubNav.aria-label_right_navigation_collapsed", "Right navigation collapsed")}>
                <div className={styles.collapsedRailLabel}>
                    <span>{currentConfig.title}</span>
                </div>
                <div className={styles.railFooter}>
                    <button
                        type="button"
                        className={styles.expandRailBtn}
                        onClick={() => setIsPanelCollapsed(false)}
                        title={t("components.Workspace.RightSubNav.text_expand_panel", "Expand panel")}
                        aria-label={t("components.Workspace.RightSubNav.text_expand_panel", "Expand panel")}
                    >
                        <PanelLeftOpen size={20} aria-hidden="true" />
                    </button>
                </div>
            </aside>
        );
    }

    return (
        <aside className={styles.rightNavContainer} data-right-rail="open" aria-label={readData("components.Workspace.RightSubNav", "RightSubNav_aria-label_130")}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerTitleWrap}>
                    <h3>{translateText(currentConfig.title)}</h3>
                    {currentConfig.subtitle && <p className={styles.subTitle}>{translateText(currentConfig.subtitle)}</p>}
                </div>
                <div className={styles.headerActions}>
                    {currentConfig.groups.length > 1 && (
                        <button
                            className={styles.iconBtn}
                            onClick={toggleAllGroups}
                            title={allCollapsed ? "Expand all sections" : "Collapse all sections"}
                            aria-label={allCollapsed ? "Expand all sections" : "Collapse all sections"}
                        >
                            <ChevronRight sx={{ fontSize: 16, transform: allCollapsed ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform 0.15s ease' }} />
                        </button>
                    )}
                    {onClose && (
                        <button
                            className={styles.closeBtn}
                            onClick={onClose}
                            title={readData("components.Workspace.RightSubNav", "RightSubNav_title_131")}
                            aria-label={readData("components.Workspace.RightSubNav", "RightSubNav_aria-label_132")}
                        >
                            <X sx={{ fontSize: 16 }} />
                        </button>
                    )}
                </div>
            </div>

            {/* Scrollable Groups */}
            <div className={styles.scrollArea}>
                {currentConfig.groups.map((group, gIdx) => {
                    const isCollapsed = isGroupCollapsed(group, gIdx);
                    return (
                        <div key={gIdx} className={styles.navGroup}>
                            <button
                                type="button"
                                className={styles.groupHeadingBtn}
                                onClick={() => toggleGroup(group.heading)}
                                aria-expanded={!isCollapsed}
                                title={isCollapsed ? `Expand ${translateText(group.heading)}` : `Collapse ${translateText(group.heading)}`}
                            >
                                <span className={styles.groupHeadingText}>{translateText(group.heading)}</span>
                                <div className={styles.groupHeadingMeta}>
                                    {isCollapsed && (
                                        <span className={styles.groupCountBadge}>{group.items.length}</span>
                                    )}
                                    <ChevronRight
                                        sx={{
                                             fontSize: 14,
                                             transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                                             transition: 'transform 0.18s ease',
                                             color: 'var(--text-3)'
                                        }}
                                    />
                                </div>
                            </button>
                            {!isCollapsed && (
                                <div className={styles.itemsList}>
                                    {group.items.map((item) => {
                                        const Icon = item.icon;
                                        const isSelected = activeSubFeature === item.id;

                                        return (
                                            <button
                                                key={item.id}
                                                className={`
                                                    ${styles.navItem}
                                                    ${isSelected ? styles.navItemActive : ''}
                                                    ${item.highlight && !isSelected ? styles.navItemHighlight : ''}
                                                `}
                                                onClick={() => onSelectSubFeature(item.id)}
                                            >
                                                <div className={styles.itemIcon}>
                                                    <Icon sx={{ fontSize: 16 }} strokeWidth={isSelected ? readData("components.Workspace.RightSubNav", "display_1") : readData("components.Workspace.RightSubNav", "display_2")} />
                                                </div>
                                                <span className={styles.itemLabel} title={stripConsoleCode(translateText(item.label))}>{stripConsoleCode(translateText(item.label))}</span>
                                                {item.tag && (
                                                    <span className={styles.itemTag}>{item.tag}</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Footer: collapse sits at the bottom, matching the left rail */}
            <div className={styles.railFooter}>
                <button
                    type="button"
                    className={styles.footerToggle}
                    onClick={() => setIsPanelCollapsed(true)}
                    title={t("components.Workspace.RightSubNav.text_collapse_panel", "Collapse panel")}
                    aria-label={t("components.Workspace.RightSubNav.text_collapse_panel", "Collapse panel")}
                >
                    <PanelLeftClose size={20} aria-hidden="true" />
                </button>
            </div>
        </aside>
    );
};

export default RightSubNav;
