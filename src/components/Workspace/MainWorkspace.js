"use client";
import LiveClock from '@/components/Dashboard/LiveClock';
import NucleusInsightCard from '@/components/Dashboard/NucleusInsightCard';
import GreetingHero from '@/components/Dashboard/GreetingHero';
import { cockpitCatalog } from '@/lib/cockpit-catalog';
import ScopeFilters, { DEFAULT_SCOPE } from '@/components/Dashboard/ScopeFilters';
import {useTranslation} from '@/context/I18nContext';

import NextImage from 'next/image';

import { readData } from '../../services/workspace-data.mjs';

import React, { useState, useEffect, useRef } from 'react';
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
import { avatarDataUri } from "@/lib/avatar";
import { useUiMode } from '@/context/UiModeContext';
import CoreHrWorkspace from '@/modules/core-hr/CoreHrWorkspace';
import DocumentsWorkspace from '@/modules/documents/DocumentsWorkspace';
import DashboardWorkspace from '@/modules/dashboards/DashboardWorkspace';

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
    onSelectConsole,
    onOpenNav
}) => {
  const { t } = useTranslation();
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
        openAccessControl,
        tenantAccess
    } = useAuth();
    const currentRole = authUser?.role || ROLES.SUPER_ADMIN;
    // Classic or Redesigned: a module renders its redesign only once that redesign is complete.
    const { isRedesigned } = useUiMode();
    const coreHrRedesigned = isRedesigned('core_hr');
    const dashboardsRedesigned = isRedesigned('dashboards');
    const activeProfile = ROLE_FALLBACKS[currentRole] || ROLE_FALLBACKS.SUPER_ADMIN;
    const rawName = authUser?.name || user?.name || activeProfile.name;
    const effectiveName = rawName || activeProfile.name;
    const firstName = effectiveName.split(' ')[0];
    const avatarUrl = authUser?.avatar || activeProfile.avatar;
    const [isCMSModalOpen, setIsCMSModalOpen] = useState(false);
    const [actionRequest, setActionRequest] = useState(null);
    const operationalModule = getOperationalModule(activeTab);
    const handleSetConsole = onSelectConsole;

    // Latest punch handlers, read by the voice listener below without re-subscribing on every render.
    const punchHandlersRef = useRef({ punchIn, punchOut });
    useEffect(() => {
        punchHandlersRef.current = { punchIn, punchOut };
    });

    useEffect(() => {
        const openAction = (event) => setActionRequest(event.detail);
        const handleVoicePunch = (e) => {
            if (e.detail?.type === 'OUT') {
                punchHandlersRef.current.punchOut();
            } else {
                punchHandlersRef.current.punchIn();
            }
        };
        window.addEventListener('nucleus:open-action', openAction);
        // Voice/assistant punches are handled by AttendanceFAB (the single punch control).
        return () => {
            window.removeEventListener('nucleus:open-action', openAction);
        };
    }, []);

    const activeSubmissions = useRef(new Set());
    const completeAction = async ({ action, title, values, context }) => {
        const dedupeKey = `${action}:${JSON.stringify(values || {})}`;
        if (activeSubmissions.current.has(dedupeKey)) {
            return { success: true };
        }
        activeSubmissions.current.add(dedupeKey);
        setTimeout(() => activeSubmissions.current.delete(dedupeKey), 2500);

        
        // Map dynamic action form to dedicated live backend API routes
        const endpointMap = {
            employee: '/api/v1/people',
            legal_entity: '/api/v1/organization/legal-entities',
            location: '/api/v1/organization/locations',
            position: '/api/v1/requisitions',
            document: '/api/v1/documents',
            invite: '/api/v1/invitations',
            oneOnOne: '/api/v1/checkins',
            feedback360: '/api/v1/feedback',
            okr: '/api/v1/objectives',
            wellbeing: '/api/v1/checkins',
            compCycle: '/api/v1/compensation/cycles',
            offCycleOt: '/api/v1/ot-requests',
            arrears: '/api/v1/commands/retro-arrears',
            contractor: '/api/v1/contractors/agencies',
            debitNote: '/api/v1/payroll-accounting',
            filing: '/api/v1/operations/filings',
            inspector: '/api/v1/compliance',
            apiKey: '/api/v1/webhooks/endpoints',
            connector: '/api/v1/webhooks/subscriptions',
            learningPath: '/api/v1/my-learning',
            focusBlock: '/api/v1/checkins',
            photo: '/api/v1/operations/photos',
            biometric: '/api/v1/attendance',
            returnPlan: '/api/v1/leave/early-returns',
            kudos: '/api/v1/recognition-events',
            probation: '/api/v1/checkins',
            ticket: '/api/v1/helpdesk/tickets',
            reply: '/api/v1/helpdesk/tickets',
            settings: '/api/v1/tenant/settings',
            assetReturn: '/api/v1/assets',
            clearance: '/api/v1/settlement-proposals',
            roster: '/api/v1/ops/modules/roster_schedule/records',
            leaveDecision: '/api/v1/leave-requests/decide',
            benefitLock: '/api/v1/benefits/plans',
            payrollPreview: '/api/v1/payroll-runs',
            actionReversal: '/api/v1/ai/actions',
            anomalyReview: '/api/v1/payroll-anomalies',
            offer: '/api/v1/ops/modules/offer_management/records',
            create_offer: '/api/v1/ops/modules/offer_management/records',
            offer_management: '/api/v1/ops/modules/offer_management/records',
            gate_pass: '/api/v1/gate-passes',
            gatePass: '/api/v1/gate-passes',
            leave: '/api/v1/leave-requests',
            leave_request: '/api/v1/leave-requests'
        };

        const targetEndpoint = endpointMap[action] || `/api/v1/operations/${action}`;
        let res;
        let json = null;
        try {
            res = await fetch(targetEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
                // Master-data routes validate strictly: send only the form values.
                body: JSON.stringify(targetEndpoint.startsWith('/api/v1/organization/') ? values : { action, ...values, context })
            });
            json = await res.json().catch(() => null);
        } catch {
            res = null;
        }
        if (!res || !res.ok) {
            // The server is the source of truth: never report success for a save it did not accept.
            const detail = json?.error?.message || json?.detail || json?.message
                || translateText("components.Workspace.MainWorkspace.text_save_failed", "This could not be saved. Check the details and try again.");
            showToast(title, detail, 'error');
            return { success: false, error: detail, invalidParams: json?.error?.details || json?.invalid_params };
        }

        const record = { action, title, values, context, result: json?.data ?? null, recordedAt: new Date().toISOString() };
        window.dispatchEvent(new CustomEvent('nucleus:action-completed', { detail: record }));
        if (action === 'photo' && json?.data?.photoUrl) {
            window.dispatchEvent(new CustomEvent('nucleus:profile-updated', { detail: { photoUrl: json.data.photoUrl } }));
        } else if (action === 'settings') {
            const profileRes = await fetch('/api/v1/operations/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values)
            }).catch(() => null);
            const profile = profileRes?.ok ? await profileRes.json().catch(() => null) : null;
            if (profile?.data) window.dispatchEvent(new CustomEvent('nucleus:profile-updated', { detail: profile.data }));
        }

        showToast(title, translateText("components.Workspace.MainWorkspace.text_saved", "Saved."), 'success');
        return { success: true, data: json?.data ?? null };
    };

    // Organisation scope chosen in the dashboard filter row (super admin). Announced so cockpit views can scope their queries.
    const [dashboardScope, setDashboardScopeState] = useState(DEFAULT_SCOPE);
    const setDashboardScope = (scope) => {
        setDashboardScopeState(scope);
        window.dispatchEvent(new CustomEvent('nucleus:dashboard-scope', { detail: scope }));
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

                {/* 1. OPERATIONAL HERO & QUICK ACTIONS LAUNCHPAD + NUCLEUS AI INSIGHT */}
                <div className={styles.pulseHeroRow}>
                <GreetingHero
                    persona={isEmployee ? 'employee' : isManager ? 'manager' : isExecutive ? 'executive' : 'operations'}
                    firstName={firstName}
                    roleLabel={translateText(currentRole.replace(/_/g, ' ').toLowerCase())}
                    consoleLabel={cockpitCatalog.find((cockpit) => cockpit.code === activeDashboardScreen)?.label ?? ''}
                    broadcastCount={announcements.length}
                    punchedIn={attendance.status === 'present'}
                    onNavigate={(tab) => onTabChange(tab)}
                    onOpenBroadcasts={() => setIsCMSModalOpen(true)}
                />
                <NucleusInsightCard />
                </div>

                {/* 2. ORGANISATION SCOPE FILTERS (super admin only; options from the tenant's master data) */}
                {currentRole === 'SUPER_ADMIN' && <ScopeFilters value={dashboardScope} onChange={setDashboardScope} />}

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
                                fontSize: '12.5px',
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
                                        fontSize: '12.5px',
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
                                    fontSize: '12.5px',
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
                                            <span style={{ fontSize: '12.5px', color: '#9B8CFF', fontWeight: 700, textTransform: 'uppercase' }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_109")}</span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '12.5px', color: 'var(--text-2)', marginTop: '0.2rem' }}>
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
                                    fontSize: '12.5px',
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
                                    <div style={{ fontSize: '12.5px', color: 'var(--text-2)' }}>{readData("components.Workspace.MainWorkspace", "renderDashboard_text_114")}{p.lead}</div>
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
        talent: 'talent',
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
                    {activeTab !== 'dashboard' && activeTab !== 'documents' && (
                        <div className={styles.breadcrumbBar} aria-label={t("components.Workspace.MainWorkspace.aria-label_breadcrumb", "Breadcrumb")}>
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
                    {activeTab === 'dashboard' && dashboardsRedesigned && (
                        <DashboardWorkspace
                            activeConsole={activeDashboardScreen}
                            permittedConsoles={permittedConsoleIds}
                            onSelectConsole={handleSetConsole}
                            onNavigate={onTabChange}
                            onOpenNav={onOpenNav}
                            userName={effectiveName}
                            announcements={announcements}
                            onOpenAnnouncements={() => setIsCMSModalOpen(true)}
                            personal={supportsPersonalDashboard ? <PersonalDashboard key={`${authUser?.email}:${activeDashboardScreen}`} consoleId={activeDashboardScreen} onNavigate={onTabChange} onShowConsole={() => {}} /> : null}
                        />
                    )}
                    {activeTab === 'dashboard' && !dashboardsRedesigned && <>{supportsPersonalDashboard && !personalDashboard && <button style={{ margin: '12px 0', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--signal)', cursor: 'pointer' }} onClick={() => setPersonalDashboard(true)}>{translateText("components.Workspace.MainWorkspace","text_e53d7af293")}</button>}{renderDashboard()}</>}

            {/* Documents: the library by company, department and person (access decided by the API) */}
            {activeTab === 'documents' && <DocumentsWorkspace organisation={tenantAccess?.tenant?.name} />}

            {/* Module 1: People Core */}
            {activeTab === 'people_core' && (
                <RoleProtected moduleKey="people_core" allowedRoles={[ROLES.SUPER_ADMIN, ROLES.HR_MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD, ROLES.EMPLOYEE]}>
                    {coreHrRedesigned
                        ? <CoreHrWorkspace tab="people_core" activeSubFeature={activeSubFeature} />
                        : <PeopleCoreView onNavigate={onTabChange} onSelectConsole={onSelectConsole} activeSubFeature={activeSubFeature} />}
                </RoleProtected>
            )}

            {/* Module 2: Global Payroll & EWA */}
            {activeTab === 'payroll' && (
                <RoleProtected moduleKey="payroll" allowedRoles={[ROLES.SUPER_ADMIN, ROLES.FINANCE_MANAGER, ROLES.HR_MANAGER, ROLES.EMPLOYEE, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD]}>
                    <PayrollView onNavigate={onTabChange} onSelectConsole={onSelectConsole} activeSubFeature={activeSubFeature} />
                </RoleProtected>
            )}

            {/* Module 3: Talent Acquisition / ATS */}
            {(activeTab === 'recruitment' || activeTab === 'talent') && (
                <RoleProtected moduleKey="recruitment" allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD, ROLES.EMPLOYEE]}>
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
                    {coreHrRedesigned
                        ? <CoreHrWorkspace tab="team" activeSubFeature={activeSubFeature} />
                        : <TeamView onNavigate={onTabChange} onSelectConsole={onSelectConsole} activeSubFeature={activeSubFeature} />}
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
                showToast={showToast}
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
