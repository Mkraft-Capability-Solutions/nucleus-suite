"use client";

import { useCallback, useMemo, useState } from "react";
import {
  CalendarClock,
  CircleSlash,
  ClipboardCheck,
  Inbox,
  RefreshCcw,
  ShieldAlert,
  UserCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComparisonRadar, StackedCapacityBars } from "../cockpit-charts";
import {
  DataTable,
  PageIntro,
  SectionHeading,
  StateBlock,
  StatTile,
  StatusPill,
  Surface,
  type Column,
} from "../page-primitives";
import { currencyLabel, runTransition, statusTone, useLive } from "../workforce/records";

/**
 * S7 Manager Cockpit.
 *
 * Every panel is fed by `/api/v1/cockpits/manager-cockpit`, which scopes the
 * whole page to the signed-in manager's own direct reports. Where a feed did
 * not resolve the panel says so in the server's own words instead of drawing a
 * zero (DESIGN_SYSTEM.md section 9), and no action is rendered unless it maps
 * onto a real decision endpoint.
 */

type Source<T> = { value: T; available: boolean; message?: string; origin?: string };

type TeamMember = {
  employeeId: string;
  employeeCode: string;
  name: string;
  designation: string;
  department: string;
  presentToday: boolean;
  attendanceRecordedToday: boolean;
};

type CapacityBar = { label: string; delivering: number; onLeave: number; inTraining: number };

type SkillAxis = { axis: string; current: number; comparison: number };

type TriageItem = {
  id: string;
  kind: "leave" | "comp-off" | "expense" | "timesheet";
  kindLabel: string;
  resource: string | null;
  version: number;
  employeeId: string;
  employeeName: string;
  title: string;
  detail: string;
  status: string;
  amountMinor: number | null;
  currency: string | null;
  reasonRequired: boolean;
};

type CockpitData = {
  manager: { employeeId: string | null; linked: boolean };
  today: string;
  team: Source<TeamMember[]>;
  kpis: {
    teamSize: Source<number>;
    presentToday: Source<number>;
    onLeaveToday: Source<number>;
    pendingApprovals: Source<number>;
  };
  capacity: Source<CapacityBar[]>;
  skills: Source<{ axes: SkillAxis[]; teamSize: number; sampled: number }>;
  triage: Source<TriageItem[]>;
  triageByKind: Array<{ label: string; value: number }>;
  unavailableSources: Array<{ name: string; message: string }>;
};

type Envelope = { data: CockpitData };

const ENDPOINT = "/api/v1/cockpits/manager-cockpit";

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

/** A figure we hold, or an em dash plus the reason we do not. */
function tileValue(feed: Source<number> | undefined): string {
  if (!feed || !feed.available) return "—";
  return String(feed.value);
}

function tileHint(feed: Source<number> | undefined, hint: string): string {
  if (!feed) return "Not reported.";
  return feed.available ? hint : (feed.message ?? "This figure is unavailable for your role.");
}

type Decision = { item: TriageItem; approve: boolean };

