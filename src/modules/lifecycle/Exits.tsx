"use client";

import { useState } from "react";
import { Ban, Check, CheckCircle2, Circle, DoorOpen, Search, Wallet } from "lucide-react";
import { Alert, Avatar, Badge, Button, ConfirmDialog, Drawer, EmptyState, ErrorState, Input, Panel, SkeletonRows, Textarea, cx, ui } from "@/design/redesign/ui";
import { FilterPills, StatStrip, useNotify } from "@/modules/attendance/shared";
import { clearItem, groupCases, settleCase, useClearance, waiveItem, type ClearanceItem, type ExitCase } from "./data";
import { OWNER_LABEL, dateLabel, daysUntil, exitState } from "./format";
import styles from "./Lifecycle.module.css";

type Filter = "open" | "settled" | "all";

/** Leavers, their no-dues clearance and full & final settlement. */
export default function Exits({ canManage, canSettle, onStart }: { canManage: boolean; canSettle: boolean; onStart: () => void }) {
  const clearance = useClearance();
  const [filter, setFilter] = useState<Filter>("open");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const cases = groupCases(clearance.data ?? []);
  const needle = query.trim().toLowerCase();
  const rows = cases
    .filter((entry) => filter === "all" || (filter === "settled" ? entry.settledCase : !entry.settledCase))
    .filter((entry) => !needle || `${entry.leaverName} ${entry.leaverCode}`.toLowerCase().includes(needle));
  const open = cases.find((entry) => entry.caseId === openId) ?? null;
  const openCases = cases.filter((entry) => !entry.settledCase);

  return (
    <div className={styles.section}>
      <StatStrip label="Exits" items={[
        { label: "Exits in progress", value: openCases.length },
        { label: "Leaving in the next 30 days", value: openCases.filter((entry) => { const days = daysUntil(entry.lastWorkingDay); return days !== null && days >= 0 && days <= 30; }).length },
        { label: "Clearance items open", value: openCases.reduce((total, entry) => total + entry.items.length - entry.settled, 0) },
        { label: "Ready to settle", value: openCases.filter((entry) => entry.items.length > 0 && entry.settled === entry.items.length).length },
      ]} />
      <div className={styles.toolbar}>
        <FilterPills label="Exit status" value={filter} onChange={setFilter} options={[{ value: "open", label: "In progress" }, { value: "settled", label: "Settled" }, { value: "all", label: "All" }]} />
        <div className={styles.toolbarEnd}>
          <div className={ui.searchBox}><Search aria-hidden="true" /><Input type="search" aria-label="Search leavers" placeholder="Search name or code" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          {canManage && <Button variant="primary" icon={DoorOpen} onClick={onStart}>Start exit</Button>}
        </div>
      </div>
      <Panel flush fill>
        {clearance.error ? <div className={styles.pad}><ErrorState message={clearance.error.message} onRetry={() => void clearance.mutate()} /></div>
          : !clearance.data ? <SkeletonRows rows={4} columns={5} />
            : rows.length === 0 ? <EmptyState icon={DoorOpen} title={cases.length ? "Nobody matches" : "No exits in progress"}>Each exit collects no-dues from IT, finance and other owners before the full & final settlement.</EmptyState>
              : (
                <div className={ui.tableWrap}>
                  <table className={ui.table}>
                    <thead><tr><th>Leaver</th><th>Last working day</th><th>Clearance</th><th>Status</th></tr></thead>
                    <tbody>
                      {rows.map((entry) => {
                        const state = exitState({ settledCase: entry.settledCase, items: entry.items.length, settled: entry.settled, blockingOpen: entry.blockingOpen });
                        const days = daysUntil(entry.lastWorkingDay);
                        const share = entry.items.length ? Math.round((entry.settled / entry.items.length) * 100) : 0;
                        return (
                          <tr key={entry.caseId} className={ui.rowClickable} onClick={() => setOpenId(entry.caseId)}>
                            <td>
                              <button type="button" className={styles.personButton} onClick={(event) => { event.stopPropagation(); setOpenId(entry.caseId); }}>
                                <Avatar name={entry.leaverName ?? "?"} size={28} />
                                <span className={styles.person}><span className={styles.personName}>{entry.leaverName ?? "—"}</span><span className={styles.personCode}>{entry.leaverCode}</span></span>
                              </button>
                            </td>
                            <td className={ui.nowrap}>
                              <span className={styles.stacked}><span>{dateLabel(entry.lastWorkingDay)}</span>
                                {days !== null && !entry.settledCase && <span className={days < 0 ? styles.warnText : styles.sub}>{days === 0 ? "Today" : days > 0 ? `in ${days} days` : `${-days} days ago`}</span>}</span>
                            </td>
                            <td>
                              <span className={styles.progress}>
                                <span className={styles.progressBar} aria-hidden="true"><span style={{ width: `${share}%` }} /></span>
                                <span className={ui.mono}>{entry.settled}/{entry.items.length}</span>
                              </span>
                            </td>
                            <td><Badge tone={state.tone}>{state.label}</Badge></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
      </Panel>
      {open && <ExitDrawer entry={open} canManage={canManage} canSettle={canSettle} onClose={() => setOpenId(null)} onChanged={() => void clearance.mutate()} />}
    </div>
  );
}

function ExitDrawer({ entry, canManage, canSettle, onClose, onChanged }: { entry: ExitCase; canManage: boolean; canSettle: boolean; onClose: () => void; onChanged: () => void }) {
  const notify = useNotify();
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [waiving, setWaiving] = useState<ClearanceItem | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const [confirmSettle, setConfirmSettle] = useState(false);
  const state = exitState({ settledCase: entry.settledCase, items: entry.items.length, settled: entry.settled, blockingOpen: entry.blockingOpen });

  async function act(id: string, run: () => Promise<unknown>, done: string) {
    setBusy(id);
    setFailure(null);
    try {
      await run();
      notify.success(done, entry.leaverName ?? "Exit");
      onChanged();
    } catch (cause) {
      setFailure((cause as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Drawer open onOpenChange={(next) => { if (!next) onClose(); }} title={entry.leaverName ?? "Exit"}
      description={<span className={styles.drawerMeta}><Badge tone={state.tone}>{state.label}</Badge><span>{entry.leaverCode} · last day {dateLabel(entry.lastWorkingDay)}{entry.resignedOn ? ` · resigned ${dateLabel(entry.resignedOn)}` : ""}</span></span>}
      footer={canSettle && !entry.settledCase ? (
        <Button variant="primary" icon={Wallet} disabled={!state.canSettle} loading={busy === "settle"} onClick={() => setConfirmSettle(true)}>Compute full & final</Button>
      ) : undefined}>
      <div className={styles.drawerStack}>
        {failure && <Alert tone="danger">{failure}</Alert>}
        {!entry.settledCase && !state.canSettle && <Alert tone="info">Full & final can be computed once every item below is cleared or waived.</Alert>}
        <section aria-labelledby="clearance-heading">
          <h3 id="clearance-heading" className={styles.drawerHeading}>No-dues clearance · {entry.settled} of {entry.items.length} done</h3>
          <ol className={styles.checklist}>
            {entry.items.map((item) => {
              const settled = item.status === "cleared" || item.status === "waived";
              return (
                <li key={item.id} className={cx(styles.checkItem, settled && styles.checkDone)}>
                  {settled ? <CheckCircle2 className={styles.checkIcon} aria-hidden="true" /> : <Circle className={styles.checkIcon} aria-hidden="true" />}
                  <span className={styles.checkText}>
                    <span className={styles.checkTitle}>{item.item_name}{item.blocking && !settled && <Badge tone="warning">Blocks settlement</Badge>}</span>
                    <span className={styles.checkMeta}>
                      {item.owner_name ?? OWNER_LABEL[item.owner_code ?? ""] ?? item.owner_code ?? "Owner not set"}
                      {item.status === "waived" ? ` · waived${item.waive_reason ? `: ${item.waive_reason}` : ""}` : item.status === "cleared" ? ` · cleared${item.cleared_on ? ` ${dateLabel(item.cleared_on)}` : ""}` : item.status === "held" ? " · on hold" : ""}
                      {item.recovery_description ? ` · recovery: ${item.recovery_description}` : ""}
                    </span>
                  </span>
                  {canManage && item.status === "open" && (
                    <span className={styles.itemActions}>
                      <Button size="sm" icon={Check} loading={busy === item.id} onClick={() => void act(item.id, () => clearItem(item.id), "Item cleared")}>Clear</Button>
                      <Button size="sm" variant="ghost" icon={Ban} disabled={busy === item.id} onClick={() => setWaiving(item)}>Waive</Button>
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      <ConfirmDialog open={waiving !== null} title="Waive this clearance item?" confirmLabel="Waive" tone="danger"
        onCancel={() => { setWaiving(null); setReason(""); setReasonError(false); }}
        onConfirm={() => {
          if (reason.trim().length < 20) { setReasonError(true); return; }
          const item = waiving!;
          setWaiving(null);
          void act(item.id, () => waiveItem(item.id, reason.trim()), "Item waived").then(() => { setReason(""); setReasonError(false); });
        }}>
        <span className={styles.confirmText}>{waiving?.item_name}: settlement can go ahead without this clearance. The reason is kept in the audit trail.</span>
        <label className={styles.confirmLabel} htmlFor="waive-reason">Reason (at least 20 characters)</label>
        <Textarea id="waive-reason" rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} aria-invalid={reasonError} />
        {reasonError && <span className={styles.fieldError}>Explain the waiver in at least 20 characters.</span>}
      </ConfirmDialog>
      <ConfirmDialog open={confirmSettle} title="Compute the full & final settlement?" confirmLabel="Compute" onCancel={() => setConfirmSettle(false)}
        onConfirm={() => { setConfirmSettle(false); void act("settle", () => settleCase(entry.caseId), "Full & final computed"); }}>
        Salary up to today, earned-leave encashment and outstanding loan recovery are calculated and the exit is marked settled. Payroll pays it in the next run.
      </ConfirmDialog>
    </Drawer>
  );
}
