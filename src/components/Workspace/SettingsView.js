"use client";
import {useTranslation} from '@/context/I18nContext';

import { readData } from '../../services/workspace-data.mjs';

import React, { useState, useEffect } from 'react';
import {
    User, Bell, Shield, Lock, Globe, Building2,
    Key, CheckCircle2, Save, RotateCcw, Laptop,
    ShieldCheck, Sparkles, Smartphone, Eye,
    Users, CreditCard, Briefcase, List, Search
} from 'lucide-react';
import styles from './SettingsView.module.css';
import { useHRMS } from '@/context/HRMSContext';
import { useAuth } from '@/context/AuthContext';
import { launchAction } from '@/lib/action-launcher';
import { getAllPicklists, searchPicklists } from '@/lib/picklist-catalog';

const SettingsView = ({ onNavigate, onSelectConsole }) => {
    const {t: translateText}=useTranslation();

    const { showToast } = useHRMS();
    const { user: authUser, openAccessControl, modulePermissions, consolePermissions, switchRole } = useAuth();
    const userRole = authUser?.role || readData("components.Workspace.SettingsView", "fallback_1");
    const [activeTab, setActiveTab] = useState(readData("components.Workspace.SettingsView", "initialState_1"));
    const [picklistSearch, setPicklistSearch] = useState('');
    const [settingPrefs, setSettingPrefs] = useState({
        emailNotif: true,
        pushNotif: true,
        anomalyAlerts: true,
        multiCurrency: 'INR (₹)'
    });

    React.useEffect(() => {
        fetch('/api/v1/tenant/settings')
            .then(res => res.json())
            .then(data => {
                if (data?.data?.settings) {
                    setSettingPrefs(prev => ({ ...prev, ...data.data.settings }));
                }
            })
            .catch(() => {});
    }, []);

    const updateSettingPref = async (key, val) => {
        setSettingPrefs(prev => ({ ...prev, [key]: val }));
        try {
            const res = await fetch('/api/v1/tenant/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    settings: { [key]: val }
                })
            });
            if (!res.ok) throw new Error('Failed to update setting');
            showToast("Settings Saved", "Notification preference updated in database.", "success");
        } catch (err) {
            setSettingPrefs(prev => ({ ...prev, [key]: !val }));
            showToast("Update Failed", err.message || "Failed to update preference", "error");
        }
    };

    // Local form states
    const [formData, setFormData] = useState({
        name: authUser?.name || readData("components.Workspace.SettingsView", "fallback_2"),
        email: authUser?.email || readData("components.Workspace.SettingsView", "fallback_3"),
        ...readData("components.Workspace.SettingsView", "formData_fields_1"),
        jobTitle: authUser?.role || readData("components.Workspace.SettingsView", "fallback_4"),
        ...readData("components.Workspace.SettingsView", "formData_fields_2"),
        currency: readData("components.Workspace.SettingsView", "fallback_5"),
        ...readData("components.Workspace.SettingsView", "formData_fields_3")
    });

    const [profilePhoto, setProfilePhoto] = useState(authUser?.image || authUser?.avatar || authUser?.photo || null);

    useEffect(() => {
        const handlePhotoUpdated = (e) => {
            if (e.detail?.photoUrl) {
                setProfilePhoto(e.detail.photoUrl);
            }
        };
        window.addEventListener('nucleus:profile-updated', handlePhotoUpdated);
        return () => window.removeEventListener('nucleus:profile-updated', handlePhotoUpdated);
    }, []);

    const handleFieldChange = (key, val) => {
        setFormData(prev => ({ ...prev, [key]: val }));
    };

    const handleSave = () => launchAction('settings', formData);

    const handleReset = () => {
        showToast(translateText("components.Workspace.SettingsView","text_03673c17ae"),translateText("components.Workspace.SettingsView","text_ce3e59d613"), 'info');
    };

    return (
        <div className={styles.settingsContainer}>
            {/* Header with Title & Action Controls */}
            <div className={styles.headerRow}>
                <div className={styles.titleBlock}>
                    <h2>{readData("components.Workspace.SettingsView", "SettingsView_text_4")}</h2>
                    <p>{readData("components.Workspace.SettingsView", "SettingsView_text_5")}</p>
                </div>
                <div className={styles.headerActions}>
                    {userRole === 'SUPER_ADMIN' && (onNavigate || onSelectConsole) && (
                        <button
                            className={styles.btnSecondary}
                            onClick={() => {
                                if (onSelectConsole) onSelectConsole('S10');
                                if (onNavigate) onNavigate('dashboard', 'dashboard', 's10');
                            }}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                border: '1px solid rgba(155, 140, 255, 0.4)',
                                background: 'rgba(155, 140, 255, 0.12)',
                                color: '#9B8CFF',
                                fontWeight: 700
                            }}
                            title={readData("components.Workspace.SettingsView", "SettingsView_title_6")}
                        >
                            <ShieldCheck size={15} />{readData("components.Workspace.SettingsView", "SettingsView_text_7")}</button>
                    )}
                    <button className={styles.btnSecondary} onClick={handleReset}>
                        <RotateCcw size={16} />{readData("components.Workspace.SettingsView", "SettingsView_text_8")}</button>
                    <button className={styles.btnPrimary} onClick={handleSave}>
                        <Save size={16} />{readData("components.Workspace.SettingsView", "SettingsView_text_9")}</button>
                </div>
            </div>

            {/* Sub-Navigation Tabs */}
            <div className={styles.tabsNav}>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'profile' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('profile')}
                >
                    <User size={16} />{readData("components.Workspace.SettingsView", "SettingsView_text_10")}</button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'security' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('security')}
                >
                    <Shield size={16} />{readData("components.Workspace.SettingsView", "SettingsView_text_11")}</button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'notifications' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('notifications')}
                >
                    <Bell size={16} />{readData("components.Workspace.SettingsView", "SettingsView_text_12")}</button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'tenant' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('tenant')}
                >
                    <Building2 size={16} />{readData("components.Workspace.SettingsView", "SettingsView_text_13")}</button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'audit' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('audit')}
                >
                    <Key size={16} />{readData("components.Workspace.SettingsView", "SettingsView_text_14")}</button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'permissions' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('permissions')}
                >
                    <ShieldCheck size={16} />{readData("components.Workspace.SettingsView", "SettingsView_text_15")}</button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'picklists' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('picklists')}
                >
                    <List size={16} />Picklists Catalog</button>
            </div>

            {/* TAB 1: PROFILE & PERSONAL */}
            {activeTab === 'profile' && (
                <div className={styles.sectionCard}>
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionIcon}><User size={20} color="var(--info)" /></div>
                        <div>
                            <h3>{readData("components.Workspace.SettingsView", "SettingsView_text_16")}</h3>
                            <p>{readData("components.Workspace.SettingsView", "SettingsView_text_17")}</p>
                        </div>
                    </div>

                    {/* Avatar Strip */}
                    <div className={styles.avatarStrip}>
                        <div className={styles.avatarCircle}>
                            {profilePhoto ? (
                                <img src={profilePhoto} alt={formData.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                                formData.name.split(' ').map(n => n[0]).join('')
                            )}
                        </div>
                        <div className={styles.avatarMeta}>
                            <h4>{formData.name}</h4>
                            <p>{formData.email}{readData("components.Workspace.SettingsView", "SettingsView_text_18")}{formData.dept}</p>
                            <span className={styles.roleBadge}>{authUser?.role || readData("components.Workspace.SettingsView", "fallback_6")}</span>
                        </div>
                        <div style={{ marginLeft: 'auto' }}>
                            <button
                                className={styles.btnSecondary}
                                style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
                                onClick={() => launchAction('photo')}
                            >{readData("components.Workspace.SettingsView", "SettingsView_text_19")}</button>
                        </div>
                    </div>

                    {/* 2-Column Form Grid */}
                    <div className={styles.formGrid}>
                        <div className={styles.fieldBlock}>
                            <label className={styles.label}>{readData("components.Workspace.SettingsView", "SettingsView_text_20")}</label>
                            <input
                                type="text"
                                className={styles.input}
                                value={formData.name}
                                onChange={(e) => handleFieldChange('name', e.target.value)}
                            />
                        </div>
                        <div className={styles.fieldBlock}>
                            <label className={styles.label}>{readData("components.Workspace.SettingsView", "SettingsView_text_21")}</label>
                            <input
                                type="email"
                                className={styles.input}
                                value={formData.email}
                                onChange={(e) => handleFieldChange('email', e.target.value)}
                            />
                        </div>
                        <div className={styles.fieldBlock}>
                            <label className={styles.label}>{readData("components.Workspace.SettingsView", "SettingsView_text_22")}</label>
                            <input
                                type="text"
                                className={styles.input}
                                value={formData.phone}
                                onChange={(e) => handleFieldChange('phone', e.target.value)}
                            />
                        </div>
                        <div className={styles.fieldBlock}>
                            <label className={styles.label}>{readData("components.Workspace.SettingsView", "SettingsView_text_23")}</label>
                            <input
                                type="text"
                                className={styles.input}
                                value={formData.jobTitle}
                                onChange={(e) => handleFieldChange('jobTitle', e.target.value)}
                            />
                        </div>
                        <div className={styles.fieldBlock}>
                            <label className={styles.label}>{readData("components.Workspace.SettingsView", "SettingsView_text_24")}</label>
                            <input
                                type="text"
                                className={styles.input}
                                value={formData.dept}
                                onChange={(e) => handleFieldChange('dept', e.target.value)}
                            />
                        </div>
                        <div className={styles.fieldBlock}>
                            <label className={styles.label}>{readData("components.Workspace.SettingsView", "SettingsView_text_25")}</label>
                            <input
                                type="text"
                                className={styles.input}
                                value={formData.location}
                                onChange={(e) => handleFieldChange('location', e.target.value)}
                            />
                        </div>
                        <div className={styles.fieldBlock}>
                            <label className={styles.label}>{readData("components.Workspace.SettingsView", "SettingsView_text_26")}</label>
                            <select
                                className={styles.select}
                                value={formData.timezone}
                                onChange={(e) => handleFieldChange('timezone', e.target.value)}
                            >
                                <option value="Asia/Kolkata (IST +5:30)">{readData("components.Workspace.SettingsView", "SettingsView_text_27")}</option>
                                <option value="Europe/London (GMT +0:00)">{readData("components.Workspace.SettingsView", "SettingsView_text_28")}</option>
                                <option value="Asia/Dubai (GST +4:00)">{readData("components.Workspace.SettingsView", "SettingsView_text_29")}</option>
                                <option value="Asia/Singapore (SGT +8:00)">{readData("components.Workspace.SettingsView", "SettingsView_text_30")}</option>
                                <option value="America/New_York (EST -5:00)">{readData("components.Workspace.SettingsView", "SettingsView_text_31")}</option>
                            </select>
                        </div>
                        <div className={styles.fieldBlock}>
                            <label className={styles.label}>{readData("components.Workspace.SettingsView", "SettingsView_text_32")}</label>
                            <select
                                className={styles.select}
                                value={formData.language}
                                onChange={(e) => handleFieldChange('language', e.target.value)}
                            >
                                <option value="English (US / Global)">{readData("components.Workspace.SettingsView", "SettingsView_text_33")}</option>
                                <option value="English (UK)">{readData("components.Workspace.SettingsView", "SettingsView_text_34")}</option>
                                <option value="Hindi (हिन्दी)">{readData("components.Workspace.SettingsView", "SettingsView_text_35")}</option>
                                <option value="Arabic (العربية)">{readData("components.Workspace.SettingsView", "SettingsView_text_36")}</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: SECURITY & 2FA */}
            {activeTab === 'security' && (
                <div className={styles.sectionCard}>
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionIcon} style={{ background: 'var(--flag-wash)' }}><Shield size={20} color="var(--flag)" /></div>
                        <div>
                            <h3>{readData("components.Workspace.SettingsView", "SettingsView_text_37")}</h3>
                            <p>{readData("components.Workspace.SettingsView", "SettingsView_text_38")}</p>
                        </div>
                    </div>

                    <div className={styles.toggleList}>
                        <div className={styles.toggleRow}>
                            <div className={styles.toggleLabel}>
                                <h4><Smartphone size={18} color="var(--info)" />{readData("components.Workspace.SettingsView", "SettingsView_text_39")}</h4>
                                <p>{readData("components.Workspace.SettingsView", "SettingsView_text_40")}</p>
                            </div>
                            <div
                                className={`${styles.toggleSwitch} ${settings.twoFactor ? styles.toggleActive : ''}`}
                                onClick={() => launchAction('twoFactor')}
                            >
                                <div className={`${styles.switchKnob} ${settings.twoFactor ? styles.thumbActive : ''}`}></div>
                            </div>
                        </div>

                        <div className={styles.toggleRow}>
                            <div className={styles.toggleLabel}>
                                <h4><ShieldCheck size={18} color="var(--signal)" />{readData("components.Workspace.SettingsView", "SettingsView_text_41")}</h4>
                                <p>{readData("components.Workspace.SettingsView", "SettingsView_text_42")}</p>
                            </div>
                            <div className={`${styles.toggleSwitch} ${styles.toggleActive}`}>
                                <div className={`${styles.switchKnob} ${styles.thumbActive}`}></div>
                            </div>
                        </div>

                        <div className={styles.toggleRow}>
                            <div className={styles.toggleLabel}>
                                <h4><Lock size={18} color="var(--pending)" />{readData("components.Workspace.SettingsView", "SettingsView_text_43")}</h4>
                                <p>{readData("components.Workspace.SettingsView", "SettingsView_text_44")}</p>
                            </div>
                            <select
                                className={styles.select}
                                style={{ width: '160px' }}
                                value={formData.sessionTimeout}
                                onChange={(e) => handleFieldChange('sessionTimeout', e.target.value)}
                            >
                                <option value="15 Minutes">{readData("components.Workspace.SettingsView", "SettingsView_text_45")}</option>
                                <option value="30 Minutes">{readData("components.Workspace.SettingsView", "SettingsView_text_46")}</option>
                                <option value="1 Hour">{readData("components.Workspace.SettingsView", "SettingsView_text_47")}</option>
                                <option value="4 Hours">{readData("components.Workspace.SettingsView", "SettingsView_text_48")}</option>
                            </select>
                        </div>
                    </div>

                    {/* Password Reset Box */}
                    <div style={{ background: 'var(--card-2)', borderRadius: 'var(--r-card, 12px)', padding: '1.5rem', border: '1px solid var(--line)', marginTop: '0.5rem' }}>
                        <h4 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: '700', color: 'var(--text)' }}>{readData("components.Workspace.SettingsView", "SettingsView_text_49")}</h4>
                        <div className={styles.formGrid}>
                            <div className={styles.fieldBlock}>
                                <label className={styles.label}>{readData("components.Workspace.SettingsView", "SettingsView_text_50")}</label>
                                <input type="password" placeholder={readData("components.Workspace.SettingsView", "SettingsView_placeholder_51")} className={styles.input} />
                            </div>
                            <div className={styles.fieldBlock}>
                                <label className={styles.label}>{readData("components.Workspace.SettingsView", "SettingsView_text_52")}</label>
                                <input type="password" placeholder={readData("components.Workspace.SettingsView", "SettingsView_placeholder_53")} className={styles.input} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                            <button
                                className={styles.btnSecondary}
                                style={{ fontSize: '0.82rem' }}
                                onClick={() => launchAction('password')}
                            >{readData("components.Workspace.SettingsView", "SettingsView_text_54")}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: NOTIFICATIONS & ALERTS */}
            {activeTab === 'notifications' && (
                <div className={styles.sectionCard}>
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionIcon} style={{ background: 'var(--pending-wash)' }}><Bell size={20} color="var(--pending)" /></div>
                        <div>
                            <h3>{readData("components.Workspace.SettingsView", "SettingsView_text_55")}</h3>
                            <p>{readData("components.Workspace.SettingsView", "SettingsView_text_56")}</p>
                        </div>
                    </div>

                    <div className={styles.toggleList}>
                        <div className={styles.toggleRow}>
                            <div className={styles.toggleLabel}>
                                <h4>{readData("components.Workspace.SettingsView", "SettingsView_text_57")}</h4>
                                <p>{readData("components.Workspace.SettingsView", "SettingsView_text_58")}</p>
                            </div>
                            <div
                                className={`${styles.toggleSwitch} ${settingPrefs.emailNotif ? styles.toggleActive : ''}`}
                                onClick={() => updateSettingPref('emailNotif', !settingPrefs.emailNotif)}
                            >
                                <div className={`${styles.switchKnob} ${settingPrefs.emailNotif ? styles.thumbActive : ''}`}></div>
                            </div>
                        </div>

                        <div className={styles.toggleRow}>
                            <div className={styles.toggleLabel}>
                                <h4>{readData("components.Workspace.SettingsView", "SettingsView_text_59")}</h4>
                                <p>{readData("components.Workspace.SettingsView", "SettingsView_text_60")}</p>
                            </div>
                            <div
                                className={`${styles.toggleSwitch} ${settingPrefs.pushNotif ? styles.toggleActive : ''}`}
                                onClick={() => updateSettingPref('pushNotif', !settingPrefs.pushNotif)}
                            >
                                <div className={`${styles.switchKnob} ${settingPrefs.pushNotif ? styles.thumbActive : ''}`}></div>
                            </div>
                        </div>

                        <div className={styles.toggleRow}>
                            <div className={styles.toggleLabel}>
                                <h4>{readData("components.Workspace.SettingsView", "SettingsView_text_61")}</h4>
                                <p>{readData("components.Workspace.SettingsView", "SettingsView_text_62")}</p>
                            </div>
                            <div
                                className={`${styles.toggleSwitch} ${settingPrefs.anomalyAlerts ? styles.toggleActive : ''}`}
                                onClick={() => updateSettingPref('anomalyAlerts', !settingPrefs.anomalyAlerts)}
                            >
                                <div className={`${styles.switchKnob} ${settingPrefs.anomalyAlerts ? styles.thumbActive : ''}`}></div>
                            </div>
                        </div>

                        <div className={styles.toggleRow}>
                            <div className={styles.toggleLabel}>
                                <h4>{readData("components.Workspace.SettingsView", "SettingsView_text_63")}</h4>
                                <p>{readData("components.Workspace.SettingsView", "SettingsView_text_64")}</p>
                            </div>
                            <div className={`${styles.toggleSwitch} ${styles.toggleActive}`}>
                                <div className={`${styles.switchKnob} ${styles.thumbActive}`}></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: TENANT & LOCALIZATION */}
            {activeTab === 'tenant' && (
                <div className={styles.sectionCard}>
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionIcon} style={{ background: 'var(--agent-wash)' }}><Building2 size={20} color="var(--agent)" /></div>
                        <div>
                            <h3>{readData("components.Workspace.SettingsView", "SettingsView_text_65")}</h3>
                            <p>{readData("components.Workspace.SettingsView", "SettingsView_text_66")}</p>
                        </div>
                    </div>

                    <div className={styles.formGrid}>
                        <div className={styles.fieldBlock}>
                            <label className={styles.label}>{readData("components.Workspace.SettingsView", "SettingsView_text_67")}</label>
                            <input
                                type="text"
                                className={styles.input}
                                value={formData.companyName}
                                onChange={(e) => handleFieldChange('companyName', e.target.value)}
                            />
                            <span className={styles.helperText}>{readData("components.Workspace.SettingsView", "SettingsView_text_68")}</span>
                        </div>

                        <div className={styles.fieldBlock}>
                            <label className={styles.label}>{readData("components.Workspace.SettingsView", "SettingsView_text_69")}</label>
                            <select
                                className={styles.select}
                                value={formData.currency}
                                onChange={(e) => {
                                    handleFieldChange('currency', e.target.value);
                                    updateSettingPref('multiCurrency', e.target.value);
                                }}
                            >
                                <option value="INR (₹)">{readData("components.Workspace.SettingsView", "SettingsView_text_70")}</option>
                                <option value="USD ($)">{readData("components.Workspace.SettingsView", "SettingsView_text_71")}</option>
                                <option value="EUR (€)">{readData("components.Workspace.SettingsView", "SettingsView_text_72")}</option>
                                <option value="AED (د.إ)">{readData("components.Workspace.SettingsView", "SettingsView_text_73")}</option>
                                <option value="GBP (£)">{readData("components.Workspace.SettingsView", "SettingsView_text_74")}</option>
                                <option value="SGD ($)">{readData("components.Workspace.SettingsView", "SettingsView_text_75")}</option>
                            </select>
                            <span className={styles.helperText}>{readData("components.Workspace.SettingsView", "SettingsView_text_76")}</span>
                        </div>

                        <div className={styles.fieldBlock}>
                            <label className={styles.label}>{readData("components.Workspace.SettingsView", "SettingsView_text_77")}</label>
                            <input
                                type="text"
                                className={styles.input}
                                value="AWS ap-south-1 (Mumbai, India) - DPDP Act 2023 Compliant"
                                disabled
                            />
                        </div>

                        <div className={styles.fieldBlock}>
                            <label className={styles.label}>{readData("components.Workspace.SettingsView", "SettingsView_text_78")}</label>
                            <select className={styles.select} defaultValue="5_days">
                                <option value="5_days">{readData("components.Workspace.SettingsView", "SettingsView_text_79")}</option>
                                <option value="6_days">{readData("components.Workspace.SettingsView", "SettingsView_text_80")}</option>
                                <option value="uae_week">{readData("components.Workspace.SettingsView", "SettingsView_text_81")}</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 5: AUDIT TRAIL & SESSIONS */}
            {activeTab === 'audit' && (
                <div className={styles.sectionCard}>
                    <div className={styles.sectionHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div className={styles.sectionIcon} style={{ background: 'var(--signal-wash)' }}><Key size={20} color="var(--signal)" /></div>
                            <div>
                                <h3>{readData("components.Workspace.SettingsView", "SettingsView_text_82")}</h3>
                                <p>{readData("components.Workspace.SettingsView", "SettingsView_text_83")}</p>
                            </div>
                        </div>
                        <button
                            className={styles.btnSecondary}
                            onClick={() => window.open('/api/v1/audit/export', '_blank')}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600, fontSize: '0.85rem' }}
                        >
                            Export Audit CSV
                        </button>
                    </div>

                    <div className={styles.tableWrapper}>
                        <table className={styles.auditTable}>
                            <thead>
                                <tr>
                                    <th>{readData("components.Workspace.SettingsView", "SettingsView_text_84")}</th>
                                    <th>{readData("components.Workspace.SettingsView", "SettingsView_text_85")}</th>
                                    <th>{readData("components.Workspace.SettingsView", "SettingsView_text_86")}</th>
                                    <th>{readData("components.Workspace.SettingsView", "SettingsView_text_87")}</th>
                                    <th>{readData("components.Workspace.SettingsView", "SettingsView_text_88")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><strong>{readData("components.Workspace.SettingsView", "SettingsView_text_89")}</strong></td>
                                    <td>{readData("components.Workspace.SettingsView", "SettingsView_text_90")}</td>
                                    <td>{readData("components.Workspace.SettingsView", "SettingsView_text_91")}</td>
                                    <td>{readData("components.Workspace.SettingsView", "SettingsView_text_92")}</td>
                                    <td><span className={styles.statusSuccess}><CheckCircle2 size={12} />{readData("components.Workspace.SettingsView", "SettingsView_text_93")}</span></td>
                                </tr>
                                <tr>
                                    <td><strong>{readData("components.Workspace.SettingsView", "SettingsView_text_94")}</strong></td>
                                    <td>{readData("components.Workspace.SettingsView", "SettingsView_text_95")}</td>
                                    <td>{readData("components.Workspace.SettingsView", "SettingsView_text_96")}</td>
                                    <td>{readData("components.Workspace.SettingsView", "SettingsView_text_97")}</td>
                                    <td><span className={styles.statusSuccess}><CheckCircle2 size={12} />{readData("components.Workspace.SettingsView", "SettingsView_text_98")}</span></td>
                                </tr>
                                <tr>
                                    <td><strong>{readData("components.Workspace.SettingsView", "SettingsView_text_99")}</strong></td>
                                    <td>{readData("components.Workspace.SettingsView", "SettingsView_text_100")}</td>
                                    <td>{readData("components.Workspace.SettingsView", "SettingsView_text_101")}</td>
                                    <td>{readData("components.Workspace.SettingsView", "SettingsView_text_102")}</td>
                                    <td><span className={styles.statusSuccess}><CheckCircle2 size={12} />{readData("components.Workspace.SettingsView", "SettingsView_text_103")}</span></td>
                                </tr>
                                <tr>
                                    <td><strong>{readData("components.Workspace.SettingsView", "SettingsView_text_104")}</strong></td>
                                    <td>{readData("components.Workspace.SettingsView", "SettingsView_text_105")}</td>
                                    <td>{readData("components.Workspace.SettingsView", "SettingsView_text_106")}</td>
                                    <td>{readData("components.Workspace.SettingsView", "SettingsView_text_107")}</td>
                                    <td><span className={styles.statusSuccess}><CheckCircle2 size={12} />{readData("components.Workspace.SettingsView", "SettingsView_text_108")}</span></td>
                                </tr>
                                <tr>
                                    <td><strong>{readData("components.Workspace.SettingsView", "SettingsView_text_109")}</strong></td>
                                    <td>{readData("components.Workspace.SettingsView", "SettingsView_text_110")}</td>
                                    <td>{readData("components.Workspace.SettingsView", "SettingsView_text_111")}</td>
                                    <td>{readData("components.Workspace.SettingsView", "SettingsView_text_112")}</td>
                                    <td><span className={styles.statusWarn}><Shield size={12} />{readData("components.Workspace.SettingsView", "SettingsView_text_113")}</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Active Device Sessions */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-2)', padding: '1.25rem', borderRadius: 'var(--r-card, 12px)', border: '1px solid var(--line)', marginTop: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Laptop size={22} color="var(--info)" />
                            <div>
                                <h4 style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text)' }}>{readData("components.Workspace.SettingsView", "SettingsView_text_114")}</h4>
                                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-2)' }}>{readData("components.Workspace.SettingsView", "SettingsView_text_115")}</p>
                            </div>
                        </div>
                        <button
                            className={styles.btnSecondary}
                            style={{ color: 'var(--flag)', borderColor: 'var(--flag)', fontSize: '0.82rem' }}
                            onClick={() => showToast(translateText("components.Workspace.SettingsView","text_21b2faaceb"),translateText("components.Workspace.SettingsView","text_3e0d5618e9"), 'info')}
                        >{readData("components.Workspace.SettingsView", "SettingsView_text_116")}</button>
                    </div>
                </div>
            )}

            {/* TAB 6: ACCESS CONTROL & ROLE-BASED ACCESS CONTROL (RBAC) */}
            {activeTab === 'permissions' && (
                <div className={styles.sectionCard}>
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionIcon}><ShieldCheck size={20} color="#2DD4A8" /></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <div>
                                <h3>{readData("components.Workspace.SettingsView", "SettingsView_text_117")}</h3>
                                <p>{readData("components.Workspace.SettingsView", "SettingsView_text_118")}</p>
                            </div>
                            <button
                                className={styles.btnPrimary}
                                onClick={() => onNavigate ? onNavigate('access_control') : openAccessControl()}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.45rem',
                                    background: '#2DD4A8',
                                    color: '#060D18',
                                    border: 'none',
                                    padding: '0.55rem 1.25rem',
                                    borderRadius: '8px',
                                    fontWeight: 700,
                                    fontSize: '0.82rem',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 14px rgba(45, 212, 168, 0.3)'
                                }}
                            >
                                <ShieldCheck size={16} />{readData("components.Workspace.SettingsView", "SettingsView_text_119")}</button>
                        </div>
                    </div>

                    {/* Quick Access Matrix Snapshot */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                        <div style={{ background: 'var(--card-2)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '1rem 1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Users size={16} color="#4FB6F5" />
                                    <strong style={{ fontSize: '0.88rem', color: 'var(--text)' }}>{readData("components.Workspace.SettingsView", "SettingsView_text_120")}</strong>
                                </div>
                                <span style={{ fontSize: '0.72rem', color: '#2DD4A8', fontWeight: 700 }}>
                                    {Object.values(modulePermissions).filter(roles => roles.includes('HR_MANAGER')).length}{readData("components.Workspace.SettingsView", "SettingsView_text_121")}</span>
                            </div>
                            <p style={{ fontSize: '0.76rem', color: 'var(--text-2)', margin: 0, lineHeight: 1.4 }}>{readData("components.Workspace.SettingsView", "SettingsView_text_122")}</p>
                        </div>

                        <div style={{ background: 'var(--card-2)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '1rem 1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <CreditCard size={16} color="#F2A93B" />
                                    <strong style={{ fontSize: '0.88rem', color: 'var(--text)' }}>{readData("components.Workspace.SettingsView", "SettingsView_text_123")}</strong>
                                </div>
                                <span style={{ fontSize: '0.72rem', color: '#2DD4A8', fontWeight: 700 }}>
                                    {Object.values(modulePermissions).filter(roles => roles.includes('FINANCE_MANAGER')).length}{readData("components.Workspace.SettingsView", "SettingsView_text_124")}</span>
                            </div>
                            <p style={{ fontSize: '0.76rem', color: 'var(--text-2)', margin: 0, lineHeight: 1.4 }}>{readData("components.Workspace.SettingsView", "SettingsView_text_125")}</p>
                        </div>

                        <div style={{ background: 'var(--card-2)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '1rem 1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Briefcase size={16} color="#9B8CFF" />
                                    <strong style={{ fontSize: '0.88rem', color: 'var(--text)' }}>{readData("components.Workspace.SettingsView", "SettingsView_text_126")}</strong>
                                </div>
                                <span style={{ fontSize: '0.72rem', color: '#2DD4A8', fontWeight: 700 }}>
                                    {Object.values(modulePermissions).filter(roles => roles.includes('TEAM_LEAD')).length}{readData("components.Workspace.SettingsView", "SettingsView_text_127")}</span>
                            </div>
                            <p style={{ fontSize: '0.76rem', color: 'var(--text-2)', margin: 0, lineHeight: 1.4 }}>{readData("components.Workspace.SettingsView", "SettingsView_text_128")}</p>
                        </div>

                        <div style={{ background: 'var(--card-2)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '1rem 1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <User size={16} color="#CBD5E1" />
                                    <strong style={{ fontSize: '0.88rem', color: 'var(--text)' }}>{readData("components.Workspace.SettingsView", "SettingsView_text_129")}</strong>
                                </div>
                                <span style={{ fontSize: '0.72rem', color: '#2DD4A8', fontWeight: 700 }}>
                                    {Object.values(modulePermissions).filter(roles => roles.includes('EMPLOYEE')).length}{readData("components.Workspace.SettingsView", "SettingsView_text_130")}</span>
                            </div>
                            <p style={{ fontSize: '0.76rem', color: 'var(--text-2)', margin: 0, lineHeight: 1.4 }}>{readData("components.Workspace.SettingsView", "SettingsView_text_131")}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 7: PICKLISTS & MASTER LOOKUP CATALOG */}
            {activeTab === 'picklists' && (
                <div className={styles.sectionCard}>
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionIcon} style={{ background: 'rgba(45, 212, 168, 0.12)' }}><List size={20} color="#2DD4A8" /></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '1rem', flexWrap: 'wrap' }}>
                            <div>
                                <h3 style={{ margin: 0 }}>System & Config Picklists Catalog</h3>
                                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-2)' }}>Standardized master dropdown catalogs, statutory classifications, and lookup value sets across all 11 HRMS modules (118 Seeded Picklists).</p>
                            </div>
                            <div style={{ position: 'relative', width: '280px' }}>
                                <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-2)' }} />
                                <input
                                    type="text"
                                    placeholder="Search picklist code, name, value..."
                                    className={styles.input}
                                    style={{ paddingLeft: '2.1rem', height: '36px', fontSize: '0.8rem' }}
                                    value={picklistSearch}
                                    onChange={(e) => setPicklistSearch(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className={styles.tableWrapper} style={{ marginTop: '1rem', maxHeight: '520px', overflowY: 'auto' }}>
                        <table className={styles.auditTable}>
                            <thead>
                                <tr>
                                    <th>Picklist Code</th>
                                    <th>Name</th>
                                    <th>Seeded By</th>
                                    <th>Values Count</th>
                                    <th>Value Set Preview</th>
                                </tr>
                            </thead>
                            <tbody>
                                {searchPicklists(picklistSearch).map((pl) => (
                                    <tr key={pl.code}>
                                        <td><code style={{ background: 'var(--card-2)', padding: '2px 6px', borderRadius: '4px', color: '#4FB6F5', fontSize: '0.8rem', fontWeight: 600 }}>{pl.code}</code></td>
                                        <td><strong style={{ fontSize: '0.85rem' }}>{pl.name}</strong></td>
                                        <td>
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '2px 8px',
                                                borderRadius: '12px',
                                                fontSize: '0.72rem',
                                                fontWeight: 700,
                                                background: pl.seededBy === 'System' ? 'rgba(79, 182, 245, 0.15)' : 'rgba(155, 140, 255, 0.15)',
                                                color: pl.seededBy === 'System' ? '#4FB6F5' : '#9B8CFF',
                                                border: pl.seededBy === 'System' ? '1px solid rgba(79, 182, 245, 0.3)' : '1px solid rgba(155, 140, 255, 0.3)'
                                            }}>
                                                {pl.seededBy}
                                            </span>
                                        </td>
                                        <td><strong style={{ fontSize: '0.85rem' }}>{pl.values.length}</strong></td>
                                        <td>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '480px' }}>
                                                {pl.values.slice(0, 5).map((val, idx) => (
                                                    <span key={idx} style={{ background: 'var(--card-2)', border: '1px solid var(--line)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', color: 'var(--text-2)' }}>
                                                        {val}
                                                    </span>
                                                ))}
                                                {pl.values.length > 5 && (
                                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-2)', alignSelf: 'center', fontWeight: 600 }}>
                                                        +{pl.values.length - 5} more
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsView;

