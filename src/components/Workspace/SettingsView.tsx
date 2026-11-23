"use client";

import { useCallback, useState } from "react";
import { Bell, Building2, Key, List, Shield, ShieldCheck, User, Blocks } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useT } from "./admin/AdminParts";
import AuditLogTable from "./admin/AuditLogTable";
import NotificationsTab from "./settings/NotificationsTab";
import PicklistsTab from "./settings/PicklistsTab";
import ProfileTab from "./settings/ProfileTab";
import RbacTab from "./settings/RbacTab";
import SecurityTab from "./settings/SecurityTab";
import TenantTab from "./settings/TenantTab";
import TenantModulesPanel from "@/components/Entitlements/TenantModulesPanel";
import styles from "./admin/Admin.module.css";

/**
 * Settings & preferences (settings / admin page). Every tab reads and writes through a secured API:
 * profile /api/v1/operations/profile · security better-auth /api/auth/* · notifications /api/v1/notifications/preferences ·
 * organisation /api/v1/tenant/profile · audit /api/v1/audit/events · roles /api/v1/roles · picklists /api/v1/system/picklists.
 */

const NS = "components.Workspace.SettingsView";
type Tab = "profile" | "security" | "notifications" | "tenant" | "modules" | "audit" | "permissions" | "picklists";
type Props = { onNavigate?: (tab: string, ...rest: string[]) => void; onSelectConsole?: (id: string) => void; activeSubFeature?: string | null };

export default function SettingsView({ onNavigate, onSelectConsole }: Props) {
  const t = useT();
  const { user, openAccessControl } = useAuth() as { user?: { role?: string } | null; openAccessControl?: () => void };
  const [tab, setTab] = useState<Tab>("profile");
  const [profileDirty, setProfileDirty] = useState(false);
  const onDirty = useCallback((dirty: boolean) => setProfileDirty(dirty), []);

  const choose = (next: Tab) => {
    if (tab === "profile" && profileDirty && next !== "profile" && !window.confirm(t(`${NS}.text_unsaved`, "You have unsaved profile changes. Leave without saving?"))) return;
    setTab(next);
  };

  const tabs: Array<[Tab, string, typeof User]> = [
    ["profile", t(`${NS}.tab_profile`, "Profile & persona"), User],
    ["security", t(`${NS}.tab_security`, "Security & sessions"), Shield],
    ["notifications", t(`${NS}.tab_notifications`, "Notifications"), Bell],
    ["tenant", t(`${NS}.tab_tenant`, "Organisation & localisation"), Building2],
    ["modules", t(`${NS}.tab_modules`, "Modules & features"), Blocks],
    ["audit", t(`${NS}.tab_audit`, "Audit trail"), Key],
    ["permissions", t(`${NS}.tab_permissions`, "Access control & RBAC"), ShieldCheck],
    ["picklists", t(`${NS}.text_picklists_catalog`, "Picklists catalog"), List],
  ];

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>{t(`${NS}.text_title`, "Settings & Platform Preferences")}</h1>
          <p className={styles.subtitle}>{t(`${NS}.text_subtitle`, "Manage your profile, security, notifications, organisation settings, role access and the audit trail.")}</p>
        </div>
        {user?.role === "SUPER_ADMIN" && (onNavigate || onSelectConsole) && (
          <div className={styles.actions}>
            <button type="button" className={styles.btnSecondary} onClick={() => { onSelectConsole?.("S10"); onNavigate?.("dashboard", "dashboard", "s10"); }}>
              <ShieldCheck size={15} aria-hidden="true" />{t(`${NS}.text_intelligence`, "Nucleus Intelligence")}
            </button>
          </div>
        )}
      </header>
      <div className={styles.tabs} role="tablist" aria-label={t(`${NS}.text_sections`, "Settings sections")}>
        {tabs.map(([id, label, Icon]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`${styles.tab} ${tab === id ? styles.tabActive : ""}`} onClick={() => choose(id)}>
            <Icon size={16} aria-hidden="true" />{label}
          </button>
        ))}
      </div>
      {tab === "profile" && <ProfileTab t={t} onDirty={onDirty} />}
      {tab === "security" && <SecurityTab t={t} />}
      {tab === "notifications" && <NotificationsTab t={t} />}
      {tab === "tenant" && <TenantTab t={t} />}
      {tab === "modules" && <TenantModulesPanel />}
      {tab === "audit" && (
        <section className={styles.card}>
          <h3 className={styles.cardTitle}><Key size={18} aria-hidden="true" />{t(`${NS}.text_audit_title`, "Enterprise audit trail")}</h3>
          <AuditLogTable scope="all" />
        </section>
      )}
      {tab === "permissions" && <RbacTab t={t} onOpen={() => (onNavigate ? onNavigate("access_control") : openAccessControl?.())} />}
      {tab === "picklists" && <PicklistsTab t={t} />}
    </div>
  );
}
