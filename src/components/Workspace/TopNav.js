"use client";
import {useTranslation} from '@/context/I18nContext';

import NextImage from 'next/image';

import { readData } from '../../services/workspace-data.mjs';

import React, { useState, useRef, useEffect } from 'react';
import Bell from '@mui/icons-material/NotificationsOutlined';
import Plus from '@mui/icons-material/Add';
import Mic from '@mui/icons-material/Mic';
import Search from '@mui/icons-material/Search';
import Sparkles from '@mui/icons-material/AutoAwesomeOutlined';
import Settings from '@mui/icons-material/SettingsOutlined';
import CreditCard from '@mui/icons-material/PaymentsOutlined';
import Calendar from '@mui/icons-material/CalendarMonthOutlined';
import Briefcase from '@mui/icons-material/WorkOutline';
import ChevronDown from '@mui/icons-material/ExpandMore';
import Check from '@mui/icons-material/Check';
import Users from '@mui/icons-material/GroupsOutlined';
import LogOut from '@mui/icons-material/Logout';
import PanelRight from '@mui/icons-material/VerticalSplitOutlined';
import LayoutGrid from '@mui/icons-material/DashboardOutlined';
import LayoutDashboard from '@mui/icons-material/SpaceDashboardOutlined';
import ShieldCheck from '@mui/icons-material/VerifiedUserOutlined';
import { useAuth } from '@/context/AuthContext';
import { useHRMS } from '@/context/HRMSContext';
import styles from './TopNav.module.css';
import AppearanceToggle from '@/components/AppearanceToggle';
import LanguageSelector from '@/components/LanguageSelector';
import { speakAloud } from '@/utils/voiceCommandEngine';

const ROLE_TO_DEFAULT_CONSOLE = readData("components.Workspace.TopNav", "ROLE_TO_DEFAULT_CONSOLE_1");

const ROLE_PERMITTED_CONSOLES = readData("components.Workspace.TopNav", "ROLE_PERMITTED_CONSOLES_2");

const ALL_CONSOLES = readData("components.Workspace.TopNav", "ALL_CONSOLES_3");

