"use client";

import { useState } from "react";
import { Check, CheckCircle2, Circle, Search, UserPlus } from "lucide-react";
import { Alert, Avatar, Badge, Button, Drawer, EmptyState, ErrorState, Input, Panel, SkeletonRows, cx, ui } from "@/design/redesign/ui";
import { FilterPills, StatStrip, useNotify } from "@/modules/attendance/shared";
import { completeTask, useJoiners, type Joiner } from "./data";
import { OWNER_LABEL, dateLabel, joinerState, progress } from "./format";
import styles from "./Lifecycle.module.css";

type Filter = "open" | "ready" | "all";

/** New joiners and their onboarding checklists. */
export default function Joiners({ canManage, scope, onStart }: { canManage: boolean; scope: ((employeeId: string) => boolean) | null; onStart: () => void }) {
  const joiners = useJoiners();
  const [filter, setFilter] = useState<Filter>("open");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const all = (joiners.data ?? []).filter((row) => !scope || scope(row.employeeId));
  const needle = query.trim().toLowerCase();
  const rows = all
    .filter((row) => filter === "all" || (filter === "ready" ? joinerState(row).key === "ready" : joinerState(row).key !== "ready"))
    .filter((row) => !needle || `${row.employee.firstName} ${row.employee.lastName} ${row.employee.code} ${row.employee.department}`.toLowerCase().includes(needle));
  const open = all.find((row) => row.id === openId) ?? null;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className={styles.section}>
      <StatStrip label="Onboarding" items={[
        { label: "In onboarding", value: all.filter((row) => joinerState(row).key !== "ready").length },
        { label: "Joining in the next 30 days", value: all.filter((row) => row.employee.joiningDate && row.employee.joiningDate >= today && row.employee.joiningDate <= addDays(today, 30)).length },
        { label: "Required steps outstanding", value: all.reduce((total, row) => total + row.tasks.filter((task) => task.required && task.status !== "done").length, 0) },
        { label: "Completed", value: all.filter((row) => joinerState(row).key === "ready").length },
      ]} />
      <div className={styles.toolbar}>
        <FilterPills label="Onboarding status" value={filter} onChange={setFilter} options={[{ value: "open", label: "In progress" }, { value: "ready", label: "Ready" }, { value: "all", label: "All" }]} />
        <div className={styles.toolbarEnd}>
          <div className={ui.searchBox}><Search aria-hidden="true" /><Input type="search" aria-label="Search joiners" placeholder="Search name, code or department" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          {canManage && <Button variant="primary" icon={UserPlus} onClick={onStart}>Start onboarding</Button>}
        </div>
      </div>
      <Panel flush fill>
        {joiners.error ? <div className={styles.pad}><ErrorState message={joiners.error.message} onRetry={() => void joiners.mutate()} /></div>
          : !joiners.data ? <SkeletonRows rows={4} columns={5} />
            : rows.length === 0 ? <EmptyState icon={UserPlus} title={all.length ? "Nobody matches" : "No onboarding in progress"} action={canManage && !all.length ? <Button variant="primary" icon={UserPlus} onClick={onStart}>Start onboarding</Button> : undefined}>
              Each new joiner gets a checklist: documents, IT and access, payroll set-up, induction and the first weeks with their manager.
            </EmptyState>
              : (
                <div className={ui.tableWrap}>
                  <table className={ui.table}>
                    <thead><tr><th>Joiner</th><th className={styles.hideSm}>Department</th><th>Joining</th><th>Checklist</th><th>Status</th></tr></thead>
                    <tbody>
                      {rows.map((row) => {
                        const name = `${row.employee.firstName} ${row.employee.lastName}`.trim();
                        const state = joinerState(row);
                        const share = progress(row);
                        return (
                          <tr key={row.id} className={ui.rowClickable} onClick={() => setOpenId(row.id)}>
                            <td>
                              <button type="button" className={styles.personButton} onClick={(event) => { event.stopPropagation(); setOpenId(row.id); }}>
                                <Avatar name={name} size={28} />
                                <span className={styles.person}><span className={styles.personName}>{name}</span><span className={styles.personCode}>{row.employee.code} · {row.employee.designation || "—"}</span></span>
                              </button>
                            </td>
                            <td className={styles.hideSm}>{row.employee.department || "—"}</td>
                            <td className={ui.nowrap}>{dateLabel(row.employee.joiningDate)}</td>
                            <td>
                              <span className={styles.progress}>
                                <span className={styles.progressBar} aria-hidden="true"><span style={{ width: `${share}%` }} /></span>
                                <span className={ui.mono}>{row.total ? `${row.done}/${row.total}` : "No steps"}</span>
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
      {open && <JoinerDrawer joiner={open} canManage={canManage} onClose={() => setOpenId(null)} onChanged={() => void joiners.mutate()} />}
    </div>
  );
}

function JoinerDrawer({ joiner, canManage, onClose, onChanged }: { joiner: Joiner; canManage: boolean; onClose: () => void; onChanged: () => void }) {
  const notify = useNotify();
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const name = `${joiner.employee.firstName} ${joiner.employee.lastName}`.trim();
  const state = joinerState(joiner);
  const pendingRequired = joiner.tasks.filter((task) => task.required && task.status !== "done");

  async function done(taskId: string, title: string) {
    setBusy(taskId);
    setFailure(null);
    try {
      await completeTask(taskId);
      notify.success("Step completed", `${title} · ${name}`);
      onChanged();
    } catch (cause) {
      setFailure((cause as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Drawer open onOpenChange={(next) => { if (!next) onClose(); }} title={name}
      description={<span className={styles.drawerMeta}><Badge tone={state.tone}>{state.label}</Badge><span>{joiner.employee.code} · {joiner.employee.designation || "—"} · joins {dateLabel(joiner.employee.joiningDate)}</span></span>}>
      <div className={styles.drawerStack}>
        {failure && <Alert tone="danger">{failure}</Alert>}
        {joiner.total === 0
          ? <Alert tone="info">This onboarding has no checklist steps recorded. Steps are created when onboarding is started from a template.</Alert>
          : pendingRequired.length === 0
            ? <Alert tone="success">All required steps are done; {name.split(" ")[0]} is ready for day one.</Alert>
            : <Alert tone="warning">{pendingRequired.length} required {pendingRequired.length === 1 ? "step is" : "steps are"} still open before day one.</Alert>}
        <section aria-labelledby="checklist-heading">
          <h3 id="checklist-heading" className={styles.drawerHeading}>{joiner.templateName} · {joiner.done} of {joiner.total} done</h3>
          <ol className={styles.checklist}>
            {joiner.tasks.map((task) => {
              const complete = task.status === "done";
              return (
                <li key={task.id} className={cx(styles.checkItem, complete && styles.checkDone)}>
                  {complete ? <CheckCircle2 className={styles.checkIcon} aria-hidden="true" /> : <Circle className={styles.checkIcon} aria-hidden="true" />}
                  <span className={styles.checkText}>
                    <span className={styles.checkTitle}>{task.title}{!task.required && <span className={styles.optional}> · optional</span>}</span>
                    <span className={styles.checkMeta}>{OWNER_LABEL[task.owner] ?? task.owner}{complete ? " · done" : ""}</span>
                  </span>
                  {canManage && !complete && <Button size="sm" icon={Check} loading={busy === task.id} onClick={() => void done(task.id, task.title)}>Mark done</Button>}
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </Drawer>
  );
}

function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
