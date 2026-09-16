"use client";
import {useTranslation} from '@/context/I18nContext';

import NextImage from 'next/image';

import { readData } from '../../services/workspace-data.mjs';

import React, { useState, useMemo } from 'react';
import {
    ShieldCheck, Users, Search, Filter, RefreshCw, Key,
    Lock, Unlock, Eye, CheckCircle2, XCircle, AlertTriangle,
    Building2, Briefcase, CreditCard, ChevronRight, UserCheck,
    Laptop, ShieldAlert, Sparkles, Sliders, ArrowLeft, Download
} from 'lucide-react';
import styles from './AccessControlView.module.css';
import { useAuth, DEFAULT_MODULE_PERMISSIONS, DEFAULT_CONSOLE_PERMISSIONS } from '@/context/AuthContext';
import { useHRMS } from '@/context/HRMSContext';

const MODULE_REGISTRY = readData("components.Workspace.AccessControlView", "MODULE_REGISTRY_1");

const COCKPIT_REGISTRY = readData("components.Workspace.AccessControlView", "COCKPIT_REGISTRY_2");

const DATA_SCOPES = readData("components.Workspace.AccessControlView", "DATA_SCOPES_3");

const ROLE_LIST = readData("components.Workspace.AccessControlView", "ROLE_LIST_4");

