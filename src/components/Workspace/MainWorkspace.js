"use client";
import {useTranslation} from '@/context/I18nContext';

import NextImage from 'next/image';

import { readData } from '../../services/workspace-data.mjs';

import React, { useState, useEffect } from 'react';
import {
    MoreHorizontal, Clock, Calendar, CheckCircle, AlertCircle, DollarSign,
    Users, TrendingUp, Sun, Cloud, Mic, Sparkles, MapPin, Play, Bell,
    ChevronRight, Megaphone, FileText, Target, Plus, Briefcase, CreditCard,
    Layers, Filter, ChevronDown, ShieldCheck, Building2, RotateCcw, X, CalendarDays
} from 'lucide-react';
import shared from '../Dashboard/DashboardShared.module.css';
import styles from './MainWorkspace.module.css';
import AttendanceView from './AttendanceView';
import LeaveView from './LeaveView';
import PerformanceView from './PerformanceView';
import PayrollView from './PayrollView';
import ProjectView from './ProjectView';
import TeamView from './TeamView';
import SettingsView from './SettingsView';
import PeopleCoreView from './PeopleCoreView';
import RecruitmentView from './RecruitmentView';
import OnboardingView from './OnboardingView';
import AnalyticsView from './AnalyticsView';
import LearningView from './LearningView';
import CompensationView from './CompensationView';
import ExperienceView from './ExperienceView';
import IntegrationsView from './IntegrationsView';
import ComplianceView from './ComplianceView';
import HelpdeskView from './HelpdeskView';
import ContractWorkforceView from './ContractWorkforceView';
import CatalogGridView from './CatalogGridView';
import OrgChartView from './OrgChartView';
import CMSModal from './CMSModal';
import NucleusActionModal from './ActionFormModal';
import OperationalModuleView from './OperationalModuleView';
import AccessControlModal from '../Dashboard/Modals/AccessControlModal';
import AccessControlView from './AccessControlView';
import AdminOverview from './AdminOverview';
import PersonalDashboard from '../Dashboard/Personalization/PersonalDashboard';
import PeopleCommandCentre from '../Dashboard/Views/PeopleCommandCentre';
import HROpsConsole from '../Dashboard/Views/HROpsConsole';
import AttendanceIntelligence from '../Dashboard/Views/AttendanceIntelligence';
import TalentAcquisition from '../Dashboard/Views/TalentAcquisition';
import PayrollControlRoom from '../Dashboard/Views/PayrollControlRoom';
import PerformanceTalent from '../Dashboard/Views/PerformanceTalent';
import ManagerCockpit from '../Dashboard/Views/ManagerCockpit';
import EmployeeHome from '../Dashboard/Views/EmployeeHome';
import MagnetixCapability from '../Dashboard/Views/MagnetixCapability';
import NucleusIntelligence from '../Dashboard/Views/NucleusIntelligence';
import { NucleusAiPage } from './NucleusAiPage';
import { useHRMS } from '@/context/HRMSContext';
import { useAuth } from '@/context/AuthContext';
import RoleProtected from '../auth/RoleProtected';
import { ROLES } from '@/utils/permissions';
import { getOperationalModule } from '@/lib/operational-module-registry';

const ROLE_FALLBACKS = readData("components.Workspace.MainWorkspace", "ROLE_FALLBACKS_1");

const ROLE_PERMITTED_CONSOLES = readData("components.Workspace.MainWorkspace", "ROLE_PERMITTED_CONSOLES_2");

