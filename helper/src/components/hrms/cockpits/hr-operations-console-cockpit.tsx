"use client";

/**
 * S2 · HR Operations Console.
 *
 * The approval queue is the point of this page, so it leads: real items, real
 * ageing where the source records a creation timestamp, and an SLA verdict read
 * from the date the record itself carries. Where a figure has no source the
 * panel says so in words taken from the aggregation envelope
 * (DESIGN_SYSTEM.md section 9).
 */

import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Inbox,
  LifeBuoy,
  RefreshCw,
  Timer,
} from "lucide-react";
import { ConversionFunnel, MatrixHeatmap } from "../cockpit-charts";
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
import { dateLabel, useLive } from "../workforce/records";

/* -------------------------------------------------------------------------- */
/* Payload shape (mirrors src/server/cockpits/hr-operations-console.ts)        */
/* -------------------------------------------------------------------------- */

type Envelope<T> = { value: T; available: boolean; message?: string; origin?: string };

type SlaState = "breached" | "due_today" | "within" | "unknown";

type ApprovalItem = {
  id: string;
  queue: string;
  type: string;
  requester: string;
  reference: string;
  status: string;
  createdAt: string | null;
  ageDays: number | null;
  dueOn: string | null;
  dueBasis: string;
  sla: SlaState;
  href: string;
};

type FunnelStage = { label: string; value: number };
type MatrixView = { rows: string[]; columns: string[]; values: Array<Array<number | null>> };

type Payload = {
  cockpit: { id: string; code: string; label: string; description: string };
  today: string;
  kpis: {
    pendingApprovals: Envelope<number | null>;
    breachedItems: Envelope<number | null>;
    oldestQueueAgeDays: Envelope<number | null>;
    dayOneReady: Envelope<number | null>;
  };
  approvals: Envelope<{ items: ApprovalItem[]; queues: string[]; ageingNote: string }>;
  onboardingFunnel: Envelope<{ stages: FunnelStage[]; note: string }>;
  absenceDensity: Envelope<MatrixView & { note: string }>;
  helpdeskByCategory: Envelope<Array<{ label: string; value: number }>>;
  unavailableSources: Array<{ name: string; message: string }>;
};

/* -------------------------------------------------------------------------- */
/* Local presentation helpers                                                  */
/* -------------------------------------------------------------------------- */

const ENDPOINT = "/api/v1/cockpits/hr-operations-console";

const SLA_PRESENTATION: Record<SlaState, { tone: "danger" | "warning" | "success" | "neutral"; label: string }> = {
  breached: { tone: "danger", label: "Past due" },
  due_today: { tone: "warning", label: "Due today" },
  within: { tone: "success", label: "Within date" },
  unknown: { tone: "neutral", label: "No due date" },
};

function FeedBody({
  feed,
  children,
  emptyTitle,
}: {
  feed: { available: boolean; message?: string };
  children: React.ReactNode;
  emptyTitle: string;
}) {
  if (feed.available) return <>{children}</>;
  return (
    <StateBlock
      tone="error"
      icon={AlertTriangle}
      title={emptyTitle}
      description={feed.message ?? "This source is unavailable for your role or this tenant."}
    />
  );
}

