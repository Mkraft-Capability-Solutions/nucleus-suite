"use client";
import { readData } from '@/services/workspace-data.mjs';

import { navigationDomains } from '@/lib/workspace-navigation';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, MessageSquare } from 'lucide-react';
import LeftDock from '@/components/Clerio/LeftDock';
import TopNav from '@/components/Clerio/TopNav';
import RightSubNav from '@/components/Clerio/RightSubNav';
import MainWorkspace from '@/components/Clerio/MainWorkspace';
import AIPanel from '@/components/Clerio/AIPanel';
import ChatPanel from '@/components/Clerio/ChatPanel';
import LoginView from '@/components/Clerio/LoginView';
import DualPaneNav from '@/components/Navigation/DualPaneNav';
import { HRMSProvider, useHRMS } from '@/context/HRMSContext';
import { useAuth } from '@/context/AuthContext';
import { getOperationalModule } from '@/lib/operational-module-registry';
import styles from '@/app/page.module.css';
import { useScrollableTables } from '@/hooks/useScrollableTables';
import Toast from '@/components/Clerio/Toast';
import toastStyles from '@/components/Clerio/Toast.module.css';

const AppContent = () => {
  const { user, isLoading, isModuleAllowed } = useAuth();
  const workspaceRef = useRef(null);
  useScrollableTables(workspaceRef, Boolean(user));
  const { toasts, removeToast, showToast } = useHRMS();

  // Active navigation states
  const [activeDomain, setActiveDomain] = useState(readData("components.AppWorkspace", "initialState_1"));
  const [activeSubFeature, setActiveSubFeature] = useState(readData("components.AppWorkspace", "initialState_2"));
  const [activeTab, setActiveTab] = useState(readData("components.AppWorkspace", "initialState_3"));
  const [showCatalog, setShowCatalog] = useState(false);
  const [isRightNavOpen, setIsRightNavOpen] = useState(() => window.matchMedia('(min-width: 961px)').matches);
  const [searchQuery, setSearchQuery] = useState('');
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

  // MultipliersKraft Active Console ('S1' through 'S10')
  const [activeConsole, setActiveConsole] = useState(user?.defaultConsole || readData("components.AppWorkspace", "initialState_4"));

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

  useKeyboardShortcut('m', () => setIsModulesOpen(prev => !prev), Boolean(user));

  // Global tab navigation event listener (used by openAccessControl and external triggers)
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
    window.addEventListener('nucleus:navigate_tab', handleCustomNav);
    return () => window.removeEventListener('nucleus:navigate_tab', handleCustomNav);
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

    // Dedicated operational workspaces are addressed by their sub-module id.
    if (getOperationalModule(subFeatureId)) {
      setActiveTab(subFeatureId);
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

    const item = navigationDomains.flatMap(domain => domain.groups.flatMap(group => group.items)).find(item => item.id === subFeatureId);
    if (item?.targetTab) { setActiveTab(item.targetTab); return; }

    // 1. Core HR
    if (subFeatureId === 'core_people') setActiveTab('people_core');
    else if (subFeatureId === 'core_attendance') setActiveTab('attendance');
    else if (subFeatureId === 'core_leaves') setActiveTab('leaves');
    else if (subFeatureId === 'core_onboarding') setActiveTab('onboarding');
    else if (subFeatureId === 'core_org') setActiveTab('team');
    else if (subFeatureId === 'core_workforce') setActiveTab('contract_workforce');
    else if (subFeatureId === 'core_operations') setActiveTab('helpdesk');
    else if (subFeatureId === 'core_compliance') setActiveTab('compliance');

    // 2. Talent
    else if (subFeatureId === 'talent_ats' || subFeatureId === 'talent_mobility') setActiveTab('recruitment');
    else if (subFeatureId === 'talent_performance' || subFeatureId === 'talent_succession') setActiveTab('performance');
    else if (subFeatureId === 'talent_learning') setActiveTab('learning');
    else if (subFeatureId === 'talent_skills' || subFeatureId === 'talent_recognition') setActiveTab('experience');

    // 3. Payroll & Finance
    else if (subFeatureId === 'payroll_global' || subFeatureId === 'payroll_claims' || subFeatureId === 'payroll_ewa' || subFeatureId === 'payroll_accounting') setActiveTab('payroll');
    else if (subFeatureId === 'payroll_comp') setActiveTab('compensation');
    else if (subFeatureId === 'payroll_tax') setActiveTab('compliance');
    else if (subFeatureId === 'payroll_fnf') setActiveTab('onboarding');

    // 4. Workforce Operations
    else if (subFeatureId === 'ops_rosters' || subFeatureId === 'ops_field') setActiveTab('attendance');
    else if (subFeatureId === 'ops_projects' || subFeatureId === 'ops_timesheets') setActiveTab('projects');
    else if (subFeatureId === 'ops_contract') setActiveTab('contract_workforce');
    else if (subFeatureId === 'ops_assets') setActiveTab('onboarding');
    else if (subFeatureId === 'ops_travel') setActiveTab('payroll');

    // 5. Analytics & AI
    else if (subFeatureId === 'analytics_exec') setActiveTab('dashboard');
    else if (subFeatureId.startsWith('analytics')) setActiveTab('analytics');

    // 6. Platform
    else if (subFeatureId === 'platform_access_control' || subFeatureId === 'access_control') setActiveTab('access_control');
    else if (subFeatureId === 'platform_integrations') setActiveTab('integrations');
    else if (subFeatureId === 'platform_workflows') setActiveTab('onboarding');
    else if (subFeatureId.startsWith('platform')) setActiveTab('settings');

    // Backward-compatibility fallbacks
    else if (subFeatureId.startsWith('attendance')) setActiveTab('attendance');
    else if (subFeatureId.startsWith('leave')) setActiveTab('leaves');
    else if (subFeatureId.startsWith('payroll')) setActiveTab('payroll');
    else if (subFeatureId.startsWith('compliance')) setActiveTab('compliance');
    else if (subFeatureId.startsWith('recruitment')) setActiveTab('recruitment');
    else if (subFeatureId.startsWith('performance')) setActiveTab('performance');
    else if (subFeatureId === 'team' || subFeatureId === 'teams') setActiveTab('team');
    else if (subFeatureId === 'onboarding' || subFeatureId === 'lifecycle') setActiveTab('onboarding');
    else if (subFeatureId === 'people_core' || subFeatureId === 'people_classification') setActiveTab('people_core');
    else setActiveTab(subFeatureId);
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
          setActiveTab(targetTab);
          if (domainId) setActiveDomain(domainId);
          if (subId) setActiveSubFeature(subId);
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
              onNavigate={(tab) => {
                setActiveTab(tab);
                setShowCatalog(false);
                setActiveFloatingDrawer(null);
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
