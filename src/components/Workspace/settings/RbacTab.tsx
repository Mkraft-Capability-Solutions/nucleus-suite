"use client";

import { ShieldCheck } from "lucide-react";
import { useResource, type RoleView, type Translate } from "../admin/adminApi";
import { StateBox } from "../admin/AdminParts";
import styles from "../admin/Admin.module.css";

const NS = "components.Workspace.SettingsView";

/** Role snapshot from GET /api/v1/roles, with a link into the Access Control Studio. */
export default function RbacTab({ t, onOpen }: { t: Translate; onOpen: () => void }) {
  const { state, reload } = useResource<{ items: RoleView[] }>("/api/v1/roles", t(`${NS}.text_roles_failed`, "Roles could not be loaded."));
  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionIcon} aria-hidden="true"><ShieldCheck size={18} /></span>
          <div><h3 className={styles.cardTitle}>{t(`${NS}.text_rbac_title`, "Role access & permissions")}</h3><p className={styles.cardSubtitle}>{t(`${NS}.text_rbac_sub`, "Page visibility, dashboard cards and actions per role.")}</p></div>
        </div>
        <button type="button" className={styles.btnPrimary} onClick={onOpen}><ShieldCheck size={15} aria-hidden="true" />{t(`${NS}.text_open_studio`, "Open Access Control Studio")}</button>
      </div>
      {state.status === "loading" && <StateBox tone="loading">{t(`${NS}.text_loading`, "Loading…")}</StateBox>}
      {state.status === "error" && <StateBox tone="error" onRetry={reload} retryLabel={t(`${NS}.text_retry`, "Retry")}>{state.message}</StateBox>}
      {state.status === "ready" && state.data.items.length === 0 && <StateBox tone="empty">{t(`${NS}.text_no_roles`, "No roles exist yet.")}</StateBox>}
      {state.status === "ready" && state.data.items.length > 0 && (
        <div className={styles.kpiGrid}>
          {state.data.items.map((role) => (
            <div key={role.id} className={styles.kpi}>
              <span>
                <span className={styles.itemTitle}>{role.name}</span>
                <span className={styles.listMeta}>
                  {t(`${NS}.text_role_summary`, "{members} members · {pages} pages · {actions} actions", {
                    members: role.memberCount,
                    pages: role.uiAccess ? role.uiAccess.pages.length : t(`${NS}.text_by_permission`, "by permission"),
                    actions: role.privileged ? t(`${NS}.text_all`, "all") : role.permissionKeys.length,
                  })}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
