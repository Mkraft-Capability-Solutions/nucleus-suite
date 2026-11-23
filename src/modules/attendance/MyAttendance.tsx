"use client";

import { DoorOpen, UserCheck } from "lucide-react";
import { Alert, Button, ErrorState, Panel, SkeletonRows, cx } from "@/design/redesign/ui";
import { useSession } from "./data";
import { hm, monthKey, monthOf } from "./format";
import { MonthView } from "./month";
import styles from "./Attendance.module.css";

const clock = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

/** The signed-in employee's day today and their month. */
export default function MyAttendance({ employeeId, canDecide, canRequest, onRequestRegularisation, onRequestGatePass }: {
  employeeId: string; canDecide: boolean; canRequest: boolean;
  onRequestRegularisation: (date?: string) => void; onRequestGatePass: () => void;
}) {
  const period = monthKey(monthOf(new Date()));
  const session = useSession(employeeId, period);
  const data = session.data;
  const quota = data?.gatePassQuota;
  const ceiling = quota && quota.ceilingMinutes > 0 ? quota.ceilingMinutes : null;
  const share = quota && ceiling ? Math.min(100, Math.round((quota.usedMinutes / ceiling) * 100)) : 0;

  return (
    <div className={styles.section}>
      <Panel flush>
        {session.error ? <div className={styles.pad}><ErrorState message={session.error.message} onRetry={() => void session.mutate()} /></div>
          : !data ? <SkeletonRows rows={2} columns={3} />
            : (
              <div className={styles.today}>
                <div className={styles.todayItem}>
                  <span className={styles.statLabel}>Today</span>
                  {data.session.open ? (
                    <>
                      <span className={styles.todayValue}><span className={cx(styles.liveDot)} aria-hidden="true" />Checked in{clock(data.session.checkedInAt) ? ` at ${clock(data.session.checkedInAt)}` : ""}</span>
                      <span className={styles.statNote}>{hm(data.session.elapsedMinutes)} so far</span>
                    </>
                  ) : (
                    <>
                      <span className={styles.todayValue}>{data.session.checkedInAt ? `Checked out (in at ${clock(data.session.checkedInAt)})` : "No punch yet today"}</span>
                      <span className={styles.statNote}>Punches come from the biometric readers and the mobile app.</span>
                    </>
                  )}
                </div>
                <div className={styles.todayItem}>
                  <span className={styles.statLabel}>Shift</span>
                  {data.shift.shiftCode ? (
                    <>
                      <span className={styles.todayValue}>{data.shift.shiftName ?? data.shift.shiftCode}{data.shift.startsAt && data.shift.endsAt ? ` · ${data.shift.startsAt}–${data.shift.endsAt}` : ""}</span>
                      <span className={styles.statNote}>{data.shift.graceMinutes !== null ? `${data.shift.graceMinutes} min grace on arrival` : `Shift ${data.shift.shiftCode}`}</span>
                    </>
                  ) : (
                    <>
                      <span className={styles.todayValue}>No shift assigned</span>
                      <span className={styles.statNote}>Your days are counted against the standard shift.</span>
                    </>
                  )}
                </div>
                <div className={styles.todayItem}>
                  <span className={styles.statLabel}>Personal gate passes this month</span>
                  <span className={styles.todayValue}>{quota ? `${hm(quota.usedMinutes) === "—" ? "0:00" : hm(quota.usedMinutes)} used${ceiling ? ` of ${hm(ceiling)}` : ""}` : "—"}</span>
                  {ceiling && <span className={styles.quotaBar} role="progressbar" aria-label="Gate-pass allowance used" aria-valuenow={share} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${share}%` }} className={cx(share >= 100 && styles.quotaFull)} /></span>}
                  <span className={styles.statNote}>{quota?.requestsRemaining !== null && quota?.requestsRemaining !== undefined ? `${quota.requestsRemaining} ${quota.requestsRemaining === 1 ? "pass" : "passes"} left` : "No monthly limit recorded"}</span>
                </div>
                {canRequest && (
                  <div className={styles.todayActions}>
                    <Button icon={UserCheck} onClick={() => onRequestRegularisation()}>Request correction</Button>
                    <Button icon={DoorOpen} onClick={onRequestGatePass}>Request gate pass</Button>
                  </div>
                )}
              </div>
            )}
      </Panel>

      <Panel title="My month" subtitle="Select a day to see how it was calculated">
        <MonthView employeeId={employeeId} canDecide={canDecide} canRequest={canRequest} onRequestRegularisation={(date) => onRequestRegularisation(date)} />
      </Panel>
      {!canRequest && <Alert tone="info">To correct a day or leave the premises during your shift, ask HR or your manager to raise the request for you.</Alert>}
    </div>
  );
}
