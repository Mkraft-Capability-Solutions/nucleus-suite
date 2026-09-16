"use client";

/**
 * S3 — Attendance Intelligence.
 *
 * Reads `/api/v1/cockpits/attendance-intelligence` and renders exactly what the
 * envelope carries. Every panel carries its own source and period line, and a
 * panel whose feed did not resolve renders the envelope's factual message
 * instead of a number (DESIGN_SYSTEM.md section 9).
 */

import type { ReactNode } from "react";
import { AlertTriangle, CalendarClock, Clock3, TimerReset, UserRoundCheck, UserRoundX } from "lucide-react";
import { ComparisonRadar, DualAxisTrend } from "../cockpit-charts";
import type { Column } from "../page-primitives";
import {
  DataTable,
  PageIntro,
  ProgressMeter,
  SectionHeading,
  StateBlock,
  StatTile,
  StatusPill,
  Surface,
} from "../page-primitives";
import { useLive } from "../workforce/records";

type TrendPoint = { label: string; left: number; right: number };
type RadarPoint = { axis: string; current: number; comparison: number };
type OvertimeBurnRow = { label: string; hours: number; band: "within" | "watch" | "breach"; entries: number };
type CoverageRow = {
  key: string;
  band: string;
  shiftCode: string;
  site: string;
  rostered: number;
  required: number | null;
  deficit: number | null;
};

type Payload = {
  data?: {
    period: { today: string; from: string; to: string; label: string; previousLabel: string };
    kpis: {
      presentToday: number | null;
      absentToday: number | null;
      notRecordedToday: number | null;
      headcount: number | null;
      lateToday: number | null;
      lateNote: string;
      overtimeHours: number | null;
      overtimeEntries: number;
      available: boolean;
      message?: string;
      origin: string;
    };
    trend: { points: TrendPoint[]; available: boolean; message?: string; origin: string; note: string };
    punctuality: {
      axes: RadarPoint[];
      groupedBy: "location" | "department";
      currentLabel: string;
      comparisonLabel: string;
      available: boolean;
      message?: string;
      origin: string;
      note: string;
    };
    overtime: { rows: OvertimeBurnRow[]; available: boolean; message?: string; origin: string; note: string };
    coverage: {
      rows: CoverageRow[];
      available: boolean;
      message?: string;
      origin: string;
      note: string;
      requirementNote: string;
    };
    unavailableSources: Array<{ name: string; message: string }>;
  };
};

const BAND_LABEL: Record<OvertimeBurnRow["band"], string> = {
  within: "Within limit",
  watch: "Above 40h",
  breach: "Above 60h",
};

const BAND_TONE: Record<OvertimeBurnRow["band"], "success" | "warning" | "danger"> = {
  within: "success",
  watch: "warning",
  breach: "danger",
};

const METER_TONE: Record<OvertimeBurnRow["band"], "primary" | "warning" | "danger"> = {
  within: "primary",
  watch: "warning",
  breach: "danger",
};

/** A figure that is genuinely unknown prints an em dash, never a zero. */
function figure(value: number | null | undefined, suffix = ""): string {
  return value === null || value === undefined ? "—" : `${value.toLocaleString()}${suffix}`;
}

