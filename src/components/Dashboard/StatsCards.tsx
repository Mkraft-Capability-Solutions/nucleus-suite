"use client";

import { Award, Calendar, CheckCircle, Clock } from "lucide-react";
import { useT } from "@/hooks/useT";
import { useOwnProfile } from "@/hooks/useOwnProfile";
import { selectList, useApiResource } from "@/hooks/useApiResource";
import { formatClock, formatMinutes, useMyPunchDay } from "@/hooks/useMyPunchDay";
import styles from "./StatsCards.module.css";

/**
 * Personal KPI row: attendance + hours from the punch-day API, leave from GET /api/v1/leave/balance-cards for the
 * caller's employee. Recognition has no per-person count API, so the card says so. No placeholder numbers.
 */
const NS = "components.Dashboard.StatsCards";
type BalanceCard = { leaveType: string; available?: number; balance?: number };

export default function StatsCards() {
  const { t, locale } = useT();
  const { state: punch } = useMyPunchDay();
  const { state: profile } = useOwnProfile();
  const employeeId = profile.status === "ready" ? profile.data?.employeeId : null;
  const { state: leave } = useApiResource<BalanceCard[]>(employeeId ? `/api/v1/leave/balance-cards?employeeId=${employeeId}` : null, selectList);
  const day = punch.status === "ready" ? punch.data : null;
  const loading = t(`${NS}.text_loading`, "Loading…");
  const unavailable = (s: { status: string; message?: string }) => (s.status === "error" ? s.message || t(`${NS}.text_unavailable`, "Not available") : loading);
  const leaveTotal = leave.status === "ready" ? leave.data.reduce((sum, card) => sum + (Number(card.available ?? card.balance) || 0), 0) : null;

  const cards = [
    { icon: <CheckCircle size={24} />, title: t(`${NS}.text_attendance`, "Attendance status"), value: day ? (day.state === "in" ? t(`${NS}.text_in`, "Punched in") : day.state === "out" ? t(`${NS}.text_out`, "Punched out") : t(`${NS}.text_not_started`, "Not punched in")) : unavailable(punch), sub: day?.firstIn ? t(`${NS}.text_in_at`, "In: {time}", { time: formatClock(day.firstIn, locale, day.timezone) ?? "" }) : "" },
    { icon: <Calendar size={24} />, title: t(`${NS}.text_leave`, "Leave balance"), value: leaveTotal !== null ? t(`${NS}.text_days`, "{days} days", { days: new Intl.NumberFormat(locale).format(leaveTotal) }) : !employeeId && profile.status === "ready" ? t(`${NS}.text_no_employee`, "No employee profile linked") : unavailable(leave), sub: "" },
    { icon: <Clock size={24} />, title: t(`${NS}.text_hours`, "Hours today"), value: day ? t(`${NS}.text_duration`, "{hours}h {minutes}m", formatMinutes(day.workedMinutes, locale)) : unavailable(punch), sub: "" },
    { icon: <Award size={24} />, title: t(`${NS}.text_recognition`, "Recognition"), value: t(`${NS}.text_unavailable`, "Not available"), sub: t(`${NS}.text_recognition_reason`, "There is no per-person recognition summary yet.") },
  ];

  return (
    <div className={styles.grid}>
      {cards.map((card) => (
        <div key={card.title} className={`${styles.card} glass-card`}>
          <div className={styles.header}><span className={styles.iconWrapper} aria-hidden="true">{card.icon}</span><span className={styles.title}>{card.title}</span></div>
          <div className={styles.content}><h3>{card.value}</h3>{card.sub && <p>{card.sub}</p>}</div>
          <div className={styles.footer}><button type="button" className={styles.aiBtn} onClick={() => window.dispatchEvent(new CustomEvent("nucleus:open_copilot"))}>{t(`${NS}.StatsCards_text_5`, "Ask AI")}</button></div>
        </div>
      ))}
    </div>
  );
}
