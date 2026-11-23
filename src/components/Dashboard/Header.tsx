"use client";

import { Bell, Monitor, Plus, Search } from "lucide-react";
import { useT } from "@/hooks/useT";
import { useOwnProfile } from "@/hooks/useOwnProfile";
import { selectData, useApiResource } from "@/hooks/useApiResource";
import { launchAction } from "@/lib/action-launcher";
import styles from "./Header.module.css";

/**
 * Compact dashboard header. Name/avatar from the own-profile API, unread count from GET /api/v1/notifications;
 * search opens the assistant (global search lives there); "Quick" opens the workspace action picker.
 */
const NS = "components.Dashboard.Header";

export default function Header() {
  const { t, locale } = useT();
  const { state: profile } = useOwnProfile();
  const { state: notes } = useApiResource<{ unread?: number }>("/api/v1/notifications?unread=true", selectData);
  const me = profile.status === "ready" ? profile.data : null;
  const unread = notes.status === "ready" && typeof notes.data?.unread === "number" ? notes.data.unread : null;
  const initials = (me?.name ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");

  return (
    <header className={`${styles.header} glass-card`}>
      <div className={styles.logo}><div className={styles.logoIcon} aria-hidden="true">N</div><span>{t(`${NS}.Header_text_2`, "Nucleus")}</span></div>
      <form className={styles.searchBar} role="search" onSubmit={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent("nucleus:open_copilot")); }}>
        <Search className={styles.searchIcon} size={20} aria-hidden="true" />
        <input type="search" aria-label={t(`${NS}.Header_placeholder_3`, "Search or ask AI")} placeholder={t(`${NS}.Header_placeholder_3`, "Search or ask AI")} className={styles.searchInput} />
        <div className={styles.shortcut}>{t(`${NS}.Header_text_4`, "Ctrl+K")}</div>
      </form>
      <div className={styles.actions}>
        <button type="button" className={styles.actionBtn} onClick={() => launchAction("ticket")}><Plus size={20} aria-hidden="true" /><span>{t(`${NS}.Header_text_5`, "Quick")}</span></button>
        <button type="button" className={styles.iconBtn} aria-label={unread === null ? t(`${NS}.text_notifications`, "Notifications") : t(`${NS}.text_notifications_count`, "Notifications, {count} unread", { count: unread })}>
          <Bell size={20} aria-hidden="true" />
          {unread !== null && unread > 0 && <span className={styles.badge}>{new Intl.NumberFormat(locale).format(unread)}</span>}
        </button>
        <button type="button" className={styles.iconBtn} aria-label={t(`${NS}.text_display`, "Display settings")} onClick={() => window.dispatchEvent(new CustomEvent("nucleus:navigate_tab", { detail: { tab: "settings" } }))}><Monitor size={20} aria-hidden="true" /></button>
        <div className={styles.profile}>
          <span className={styles.avatar} aria-hidden="true">{initials || "·"}</span>
          <span className={styles.profileName}>{profile.status === "loading" ? t(`${NS}.text_loading`, "Loading…") : me?.name || t(`${NS}.text_profile_unavailable`, "Profile unavailable")}</span>
        </div>
      </div>
    </header>
  );
}
