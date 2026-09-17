"use client";
import { readData } from '@/services/workspace-data.mjs';

import { getNavigationDomains } from '@/lib/workspace-navigation';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, MessageSquare } from 'lucide-react';
import LeftDock from '@/components/Workspace/LeftDock';
import TopNav from '@/components/Workspace/TopNav';
import RightSubNav from '@/components/Workspace/RightSubNav';
import MainWorkspace from '@/components/Workspace/MainWorkspace';
import AIPanel from '@/components/Workspace/AIPanel';
import ChatPanel from '@/components/Workspace/ChatPanel';
import LoginView from '@/components/Workspace/LoginView';
import DualPaneNav from '@/components/Navigation/DualPaneNav';
import VoiceNavigator from '@/components/VoiceNavigator';
import { NucleusDock } from '@/components/Workspace/NucleusDock';
import CtcExceptionModal from '@/components/Dashboard/Modals/CtcExceptionModal';
import DataImportModal from '@/components/Workspace/DataImportModal';
import { HRMSProvider, useHRMS } from '@/context/HRMSContext';
import { useAuth } from '@/context/AuthContext';
import { getOperationalModule } from '@/lib/operational-module-registry';
import styles from '@/app/page.module.css';
import { useScrollableTables } from '@/hooks/useScrollableTables';
import { getTimeGreeting, hasPlayedDailyGreeting, markDailyGreetingPlayed, speakAloud } from '@/utils/voiceCommandEngine';
import Toast from '@/components/Workspace/Toast';
import toastStyles from '@/components/Workspace/Toast.module.css';

const NAV_STATE_KEY = 'nucleus_nav_state';