export default function AccessControlView({ onNavigate, onSelectConsole }) {
    const {t: translateText}=useTranslation();

    const {
        user: authUser,
        modulePermissions,
        consolePermissions,
        userCustomPermissions,
        setUserModulePermission,
        setUserConsolePermission,
        setUserDataScope,
        resetUserPermissions,
        grantAllToUser,
        revokeAllFromUser,
        toggleModulePermission,
        toggleConsolePermission,
        resetPermissionsToDefault,
        switchRole
    } = useAuth();

    const { employees, showToast } = useHRMS();

    const [activeTab, setActiveTab] = useState(readData("components.Workspace.AccessControlView", "initialState_1")); // 'user_access' | 'role_matrix' | 'audit_log'
    const [searchQuery, setSearchQuery] = useState('');
    const [deptFilter, setDeptFilter] = useState(readData("components.Workspace.AccessControlView", "initialState_2"));
    const [selectedUserId, setSelectedUserId] = useState(readData("components.Workspace.AccessControlView", "initialState_3")); // Default to Priya Nair (Employee) for rich demo

    // Consolidate full directory of users
    const allUsers = useMemo(() => {
        const directory = [...(employees || [])];
        // Ensure default key persona profiles are present
        const defaultProfiles = readData("components.Workspace.AccessControlView", "defaultProfiles_5");

        defaultProfiles.forEach(p => {
            if (!directory.some(e => e.email?.toLowerCase() === p.email.toLowerCase() || e.id === p.id)) {
                directory.unshift(p);
            }
        });

        return directory;
    }, [employees]);

    // Filtered users list
    const filteredUsers = useMemo(() => {
        return allUsers.filter(u => {
            const matchesSearch = !searchQuery ||
                u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.dept?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.role?.toLowerCase().includes(searchQuery.toLowerCase());

            const hasCustomOverride = !!userCustomPermissions[u.id] || !!userCustomPermissions[u.email];
            if (deptFilter === 'WITH_OVERRIDES') return matchesSearch && hasCustomOverride;
            if (deptFilter !== 'ALL' && u.dept !== deptFilter) return false;

            return matchesSearch;
        });
    }, [allUsers, searchQuery, deptFilter, userCustomPermissions]);

    // Identify active selected user
    const selectedUser = useMemo(() => {
        return allUsers.find(u => u.id === selectedUserId || u.email === selectedUserId) || allUsers[0];
    }, [allUsers, selectedUserId]);

    // User's custom overrides if any
    const userOverrides = useMemo(() => {
        if (!selectedUser) return null;
        return userCustomPermissions[selectedUser.id] || userCustomPermissions[selectedUser.email] || null;
    }, [userCustomPermissions, selectedUser]);

    // Count of total overrides across the platform
    const totalCustomOverridesCount = Object.keys(userCustomPermissions || {}).length;

    // Helper to evaluate effective permission for selected user on a module
    const getEffectiveModulePerm = (moduleKey) => {
        if (!selectedUser) return readData("components.Workspace.AccessControlView", "getEffectiveModulePerm_6");
        if (selectedUser.role === 'SUPER_ADMIN') return readData("components.Workspace.AccessControlView", "getEffectiveModulePerm_7");

        const overrideVal = userOverrides?.modules?.[moduleKey];
        if (overrideVal !== undefined) {
            return {
                allowed: !!overrideVal,
                source: overrideVal ? 'OVERRIDE_GRANTED' : 'OVERRIDE_REVOKED'
            };
        }

        const roleAllowed = (modulePermissions[moduleKey] || DEFAULT_MODULE_PERMISSIONS[moduleKey] || []).includes(selectedUser.role);
        return {
            allowed: roleAllowed,
            ...readData("components.Workspace.AccessControlView", "getEffectiveModulePerm_fields_8")
        };
    };

    // Helper to evaluate effective permission for selected user on a cockpit
    const getEffectiveConsolePerm = (consoleId) => {
        if (!selectedUser) return readData("components.Workspace.AccessControlView", "getEffectiveConsolePerm_9");
        if (selectedUser.role === 'SUPER_ADMIN') return readData("components.Workspace.AccessControlView", "getEffectiveConsolePerm_10");

        const overrideVal = userOverrides?.consoles?.[consoleId];
        if (overrideVal !== undefined) {
            return {
                allowed: !!overrideVal,
                source: overrideVal ? 'OVERRIDE_GRANTED' : 'OVERRIDE_REVOKED'
            };
        }

        const roleAllowed = (consolePermissions[consoleId] || DEFAULT_CONSOLE_PERMISSIONS[consoleId] || []).includes(selectedUser.role);
        return {
            allowed: roleAllowed,
            ...readData("components.Workspace.AccessControlView", "getEffectiveConsolePerm_fields_11")
        };
    };

    // Toggle specific module for selected user
    const handleToggleUserModule = (moduleKey) => {
        if (!selectedUser) return;
        const current = getEffectiveModulePerm(moduleKey);
        const targetUserId = selectedUser.id || selectedUser.email;
        const nextValue = !current.allowed;

        setUserModulePermission(targetUserId, moduleKey, nextValue);
        showToast?.(
            nextValue ? 'Module Access Granted' : 'Module Access Revoked',translateText("components.Workspace.AccessControlView","text_818a30c487", {value1: String(MODULE_REGISTRY.find(m => m.key === moduleKey)?.name), value2: String(selectedUser.name)}),
            nextValue ? 'success' : 'info'
        );
    };

    // Toggle specific console for selected user
    const handleToggleUserConsole = (consoleId) => {
        if (!selectedUser) return;
        const current = getEffectiveConsolePerm(consoleId);
        const targetUserId = selectedUser.id || selectedUser.email;
        const nextValue = !current.allowed;

        setUserConsolePermission(targetUserId, consoleId, nextValue);
        showToast?.(
            nextValue ? 'Console Unlocked' : 'Console Restricted',translateText("components.Workspace.AccessControlView","text_473e9fc737", {value1: String(consoleId), value2: String(selectedUser.name)}),
            nextValue ? 'success' : 'info'
        );
    };

    // Revert single module override back to role baseline
    const handleRevertModuleOverride = (moduleKey, e) => {
        e?.stopPropagation();
        if (!selectedUser) return;
        const targetUserId = selectedUser.id || selectedUser.email;
        setUserModulePermission(targetUserId, moduleKey, null);
        showToast?.(translateText("components.Workspace.AccessControlView","text_bd0744876d"),translateText("components.Workspace.AccessControlView","text_2411ab7926", {value1: String(moduleKey), value2: String(selectedUser.name)}), 'info');
    };

    // Quick Action: Grant All
    const handleGrantAll = () => {
        if (!selectedUser) return;
        grantAllToUser(selectedUser.id || selectedUser.email);
        showToast?.(translateText("components.Workspace.AccessControlView","text_f4086bbf33"),translateText("components.Workspace.AccessControlView","text_66e5fff677", {value1: String(selectedUser.name)}), 'success');
    };

    // Quick Action: Restrict to ESS
    const handleRestrictAll = () => {
        if (!selectedUser) return;
        revokeAllFromUser(selectedUser.id || selectedUser.email);
        showToast?.(translateText("components.Workspace.AccessControlView","text_a3966fe995"),translateText("components.Workspace.AccessControlView","text_ec36003698", {value1: String(selectedUser.name)}), 'warning');
    };

    // Quick Action: Reset Overrides
    const handleResetUser = () => {
        if (!selectedUser) return;
        resetUserPermissions(selectedUser.id || selectedUser.email);
        showToast?.(translateText("components.Workspace.AccessControlView","text_0953e0d516"),translateText("components.Workspace.AccessControlView","text_7f80275770", {value1: String(selectedUser.name)}), 'info');
    };

    // Impersonate / Test as User
    const handleTestAsUser = () => {
        if (!selectedUser) return;
        switchRole(selectedUser.role);
        showToast?.(translateText("components.Workspace.AccessControlView","text_6cbc60d91d"),translateText("components.Workspace.AccessControlView","text_80e75036c4", {value1: String(selectedUser.name), value2: String(selectedUser.role)}), 'info');
        if (onNavigate) onNavigate('dashboard');
    };

    return (
        <div className={styles.pageContainer}>
            {/* Page Header */}
            <div className={styles.pageHeader}>
                <div className={styles.headerLeft}>
                    <div className={styles.badgeTag}>
                        <ShieldCheck size={13} />{readData("components.Workspace.AccessControlView", "content_text_12")}</div>
                    <h1 className={styles.title}>{readData("components.Workspace.AccessControlView", "content_text_13")}</h1>
                    <p className={styles.subtitle}>{readData("components.Workspace.AccessControlView", "content_text_14")}<strong>{readData("components.Workspace.AccessControlView", "content_text_15")}</strong>{readData("components.Workspace.AccessControlView", "content_text_16")}</p>
                </div>

                <div className={styles.headerActions}>
                    <button
                        className={styles.btnSecondary}
                        onClick={() => {
                            if (window.confirm('Reset all roles and custom user overrides to factory enterprise defaults?')) {
                                resetPermissionsToDefault();
                                showToast?.(translateText("components.Workspace.AccessControlView","text_e386bd4401"),translateText("components.Workspace.AccessControlView","text_a3e2e157d7"), 'info');
                            }
                        }}
                        title={readData("components.Workspace.AccessControlView", "content_title_17")}
                    >
                        <RefreshCw size={14} />{readData("components.Workspace.AccessControlView", "content_text_18")}</button>
                    {onNavigate && (
                        <button
                            className={styles.btnSecondary}
                            onClick={() => onNavigate('settings')}
                            title={readData("components.Workspace.AccessControlView", "content_title_19")}
                        >
                            <ArrowLeft size={14} />{readData("components.Workspace.AccessControlView", "content_text_20")}</button>
                    )}
                </div>
            </div>

            {/* Metrics Ribbon */}
            <div className={styles.metricGrid}>
                <div className={styles.metricCard}>
                    <div className={styles.metricIconWrap} style={{ background: 'rgba(79, 182, 245, 0.15)', color: 'var(--signal)' }}>
                        <Users size={22} />
                    </div>
                    <div className={styles.metricInfo}>
                        <span className={styles.metricLabel}>{readData("components.Workspace.AccessControlView", "content_text_21")}</span>
                        <span className={styles.metricValue}>{allUsers.length}</span>
                    </div>
                </div>

                <div className={styles.metricCard}>
                    <div className={styles.metricIconWrap} style={{ background: 'rgba(242, 169, 59, 0.15)', color: '#F2A93B' }}>
                        <Sliders size={22} />
                    </div>
                    <div className={styles.metricInfo}>
                        <span className={styles.metricLabel}>{readData("components.Workspace.AccessControlView", "content_text_22")}</span>
                        <span className={styles.metricValue} style={{ color: totalCustomOverridesCount > 0 ? '#F2A93B' : 'var(--text)' }}>
                            {totalCustomOverridesCount}
                        </span>
                    </div>
                </div>

                <div className={styles.metricCard}>
                    <div className={styles.metricIconWrap} style={{ background: 'rgba(45, 212, 168, 0.15)', color: 'var(--status-ok)' }}>
                        <ShieldCheck size={22} />
                    </div>
                    <div className={styles.metricInfo}>
                        <span className={styles.metricLabel}>{readData("components.Workspace.AccessControlView", "content_text_23")}</span>
                        <span className={styles.metricValue}>{readData("components.Workspace.AccessControlView", "content_text_24")}</span>
                    </div>
                </div>

                <div className={styles.metricCard}>
                    <div className={styles.metricIconWrap} style={{ background: 'rgba(155, 140, 255, 0.15)', color: 'var(--agent)' }}>
                        <Key size={22} />
                    </div>
                    <div className={styles.metricInfo}>
                        <span className={styles.metricLabel}>{readData("components.Workspace.AccessControlView", "content_text_25")}</span>
                        <span className={styles.metricValue} style={{ fontSize: '1.05rem', marginTop: '0.2rem' }}>{readData("components.Workspace.AccessControlView", "content_text_26")}</span>
                    </div>
                </div>
            </div>

            {/* Studio Navigation Tabs */}
            <div className={styles.tabNav}>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'user_access' ? styles.tabBtnActive : ''}`}
                    onClick={() => setActiveTab('user_access')}
                >
                    <UserCheck size={16} />
                    <span>{readData("components.Workspace.AccessControlView", "content_text_27")}</span>
                    <span className={styles.tabCountBadge}>{allUsers.length}</span>
                </button>

                <button
                    className={`${styles.tabBtn} ${activeTab === 'role_matrix' ? styles.tabBtnActive : ''}`}
                    onClick={() => setActiveTab('role_matrix')}
                >
                    <Sliders size={16} />
                    <span>{readData("components.Workspace.AccessControlView", "content_text_28")}</span>
                    <span className={styles.tabCountBadge}>{ROLE_LIST.length} {readData("components.Workspace.AccessControlView", "content_text_29")}</span>
                </button>

                <button
                    className={`${styles.tabBtn} ${activeTab === 'audit_log' ? styles.tabBtnActive : ''}`}
                    onClick={() => setActiveTab('audit_log')}
                >
                    <ShieldAlert size={16} />
                    <span>{readData("components.Workspace.AccessControlView", "content_text_30")}</span>
                </button>
            </div>

            {/* TAB 1: INDIVIDUAL USER ACCESS CONFIGURATION */}
            {activeTab === 'user_access' && (
                <div className={styles.splitLayout}>
                    {/* Left Pane: Platform User Directory */}
                    <div className={styles.userListPane}>
                        <div className={styles.searchBox}>
                            <Search size={15} className={styles.searchIcon} />
                            <input
                                type="text"
                                className={styles.searchInput}
                                placeholder={readData("components.Workspace.AccessControlView", "content_placeholder_31")}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {/* Filter Chips */}
                        <div className={styles.filterChips}>
                            <button
                                className={`${styles.filterChip} ${deptFilter === 'ALL' ? styles.filterChipActive : ''}`}
                                onClick={() => setDeptFilter('ALL')}
                            >{readData("components.Workspace.AccessControlView", "content_text_32")}</button>
                            <button
                                className={`${styles.filterChip} ${deptFilter === 'WITH_OVERRIDES' ? styles.filterChipActive : ''}`}
                                onClick={() => setDeptFilter('WITH_OVERRIDES')}
                            >{readData("components.Workspace.AccessControlView", "content_text_33")}{totalCustomOverridesCount}{readData("components.Workspace.AccessControlView", "content_text_34")}</button>
                            <button
                                className={`${styles.filterChip} ${deptFilter === 'Engineering' ? styles.filterChipActive : ''}`}
                                onClick={() => setDeptFilter('Engineering')}
                            >{readData("components.Workspace.AccessControlView", "content_text_35")}</button>
                            <button
                                className={`${styles.filterChip} ${deptFilter === 'Product' ? styles.filterChipActive : ''}`}
                                onClick={() => setDeptFilter('Product')}
                            >{readData("components.Workspace.AccessControlView", "content_text_36")}</button>
                            <button
                                className={`${styles.filterChip} ${deptFilter === 'Human Resources' ? styles.filterChipActive : ''}`}
                                onClick={() => setDeptFilter('Human Resources')}
                            >{readData("components.Workspace.AccessControlView", "content_text_37")}</button>
                        </div>

                        {/* User List Scroll */}
                        <div className={styles.userScrollList}>
                            {filteredUsers.map((user) => {
                                const isSelected = (selectedUser?.id === user.id || selectedUser?.email === user.email);
                                const hasOverride = !!userCustomPermissions[user.id] || !!userCustomPermissions[user.email];
                                const initials = user.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : readData("components.Workspace.AccessControlView", "display_4");

                                return (
                                    <button
                                        key={user.id || user.email}
                                        className={`${styles.userCardItem} ${isSelected ? styles.userCardItemActive : ''}`}
                                        onClick={() => setSelectedUserId(user.id || user.email)}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                            {user.avatar ? (
                                                <NextImage unoptimized width={48} height={48} src={user.avatar} alt={user.name} className={styles.userCardAvatar} />
                                            ) : (
                                                <div className={styles.userCardInitials}>{initials}</div>
                                            )}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                                                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text)' }}>
                                                    {user.name}
                                                </span>
                                                <span style={{ fontSize: '0.72rem', color: 'var(--text-2)' }}>
                                                    {user.role}{readData("components.Workspace.AccessControlView", "content_text_38")}{user.dept || readData("components.Workspace.AccessControlView", "fallback_1")}
                                                </span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                                            {hasOverride && (
                                                <span title={readData("components.Workspace.AccessControlView", "content_title_39")} style={{ color: '#F2A93B', fontSize: '0.75rem' }}>{readData("components.Workspace.AccessControlView", "content_text_40")}</span>
                                            )}
                                            <ChevronRight size={14} color={isSelected ? readData("components.Workspace.AccessControlView", "display_5") : readData("components.Workspace.AccessControlView", "display_6")} />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Pane: Selected User Permission Inspector & Editor */}
                    <div className={styles.detailPane}>
                        {selectedUser ? (
                            <>
                                {/* User Hero Card */}
                                <div className={styles.userHeroCard}>
                                    <div className={styles.userHeroLeft}>
                                        {selectedUser.avatar ? (
                                            <NextImage unoptimized width={48} height={48} src={selectedUser.avatar} alt={selectedUser.name} className={styles.userHeroAvatar} />
                                        ) : (
                                            <div className={styles.userHeroInitials}>
                                                {selectedUser.name?.substring(0, 2).toUpperCase()}
                                            </div>
                                        )}
                                        <div className={styles.userHeroInfo}>
                                            <div className={styles.userNameRow}>
                                                <h2 className={styles.userHeroName}>{selectedUser.name}</h2>
                                                <span style={{
                                                    padding: '0.2rem 0.55rem',
                                                    borderRadius: '6px',
                                                    fontSize: '0.72rem',
                                                    fontWeight: 700,
                                                    background: 'rgba(79, 182, 245, 0.15)',
                                                    color: 'var(--signal)',
                                                    border: '1px solid rgba(79, 182, 245, 0.3)'
                                                }}>
                                                    {selectedUser.role}
                                                </span>
                                                {userOverrides && (
                                                    <span className={styles.overrideTag}>{readData("components.Workspace.AccessControlView", "content_text_41")}</span>
                                                )}
                                            </div>
                                            <p className={styles.userHeroSub}>
                                                <span>{selectedUser.email}</span>
                                                <span>{readData("components.Workspace.AccessControlView", "content_text_42")}</span>
                                                <span>{selectedUser.dept || readData("components.Workspace.AccessControlView", "fallback_2")}</span>
                                                <span>{readData("components.Workspace.AccessControlView", "content_text_43")}</span>
                                                <span>{selectedUser.location || readData("components.Workspace.AccessControlView", "fallback_3")}</span>
                                                <span>{readData("components.Workspace.AccessControlView", "content_text_44")}</span>
                                                <span>{readData("components.Workspace.AccessControlView", "content_text_45")}{selectedUser.id}</span>
                                            </p>
                                        </div>
                                    </div>

                                    <div className={styles.userHeroActions}>
                                        <button className={styles.btnSecondary} onClick={handleTestAsUser} title={readData("components.Workspace.AccessControlView", "content_title_46")}>
                                            <Eye size={14} color="#4FB6F5" />{readData("components.Workspace.AccessControlView", "content_text_47")}</button>
                                        <button className={styles.btnPrimary} onClick={handleGrantAll} title={readData("components.Workspace.AccessControlView", "content_title_48")}>
                                            <Unlock size={14} />{readData("components.Workspace.AccessControlView", "content_text_49")}</button>
                                        {userOverrides && (
                                            <button className={styles.btnDanger} onClick={handleResetUser} title={readData("components.Workspace.AccessControlView", "content_title_50")}>
                                                <RefreshCw size={14} />{readData("components.Workspace.AccessControlView", "content_text_51")}</button>
                                        )}
                                    </div>
                                </div>

                                {/* User Configuration Parameters: Scope & Role */}
                                <div className={styles.userConfigBar}>
                                    <div className={styles.configField}>
                                        <label className={styles.configLabel}>
                                            <Building2 size={13} color="var(--status-ok)" />{readData("components.Workspace.AccessControlView", "content_text_52")}</label>
                                        <select
                                            className={styles.configSelect}
                                            value={userOverrides?.dataScope || (selectedUser.role === 'SUPER_ADMIN' ? readData("components.Workspace.AccessControlView", "display_7") : readData("components.Workspace.AccessControlView", "display_8"))}
                                            onChange={(e) => {
                                                setUserDataScope(selectedUser.id || selectedUser.email, e.target.value);
                                                showToast?.(translateText("components.Workspace.AccessControlView","text_5e35eb9dea"),translateText("components.Workspace.AccessControlView","text_2b87d8572a", {value1: String(e.target.value), value2: String(selectedUser.name)}), 'success');
                                            }}
                                        >
                                            {DATA_SCOPES.map(s => (
                                                <option key={s.id} value={s.id}>{s.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className={styles.configField}>
                                        <label className={styles.configLabel}>
                                            <Briefcase size={13} color="#4FB6F5" />{readData("components.Workspace.AccessControlView", "content_text_53")}</label>
                                        <select
                                            className={styles.configSelect}
                                            defaultValue="CUSTOM"
                                            onChange={(e) => {
                                                if (e.target.value === 'GRANT_ALL') handleGrantAll();
                                                else if (e.target.value === 'RESTRICT_ESS') handleRestrictAll();
                                                else if (e.target.value === 'RESET') handleResetUser();
                                            }}
                                        >
                                            <option value="CUSTOM">{readData("components.Workspace.AccessControlView", "content_text_54")}{Object.keys(userOverrides?.modules || {}).length}{readData("components.Workspace.AccessControlView", "content_text_55")}</option>
                                            <option value="GRANT_ALL">{readData("components.Workspace.AccessControlView", "content_text_56")}</option>
                                            <option value="RESTRICT_ESS">{readData("components.Workspace.AccessControlView", "content_text_57")}</option>
                                            <option value="RESET">{readData("components.Workspace.AccessControlView", "content_text_58")}</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Section 1: Functional Feature Modules (18 Modules) */}
                                <div className={styles.sectionCard}>
                                    <div className={styles.sectionHeader}>
                                        <div className={styles.sectionTitleGroup}>
                                            <h3 className={styles.sectionTitle}>
                                                <Lock size={16} color="var(--status-ok)" />{readData("components.Workspace.AccessControlView", "content_text_59")}</h3>
                                            <p className={styles.sectionSubtitle}>{readData("components.Workspace.AccessControlView", "content_text_60")}<strong>{selectedUser.name}</strong>{readData("components.Workspace.AccessControlView", "content_text_61")}</p>
                                        </div>
                                        <span style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>
                                            {MODULE_REGISTRY.filter(m => getEffectiveModulePerm(m.key).allowed).length}{readData("components.Workspace.AccessControlView", "content_text_62")}</span>
                                    </div>

                                    <div className={styles.moduleGrid}>
                                        {MODULE_REGISTRY.map((mod) => {
                                            const status = getEffectiveModulePerm(mod.key);
                                            const isOverridden = status.source.startsWith('OVERRIDE');

                                            return (
                                                <div
                                                    key={mod.key}
                                                    className={`${styles.modulePermCard} ${status.allowed ? styles.modulePermCardAllowed : styles.modulePermCardDenied}`}
                                                >
                                                    <div className={styles.modulePermLeft}>
                                                        <div
                                                            className={styles.moduleIconSquare}
                                                            style={{
                                                                background: status.allowed ? 'rgba(45, 212, 168, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                                                                color: status.allowed ? 'var(--status-ok)' : 'var(--text-3)'
                                                            }}
                                                        >
                                                            {status.allowed ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                                                        </div>
                                                        <div className={styles.modulePermMeta}>
                                                            <span className={styles.modulePermName}>{mod.name}</span>
                                                            <span className={styles.modulePermSource}>
                                                                {isOverridden ? (
                                                                    <span className={status.allowed ? styles.sourceOverride : styles.sourceOverrideRevoked}>{readData("components.Workspace.AccessControlView", "content_text_63")}{status.allowed ? readData("components.Workspace.AccessControlView", "display_9") : readData("components.Workspace.AccessControlView", "display_10")}
                                                                    </span>
                                                                ) : (
                                                                    <span className={styles.sourceInherited}>{readData("components.Workspace.AccessControlView", "content_text_64")}{selectedUser.role}{readData("components.Workspace.AccessControlView", "content_text_65")}</span>
                                                                )}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        {isOverridden && (
                                                            <button
                                                                onClick={(e) => handleRevertModuleOverride(mod.key, e)}
                                                                style={{
                                                                    background: 'transparent',
                                                                    border: 'none',
                                                                    color: 'var(--text-2)',
                                                                    cursor: 'pointer',
                                                                    fontSize: '0.68rem',
                                                                    textDecoration: 'underline'
                                                                }}
                                                                title={readData("components.Workspace.AccessControlView", "content_title_66")}
                                                            >{readData("components.Workspace.AccessControlView", "content_text_67")}</button>
                                                        )}
                                                        <div
                                                            className={`${styles.toggleSwitch} ${status.allowed ? styles.toggleSwitchActive : ''}`}
                                                            onClick={() => handleToggleUserModule(mod.key)}
                                                            title={translateText("components.Workspace.AccessControlView","text_5db7d8dc8c", {value1: String(status.allowed ? readData("components.Workspace.AccessControlView", "display_11") : readData("components.Workspace.AccessControlView", "display_12"))})}
                                                        >
                                                            <div className={styles.toggleSwitchThumb} />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Section 2: Executive Cockpit Consoles (S1 to S10) */}
                                <div className={styles.sectionCard}>
                                    <div className={styles.sectionHeader}>
                                        <div className={styles.sectionTitleGroup}>
                                            <h3 className={styles.sectionTitle}>
                                                <Laptop size={16} color="#4FB6F5" />{readData("components.Workspace.AccessControlView", "content_text_68")}</h3>
                                            <p className={styles.sectionSubtitle}>{readData("components.Workspace.AccessControlView", "content_text_69")}<strong>{selectedUser.name}</strong>{readData("components.Workspace.AccessControlView", "content_text_70")}</p>
                                        </div>
                                        <span style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>
                                            {COCKPIT_REGISTRY.filter(c => getEffectiveConsolePerm(c.id).allowed).length}{readData("components.Workspace.AccessControlView", "content_text_71")}</span>
                                    </div>

                                    <div className={styles.cockpitGrid}>
                                        {COCKPIT_REGISTRY.map((c) => {
                                            const status = getEffectiveConsolePerm(c.id);
                                            const isOverridden = status.source.startsWith('OVERRIDE');

                                            return (
                                                <div
                                                    key={c.id}
                                                    className={styles.cockpitPermCard}
                                                    style={{ borderLeft: `3px solid ${status.allowed ? c.color : 'rgba(255, 255, 255, 0.1)'}` }}
                                                >
                                                    <div className={styles.cockpitTop}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                                            <span
                                                                className={styles.cockpitIdBadge}
                                                                style={{ background: `${c.color}20`, color: 'var(--signal-ink)', border: `1px solid ${c.color}40` }}
                                                            >
                                                                {c.id}
                                                            </span>
                                                            <strong style={{ fontSize: '0.82rem', color: 'var(--text)' }}>{c.name}</strong>
                                                        </div>

                                                        <div
                                                            className={`${styles.toggleSwitch} ${status.allowed ? styles.toggleSwitchActive : ''}`}
                                                            onClick={() => handleToggleUserConsole(c.id)}
                                                            title={translateText("components.Workspace.AccessControlView","text_b8ebb1051d", {value1: String(c.id)})}
                                                        >
                                                            <div className={styles.toggleSwitchThumb} />
                                                        </div>
                                                    </div>

                                                    <p className={styles.cockpitDesc}>{c.desc}</p>

                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                                                        <span style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>{readData("components.Workspace.AccessControlView", "content_text_72")}{c.persona}</span>
                                                        <span style={{ fontSize: '0.68rem', fontWeight: 700 }}>
                                                            {isOverridden ? (
                                                                <span style={{ color: status.allowed ? 'var(--status-ok)' : '#F43F5E' }}>{readData("components.Workspace.AccessControlView", "content_text_73")}{status.allowed ? readData("components.Workspace.AccessControlView", "display_13") : readData("components.Workspace.AccessControlView", "display_14")}
                                                                </span>
                                                            ) : (
                                                                <span style={{ color: 'var(--text-2)' }}>{readData("components.Workspace.AccessControlView", "content_text_74")}</span>
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-2)' }}>{readData("components.Workspace.AccessControlView", "content_text_75")}</div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2: GLOBAL ROLE BASELINES MATRIX (RBAC) */}
            {activeTab === 'role_matrix' && (
                <div className={styles.sectionCard}>
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionTitleGroup}>
                            <h3 className={styles.sectionTitle}>
                                <Sliders size={16} color="var(--status-ok)" />{readData("components.Workspace.AccessControlView", "content_text_76")}</h3>
                            <p className={styles.sectionSubtitle}>{readData("components.Workspace.AccessControlView", "content_text_77")}</p>
                        </div>
                    </div>

                    <div className={styles.matrixWrapper}>
                        <table className={styles.matrixTable}>
                            <thead>
                                <tr>
                                    <th style={{ minWidth: '220px' }}>{readData("components.Workspace.AccessControlView", "content_text_78")}</th>
                                    <th>{readData("components.Workspace.AccessControlView", "content_text_79")}</th>
                                    {ROLE_LIST.map(r => (
                                        <th key={r.key} style={{ textAlign: 'center', color: 'var(--text)' }}>
                                            {r.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {MODULE_REGISTRY.map(mod => (
                                    <tr key={mod.key}>
                                        <td>
                                            <strong style={{ color: 'var(--text)' }}>{mod.name}</strong>
                                        </td>
                                        <td style={{ color: 'var(--text-2)', fontSize: '0.74rem' }}>{mod.category}</td>
                                        {ROLE_LIST.map(role => {
                                            const isSuperAdmin = role.key === 'SUPER_ADMIN';
                                            const isAllowed = isSuperAdmin || (modulePermissions[mod.key] || DEFAULT_MODULE_PERMISSIONS[mod.key] || []).includes(role.key);

                                            return (
                                                <td key={role.key} style={{ textAlign: 'center' }}>
                                                    {isSuperAdmin ? (
                                                        <span title={readData("components.Workspace.AccessControlView", "content_title_80")} style={{ color: 'var(--status-ok)', fontWeight: 800 }}>{readData("components.Workspace.AccessControlView", "content_text_81")}</span>
                                                    ) : (
                                                        <input
                                                            type="checkbox"
                                                            checked={isAllowed}
                                                            onChange={() => {
                                                                toggleModulePermission(mod.key, role.key);
                                                                showToast?.(translateText("components.Workspace.AccessControlView","text_a9c1581438"),translateText("components.Workspace.AccessControlView","text_30fefaac97", {value1: String(mod.name), value2: String(role.label)}), 'info');
                                                            }}
                                                            style={{ cursor: 'pointer', accentColor: 'var(--status-ok)', transform: 'scale(1.2)' }}
                                                        />
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 3: SECURITY & AUDIT LOG */}
            {activeTab === 'audit_log' && (
                <div className={styles.sectionCard}>
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionTitleGroup}>
                            <h3 className={styles.sectionTitle}>
                                <ShieldAlert size={16} color="#F2A93B" />{readData("components.Workspace.AccessControlView", "content_text_82")}</h3>
                            <p className={styles.sectionSubtitle}>{readData("components.Workspace.AccessControlView", "content_text_83")}</p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{
                            padding: '1rem 1.25rem',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: '10px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <strong style={{ color: 'var(--status-ok)', fontSize: '0.85rem' }}>{readData("components.Workspace.AccessControlView", "content_text_84")}</strong>
                                <p style={{ margin: '0.2rem 0 0', color: 'var(--text-2)', fontSize: '0.78rem' }}>{readData("components.Workspace.AccessControlView", "content_text_85")}<span style={{ color: 'var(--text)' }}>{readData("components.Workspace.AccessControlView", "content_text_86")}</span>{readData("components.Workspace.AccessControlView", "content_text_87")}</p>
                            </div>
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-3)' }}>{readData("components.Workspace.AccessControlView", "content_text_88")}</span>
                        </div>

                        <div style={{
                            padding: '1rem 1.25rem',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: '10px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <strong style={{ color: 'var(--signal)', fontSize: '0.85rem' }}>{readData("components.Workspace.AccessControlView", "content_text_89")}</strong>
                                <p style={{ margin: '0.2rem 0 0', color: 'var(--text-2)', fontSize: '0.78rem' }}>{readData("components.Workspace.AccessControlView", "content_text_90")}</p>
                            </div>
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-3)' }}>{readData("components.Workspace.AccessControlView", "content_text_91")}</span>
                        </div>

                        <div style={{
                            padding: '1rem 1.25rem',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: '10px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <strong style={{ color: 'var(--agent)', fontSize: '0.85rem' }}>{readData("components.Workspace.AccessControlView", "content_text_92")}</strong>
                                <p style={{ margin: '0.2rem 0 0', color: 'var(--text-2)', fontSize: '0.78rem' }}>{readData("components.Workspace.AccessControlView", "content_text_93")}</p>
                            </div>
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-3)' }}>{readData("components.Workspace.AccessControlView", "content_text_94")}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