function Note({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[12px] leading-[18px] text-muted-foreground">{children}</p>;
}

export function AttendanceIntelligenceCockpit() {
  const { data, loading, error } = useLive<Payload>("/api/v1/cockpits/attendance-intelligence");
  const payload = data?.data;

  const period = payload?.period;
  const periodLine = period ? `${period.from} to ${period.to}` : "";

  const coverageColumns: Column<CoverageRow>[] = [
    { key: "band", header: "Time band", render: (row) => <span className="font-mono text-[13px] text-foreground">{row.band}</span> },
    { key: "shift", header: "Shift", render: (row) => <span className="text-foreground">{row.shiftCode}</span> },
    { key: "site", header: "Site", render: (row) => <span className="text-muted-foreground">{row.site}</span> },
    {
      key: "rostered",
      header: "Rostered",
      align: "right",
      render: (row) => <span className="font-mono tabular-nums text-foreground">{row.rostered}</span>,
    },
    {
      key: "required",
      header: "Required",
      align: "right",
      render: (row) => (
        <span className="font-mono text-[12px] text-muted-foreground">{row.required === null ? "No source" : row.required}</span>
      ),
    },
    {
      key: "deficit",
      header: "Deficit",
      align: "right",
      render: (row) => (
        <span className="font-mono text-[12px] text-muted-foreground">{row.deficit === null ? "Not derivable" : row.deficit}</span>
      ),
    },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px]">
      <PageIntro
        eyebrow="S3 · Attendance Intelligence"
        title="What the clock actually recorded."
        description="Attendance and absenteeism trend, punctuality against the shift master, overtime burn against the statutory bands, and the coverage the published rosters provide."
        action={
          period ? (
            <StatusPill tone="info" dot>
              Period {period.label} · as at {period.today}
            </StatusPill>
          ) : undefined
        }
      />

      {error ? (
        <Surface>
          <StateBlock
            tone="error"
            icon={AlertTriangle}
            title="This cockpit could not be loaded"
            description={error}
          />
        </Surface>
      ) : loading || !payload ? (
        <Surface>
          <StateBlock tone="loading" title="Loading attendance intelligence" description="Reading the attendance, overtime and roster feeds." />
        </Surface>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Present today"
              value={figure(payload.kpis.presentToday)}
              icon={UserRoundCheck}
              tone="success"
              hint={
                payload.kpis.available
                  ? `Present plus half day of ${figure(payload.kpis.headcount)} active employees · ${period?.today ?? ""}`
                  : (payload.kpis.message ?? "Today's attendance is unavailable.")
              }
            />
            <StatTile
              label="Absent today"
              value={figure(payload.kpis.absentToday)}
              icon={UserRoundX}
              tone="danger"
              hint={
                payload.kpis.available
                  ? `${figure(payload.kpis.notRecordedToday)} not recorded — counted separately, never as absent`
                  : (payload.kpis.message ?? "Today's attendance is unavailable.")
              }
            />
            <StatTile
              label="Late today"
              value={figure(payload.kpis.lateToday)}
              icon={Clock3}
              tone="warning"
              hint={payload.kpis.lateNote}
            />
            <StatTile
              label="Overtime this period"
              value={payload.kpis.overtimeHours === null ? "—" : `${payload.kpis.overtimeHours}h`}
              icon={TimerReset}
              tone="info"
              hint={`${payload.kpis.overtimeEntries} recorded entr${payload.kpis.overtimeEntries === 1 ? "y" : "ies"} · ${periodLine}`}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <Surface>
              <SectionHeading
                title="Attendance and absenteeism trend"
                description="Attendance rate on the left axis, absenteeism on the right."
              />
              {payload.trend.available ? (
                <>
                  <DualAxisTrend
                    points={payload.trend.points}
                    leftLabel="Attendance %"
                    rightLabel="Absenteeism %"
                    valueSuffix="%"
                    emptyTitle="No classified attendance days"
                    emptyNote="No month in the window carries a present, half-day or absent classification, so there is nothing to plot."
                  />
                  <Note>
                    Source: recorded attendance days. {payload.trend.note}
                  </Note>
                </>
              ) : (
                <StateBlock
                  tone="empty"
                  icon={CalendarClock}
                  title="Monthly attendance is unavailable"
                  description={payload.trend.message}
                />
              )}
            </Surface>

            <Surface>
              <SectionHeading
                title={`Punctuality by ${payload.punctuality.groupedBy === "location" ? "site" : "department"}`}
                description={`${payload.punctuality.currentLabel} against ${payload.punctuality.comparisonLabel}.`}
                action={
                  payload.punctuality.groupedBy === "department" ? (
                    <StatusPill tone="warning">Site not recorded</StatusPill>
                  ) : undefined
                }
              />
              {payload.punctuality.available ? (
                <>
                  <ComparisonRadar
                    axes={payload.punctuality.axes}
                    currentLabel={payload.punctuality.currentLabel}
                    comparisonLabel={payload.punctuality.comparisonLabel}
                    emptyTitle="No comparable punctuality readings"
                    emptyNote="A group is plotted only when both periods carry punch rows with a readable first-in time and a known shift start."
                  />
                  <Note>
                    Source: {payload.punctuality.origin}. {payload.punctuality.note}
                  </Note>
                </>
              ) : (
                <StateBlock
                  tone="empty"
                  icon={Clock3}
                  title="Punctuality is unavailable"
                  description={payload.punctuality.message}
                />
              )}
            </Surface>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Surface>
              <SectionHeading
                title="Overtime burn by department"
                description={`Hours recorded ${periodLine}.`}
              />
              {!payload.overtime.available ? (
                <StateBlock
                  tone="empty"
                  icon={TimerReset}
                  title="The overtime register is unavailable"
                  description={payload.overtime.message}
                />
              ) : payload.overtime.rows.length === 0 ? (
                <StateBlock
                  tone="empty"
                  icon={TimerReset}
                  title="No overtime recorded this period"
                  description={`No overtime entry is dated between ${period?.from ?? ""} and ${period?.to ?? ""}.`}
                />
              ) : (
                <>
                  <div className="space-y-4">
                    {payload.overtime.rows.map((row) => (
                      <div key={row.label} className="min-w-0">
                        <div className="mb-1.5 flex min-w-0 flex-wrap items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-sm text-foreground">{row.label}</span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="font-mono text-sm tabular-nums text-foreground">{row.hours}h</span>
                            <StatusPill tone={BAND_TONE[row.band]} dot>
                              {BAND_LABEL[row.band]}
                            </StatusPill>
                          </span>
                        </div>
                        <ProgressMeter
                          value={row.hours}
                          max={Math.max(60, ...payload.overtime.rows.map((entry) => entry.hours))}
                          tone={METER_TONE[row.band]}
                          label={`${row.entries} entr${row.entries === 1 ? "y" : "ies"}`}
                        />
                      </div>
                    ))}
                  </div>
                  <Note>Source: {payload.overtime.origin}. {payload.overtime.note}</Note>
                </>
              )}
            </Surface>

            <Surface>
              <SectionHeading
                title="Shift coverage today"
                description={`Rostered headcount per time band on ${period?.today ?? ""}.`}
                action={<StatusPill tone="warning">Requirement has no source</StatusPill>}
              />
              {!payload.coverage.available ? (
                <StateBlock
                  tone="empty"
                  icon={CalendarClock}
                  title="Rosters are unavailable"
                  description={payload.coverage.message}
                />
              ) : (
                <>
                  <DataTable<CoverageRow>
                    columns={coverageColumns}
                    rows={payload.coverage.rows}
                    rowKey={(row) => row.key}
                    minWidth={620}
                    caption="Rostered coverage by time band"
                    empty={
                      <StateBlock
                        tone="empty"
                        icon={CalendarClock}
                        title="No roster covers today"
                        description={`No approved or published roster record spans ${period?.today ?? "today"}, so there is no coverage to report.`}
                      />
                    }
                  />
                  <Note>
                    Source: {payload.coverage.origin}. {payload.coverage.note} {payload.coverage.requirementNote}
                  </Note>
                </>
              )}
            </Surface>
          </div>

          {payload.unavailableSources.length > 0 && (
            <Surface className="mt-4">
              <SectionHeading
                title="Feeds this cockpit could not read"
                description="Listed so nothing on this page is mistaken for a complete picture."
              />
              <ul className="space-y-2">
                {payload.unavailableSources.map((entry) => (
                  <li key={entry.name} className="flex min-w-0 flex-wrap items-start gap-2 text-[13px]">
                    <StatusPill tone="warning">{entry.name}</StatusPill>
                    <span className="min-w-0 flex-1 text-muted-foreground">{entry.message}</span>
                  </li>
                ))}
              </ul>
            </Surface>
          )}
        </>
      )}
    </div>
  );
}
