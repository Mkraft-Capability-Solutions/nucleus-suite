"use client";

import { useState, type ReactNode } from "react";
import { ArrowLeft, KeyRound, ShieldAlert, ShieldCheck, Sliders, UserCheck, Users } from "lucide-react";
import { useResource, type AccessCatalog, type MemberSummary, type RoleView } from "./admin/adminApi";
import { useT } from "./admin/AdminParts";
import AuditLogTable from "./admin/AuditLogTable";
import RoleAccessPanel from "./admin/RoleAccessPanel";
import UserAccessPanel from "./admin/UserAccessPanel";
import styles from "./admin/Admin.module.css";

/**
 * Access Control Studio (settings / admin page, rule 4.6).
 * - Individual access: members, their roles and time-boxed page/card overrides (/api/v1/access/members/**).
 * - Roles: select or create a role, grant pages, cards and actions, preview what it sees (/api/v1/roles/**).
 * - Audit log: access-related audit events (/api/v1/audit/events?scope=access).
 * All changes are written and enforced on the server; the screen only reflects confirmed results.
 */

const NS = "components.Workspace.AccessControlView";

type Tab = "user_access" | "role_matrix" | "audit_log";

type Props = { onNavigate?: (tab: string, ...rest: string[]) => void; onSelectConsole?: (id: string) => void; activeSubFeature?: string | null };

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number | null }) {
  const t = useT();
  return (
    <div className={styles.kpi}>
      <span className={styles.kpiIcon} aria-hidden="true">{icon}</span>
      <span>
        <span className={styles.kpiLabel}>{label}</span>
        {value === null
          ? <span className={styles.kpiMuted}>{t(`${NS}.text_not_available`, "Not available")}</span>
          : <span className={styles.kpiValue}>{value}</span>}
      </span>
    </div>
  );
}

export default function AccessControlView({ onNavigate }: Props) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("role_matrix");
  const members = useResource<{ items: MemberSummary[] }>("/api/v1/access/members", t(`${NS}.text_members_failed`, "Members could not be loaded."));
  const roles = useResource<{ items: RoleView[] }>("/api/v1/roles", t(`${NS}.text_roles_failed`, "Roles could not be loaded."));
  const catalog = useResource<AccessCatalog>("/api/v1/access/catalog", t(`${NS}.text_catalog_failed`, "The permission catalog could not be loaded."));

  const memberItems = members.state.status === "ready" ? members.state.data.items : null;
  const tabs: Array<[Tab, string, typeof Users, number | null]> = [
    ["role_matrix", t(`${NS}.tab_roles`, "Roles & access"), Sliders, roles.state.status === "ready" ? roles.state.data.items.length : null],
    ["user_access", t(`${NS}.tab_users`, "Individual access"), UserCheck, memberItems ? memberItems.length : null],
    ["audit_log", t(`${NS}.tab_audit`, "Access audit log"), ShieldAlert, null],
  ];

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <span className={styles.eyebrow}><ShieldCheck size={13} aria-hidden="true" />{t(`${NS}.text_eyebrow`, "Settings · Administration")}</span>
          <h1 className={styles.title}>{t(`${NS}.text_title`, "Access Control Studio")}</h1>
          <p className={styles.subtitle}>{t(`${NS}.text_subtitle`, "Choose or create a role, grant the pages, dashboard cards and actions it may use, and preview what its members see. Changes are enforced by the server on the next request.")}</p>
        </div>
        {onNavigate && (
          <div className={styles.actions}>
            <button type="button" className={styles.btnSecondary} onClick={() => onNavigate("settings")}>
              <ArrowLeft size={15} aria-hidden="true" />{t(`${NS}.text_back`, "Back to settings")}
            </button>
          </div>
        )}
      </header>

      <div className={styles.kpiGrid}>
        <Metric icon={<Users size={20} />} label={t(`${NS}.kpi_members`, "Members")} value={memberItems ? memberItems.length : null} />
        <Metric icon={<Sliders size={20} />} label={t(`${NS}.kpi_overrides`, "Members with overrides")} value={memberItems ? memberItems.filter((member) => member.overrideCount > 0).length : null} />
        <Metric icon={<ShieldCheck size={20} />} label={t(`${NS}.kpi_roles`, "Roles")} value={roles.state.status === "ready" ? roles.state.data.items.length : null} />
        <Metric icon={<KeyRound size={20} />} label={t(`${NS}.kpi_permissions`, "Grantable actions")} value={catalog.state.status === "ready" ? catalog.state.data.permissions.length : null} />
      </div>

      <div className={styles.tabs} role="tablist" aria-label={t(`${NS}.text_sections`, "Access control sections")}>
        {tabs.map(([id, label, Icon, count]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`${styles.tab} ${tab === id ? styles.tabActive : ""}`} onClick={() => setTab(id)}>
            <Icon size={16} aria-hidden="true" />{label}{count !== null && <span className={styles.count}>{count}</span>}
          </button>
        ))}
      </div>

      {tab === "role_matrix" && <RoleAccessPanel />}
      {tab === "user_access" && <UserAccessPanel />}
      {tab === "audit_log" && (
        <section className={styles.card}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionIcon} aria-hidden="true"><ShieldAlert size={18} /></span>
            <div>
              <h3 className={styles.cardTitle}>{t(`${NS}.text_audit_title`, "Access audit log")}</h3>
              <p className={styles.cardSubtitle}>{t(`${NS}.text_audit_subtitle`, "Role, permission, override and membership changes, newest first.")}</p>
            </div>
          </div>
          <AuditLogTable scope="access" />
        </section>
      )}
    </div>
  );
}