const AppContent = () => {
  const { user, isLoading, isModuleAllowed } = useAuth();
  const workspaceRef = useRef(null);
  useScrollableTables(workspaceRef, Boolean(user));
  const { toasts, removeToast, showToast } = useHRMS();

  // ── Restore last-active page from sessionStorage (cleared on logout/tab close) ──
  const savedNav = (() => {
    if (typeof window === 'undefined') return null;
    try { return JSON.parse(sessionStorage.getItem(NAV_STATE_KEY) || 'null'); } catch { return null; }
  })();

  // Active navigation states — seeded from sessionStorage when available
  const [activeDomain, setActiveDomain] = useState(
    savedNav?.activeDomain ?? readData("components.AppWorkspace", "initialState_1")
  );
  const [activeSubFeature, setActiveSubFeature] = useState(
    savedNav?.activeSubFeature ?? (user?.defaultConsole?.toLowerCase() || readData("components.AppWorkspace", "initialState_2"))
  );
  const [activeTab, setActiveTab] = useState(
    savedNav?.activeTab ?? readData("components.AppWorkspace", "initialState_3")
  );
  const [showCatalog, setShowCatalog] = useState(false);
  const [isRightNavOpen, setIsRightNavOpen] = useState(() => window.matchMedia('(min-width: 961px)').matches);
  const [searchQuery, setSearchQuery] = useState('');

  // MultipliersKraft Active Console ('S1' through 'S10')
  const [activeConsole, setActiveConsole] = useState(
    savedNav?.activeConsole ?? (user?.defaultConsole || readData("components.AppWorkspace", "initialState_4"))
  );

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

  useEffect(() => {
    const compact = window.matchMedia('(max-width: 960px)');
    const closeOnCompact = () => { if (compact.matches) setIsRightNavOpen(false); };
    compact.addEventListener('change', closeOnCompact);
    return () => compact.removeEventListener('change', closeOnCompact);
  }, []);
  
  // Mutually exclusive drawer manager ('ai' | 'chat' | null)
  const [activeFloatingDrawer, setActiveFloatingDrawer] = useState(null);
  const isAIPanelOpen = activeFloatingDrawer === 'ai';
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
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [voiceNavDetail, setVoiceNavDetail] = useState(null);
  const [isCtcModalOpen, setIsCtcModalOpen] = useState(false);
  const [ctcModalData, setCtcModalData] = useState(null);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);

  useKeyboardShortcut('m', () => setIsModulesOpen(prev => !prev), Boolean(user));
  useKeyboardShortcut('v', () => setIsVoiceModalOpen(prev => !prev), Boolean(user));

  // Global event listeners (used by openAccessControl, voice, CTC exception, bulk upload)
  useEffect(() => {
    const handleCustomNav = (e) => {
      if (e.detail) {
        setActiveTab(e.detail);
        setShowCatalog(false);
        if (e.detail === 'dashboard') setActiveDomain('dashboard');
        if (e.detail === 'access_control' || e.detail === 'settings') {
          setActiveDomain('platform');
        }
      }
    };
    const handleVoiceNav = (e) => {
      setVoiceNavDetail(e?.detail || null);
      setIsVoiceModalOpen(true);
    };
    const handleCtcException = (e) => {
      setCtcModalData(e.detail || null);
      setIsCtcModalOpen(true);
    };
    const handleBulkUpload = () => setIsBulkUploadOpen(true);

    window.addEventListener('nucleus:navigate_tab', handleCustomNav);
    window.addEventListener('nucleus:voice_navigation', handleVoiceNav);
    window.addEventListener('nucleus:open_ctc_exception', handleCtcException);
    window.addEventListener('nucleus:open_bulk_upload', handleBulkUpload);

    return () => {
      window.removeEventListener('nucleus:navigate_tab', handleCustomNav);
      window.removeEventListener('nucleus:voice_navigation', handleVoiceNav);
      window.removeEventListener('nucleus:open_ctc_exception', handleCtcException);
      window.removeEventListener('nucleus:open_bulk_upload', handleBulkUpload);
    };
  }, []);

  // Voice Greeting: Play strictly once per day when the user logs in and uses the app for the first time.
  // After that, voice narration is exclusively triggered for user actions.
  useEffect(() => {
    if (!user) return;
    const userKey = user.id || user.email || 'user';
    if (!hasPlayedDailyGreeting(userKey)) {
      markDailyGreetingPlayed(userKey);
      const greeting = getTimeGreeting(user.name);
      const timer = setTimeout(() => {
        speakAloud(greeting);
      }, 750);
      return () => clearTimeout(timer);
    }
  }, [user]);

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
      'letters_register', 'document_vault', 'policy_acknowledgements', 'lifecycle'
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

  return (
    <div ref={workspaceRef} className={styles.mainContainer} data-workspace-module={activeTab} data-workspace-console={activeConsole}>
      <div className={styles.demoNotice} role="note">{readData("components.AppWorkspace", "demoNotice")}</div>
      {/* 1. Sleek Left Vertical Icon Dock (Side Nav - Always Present) */}
      <LeftDock
        activeDomain={activeDomain}
        activeTab={activeTab}
        onSelectDomain={handleSelectDomain}
        onToggleCatalog={handleToggleCatalog}
        showCatalog={showCatalog}
      />

      {/* Main Content Area */}
      <div className={styles.mainColumn}>
        {/* 2. Clean Top Header: Global Search, Theme, Quick Actions, Profile, Modules Launcher, Console Switcher & Sub-Nav Toggle */}
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
        />

        {/* 3. Center Workspace + Contextual Right Sub-Navigation */}
        <div className={styles.bodyLayout}>
          {/* Center Workspace (Feature Catalog Grid OR Interactive Module View) */}
          <main
            className={styles.workspaceZone}
            id="main-content"
            role="main"
            aria-label={readData("components.AppWorkspace", "attribute_6")}
            style={{
              padding: isDashboard ? 'clamp(1rem, 3vw, 1.25rem) clamp(1rem, 3vw, 2rem) 5rem' : 'clamp(1rem, 3vw, 1.5rem) clamp(1rem, 3vw, 2rem) 5rem'
            }}
          >
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
            />
          </main>

          {/* Contextual Right Sub-Navigation Panel (Contextual submodules & consoles) */}
          <RightSubNav
            activeDomain={activeDomain}
            activeSubFeature={activeSubFeature}
            onSelectSubFeature={(id) => { handleSelectSubFeature(id); if (window.matchMedia('(max-width: 960px)').matches) setIsRightNavOpen(false); }}
            isOpen={isRightNavOpen}
            onClose={() => setIsRightNavOpen(false)}
          />
        </div>
      </div>

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

      {/* Floating Action Buttons Stack (Stacked vertically, never overlapping, only 1 window open at a time) */}
      {(canUseAIAssistant || canUseTeamMessages) && <div className={styles.fabStack} role="toolbar" aria-label={readData("components.AppWorkspace", "attribute_7")}>
        {/* 1. Ask AI Assistant */}
        {canUseAIAssistant && <button
          className={`${styles.fabBtn} ${styles.aiFab} ${isAIPanelOpen ? styles.fabActive : ''}`}
          onClick={() => toggleDrawer('ai')}
          title={isAIPanelOpen ? readData("components.AppWorkspace", "display_8") : readData("components.AppWorkspace", "display_9")}
          aria-label={isAIPanelOpen ? readData("components.AppWorkspace", "display_10") : readData("components.AppWorkspace", "display_11")}
          aria-expanded={isAIPanelOpen}
        >
          <Sparkles size={17} />
          <span className={styles.fabLabel}>{isAIPanelOpen ? readData("components.AppWorkspace", "display_12") : readData("components.AppWorkspace", "display_13")}</span>
        </button>}

        {/* 2. Team Messages */}
        {canUseTeamMessages && <button
          className={`${styles.fabBtn} ${styles.messagesFab} ${isChatPanelOpen ? styles.fabActive : ''}`}
          onClick={() => toggleDrawer('chat')}
          title={isChatPanelOpen ? readData("components.AppWorkspace", "display_14") : readData("components.AppWorkspace", "display_15")}
          aria-label={isChatPanelOpen ? readData("components.AppWorkspace", "display_16") : readData("components.AppWorkspace", "display_17")}
          aria-expanded={isChatPanelOpen}
        >
          <MessageSquare size={17} />
          <span className={styles.fabLabel}>{isChatPanelOpen ? readData("components.AppWorkspace", "display_18") : readData("components.AppWorkspace", "display_19")}</span>
          <span className={styles.messageBadge}>{readData("components.AppWorkspace", "copy_20")}</span>
        </button>}
      </div>}

      {/* Floating Overlay Layer (Decoupled overlay that never pushes layout flow) */}
      {(isAIPanelOpen || isChatPanelOpen) && (
        <div className={styles.floatingOverlayLayer} aria-live="polite">
          {/* Floating AI Assistant Drawer */}
          {isAIPanelOpen && (
            <AIPanel
              onClose={() => setActiveFloatingDrawer(null)}
              onNavigate={(tab, domain, sub) => {
                setActiveTab(tab);
                if (domain) setActiveDomain(domain);
                if (sub) setActiveSubFeature(sub);
                setShowCatalog(false);
              }}
              onSelectConsole={handleSelectConsole}
              onOpenModal={(modalType) => {
                if (modalType === 'ctc_exception') setIsCtcModalOpen(true);
                if (modalType === 'bulk_upload') setIsBulkUploadOpen(true);
                if (modalType === 'modules') setIsModulesOpen(true);
              }}
            />
          )}

          {/* Floating Team Messages Drawer */}
          {isChatPanelOpen && (
            <ChatPanel
              onClose={() => setActiveFloatingDrawer(null)}
            />
          )}
        </div>
      )}

      {/* Voice-Powered Natural Language Navigator */}
      <VoiceNavigator
        isOpen={isVoiceModalOpen}
        onClose={() => {
          setIsVoiceModalOpen(false);
          setVoiceNavDetail(null);
        }}
        initialDetail={voiceNavDetail}
        onNavigate={(tab, domain, sub) => {
          setActiveTab(tab);
          if (domain) setActiveDomain(domain);
          if (sub) setActiveSubFeature(sub);
          setShowCatalog(false);
        }}
        onSelectConsole={handleSelectConsole}
        onOpenModal={(modalType) => {
          if (modalType === 'ctc_exception') setIsCtcModalOpen(true);
          if (modalType === 'bulk_upload') setIsBulkUploadOpen(true);
          if (modalType === 'modules') setIsModulesOpen(true);
          if (modalType === 'copilot' || modalType === 'ai') setActiveFloatingDrawer('ai');
          if (modalType === 'chat') setActiveFloatingDrawer('chat');
        }}
      />

      {/* Floating Persistent Voice Session Dock */}
      <NucleusDock onOpenVoiceModal={() => setIsVoiceModalOpen(true)} />

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
  const { user } = useAuth();
  return (
    <HRMSProvider key={user?.email || readData("components.AppWorkspace", "fallback_1")}>
      <AppContent />
    </HRMSProvider>
  );
}
