"use client";

import { useState } from "react";
import { Check, DoorOpen, Search, UserCheck, X } from "lucide-react";
import { Alert, Button, ConfirmDialog, EmptyState, ErrorState, Input, Panel, SkeletonRows, Textarea, cx, ui } from "@/design/redesign/ui";
import { decideGatePass, decideRegularisation, useGatePasses, useRegularisations, type GatePass, type Regularisation } from "./data";
import { dayLabel, hm, humanise } from "./format";
import { FilterPills, PersonCell, Stacked, StatusBadge, useNotify } from "./shared";
import styles from "./Attendance.module.css";

export type Kind = "regularisations" | "gate_passes";
type Filter = "awaiting" | "approved" | "rejected" | "all";

const isAwaiting = (status: string) => ["submitted", "pending_approval", "pending", "draft"].includes(status.toLowerCase());
const matches = (status: string, filter: Filter) =>
  filter === "all" || (filter === "awaiting" ? isAwaiting(status) : status.toLowerCase().startsWith(filter === "approved" ? "approve" : "reject") || (filter === "approved" && status === "credited"));

const KIND_LABEL: Record<string, string> = { "missing-punch": "Missing punch", "shift-correct": "Wrong shift", "break-correct": "Break correction" };

export default function Requests({ canDecide, canRequest, selfOnlyRequests, selfId, showCorrections, showGatePasses, initialKind, onNewRegularisation, onNewGatePass }: {
  canDecide: boolean; canRequest: boolean; selfOnlyRequests: boolean; selfId: string | null;
  /** Which request types the organisation's plan includes. */
  showCorrections: boolean; showGatePasses: boolean; initialKind?: Kind;
  onNewRegularisation: () => void; onNewGatePass: () => void;
}) {
  const [chosen, setKind] = useState<Kind>(initialKind ?? (showCorrections ? "regularisations" : "gate_passes"));
  const kind: Kind = !showGatePasses ? "regularisations" : !showCorrections ? "gate_passes" : chosen;
  const [filter, setFilter] = useState<Filter>("awaiting");
  const [query, setQuery] = useState("");
  const regularisations = useRegularisations(showCorrections);
  const gatePasses = useGatePasses(showGatePasses);

  // The regularisation list is organisation-wide; people who cannot decide see only their own.
  const regRows = (regularisations.data ?? []).filter((row) => canDecide || (selfId !== null && row.attributes?.employee_id === selfId));
  const passRows = gatePasses.data ?? [];
  const awaitingReg = regRows.filter((row) => isAwaiting(row.status)).length;
  const awaitingPass = passRows.filter((row) => isAwaiting(row.status)).length;
  const needle = query.trim().toLowerCase();

  return (
    <div className={styles.section}>
      {selfOnlyRequests && <Alert tone="info">You can see your requests here. Raising a new one is not yet enabled for your role, so ask HR or your manager to raise it for you.</Alert>}
      <div className={styles.toolbar}>
        {showCorrections && showGatePasses ? (
          <FilterPills label="Request type" value={kind} onChange={setKind} options={[
            { value: "regularisations", label: "Corrections", count: awaitingReg || undefined },
            { value: "gate_passes", label: "Gate passes", count: awaitingPass || undefined },
          ]} />
        ) : <h3 className={styles.sectionTitle}>{kind === "regularisations" ? "Attendance corrections" : "Gate passes"}</h3>}
        <div className={styles.toolbarEnd}>
          <div className={ui.searchBox}><Search aria-hidden="true" /><Input type="search" aria-label="Search requests" placeholder="Search name, code or reason" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          {canRequest && (kind === "regularisations"
            ? <Button variant="primary" icon={UserCheck} onClick={onNewRegularisation}>Request correction</Button>
            : <Button variant="primary" icon={DoorOpen} onClick={onNewGatePass}>Request gate pass</Button>)}
        </div>
      </div>
      <FilterPills label="Status" value={filter} onChange={setFilter} options={[
        { value: "awaiting", label: "Awaiting approval" }, { value: "approved", label: "Approved" }, { value: "rejected", label: "Rejected" }, { value: "all", label: "All" },
      ]} />
      {kind === "regularisations"
        ? <RegularisationTable rows={regRows.filter((row) => matches(row.status, filter) && (!needle || `${row.employeeName} ${row.employeeCode} ${row.reason}`.toLowerCase().includes(needle)))}
          loading={!regularisations.data && !regularisations.error} error={regularisations.error?.message ?? null} onRetry={() => void regularisations.mutate()}
          canDecide={canDecide} onChanged={() => void regularisations.mutate()} filter={filter} />
        : <GatePassTable rows={passRows.filter((row) => matches(row.status, filter) && (!needle || `${row.employee_name} ${row.employee_code} ${row.reason}`.toLowerCase().includes(needle)))}
          loading={!gatePasses.data && !gatePasses.error} error={gatePasses.error?.message ?? null} onRetry={() => void gatePasses.mutate()}
          canDecide={canDecide} onChanged={() => void gatePasses.mutate()} filter={filter} />}
    </div>
  );
}

