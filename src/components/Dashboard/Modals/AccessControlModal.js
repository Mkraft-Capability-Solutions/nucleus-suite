"use client";
import {useTranslation} from '@/context/I18nContext';

import { readData } from '../../../services/workspace-data.mjs';

import React, { useState } from 'react';
import {
    ShieldCheck, X, Search, Check, Lock, Unlock,
    Users, CreditCard, UserPlus, Layers, TrendingUp,
    Clock, Calendar, BarChart3, BookOpen, DollarSign,
    Sparkles, RefreshCw, HelpCircle, Shield, Briefcase,
    Building2, Settings, Sliders, ExternalLink
} from 'lucide-react';
import styles from './AccessControlModal.module.css';
import { useAuth } from '@/context/AuthContext';
import { useHRMS } from '@/context/HRMSContext';
import { ROLES } from '@/utils/permissions';

const ROLES_LIST = readData("components.Clerio.AccessControlView", "ROLE_LIST_4")
    .filter(role => role.key !== ROLES.SUPER_ADMIN)
    .map(role => ({ ...role, name: readData("context.AuthContext", "roleProfiles_4")[role.key].name, icon: Users }));

const MODULES_LIST = [
    { ...readData("components.Dashboard.Modals.AccessControlModal", "MODULES_LIST_fields_7"), icon: Users },
    { ...readData("components.Dashboard.Modals.AccessControlModal", "MODULES_LIST_fields_8"), icon: CreditCard },
    { ...readData("components.Dashboard.Modals.AccessControlModal", "MODULES_LIST_fields_9"), icon: UserPlus },
    { ...readData("components.Dashboard.Modals.AccessControlModal", "MODULES_LIST_fields_10"), icon: Layers },
    { ...readData("components.Dashboard.Modals.AccessControlModal", "MODULES_LIST_fields_11"), icon: TrendingUp },
    { ...readData("components.Dashboard.Modals.AccessControlModal", "MODULES_LIST_fields_12"), icon: Clock },
    { ...readData("components.Dashboard.Modals.AccessControlModal", "MODULES_LIST_fields_13"), icon: Calendar },
    { ...readData("components.Dashboard.Modals.AccessControlModal", "MODULES_LIST_fields_14"), icon: BarChart3 },
    { ...readData("components.Dashboard.Modals.AccessControlModal", "MODULES_LIST_fields_15"), icon: BookOpen },
    { ...readData("components.Dashboard.Modals.AccessControlModal", "MODULES_LIST_fields_16"), icon: DollarSign },
    { ...readData("components.Dashboard.Modals.AccessControlModal", "MODULES_LIST_fields_17"), icon: Sparkles },
    { ...readData("components.Dashboard.Modals.AccessControlModal", "MODULES_LIST_fields_18"), icon: RefreshCw },
    { ...readData("components.Dashboard.Modals.AccessControlModal", "MODULES_LIST_fields_19"), icon: Shield },
    { ...readData("components.Dashboard.Modals.AccessControlModal", "MODULES_LIST_fields_20"), icon: HelpCircle },
    { ...readData("components.Dashboard.Modals.AccessControlModal", "MODULES_LIST_fields_21"), icon: Users },
    { ...readData("components.Dashboard.Modals.AccessControlModal", "MODULES_LIST_fields_22"), icon: Briefcase },
    { ...readData("components.Dashboard.Modals.AccessControlModal", "MODULES_LIST_fields_23"), icon: Building2 },
    { ...readData("components.Dashboard.Modals.AccessControlModal", "MODULES_LIST_fields_24"), icon: Settings },
];

const CONSOLES_LIST = readData("components.Dashboard.Modals.AccessControlModal", "CONSOLES_LIST_25");

