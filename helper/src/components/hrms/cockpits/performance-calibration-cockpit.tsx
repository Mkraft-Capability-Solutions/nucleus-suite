"use client";

/**
 * S6 — Performance & Calibration.
 *
 * Reads `/api/v1/cockpits/performance-calibration`. Calibration decides how a
 * person is described for a year, so nothing here is modelled: the bars are
 * counts of ratings somebody submitted, the radar compares assessed proficiency
 * with a benchmark somebody configured, and the grid shows only the people a
 * facilitator explicitly placed. Where the target half of a comparison is not
 * configured, the comparison is withheld and the reason is printed
 * (DESIGN_SYSTEM.md section 9).
 */

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarRange, ClipboardCheck, Gauge, RefreshCcw, ShieldAlert, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import {
  BellCurveDistribution,
  chartSeriesColor,
  ComparisonRadar,
  NineBoxGrid,
  type DistributionBucket,
  type NineBoxCell,
  type RadarAxisPoint,
} from "@/components/hrms/cockpit-charts";
import {
  PageIntro,
  SectionHeading,
  StateBlock,
  StatTile,
  StatusPill,
  Surface,
} from "@/components/hrms/page-primitives";
import { useLive } from "@/components/hrms/workforce/records";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Wire contract                                                              */
/* -------------------------------------------------------------------------- */

type Feed<T> = { value: T; available: boolean; message?: string; origin?: string };

type CycleOption = { id: string; code: string; name: string; status: string; createdAt: string | null };
type SessionOption = { id: string; label: string; status: string; department: string | null; createdAt: string | null };

type ParticipationSummary = {
  participants: number;
  participantsWithSubmissions: number;
  responses: number;
  completionPct: number | null;
};

type DistributionView = {
  scaleMax: number;
  buckets: Array<{ bucket: string; actual: number; guided: number | null }>;
  ratingsCounted: number;
  ignoredRatings: number;
  truncated: boolean;
  guidedConfigured: boolean;
  guidedNote: string;
};

type CompetencyView = {
  functions: string[];
  axes: Array<{ competency: string; target: number; byFunction: Record<string, { average: number; assessed: number }> }>;
  scaleMax: number;
};

type PersonRef = { id: string; code: string; name: string };

type NineBoxCellView = {
  id: string;
  label: string;
  count: number;
  performance: 1 | 2 | 3;
  potential: 1 | 2 | 3;
  employees: PersonRef[];
};

type NineBoxView = {
  cells: NineBoxCellView[];
  placed: number;
  bandingConfigured: boolean;
  bandingNote: string;
  boundaries: { ratingScaleMax: number; mediumAtOrAbove: number; highAtOrAbove: number } | null;
  unplacedNote: string;
};

type Calibration = {
  cycles: CycleOption[];
  selectedCycleId: string | null;
  cycle: CycleOption | null;
  sessions: SessionOption[];
  selectedSessionId: string | null;
  participation: Feed<ParticipationSummary | null>;
  distribution: Feed<DistributionView | null>;
  competency: Feed<CompetencyView | null>;
  nineBox: Feed<NineBoxView | null>;
  unavailableSources: Array<{ name: string; message: string }>;
};

type Envelope = { data: Calibration };

/* -------------------------------------------------------------------------- */
/* Local helpers                                                              */
/* -------------------------------------------------------------------------- */

const selectClass = "h-10 min-w-0 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground";

function cycleTone(status: string): "success" | "warning" | "info" | "neutral" {
  const key = status.trim().toLowerCase();
  if (key === "closed" || key === "completed") return "success";
  if (key === "open" || key === "in_progress") return "warning";
  if (key === "draft" || key === "planned") return "info";
  return "neutral";
}

function Unavailable({ title, feed }: { title: string; feed: Feed<unknown> }) {
  return (
    <StateBlock
      tone="empty"
      icon={AlertTriangle}
      title={title}
      description={feed.message ?? "This source is unavailable for your role or is not configured for this tenant."}
    />
  );
}

type CountTooltipProps = {
  active?: boolean;
  payload?: Array<{ value?: number | string; payload?: { bucket?: string } }>;
};

