"use client";

import type { ReactNode } from "react";
import { CheckCircle, Clock, DollarSign, Megaphone, ShieldCheck, Sun, Users } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import LiveClock from "@/components/Dashboard/LiveClock";
import styles from "./GreetingHero.module.css";

/**
 * Greeting card at the top of every dashboard (mockup `.hero`). Time-of-day greeting, the signed-in person's real
 * name and role, a one-line purpose for the console, and the console's shortcuts. It states no figures: numbers
 * live in the cards below, which come from the API.
 */

export type HeroPersona = "executive" | "employee" | "manager" | "operations";
type Translate = (key: string, fallback: string, params?: Record<string, unknown>) => string;
const NS = "components.Dashboard.GreetingHero";

function greetingKey(hour: number): [string, string] {
  if (hour < 12) return ["text_good_morning", "Good morning, {name}"];
  if (hour < 17) return ["text_good_afternoon", "Good afternoon, {name}"];
  return ["text_good_evening", "Good evening, {name}"];
}

type Action = { id: string; icon: ReactNode; label: string; onClick: () => void; emphasis?: boolean };

export default function GreetingHero({
  persona, firstName, roleLabel, consoleLabel, broadcastCount, punchedIn, onNavigate, onOpenBroadcasts,
}: {
  persona: HeroPersona; firstName: string; roleLabel: string; consoleLabel: string; broadcastCount: number;
  punchedIn: boolean; onNavigate: (tab: string) => void; onOpenBroadcasts: () => void;
}) {
  const { t: rawT } = useTranslation();
  const t = rawT as Translate;
  const [key, fallback] = greetingKey(new Date().getHours());
  const broadcasts: Action = { id: "broadcasts", icon: <Megaphone size={14} />, label: t(`${NS}.text_broadcasts`, "Broadcasts ({count})", { count: broadcastCount }), onClick: onOpenBroadcasts };

  const purpose: Record<HeroPersona, string> = {
    executive: t(`${NS}.text_purpose_executive`, "Your organisation at a glance: workforce, attrition, health and the signals worth acting on."),
    employee: t(`${NS}.text_purpose_employee`, "Your day: attendance, leave, pay and the people you work with."),
    manager: t(`${NS}.text_purpose_manager`, "Your team: approvals waiting on you, capacity and who needs attention."),
    operations: t(`${NS}.text_purpose_operations`, "Your workspace, shortcuts and live data in one place."),
  };
  const actions: Record<HeroPersona, Action[]> = {
    executive: [
      { id: "team", icon: <Users size={14} />, label: t(`${NS}.text_org_directory`, "Org directory"), onClick: () => onNavigate("team") },
      broadcasts,
      { id: "access", icon: <ShieldCheck size={14} />, label: t(`${NS}.text_configure_access`, "Configure access"), onClick: () => onNavigate("access_control"), emphasis: true },
    ],
    employee: [
      // AttendanceFAB is the single punch control; this shortcut asks it to punch.
      { id: "punch", icon: <Clock size={14} />, label: punchedIn ? t(`${NS}.text_punch_out`, "Punch out") : t(`${NS}.text_punch_in`, "Punch in"), onClick: () => window.dispatchEvent(new CustomEvent("nucleus:trigger_punch")), emphasis: true },
      { id: "leave", icon: <Sun size={14} />, label: t(`${NS}.text_apply_leave`, "Apply leave"), onClick: () => onNavigate("leaves") },
      { id: "claim", icon: <DollarSign size={14} />, label: t(`${NS}.text_claim_expense`, "Claim expense"), onClick: () => onNavigate("compensation") },
      { id: "team", icon: <Users size={14} />, label: t(`${NS}.text_team_directory`, "Team directory"), onClick: () => onNavigate("team") },
      broadcasts,
    ],
    manager: [
      { id: "approvals", icon: <CheckCircle size={14} />, label: t(`${NS}.text_approvals`, "Approvals"), onClick: () => onNavigate("leaves") },
      { id: "roster", icon: <Users size={14} />, label: t(`${NS}.text_team_roster`, "Team roster"), onClick: () => onNavigate("team") },
      broadcasts,
    ],
    operations: [
      { id: "team", icon: <Users size={14} />, label: t(`${NS}.text_team_directory`, "Team directory"), onClick: () => onNavigate("team") },
      broadcasts,
    ],
  };

  return (
    <section className={styles.hero} data-dashboard-hero aria-label={t(`${NS}.text_region`, "Welcome")}>
      <div className={styles.copy}>
        <span className={styles.kicker}><i aria-hidden="true" />{consoleLabel}</span>
        <h1 className={styles.title}>{t(`${NS}.${key}`, fallback, { name: firstName })}</h1>
        <span className={styles.role}>{roleLabel}</span>
        <p className={styles.purpose}>{purpose[persona]}</p>
        <div className={styles.actions}>
          {actions[persona].map((action) => (
            <button key={action.id} type="button" className={`${styles.action} ${action.emphasis ? styles.emphasis : ""}`} onClick={action.onClick}>
              {action.icon}{action.label}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.clock}><LiveClock /></div>
    </section>
  );
}