function Provenance({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[11px] leading-[17px] text-muted-foreground">{children}</p>;
}

/**
 * Helpdesk volume as token-driven horizontal bars. Values stay selectable text
 * so the reading never depends on bar length alone.
 */
function CategoryBars({ bars }: { bars: Array<{ label: string; value: number }> }) {
  if (bars.length === 0) {
    return (
      <StateBlock
        tone="empty"
        icon={LifeBuoy}
        title="No categorised tickets"
        description="Requests appear here once helpdesk tickets are raised against a category."
      />
    );
  }
  const max = Math.max(...bars.map((bar) => bar.value), 1);
  const total = bars.reduce((sum, bar) => sum + bar.value, 0);
  return (
    <ul className="grid gap-3">
      {bars.map((bar, index) => (
        <li key={bar.label} className="min-w-0">
          <div className="flex min-w-0 items-baseline justify-between gap-2">
            <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground" title={bar.label}>
              {bar.label}
            </span>
            <span className="shrink-0 font-mono text-[12px] font-bold text-foreground tabular-nums">{bar.value}</span>
            <span className="w-[46px] shrink-0 text-right font-mono text-[11px] text-muted-foreground tabular-nums">
              {total > 0 ? `${Math.round((bar.value / total) * 100)}%` : "—"}
            </span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${(bar.value / max) * 100}%`,
                background: `var(--chart-${(index % 5) + 1})`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Cockpit                                                                     */
/* -------------------------------------------------------------------------- */

export function HrOperationsConsoleCockpit() {
  const state = useLive<{ data?: Payload }>(ENDPOINT);
  const payload = state.data?.data ?? null;

  const approvalColumns: Column<ApprovalItem>[] = [
    {
      key: "requester",
      header: "Requester",
      width: "180px",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-foreground">{row.requester}</p>
          <p className="truncate text-[11px] text-muted-foreground" title={row.reference}>
            {row.reference}
          </p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      width: "150px",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-[12px] font-medium text-foreground">{row.type}</p>
          <p className="truncate text-[11px] text-muted-foreground">{row.queue}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "130px",
      render: (row) => (
        <StatusPill tone="info" dot>
          {row.status}
        </StatusPill>
      ),
    },
    {
      key: "age",
      header: "Queue age",
      align: "right",
      width: "110px",
      render: (row) =>
        row.ageDays === null ? (
          <span className="font-mono text-[12px] text-muted-foreground" title="This source records no submission timestamp.">
            —
          </span>
        ) : (
          <span className="font-mono text-[13px] font-bold text-foreground tabular-nums">
            {row.ageDays}
            <span className="ml-1 text-[11px] font-medium text-muted-foreground">d</span>
          </span>
        ),
    },
    {
      key: "due",
      header: "Needed by",
      width: "150px",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-mono text-[12px] text-foreground">{row.dueOn ? dateLabel(row.dueOn) : "—"}</p>
          <p className="truncate text-[11px] text-muted-foreground">{row.dueBasis}</p>
        </div>
      ),
    },
    {
      key: "sla",
      header: "SLA",
      width: "130px",
      render: (row) => (
        <StatusPill tone={SLA_PRESENTATION[row.sla].tone} dot>
          {SLA_PRESENTATION[row.sla].label}
        </StatusPill>
      ),
    },
    {
      key: "open",
      header: "",
      align: "right",
      width: "90px",
      render: (row) => (
        <Link
          href={row.href}
          className="inline-flex h-10 items-center rounded-lg border border-border px-3 text-[12px] font-semibold text-foreground transition-colors duration-150 hover:bg-secondary"
        >
          Open
        </Link>
      ),
    },
  ];

  const unavailableColumns: Column<{ name: string; message: string }>[] = [
    {
      key: "name",
      header: "Feed",
      width: "180px",
      render: (row) => <span className="font-mono text-[12px] font-semibold text-foreground">{row.name}</span>,
    },
    {
      key: "message",
      header: "Why it is not shown",
      render: (row) => <span className="text-[12px] text-muted-foreground">{row.message}</span>,
    },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px]">
      <PageIntro
        eyebrow="S2 · Operations console"
        title="HR Operations Console"
        description="What is waiting on somebody, how long it has waited, and whether it has passed the date the record itself carries. Ageing is shown only where the source records a submission time."
        action={
          <button
            type="button"
            onClick={state.refresh}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground transition-colors duration-150 hover:bg-secondary"
          >
            <RefreshCw className="size-4" strokeWidth={2} />
            Refresh
          </button>
        }
      />

      {state.error && (
        <Surface className="mb-6">
          <StateBlock tone="error" icon={AlertTriangle} title="This console could not be loaded" description={state.error} />
        </Surface>
      )}

      {!payload && !state.error && (
        <Surface>
          <StateBlock tone="loading" title="Loading the operations console…" description="Reading approval queues, joining chains and leave records." />
        </Surface>
      )}

      {payload && (
        <div className="grid gap-4">
          {/* ------------------------------------------------------ KPI strip */}
          <section aria-label="Headline operations measures" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Items awaiting action"
              icon={Inbox}
              tone="primary"
              value={
                payload.kpis.pendingApprovals.available && payload.kpis.pendingApprovals.value !== null ? (
                  payload.kpis.pendingApprovals.value.toLocaleString()
                ) : (
                  <span className="text-[15px] font-semibold text-muted-foreground">Unavailable</span>
                )
              }
              hint={payload.kpis.pendingApprovals.available ? payload.kpis.pendingApprovals.origin : payload.kpis.pendingApprovals.message}
            />
            <StatTile
              label="Past their own due date"
              icon={AlertTriangle}
              tone="danger"
              value={
                payload.kpis.breachedItems.available && payload.kpis.breachedItems.value !== null ? (
                  payload.kpis.breachedItems.value.toLocaleString()
                ) : (
                  <span className="text-[15px] font-semibold text-muted-foreground">Unavailable</span>
                )
              }
              hint={payload.kpis.breachedItems.available ? payload.kpis.breachedItems.origin : payload.kpis.breachedItems.message}
            />
            <StatTile
              label="Oldest waiting item"
              icon={Timer}
              tone="warning"
              value={
                payload.kpis.oldestQueueAgeDays.available && payload.kpis.oldestQueueAgeDays.value !== null ? (
                  `${payload.kpis.oldestQueueAgeDays.value} d`
                ) : (
                  <span className="text-[15px] font-semibold text-muted-foreground">Unavailable</span>
                )
              }
              hint={payload.kpis.oldestQueueAgeDays.available ? payload.kpis.oldestQueueAgeDays.origin : payload.kpis.oldestQueueAgeDays.message}
            />
            <StatTile
              label="Day-1 ready joiners"
              icon={CheckCircle2}
              tone="success"
              value={
                payload.kpis.dayOneReady.available && payload.kpis.dayOneReady.value !== null ? (
                  payload.kpis.dayOneReady.value.toLocaleString()
                ) : (
                  <span className="text-[15px] font-semibold text-muted-foreground">Unavailable</span>
                )
              }
              hint={payload.kpis.dayOneReady.available ? payload.kpis.dayOneReady.origin : payload.kpis.dayOneReady.message}
            />
          </section>

          {/* ------------------------------------------------- approvals queue */}
          <Surface className="min-w-0 p-0">
            <div className="p-5 pb-0">
              <SectionHeading
                title="Pending approvals, oldest first"
                description={
                  payload.approvals.value.queues.length > 0
                    ? `Queues read: ${payload.approvals.value.queues.join(", ")}.`
                    : "No queue resolved for your role."
                }
                action={
                  payload.approvals.available ? (
                    <StatusPill tone="info" dot>
                      {payload.approvals.value.items.length} item(s)
                    </StatusPill>
                  ) : undefined
                }
              />
            </div>
            <FeedBody feed={payload.approvals} emptyTitle="The approval queue cannot be read">
              <DataTable
                columns={approvalColumns}
                rows={payload.approvals.value.items}
                rowKey={(row) => row.id}
                minWidth={1000}
                caption="Items awaiting action, ordered by queue age"
                empty={
                  <StateBlock
                    tone="empty"
                    icon={ClipboardList}
                    title="Nothing is waiting on an approver"
                    description="Leave, helpdesk, expense and travel queues are all clear for the records you can see."
                  />
                }
              />
              <div className="p-5 pt-3">
                <p className="text-[11px] leading-[17px] text-muted-foreground">{payload.approvals.value.ageingNote}</p>
                <Provenance>{payload.approvals.origin}</Provenance>
              </div>
            </FeedBody>
          </Surface>

          {/* ------------------------------------- onboarding + helpdesk split */}
          <section className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
            <Surface className="min-w-0">
              <SectionHeading title="Onboarding pipeline" description="Each stage is a subset of the one above it." />
              <FeedBody feed={payload.onboardingFunnel} emptyTitle="The onboarding pipeline cannot be read">
                <ConversionFunnel
                  stages={payload.onboardingFunnel.value.stages}
                  ariaLabel="Onboarding pipeline by stage"
                  emptyTitle="No joining chain has been raised"
                  emptyNote="Stages populate once onboarding is started for a joiner."
                />
                <Provenance>
                  {payload.onboardingFunnel.origin}. {payload.onboardingFunnel.value.note}
                </Provenance>
              </FeedBody>
            </Surface>

            <Surface className="min-w-0">
              <SectionHeading title="Helpdesk requests by category" description="Every recorded ticket, not only the open ones." />
              <FeedBody feed={payload.helpdeskByCategory} emptyTitle="Helpdesk volume cannot be read">
                <CategoryBars bars={payload.helpdeskByCategory.value} />
                <Provenance>{payload.helpdeskByCategory.origin}</Provenance>
              </FeedBody>
            </Surface>
          </section>

          {/* -------------------------------------------------- absence density */}
          <Surface className="min-w-0">
            <SectionHeading title="Absence density" description="Person-days of approved leave, by week and weekday." />
            <FeedBody feed={payload.absenceDensity} emptyTitle="Absence density cannot be read">
              <MatrixHeatmap
                rows={payload.absenceDensity.value.rows}
                columns={payload.absenceDensity.value.columns}
                values={payload.absenceDensity.value.values}
                valueLabel="Person-days on leave"
                ariaLabel="Approved leave person-days by week and weekday"
                emptyTitle="No approved leave in the window"
                emptyNote="Cells fill in once approved leave spans fall inside the last eight weeks."
              />
              <Provenance>
                {payload.absenceDensity.origin}. {payload.absenceDensity.value.note}
              </Provenance>
            </FeedBody>
          </Surface>

          {/* ------------------------------------------------- unavailable feeds */}
          {payload.unavailableSources.length > 0 && (
            <Surface className="min-w-0 p-0">
              <div className="p-5 pb-0">
                <SectionHeading
                  title="Feeds not available to you"
                  description="These sources did not resolve for your role or this tenant, so every panel that depends on them states so above."
                  action={<StatusPill tone="warning" dot>{payload.unavailableSources.length} feed(s)</StatusPill>}
                />
              </div>
              <DataTable
                columns={unavailableColumns}
                rows={payload.unavailableSources}
                rowKey={(row) => row.name}
                minWidth={560}
                caption="Cockpit feeds that did not resolve"
              />
            </Surface>
          )}

          <p className="flex items-center gap-2 px-1 pb-2 text-[11px] text-muted-foreground">
            <CalendarClock className="size-3.5 shrink-0" strokeWidth={2} />
            Queues and dates as at {dateLabel(payload.today)}.
          </p>
        </div>
      )}
    </div>
  );
}