function emptyTitle(filter: Filter, noun: string) {
  return filter === "awaiting" ? `No ${noun} waiting for approval` : filter === "all" ? `No ${noun} yet` : `No ${filter} ${noun}`;
}

/* ------------------------------------------------------------------ */

function RegularisationTable({ rows, loading, error, onRetry, canDecide, onChanged, filter }: {
  rows: Regularisation[]; loading: boolean; error: string | null; onRetry: () => void; canDecide: boolean; onChanged: () => void; filter: Filter;
}) {
  const notify = useNotify();
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Regularisation | null>(null);

  async function decide(row: Regularisation, approve: boolean) {
    setBusy(row.id);
    try {
      await decideRegularisation(row.id, approve);
      notify.success(approve ? "Correction approved" : "Correction rejected", `${row.employeeName ?? "The employee"} · ${dayLabel(row.date)}`);
      onChanged();
    } catch (cause) {
      notify.error("Not saved", (cause as Error).message);
    } finally {
      setBusy(null);
      setRejecting(null);
    }
  }

  return (
    <Panel flush>
      {error ? <div className={styles.pad}><ErrorState message={error} onRetry={onRetry} /></div>
        : loading ? <SkeletonRows rows={4} columns={5} />
          : rows.length === 0 ? <EmptyState icon={UserCheck} title={emptyTitle(filter, "corrections")}>Requests to fix a missed punch, a wrong shift or a break show here.</EmptyState>
            : (
              <div className={ui.tableWrap}>
                <table className={ui.table}>
                  <thead><tr><th>Employee</th><th>Day</th><th>Correction</th><th className={styles.hideSm}>Reason</th><th>Status</th>{canDecide && <th aria-label="Decision" />}</tr></thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td><PersonCell name={row.employeeName} code={row.employeeCode} /></td>
                        <td className={ui.nowrap}>{dayLabel(row.date)}</td>
                        <td><Stacked main={KIND_LABEL[row.kind ?? ""] ?? humanise(row.kind)} sub={[row.claimedIn && `In ${row.claimedIn}`, row.claimedOut && `Out ${row.claimedOut}`].filter(Boolean).join(" · ") || undefined} /></td>
                        <td className={cx(styles.hideSm, styles.reason)}>{row.reason ?? "—"}</td>
                        <td><StatusBadge status={row.status} /></td>
                        {canDecide && (
                          <td className={styles.rowActions}>
                            {isAwaiting(row.status) && (
                              <span className={styles.decision}>
                                <Button size="sm" icon={Check} loading={busy === row.id} onClick={() => void decide(row, true)}>Approve</Button>
                                <Button size="sm" variant="ghost" icon={X} disabled={busy === row.id} onClick={() => setRejecting(row)}>Reject</Button>
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
      <ConfirmDialog open={rejecting !== null} title="Reject this correction?" confirmLabel="Reject" tone="danger" onCancel={() => setRejecting(null)} onConfirm={() => rejecting && void decide(rejecting, false)}>
        {rejecting ? `${rejecting.employeeName ?? "The employee"}'s request for ${dayLabel(rejecting.date)} will be closed and the day stays as recorded.` : ""}
      </ConfirmDialog>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */

function GatePassTable({ rows, loading, error, onRetry, canDecide, onChanged, filter }: {
  rows: GatePass[]; loading: boolean; error: string | null; onRetry: () => void; canDecide: boolean; onChanged: () => void; filter: Filter;
}) {
  const notify = useNotify();
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<GatePass | null>(null);
  const [remarks, setRemarks] = useState("");
  const [remarksError, setRemarksError] = useState(false);

  async function decide(row: GatePass, approve: boolean, note?: string) {
    setBusy(row.id);
    try {
      await decideGatePass(row.id, approve, note);
      notify.success(approve ? "Gate pass approved" : "Gate pass rejected", `${row.employee_name} · ${dayLabel(row.date)}`);
      onChanged();
    } catch (cause) {
      notify.error("Not saved", (cause as Error).message);
    } finally {
      setBusy(null);
      setRejecting(null);
      setRemarks("");
      setRemarksError(false);
    }
  }

  return (
    <Panel flush>
      {error ? <div className={styles.pad}><ErrorState message={error} onRetry={onRetry} /></div>
        : loading ? <SkeletonRows rows={4} columns={6} />
          : rows.length === 0 ? <EmptyState icon={DoorOpen} title={emptyTitle(filter, "gate passes")}>Requests to leave the premises during a shift show here.</EmptyState>
            : (
              <div className={ui.tableWrap}>
                <table className={ui.table}>
                  <thead><tr><th>Employee</th><th>Day</th><th>Time out</th><th>Type</th><th className={styles.hideSm}>Reason</th><th>Status</th>{canDecide && <th aria-label="Decision" />}</tr></thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td><PersonCell name={row.employee_name} code={row.employee_code} /></td>
                        <td className={ui.nowrap}>{dayLabel(row.date)}</td>
                        <td className={ui.nowrap}><Stacked main={row.from_time && row.to_time ? `${row.from_time}–${row.to_time}` : "—"} sub={row.minutes ? hm(row.minutes) : undefined} /></td>
                        <td>{humanise(row.pass_type)}</td>
                        <td className={cx(styles.hideSm, styles.reason)}><Stacked main={row.reason ?? "—"} sub={row.rejection_note ?? row.decision_remarks ?? undefined} /></td>
                        <td><StatusBadge status={row.status} /></td>
                        {canDecide && (
                          <td className={styles.rowActions}>
                            {row.status === "pending_approval" && (
                              <span className={styles.decision}>
                                <Button size="sm" icon={Check} loading={busy === row.id} onClick={() => void decide(row, true)}>Approve</Button>
                                <Button size="sm" variant="ghost" icon={X} disabled={busy === row.id} onClick={() => setRejecting(row)}>Reject</Button>
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
      <ConfirmDialog open={rejecting !== null} title="Reject this gate pass?" confirmLabel="Reject" tone="danger" onCancel={() => { setRejecting(null); setRemarks(""); setRemarksError(false); }}
        onConfirm={() => { if (!remarks.trim()) { setRemarksError(true); return; } if (rejecting) void decide(rejecting, false, remarks.trim()); }}>
        <label className={styles.confirmLabel} htmlFor="gp-remarks">Remarks for {rejecting?.employee_name ?? "the employee"} (required)</label>
        <Textarea id="gp-remarks" rows={2} maxLength={300} value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="For example: production line short-staffed that afternoon" aria-invalid={remarksError} aria-describedby={remarksError ? "gp-remarks-error" : undefined} />
        {remarksError && <span id="gp-remarks-error" className={styles.fieldError}>Enter the remarks the employee will see.</span>}
      </ConfirmDialog>
    </Panel>
  );
}
