"use client";

import { useTranslation } from '@/context/I18nContext';
import { readData } from '@/services/workspace-data.mjs';

import { getNavigationDomains } from '@/lib/workspace-navigation';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import React, { useState, useEffect, useRef } from 'react';
import LeftDock from '@/components/Workspace/LeftDock';
import TopNav from '@/components/Workspace/TopNav';
import TopBar from '@/modules/shell/TopBar';
import { SideRail, SidePanel } from '@/modules/shell/SideNav';
import FlagNotices from '@/modules/shell/FlagNotices';
import { navTarget } from '@/modules/shell/navigation';
import { useUiMode } from '@/context/UiModeContext';
import { redesignedModuleForTab } from '@/lib/ui-mode';
import RightSubNav from '@/components/Workspace/RightSubNav';
import Breadcrumb from '@/components/Workspace/Breadcrumb';
import AlertBanner from '@/components/Workspace/AlertBanner';
import AttendanceFAB from '@/components/Workspace/AttendanceFAB';
import MainWorkspace from '@/components/Workspace/MainWorkspace';
import ModuleNotEnabled from '@/components/Entitlements/ModuleNotEnabled';
import { entitlementForNavItem, entitlementForTab } from '@/lib/entitlements/routes';
import { entitlementLabel } from '@/lib/entitlements/tree';
import QuantumCopilot from '@/components/AI/QuantumCopilot';
import AssistantDock from '@/modules/assistant/AssistantDock';
import ChatPanel from '@/components/Workspace/ChatPanel';
import LoginView from '@/components/Workspace/LoginView';
import DualPaneNav from '@/components/Navigation/DualPaneNav';
import CtcExceptionModal from '@/components/Dashboard/Modals/CtcExceptionModal';
import DataImportModal from '@/components/Workspace/DataImportModal';
import { HRMSProvider, useHRMS } from '@/context/HRMSContext';
import { useAuth } from '@/context/AuthContext';
import { getOperationalModule } from '@/lib/operational-module-registry';
import styles from '@/app/page.module.css';
import { useScrollableTables } from '@/hooks/useScrollableTables';
import Toast from '@/components/Workspace/Toast';
import toastStyles from '@/components/Workspace/Toast.module.css';

import { usePathname, useRouter } from 'next/navigation';

const NAV_STATE_KEY = 'nucleus_nav_state';

/** Redesigned modules whose screens fit the viewport (tables scroll inside their panels). */
const FIT_MODULES = new Set(['core_hr', 'documents']);

// Route-to-Tab dictionary for direct URLs like /people, /leave, /attendance, /payroll
const ROUTE_MODULE_MAP = {
  people: { tab: 'people_core', domain: 'people', sub: 'core_people' },
  directory: { tab: 'people_core', domain: 'people', sub: 'directory' },
  employees: { tab: 'people_core', domain: 'people', sub: 'core_people' },
  leave: { tab: 'leaves', domain: 'workforce_ops', sub: 'core_leaves' },
  leaves: { tab: 'leaves', domain: 'workforce_ops', sub: 'core_leaves' },
  attendance: { tab: 'attendance', domain: 'workforce_ops', sub: 'core_attendance' },
  roster: { tab: 'attendance', domain: 'workforce_ops', sub: 'ops_rosters' },
  payroll: { tab: 'payroll', domain: 'payroll_finance', sub: 'payroll_global' },
  payslips: { tab: 'payroll', domain: 'payroll_finance', sub: 'payslips' },
  loans: { tab: 'payroll', domain: 'payroll_finance', sub: 'loans' },
  onboarding: { tab: 'onboarding', domain: 'people', sub: 'core_onboarding' },
  lifecycle: { tab: 'onboarding', domain: 'people', sub: 'lifecycle' },
  organization: { tab: 'team', domain: 'people', sub: 'core_org' },
  team: { tab: 'team', domain: 'people', sub: 'teams' },
  recruitment: { tab: 'recruitment', domain: 'talent', sub: 'talent_ats' },
  talent: { tab: 'recruitment', domain: 'talent', sub: 'talent_ats' },
  performance: { tab: 'performance', domain: 'talent', sub: 'talent_performance' },
  learning: { tab: 'learning', domain: 'talent', sub: 'talent_learning' },
  experience: { tab: 'experience', domain: 'talent', sub: 'talent_experience' },
  settings: { tab: 'settings', domain: 'platform', sub: 'platform_integrations' },
  integrations: { tab: 'integrations', domain: 'platform', sub: 'platform_integrations' },
  compliance: { tab: 'compliance', domain: 'platform', sub: 'core_compliance' },
  access_control: { tab: 'access_control', domain: 'platform', sub: 'platform_access_control' },
  analytics: { tab: 'analytics', domain: 'analytics_ai', sub: 'analytics_exec' },
  insights: { tab: 'analytics', domain: 'analytics_ai', sub: 'analytics_exec' },
  helpdesk: { tab: 'helpdesk', domain: 'platform', sub: 'core_operations' },
  contract_workforce: { tab: 'contract_workforce', domain: 'core_hr', sub: 'core_workforce' },
  documents: { tab: 'documents', domain: 'documents', sub: 'documents' },
  document_vault: { tab: 'documents', domain: 'documents', sub: 'documents' },
};

