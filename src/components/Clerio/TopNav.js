"use client";
import NextImage from 'next/image';

import { readData } from '../../services/workspace-data.mjs';

import React, { useState, useRef, useEffect } from 'react';
import Bell from '@mui/icons-material/NotificationsOutlined';
import Plus from '@mui/icons-material/Add';
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

const ROLE_TO_DEFAULT_CONSOLE = readData("components.Clerio.TopNav", "ROLE_TO_DEFAULT_CONSOLE_1");

const ROLE_PERMITTED_CONSOLES = readData("components.Clerio.TopNav", "ROLE_PERMITTED_CONSOLES_2");

const ALL_CONSOLES = readData("components.Clerio.TopNav", "ALL_CONSOLES_3");

const TopNav = ({
    activeTab,
    onTabChange,
    searchQuery = '',
    onSearchChange,
    isRightNavOpen = true,
    onToggleRightNav,
    onToggleModules,
    isModulesOpen = false,
    activeConsole = readData("components.Clerio.TopNav", "defaultValue_1"),
    onSelectConsole
}) => {
    const { user, logout, openAccessControl, isConsoleAllowed, isModuleAllowed } = useAuth();
    const { showToast } = useHRMS();
    const userRole = user?.role || readData("components.Clerio.TopNav", "fallback_1");

    // Role-Based Access Control (RBAC) filtering for consoles
    const permittedConsoleIds = (ROLE_PERMITTED_CONSOLES[userRole] || readData("components.Clerio.TopNav", "permittedConsoleIds_4"))
        .filter((consoleId) => isConsoleAllowed(consoleId, userRole, user?.id || user?.email));
    const permittedConsoles = ALL_CONSOLES.filter(c => permittedConsoleIds.includes(c.id));
    const effectiveConsoleId = permittedConsoleIds.includes(activeConsole) ? activeConsole : (ROLE_TO_DEFAULT_CONSOLE[userRole] || readData("components.Clerio.TopNav", "fallback_2"));
    const currentConsoleConfig = ALL_CONSOLES.find(c => c.id === effectiveConsoleId) || ALL_CONSOLES[0];

    const [showQuickActions, setShowQuickActions] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showConsoleMenu, setShowConsoleMenu] = useState(false);

    const quickActionsRef = useRef(null);
    const notifRef = useRef(null);
    const profileRef = useRef(null);
    const consoleRef = useRef(null);

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
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const quickActions = [
        { ...readData("components.Clerio.TopNav", "quickActions_fields_5"), icon: Briefcase, ...readData("components.Clerio.TopNav", "quickActions_fields_6") },
        { ...readData("components.Clerio.TopNav", "quickActions_fields_7"), icon: Calendar, ...readData("components.Clerio.TopNav", "quickActions_fields_8") },
        { ...readData("components.Clerio.TopNav", "quickActions_fields_9"), icon: CreditCard, ...readData("components.Clerio.TopNav", "quickActions_fields_10") },
        { ...readData("components.Clerio.TopNav", "quickActions_fields_11"), icon: Sparkles, ...readData("components.Clerio.TopNav", "quickActions_fields_12") },
    ].filter((action) => isModuleAllowed(action.id, userRole, user?.id || user?.email));

    const handleQuickAction = (tab) => {
        onTabChange(tab);
        setShowQuickActions(false);
    };

    const handleLogout = () => {
        setShowProfileMenu(false);
        logout();
        showToast('Signed Out', 'You have been logged out of Nucleus HRMS.', 'info');
    };

    return (
        <header className={styles.headerNav} role="banner">
            {/* Left: Global Search Bar + Dual-Pane Modules Launcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0, maxWidth: '460px' }}>
                <div className={styles.searchBarWrapper} style={{ flex: 1 }}>
                    <Search sx={{ fontSize: 16 }} className={styles.searchIcon} />
                    <input
                        type="text"
                        placeholder={readData("components.Clerio.TopNav", "TopNav_placeholder_13")}
                        className={styles.searchInput}
                        value={searchQuery}
                        onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
                        aria-label={readData("components.Clerio.TopNav", "TopNav_aria-label_14")}
                    />
                    <div className={styles.cmdShortcut}>{readData("components.Clerio.TopNav", "TopNav_text_15")}</div>
                </div>

                {/* Dual-Pane Navigator Launcher (⌘M) */}
                {onToggleModules && (
                    <button
                        className={`${styles.modulesBtn} ${isModulesOpen ? styles.modulesBtnActive : ''}`}
                        onClick={onToggleModules}
                        title={readData("components.Clerio.TopNav", "TopNav_title_16")}
                        aria-label={readData("components.Clerio.TopNav", "TopNav_aria-label_17")}
                    >
                        <LayoutGrid sx={{ fontSize: 15 }} color="var(--signal)" />
                        <span>{readData("components.Clerio.TopNav", "TopNav_text_18")}</span>
                        <span className={styles.modulesShortcut}>{readData("components.Clerio.TopNav", "TopNav_text_19")}</span>
                    </button>
                )}
            </div>

            {/* Center: Dedicated Dashboards & MultipliersKraft Consoles Selector */}
            {onSelectConsole && (
                <div ref={consoleRef} style={{ position: 'relative' }}>
                    <button
                        className={`${styles.consoleSelectorBtn} ${activeTab === 'dashboard' ? styles.consoleSelectorBtnActive : ''}`}
                        onClick={() => setShowConsoleMenu(!showConsoleMenu)}
                        title={readData("components.Clerio.TopNav", "TopNav_title_20")}
                        aria-label={readData("components.Clerio.TopNav", "TopNav_aria-label_21")}
                    >
                        <LayoutDashboard sx={{ fontSize: 15 }} color="var(--signal)" />
                        <span style={{ fontSize: 'var(--t-small)', color: 'var(--text-2)', fontWeight: 600 }}>{readData("components.Clerio.TopNav", "TopNav_text_22")}</span>
                        <span className={styles.consoleBadge}>{currentConsoleConfig.id}</span>
                        <span className={styles.consoleTitle}>{currentConsoleConfig.title}</span>
                        <ChevronDown sx={{ fontSize: 14 }} className={`${styles.chevronIcon} ${showConsoleMenu ? styles.chevronRotated : ''}`} />
                    </button>

                    {showConsoleMenu && (
                        <div className={styles.consoleDropdownMenu} role="menu">
                            <div className={styles.consoleDropdownHeader}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 700, fontSize: 'var(--t-small)', color: 'var(--text)' }}>{readData("components.Clerio.TopNav", "TopNav_text_23")}{permittedConsoles.length}{readData("components.Clerio.TopNav", "TopNav_text_24")}</span>
                                    <span style={{
                                        fontSize: '0.66rem',
                                        background: userRole === 'SUPER_ADMIN' ? 'var(--signal-wash)' : 'rgba(56, 189, 248, 0.15)',
                                        color: userRole === 'SUPER_ADMIN' ? 'var(--signal)' : 'var(--info)',
                                        padding: '0.15rem 0.45rem',
                                        borderRadius: '4px',
                                        fontWeight: 700
                                    }}>
                                        {userRole === 'SUPER_ADMIN' ? readData("components.Clerio.TopNav", "display_2") : userRole.replace('_', ' ')}
                                    </span>
                                </div>
                                <div style={{ fontSize: 'var(--t-micro)', color: 'var(--text-2)', marginTop: '0.2rem' }}>
                                    {userRole === 'SUPER_ADMIN'
                                        ? readData("components.Clerio.TopNav", "display_3")
                                        : `Filtered by RBAC policy for ${userRole.replace('_', ' ')}`
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
                                                showToast('Console Switched', `Loaded ${c.title} (${c.id}).`, 'info');
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
                        title={readData("components.Clerio.TopNav", "TopNav_title_25")}
                    >
                        <ShieldCheck sx={{ fontSize: 15 }} color="var(--signal)" />
                        <span>{readData("components.Clerio.TopNav", "TopNav_text_26")}</span>
                    </button>
                )}

                <AppearanceToggle />
                {/* Quick Action (+) */}
                {quickActions.length > 0 && <div ref={quickActionsRef} style={{ position: 'relative' }}>
                    <button
                        className={styles.quickActionBtn}
                        onClick={() => setShowQuickActions(!showQuickActions)}
                        title={readData("components.Clerio.TopNav", "TopNav_title_28")}
                        aria-label={readData("components.Clerio.TopNav", "TopNav_aria-label_29")}
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
                        title={readData("components.Clerio.TopNav", "TopNav_title_30")}
                        aria-label={readData("components.Clerio.TopNav", "TopNav_aria-label_31")}
                    >
                        <Bell sx={{ fontSize: 18 }} />
                        <span className={styles.badge} />
                    </button>
                    {showNotifications && (
                        <div className={styles.dropdownMenu} style={{ width: '280px' }}>
                            <div style={{ padding: '0.5rem', fontWeight: '700', fontSize: 'var(--t-small)', color: 'var(--text)', borderBottom: '1px solid var(--line)' }}>{readData("components.Clerio.TopNav", "TopNav_text_32")}</div>
                            <div style={{ padding: '0.75rem', fontSize: 'var(--t-small)', borderBottom: '1px solid var(--line-soft)' }}>
                                <strong>{readData("components.Clerio.TopNav", "TopNav_text_33")}</strong>
                                <p style={{ color: 'var(--text-2)', margin: '0.2rem 0 0' }}>{readData("components.Clerio.TopNav", "TopNav_text_34")}</p>
                            </div>
                            <div style={{ padding: '0.75rem', fontSize: 'var(--t-small)' }}>
                                <strong>{readData("components.Clerio.TopNav", "TopNav_text_35")}</strong>
                                <p style={{ color: 'var(--text-2)', margin: '0.2rem 0 0' }}>{readData("components.Clerio.TopNav", "TopNav_text_36")}</p>
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
                        title={readData("components.Clerio.TopNav", "TopNav_title_37")}
                    >
                        <NextImage unoptimized width={48} height={48}
                            src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || readData("components.Clerio.TopNav", "fallback_3"))}&background=2563ea&color=fff`}
                            alt={user?.name || readData("components.Clerio.TopNav", "fallback_4")}
                            className={styles.avatar}
                            style={{ objectFit: 'cover' }}
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || readData("components.Clerio.TopNav", "fallback_5"))}&background=2563ea&color=fff`;
                            }}
                        />
                        <div className={styles.userTextCol}>
                            <span className={styles.userNameText}>{user?.name || readData("components.Clerio.TopNav", "fallback_6")}</span>
                            <span className={styles.userRoleSub}>{userRole.replace('_', ' ')}</span>
                        </div>
                        <ChevronDown sx={{ fontSize: 14 }} className={`${styles.chevronIcon} ${showProfileMenu ? styles.chevronRotated : ''}`} />
                    </button>

                    {showProfileMenu && (
                        <div className={styles.profileDropdown} role="menu">
                            {/* Profile Header */}
                            <div className={styles.profileHeader}>
                                <NextImage unoptimized width={48} height={48}
                                    src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || readData("components.Clerio.TopNav", "fallback_7"))}&background=2563ea&color=fff`}
                                    alt={readData("components.Clerio.TopNav", "TopNav_alt_38")}
                                    className={styles.dropdownAvatar}
                                    style={{ objectFit: 'cover' }}
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || readData("components.Clerio.TopNav", "fallback_8"))}&background=2563ea&color=fff`;
                                    }}
                                />
                                <div className={styles.profileInfo}>
                                    <span className={styles.profileName}>{user?.name || readData("components.Clerio.TopNav", "fallback_9")}</span>
                                    <span className={styles.profileEmail}>{user?.email || readData("components.Clerio.TopNav", "fallback_10")}</span>
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
                                        <ShieldCheck sx={{ fontSize: 15 }} color="var(--signal)" />{readData("components.Clerio.TopNav", "TopNav_text_39")}</button>
                                )}
                                {isModuleAllowed('settings', userRole, user?.id || user?.email) && <button
                                    className={styles.menuLinkItem}
                                    onClick={() => {
                                        onTabChange('settings');
                                        setShowProfileMenu(false);
                                    }}
                                >
                                    <Settings sx={{ fontSize: 15 }} color="var(--text-2)" />{readData("components.Clerio.TopNav", "TopNav_text_40")}</button>}
                                {isModuleAllowed('team', userRole, user?.id || user?.email) && <button
                                    className={styles.menuLinkItem}
                                    onClick={() => {
                                        onTabChange('team');
                                        setShowProfileMenu(false);
                                    }}
                                >
                                    <Users sx={{ fontSize: 15 }} color="var(--text-2)" />{readData("components.Clerio.TopNav", "TopNav_text_41")}</button>}
                            </div>

                            {/* Logout Action */}
                            <div className={styles.logoutSection}>
                                <button className={styles.logoutBtn} onClick={handleLogout}>
                                    <LogOut sx={{ fontSize: 15 }} />{readData("components.Clerio.TopNav", "TopNav_text_42")}</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Panel Toggle Button */}
                {onToggleRightNav && (
                    <button
                        className={`${styles.iconBtn} ${isRightNavOpen ? styles.iconBtnActive : ''}`}
                        onClick={onToggleRightNav}
                        title={isRightNavOpen ? readData("components.Clerio.TopNav", "display_8") : readData("components.Clerio.TopNav", "display_9")}
                        aria-label={readData("components.Clerio.TopNav", "TopNav_aria-label_43")}
                    >
                        <PanelRight sx={{ fontSize: 18 }} />
                    </button>
                )}
            </div>
        </header>
    );
};

export default TopNav;
