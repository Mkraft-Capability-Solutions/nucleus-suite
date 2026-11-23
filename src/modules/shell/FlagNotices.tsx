"use client";

import { useState } from "react";
import useSWR from "swr";
import { TriangleAlert, OctagonAlert, X } from "lucide-react";
import { FLAG_RULE_BY_KEY, type EmployeeFlag } from "@/lib/employee-flags";
import { cx, theme } from "@/design/redesign/ui";
import styles from "./FlagNotices.module.css";

type TeamFlag = EmployeeFlag & { employeeName: string; employeeCode: string };
type Payload = { data: { own: EmployeeFlag[]; team: TeamFlag[] } };

/** Closed messages, for this sign-in only (cleared on sign-out), so they return at the next sign-in. */
export const DISMISSED_FLAGS_KEY = "nucleus_dismissed_flags";

function readDismissed(): string[] {
  try {
    const value = JSON.parse(sessionStorage.getItem(DISMISSED_FLAGS_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

async function load(url: string): Promise<Payload | null> {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  return response.ok ? response.json() : null;
}

type Notice = { id: string; severity: "warning" | "alert"; title: string; lines: string[]; more: number };

const TEAM_LIMIT = 4;

/** What the person can do about a flag on their own record. */
const NEXT_STEP: Record<EmployeeFlag["rule"], string> = {
  passport_expiry: "Please renew it and share the new passport details with HR.",
  visa_expiry: "Please renew it and share the new work permit or visa with HR.",
  medical_exam_due: "Please book your medical examination and share the result with HR.",
  retirement_due: "HR will contact you about the next steps.",
};

/** One message per flag on the person's own record; one per severity for their direct reports. */
function buildNotices(own: EmployeeFlag[], team: TeamFlag[]): Notice[] {
  const notices: Notice[] = own.map((flag) => ({
    id: flag.id,
    severity: flag.severity,
    title: `${flag.severity === "alert" ? "Alert" : "Warning"} · ${FLAG_RULE_BY_KEY[flag.rule].label}`,
    lines: [`On your record: ${flag.detail} ${NEXT_STEP[flag.rule]}`],
    more: 0,
  }));
  for (const severity of ["alert", "warning"] as const) {
    const flags = team.filter((flag) => flag.severity === severity);
    if (flags.length === 0) continue;
    const people = new Set(flags.map((flag) => flag.employeeId)).size;
    notices.push({
      id: `team:${severity}:${flags.map((flag) => flag.id).sort().join(",")}`,
      severity,
      title: `${severity === "alert" ? "Alert" : "Warning"} · your team: ${flags.length} ${flags.length === 1 ? "item" : "items"} for ${people} ${people === 1 ? "person" : "people"}`,
      lines: flags.slice(0, TEAM_LIMIT).map((flag) => `${flag.employeeName}: ${FLAG_RULE_BY_KEY[flag.rule].label}. ${flag.detail}`),
      more: Math.max(0, flags.length - TEAM_LIMIT),
    });
  }
  return notices.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "alert" ? -1 : 1));
}

/**
 * Warnings and alerts shown after signing in: on the person's own record (passport or visa
 * expiring, medical examination due, retirement approaching) and on their direct reports'. Each
 * message can be closed; it comes back at the next sign-in while the record still meets the rule,
 * and a closed warning that becomes an alert shows again.
 */
export default function FlagNotices() {
  const { data } = useSWR<Payload | null>("/api/v1/me/flags", load, { revalidateOnFocus: false, dedupingInterval: 300_000 });
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  const notices = data ? buildNotices(data.data.own, data.data.team).filter((notice) => !dismissed.includes(notice.id)) : [];
  if (notices.length === 0) return null;

  const close = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try { sessionStorage.setItem(DISMISSED_FLAGS_KEY, JSON.stringify(next)); } catch { /* storage blocked: closed for this page only */ }
  };

  return (
    <div className={cx(theme.scope, styles.stack)} aria-label="Warnings and alerts">
      {notices.map((notice) => {
        const Icon = notice.severity === "alert" ? OctagonAlert : TriangleAlert;
        return (
          <div key={notice.id} className={cx(styles.notice, notice.severity === "alert" ? styles.alert : styles.warning)} role={notice.severity === "alert" ? "alert" : "status"}>
            <Icon className={styles.icon} aria-hidden="true" />
            <div className={styles.body}>
              <p className={styles.title}>{notice.title}</p>
              {notice.lines.length === 1 && notice.more === 0 ? <p className={styles.text}>{notice.lines[0]}</p> : (
                <ul className={styles.list}>
                  {notice.lines.map((line) => <li key={line}>{line}</li>)}
                  {notice.more > 0 && <li className={styles.more}>and {notice.more} more</li>}
                </ul>
              )}
            </div>
            <button type="button" className={styles.close} aria-label={`Close: ${notice.title}`} title="Close" onClick={() => close(notice.id)}><X aria-hidden="true" /></button>
          </div>
        );
      })}
    </div>
  );
}