const AppContent = () => {
  const { t } = useTranslation();
  const { user, isLoading, isModuleAllowed, isEntitled, tenantAccess } = useAuth();
  // Redesigned shell (top bar, navigation, floating buttons): Redesigned mode only.
  const { isRedesigned } = useUiMode();
  // Pulse is the only shell; the redesigned shell from v2 stays switched off.
  const shellRedesigned = false;
  const pathname = usePathname();
  const router = useRouter();
  const workspaceRef = useRef(null);
  useScrollableTables(workspaceRef, Boolean(user));
  const { toasts, removeToast, showToast } = useHRMS();

  // ── Restore last-active page from URL first, then sessionStorage ──
  const initialSegment = typeof window !== 'undefined'
    ? window.location.pathname.replace(/^\//, '').split('/')[0].toLowerCase()
    : '';
  const initialMapped = ROUTE_MODULE_MAP[initialSegment];

  const savedNav = (() => {
    if (typeof window === 'undefined') return null;
    try { return JSON.parse(sessionStorage.getItem(NAV_STATE_KEY) || 'null'); } catch { return null; }
  })();

  // Active navigation states — seeded from current route URL first, then sessionStorage
  const [activeDomain, setActiveDomain] = useState(
    initialMapped?.domain ?? savedNav?.activeDomain ?? readData("components.AppWorkspace", "initialState_1")
  );
  const [activeSubFeature, setActiveSubFeature] = useState(
    initialMapped?.sub ?? savedNav?.activeSubFeature ?? (user?.defaultConsole?.toLowerCase() || readData("components.AppWorkspace", "initialState_2"))
  );
  const [activeTab, setActiveTab] = useState(
    initialMapped?.tab ?? savedNav?.activeTab ?? readData("components.AppWorkspace", "initialState_3")
  );
  const [showCatalog, setShowCatalog] = useState(false);
  const [isRightNavOpen, setIsRightNavOpen] = useState(() => window.matchMedia('(min-width: 961px)').matches);
  const [searchQuery, setSearchQuery] = useState('');
  // Active company chosen in the header switcher (server-validated); passed to the assistant as context.
  const [activeCompanyId, setActiveCompanyId] = useState(null);
  useEffect(() => {
    const onEntity = (event) => {
      const selection = event?.detail?.selection;
      setActiveCompanyId(selection && typeof selection === 'object' && selection.companyId ? selection.companyId : null);
    };
    window.addEventListener('nucleus:active-entity-changed', onEntity);
    return () => window.removeEventListener('nucleus:active-entity-changed', onEntity);
  }, []);

  // MultipliersKraft Active Console ('S1' through 'S10')
  const [activeConsole, setActiveConsole] = useState(
    savedNav?.activeConsole ?? (user?.defaultConsole || readData("components.AppWorkspace", "initialState_4"))
  );

  // The path this workspace last wrote to the address bar itself (see below); not a navigation to follow.
  const ownPathRef = useRef(null);

  // Sync state when URL pathname changes (e.g. browser back/forward or router.push)
  useEffect(() => {
    if (!pathname || pathname === '/workspace' || pathname === '/login') return;
    // Reflecting the open screen in the URL must not reset the area and screen the person chose.
    if (pathname === ownPathRef.current) { ownPathRef.current = null; return; }
    const segment = pathname.replace(/^\//, '').split('/')[0].toLowerCase();
    const mapped = ROUTE_MODULE_MAP[segment];
    if (mapped) {
      setActiveTab(mapped.tab);
      setActiveDomain(mapped.domain);
      setActiveSubFeature(mapped.sub);
      setShowCatalog(false);
    }
  }, [pathname]);

  // Persist nav state to sessionStorage on every navigation change
  useEffect(() => {
    if (!user) return;
    try {
      sessionStorage.setItem(NAV_STATE_KEY, JSON.stringify({
        activeDomain,
        activeSubFeature,
        activeTab,
        activeConsole,
      }));
    } catch { /* Storage unavailable */ }
  }, [activeDomain, activeSubFeature, activeTab, activeConsole, user]);

  // Cleanly reflect active module in browser URL
  useEffect(() => {
    if (typeof window === 'undefined' || !activeTab) return;
    const tabToPath = {
      people_core: '/people',
      leaves: '/leave',
      attendance: '/attendance',
      payroll: '/payroll',
      onboarding: '/onboarding',
      team: '/organization',
      recruitment: '/recruitment',
      performance: '/performance',
      learning: '/learning',
      experience: '/experience',
      settings: '/settings',
      integrations: '/integrations',
      compliance: '/compliance',
      access_control: '/access_control',
      analytics: '/analytics',
      helpdesk: '/helpdesk',
      contract_workforce: '/contract_workforce',
      documents: '/documents',
      dashboard: '/workspace',
    };
    const targetUrl = tabToPath[activeTab];
    if (targetUrl && window.location.pathname !== targetUrl && window.location.pathname !== '/login') {
      ownPathRef.current = targetUrl;
      window.history.replaceState(null, '', targetUrl);
    }
  }, [activeTab]);

  useEffect(() => {
    const compact = window.matchMedia('(max-width: 960px)');
    const closeOnCompact = () => { if (compact.matches) setIsRightNavOpen(false); };
    compact.addEventListener('change', closeOnCompact);
    return () => compact.removeEventListener('change', closeOnCompact);
  }, []);
  
  // Mutually exclusive drawer manager ('chat' | null)
  const [activeFloatingDrawer, setActiveFloatingDrawer] = useState(null);
  const isChatPanelOpen = activeFloatingDrawer === 'chat';

  // Handle switching consoles (connected across TopNav, MainWorkspace, DualPaneNav, and RightSubNav)
  const handleSelectConsole = (consoleId) => {
    setActiveConsole(consoleId);
    setActiveTab('dashboard');
    setActiveDomain('dashboard');
    setActiveSubFeature(consoleId.toLowerCase());
    setShowCatalog(false);
  };

  // Dual-Pane Navigation Modal state (Modules Left, Sub-modules Right)
  const [isModulesOpen, setIsModulesOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isCtcModalOpen, setIsCtcModalOpen] = useState(false);
  const [ctcModalData, setCtcModalData] = useState(null);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);

  useKeyboardShortcut('m', () => setIsModulesOpen(prev => !prev), Boolean(user));
  useKeyboardShortcut('v', () => setIsCopilotOpen(prev => !prev), Boolean(user));

  // Global event listeners (used by openAccessControl, voice, CTC exception, bulk upload)
  useEffect(() => {
    const handleCustomNav = (e) => {
      if (e.detail) {
        const target = String(e.detail);
        const mapped = ROUTE_MODULE_MAP[target.toLowerCase()];
        if (mapped) {
          setActiveTab(mapped.tab);
          setActiveDomain(mapped.domain);
          setActiveSubFeature(mapped.sub);
        } else {
          setActiveTab(target);
          if (target === 'dashboard') setActiveDomain('dashboard');
          if (target === 'access_control' || target === 'settings') {
            setActiveDomain('platform');
          }
        }
        setShowCatalog(false);
      }
    };
    const handleVoiceNav = () => {
      setIsCopilotOpen(true);
    };
    const handleCtcException = (e) => {
      setCtcModalData(e.detail || null);
      setIsCtcModalOpen(true);
    };
    const handleBulkUpload = () => setIsBulkUploadOpen(true);

    window.addEventListener('nucleus:navigate_tab', handleCustomNav);
    window.addEventListener('nucleus:voice_navigation', handleVoiceNav);
    window.addEventListener('nucleus:open_copilot', handleVoiceNav);
    window.addEventListener('nucleus:open_ctc_exception', handleCtcException);
    window.addEventListener('nucleus:open_bulk_upload', handleBulkUpload);

    return () => {
      window.removeEventListener('nucleus:navigate_tab', handleCustomNav);
      window.removeEventListener('nucleus:voice_navigation', handleVoiceNav);
      window.removeEventListener('nucleus:open_copilot', handleVoiceNav);
      window.removeEventListener('nucleus:open_ctc_exception', handleCtcException);
      window.removeEventListener('nucleus:open_bulk_upload', handleBulkUpload);
    };
  }, []);

  const toggleDrawer = (drawerType) => {
    setActiveFloatingDrawer((prev) => (prev === drawerType ? null : drawerType));
  };

  if (isLoading) return <div className={styles.loading}>{readData("components.AppWorkspace", "copy_5")}</div>;

  if (!user) {
    return <LoginView />;
  }

  const canUseAIAssistant = isModuleAllowed('analytics', user.role, user.id || user.email);
  const canUseTeamMessages = isModuleAllowed('team', user.role, user.id || user.email);

  // Handle selecting a domain from LeftDock
  const handleSelectDomain = (domainId) => {
    setActiveDomain(domainId);
    if (domainId === 'dashboard') {
      setShowCatalog(false);
      setActiveTab('dashboard');
      setActiveSubFeature(activeConsole.toLowerCase());
      return;
    }
    if (domainId === 'documents') {
      setShowCatalog(false);
      setActiveTab('documents');
      setActiveSubFeature('documents');
      return;
    }

    // Default tab per domain matching 6 Primary Categories
    const domainDefaults = {
      core_hr: { tab: 'people_core', sub: 'core_people' },
      people: { tab: 'people_core', sub: 'core_people' },
      talent: { tab: 'recruitment', sub: 'talent_ats' },
      payroll_finance: { tab: 'payroll', sub: 'payroll_global' },
      payroll: { tab: 'payroll', sub: 'payroll_global' },
      workforce_ops: { tab: 'attendance', sub: 'ops_rosters' },
      analytics_ai: { tab: 'analytics', sub: 'analytics_exec' },
      analytics: { tab: 'analytics', sub: 'analytics_exec' },
      platform: { tab: 'settings', sub: 'platform_integrations' },
      settings: { tab: 'settings', sub: 'platform_integrations' }
    };

    const target = domainDefaults[domainId] || { tab: 'dashboard', sub: '' };
    setActiveTab(target.tab);
    setActiveSubFeature(target.sub);
    setShowCatalog(false);
    setIsRightNavOpen(true);
  };

  // Toggle Feature Catalog view
  const handleToggleCatalog = () => {
    setShowCatalog((prev) => !prev);
  };

  // Handle selecting an item from the contextual RightSubNav
  const handleSelectSubFeature = (subFeatureId) => {
    setActiveSubFeature(subFeatureId);
    setShowCatalog(false);

    // The document library: one screen of its own
    if (['documents', 'document_vault', 'my_documents'].includes(subFeatureId)) {
      setActiveTab('documents');
      setActiveDomain('documents');
      return;
    }

    // AI Copilot special action
    if (subFeatureId === 'analytics_copilot') {
      setActiveFloatingDrawer('ai');
      return;
    }

    // MultipliersKraft Consoles (s1 through s10)
    if (/^s(10|[1-9])$/i.test(subFeatureId)) {
      handleSelectConsole(subFeatureId.toUpperCase());
      return;
    }

    // 1. Smart Attendance & Shifts
    const attendanceItems = [
      'attendance', 'core_attendance', 'check_in_out', 'my_attendance', 'attendance_detail',
      'gate_passes', 'gate_pass', 'overtime_register', 'attendance_exceptions', 'recompute_monitor',
      'team_history', 'ops_rosters', 'ops_field', 'monthly_ledger', 'time_office_ledger', 'worker_categories'
    ];
    if (attendanceItems.includes(subFeatureId) || subFeatureId.startsWith('attendance')) {
      setActiveTab('attendance');
      return;
    }

    // 2. Leave Management
    const leaveItems = [
      'leaves', 'core_leaves', 'leave_requests', 'leave_ledger', 'leave_policy_admin',
      'early_return_recredit', 'policy_matrix', 'comp_off_clock'
    ];
    if (leaveItems.includes(subFeatureId) || subFeatureId.startsWith('leave')) {
      setActiveTab('leaves');
      return;
    }

    // 3. Payroll & Finance
    const payrollItems = [
      'payroll', 'payroll_global', 'payroll_claims', 'payroll_ewa', 'payroll_accounting',
      'payroll_fnf', 'payroll_runs', 'pre_payroll_audit', 'salary_simulator', 'payslips',
      'gl_mapping', 'loans_advances', 'loans', 'full_and_final', 'fnf', 'fnf_settlement',
      'reimbursements', 'offcycle', 'scoping'
    ];
    if (payrollItems.includes(subFeatureId) || subFeatureId.startsWith('payroll')) {
      setActiveTab('payroll');
      return;
    }

    // 4. People Core & Employee Master
    const peopleItems = [
      'people_core', 'core_people', 'person_record', 'assignment_admin', 'legal_entity',
      'entities', 'location_master', 'locations', 'directory', 'star_employees', 'people_classification'
    ];
    if (peopleItems.includes(subFeatureId) || subFeatureId.startsWith('people')) {
      setActiveTab('people_core');
      return;
    }

    // 5. Onboarding & Lifecycle
    const onboardingItems = [
      'onboarding', 'core_onboarding', 'joining_chain', 'clearance_board', 'asset_register',
      'letters_register', 'policy_acknowledgements', 'lifecycle'
    ];
    if (onboardingItems.includes(subFeatureId) || subFeatureId.startsWith('onboarding')) {
      setActiveTab('onboarding');
      return;
    }

    // 6. Organization & Workforce
    const orgItems = [
      'team', 'teams', 'core_org', 'position_register', 'sanctioned_strength', 'positions', 'org_chart', 'orgchart'
    ];
    if (orgItems.includes(subFeatureId)) {
      setActiveTab('team');
      return;
    }

    // 7. Talent & Recruitment
    if (subFeatureId === 'talent_ats' || subFeatureId === 'talent_mobility' || subFeatureId.startsWith('recruitment')) {
      setActiveTab('recruitment');
      return;
    }

    // 8. Performance
    if (subFeatureId === 'talent_performance' || subFeatureId === 'talent_succession' || subFeatureId.startsWith('performance')) {
      setActiveTab('performance');
      return;
    }

    // 9. Learning
    if (subFeatureId === 'talent_learning' || subFeatureId.startsWith('learning')) {
      setActiveTab('learning');
      return;
    }

    // 10. Experience
    if (subFeatureId === 'talent_skills' || subFeatureId === 'talent_recognition' || subFeatureId.startsWith('experience')) {
      setActiveTab('experience');
      return;
    }

    // 11. Compliance & Statutory
    if (subFeatureId === 'core_compliance' || subFeatureId === 'payroll_tax' || subFeatureId.startsWith('compliance')) {
      setActiveTab('compliance');
      return;
    }

    // 12. Helpdesk
    if (subFeatureId === 'core_operations' || subFeatureId.startsWith('helpdesk')) {
      setActiveTab('helpdesk');
      return;
    }

    // 13. Contract Workforce
    if (subFeatureId === 'core_workforce' || subFeatureId === 'ops_contract' || subFeatureId.startsWith('contract')) {
      setActiveTab('contract_workforce');
      return;
    }

    // 14. Platform Governance & Access Control
    if (subFeatureId === 'platform_access_control' || subFeatureId === 'access_control' || subFeatureId === 'access_scope') {
      setActiveTab('access_control');
      return;
    }
    if (subFeatureId === 'platform_integrations' || subFeatureId.startsWith('integration')) {
      setActiveTab('integrations');
      return;
    }
    if (subFeatureId.startsWith('platform') || subFeatureId.startsWith('setting')) {
      setActiveTab('settings');
      return;
    }

    // Dedicated operational module fallback if not caught by rich views
    if (getOperationalModule(subFeatureId)) {
      setActiveTab(subFeatureId);
      return;
    }

    const item = getNavigationDomains().flatMap(domain => domain.groups.flatMap(group => group.items)).find(item => item.id === subFeatureId);
    if (item?.targetTab) { setActiveTab(item.targetTab); return; }

    setActiveTab(subFeatureId);
  };

  // Handle selecting a feature card from CatalogGridView
  const handleSelectCatalogFeature = (targetTab, domain, itemId) => {
    if (itemId) {
      setActiveDomain(domain); setShowCatalog(false); handleSelectSubFeature(itemId); return;
    }
    setActiveTab(targetTab);
    if (domain) {
      setActiveDomain(domain);
    }
    setActiveSubFeature(targetTab);
    setShowCatalog(false);
  };

  // Handle search input changes in TopNav
  const handleSearchChange = (query) => {
    setSearchQuery(query);
    if (query && !showCatalog) {
      setShowCatalog(true);
    }
  };

  const isDashboard = activeTab === 'dashboard';
  // Screens that stand alone: no list of screens beside them.
  const isSingleScreen = isDashboard || activeTab === 'documents';
  // Redesigned modules laid out to fit the viewport: their tables scroll, the page does not.
  const fitModule = redesignedModuleForTab(activeTab);
  const fitsViewport = Boolean(fitModule && FIT_MODULES.has(fitModule) && isRedesigned(fitModule) && !showCatalog);

  // Opens a navigation item (navigation.catalog.json id) the same way the menus do.
  const openNavItem = (navId) => {
    const target = navTarget(navId);
    handleSelectSubFeature(navId);
    if (target) setActiveDomain(target.domain);
    setShowCatalog(false);
  };

  // The view's module (from the tab) and, when the selected navigation item opens this view, the
  // sub-module or feature behind that item. Either being outside the organisation's plan blocks it.
  const navTargetTab = getNavigationDomains().flatMap((domain) => domain.groups.flatMap((group) => group.items))
    .find((item) => item.id === activeSubFeature)?.targetTab;
  const blockedKey = [entitlementForTab(activeTab), navTargetTab === activeTab ? entitlementForNavItem(activeSubFeature) : null]
    .find((key) => key && !isEntitled(key)) ?? null;

  
  return (
    <div ref={workspaceRef} className={styles.mainContainer} data-workspace-module={activeTab} data-workspace-console={activeConsole}>
      {/* Pulse frame: sticky header / (left rail | page | right rail) / sticky footer */}
        {/* 2. Clean Top Header: Global Search, Theme, Quick Actions, Profile, Modules Launcher, Console Switcher & Sub-Nav Toggle */}
        {shellRedesigned ? (
          <TopBar
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            onTabChange={(tab, domain, sub) => {
              setActiveTab(tab);
              if (domain) setActiveDomain(domain);
              else if (tab === 'dashboard') setActiveDomain('dashboard');
              if (sub) setActiveSubFeature(sub);
              setShowCatalog(false);
            }}
            openNav={openNavItem}
            onOpenAssistant={canUseAIAssistant ? () => setIsCopilotOpen((prev) => !prev) : undefined}
            onToggleMessages={canUseTeamMessages ? () => toggleDrawer('chat') : undefined}
            assistantOpen={isCopilotOpen}
            messagesOpen={isChatPanelOpen}
            onOpenModules={() => setIsModulesOpen(true)}
            onShowScreens={!isSingleScreen && !isRightNavOpen ? () => setIsRightNavOpen(true) : undefined}
          />
        ) : (
        <TopNav
          activeTab={activeTab}
          onTabChange={(tab, domain, sub) => {
            setActiveTab(tab);
            if (domain) setActiveDomain(domain);
            else if (tab === 'dashboard') setActiveDomain('dashboard');
            if (sub) setActiveSubFeature(sub);
            setShowCatalog(false);
          }}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          isRightNavOpen={isRightNavOpen}
          onToggleRightNav={() => setIsRightNavOpen((prev) => !prev)}
          onToggleModules={() => setIsModulesOpen((prev) => !prev)}
          isModulesOpen={isModulesOpen}
          activeConsole={activeConsole}
          onSelectConsole={handleSelectConsole}
          onToggleMessages={canUseTeamMessages ? () => toggleDrawer('chat') : undefined}
          isMessagesOpen={isChatPanelOpen}
        />
        )}

        {/* 3. Center Workspace + Contextual Right Sub-Navigation */}
        <div className={styles.bodyLayout}>
        {/* 1. Sleek Left Vertical Icon Dock (Side Nav - Always Present) */}
        <LeftDock
          activeDomain={activeDomain}
          activeTab={activeTab}
          onSelectDomain={handleSelectDomain}
          onToggleCatalog={handleToggleCatalog}
          showCatalog={showCatalog}
        />
          {/* Center Workspace (Feature Catalog Grid OR Interactive Module View) */}
          {/* Contextual sub-navigation (placed beside the left rail) (Contextual submodules & consoles) */}
          <RightSubNav
            key={activeDomain}
            activeDomain={activeDomain}
            activeSubFeature={activeSubFeature}
            onSelectSubFeature={(id) => handleSelectSubFeature(id)}
            isOpen
          />

          <main
            className={styles.workspaceZone}
            id="main-content"
            role="main"
            aria-label={readData("components.AppWorkspace", "attribute_6")}
            data-fit={fitsViewport && !blockedKey ? 'true' : undefined}
          >
            <AlertBanner />
            <Breadcrumb
              activeDomain={activeDomain}
              activeSubFeature={activeSubFeature}
              onHome={() => handleSelectDomain('dashboard')}
              onDomain={(domainId) => handleSelectDomain(domainId)}
            />
            {/* Warnings and alerts on the person's own record and their team's, after signing in */}
            <FlagNotices />
            {blockedKey ? (
              <ModuleNotEnabled
                label={entitlementLabel(blockedKey)}
                tenantName={tenantAccess?.tenant?.name}
                onBack={() => { setActiveTab('dashboard'); setActiveDomain('dashboard'); }}
              />
            ) : (
            <MainWorkspace
              activeTab={activeTab}
              activeSubFeature={activeSubFeature}
              onTabChange={(tab, domain, sub) => {
                if (tab === 'dashboard' && sub && /^s(10|[1-9])$/i.test(sub)) {
                  handleSelectConsole(sub.toUpperCase());
                  return;
                }
                setActiveTab(tab);
                if (domain) setActiveDomain(domain);
                else if (tab === 'dashboard') setActiveDomain('dashboard');
                if (sub) setActiveSubFeature(sub);
                setShowCatalog(false);
              }}
              showCatalog={showCatalog}
              onToggleCatalog={handleToggleCatalog}
              activeDomain={activeDomain}
              onSelectDomain={handleSelectDomain}
              searchQuery={searchQuery}
              activeConsole={activeConsole}
              onSelectConsole={handleSelectConsole}
              onOpenNav={openNavItem}
            />
            )}
          </main>

        </div>

        <footer className={styles.pulseFooter} role="contentinfo">
          <span className={styles.pulseFooterStatus}><i aria-hidden="true" />{t("components.AppWorkspace.text_footer_connected", "Connected · live transactions")}</span>
          <span>{t("components.AppWorkspace.text_footer_engine", "Enterprise production · Neon PostgreSQL DB engine")}</span>
        </footer>

      {/* Dual-Pane Navigation Modal (Modules on Left, Sub-modules on Right) */}
      <DualPaneNav
        isOpen={isModulesOpen}
        onClose={() => setIsModulesOpen(false)}
        activeTab={activeTab}
        activeConsole={activeConsole}
        onSelectConsole={handleSelectConsole}
        onSelectTab={(targetTab, domainId, subId) => {
          handleSelectSubFeature(subId || targetTab);
          if (domainId) setActiveDomain(domainId);
          setShowCatalog(false);
          setIsModulesOpen(false);
        }}
      />

      {/* Single punch control (real attendance API) */}
      <AttendanceFAB />

      {/* Floating Overlay Layer for Chat */}
      {isChatPanelOpen && (
        <div className={styles.floatingOverlayLayer} aria-live="polite">
          <ChatPanel onClose={() => setActiveFloatingDrawer(null)} />
        </div>
      )}

      {/* Redesigned shell: the assistant pill (bottom centre, movable), floating card or right-docked panel */}
      {shellRedesigned && canUseAIAssistant && (
        <AssistantDock
          open={isCopilotOpen}
          onOpenChange={setIsCopilotOpen}
          activeTab={activeTab}
          onNavigate={(tab) => { setActiveTab(tab); setShowCatalog(false); }}
        />
      )}

      {/* Revolutionary Multimodal Neural HUD */}
      {canUseAIAssistant && <QuantumCopilot
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        shortcutEnabled={!shellRedesigned}
        activeCompanyId={activeCompanyId}
        activeSub={activeSubFeature}
        activeDomain={activeDomain}
        activeTab={activeTab}
        onNavigate={(tab, domain, sub) => {
          setActiveTab(tab);
          if (domain) setActiveDomain(domain);
          if (sub) setActiveSubFeature(sub);
          setShowCatalog(false);
        }}
      />}

      {/* Talent CTC Exception Approval Modal */}
      <CtcExceptionModal
        isOpen={isCtcModalOpen}
        onClose={() => setIsCtcModalOpen(false)}
        requestData={ctcModalData}
      />

      {/* Enterprise Bulk Data Upload Modal */}
      <DataImportModal
        isOpen={isBulkUploadOpen}
        onClose={() => setIsBulkUploadOpen(false)}
      />

      {/* Global Toast Notifications */}
      <div className={toastStyles.toastContainer} aria-live="polite">
        {toasts.map(t => (
          <Toast key={t.id} {...t} onClose={removeToast} />
        ))}
      </div>
    </div>
  );
};

export default function Home() {
    const { t } = useTranslation();
  const { user } = useAuth();
  return (
    <HRMSProvider key={user?.email || readData("components.AppWorkspace", "fallback_1")}>
      <AppContent />
    </HRMSProvider>
  );
}
