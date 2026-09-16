"use client";

/**
 * S1 · People Command Centre.
 *
 * Every panel here renders one of three things and nothing else: the real
 * figure, an honest empty state, or the factual reason the feed is unavailable
 * as reported by the aggregation envelope. No specimen numbers appear anywhere
 * in this file (DESIGN_SYSTEM.md section 9).
 */

import { useMemo } from "react";
import {
  AlertTriangle,
  Gauge,
  IndianRupee,
  RefreshCw,
  Scale,
  TrendingDown,
  Users,
} from "lucide-react";
import {
  BubbleScatter,
  ComparisonRadar,
  DualAxisTrend,
  MatrixHeatmap,
  SankeyFlow,
} from "../cockpit-charts";
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
import { useLive } from "../workforce/records";

/* -------------------------------------------------------------------------- */
/* Payload shape (mirrors src/server/cockpits/people-command-centre.ts)        */
/* -------------------------------------------------------------------------- */

type Envelope<T> = { value: T; available: boolean; message?: string; origin?: string };

type RadarAxisPoint = { axis: string; current: number; comparison: number };
type OmittedAxis = { axis: string; reason: string };
type TrendPoint = { label: string; left: number; right: number };
type MatrixView = { rows: string[]; columns: string[]; values: Array<Array<number | null>> };
type ThresholdBar = { label: string; value: number; tone: "success" | "warning" | "danger" | "neutral"; exits: number; roster: number };
type FlowGraph = { nodes: Array<{ name: string }>; links: Array<{ source: number; target: number; value: number }>; centreIndex: number; omitted: OmittedAxis[] };

type Payload = {
  cockpit: { id: string; code: string; label: string; description: string };
  period: { from: string; to: string; label: string };
  rosterSampleCapped: boolean;
  kpis: {
    activeHeadcount: Envelope<number | null>;
    attritionAnnualisedPercent: Envelope<number | null>;
    averageCompaRatio: Envelope<number | null>;
    orgHealthIndex: Envelope<number | null>;
  };
  orgHealth: Envelope<{ axes: RadarAxisPoint[]; omitted: OmittedAxis[]; currentLabel: string; comparisonLabel: string }>;
  headcountTrend: Envelope<{ points: TrendPoint[]; leftLabel: string; rightLabel: string; planNote: string }>;
  talentFlow: Envelope<FlowGraph>;
  attritionByDepartment: Envelope<ThresholdBar[]>;
  attritionMatrix: Envelope<MatrixView>;
  capability: Envelope<Array<{ label: string; value: number }>>;
  compaPerformance: Envelope<null>;
  unavailableSources: Array<{ name: string; message: string }>;
};

/* -------------------------------------------------------------------------- */
/* Local presentation helpers                                                  */
/* -------------------------------------------------------------------------- */

const ENDPOINT = "/api/v1/cockpits/people-command-centre";