export default function AccessControlModal({ isOpen, onClose }) {
    const {t: translateText}=useTranslation();

    const {
        modulePermissions,
        consolePermissions,
        toggleModulePermission,
        toggleConsolePermission,
        resetPermissionsToDefault,
        switchRole,
        isModuleAllowed,
        isConsoleAllowed
    } = useAuth();
    const { showToast } = useHRMS();

    const [selectedRole, setSelectedRole] = useState(ROLES.HR_MANAGER);
    const [activeTab, setActiveTab] = useState(readData("components.Dashboard.Modals.AccessControlModal", "initialState_1")); // 'modules' | 'consoles'
    const [searchQuery, setSearchQuery] = useState('');

    if (!isOpen) return null;

    const currentRoleObj = ROLES_LIST.find(r => r.key === selectedRole) || ROLES_LIST[0];

    const filteredModules = MODULES_LIST.filter(m =>
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.tag.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredConsoles = CONSOLES_LIST.filter(c =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.persona.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.desc.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleToggleModule = (moduleKey, title) => {
        const currentlyAllowed = isModuleAllowed(moduleKey, selectedRole);
        toggleModulePermission(moduleKey, selectedRole);
        showToast?.(
            currentlyAllowed ? 'Access Revoked' : 'Access Granted',translateText("components.Dashboard.Modals.AccessControlModal","text_06096d35df", {value1: String(title), value2: String(currentlyAllowed ? 'locked' : 'unlocked'), value3: String(currentRoleObj.label)}),
            currentlyAllowed ? 'warning' : 'success'
        );
    };

    const handleToggleConsole = (consoleId, title) => {
        const currentlyAllowed = isConsoleAllowed(consoleId, selectedRole);
        toggleConsolePermission(consoleId, selectedRole);
        showToast?.(
            currentlyAllowed ? 'Console Locked' : 'Console Unlocked',translateText("components.Dashboard.Modals.AccessControlModal","text_e99dd8509b", {value1: String(consoleId), value2: String(title), value3: String(currentlyAllowed ? 'hidden from' : 'available to'), value4: String(currentRoleObj.label)}),
            currentlyAllowed ? 'warning' : 'success'
        );
    };

    const handleResetAll = () => {
        if (confirm('Reset all module and console permissions back to enterprise defaults?')) {
            resetPermissionsToDefault();
            showToast?.(translateText("components.Dashboard.Modals.AccessControlModal","text_e386bd4401"),translateText("components.Dashboard.Modals.AccessControlModal","text_d962d31822"), 'info');
        }
    };

    const handleTestPersona = () => {
        switchRole(selectedRole);
        onClose();
        showToast?.(translateText("components.Dashboard.Modals.AccessControlModal","text_042dad0b3c"),translateText("components.Dashboard.Modals.AccessControlModal","text_e99547ec5a", {value1: String(currentRoleObj.name), value2: String(currentRoleObj.label)}), 'info');
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <div className={styles.headerIconSquircle}>
                            <ShieldCheck size={22} />
                        </div>
                        <div>
                            <h2 className={styles.headerTitle}>{readData("components.Dashboard.Modals.AccessControlModal", "content_text_26")}</h2>
                            <div className={styles.headerSubtitle}>{readData("components.Dashboard.Modals.AccessControlModal", "content_text_27")}</div>
                        </div>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose} title={readData("components.Dashboard.Modals.AccessControlModal", "content_title_28")}>
                        <X size={18} />
                    </button>
                </div>

                {/* Role Selector Strip */}
                <div className={styles.roleSelectorStrip}>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', marginRight: '0.25rem' }}>{readData("components.Dashboard.Modals.AccessControlModal", "content_text_29")}</span>
                    {ROLES_LIST.map(r => {
                        const Icon = r.icon;
                        const isSelected = selectedRole === r.key;
                        return (
                            <button
                                key={r.key}
                                className={`${styles.roleBtn} ${isSelected ? styles.roleBtnActive : ''}`}
                                onClick={() => setSelectedRole(r.key)}
                            >
                                <Icon size={14} />
                                <span>{r.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Segment Filter & Search */}
                <div className={styles.segmentRow}>
                    <div className={styles.segmentTabs}>
                        <button
                            className={`${styles.segmentTab} ${activeTab === 'modules' ? styles.segmentTabActive : ''}`}
                            onClick={() => setActiveTab('modules')}
                        >{readData("components.Dashboard.Modals.AccessControlModal", "content_text_30")}{MODULES_LIST.length}{readData("components.Dashboard.Modals.AccessControlModal", "content_text_31")}</button>
                        <button
                            className={`${styles.segmentTab} ${activeTab === 'consoles' ? styles.segmentTabActive : ''}`}
                            onClick={() => setActiveTab('consoles')}
                        >{readData("components.Dashboard.Modals.AccessControlModal", "content_text_32")}{CONSOLES_LIST.length}{readData("components.Dashboard.Modals.AccessControlModal", "content_text_33")}</button>
                    </div>
                    <div className={styles.searchBox}>
                        <Search size={14} color="#64748B" />
                        <input
                            type="text"
                            placeholder={readData("components.Dashboard.Modals.AccessControlModal", "content_placeholder_34")}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className={styles.searchInput}
                        />
                    </div>
                </div>

                {/* Body Matrix List */}
                <div className={styles.bodyList}>
                    {activeTab === 'modules' ? (
                        filteredModules.map(m => {
                            const Icon = m.icon;
                            const isAllowed = isModuleAllowed(m.key, selectedRole);
                            return (
                                <div key={m.key} className={styles.matrixItem}>
                                    <div className={styles.itemLeft}>
                                        <div className={styles.itemIcon} style={{ color: isAllowed ? '#2DD4A8' : '#64748B' }}>
                                            <Icon size={18} />
                                        </div>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <span className={styles.itemTitle}>{m.title}</span>
                                                <span className={styles.itemTag}>{m.tag}</span>
                                            </div>
                                            <div className={styles.itemDesc}>{m.desc}</div>
                                        </div>
                                    </div>

                                    <div
                                        className={styles.toggleSwitch}
                                        onClick={() => handleToggleModule(m.key, m.title)}
                                        title={translateText("components.Dashboard.Modals.AccessControlModal","text_eb895f2be5", {value1: String(isAllowed ? readData("components.Dashboard.Modals.AccessControlModal", "display_2") : readData("components.Dashboard.Modals.AccessControlModal", "display_3")), value2: String(currentRoleObj.label)})}
                                    >
                                        <span className={`${styles.statusLabel} ${isAllowed ? styles.statusAllowed : styles.statusBlocked}`}>
                                            {isAllowed ? readData("components.Dashboard.Modals.AccessControlModal", "display_4") : readData("components.Dashboard.Modals.AccessControlModal", "display_5")}
                                        </span>
                                        <div className={`${styles.switchTrack} ${isAllowed ? styles.switchTrackActive : ''}`}>
                                            <div className={`${styles.switchThumb} ${isAllowed ? styles.switchThumbActive : ''}`} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        filteredConsoles.map(c => {
                            const isAllowed = isConsoleAllowed(c.id, selectedRole);
                            return (
                                <div key={c.id} className={styles.matrixItem}>
                                    <div className={styles.itemLeft}>
                                        <div className={styles.itemIcon} style={{
                                            fontWeight: 800,
                                            fontSize: '0.85rem',
                                            color: isAllowed ? '#4FB6F5' : '#64748B',
                                            background: isAllowed ? 'rgba(79, 182, 245, 0.12)' : 'rgba(255, 255, 255, 0.05)'
                                        }}>
                                            {c.id}
                                        </div>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <span className={styles.itemTitle}>{c.title}</span>
                                                <span className={styles.itemTag} style={{ color: '#4FB6F5' }}>{c.persona}</span>
                                            </div>
                                            <div className={styles.itemDesc}>{c.desc}</div>
                                        </div>
                                    </div>

                                    <div
                                        className={styles.toggleSwitch}
                                        onClick={() => handleToggleConsole(c.id, c.title)}
                                        title={translateText("components.Dashboard.Modals.AccessControlModal","text_c9a76049ab", {value1: String(isAllowed ? readData("components.Dashboard.Modals.AccessControlModal", "display_6") : readData("components.Dashboard.Modals.AccessControlModal", "display_7")), value2: String(currentRoleObj.label)})}
                                    >
                                        <span className={`${styles.statusLabel} ${isAllowed ? styles.statusAllowed : styles.statusBlocked}`}>
                                            {isAllowed ? readData("components.Dashboard.Modals.AccessControlModal", "display_8") : readData("components.Dashboard.Modals.AccessControlModal", "display_9")}
                                        </span>
                                        <div className={`${styles.switchTrack} ${isAllowed ? styles.switchTrackActive : ''}`}>
                                            <div className={`${styles.switchThumb} ${isAllowed ? styles.switchThumbActive : ''}`} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer Controls */}
                <div className={styles.footer}>
                    <div className={styles.footerLeft}>
                        <button className={styles.btnSecondary} onClick={handleResetAll}>
                            <RefreshCw size={13} style={{ marginRight: '0.35rem', verticalAlign: 'middle' }} />{readData("components.Dashboard.Modals.AccessControlModal", "content_text_35")}</button>
                    </div>
                    <div className={styles.footerRight}>
                        <button className={styles.btnSecondary} onClick={handleTestPersona} title={readData("components.Dashboard.Modals.AccessControlModal", "content_title_36")}>
                            <ExternalLink size={13} style={{ marginRight: '0.35rem', verticalAlign: 'middle' }} />{readData("components.Dashboard.Modals.AccessControlModal", "content_text_37")}{currentRoleObj.label}
                        </button>
                        <button className={styles.btnPrimary} onClick={onClose}>{readData("components.Dashboard.Modals.AccessControlModal", "content_text_38")}</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