const TopNav = ({
    activeTab,
    onTabChange,
    searchQuery = '',
    onSearchChange,
    isRightNavOpen = true,
    onToggleRightNav,
    onToggleModules,
    isModulesOpen = false,
    activeConsole = readData("components.Workspace.TopNav", "defaultValue_1"),
    onSelectConsole
}) => {
    const {t: translateText}=useTranslation();

    const { user, logout, openAccessControl, isConsoleAllowed, isModuleAllowed } = useAuth();
    const { showToast } = useHRMS();
    const userRole = user?.role || readData("components.Workspace.TopNav", "fallback_1");

    // Role-Based Access Control (RBAC) filtering for consoles
    const permittedConsoleIds = (ROLE_PERMITTED_CONSOLES[userRole] || readData("components.Workspace.TopNav", "permittedConsoleIds_4"))
        .filter((consoleId) => isConsoleAllowed(consoleId, userRole, user?.id || user?.email));
    const permittedConsoles = ALL_CONSOLES.filter(c => permittedConsoleIds.includes(c.id));
    const effectiveConsoleId = permittedConsoleIds.includes(activeConsole) ? activeConsole : (ROLE_TO_DEFAULT_CONSOLE[userRole] || readData("components.Workspace.TopNav", "fallback_2"));
    const currentConsoleConfig = ALL_CONSOLES.find(c => c.id === effectiveConsoleId) || ALL_CONSOLES[0];

    const [showQuickActions, setShowQuickActions] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showConsoleMenu, setShowConsoleMenu] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);

    const quickActionsRef = useRef(null);
    const notifRef = useRef(null);
    const profileRef = useRef(null);
    const consoleRef = useRef(null);
    const searchDropdownRef = useRef(null);

    // Real-time debounced search across modules and employees
    useEffect(() => {
        if (!searchQuery || searchQuery.trim().length < 2) {
            setSearchResults([]);
            setShowSearchDropdown(false);
            return;
        }
        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const res = await fetch(`/api/v1/search?q=${encodeURIComponent(searchQuery.trim())}`);
                if (res.ok) {
                    const json = await res.json();
                    setSearchResults(json.data || []);
                    setShowSearchDropdown(true);
                }
            } catch (e) {
                console.warn('Search query notice:', e);
            } finally {
                setIsSearching(false);
            }
        }, 200);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Auto-close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (profileRef.current && !profileRef.current.contains(e.target)) {
                setShowProfileMenu(false);
            }
            if (quickActionsRef.current && !quickActionsRef.current.contains(e.target)) {
                setShowQuickActions(false);
            }
            if (notifRef.current && !notifRef.current.contains(e.target)) {
                setShowNotifications(false);
            }
            if (consoleRef.current && !consoleRef.current.contains(e.target)) {
                setShowConsoleMenu(false);
            }
            if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target)) {
                setShowSearchDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const quickActions = [
        { ...readData("components.Workspace.TopNav", "quickActions_fields_5"), icon: Briefcase, ...readData("components.Workspace.TopNav", "quickActions_fields_6") },
        { ...readData("components.Workspace.TopNav", "quickActions_fields_7"), icon: Calendar, ...readData("components.Workspace.TopNav", "quickActions_fields_8") },
        { ...readData("components.Workspace.TopNav", "quickActions_fields_9"), icon: CreditCard, ...readData("components.Workspace.TopNav", "quickActions_fields_10") },
        { ...readData("components.Workspace.TopNav", "quickActions_fields_11"), icon: Sparkles, ...readData("components.Workspace.TopNav", "quickActions_fields_12") },
    ].filter((action) => isModuleAllowed(action.id, userRole, user?.id || user?.email));

    const handleQuickAction = (tab) => {
        onTabChange(tab);
        setShowQuickActions(false);
    };

    const handleLogout = () => {
        setShowProfileMenu(false);
        logout();
        showToast(translateText("components.Workspace.TopNav","text_25941aea4c"),translateText("components.Workspace.TopNav","text_4d158fa9e7"), 'info');
    };

    return (
        <header className={styles.headerNav} role="banner">
            {/* Left: Global Search Bar + Dual-Pane Modules Launcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0, maxWidth: '460px' }}>
                <div className={styles.searchBarWrapper} style={{ flex: 1, position: 'relative' }}>
                    <Search sx={{ fontSize: 16 }} className={styles.searchIcon} />
                    <input
                        type="text"
                        placeholder={readData("components.Workspace.TopNav", "TopNav_placeholder_13")}
                        className={styles.searchInput}
                        value={searchQuery}
                        onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
                        onFocus={() => { if (searchResults.length > 0) setShowSearchDropdown(true); }}
                        aria-label={readData("components.Workspace.TopNav", "TopNav_aria-label_14")}
                    />
                    <div className={styles.cmdShortcut}>{readData("components.Workspace.TopNav", "TopNav_text_15")}</div>

                    {/* Real-Time ⌘K Autocomplete Dropdown */}
                    {showSearchDropdown && searchResults.length > 0 && (
                        <div
                            ref={searchDropdownRef}
                            style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                marginTop: '4px',
                                background: 'var(--card)',
                                border: '1px solid var(--line)',
                                borderRadius: 'var(--r-control, 8px)',
                                boxShadow: 'var(--shadow-overlay)',
                                zIndex: 1000,
                                maxHeight: '320px',
                                overflowY: 'auto',
                                padding: '0.35rem 0',
                            }}
                        >
                            {searchResults.map((item, idx) => {
                                const badgeStyle =
                                    item.type === 'form'
                                        ? { background: 'var(--signal-wash)', color: 'var(--signal)' }
                                        : item.type === 'screen'
                                        ? { background: 'var(--info-wash)', color: 'var(--info)' }
                                        : item.type === 'document'
                                        ? { background: 'var(--flag-wash)', color: 'var(--flag)' }
                                        : item.type === 'employee'
                                        ? { background: 'var(--status-ok-wash)', color: 'var(--status-ok)' }
                                        : { background: 'var(--pending-wash)', color: 'var(--pending)' };

                                return (
                                    <div
                                        key={`${item.type}-${item.id}-${idx}`}
                                        onClick={() => {
                                            if (item.targetTab) {
                                                onTabChange(item.targetTab, item.domain, item.subFeature);
                                            } else if (item.type === 'employee') {
                                                onTabChange('people_core', 'workforce', item.id);
                                            } else if (item.type === 'document') {
                                                onTabChange('document_vault', 'core_hr', 'document_vault');
                                            }
                                            setShowSearchDropdown(false);
                                        }}
                                        style={{
                                            padding: '0.55rem 0.85rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            cursor: 'pointer',
                                            borderBottom: '1px solid var(--line-soft)',
                                            transition: 'background 0.15s ease',
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--signal-wash)')}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <div style={{ minWidth: 0, flex: 1, marginRight: '0.5rem' }}>
                                            <div
                                                style={{
                                                    fontWeight: 600,
                                                    fontSize: '0.82rem',
                                                    color: 'var(--text)',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                }}
                                            >
                                                {item.title}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: '0.7rem',
                                                    color: 'var(--text-2)',
                                                    marginTop: '2px',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                }}
                                            >
                                                {item.subtitle}
                                            </div>
                                        </div>
                                        <span
                                            style={{
                                                fontSize: '0.62rem',
                                                padding: '0.15rem 0.45rem',
                                                borderRadius: '4px',
                                                fontWeight: 700,
                                                flexShrink: 0,
                                                ...badgeStyle,
                                            }}
                                        >
                                            {item.tag || item.type.toUpperCase()}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Dual-Pane Navigator Launcher (⌘M) */}
                {onToggleModules && (
                    <button
                        className={`${styles.modulesBtn} ${isModulesOpen ? styles.modulesBtnActive : ''}`}
                        onClick={onToggleModules}
                        title={readData("components.Workspace.TopNav", "TopNav_title_16")}
                        aria-label={readData("components.Workspace.TopNav", "TopNav_aria-label_17")}
                    >
                        <LayoutGrid sx={{ fontSize: 15 }} color="var(--signal)" />
                        <span>{readData("components.Workspace.TopNav", "TopNav_text_18")}</span>
                        <span className={styles.modulesShortcut}>{readData("components.Workspace.TopNav", "TopNav_text_19")}</span>
                    </button>
                )}
            </div>

            {/* Center: Dedicated Dashboards & MultipliersKraft Consoles Selector */}
            {onSelectConsole && (
                <div ref={consoleRef} style={{ position: 'relative' }}>
                    <button
                        className={`${styles.consoleSelectorBtn} ${activeTab === 'dashboard' ? styles.consoleSelectorBtnActive : ''}`}
                        onClick={() => setShowConsoleMenu(!showConsoleMenu)}
                        title={readData("components.Workspace.TopNav", "TopNav_title_20")}
                        aria-label={readData("components.Workspace.TopNav", "TopNav_aria-label_21")}
                    >
                        <LayoutDashboard sx={{ fontSize: 15 }} color="var(--signal)" />
                        <span style={{ fontSize: 'var(--t-small)', color: 'var(--text-2)', fontWeight: 600 }}>{readData("components.Workspace.TopNav", "TopNav_text_22")}</span>
                        <span className={styles.consoleBadge}>{currentConsoleConfig.id}</span>
                        <span className={styles.consoleTitle}>{currentConsoleConfig.title}</span>
                        <ChevronDown sx={{ fontSize: 14 }} className={`${styles.chevronIcon} ${showConsoleMenu ? styles.chevronRotated : ''}`} />
                    </button>

                    {showConsoleMenu && (
                        <div className={styles.consoleDropdownMenu} role="menu">
                            <div className={styles.consoleDropdownHeader}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 700, fontSize: 'var(--t-small)', color: 'var(--text)' }}>{readData("components.Workspace.TopNav", "TopNav_text_23")}{permittedConsoles.length}{readData("components.Workspace.TopNav", "TopNav_text_24")}</span>
                                    <span style={{
                                        fontSize: '0.66rem',
                                        background: userRole === 'SUPER_ADMIN' ? 'var(--signal-wash)' : 'rgba(56, 189, 248, 0.15)',
                                        color: userRole === 'SUPER_ADMIN' ? 'var(--signal)' : 'var(--info)',
                                        padding: '0.15rem 0.45rem',
                                        borderRadius: '4px',
                                        fontWeight: 700
                                    }}>
                                        {userRole === 'SUPER_ADMIN' ? readData("components.Workspace.TopNav", "display_2") : userRole.replace('_', ' ')}
                                    </span>
                                </div>
                                <div style={{ fontSize: 'var(--t-micro)', color: 'var(--text-2)', marginTop: '0.2rem' }}>
                                    {userRole === 'SUPER_ADMIN'
                                        ? readData("components.Workspace.TopNav", "display_3")
                                        :translateText("components.Workspace.TopNav","text_f0ea68918d", {value1: String(userRole.replace('_', ' '))})
                                    }
                                </div>
                            </div>
                            <div className={styles.consoleList}>
                                {permittedConsoles.map((c) => {
                                    const isSelected = effectiveConsoleId === c.id && activeTab === 'dashboard';
                                    return (
                                        <button
                                            key={c.id}
                                            className={`${styles.consoleItem} ${isSelected ? styles.consoleItemActive : ''}`}
                                            onClick={() => {
                                                onSelectConsole(c.id);
                                                if (onTabChange) onTabChange('dashboard', 'dashboard', c.id.toLowerCase());
                                                setShowConsoleMenu(false);
                                                showToast(translateText("components.Workspace.TopNav","text_8290d65752"),translateText("components.Workspace.TopNav","text_a00b1786e3", {value1: String(c.title), value2: String(c.id)}), 'info');
                                            }}
                                        >
                                            <span className={styles.consoleItemBadge}>{c.id}</span>
                                            <div className={styles.consoleItemText}>
                                                <div className={styles.consoleItemTitle}>{c.title}</div>
                                                <div className={styles.consoleItemSub}>{c.persona}</div>
                                            </div>
                                            {isSelected && <Check sx={{ fontSize: 14 }} color="var(--status-ok)" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Right: Theme Toggle, Notifications, User Profile & Sub-Nav Toggle */}
            <div className={styles.rightActions}>
                {/* Super Admin Access Control Trigger */}
                {['SUPER_ADMIN', 'ADMIN'].includes(userRole) && isModuleAllowed('settings', userRole, user?.id || user?.email) && (
                    <button
                        className={styles.iconBtn}
                        onClick={() => onTabChange ? onTabChange('access_control') : openAccessControl()}
                        style={{
                            width: 'auto',
                            padding: '0 0.75rem',
                            gap: '0.4rem',
                            borderRadius: '8px',
                            background: 'var(--signal-wash)',
                            border: '1px solid var(--line-glow)',
                            color: 'var(--signal)',
                            fontSize: '0.76rem',
                            fontWeight: 700
                        }}
                        title={readData("components.Workspace.TopNav", "TopNav_title_25")}
                    >
                        <ShieldCheck sx={{ fontSize: 15 }} color="var(--signal)" />
                        <span>{readData("components.Workspace.TopNav", "TopNav_text_26")}</span>
                    </button>
                )}

                {/* Voice Navigation Trigger */}
                <button
                    className={styles.iconBtn}
                    onClick={() => {
                        if (typeof window === 'undefined') return;

                        const hour = new Date().getHours();
                        let timeGreeting = 'Good evening';
                        if (hour < 12) timeGreeting = 'Good morning';
                        else if (hour < 17) timeGreeting = 'Good afternoon';
                        const name = user?.name ? user.name.trim().split(' ')[0] : 'Superadmin';
                        const greetingText = `${timeGreeting}, ${name}! How can I help you today?`;

                        window.dispatchEvent(
                            new CustomEvent('nucleus:voice_navigation', {
                                detail: {
                                    greeting: greetingText,
                                    autoStart: true,
                                },
                            })
                        );
                    }}
                    title="Nucleus Talk — Voice Assist (Click or Speak)"
                    aria-label="Nucleus Talk"
                    style={{
                        background: 'rgba(56, 189, 248, 0.1)',
                        borderColor: 'rgba(56, 189, 248, 0.25)',
                        color: 'var(--signal, #0284c7)'
                    }}
                >
                    <Mic sx={{ fontSize: 18 }} />
                </button>

                <LanguageSelector />
                <AppearanceToggle />
                {/* Quick Action (+) */}
                {quickActions.length > 0 && <div ref={quickActionsRef} style={{ position: 'relative' }}>
                    <button
                        className={styles.quickActionBtn}
                        onClick={() => setShowQuickActions(!showQuickActions)}
                        title={readData("components.Workspace.TopNav", "TopNav_title_28")}
                        aria-label={readData("components.Workspace.TopNav", "TopNav_aria-label_29")}
                    >
                        <Plus sx={{ fontSize: 20 }} />
                    </button>
                    {showQuickActions && (
                        <div className={styles.dropdownMenu} role="menu">
                            {quickActions.map((action) => {
                                const Icon = action.icon;
                                return (
                                    <button key={action.id} className={styles.dropdownItem} onClick={() => handleQuickAction(action.id)}>
                                        <Icon sx={{ fontSize: 16 }} color={action.iconColor} /> {action.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>}

                {/* Notifications */}
                <div ref={notifRef} style={{ position: 'relative' }}>
                    <button
                        className={styles.iconBtn}
                        onClick={() => setShowNotifications(!showNotifications)}
                        title={readData("components.Workspace.TopNav", "TopNav_title_30")}
                        aria-label={readData("components.Workspace.TopNav", "TopNav_aria-label_31")}
                    >
                        <Bell sx={{ fontSize: 18 }} />
                        <span className={styles.badge} />
                    </button>
                    {showNotifications && (
                        <div className={styles.dropdownMenu} style={{ width: '280px' }}>
                            <div style={{ padding: '0.5rem', fontWeight: '700', fontSize: 'var(--t-small)', color: 'var(--text)', borderBottom: '1px solid var(--line)' }}>{readData("components.Workspace.TopNav", "TopNav_text_32")}</div>
                            <div style={{ padding: '0.75rem', fontSize: 'var(--t-small)', borderBottom: '1px solid var(--line-soft)' }}>
                                <strong>{readData("components.Workspace.TopNav", "TopNav_text_33")}</strong>
                                <p style={{ color: 'var(--text-2)', margin: '0.2rem 0 0' }}>{readData("components.Workspace.TopNav", "TopNav_text_34")}</p>
                            </div>
                            <div style={{ padding: '0.75rem', fontSize: 'var(--t-small)' }}>
                                <strong>{readData("components.Workspace.TopNav", "TopNav_text_35")}</strong>
                                <p style={{ color: 'var(--text-2)', margin: '0.2rem 0 0' }}>{readData("components.Workspace.TopNav", "TopNav_text_36")}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* User profile and account links */}
                <div ref={profileRef} className={styles.profileWrapper}>
                    <button
                        className={styles.profileBtn}
                        onClick={() => setShowProfileMenu(!showProfileMenu)}
                        aria-expanded={showProfileMenu}
                        aria-haspopup="true"
                        title={readData("components.Workspace.TopNav", "TopNav_title_37")}
                    >
                        <NextImage unoptimized width={48} height={48}
                            src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || readData("components.Workspace.TopNav", "fallback_3"))}&background=2563ea&color=fff`}
                            alt={user?.name || readData("components.Workspace.TopNav", "fallback_4")}
                            className={styles.avatar}
                            style={{ objectFit: 'cover' }}
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || readData("components.Workspace.TopNav", "fallback_5"))}&background=2563ea&color=fff`;
                            }}
                        />
                        <div className={styles.userTextCol}>
                            <span className={styles.userNameText}>{user?.name || readData("components.Workspace.TopNav", "fallback_6")}</span>
                            <span className={styles.userRoleSub}>{userRole.replace('_', ' ')}</span>
                        </div>
                        <ChevronDown sx={{ fontSize: 14 }} className={`${styles.chevronIcon} ${showProfileMenu ? styles.chevronRotated : ''}`} />
                    </button>

                    {showProfileMenu && (
                        <div className={styles.profileDropdown} role="menu">
                            {/* Profile Header */}
                            <div className={styles.profileHeader}>
                                <NextImage unoptimized width={48} height={48}
                                    src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || readData("components.Workspace.TopNav", "fallback_7"))}&background=2563ea&color=fff`}
                                    alt={readData("components.Workspace.TopNav", "TopNav_alt_38")}
                                    className={styles.dropdownAvatar}
                                    style={{ objectFit: 'cover' }}
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || readData("components.Workspace.TopNav", "fallback_8"))}&background=2563ea&color=fff`;
                                    }}
                                />
                                <div className={styles.profileInfo}>
                                    <span className={styles.profileName}>{user?.name || readData("components.Workspace.TopNav", "fallback_9")}</span>
                                    <span className={styles.profileEmail}>{user?.email || readData("components.Workspace.TopNav", "fallback_10")}</span>
                                    <span className={styles.profileRolePill}>
                                        {userRole.replace('_', ' ')}
                                    </span>
                                </div>
                            </div>

                            {/* Quick Links */}
                            <div className={styles.menuLinks}>
                                {['SUPER_ADMIN', 'ADMIN'].includes(userRole) && (
                                    <button
                                        className={styles.menuLinkItem}
                                        onClick={() => {
                                            if (onTabChange) onTabChange('access_control');
                                            else openAccessControl();
                                            setShowProfileMenu(false);
                                        }}
                                        style={{ color: 'var(--signal)', fontWeight: 600 }}
                                    >
                                        <ShieldCheck sx={{ fontSize: 15 }} color="var(--signal)" />{readData("components.Workspace.TopNav", "TopNav_text_39")}</button>
                                )}
                                {isModuleAllowed('settings', userRole, user?.id || user?.email) && <button
                                    className={styles.menuLinkItem}
                                    onClick={() => {
                                        onTabChange('settings');
                                        setShowProfileMenu(false);
                                    }}
                                >
                                    <Settings sx={{ fontSize: 15 }} color="var(--text-2)" />{readData("components.Workspace.TopNav", "TopNav_text_40")}</button>}
                                {isModuleAllowed('team', userRole, user?.id || user?.email) && <button
                                    className={styles.menuLinkItem}
                                    onClick={() => {
                                        onTabChange('team');
                                        setShowProfileMenu(false);
                                    }}
                                >
                                    <Users sx={{ fontSize: 15 }} color="var(--text-2)" />{readData("components.Workspace.TopNav", "TopNav_text_41")}</button>}
                            </div>

                            {/* Logout Action */}
                            <div className={styles.logoutSection}>
                                <button className={styles.logoutBtn} onClick={handleLogout}>
                                    <LogOut sx={{ fontSize: 15 }} />{readData("components.Workspace.TopNav", "TopNav_text_42")}</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Panel Toggle Button */}
                {onToggleRightNav && (
                    <button
                        className={`${styles.iconBtn} ${isRightNavOpen ? styles.iconBtnActive : ''}`}
                        onClick={onToggleRightNav}
                        title={isRightNavOpen ? readData("components.Workspace.TopNav", "display_8") : readData("components.Workspace.TopNav", "display_9")}
                        aria-label={readData("components.Workspace.TopNav", "TopNav_aria-label_43")}
                    >
                        <PanelRight sx={{ fontSize: 18 }} />
                    </button>
                )}
            </div>
        </header>
    );
};

export default TopNav;
