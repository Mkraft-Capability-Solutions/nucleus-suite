"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, Clock, Laptop, Plus, Search, Sparkles, Users } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import { launchAction } from "@/lib/action-launcher";
import MemberCard from "./team-view/MemberCard";
import { ALL_PODS, filterMembers, pods, toMember } from "./team-view/data";
import { label, type LabelKey } from "./team-view/labels";
import { usePeople } from "./team-view/usePeople";
import styles from "./TeamView.module.css";

type Props = {
  onNavigate?: (tab: string, sub?: string, consoleId?: string) => void;
  onSelectConsole?: (consoleId: string) => void;
  activeSubFeature?: string;
};

/** Team directory over GET /api/v1/people; presence is not tracked, so it is shown as unavailable. */
export default function TeamView({ onNavigate, onSelectConsole }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [pod, setPod] = useState(ALL_PODS);
  const serverSearch = query.trim().length >= 2 ? query.trim() : "";
  const { state, reload } = usePeople(serverSearch);
  const members = useMemo(() => (state.status === "ready" ? state.items.map(toMember) : []), [state]);
  const podList = useMemo(() => pods(members), [members]);
  const shown = useMemo(() => filterMembers(members, pod, serverSearch ? "" : query), [members, pod, query, serverSearch]);
  const total = state.status === "ready" ? state.total ?? members.length : 0;

  const stat = (icon: ReactNode, tone: string, key: LabelKey, value: ReactNode, hint?: string) => (
    <div className={styles.statCard} title={hint}>
      <div className={`${styles.statIconWrap} ${tone}`}>{icon}</div>
      <div className={styles.statMeta}>
        <span className={styles.statValue}>{value}</span>
        <span className={styles.statLabel}>{label(t, key)}</span>
      </div>
    </div>
  );
  const presence = label(t, "presenceUnavailable");

  return (
    <div className={styles.teamContainer}>
      <div className={styles.headerRow}>
        <div className={styles.titleBlock}>
          <h2>{label(t, "title")}</h2>
          <p>{label(t, "subtitle")}</p>
        </div>
        <div className={styles.headerActions}>
          {(onNavigate || onSelectConsole) && (
            <button
              type="button"
              className={`${styles.btnPrimary} ${styles.btnCockpit}`}
              onClick={() => {
                onSelectConsole?.("S7");
                onNavigate?.("dashboard", "dashboard", "s7");
              }}
              title={label(t, "managerCockpitTitle")}
            >
              <Sparkles size={15} aria-hidden="true" /> {label(t, "managerCockpit")}
            </button>
          )}
          <button type="button" className={styles.btnPrimary} onClick={() => launchAction("invite")}>
            <Plus size={18} aria-hidden="true" /> {label(t, "invite")}
          </button>
        </div>
      </div>

      <div className={styles.statsRow}>
        {stat(<Users size={22} aria-hidden="true" />, styles.toneInfo, "total", total, label(t, "totalHint", { shown: members.length, total }))}
        {stat(<CheckCircle2 size={22} aria-hidden="true" />, styles.toneOk, "active", label(t, "unavailable"), presence)}
        {stat(<Clock size={22} aria-hidden="true" />, styles.toneFlag, "busy", label(t, "unavailable"), presence)}
        {stat(<Laptop size={22} aria-hidden="true" />, styles.tonePending, "away", label(t, "unavailable"), presence)}
      </div>

      <div className={styles.filterBar}>
        <div className={styles.searchBox}>
          <Search size={16} aria-hidden="true" />
          <input type="text" placeholder={label(t, "search")} aria-label={label(t, "search")} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className={styles.podPills} role="group">
          {[ALL_PODS, ...podList].map((id) => (
            <button key={id} type="button" aria-pressed={pod === id} className={`${styles.podPill} ${pod === id ? styles.activePod : ""}`} onClick={() => setPod(id)}>
              {id === ALL_PODS ? label(t, "allPods") : id}
            </button>
          ))}
        </div>
      </div>

      {state.status === "loading" && <p className={styles.stateBox} role="status">{label(t, "loading")}</p>}
      {state.status === "error" && (
        <div className={styles.stateBox} role="alert">
          <span>{label(t, "loadError")} {state.message}</span>
          <button type="button" className={styles.btnPrimary} onClick={reload}>{label(t, "retry")}</button>
        </div>
      )}
      {state.status === "ready" && shown.length === 0 && (
        <p className={styles.stateBox}>{label(t, members.length || serverSearch ? "noMatches" : "empty")}</p>
      )}
      {state.status === "ready" && shown.length > 0 && (
        <div className={styles.teamGrid}>
          {shown.map((member) => <MemberCard key={member.id} member={member} />)}
        </div>
      )}
    </div>
  );
}