/** Renders `2026-04` as `Apr 26` so the axis stays readable at phone width. */
function monthLabel(value: string): string {
  const parsed = new Date(`${value}-01T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", year: "2-digit", timeZone: "UTC" }).format(parsed);
}

/**
 * One panel body. Shows the chart when the feed resolved, and the envelope's
 * own message when it did not — never a blank panel and never a zero.
 */
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

/** Source and period line that sits under a panel's numbers. */
function Provenance({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[11px] leading-[17px] text-muted-foreground">{children}</p>;
}

const BAR_TONES: Record<ThresholdBar["tone"], string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  neutral: "bg-secondary",
};

const PILL_TONES: Record<ThresholdBar["tone"], "success" | "warning" | "danger" | "neutral"> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  neutral: "neutral",
};

/**
 * Horizontal threshold bars. Built from tokens rather than a chart library so
 * every value stays selectable text and the specification's tone bands
 * (under 8%, 8–12%, over 12%) can be carried by a label as well as a colour.
 */
function ThresholdBars({ bars }: { bars: ThresholdBar[] }) {
  if (bars.length === 0) {
    return (
      <StateBlock
        tone="empty"
        icon={TrendingDown}
        title="No department has a roster yet"
        description="Separation rates appear once employees are recorded against a department."
      />
    );
  }
  const max = Math.max(...bars.map((bar) => bar.value), 1);
  return (
    <ul className="grid gap-3">
      {bars.map((bar) => (
        <li key={bar.label} className="min-w-0">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground" title={bar.label}>
              {bar.label}
            </span>
            <span className="shrink-0 font-mono text-[12px] font-bold text-foreground tabular-nums">
              {bar.value.toFixed(1)}%
            </span>
            <StatusPill tone={PILL_TONES[bar.tone]} dot>
              {bar.tone === "danger" ? "Above 12%" : bar.tone === "warning" ? "8–12%" : bar.tone === "success" ? "Under 8%" : "No reading"}
            </StatusPill>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${BAR_TONES[bar.tone]}`}
              style={{ width: `${Math.min(100, (bar.value / max) * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {bar.exits} separated of {bar.roster} recorded
          </p>
        </li>
      ))}
    </ul>
  );
}

/** Lists dimensions the console deliberately left out, with the reason. */
function OmissionNote({ title, omitted }: { title: string; omitted: OmittedAxis[] }) {
  if (omitted.length === 0) return null;
  return (
    <div className="mt-4 rounded-lg border border-border bg-secondary/40 p-3">
      <p className="text-[11px] font-semibold text-foreground">{title}</p>
      <ul className="mt-1.5 grid gap-1">
        {omitted.map((entry) => (
          <li key={entry.axis} className="text-[11px] leading-[17px] text-muted-foreground">
            <span className="font-semibold text-foreground">{entry.axis}</span> — {entry.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Cockpit                                                                     */
/* -------------------------------------------------------------------------- */

export function PeopleCommandCentreCockpit() {
  const state = useLive<{ data?: Payload }>(ENDPOINT);
  const payload = state.data?.data ?? null;

  const trendPoints = useMemo(
    () => (payload?.headcountTrend.value.points ?? []).map((point) => ({ ...point, label: monthLabel(point.label) })),
    [payload],
  );

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
        eyebrow="S1 · Executive console"
        title="People Command Centre"
        description="Org health, attrition, talent flow and workforce composition, read from the records the platform holds. Any figure without a source is shown as unavailable rather than as zero."
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
          <StateBlock tone="loading" title="Loading the command centre…" description="Reading roster, exit, joining and capability records." />
        </Surface>
      )}

      {payload && (
        <div className="grid gap-4">
          {/* ------------------------------------------------------ KPI strip */}
          <section aria-label="Headline workforce measures" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Active headcount"
              icon={Users}
              tone="primary"
              value={
                payload.kpis.activeHeadcount.available && payload.kpis.activeHeadcount.value !== null ? (
                  payload.kpis.activeHeadcount.value.toLocaleString()
                ) : (
                  <span className="text-[15px] font-semibold text-muted-foreground">Unavailable</span>
                )
              }
              hint={payload.kpis.activeHeadcount.available ? payload.kpis.activeHeadcount.origin : payload.kpis.activeHeadcount.message}
            />
            <StatTile
              label="Attrition, last 12 months"
              icon={TrendingDown}
              tone={payload.kpis.attritionAnnualisedPercent.value !== null && payload.kpis.attritionAnnualisedPercent.value > 12 ? "danger" : "warning"}
              value={
                payload.kpis.attritionAnnualisedPercent.available && payload.kpis.attritionAnnualisedPercent.value !== null ? (
                  `${payload.kpis.attritionAnnualisedPercent.value.toFixed(1)}%`
                ) : (
                  <span className="text-[15px] font-semibold text-muted-foreground">Unavailable</span>
                )
              }
              hint={
                payload.kpis.attritionAnnualisedPercent.available
                  ? payload.kpis.attritionAnnualisedPercent.origin
                  : payload.kpis.attritionAnnualisedPercent.message
              }
            />
            <StatTile
              label="Average compa-ratio"
              icon={IndianRupee}
              tone="neutral"
              value={<span className="text-[15px] font-semibold text-muted-foreground">Unavailable</span>}
              hint={payload.kpis.averageCompaRatio.message}
            />
            <StatTile
              label="Org health index"
              icon={Gauge}
              tone="info"
              value={
                payload.kpis.orgHealthIndex.available && payload.kpis.orgHealthIndex.value !== null ? (
                  payload.kpis.orgHealthIndex.value.toFixed(1)
                ) : (
                  <span className="text-[15px] font-semibold text-muted-foreground">Unavailable</span>
                )
              }
              hint={payload.kpis.orgHealthIndex.available ? payload.kpis.orgHealthIndex.origin : payload.kpis.orgHealthIndex.message}
            />
          </section>

          {/* ------------------------------------------ org health + headcount */}
          <section className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-12">
            <Surface className="min-w-0 xl:col-span-5">
              <SectionHeading
                title="Org health"
                description={`${payload.orgHealth.value.currentLabel} against ${payload.orgHealth.value.comparisonLabel}.`}
              />
              <FeedBody feed={payload.orgHealth} emptyTitle="Org health cannot be scored">
                <ComparisonRadar
                  axes={payload.orgHealth.value.axes.length > 0 ? payload.orgHealth.value.axes : []}
                  currentLabel={payload.orgHealth.value.currentLabel}
                  comparisonLabel={payload.orgHealth.value.comparisonLabel}
                  emptyTitle="No dimension has a comparable baseline"
                  emptyNote="An axis is drawn only where the same measure exists in both the current and the prior window."
                />
                <Provenance>{payload.orgHealth.origin}</Provenance>
                <OmissionNote title="Dimensions omitted, and why" omitted={payload.orgHealth.value.omitted} />
              </FeedBody>
            </Surface>

            <Surface className="min-w-0 xl:col-span-7">
              <SectionHeading title="Headcount movement" description="Closing headcount and net movement by month." />
              <FeedBody feed={payload.headcountTrend} emptyTitle="Headcount movement cannot be drawn">
                <DualAxisTrend
                  points={trendPoints}
                  leftLabel={payload.headcountTrend.value.leftLabel}
                  rightLabel={payload.headcountTrend.value.rightLabel}
                  emptyTitle="No joiner or leaver records in the period"
                  emptyNote="The trend builds as joining dates and dated exits are posted."
                />
                <Provenance>
                  {payload.headcountTrend.origin}. {payload.headcountTrend.value.planNote}
                </Provenance>
              </FeedBody>
            </Surface>
          </section>

          {/* ------------------------------------------------------ talent flow */}
          <Surface className="min-w-0">
            <SectionHeading title="Talent flow" description={`Inflow, workforce and outflow over ${payload.period.label}.`} />
            <FeedBody feed={payload.talentFlow} emptyTitle="Talent flow cannot be drawn">
              <SankeyFlow
                nodes={payload.talentFlow.value.nodes}
                links={payload.talentFlow.value.links}
                centreIndex={payload.talentFlow.value.centreIndex}
                emptyTitle="No movement recorded in the period"
                emptyNote="Joiners, transfers and exits appear here once movement is posted for the period."
              />
              <Provenance>{payload.talentFlow.origin}</Provenance>
              <OmissionNote title="Flows not shown, and why" omitted={payload.talentFlow.value.omitted} />
            </FeedBody>
          </Surface>

          {/* ------------------------------------------- attrition bars + matrix */}
          <section className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
            <Surface className="min-w-0">
              <SectionHeading
                title="Separation rate by department"
                description="Roster to date. Tones follow the specification bands: under 8% healthy, 8–12% watch, above 12% critical."
              />
              <FeedBody feed={payload.attritionByDepartment} emptyTitle="Separation rates cannot be computed">
                <ThresholdBars bars={payload.attritionByDepartment.value} />
                <Provenance>{payload.attritionByDepartment.origin}</Provenance>
              </FeedBody>
            </Surface>

            <Surface className="min-w-0">
              <SectionHeading title="Separations by department and location" description="Count of separated employees in each cell." />
              <FeedBody feed={payload.attritionMatrix} emptyTitle="The separation matrix cannot be built">
                <MatrixHeatmap
                  rows={payload.attritionMatrix.value.rows}
                  columns={payload.attritionMatrix.value.columns}
                  values={payload.attritionMatrix.value.values}
                  valueLabel="Separations"
                  ariaLabel="Separated employees by department and location"
                  emptyTitle="No separations recorded"
                  emptyNote="Cells fill in once employees are marked separated against a department and location."
                />
                <Provenance>{payload.attritionMatrix.origin}</Provenance>
              </FeedBody>
            </Surface>
          </section>

          {/* ---------------------------------------------- compa vs performance */}
          <Surface className="min-w-0">
            <SectionHeading title="Compa-ratio against performance" description="Bubble area would carry headcount." />
            <BubbleScatter
              series={[]}
              xLabel="Compa-ratio"
              yLabel="Performance rating"
              sizeLabel="Headcount"
              emptyTitle="This plot has no source"
              emptyNote={payload.compaPerformance.message}
            />
            <Provenance>
              Nothing is plotted because both axes are missing, not because the tenant has no people. Section 9 of the design system forbids
              substituting a plausible distribution here.
            </Provenance>
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
            <Scale className="size-3.5 shrink-0" strokeWidth={2} />
            Period {payload.period.label}.
            {payload.rosterSampleCapped
              ? " Department and location breakdowns read the first 200 directory records by employee code; the headline headcount is a full count."
              : " Department and location breakdowns cover the whole recorded roster."}
          </p>
        </div>
      )}
    </div>
  );
}