/** Head-count tooltip: the rating and how many submissions carried it. */
const CountTooltip = ({ active, payload }: CountTooltipProps) => {
  const entry = active && payload && payload.length > 0 ? payload[0] : undefined;
  if (!entry || entry.value === undefined) return null;
  return (
    <div
      className="max-w-[220px] rounded-lg border border-border p-3 shadow-[var(--shadow-overlay)]"
      style={{ background: "var(--popover)", color: "var(--popover-foreground)" }}
    >
      <p className="truncate font-mono text-xs font-semibold text-muted-foreground">
        Rating {entry.payload?.bucket ?? ""}
      </p>
      <p className="font-mono text-sm font-bold text-foreground tabular-nums">{entry.value} submitted</p>
    </div>
  );
};

/** Vertical count bars: the actual distribution when no guided curve exists to draw over it. */
function CountBars({ buckets, ariaLabel }: { buckets: Array<{ bucket: string; actual: number }>; ariaLabel: string }) {
  return (
    <div className="h-[230px] min-h-[230px] w-full sm:h-[280px]" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={buckets} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis
            dataKey="bucket"
            axisLine={false}
            tickLine={false}
            interval={0}
            tick={{ fill: "var(--text-2)", fontSize: 11 }}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={46}
            tickCount={5}
            allowDecimals={false}
            tick={{ fill: "var(--text-2)", fontSize: 11 }}
          />
          <Tooltip content={<CountTooltip />} wrapperStyle={{ outline: "none" }} cursor={{ fill: "var(--row-hover)" }} />
          <Bar dataKey="actual" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive>
            {buckets.map((bucket, index) => (
              <Cell key={bucket.bucket} fill={chartSeriesColor(index)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Console                                                                    */
/* -------------------------------------------------------------------------- */

export function PerformanceCalibrationCockpit() {
  const [cycleId, setCycleId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [fn, setFn] = useState("");
  const [cellId, setCellId] = useState("");

  const query = new URLSearchParams();
  if (cycleId) query.set("cycleId", cycleId);
  if (sessionId) query.set("sessionId", sessionId);
  const suffix = query.toString();
  const state = useLive<Envelope>(
    suffix ? `/api/v1/cockpits/performance-calibration?${suffix}` : "/api/v1/cockpits/performance-calibration",
  );
  const view = state.data?.data ?? null;

  const competency = view?.competency.available ? view.competency.value : null;
  const selectedFunction = useMemo(() => {
    if (!competency || competency.functions.length === 0) return "";
    return competency.functions.includes(fn) ? fn : competency.functions[0];
  }, [competency, fn]);

  // An axis is only drawn where the chosen function actually has an assessment
  // for that competency; a missing assessment is never plotted as zero.
  const radarAxes = useMemo<RadarAxisPoint[] | null>(() => {
    if (!competency || selectedFunction === "") return null;
    const axes = competency.axes
      .filter((axis) => axis.byFunction[selectedFunction] !== undefined)
      .map((axis) => ({
        axis: axis.competency,
        current: axis.byFunction[selectedFunction].average,
        comparison: axis.target,
      }));
    return axes.length > 0 ? axes : null;
  }, [competency, selectedFunction]);

  const distribution = view?.distribution.available ? view.distribution.value : null;
  const guidedBuckets = useMemo<DistributionBucket[] | null>(() => {
    if (!distribution || !distribution.guidedConfigured) return null;
    return distribution.buckets.map((bucket) => ({
      bucket: bucket.bucket,
      actual: bucket.actual,
      guided: bucket.guided ?? 0,
    }));
  }, [distribution]);

  const nineBox = view?.nineBox.available ? view.nineBox.value : null;
  const gridCells = useMemo<NineBoxCell[] | null>(() => {
    if (!nineBox) return null;
    return nineBox.cells.map((cell) => ({
      id: cell.id,
      label: cell.label,
      count: cell.count,
      performance: cell.performance,
      potential: cell.potential,
    }));
  }, [nineBox]);
  const focusedCell = nineBox?.cells.find((cell) => cell.id === cellId) ?? null;

  const selectors = (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="calibration-cycle">
        Review cycle
      </label>
      <select
        id="calibration-cycle"
        className={cn(selectClass, "max-w-full")}
        value={view?.selectedCycleId ?? ""}
        onChange={(event) => {
          setCycleId(event.target.value);
          setSessionId("");
          setCellId("");
        }}
        disabled={!view || view.cycles.length === 0}
      >
        {view && view.cycles.length > 0 ? (
          view.cycles.map((cycle) => (
            <option key={cycle.id} value={cycle.id}>
              {cycle.name} · {cycle.status}
            </option>
          ))
        ) : (
          <option value="">No review cycle</option>
        )}
      </select>
      <label className="sr-only" htmlFor="calibration-session">
        Calibration session
      </label>
      <select
        id="calibration-session"
        className={cn(selectClass, "max-w-full")}
        value={view?.selectedSessionId ?? ""}
        onChange={(event) => {
          setSessionId(event.target.value);
          setCellId("");
        }}
        disabled={!view || view.sessions.length === 0}
      >
        {view && view.sessions.length > 0 ? (
          view.sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.label} · {session.status}
            </option>
          ))
        ) : (
          <option value="">No calibration session</option>
        )}
      </select>
      <Button variant="outline" onClick={state.refresh} aria-label="Refresh the calibration console">
        <RefreshCcw className="size-4" />
        Refresh
      </Button>
    </div>
  );

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px]">
      <PageIntro
        eyebrow="S6 · PERFORMANCE & CALIBRATION"
        title="Performance & Calibration"
        description="Cycle progress, the submitted rating distribution, the assessed competency profile and the nine-box grid. Only ratings people submitted and placements a facilitator recorded appear here; nobody is auto-placed and no curve is assumed."
        action={selectors}
      />

      {state.error && (
        <Surface className="mb-4">
          <StateBlock tone="error" icon={ShieldAlert} title="The console could not be loaded" description={state.error} />
        </Surface>
      )}

      {state.loading && !view && (
        <Surface>
          <StateBlock tone="loading" title="Loading calibration…" description="Reading the review cycles for this tenant." />
        </Surface>
      )}

      {view && (
        <div className="space-y-4">
          {/* ---------------------------------------------------------- KPIs */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Review cycle"
              value={
                view.cycle ? (
                  <span className="block truncate text-lg font-semibold">{view.cycle.name}</span>
                ) : (
                  <span className="text-base font-semibold text-muted-foreground">None</span>
                )
              }
              hint={
                view.cycle ? (
                  <StatusPill tone={cycleTone(view.cycle.status)} dot>
                    {view.cycle.status}
                  </StatusPill>
                ) : (
                  "No review cycle exists for this tenant."
                )
              }
              icon={CalendarRange}
              tone="primary"
            />
            <StatTile
              label="Participants enrolled"
              value={
                view.participation.available && view.participation.value ? (
                  view.participation.value.participants
                ) : (
                  <span className="text-base font-semibold text-muted-foreground">Unavailable</span>
                )
              }
              hint={
                view.participation.available && view.participation.value
                  ? `${view.participation.value.responses} review submission(s) received`
                  : view.participation.message
              }
              icon={Users}
              tone="neutral"
            />
            <StatTile
              label="Participants with a submission"
              value={
                view.participation.available && view.participation.value ? (
                  view.participation.value.completionPct === null ? (
                    <span className="text-base font-semibold text-muted-foreground">No participants</span>
                  ) : (
                    `${view.participation.value.completionPct}%`
                  )
                ) : (
                  <span className="text-base font-semibold text-muted-foreground">Unavailable</span>
                )
              }
              hint={
                view.participation.available && view.participation.value
                  ? `${view.participation.value.participantsWithSubmissions} of ${view.participation.value.participants} have at least one submitted review`
                  : view.participation.message
              }
              icon={ClipboardCheck}
              tone="info"
            />
            <StatTile
              label="Calibration sessions"
              value={view.sessions.length}
              hint={
                view.sessions.length > 0
                  ? `${view.sessions.filter((session) => session.status === "open").length} open · ${
                      nineBox ? `${nineBox.placed} placed` : "placements unavailable"
                    }`
                  : "No calibration session has been opened for this cycle."
              }
              icon={Gauge}
              tone={view.sessions.length > 0 ? "success" : "neutral"}
            />
          </div>

          {/* --------------------------------- Distribution + competency */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <Surface className="p-4 sm:p-5 lg:col-span-7">
              <SectionHeading
                title="Rating distribution"
                description="Every rating on every submitted review in this cycle, counted at the point it was given."
              />
              {distribution ? (
                <>
                  {guidedBuckets ? (
                    <BellCurveDistribution
                      buckets={guidedBuckets}
                      actualLabel="Ratings submitted"
                      guidedLabel="Guided curve"
                      ariaLabel="Submitted rating distribution against the configured guided curve"
                    />
                  ) : (
                    <CountBars
                      buckets={distribution.buckets}
                      ariaLabel="Submitted rating distribution, with no guided curve configured"
                    />
                  )}
                  <p className="mt-3 text-[12px] leading-[18px] text-muted-foreground">{distribution.guidedNote}</p>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {distribution.ratingsCounted} rating(s) counted on a 1–{distribution.scaleMax} scale
                    {distribution.ignoredRatings > 0
                      ? ` · ${distribution.ignoredRatings} submitted value(s) fell outside the scale and were not counted`
                      : ""}
                    {distribution.truncated ? " · only the earliest submissions were read; the count is partial" : ""}
                    .
                  </p>
                </>
              ) : (
                <Unavailable title="No rating distribution" feed={view.distribution} />
              )}
            </Surface>

            <Surface className="p-4 sm:p-5 lg:col-span-5">
              <SectionHeading
                title="Competency profile"
                description="Mean assessed proficiency for a function against the benchmark configured for each competency."
                action={
                  competency && competency.functions.length > 0 ? (
                    <>
                      <label className="sr-only" htmlFor="calibration-function">
                        Function
                      </label>
                      <select
                        id="calibration-function"
                        className={cn(selectClass, "max-w-[180px]")}
                        value={selectedFunction}
                        onChange={(event) => setFn(event.target.value)}
                      >
                        {competency.functions.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : undefined
                }
              />
              {competency ? (
                <>
                  <ComparisonRadar
                    axes={radarAxes}
                    currentLabel={selectedFunction || "Function"}
                    comparisonLabel="Role benchmark"
                    ariaLabel={`Assessed competency profile for ${selectedFunction || "the selected function"} against its configured benchmark`}
                    emptyTitle="No benchmarked competency for this function"
                    emptyNote="Nobody in this function has been assessed on a competency that carries a configured benchmark, so there is nothing to compare."
                  />
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    Levels run 1 to {competency.scaleMax}, read from each employee&apos;s recorded proficiency.
                  </p>
                </>
              ) : (
                <Unavailable title="No competency comparison" feed={view.competency} />
              )}
            </Surface>
          </div>

          {/* --------------------------------------------------- Nine box */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <Surface className="p-4 sm:p-5 lg:col-span-8">
              <SectionHeading
                title="Nine box"
                description="Performance across, potential up. Every count is a placement a facilitator recorded in this session."
              />
              {nineBox && gridCells ? (
                <>
                  <NineBoxGrid
                    cells={gridCells}
                    selectedId={cellId || undefined}
                    onSelect={nineBox.placed > 0 ? (cell) => setCellId(cell.id === cellId ? "" : cell.id) : undefined}
                    ariaLabel="Nine box grid of recorded performance and potential placements"
                  />
                  <p className="mt-3 text-[12px] leading-[18px] text-muted-foreground">{nineBox.bandingNote}</p>
                  <p className="mt-1.5 text-[12px] leading-[18px] text-muted-foreground">{nineBox.unplacedNote}</p>
                  {nineBox.placed === 0 && (
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      No placement has been recorded in this session yet, so the cells are not clickable.
                    </p>
                  )}
                </>
              ) : (
                <Unavailable title="Nine box not calibrated" feed={view.nineBox} />
              )}
            </Surface>

            <Surface className="p-4 sm:p-5 lg:col-span-4">
              <SectionHeading
                title={focusedCell ? focusedCell.label : "Box detail"}
                description={
                  focusedCell
                    ? `${focusedCell.count} person(s) placed in this box in the selected session.`
                    : "Select a box to list the people placed in it."
                }
              />
              {focusedCell ? (
                focusedCell.employees.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {focusedCell.employees.map((person) => (
                      <li key={person.id} className="flex min-w-0 items-center justify-between gap-3 py-2.5">
                        <span className="min-w-0 truncate text-[13px] font-semibold text-foreground">{person.name}</span>
                        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{person.code}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <StateBlock
                    tone="empty"
                    title="Nobody in this box"
                    description="No placement in this session put anybody in this cell."
                  />
                )
              ) : (
                <StateBlock
                  tone="empty"
                  title="No box selected"
                  description="Choose a cell on the grid to see exactly who is in it."
                />
              )}
            </Surface>
          </div>

          {/* ------------------------------------------------ Feed honesty */}
          {view.unavailableSources.length > 0 && (
            <Surface className="p-4 sm:p-5">
              <SectionHeading
                title="What this console could not read"
                description="Listed so nothing above is mistaken for a complete picture."
              />
              <ul className="space-y-1.5">
                {view.unavailableSources.map((entry) => (
                  <li key={entry.name} className="text-[12px] leading-[18px] text-muted-foreground">
                    <span className="font-mono text-[11px] font-semibold text-foreground">{entry.name}</span> — {entry.message}
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
