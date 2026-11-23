"use client";

import { AlertTriangle, CheckCircle2, EyeOff } from "lucide-react";
import type { EffectiveEntry, EffectiveUiAccess } from "@/lib/access/ui-access-catalog";
import { useResource, type RolePreview, type Translate } from "./adminApi";
import { StateBox, useT } from "./AdminParts";
import { cardName, pageName, permissionDomain, sourceLabel } from "./uiLabels";
import styles from "./Admin.module.css";

const NS = "components.Workspace.RolePreview";

/** Server-computed view of what a member with this role sees (GET /api/v1/roles/{id}/preview). */
export default function RolePreviewView({ roleId, version }: { roleId: string; version: string }) {
  const t = useT();
  const { state, reload } = useResource<RolePreview>(
    `/api/v1/roles/${encodeURIComponent(roleId)}/preview?v=${encodeURIComponent(version)}`,
    t(`${NS}.text_failed`, "The preview could not be loaded."),
  );
  if (state.status === "loading") return <StateBox tone="loading">{t(`${NS}.text_loading`, "Building the preview…")}</StateBox>;
  if (state.status === "error") return <StateBox tone="error" onRetry={reload} retryLabel={t(`${NS}.text_retry`, "Retry")}>{state.message}</StateBox>;
  return <AccessSummary t={t} access={state.data.access} permissions={state.data.permissions} />;
}

function EntryList({ t, entries, name }: { t: Translate; entries: EffectiveEntry[]; name: (key: string) => string }) {
  const visible = entries.filter((entry) => entry.visible);
  const hidden = entries.filter((entry) => !entry.visible);
  return (
    <>
      {visible.length === 0 && <p className={styles.muted}>{t(`${NS}.text_none_visible`, "Nothing is visible.")}</p>}
      <div className={styles.itemGrid}>
        {visible.map((entry) => (
          <div key={entry.key} className={`${styles.item} ${styles.itemOn}`}>
            <span className={styles.itemText}>
              <span className={styles.itemTitle}><CheckCircle2 size={14} aria-hidden="true" /> {name(entry.key)}</span>
              <span className={styles.itemDesc}>{sourceLabel(t, entry.source)}</span>
              {entry.missingPermissions.length > 0 && (
                <span className={`${styles.badge} ${styles.badgeWarn}`}>
                  <AlertTriangle size={12} aria-hidden="true" />
                  {t(`${NS}.text_data_blocked`, "Opens, but data is refused without {permissions}", { permissions: entry.missingPermissions.join(", ") })}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
      {hidden.length > 0 && (
        <p className={styles.help}>
          <EyeOff size={13} aria-hidden="true" /> {t(`${NS}.text_hidden`, "Hidden: {items}", { items: hidden.map((entry) => name(entry.key)).join(", ") })}
        </p>
      )}
    </>
  );
}

/** Shared by the role preview and the member preview. */
export function AccessSummary({ t, access, permissions }: { t: Translate; access: EffectiveUiAccess; permissions: string[] }) {
  const domains = [...new Set(permissions.map(permissionDomain))].sort();
  return (
    <div className={styles.toggleList}>
      <h4 className={styles.groupTitle}>{t(`${NS}.text_pages`, "Pages ({count} visible)", { count: access.pages.filter((entry) => entry.visible).length })}</h4>
      <EntryList t={t} entries={access.pages} name={(key) => pageName(t, key)} />
      <h4 className={styles.groupTitle}>{t(`${NS}.text_cards`, "Dashboard cards ({count} visible)", { count: access.cards.filter((entry) => entry.visible).length })}</h4>
      <EntryList t={t} entries={access.cards} name={(key) => cardName(t, key)} />
      <h4 className={styles.groupTitle}>{t(`${NS}.text_actions`, "Allowed actions ({count})", { count: permissions.length })}</h4>
      {permissions.length === 0 ? (
        <p className={styles.muted}>{t(`${NS}.text_no_actions`, "No actions are allowed; the server refuses every data request.")}</p>
      ) : (
        <div className={styles.chips}>
          {domains.map((domain) => (
            <span key={domain} className={styles.badge} title={permissions.filter((key) => permissionDomain(key) === domain).join(", ")}>
              <span className={styles.mono}>{domain}</span> · {permissions.filter((key) => permissionDomain(key) === domain).length}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
