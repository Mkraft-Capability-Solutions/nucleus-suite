"use client";
import {useTranslation} from '@/context/I18nContext';

import { readData } from '../../services/workspace-data.mjs';

import React, { useState, useEffect, useRef } from 'react';
import X from '@mui/icons-material/Close';
import Search from '@mui/icons-material/Search';
import ChevronRight from '@mui/icons-material/ChevronRight';
import LayoutGrid from '@mui/icons-material/DashboardOutlined';
import Layers from '@mui/icons-material/LayersOutlined';
import TrendingUp from '@mui/icons-material/TrendingUp';
import { useAuth } from '@/context/AuthContext';
import { canViewNavigationItem } from '@/lib/navigation-access';
import styles from './DualPaneNav.module.css';

const ROLE_PERMITTED_CONSOLES = readData("components.Navigation.DualPaneNav", "ROLE_PERMITTED_CONSOLES_1");

import { getNavigationDomains as MODULES_TAXONOMY } from '@/lib/workspace-navigation';

export default function DualPaneNav({
    isOpen = false,
    onClose,
    activeTab,
    activeConsole = readData("components.Navigation.DualPaneNav", "defaultValue_1"),
    onSelectConsole,
    onSelectTab
}) {
    const {t: translateText}=useTranslation();

    const { user, isConsoleAllowed, isModuleAllowed } = useAuth();
    const [activeModuleId, setActiveModuleId] = useState(readData("components.Navigation.DualPaneNav", "initialState_2"));
    const [searchQuery, setSearchQuery] = useState('');
    const debounceTimerRef = useRef(null);
    const containerRef = useRef(null);

    // Auto-close on ESC or click outside
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Tab' && isOpen && containerRef.current) {
                const items = [...containerRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled)')];
                const first = items[0], last = items[items.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
                if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
            }
            if (e.key === 'Escape' && isOpen) {
                onClose && onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => { window.removeEventListener('keydown', handleKeyDown); clearTimeout(debounceTimerRef.current); };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    // Handle debounced hover (40ms) on Left Module
    const handleModuleMouseEnter = (moduleId) => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            setActiveModuleId(moduleId);
        }, 40);
    };

    const userRole = user?.role || readData("components.Navigation.DualPaneNav", "fallback_1");
    const permittedConsoleIds = (ROLE_PERMITTED_CONSOLES[userRole] || readData("components.Navigation.DualPaneNav", "permittedConsoleIds_135")).filter((consoleId) => isConsoleAllowed(consoleId, userRole, user?.id || user?.email));

    const effectiveTaxonomy = MODULES_TAXONOMY().map(m => {
        if (m.id === 'dashboard') {
            return {
                ...m,
                badge: userRole === 'SUPER_ADMIN' ? 'S1–S10 (All)' : `${permittedConsoleIds.length} Consoles`,
                groups: m.groups.map(g => ({
                    ...g,
                    items: g.items.filter(item => permittedConsoleIds.includes(item.id.toUpperCase()))
                }))
            };
        }
        return {
            ...m,
            groups: m.groups,
        };
    }).map((moduleConfig) => ({
        ...moduleConfig,
        groups: moduleConfig.groups
            .map((group) => ({ ...group, items: group.items.filter((item) => canViewNavigationItem(item, isModuleAllowed, user)) }))
            .filter((group) => group.items.length > 0),
    })).filter((moduleConfig) => moduleConfig.groups.length > 0);

    const activeModule = effectiveTaxonomy.find(m => m.id === activeModuleId) || effectiveTaxonomy[0];

    // Search filter across all capabilities
    const searchMatches = searchQuery.trim() ? (
        effectiveTaxonomy.flatMap(m =>
            m.groups.flatMap(g =>
                g.items.filter(item =>
                    (item.label || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (item.desc || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (m.label || '').toLowerCase().includes(searchQuery.toLowerCase())
                ).map(item => ({ ...item, parentModule: m.label, parentId: m.id }))
            )
        )
    ) : null;

    const handleItemClick = (item, parentModuleId) => {
        if (item.targetTab === 'dashboard' && item.id.startsWith('s')) {
            const consoleCode = item.id.toUpperCase();
            if (onSelectConsole) onSelectConsole(consoleCode);
        }
        if (onSelectTab) {
            onSelectTab(item.targetTab, parentModuleId || activeModuleId, item.id);
        }
        if (onClose) onClose();
    };

    return (
        <div className={styles.overlay} onClick={(e) => {
            if (e.target === e.currentTarget) onClose && onClose();
        }}>
            <div className={styles.container} ref={containerRef} role="dialog" aria-modal="true" aria-labelledby="navigation-title">
                {/* Top Header Bar */}
                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <div className={styles.headerIconWrap}>
                            <LayoutGrid sx={{ fontSize: 18 }} />
                        </div>
                        <div>
                            <h2 id="navigation-title" className={styles.headerTitle}>{readData("components.Navigation.DualPaneNav", "content_text_136")}</h2>
                            <p className={styles.headerSubtitle}>{readData("components.Navigation.DualPaneNav", "content_text_137")}{userRole === 'SUPER_ADMIN' ? readData("components.Navigation.DualPaneNav", "display_3") :translateText("components.Navigation.DualPaneNav","text_b4a520bc62", {value1: String(userRole.replace('_', ' '))})}
                            </p>
                        </div>
                    </div>

                    {/* Search Input */}
                    <div className={styles.searchWrapper}>
                        <Search sx={{ fontSize: 15 }} className={styles.searchIcon} />
                        <input
                            type="text"
                            placeholder={readData("components.Navigation.DualPaneNav", "content_placeholder_138")}
                            className={styles.searchInput}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                        {searchQuery && (
                            <button aria-label={translateText("components.Navigation.DualPaneNav","text_a9e0109bbe")} className={styles.clearSearch} onClick={() => setSearchQuery('')}>
                                <X sx={{ fontSize: 14 }} />
                            </button>
                        )}
                    </div>

                    <button className={styles.closeBtn} onClick={onClose} title={readData("components.Navigation.DualPaneNav", "content_title_139")}>
                        <X sx={{ fontSize: 18 }} />
                    </button>
                </div>

                {/* Main Dual-Pane Body */}
                <div className={styles.dualPaneLayout}>
                    {/* LEFT COLUMN: MODULES (270px) */}
                    <aside className={styles.leftColumn}>
                        <div className={styles.columnLabel}>{readData("components.Navigation.DualPaneNav", "content_text_140")}</div>
                        {effectiveTaxonomy.map((module) => {
                            const Icon = module.icon;
                            const isActive = activeModuleId === module.id;

                            return (
                                <button
                                    key={module.id}
                                    className={`${styles.moduleItem} ${isActive ? styles.moduleItemActive : ''}`}
                                    onMouseEnter={() => handleModuleMouseEnter(module.id)}
                                    onClick={() => setActiveModuleId(module.id)}
                                >
                                    <div className={styles.moduleIconWrap}>
                                        <Icon sx={{ fontSize: 16 }} />
                                    </div>
                                    <div className={styles.moduleTextCol}>
                                        <span className={styles.moduleName}>{module.label}</span>
                                        <span className={styles.moduleMeta}>{module.badge}</span>
                                    </div>
                                    <ChevronRight sx={{ fontSize: 14 }} className={styles.moduleArrow} />
                                </button>
                            );
                        })}
                    </aside>

                    {/* RIGHT PANE: SUB-MODULES */}
                    <main className={styles.rightPane}>
                        {searchMatches ? (
                            /* Search Results View */
                            <div className={styles.subModulesScroll}>
                                <div className={styles.searchCountBar}>{readData("components.Navigation.DualPaneNav", "content_text_141")}{searchMatches.length}{readData("components.Navigation.DualPaneNav", "content_text_142")}{searchQuery}{readData("components.Navigation.DualPaneNav", "content_text_143")}</div>
                                {searchMatches.length > 0 ? (
                                    <div className={styles.subModulesGrid}>
                                        {searchMatches.map((item) => {
                                            const Icon = item.icon || Layers;
                                            return (
                                                <button type="button"
                                                    key={item.id}
                                                    className={styles.subCard}
                                                    onClick={() => handleItemClick(item, item.parentId)}
                                                >
                                                    <div className={styles.subCardIconWrap}>
                                                        <Icon sx={{ fontSize: 16 }} />
                                                    </div>
                                                    <div className={styles.subCardBody}>
                                                        <div className={styles.subCardTitleRow}>
                                                            <span className={styles.subCardTitle}>{item.label}</span>
                                                            <span className={styles.cardTag}>{item.parentModule}</span>
                                                        </div>
                                                        <p className={styles.subCardDesc}>{item.desc}</p>
                                                    </div>
                                                    <ChevronRight sx={{ fontSize: 14 }} className={styles.subCardArrow} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className={styles.noResults}>
                                        <Search sx={{ fontSize: 32 }} opacity={0.3} />
                                        <span>{readData("components.Navigation.DualPaneNav", "content_text_144")}{searchQuery}{readData("components.Navigation.DualPaneNav", "content_text_145")}</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Normal Contextual Dual-Pane View */
                            <>
                                <div className={styles.paneHeader}>
                                    <div className={styles.breadcrumb}>
                                        <span>{activeModule.label}</span>
                                        <span>{readData("components.Navigation.DualPaneNav", "content_text_146")}</span>
                                        <span className={styles.breadcrumbCurrent}>{readData("components.Navigation.DualPaneNav", "content_text_147")}</span>
                                    </div>
                                    <span className={styles.paneBadge}>{activeModule.badge}</span>
                                </div>

                                <div className={styles.subModulesScroll}>
                                    {activeModule.groups.map((grp, gIdx) => (
                                        <div key={gIdx} className={styles.groupBlock}>
                                            <div className={styles.groupHeading}>{grp.heading}</div>
                                            <div className={styles.subModulesGrid}>
                                                {grp.items.map((item, itemIdx) => {
                                                    const Icon = item.icon || Layers;
                                                    const isCurrentTab = activeTab === item.targetTab;

                                                    return (
                                                        <button type="button"
                                                            key={item.id}
                                                            className={`${styles.subCard} ${isCurrentTab ? styles.subCardActive : ''}`}
                                                            style={{ animationDelay: `${itemIdx * 20}ms` }}
                                                            onClick={() => handleItemClick(item)}
                                                        >
                                                            <div className={styles.subCardIconWrap}>
                                                                <Icon sx={{ fontSize: 16 }} />
                                                            </div>
                                                            <div className={styles.subCardBody}>
                                                                <div className={styles.subCardTitleRow}>
                                                                    <span className={styles.subCardTitle}>{item.label}</span>
                                                                    {item.tag && (
                                                                        <span className={`
                                                                            ${styles.cardTag}
                                                                            ${item.tagViolet ? styles.cardTagViolet : ''}
                                                                        `}>
                                                                            {item.tag}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className={styles.subCardDesc}>{item.desc}</p>
                                                            </div>
                                                            <ChevronRight sx={{ fontSize: 14 }} className={styles.subCardArrow} />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </main>
                </div>

                {/* Footer Shortcut Bar */}
                <div className={styles.footer}>
                    <div className={styles.footerShortcuts}>
                        <div className={styles.shortcutItem}>
                            <span className={styles.kbd}>{readData("components.Navigation.DualPaneNav", "content_text_148")}</span>{readData("components.Navigation.DualPaneNav", "content_text_149")}</div>
                        <div className={styles.shortcutItem}>
                            <span className={styles.kbd}>{readData("components.Navigation.DualPaneNav", "content_text_150")}</span>{readData("components.Navigation.DualPaneNav", "content_text_151")}</div>
                        <div className={styles.shortcutItem}>
                            <span className={styles.kbd}>{readData("components.Navigation.DualPaneNav", "content_text_152")}</span>{readData("components.Navigation.DualPaneNav", "content_text_153")}</div>
                    </div>
                    <span>{readData("components.Navigation.DualPaneNav", "content_text_154")}</span>
                </div>
            </div>
        </div>
    );
}