export function ManagerCockpitCockpit() {
  const { data, loading, error, refresh } = useLive<Envelope>(ENDPOINT);
  const cockpit = data?.data;

  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const triageRows = useMemo(() => cockpit?.triage.value ?? [], [cockpit]);

  const openDecision = useCallback((item: TriageItem, approve: boolean) => {
    setDecision({ item, approve });
    setReason("");
    setFeedback(null);
  }, []);

  const submit = useCallback(async () => {
    if (!decision) return;
    const { item, approve } = decision;
    const trimmed = reason.trim();
    setBusy(true);
    try {
      if (item.resource) {
        // Operational engine: the transition itself is the decision endpoint,
        // and it refuses anything shorter than a three-character reason.
        const result = await runTransition(item.resource, item.id, item.version, approve ? "approve" : "reject", {
          reason: trimmed,
        });
        setFeedback({ ok: result.ok, message: result.message });
        if (result.ok) setDecision(null);
      } else {
        const response = await fetch(`/api/v1/leave-requests/${item.id}/decide`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ approve, ...(trimmed === "" ? {} : { comment: trimmed }) }),
          cache: "no-store",
        });
        const payload = asRecord(await response.json().catch(() => null));
        if (response.ok) {
          setFeedback({ ok: true, message: approve ? "Leave approved." : "Leave rejected." });
          setDecision(null);
        } else {
          // Segregation of duties, double-approval and self-approval refusals
          // are the server's words and are shown exactly as they arrive.
          const detail = asRecord(payload.error);
          setFeedback({
            ok: false,
            message:
              typeof detail.message === "string" && detail.message.trim() !== ""
                ? detail.message
                : `The decision was refused (${response.status}).`,
          });
        }
      }
      refresh();
    } finally {
      setBusy(false);
    }
  }, [decision, reason, refresh]);

  const columns: Column<TriageItem>[] = useMemo(
    () => [
      {
        key: "kind",
        header: "Type",
        width: "120px",
        render: (row) => <StatusPill tone="info">{row.kindLabel}</StatusPill>,
      },
      {
        key: "person",
        header: "Report",
        render: (row) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{row.employeeName}</p>
            <p className="truncate text-[12px] text-muted-foreground">{row.title}</p>
          </div>
        ),
      },
      {
        key: "detail",
        header: "Detail",
        render: (row) => <span className="text-[12px] text-muted-foreground">{row.detail}</span>,
      },
      {
        key: "amount",
        header: "Amount",
        align: "right",
        render: (row) =>
          row.amountMinor === null ? (
            <span className="text-[12px] text-muted-foreground">—</span>
          ) : (
            <span className="font-mono text-[13px] font-semibold text-foreground tabular-nums">
              {currencyLabel(row.amountMinor, row.currency ?? "INR")}
            </span>
          ),
      },
      {
        key: "status",
        header: "Status",
        render: (row) => <StatusPill tone={statusTone(row.status.toLowerCase())}>{row.status}</StatusPill>,
      },
      {
        key: "actions",
        header: <span className="sr-only">Decision</span>,
        align: "right",
        width: "190px",
        render: (row) => (
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => openDecision(row, true)}
              aria-label={`Approve ${row.kindLabel.toLowerCase()} for ${row.employeeName}`}
            >
              Approve
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => openDecision(row, false)}
              aria-label={`Reject ${row.kindLabel.toLowerCase()} for ${row.employeeName}`}
            >
              Reject
            </Button>
          </div>
        ),
      },
    ],
    [openDecision],
  );

  const reasonRequired = decision ? decision.item.reasonRequired : false;
  const reasonTooShort = reasonRequired && reason.trim().length < 3;

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px]">
      <PageIntro
        eyebrow="S7 · MANAGER COCKPIT"
        title="Manager Cockpit"
        description="Your team's capacity, skill coverage and the decisions waiting on you. Everything here is scoped to your own direct reports."
        action={
          <Button type="button" variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCcw className="size-4" />
            Refresh
          </Button>
        }
      />

      {loading && (
        <Surface>
          <StateBlock tone="loading" title="Loading your team" description="Reading attendance, leave and approval queues." />
        </Surface>
      )}

      {error !== "" && (
        <Surface>
          <StateBlock tone="error" icon={ShieldAlert} title="This cockpit could not be loaded" description={error} />
        </Surface>
      )}

      {cockpit && (
        <div className="grid gap-5">
          {!cockpit.manager.linked && (
            <Surface>
              <StateBlock
                tone="empty"
                icon={CircleSlash}
                title="No reporting line for this account"
                description="This account is not linked to an employee record, so no direct reports can be resolved. Ask your HR administrator to link it."
              />
            </Surface>
          )}

          <section aria-label="Team indicators" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Team size"
              value={tileValue(cockpit.kpis.teamSize)}
              icon={Users}
              tone="primary"
              hint={tileHint(cockpit.kpis.teamSize, "Employees reporting directly to you.")}
            />
            <StatTile
              label="Present today"
              value={tileValue(cockpit.kpis.presentToday)}
              icon={UserCheck}
              tone="success"
              hint={tileHint(cockpit.kpis.presentToday, `Attendance recorded for ${cockpit.today}.`)}
            />
            <StatTile
              label="On leave today"
              value={tileValue(cockpit.kpis.onLeaveToday)}
              icon={CalendarClock}
              tone="warning"
              hint={tileHint(cockpit.kpis.onLeaveToday, "Approved leave covering today.")}
            />
            <StatTile
              label="Pending approvals"
              value={tileValue(cockpit.kpis.pendingApprovals)}
              icon={ClipboardCheck}
              tone="info"
              hint={tileHint(cockpit.kpis.pendingApprovals, "Items in the triage queue below.")}
            />
          </section>

          <div className="grid min-w-0 gap-5 xl:grid-cols-2">
            <Surface>
              <SectionHeading
                title="Team capacity, next four weeks"
                description="Delivering, on leave and in training, from approved leave, published rosters and open learning enrolments."
              />
              {cockpit.capacity.available ? (
                <StackedCapacityBars
                  bars={cockpit.capacity.value}
                  emptyTitle="No capacity to project"
                  emptyNote="Capacity appears once you have direct reports with leave, roster or learning records."
                />
              ) : (
                <StateBlock
                  tone="empty"
                  icon={CircleSlash}
                  title="Capacity cannot be computed"
                  description={cockpit.capacity.message}
                />
              )}
              {cockpit.capacity.available && cockpit.capacity.value.length > 0 && (
                <p className="mt-3 text-[12px] text-muted-foreground">
                  {cockpit.capacity.value.length} week{cockpit.capacity.value.length === 1 ? "" : "s"} shown — only weeks
                  the records can speak to are drawn.
                </p>
              )}
            </Surface>

            <Surface>
              <SectionHeading
                title="Team skill coverage"
                description="Share of the team carrying each skill, and the share whose evidence is verified."
              />
              {cockpit.skills.available && cockpit.skills.value.axes.length > 0 ? (
                <>
                  <ComparisonRadar
                    axes={cockpit.skills.value.axes}
                    currentLabel="Verified"
                    comparisonLabel="Recorded"
                  />
                  <p className="mt-3 text-[12px] text-muted-foreground">
                    Percentage of {cockpit.skills.value.teamSize} report
                    {cockpit.skills.value.teamSize === 1 ? "" : "s"} sampled from the employee skill register.
                  </p>
                </>
              ) : (
                <StateBlock
                  tone="empty"
                  icon={CircleSlash}
                  title="No skill evidence recorded for this team"
                  description={
                    cockpit.skills.message ??
                    "Nobody reporting to you has a skill recorded in the employee skill register yet, so coverage cannot be drawn."
                  }
                />
              )}
            </Surface>
          </div>

          <Surface className="p-0">
            <div className="p-5 pb-0">
              <SectionHeading
                title="Quick triage"
                description="Leave, comp-off, expense and timesheet items from your reports, decided against the platform's own approval endpoints."
                action={
                  cockpit.triageByKind.length > 0 ? (
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {cockpit.triageByKind.map((entry) => (
                        <StatusPill key={entry.label} tone="neutral">
                          {entry.label} {entry.value}
                        </StatusPill>
                      ))}
                    </div>
                  ) : undefined
                }
              />
            </div>

            {decision && (
              <div className="mx-5 mb-4 rounded-lg border border-border bg-secondary/50 p-4">
                <p className="text-sm font-semibold text-foreground">
                  {decision.approve ? "Approve" : "Reject"} {decision.item.kindLabel.toLowerCase()} ·{" "}
                  {decision.item.employeeName}
                </p>
                <p className="mt-1 text-[12px] text-muted-foreground">{decision.item.detail}</p>
                <label
                  htmlFor="triage-reason"
                  className="mt-3 block text-[12px] font-medium text-muted-foreground"
                >
                  Reason {reasonRequired ? "(required by the server, at least 3 characters)" : "(optional)"}
                </label>
                <textarea
                  id="triage-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={2}
                  maxLength={1000}
                  className="mt-1.5 w-full min-w-0 rounded-lg border border-border bg-background p-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" onClick={submit} disabled={busy || reasonTooShort}>
                    {busy ? "Sending…" : "Confirm decision"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setDecision(null)} disabled={busy}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {feedback && (
              <p
                role={feedback.ok ? "status" : "alert"}
                className={`mx-5 mb-4 rounded-lg border p-3 text-[13px] ${
                  feedback.ok
                    ? "border-success/25 bg-success/10 text-success"
                    : "border-destructive/25 bg-destructive/10 text-destructive"
                }`}
              >
                {feedback.message}
              </p>
            )}

            {cockpit.triage.available ? (
              <DataTable
                columns={columns}
                rows={triageRows}
                rowKey={(row) => `${row.kind}-${row.id}`}
                minWidth={940}
                caption="Approval items awaiting your decision"
                empty={
                  <StateBlock
                    tone="empty"
                    icon={Inbox}
                    title="Nothing waiting on you"
                    description="No leave, comp-off, expense or timesheet item from your reports is pending a decision."
                  />
                }
              />
            ) : (
              <StateBlock
                tone="empty"
                icon={CircleSlash}
                title="The approval queues are unavailable"
                description={cockpit.triage.message}
              />
            )}
          </Surface>

          {cockpit.unavailableSources.length > 0 && (
            <Surface>
              <SectionHeading
                title="Sources not available to this account"
                description="These feeds were refused or are not configured, so the panels above leave them out rather than estimate them."
              />
              <ul className="grid gap-2">
                {cockpit.unavailableSources.map((entry) => (
                  <li key={entry.name} className="flex min-w-0 flex-wrap items-baseline gap-2">
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {entry.name}
                    </span>
                    <span className="min-w-0 flex-1 text-[12px] text-muted-foreground">{entry.message}</span>
                  </li>
                ))}
              </ul>
            </Surface>
          )}
        </div>
      )}
    </div>
  );
}
