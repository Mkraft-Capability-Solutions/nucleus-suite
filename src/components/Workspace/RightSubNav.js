"use client";
import { readData } from '../../services/workspace-data.mjs';

import React from 'react';
import { getNavigationDomains } from '@/lib/workspace-navigation';
import X from '@mui/icons-material/Close';
import ChevronRight from '@mui/icons-material/ChevronRight';
import TrendingUp from '@mui/icons-material/TrendingUp';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/context/I18nContext';
import { canViewNavigationItem } from '@/lib/navigation-access';
import styles from './RightSubNav.module.css';

const ROLE_PERMITTED_CONSOLES = readData("components.Workspace.RightSubNav", "ROLE_PERMITTED_CONSOLES_1");

const RightSubNav = ({
    activeDomain,
    activeSubFeature,
    onSelectSubFeature,
    isOpen = true,
    onClose
}) => {
    const { t: translateText } = useTranslation();
    const { user, isConsoleAllowed, isModuleAllowed } = useAuth();
    const [collapsedGroups, setCollapsedGroups] = React.useState({});
    const [isPanelCollapsed, setIsPanelCollapsed] = React.useState(false);

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
        subtitle: `${userRole === 'SUPER_ADMIN' ? 'Universal Access' : userRole.replace('_', ' ')} • ${permittedConsoleIds.length} Consoles Available`,
        groups: rawConfig.groups
            .map(g => ({
                ...g,
                items: g.items.filter(item => permittedConsoleIds.includes(item.id.toUpperCase()))
            }))
            .filter(g => g.items.length > 0)
    } : rawConfig;
    const currentConfig = {
        ...domainConfig,
        groups: domainConfig.groups
            .map((group) => ({ ...group, items: group.items.filter((item) => canViewNavigationItem(item, isModuleAllowed, user)) }))
            .filter((group) => group.items.length > 0),
    };

    const toggleGroup = (heading) => {
        setCollapsedGroups(prev => ({
            ...prev,
            [heading]: !prev[heading]
        }));
    };

    const allCollapsed = currentConfig.groups.length > 0 && currentConfig.groups.every(g => Boolean(collapsedGroups[g.heading]));
    const toggleAllGroups = () => {
        if (allCollapsed) {
            setCollapsedGroups({});
        } else {
            const next = {};
            currentConfig.groups.forEach(g => { next[g.heading] = true; });
            setCollapsedGroups(next);
        }
    };

    if (isPanelCollapsed) {
        return (
            <aside className={styles.rightNavCollapsed} aria-label="Right navigation collapsed">
                <button
                    className={styles.expandRailBtn}
                    onClick={() => setIsPanelCollapsed(false)}
                    title="Expand right sidebar"
                    aria-label="Expand right sidebar"
                >
                    <ChevronRight sx={{ fontSize: 18, transform: 'rotate(180deg)' }} />
                </button>
                <div className={styles.collapsedRailLabel}>
                    <span>{currentConfig.title}</span>
                </div>
            </aside>
        );
    }

    return (
        <aside className={styles.rightNavContainer} aria-label={readData("components.Workspace.RightSubNav", "RightSubNav_aria-label_130")}>
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
                    <button
                        className={styles.iconBtn}
                        onClick={() => setIsPanelCollapsed(true)}
                        title="Collapse right sidebar"
                        aria-label="Collapse right sidebar"
                    >
                        <ChevronRight sx={{ fontSize: 16 }} />
                    </button>
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
                    const isCollapsed = Boolean(collapsedGroups[group.heading]);
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
                                                <span className={styles.itemLabel} title={translateText(item.label)}>{translateText(item.label)}</span>
                                                {item.tag && (
                                                    <span
                                                        style={{
                                                            fontSize: '0.62rem',
                                                            padding: '0.1rem 0.35rem',
                                                            borderRadius: 'var(--r-pill, 4px)',
                                                            fontWeight: 600,
                                                            background: isSelected ? 'var(--signal-ink)' : 'var(--card-2)',
                                                            color: isSelected ? 'var(--on-signal, #fff)' : 'var(--text-3)',
                                                            flexShrink: 0,
                                                            marginLeft: 'auto',
                                                        }}
                                                    >
                                                        {item.tag}
                                                    </span>
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
        </aside>
    );
};

export default RightSubNav;
