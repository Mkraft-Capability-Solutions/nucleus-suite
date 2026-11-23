"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Search, Sliders } from "lucide-react";
import { useResource, type MemberSummary } from "./adminApi";
import { StateBox, useT } from "./AdminParts";
import MemberAccessDetail from "./MemberAccessDetail";
import styles from "./Admin.module.css";

/**
 * Individual access: tenant members from GET /api/v1/access/members, and for the selected member the
 * roles, effective pages/cards and time-boxed overrides (resource_grants) from GET /api/v1/access/members/{id}.
 */

const NS = "components.Workspace.UserAccessPanel";

export default function UserAccessPanel() {
  const t = useT();
  const { state, reload } = useResource<{ items: MemberSummary[] }>("/api/v1/access/members", t(`${NS}.text_failed`, "Members could not be loaded."));
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const members = useMemo(() => (state.status === "ready" ? state.data.items : []), [state]);
  const departments = useMemo(() => [...new Set(members.map((member) => member.department).filter((dept): dept is string => Boolean(dept)))].sort(), [members]);
  const withOverrides = members.filter((member) => member.overrideCount > 0).length;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return members.filter((member) => {
      if (filter === "WITH_OVERRIDES" && member.overrideCount === 0) return false;
      if (filter !== "ALL" && filter !== "WITH_OVERRIDES" && member.department !== filter) return false;
      if (!needle) return true;
      return `${member.name} ${member.email ?? ""} ${member.employeeCode ?? ""} ${member.department ?? ""} ${member.roleNames.join(" ")}`.toLowerCase().includes(needle);
    });
  }, [members, query, filter]);
  const selected = members.find((member) => member.id === selectedId) ?? filtered[0] ?? null;

  if (state.status === "loading") return <StateBox tone="loading">{t(`${NS}.text_loading`, "Loading members…")}</StateBox>;
  if (state.status === "error") return <StateBox tone="error" onRetry={reload} retryLabel={t(`${NS}.text_retry`, "Retry")}>{state.message}</StateBox>;

  const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className={styles.split}>
      <aside className={styles.card} aria-label={t(`${NS}.text_directory`, "Member directory")}>
        <label className={styles.search}>
          <Search size={15} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t(`${NS}.text_search`, "Search name, email, code or role")} aria-label={t(`${NS}.text_search`, "Search name, email, code or role")} />
        </label>
        <div className={styles.chips} role="group" aria-label={t(`${NS}.text_filters`, "Filters")}>
          <button type="button" className={`${styles.chip} ${filter === "ALL" ? styles.chipActive : ""}`} aria-pressed={filter === "ALL"} onClick={() => setFilter("ALL")}>
            {t(`${NS}.text_all`, "All")} <span className={styles.count}>{members.length}</span>
          </button>
          <button type="button" className={`${styles.chip} ${filter === "WITH_OVERRIDES" ? styles.chipActive : ""}`} aria-pressed={filter === "WITH_OVERRIDES"} onClick={() => setFilter("WITH_OVERRIDES")}>
            <Sliders size={12} aria-hidden="true" />{t(`${NS}.text_with_overrides`, "With overrides")} <span className={styles.count}>{withOverrides}</span>
          </button>
          {departments.map((dept) => (
            <button key={dept} type="button" className={`${styles.chip} ${filter === dept ? styles.chipActive : ""}`} aria-pressed={filter === dept} onClick={() => setFilter(dept)}>{dept}</button>
          ))}
        </div>
        {members.length === 0 && <StateBox tone="empty">{t(`${NS}.text_empty`, "No members exist in this organisation yet.")}</StateBox>}
        {members.length > 0 && filtered.length === 0 && <StateBox tone="empty">{t(`${NS}.text_no_match`, "No member matches the filters.")}</StateBox>}
        <div className={styles.list}>
          {filtered.map((member) => (
            <button key={member.id} type="button" className={`${styles.listItem} ${member.id === selected?.id ? styles.listItemActive : ""}`} aria-current={member.id === selected?.id ? "true" : undefined} onClick={() => setSelectedId(member.id)}>
              <span className={styles.row}>
                <span className={styles.avatar} aria-hidden="true">{initials(member.name || member.email || "")}</span>
                <span>
                  <strong>{member.name || member.email}</strong>
                  <span className={styles.listMeta}>{member.roleNames.join(", ") || t(`${NS}.text_no_role`, "No role")}{member.department ? ` · ${member.department}` : ""}</span>
                </span>
              </span>
              <span className={styles.row}>
                {member.overrideCount > 0 && <span className={`${styles.badge} ${styles.badgeWarn}`} title={t(`${NS}.text_overrides`, "Active overrides")}>{member.overrideCount}</span>}
                <ChevronRight size={14} aria-hidden="true" />
              </span>
            </button>
          ))}
        </div>
      </aside>
      <section className={styles.card} aria-live="polite">
        {selected ? (
          <MemberAccessDetail key={selected.id} memberId={selected.id} onChanged={reload} />
        ) : (
          <StateBox tone="empty">{t(`${NS}.text_pick`, "Choose a member to see their access.")}</StateBox>
        )}
      </section>
    </div>
  );
}