const MainWorkspace = ({
    activeTab,
    activeSubFeature,
    onTabChange,
    showCatalog = false,
    onToggleCatalog,
    activeDomain,
    onSelectDomain,
    searchQuery = '',
    activeConsole = readData("components.Workspace.MainWorkspace", "defaultValue_1"),
    onSelectConsole
}) => {
    const {t: translateText}=useTranslation();

    const {
        user, attendance = { status: 'absent' }, punchIn = () => {}, punchOut = () => {},
        leaves = [], projects = [], focusTasks = [], completeFocusTask = () => {},
        announcements = [], showToast = () => {}
    } = useHRMS() || {};
    const {
        user: authUser,
        getPermittedConsoles,
        isAccessControlOpen,
        closeAccessControl,
        openAccessControl
    } = useAuth();
    const currentRole = authUser?.role || ROLES.SUPER_ADMIN;
    const activeProfile = ROLE_FALLBACKS[currentRole] || ROLE_FALLBACKS.SUPER_ADMIN;
    const rawName = authUser?.name || user?.name || activeProfile.name;
    const effectiveName = rawName || activeProfile.name;
    const firstName = effectiveName.split(' ')[0];
    const avatarUrl = authUser?.avatar || activeProfile.avatar;
    const [isCMSModalOpen, setIsCMSModalOpen] = useState(false);
    const [actionRequest, setActionRequest] = useState(null);
    const operationalModule = getOperationalModule(activeTab);
    const handleSetConsole = onSelectConsole;

    useEffect(() => {
        const openAction = (event) => setActionRequest(event.detail);
        const handleVoicePunch = (e) => {
            if (e.detail?.type === 'OUT') {
                punchOut();
            } else {
                punchIn();
            }
        };
        window.addEventListener('nucleus:open-action', openAction);
        window.addEventListener('nucleus:trigger_punch', handleVoicePunch);
        return () => {
            window.removeEventListener('nucleus:open-action', openAction);
            window.removeEventListener('nucleus:trigger_punch', handleVoicePunch);
        };
    }, []);

    const completeAction = async ({ action, title, values, context }) => {
        const record = { action, title, values, context, recordedAt: new Date().toISOString() };
        window.dispatchEvent(new CustomEvent('nucleus:action-completed', { detail: record }));
        
        // Map dynamic action form to dedicated live backend API routes
        const endpointMap = {
            employee: '/api/v1/people',
            legal_entity: '/api/v1/operations/legal-entities',
            location: '/api/v1/operations/locations',
            position: '/api/v1/organization/positions',
            document: '/api/v1/operations/documents',
            invite: '/api/v1/operations/invites',
            oneOnOne: '/api/v1/operations/one-on-ones',
            feedback360: '/api/v1/operations/feedback-360',
            okr: '/api/v1/objectives',
            wellbeing: '/api/v1/operations/wellbeing-checkins',
            compCycle: '/api/v1/operations/comp-cycles',
            offCycleOt: '/api/v1/ot-requests',
            arrears: '/api/v1/operations/arrears',
            contractor: '/api/v1/contract-workforce/contractors',
            debitNote: '/api/v1/operations/debit-notes',
            filing: '/api/v1/compliance/filings',
            inspector: '/api/v1/compliance/inspections',
            apiKey: '/api/v1/webhooks/endpoints',
            connector: '/api/v1/webhooks/subscriptions',
            learningPath: '/api/v1/my-learning',
            focusBlock: '/api/v1/operations/focus-blocks',
            photo: '/api/v1/operations/photos',
            biometric: '/api/v1/operations/biometrics',
            returnPlan: '/api/v1/operations/return-plans',
            kudos: '/api/v1/recognition-events',
            probation: '/api/v1/operations/probation-reviews',
            ticket: '/api/v1/operations/tickets',
            reply: '/api/v1/operations/ticket-replies',
            settings: '/api/v1/tenant/settings',
            assetReturn: '/api/v1/offboarding/items',
            clearance: '/api/v1/offboarding/cases',
            roster: '/api/v1/operations/rosters',
            leaveDecision: '/api/v1/leave-requests/decide',
            benefitLock: '/api/v1/operations/benefit-locks',
            payrollPreview: '/api/v1/payroll-runs',
            payrollRelease: '/api/v1/payroll-runs',
            actionReversal: '/api/v1/operations/reversals',
            anomalyReview: '/api/v1/payroll-anomalies'
        };

        const targetEndpoint = endpointMap[action] || `/api/v1/operations/${action}`;
        try {
            const res = await fetch(targetEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Idempotency-Key': crypto.randomUUID()
                },
                body: JSON.stringify({ action, ...values, context })
            });
            if (action === 'photo') {
                const json = await res.json().catch(() => ({}));
                const photoUrl = json?.data?.photoUrl || values.photoDataUrl || (values.photo ? (values.photo.startsWith('http') || values.photo.startsWith('data:') ? values.photo : `/images/${values.photo}`) : '/images/logo-sqr.png');
                window.dispatchEvent(new CustomEvent('nucleus:profile-updated', { detail: { photo: values.photo, photoUrl } }));
            }
        } catch (e) {
            console.warn('Action server sync:', e);
        }

        showToast(title, readData("components.Workspace.MainWorkspace", "demoActionComplete"), 'success');
        return { success: true };
    };

    // Super Admin & Executive Telemetry Scope Filter States (4 Required Filters)
    const [filterLocation, setFilterLocation] = useState(readData("components.Workspace.MainWorkspace", "initialState_2"));
    const [filterDepartment, setFilterDepartment] = useState(readData("components.Workspace.MainWorkspace", "initialState_3"));
    const [filterTenure, setFilterTenure] = useState(readData("components.Workspace.MainWorkspace", "initialState_4")); // '1 Month' | '3 Months' | '6 Months' | '1 Year' | 'Custom Calendar'
    const [isCustomCalendarOpen, setIsCustomCalendarOpen] = useState(false);
    const [customStartDate, setCustomStartDate] = useState(readData("components.Workspace.MainWorkspace", "initialState_5"));
    const [customEndDate, setCustomEndDate] = useState(readData("components.Workspace.MainWorkspace", "initialState_6"));
    const [filterBranch, setFilterBranch] = useState(readData("components.Workspace.MainWorkspace", "initialState_7"));

    const activeFilterCount = (
        (filterLocation !== 'All Locations' ? 1 : 0) +
        (filterDepartment !== 'All Departments' ? 1 : 0) +
        (filterTenure !== '3 Months' || isCustomCalendarOpen ? 1 : 0) +
        (filterBranch !== 'All Branches' ? 1 : 0)
    );

    const handleResetFilters = () => {
        setFilterLocation('All Locations');
        setFilterDepartment('All Departments');
        setFilterTenure('3 Months');
        setIsCustomCalendarOpen(false);
        setCustomStartDate('2026-06-01');
        setCustomEndDate('2026-09-11');
        setFilterBranch('All Branches');
        showToast(translateText("components.Workspace.MainWorkspace","text_4a7cecb37b"),translateText("components.Workspace.MainWorkspace","text_82b997f867"), 'info');
    };

    const permittedConsoleIds = getPermittedConsoles ? getPermittedConsoles(currentRole) : (ROLE_PERMITTED_CONSOLES[currentRole] || readData("components.Workspace.MainWorkspace", "permittedConsoleIds_3"));

    const getRoleDefaultScreen = (role) => {
        switch (role) {
            case ROLES.FINANCE_MANAGER: return 'S5';
            case ROLES.HR_MANAGER: return 'S2';
            case ROLES.PROJECT_MANAGER:
            case ROLES.TEAM_LEAD: return 'S7';
            case ROLES.EMPLOYEE: return 'S8';
            case ROLES.SUPER_ADMIN:
            default: return 'S1';
        }
    };

    const safeActiveConsole = permittedConsoleIds.includes(activeConsole) ? activeConsole : (permittedConsoleIds[0] || readData("components.Workspace.MainWorkspace", "fallback_2"));
    const activeDashboardScreen = safeActiveConsole || getRoleDefaultScreen(currentRole);

    // --- UNIFIED COCKPIT & ROLE-BASED DASHBOARD RENDERER ---
    const [personalDashboard, setPersonalDashboard] = useState(true);
    const supportsPersonalDashboard = (currentRole === ROLES.SUPER_ADMIN && activeDashboardScreen === 'S10') || (currentRole === ROLES.HR_MANAGER && activeDashboardScreen === 'S2') || (currentRole === ROLES.EMPLOYEE && activeDashboardScreen === 'S8');
    const renderDashboard = () => {
        if (supportsPersonalDashboard && personalDashboard) return <PersonalDashboard key={`${authUser.email}:${activeDashboardScreen}`} consoleId={activeDashboardScreen} onNavigate={onTabChange} onShowConsole={() => setPersonalDashboard(false)} />;
        if (activeDashboardScreen === 'S10' && [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(currentRole)) return <AdminOverview user={authUser} onNavigate={onTabChange} />;
        const isEmployee = activeDashboardScreen === 'S8';
        const isExecutive = activeDashboardScreen === 'S1' || (currentRole === ROLES.SUPER_ADMIN && !isEmployee);
        const isManager = activeDashboardScreen === 'S7';

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>

                {/* 1. OPERATIONAL HERO & QUICK ACTIONS LAUNCHPAD */}
                <div className={styles.heroSection} data-dashboard-hero style={{ marginBottom: 0, minHeight: 'auto', padding: 0 }}>
                    <div className={styles.heroContent}>
                        <div className={styles.heroLeft}>
                            <div className={styles.heroAvatarWrapper}>
                                <NextImage unoptimized width={48} height={48}
                                    src={avatarUrl}
                                    className={styles.heroAvatar}
                                    alt={effectiveName}
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(effectiveName)}&background=2563ea&color=fff`;
                                    }}
                                />
                                <div className={styles.heroOnline}></div>
                            </div>
                            <div className={styles.heroText}>
                                {isExecutive ? (
                                    <>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.76rem', color: 'var(--text-2)', fontWeight: 600, marginBottom: '0.2rem' }}>
                                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--status-ok)', boxShadow: '0 0 8px var(--status-ok)', display: 'inline-block' }} />
                                            <span>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_4")}</span>
                                            <span style={{ opacity: 0.4 }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_5")}</span>
                                            <span>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_6")}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                                            <h1 style={{ margin: 0 }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_7")}{firstName}{readData("components.Workspace.MainWorkspace", "renderDashboard_text_8")}</h1>
                                            <span style={{
                                                padding: '0.2rem 0.6rem',
                                                background: 'var(--signal-wash)',
                                                color: 'var(--signal-ink)',
                                                borderRadius: '6px',
                                                fontSize: '0.74rem',
                                                fontWeight: '700',
                                                letterSpacing: '0.04em',
                                                border: '1px solid var(--line-glow)'
                                            }}>
                                                {currentRole === 'SUPER_ADMIN' ? readData("components.Workspace.MainWorkspace", "display_8") : readData("components.Workspace.MainWorkspace", "display_9")}
                                            </span>
                                        </div>
                                        <p style={{ margin: '0.25rem 0 0.85rem' }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_9")}</p>
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                            <button className={shared.scopeBtn} onClick={() => onTabChange('team')}>
                                                <Users size={13} color="var(--signal)" />{readData("components.Workspace.MainWorkspace", "renderDashboard_text_10")}</button>
                                            <button className={shared.scopeBtn} onClick={() => setIsCMSModalOpen(true)}>
                                                <Megaphone size={13} color="var(--signal-ink)" />{readData("components.Workspace.MainWorkspace", "renderDashboard_text_11")}{announcements.length}{readData("components.Workspace.MainWorkspace", "renderDashboard_text_12")}</button>
                                            <button
                                                className={shared.scopeBtn}
                                                onClick={() => onTabChange('access_control')}
                                                style={{
                                                    borderColor: 'var(--line-glow)',
                                                    color: 'var(--signal)',
                                                    background: 'var(--signal-wash)'
                                                }}
                                                title={readData("components.Workspace.MainWorkspace", "renderDashboard_title_13")}
                                            >
                                                <ShieldCheck size={13} color="var(--signal)" />{readData("components.Workspace.MainWorkspace", "renderDashboard_text_14")}</button>
                                        </div>
                                    </>
                                ) : isEmployee ? (
                                    <>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.76rem', color: 'var(--text-2)', fontWeight: 600, marginBottom: '0.2rem' }}>
                                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--info)', boxShadow: '0 0 8px var(--info)', display: 'inline-block' }} />
                                            <span>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_15")}</span>
                                            <span style={{ opacity: 0.4 }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_16")}</span>
                                            <span>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_17")}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                                            <h1 style={{ margin: 0 }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_18")}{firstName}{readData("components.Workspace.MainWorkspace", "renderDashboard_text_19")}</h1>
                                            <span style={{
                                                padding: '0.2rem 0.6rem',
                                                background: 'rgba(79, 182, 245, 0.15)',
                                                color: 'var(--info)',
                                                borderRadius: '6px',
                                                fontSize: '0.74rem',
                                                fontWeight: '700',
                                                letterSpacing: '0.04em',
                                                border: '1px solid rgba(79, 182, 245, 0.3)'
                                            }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_20")}</span>
                                        </div>
                                        <p style={{ margin: '0.25rem 0 0.85rem' }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_21")}</p>
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                            <button
                                                onClick={attendance.status === 'present' ? punchOut : punchIn}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.45rem',
                                                    padding: '0.42rem 0.95rem',
                                                    borderRadius: '9999px',
                                                    fontSize: '0.78rem',
                                                    fontWeight: '700',
                                                    cursor: 'pointer',
                                                    background: attendance.status === 'present' ? 'var(--flag-wash)' : 'var(--status-ok-wash)',
                                                    color: attendance.status === 'present' ? 'var(--flag)' : 'var(--status-ok-ink)',
                                                    border: attendance.status === 'present' ? '1px solid var(--flag)' : '1px solid var(--status-ok-ink)',
                                                    boxShadow: attendance.status === 'present' ? 'none' : '0 2px 10px rgba(16, 185, 129, 0.25)',
                                                    transition: 'all 0.15s ease'
                                                }}
                                                title={readData("components.Workspace.MainWorkspace", "renderDashboard_title_22")}
                                            >
                                                <Clock size={14} />
                                                {attendance.status === 'present' ?translateText("components.Workspace.MainWorkspace","text_63c2b4a100", {value1: String(attendance.punchInTime || readData("components.Workspace.MainWorkspace", "fallback_3"))}) : readData("components.Workspace.MainWorkspace", "display_10")}
                                            </button>
                                            <button className={shared.scopeBtn} onClick={() => onTabChange('leaves')}>
                                                <Sun size={13} color="var(--pending)" />{readData("components.Workspace.MainWorkspace", "renderDashboard_text_23")}</button>
                                            <button className={shared.scopeBtn} onClick={() => onTabChange('compensation')}>
                                                <DollarSign size={13} color="var(--info)" />{readData("components.Workspace.MainWorkspace", "renderDashboard_text_24")}</button>
                                            <button className={shared.scopeBtn} onClick={() => onTabChange('team')}>
                                                <Users size={13} color="var(--signal)" />{readData("components.Workspace.MainWorkspace", "renderDashboard_text_25")}</button>
                                            <button className={shared.scopeBtn} onClick={() => setIsCMSModalOpen(true)}>
                                                <Megaphone size={13} color="var(--signal-ink)" />{readData("components.Workspace.MainWorkspace", "renderDashboard_text_26")}{announcements.length}{readData("components.Workspace.MainWorkspace", "renderDashboard_text_27")}</button>
                                        </div>
                                    </>
                                ) : isManager ? (
                                    <>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.76rem', color: 'var(--text-2)', fontWeight: 600, marginBottom: '0.2rem' }}>
                                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--status-ok)', boxShadow: '0 0 8px var(--status-ok)', display: 'inline-block' }} />
                                            <span>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_28")}</span>
                                            <span style={{ opacity: 0.4 }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_29")}</span>
                                            <span>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_30")}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                                            <h1 style={{ margin: 0 }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_31")}{firstName}{readData("components.Workspace.MainWorkspace", "renderDashboard_text_32")}</h1>
                                            <span style={{
                                                padding: '0.2rem 0.6rem',
                                                background: 'var(--signal-wash)',
                                                color: 'var(--signal-ink)',
                                                borderRadius: '6px',
                                                fontSize: '0.74rem',
                                                fontWeight: '700',
                                                letterSpacing: '0.04em',
                                                border: '1px solid var(--line-glow)'
                                            }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_33")}</span>
                                        </div>
                                        <p style={{ margin: '0.25rem 0 0.85rem' }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_34")}</p>
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                            <button className={shared.scopeBtn} onClick={() => onTabChange('leaves')}>
                                                <CheckCircle size={13} color="var(--status-ok)" />{readData("components.Workspace.MainWorkspace", "renderDashboard_text_35")}</button>
                                            <button className={shared.scopeBtn} onClick={() => onTabChange('team')}>
                                                <Users size={13} color="var(--info)" />{readData("components.Workspace.MainWorkspace", "renderDashboard_text_36")}</button>
                                            <button className={shared.scopeBtn} onClick={() => setIsCMSModalOpen(true)}>
                                                <Megaphone size={13} color="var(--signal-ink)" />{readData("components.Workspace.MainWorkspace", "renderDashboard_text_37")}{announcements.length}{readData("components.Workspace.MainWorkspace", "renderDashboard_text_38")}</button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.76rem', color: 'var(--text-2)', fontWeight: 600, marginBottom: '0.2rem' }}>
                                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--signal-ink)', boxShadow: '0 0 8px var(--signal-ink)', display: 'inline-block' }} />
                                            <span>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_39")}</span>
                                            <span style={{ opacity: 0.4 }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_40")}</span>
                                            <span>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_41")}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                                            <h1 style={{ margin: 0 }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_42")}{firstName}{readData("components.Workspace.MainWorkspace", "renderDashboard_text_43")}</h1>
                                            <span style={{
                                                padding: '0.2rem 0.6rem',
                                                background: 'rgba(155, 140, 255, 0.15)',
                                                color: 'var(--signal-ink)',
                                                borderRadius: '6px',
                                                fontSize: '0.74rem',
                                                fontWeight: '700',
                                                letterSpacing: '0.04em',
                                                border: '1px solid rgba(155, 140, 255, 0.3)'
                                            }}>
                                                {currentRole.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <p style={{ margin: '0.25rem 0 0.85rem' }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_44")}</p>
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                            <button className={shared.scopeBtn} onClick={() => onTabChange('team')}>
                                                <Users size={13} color="var(--status-ok-ink)" />{readData("components.Workspace.MainWorkspace", "renderDashboard_text_45")}</button>
                                            <button className={shared.scopeBtn} onClick={() => setIsCMSModalOpen(true)}>
                                                <Megaphone size={13} color="var(--signal-ink)" />{readData("components.Workspace.MainWorkspace", "renderDashboard_text_46")}{announcements.length}{readData("components.Workspace.MainWorkspace", "renderDashboard_text_47")}</button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className={styles.heroActionsRight}>
                            <div className={styles.cardRight}>
                                <div className={styles.timeBig} style={{ fontSize: '1.6rem' }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_48")}</div>
                                <div className={styles.dateSmall} style={{ fontSize: '0.76rem' }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_49")}</div>
                                <div className={styles.locWeather} style={{ fontSize: '0.74rem' }}>
                                    <span>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_50")}</span>
                                    <span>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_51")}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. DEDICATED SUPER ADMIN & EXECUTIVE WORKFORCE FILTERS SECTION (4 REQUIRED FILTERS) */}
                {(isExecutive || currentRole === 'SUPER_ADMIN') && (
                    <div className={styles.workforceFilters}>
                        {/* Section Header */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '0.6rem',
                            paddingBottom: '0.75rem',
                            borderBottom: '1px solid var(--line)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                <div style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '8px',
                                    background: 'var(--signal-wash)',
                                    border: '1px solid var(--line-glow)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--signal)'
                                }}>
                                    <Filter size={16} />
                                </div>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                                        <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '0.02em' }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_52")}</h3>
                                        <span style={{
                                            fontSize: '0.65rem',
                                            padding: '0.12rem 0.48rem',
                                            borderRadius: '4px',
                                            background: 'var(--signal-wash)',
                                            color: 'var(--signal)',
                                            fontWeight: 800,
                                            letterSpacing: '0.05em',
                                            border: '1px solid var(--line-glow)'
                                        }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_53")}</span>
                                    </div>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-2)' }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_54")}</span>
                                </div>
                            </div>

                            {/* Active Status & Reset Button */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                <span style={{
                                    fontSize: '0.72rem',
                                    color: 'var(--text-2)',
                                    background: 'var(--card-2)',
                                    padding: '0.28rem 0.65rem',
                                    borderRadius: '6px',
                                    border: '1px solid var(--line)',
                                    fontWeight: 600
                                }}>
                                    {activeFilterCount > 0 ? (
                                        <span style={{ color: 'var(--signal)' }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_55")}{activeFilterCount}{readData("components.Workspace.MainWorkspace", "renderDashboard_text_56")}{activeFilterCount > 1 ? readData("components.Workspace.MainWorkspace", "display_11") : ''}</span>
                                    ) : (
                                        <span style={{ color: 'var(--text-2)' }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_57")}</span>
                                    )}
                                </span>

                                <button
                                    onClick={handleResetFilters}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                        padding: '0.28rem 0.7rem',
                                        borderRadius: '6px',
                                        background: 'var(--card-2)',
                                        border: '1px solid var(--line)',
                                        color: 'var(--text-2)',
                                        fontSize: '0.72rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                    }}
                                    title={readData("components.Workspace.MainWorkspace", "renderDashboard_title_58")}
                                >
                                    <RotateCcw size={12} />{readData("components.Workspace.MainWorkspace", "renderDashboard_text_59")}</button>
                            </div>
                        </div>

                        {/* 4 Dedicated Filter Cards Grid */}
                        <div className={styles.workforceFilterGrid}>
                            {/* FILTER 1: LOCATION */}
                            <div className={styles.workforceFilterCard}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <MapPin size={14} color="var(--info)" />
                                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--info)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_60")}</span>
                                    </div>
                                    {filterLocation !== 'All Locations' && (
                                        <button
                                            onClick={() => { setFilterLocation('All Locations'); showToast(translateText("components.Workspace.MainWorkspace","text_c703f4b6e8"),translateText("components.Workspace.MainWorkspace","text_c8e9ccf8d2"), 'info'); }}
                                            style={{ background: 'transparent', border: 'none', color: 'var(--text-2)', cursor: 'pointer', padding: 0 }}
                                            title={readData("components.Workspace.MainWorkspace", "renderDashboard_title_61")}
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                                <select
                                    value={filterLocation}
                                    onChange={(e) => {
                                        setFilterLocation(e.target.value);
                                        showToast(translateText("components.Workspace.MainWorkspace","text_615dc9a96d"),translateText("components.Workspace.MainWorkspace","text_64d0a984c6", {value1: String(e.target.value)}), 'info');
                                    }}
                                    className={styles.workforceFilterSelect}
                                >
                                    <option value="All Locations">{readData("components.Workspace.MainWorkspace", "renderDashboard_text_62")}</option>
                                    <option value="Bengaluru Campus (HQ)">{readData("components.Workspace.MainWorkspace", "renderDashboard_text_63")}</option>
                                    <option value="Pune Tech Park">{readData("components.Workspace.MainWorkspace", "renderDashboard_text_64")}</option>
                                    <option value="Hyderabad R&D Hub">{readData("components.Workspace.MainWorkspace", "renderDashboard_text_65")}</option>
                                    <option value="Chennai Terminal">{readData("components.Workspace.MainWorkspace", "renderDashboard_text_66")}</option>
                                    <option value="NCR Delhi Hub">{readData("components.Workspace.MainWorkspace", "renderDashboard_text_67")}</option>
                                    <option value="Mumbai Financial Center">{readData("components.Workspace.MainWorkspace", "renderDashboard_text_68")}</option>
                                    <option value="Remote & Field Network">{readData("components.Workspace.MainWorkspace", "renderDashboard_text_69")}</option>
                                </select>
                            </div>

                            {/* FILTER 2: DEPARTMENT */}
                            <div className={styles.workforceFilterCard}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <Layers size={14} color="var(--signal)" />
                                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--signal)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_70")}</span>
                                    </div>
                                    {filterDepartment !== 'All Departments' && (
                                        <button
                                            onClick={() => { setFilterDepartment('All Departments'); showToast(translateText("components.Workspace.MainWorkspace","text_13eb4bfef2"),translateText("components.Workspace.MainWorkspace","text_487a9562cf"), 'info'); }}
                                            style={{ background: 'transparent', border: 'none', color: 'var(--text-2)', cursor: 'pointer', padding: 0 }}
                                            title={readData("components.Workspace.MainWorkspace", "renderDashboard_title_71")}
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                                <select
                                    value={filterDepartment}
                                    onChange={(e) => {
                                        setFilterDepartment(e.target.value);
                                        showToast(translateText("components.Workspace.MainWorkspace","text_cd7b2f937d"),translateText("components.Workspace.MainWorkspace","text_64d0a984c6", {value1: String(e.target.value)}), 'info');
                                    }}
                                    className={styles.workforceFilterSelect}
                                >
                                    <option value="All Departments">{readData("components.Workspace.MainWorkspace", "renderDashboard_text_72")}</option>
                                    <option value="Engineering & Architecture">{readData("components.Workspace.MainWorkspace", "renderDashboard_text_73")}</option>
                                    <option value="Product & UX Design">{readData("components.Workspace.MainWorkspace", "renderDashboard_text_74")}</option>
                                    <option value="Sales & Enterprise Growth">{readData("components.Workspace.MainWorkspace", "renderDashboard_text_75")}</option>
                                    <option value="Customer Operations & Support">{readData("components.Workspace.MainWorkspace", "renderDashboard_text_76")}</option>
                                    <option value="Finance, Tax & Legal">{readData("components.Workspace.MainWorkspace", "renderDashboard_text_77")}</option>
                                    <option value="People & Culture (HR)">{readData("components.Workspace.MainWorkspace", "renderDashboard_text_78")}</option>
                                    <option value="DevOps & Cloud Infra">{readData("components.Workspace.MainWorkspace", "renderDashboard_text_79")}</option>
                                </select>
                            </div>

                            {/* FILTER 3: TENURE & TIMEFRAME */}
                            <div className={styles.workforceFilterCard}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <CalendarDays size={14} color="var(--pending)" />
                                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--pending)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_80")}</span>
                                    </div>
                                    <span style={{ fontSize: '0.66rem', color: 'var(--text-2)' }}>
                                        {isCustomCalendarOpen ? readData("components.Workspace.MainWorkspace", "display_12") : filterTenure}
                                    </span>
                                </div>
                                <div className={styles.workforceFilterButtonGroup}>
                                    {readData("components.Workspace.MainWorkspace", "renderDashboard_81").map((t) => {
                                        const isSelected = filterTenure === t && !isCustomCalendarOpen;
                                        return (
                                            <button
                                                key={t}
                                                onClick={() => {
                                                    setFilterTenure(t);
                                                    setIsCustomCalendarOpen(false);
                                                    showToast(translateText("components.Workspace.MainWorkspace","text_165361fec3"),translateText("components.Workspace.MainWorkspace","text_84c8971810", {value1: String(t)}), 'info');
                                                }}
                                                className={`${styles.workforceFilterSegmentBtn} ${isSelected ? styles.active : ''}`}
                                            >
                                                {t.replace(' Months', 'M').replace(' Month', 'M').replace(' Year', 'Y')}
                                            </button>
                                        );
                                    })}
                                    {/* Calendar Date Selector Toggle */}
                                    <button
                                        onClick={() => setIsCustomCalendarOpen(!isCustomCalendarOpen)}
                                        className={`${styles.workforceFilterCalendarBtn} ${isCustomCalendarOpen ? styles.active : ''}`}
                                        title={readData("components.Workspace.MainWorkspace", "renderDashboard_title_82")}
                                    >
                                        <Calendar size={13} />
                                        <span>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_83")}</span>
                                    </button>
                                </div>
                            </div>

                            {/* FILTER 4: BRANCH / LEGAL ENTITY */}
                            <div className={styles.workforceFilterCard}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <Building2 size={14} color="var(--signal-ink)" />
                                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--signal-ink)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_84")}</span>
                                    </div>
                                    {filterBranch !== 'All Branches' && (
                                        <button
                                            onClick={() => { setFilterBranch('All Branches'); showToast(translateText("components.Workspace.MainWorkspace","text_5d7dc5a35f"),translateText("components.Workspace.MainWorkspace","text_f82b3856b4"), 'info'); }}
                                            style={{ background: 'transparent', border: 'none', color: 'var(--text-2)', cursor: 'pointer', padding: 0 }}
                                            title={readData("components.Workspace.MainWorkspace", "renderDashboard_title_85")}
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                                <select
                                    value={filterBranch}
                                    onChange={(e) => {
                                        setFilterBranch(e.target.value);
                                        showToast(translateText("components.Workspace.MainWorkspace","text_dc2204c35e"),translateText("components.Workspace.MainWorkspace","text_64d0a984c6", {value1: String(e.target.value)}), 'info');
                                    }}
                                    className={styles.workforceFilterSelect}
                                >
                                    <option value="All Branches">{readData("components.Workspace.MainWorkspace", "renderDashboard_text_86")}</option>
                                    <option value="Asteria Aerospace India Ltd. (HQ)">{readData("components.Workspace.MainWorkspace", "renderDashboard_text_87")}</option>
                                    <option value="Asteria Space Dynamics Inc. (US)">{readData("components.Workspace.MainWorkspace", "renderDashboard_text_88")}</option>
                                    <option value="Asteria Propulsion UK Ltd.">{readData("components.Workspace.MainWorkspace", "renderDashboard_text_89")}</option>
                                    <option value="Asteria Singapore Pte. Ltd.">{readData("components.Workspace.MainWorkspace", "renderDashboard_text_90")}</option>
                                    <option value="Asteria Middle East FZ-LLC">{readData("components.Workspace.MainWorkspace", "renderDashboard_text_91")}</option>
                                </select>
                            </div>
                        </div>

                        {/* INTERACTIVE CALENDAR DATE RANGE SELECTOR POPDOWN */}
                        {isCustomCalendarOpen && (
                            <div style={{
                                padding: '0.75rem 1rem',
                                background: 'var(--card-2)',
                                border: '1px solid var(--line-glow)',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '0.75rem',
                                animation: 'fadeIn 0.2s ease-in-out'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-2)', fontWeight: 600 }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_92")}</span>
                                        <input
                                            type="date"
                                            value={customStartDate}
                                            onChange={(e) => setCustomStartDate(e.target.value)}
                                            style={{
                                                background: 'var(--card)',
                                                border: '1px solid var(--line)',
                                                borderRadius: '5px',
                                                padding: '0.35rem 0.55rem',
                                                color: 'var(--text)',
                                                fontSize: '0.76rem',
                                                fontWeight: 600
                                            }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-2)', fontWeight: 600 }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_93")}</span>
                                        <input
                                            type="date"
                                            value={customEndDate}
                                            onChange={(e) => setCustomEndDate(e.target.value)}
                                            style={{
                                                background: 'var(--card)',
                                                border: '1px solid var(--line)',
                                                borderRadius: '5px',
                                                padding: '0.35rem 0.55rem',
                                                color: 'var(--text)',
                                                fontSize: '0.76rem',
                                                fontWeight: 600
                                            }}
                                        />
                                    </div>

                                    <button
                                        onClick={() => {
                                            setFilterTenure(`Custom (${customStartDate} to ${customEndDate})`);
                                            showToast(translateText("components.Workspace.MainWorkspace","text_6fded91277"),translateText("components.Workspace.MainWorkspace","text_52edd19697", {value1: String(customStartDate), value2: String(customEndDate)}), 'success');
                                        }}
                                        style={{
                                            padding: '0.38rem 0.85rem',
                                            background: 'var(--signal)',
                                            border: 'none',
                                            borderRadius: '5px',
                                            color: 'var(--on-signal)',
                                            fontSize: '0.74rem',
                                            fontWeight: 700,
                                            cursor: 'pointer'
                                        }}
                                    >{readData("components.Workspace.MainWorkspace", "renderDashboard_text_94")}</button>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--signal)', fontWeight: 600 }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_95")}{customStartDate}{readData("components.Workspace.MainWorkspace", "renderDashboard_text_96")}{customEndDate}
                                    </span>
                                    <button
                                        onClick={() => setIsCustomCalendarOpen(false)}
                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-2)', cursor: 'pointer', padding: '0.2rem' }}
                                        title={readData("components.Workspace.MainWorkspace", "renderDashboard_title_97")}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ACTIVE FILTER SUMMARY STRIP */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '0.5rem',
                            paddingTop: '0.45rem',
                            borderTop: '1px solid var(--card-2)',
                            fontSize: '0.72rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                                <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_98")}</span>
                                <span style={{
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '4px',
                                    background: filterLocation === 'All Locations' ? 'var(--card-2)' : 'var(--info-wash)',
                                    color: filterLocation === 'All Locations' ? 'var(--text-2)' : 'var(--info)',
                                    border: '1px solid var(--line)'
                                }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_99")}{filterLocation}
                                </span>
                                <span style={{
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '4px',
                                    background: filterDepartment === 'All Departments' ? 'var(--card-2)' : 'var(--signal-wash)',
                                    color: filterDepartment === 'All Departments' ? 'var(--text-2)' : 'var(--signal)',
                                    border: filterDepartment === 'All Departments' ? '1px solid var(--line)' : '1px solid var(--line-glow)'
                                }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_100")}{filterDepartment}
                                </span>
                                <span style={{
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '4px',
                                    background: 'var(--pending-wash)',
                                    color: 'var(--pending)',
                                    border: '1px solid var(--line)'
                                }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_101")}{isCustomCalendarOpen ?translateText("components.Workspace.MainWorkspace","text_4aa0a8bf87", {value1: String(customStartDate), value2: String(customEndDate)}) : filterTenure}
                                </span>
                                <span style={{
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '4px',
                                    background: filterBranch === 'All Branches' ? 'var(--card-2)' : 'var(--agent-wash)',
                                    color: filterBranch === 'All Branches' ? 'var(--text-2)' : 'var(--agent)',
                                    border: '1px solid var(--line)'
                                }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_102")}{filterBranch}
                                </span>
                            </div>

                            <span style={{ color: 'var(--text-3)', fontWeight: 600 }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_103")}</span>
                        </div>
                    </div>
                )}

                {/* 3. ROLE-BASED ANALYTICAL CHARTS SUITE */}
                {activeDashboardScreen === 'S1' && <PeopleCommandCentre onNavigate={onTabChange} />}
            {activeDashboardScreen === 'S2' && <HROpsConsole onNavigate={onTabChange} />}
            {activeDashboardScreen === 'S3' && <AttendanceIntelligence onNavigate={onTabChange} />}
            {activeDashboardScreen === 'S4' && <TalentAcquisition onNavigate={onTabChange} />}
            {activeDashboardScreen === 'S5' && <PayrollControlRoom onNavigate={onTabChange} />}
            {activeDashboardScreen === 'S6' && <PerformanceTalent onNavigate={onTabChange} />}
            {activeDashboardScreen === 'S7' && <ManagerCockpit onNavigate={onTabChange} />}
            {activeDashboardScreen === 'S8' && <EmployeeHome onNavigate={onTabChange} />}
            {activeDashboardScreen === 'S9' && <MagnetixCapability onNavigate={onTabChange} />}
            {activeDashboardScreen === 'S10' && <NucleusIntelligence onNavigate={onTabChange} />}

            {/* 3. GROUNDED OPERATIONAL CARDS */}
            <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
                    gap: '12px',
                    width: '100%',
                    marginTop: '0.5rem'
                }}>
                    {/* Today's Focus Checklist */}
                    <div style={{
                        background: 'var(--card, #0E1D30)',
                        border: '1px solid var(--line, #1C3450)',
                        borderRadius: '8px',
                        padding: '1rem 1.25rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <CheckCircle size={16} color="#2DD4A8" />
                                <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text, #E6EDF6)', margin: 0 }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_104")}</h3>
                            </div>
                            <span style={{
                                fontSize: '0.72rem',
                                padding: '0.15rem 0.5rem',
                                background: 'rgba(242, 169, 59, 0.15)',
                                color: '#F2A93B',
                                borderRadius: '4px',
                                fontWeight: 700
                            }}>
                                {focusTasks.filter(t => !t.completed).length}{readData("components.Workspace.MainWorkspace", "renderDashboard_text_105")}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {focusTasks.map(t => (
                                <div
                                    key={t.id}
                                    onClick={() => completeFocusTask(t.id)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.65rem',
                                        padding: '0.45rem 0.6rem',
                                        borderRadius: '5px',
                                        background: 'rgba(0,0,0,0.2)',
                                        border: '1px solid rgba(28, 52, 80, 0.4)',
                                        cursor: 'pointer',
                                        opacity: t.completed ? 0.45 : 1
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={t.completed || false}
                                        onChange={() => {}}
                                        style={{ accentColor: '#2DD4A8', cursor: 'pointer' }}
                                    />
                                    <span style={{
                                        fontSize: '0.78rem',
                                        color: 'var(--text, #E6EDF6)',
                                        textDecoration: t.completed ? 'line-through' : 'none',
                                        flex: 1
                                    }}>
                                        {t.title}
                                    </span>
                                    <span style={{
                                        fontSize: '0.68rem',
                                        color: 'var(--text-2)',
                                        background: 'var(--card-2)',
                                        padding: '0.1rem 0.4rem',
                                        borderRadius: '3px'
                                    }}>
                                        {t.due || readData("components.Workspace.MainWorkspace", "fallback_4")}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Company Broadcasts & Notices */}
                    <div style={{
                        background: 'var(--card, #0E1D30)',
                        border: '1px solid var(--line, #1C3450)',
                        borderRadius: '8px',
                        padding: '1rem 1.25rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Megaphone size={16} color="#F2A93B" />
                                <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text, #E6EDF6)', margin: 0 }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_106")}</h3>
                            </div>
                            <button
                                onClick={() => setIsCMSModalOpen(true)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#2DD4A8',
                                    fontSize: '0.74rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >{readData("components.Workspace.MainWorkspace", "renderDashboard_text_107")}{announcements.length}{readData("components.Workspace.MainWorkspace", "renderDashboard_text_108")}</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                            {announcements.slice(0, 3).map(ann => (
                                <div
                                    key={ann.id}
                                    onClick={() => setIsCMSModalOpen(true)}
                                    style={{
                                        padding: '0.5rem 0.65rem',
                                        borderRadius: '5px',
                                        background: ann.pinned ? 'rgba(155, 140, 255, 0.08)' : 'rgba(0,0,0,0.2)',
                                        border: ann.pinned ? '1px solid rgba(155, 140, 255, 0.25)' : '1px solid rgba(28, 52, 80, 0.4)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <strong style={{ fontSize: '0.78rem', color: 'var(--text, #E6EDF6)' }}>{ann.title}</strong>
                                        {ann.pinned && (
                                            <span style={{ fontSize: '0.65rem', color: '#9B8CFF', fontWeight: 700, textTransform: 'uppercase' }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_109")}</span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-2)', marginTop: '0.2rem' }}>
                                        {ann.author}{readData("components.Workspace.MainWorkspace", "renderDashboard_text_110")}{ann.date}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Sprint Velocity & Active Pod Allocations */}
                    <div style={{
                        background: 'var(--card, #0E1D30)',
                        border: '1px solid var(--line, #1C3450)',
                        borderRadius: '8px',
                        padding: '1rem 1.25rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Briefcase size={16} color="#9B8CFF" />
                                <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text, #E6EDF6)', margin: 0 }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_111")}</h3>
                            </div>
                            <button
                                onClick={() => onTabChange('projects')}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#2DD4A8',
                                    fontSize: '0.74rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >{readData("components.Workspace.MainWorkspace", "renderDashboard_text_112")}</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                            {projects.slice(0, 2).map(p => (
                                <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                                        <strong style={{ color: 'var(--text, #E6EDF6)' }}>{p.name}</strong>
                                        <span style={{ color: '#2DD4A8', fontWeight: 700 }}>{p.progress}{readData("components.Workspace.MainWorkspace", "renderDashboard_text_113")}</span>
                                    </div>
                                    <div style={{ height: 6, background: 'var(--card-2)', borderRadius: 3, overflow: 'hidden' }}>
                                        <div style={{ width: `${p.progress}%`, height: '100%', background: '#2DD4A8' }} />
                                    </div>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-2)' }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_114")}{p.lead}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
        </div>
    );
};

    // --- OTHER TABS (Placeholders) ---
    const renderTeam = () => (
        <div style={{ padding: '2rem' }}><h2>{readData("components.Workspace.MainWorkspace", "renderTeam_text_115")}</h2></div>
    );
    const renderLeaves = () => (
        <div style={{ padding: '2rem' }}><h2>{readData("components.Workspace.MainWorkspace", "renderLeaves_text_116")}</h2></div>
    );
    const renderPayroll = () => (
        <div style={{ padding: '2rem' }}><h2>{readData("components.Workspace.MainWorkspace", "renderPayroll_text_117")}</h2></div>
    );
    const renderPerformance = () => (
        <div style={{ padding: '2rem' }}><h2>{readData("components.Workspace.MainWorkspace", "renderPerformance_text_118")}</h2></div>
    );

    const DOMAIN_LABELS = {
        dashboard: 'Dashboard Consoles',
        core_hr: 'Core HR',
        people: 'Core HR',
        talent: 'Talent',
        payroll_finance: 'Payroll & Finance',
        payroll: 'Payroll & Finance',
        workforce_ops: 'Workforce Operations',
        analytics_ai: 'Analytics & AI',
        analytics: 'Analytics & AI',
        platform: 'Platform Settings',
        settings: 'Platform Settings'
    };

    const TAB_TO_DOMAIN_MAP = {
        people_core: 'core_hr',
        team: 'core_hr',
        onboarding: 'core_hr',
        contract_workforce: 'core_hr',
        recruitment: 'talent',
        performance: 'talent',
        learning: 'talent',
        experience: 'talent',
        payroll: 'payroll_finance',
        compensation: 'payroll_finance',
        compliance: 'payroll_finance',
        attendance: 'workforce_ops',
        leaves: 'workforce_ops',
        projects: 'workforce_ops',
        analytics: 'analytics_ai',
        helpdesk: 'platform',
        integrations: 'platform',
        settings: 'platform',
        access_control: 'platform'
    };

    const formatTabName = (tab) => {
        const opMod = getOperationalModule(tab);
        if (opMod?.title) return opMod.title;
        const names = readData("components.Workspace.MainWorkspace", "names_119") || {};
        return names[tab] || tab.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    const effectiveDomain = activeDomain || TAB_TO_DOMAIN_MAP[activeTab] || 'core_hr';
    const currentDomainLabel = DOMAIN_LABELS[effectiveDomain] || (effectiveDomain ? effectiveDomain.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Feature Catalog');

    return (
        <div className={styles.workspace}>
            {showCatalog ? (
                <CatalogGridView
                    onSelectFeature={(targetTab, domain, itemId) => {
                        onTabChange(targetTab, domain, itemId);
                    }}
                    searchQuery={searchQuery}
                />
            ) : (
                <>
                    {/* Breadcrumb back to domain/catalog */}
                    {activeTab !== 'dashboard' && (
                        <div className={styles.breadcrumbBar} aria-label="Breadcrumb">
                            <button
                                className={styles.backToCatalogBtn}
                                onClick={() => {
                                    if (onSelectDomain && effectiveDomain) {
                                        onSelectDomain(effectiveDomain);
                                    } else if (onToggleCatalog) {
                                        onToggleCatalog();
                                    }
                                }}
                                title={`Domain: ${currentDomainLabel}`}
                            >
                                <Layers size={14} />
                                <span>{translateText(currentDomainLabel)}</span>
                            </button>
                            <span className={styles.breadcrumbSep}>{readData("components.Workspace.MainWorkspace", "MainWorkspace_text_122")}</span>
                            <span className={styles.breadcrumbCurrent}>{translateText(formatTabName(activeTab))}</span>
                        </div>
                    )}

                    {/* Display Content based on Active Tab */}
                    {activeTab === 'dashboard' && <>{supportsPersonalDashboard && !personalDashboard && <button style={{ margin: '12px 0', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--signal)', cursor: 'pointer' }} onClick={() => setPersonalDashboard(true)}>{translateText("components.Workspace.MainWorkspace","text_e53d7af293")}</button>}{renderDashboard()}</>}

            {/* Module 1: People Core */}
            {activeTab === 'people_core' && (
                <RoleProtected moduleKey="people_core" allowedRoles={[ROLES.SUPER_ADMIN, ROLES.HR_MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD, ROLES.EMPLOYEE]}>
                    <PeopleCoreView onNavigate={onTabChange} onSelectConsole={onSelectConsole} activeSubFeature={activeSubFeature} />
                </RoleProtected>
            )}

            {/* Module 2: Global Payroll & EWA */}
            {activeTab === 'payroll' && (
                <RoleProtected moduleKey="payroll" allowedRoles={[ROLES.SUPER_ADMIN, ROLES.FINANCE_MANAGER, ROLES.HR_MANAGER, ROLES.EMPLOYEE, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD]}>
                    <PayrollView onNavigate={onTabChange} onSelectConsole={onSelectConsole} activeSubFeature={activeSubFeature} />
                </RoleProtected>
            )}

            {/* Module 3: Talent Acquisition / ATS */}
            {activeTab === 'recruitment' && (
                <RoleProtected moduleKey="recruitment" allowedRoles={[ROLES.SUPER_ADMIN, ROLES.HR_MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD]}>
                    <RecruitmentView onNavigate={onTabChange} onSelectConsole={onSelectConsole} activeSubFeature={activeSubFeature} />
                </RoleProtected>
            )}

            {/* Module 4: Onboarding & Lifecycle */}
            {activeTab === 'onboarding' && (
                <RoleProtected moduleKey="onboarding" allowedRoles={[ROLES.SUPER_ADMIN, ROLES.HR_MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD, ROLES.EMPLOYEE]}>
                    <OnboardingView onNavigate={onTabChange} onSelectConsole={onSelectConsole} activeSubFeature={activeSubFeature} />
                </RoleProtected>
            )}

            {/* Module 5: Performance & OKRs */}
            {activeTab === 'performance' && (
                <RoleProtected moduleKey="performance" allowedRoles={[ROLES.SUPER_ADMIN, ROLES.HR_MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD, ROLES.EMPLOYEE]}>
                    <PerformanceView onNavigate={onTabChange} onSelectConsole={onSelectConsole} activeSubFeature={activeSubFeature} />
                </RoleProtected>
            )}

            {/* Module 6: Attendance & Leaves */}
            {activeTab === 'attendance' && (
                <RoleProtected moduleKey="attendance" allowedRoles={[ROLES.SUPER_ADMIN, ROLES.HR_MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD, ROLES.FINANCE_MANAGER, ROLES.EMPLOYEE]}>
                    <AttendanceView onNavigate={onTabChange} onSelectConsole={onSelectConsole} activeSubFeature={activeSubFeature} />
                </RoleProtected>
            )}
            {activeTab === 'leaves' && (
                <RoleProtected moduleKey="leaves" allowedRoles={[ROLES.SUPER_ADMIN, ROLES.HR_MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD, ROLES.FINANCE_MANAGER, ROLES.EMPLOYEE]}>
                    <LeaveView onNavigate={onTabChange} onSelectConsole={onSelectConsole} activeSubFeature={activeSubFeature} />
                </RoleProtected>
            )}

            {/* Module 7: People Intelligence / Analytics */}
                {activeTab === 'analytics' && (
                    <RoleProtected moduleKey="analytics" allowedRoles={[ROLES.SUPER_ADMIN, ROLES.HR_MANAGER, ROLES.FINANCE_MANAGER, ROLES.PROJECT_MANAGER]}>
                        <AnalyticsView onNavigate={onTabChange} onSelectConsole={onSelectConsole} activeSubFeature={activeSubFeature} />
                    </RoleProtected>
                )}

                {activeTab === 'operational_reports' && (
                    <RoleProtected moduleKey="analytics" allowedRoles={[ROLES.SUPER_ADMIN, ROLES.HR_MANAGER, ROLES.FINANCE_MANAGER, ROLES.PROJECT_MANAGER]}>
                        <AnalyticsView onNavigate={onTabChange} onSelectConsole={onSelectConsole} activeSubFeature="operational_reports" />
                    </RoleProtected>
                )}

            {/* Module 8: Learning & Development (L&D) */}
            {activeTab === 'learning' && (
                <RoleProtected moduleKey="learning" allowedRoles={[ROLES.SUPER_ADMIN, ROLES.HR_MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD, ROLES.FINANCE_MANAGER, ROLES.EMPLOYEE]}>
                    <LearningView onNavigate={onTabChange} onSelectConsole={onSelectConsole} activeSubFeature={activeSubFeature} />
                </RoleProtected>
            )}

            {/* Module 9: Compensation & Benefits */}
            {activeTab === 'compensation' && (
                <RoleProtected moduleKey="compensation" allowedRoles={[ROLES.SUPER_ADMIN, ROLES.HR_MANAGER, ROLES.FINANCE_MANAGER, ROLES.EMPLOYEE]}>
                    <CompensationView onNavigate={onTabChange} onSelectConsole={onSelectConsole} activeSubFeature={activeSubFeature} />
                </RoleProtected>
            )}

            {/* Module 10: Experience, MCI & Vedic Wellbeing */}
            {activeTab === 'experience' && (
                <RoleProtected moduleKey="experience" allowedRoles={[ROLES.SUPER_ADMIN, ROLES.HR_MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD, ROLES.FINANCE_MANAGER, ROLES.EMPLOYEE]}>
                    <ExperienceView onNavigate={onTabChange} onSelectConsole={onSelectConsole} activeSubFeature={activeSubFeature} />
                </RoleProtected>
            )}

            {/* Module 11: Integrations & API Platform */}
            {activeTab === 'integrations' && (
                <RoleProtected moduleKey="integrations" allowedRoles={[ROLES.SUPER_ADMIN, ROLES.HR_MANAGER]}>
                    <IntegrationsView onNavigate={onTabChange} onSelectConsole={onSelectConsole} activeSubFeature={activeSubFeature} />
                </RoleProtected>
            )}

            {/* Module 6: Statutory Compliance Engine & Labour Codes Simulator */}
            {activeTab === 'compliance' && (
                <RoleProtected moduleKey="compliance" allowedRoles={[ROLES.SUPER_ADMIN, ROLES.HR_MANAGER, ROLES.FINANCE_MANAGER]}>
                    <ComplianceView onNavigate={onTabChange} onSelectConsole={onSelectConsole} activeSubFeature={activeSubFeature} />
                </RoleProtected>
            )}

            {/* Module 7: Helpdesk & Grounded Policy Assistant */}
            {activeTab === 'helpdesk' && (
                <RoleProtected moduleKey="helpdesk" allowedRoles={[ROLES.SUPER_ADMIN, ROLES.HR_MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD, ROLES.FINANCE_MANAGER, ROLES.EMPLOYEE]}>
                    <HelpdeskView onNavigate={onTabChange} onSelectConsole={onSelectConsole} activeSubFeature={activeSubFeature} />
                </RoleProtected>
            )}

            {/* Module 13: Contract & Contingent Workforce */}
            {activeTab === 'contract_workforce' && (
                <RoleProtected moduleKey="contract_workforce" allowedRoles={[ROLES.SUPER_ADMIN, ROLES.HR_MANAGER, ROLES.FINANCE_MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD]}>
                    <ContractWorkforceView onNavigate={onTabChange} onSelectConsole={onSelectConsole} activeSubFeature={activeSubFeature} />
                </RoleProtected>
            )}

            {/* Workspaces, Teams & Settings */}
            {activeTab === 'org_chart' && (
                <RoleProtected moduleKey="org_chart" allowedRoles={[ROLES.SUPER_ADMIN, ROLES.HR_MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD, ROLES.FINANCE_MANAGER, ROLES.EMPLOYEE, ROLES.TRAINEE]}>
                    <OrgChartView activeSubFeature={activeSubFeature} />
                </RoleProtected>
            )}

            {activeTab === 'projects' && (
                <RoleProtected moduleKey="projects" allowedRoles={[ROLES.SUPER_ADMIN, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD, ROLES.EMPLOYEE, ROLES.TRAINEE]}>
                    <ProjectView onNavigate={onTabChange} onSelectConsole={onSelectConsole} activeSubFeature={activeSubFeature} />
                </RoleProtected>
            )}

            {activeTab === 'team' && (
                <RoleProtected moduleKey="team" allowedRoles={[ROLES.SUPER_ADMIN, ROLES.HR_MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD, ROLES.FINANCE_MANAGER, ROLES.EMPLOYEE, ROLES.TRAINEE]}>
                    <TeamView onNavigate={onTabChange} onSelectConsole={onSelectConsole} activeSubFeature={activeSubFeature} />
                </RoleProtected>
            )}

            {activeTab === 'settings' && (
                <RoleProtected moduleKey="settings" allowedRoles={[ROLES.SUPER_ADMIN, ROLES.HR_MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD, ROLES.FINANCE_MANAGER, ROLES.EMPLOYEE, ROLES.TRAINEE]}>
                    <SettingsView onNavigate={onTabChange} onSelectConsole={onSelectConsole} activeSubFeature={activeSubFeature} />
                </RoleProtected>
            )}

            {/* Platform Security & Access Control Governance Studio (Dedicated Page) */}
            {activeTab === 'access_control' && (
                <RoleProtected allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN]}>
                    <AccessControlView onNavigate={onTabChange} onSelectConsole={onSelectConsole} activeSubFeature={activeSubFeature} />
                </RoleProtected>
            )}

            {/* Nucleus AI Live Spoken Assistant Cockpit */}
            {(activeTab === 'nucleus_ai' || activeTab === 'nucleus-ai') && (
                <NucleusAiPage />
            )}

                {operationalModule && activeTab !== 'operational_reports' && (
                <RoleProtected moduleKey={operationalModule.primary} allowedRoles={[ROLES.SUPER_ADMIN, ROLES.HR_MANAGER, ROLES.FINANCE_MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD, ROLES.EMPLOYEE]}>
                    <OperationalModuleView key={operationalModule.id} module={operationalModule} onNavigate={onTabChange} />
                </RoleProtected>
            )}

            {/* Enterprise Content & Policy CMS Modal */}
            <CMSModal
                isOpen={isCMSModalOpen}
                onClose={() => setIsCMSModalOpen(false)}
            />

            {/* Enterprise Access Control & Permissions Governance Modal */}
            <AccessControlModal
                isOpen={isAccessControlOpen}
                onClose={closeAccessControl}
            />
            <NucleusActionModal
                request={actionRequest}
                onClose={() => setActionRequest(null)}
                onComplete={completeAction}
            />
                </>
            )}
        </div>
    );
};

export default MainWorkspace;
