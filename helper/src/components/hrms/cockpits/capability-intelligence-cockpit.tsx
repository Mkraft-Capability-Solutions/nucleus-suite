"use client";

import { AlertCircle, BookOpen, ChartNoAxesColumn, GraduationCap, Layers, Target } from "lucide-react";
import { ComparisonRadar, ConversionFunnel } from "../cockpit-charts";
import {
  PageIntro,
  ProgressMeter,
  SectionHeading,
  StateBlock,
  StatTile,
  StatusPill,
  Surface,
} from "../page-primitives";
import { useLive } from "../workforce/records";

/**
 * S9 Capability Intelligence — the Learning & Development console.
 *
 * Every figure comes from `/api/v1/cockpits/capability-intelligence`, which
 * reads recorded rows only. Where the platform does not record something the
 * endpoint returns the reason and this page prints that sentence instead of a
 * number: no baseline capability run means the current series is shown alone,
 * and a missing course duration means the volume axis says "completions", not
 * "hours".
 */

/* -------------------------------------------------------------------------- */
/* Payload shape. Declared locally: the server module is `server-only`.        */
/* -------------------------------------------------------------------------- */

type Source<T> = { value: T; available: boolean; message?: string; origin?: string };

type CapabilityMovement = {
  axes: Array<{ axis: string; current: number; comparison: number }>;
  current: Array<{ axis: string; value: number }>;
  baselineRecorded: boolean;
  employeesScored: number;
  employeesWithBaseline: number;
  averageIndex: number | null;
  currentLabel: string;
  comparisonLabel: string;
  note: string;
};

type LearningFunnel = {
  stages: Array<{ label: string; value: number; basis: string }>;
  omitted: Array<{ label: string; reason: string }>;
  note: string;
};

type LearningVolume = {
  measure: "hours" | "completions";
  axisLabel: string;
  bars: Array<{ label: string; value: number }>;
  completionsMeasured: number;
  completionsWithoutDuration: number;
  note: string;
};

type Payload = {
  kpis: {
    courses: Source<number>;
    enrolments: Source<number>;
    completionPct: Source<number | null>;
    averageCapabilityIndex: Source<number | null>;
  };
  capabilityMovement: Source<CapabilityMovement>;
  learningFunnel: Source<LearningFunnel>;
  learningVolume: Source<LearningVolume>;
  unavailableSources: Array<{ name: string; message: string }>;
  generatedAt: string;
};

/* -------------------------------------------------------------------------- */
/* Small shared pieces                                                        */
/* -------------------------------------------------------------------------- */

const UNAVAILABLE = "Not available";

function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[12px] leading-[18px] text-muted-foreground">{children}</p>;
}

/** A KPI that refuses to print a number it does not have. */
function Kpi({
  label,
  entry,
  icon,
  suffix,
  tone,
}: {
  label: string;
  entry?: Source<number | null>;
  icon: typeof GraduationCap;
  suffix?: string;
  tone?: "primary" | "success" | "info" | "neutral";
}) {
  const known = Boolean(entry?.available) && entry?.value !== null && entry?.value !== undefined;
  return (
    <StatTile
      label={label}
      icon={icon}
      tone={tone ?? "primary"}
      value={
        known ? (
          <span>
            {Number(entry?.value).toLocaleString()}
            {suffix ? <span className="text-base text-muted-foreground">{suffix}</span> : null}
          </span>
        ) : (
          <span className="text-base font-semibold text-muted-foreground">{UNAVAILABLE}</span>
        )
      }
      hint={known ? entry?.origin : (entry?.message ?? "No reading is recorded for this measure yet.")}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Panels                                                                     */
/* -------------------------------------------------------------------------- */

function CapabilityMovementPanel({ entry }: { entry?: Source<CapabilityMovement> }) {
  const movement = entry?.value;

  return (
    <Surface>
      <SectionHeading
        title="Capability movement"
        description="Average capability score by dimension, from the recorded capability index runs."
        action={
          movement?.baselineRecorded ? (
            <StatusPill tone="info">Baseline recorded</StatusPill>
          ) : (
            <StatusPill tone="neutral">No baseline</StatusPill>
          )
        }
      />
      {!entry?.available ? (
        <StateBlock
          tone="error"
          icon={AlertCircle}
          title="Capability scores unavailable"
          description={entry?.message ?? "This source could not be read for your role."}
        />
      ) : !movement || movement.current.length === 0 ? (
        <StateBlock
          tone="empty"
          icon={Target}
          title="No capability index run recorded"
          description={movement?.note}
        />
      ) : movement.baselineRecorded ? (
        <>
          <ComparisonRadar
            axes={movement.axes}
            currentLabel={movement.currentLabel}
            comparisonLabel={movement.comparisonLabel}
            ariaLabel="Current capability score against the earliest recorded run, by dimension"
          />
          <Note>{movement.note}</Note>
        </>
      ) : (
        <>
          <ul className="space-y-3.5">
            {movement.current.map((dimension) => (
              <li key={dimension.axis} className="min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-[13px] text-foreground">{dimension.axis}</span>
                  <span className="shrink-0 font-mono text-[13px] font-bold text-foreground tabular-nums">
                    {dimension.value}
                  </span>
                </div>
                <div className="mt-1.5">
                  <ProgressMeter value={dimension.value} max={100} />
                </div>
              </li>
            ))}
          </ul>
          <Note>
            Current reading only, across {movement.employeesScored} scored employee
            {movement.employeesScored === 1 ? "" : "s"}. {movement.note}
          </Note>
        </>
      )}
    </Surface>
  );
}

function LearningFunnelPanel({ entry }: { entry?: Source<LearningFunnel> }) {
  const funnel = entry?.value;
  const stages = funnel?.stages ?? [];
  const populated = stages.length > 0 && stages[0].value > 0;

  return (
    <Surface>
      <SectionHeading
        title="Learning programme conversion"
        description="Where enrolments actually reach, stage by stage."
      />
      {!entry?.available ? (
        <StateBlock
          tone="error"
          icon={AlertCircle}
          title="Enrolment states unavailable"
          description={entry?.message ?? "This source could not be read for your role."}
        />
      ) : !populated ? (
        <StateBlock
          tone="empty"
          icon={Layers}
          title="No enrolments recorded"
          description="The funnel is drawn once learning is assigned to at least one employee."
        />
      ) : (
        <>
          <ConversionFunnel
            stages={stages.map((stage) => ({ label: stage.label, value: stage.value }))}
            ariaLabel="Learning conversion by stage, with stage-over-stage conversion"
          />
          <dl className="mt-4 space-y-2 border-t border-border pt-3">
            {stages.map((stage) => (
              <div key={stage.label} className="min-w-0">
                <dt className="text-[12px] font-semibold text-foreground">{stage.label}</dt>
                <dd className="text-[12px] leading-[18px] text-muted-foreground">{stage.basis}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
      {funnel && funnel.omitted.length > 0 && (
        <div className="mt-4 rounded-lg border border-border bg-secondary/50 p-3">
          <p className="text-[12px] font-semibold text-foreground">Stages this platform does not record</p>
          <ul className="mt-2 space-y-2">
            {funnel.omitted.map((stage) => (
              <li key={stage.label} className="min-w-0">
                <span className="text-[12px] font-semibold text-foreground">{stage.label}</span>
                <p className="text-[12px] leading-[18px] text-muted-foreground">{stage.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Surface>
  );
}

function LearningVolumePanel({ entry }: { entry?: Source<LearningVolume> }) {
  const volume = entry?.value;
  const bars = volume?.bars ?? [];
  const max = bars.reduce((highest, bar) => Math.max(highest, bar.value), 0) || 1;
  const unit = volume?.measure === "hours" ? "h" : "";

  return (
    <Surface>
      <SectionHeading
        title={volume?.measure === "hours" ? "Learning hours by function" : "Learning volume by function"}
        description="Grouped by the learner's recorded department."
        action={<StatusPill tone="neutral">{volume?.axisLabel ?? "No measure"}</StatusPill>}
      />
      {!entry?.available ? (
        <StateBlock
          tone="error"
          icon={AlertCircle}
          title="Learning volume unavailable"
          description={entry?.message ?? "This source could not be read for your role."}
        />
      ) : bars.length === 0 ? (
        <StateBlock
          tone="empty"
          icon={ChartNoAxesColumn}
          title="No verified completion recorded"
          description={volume?.note}
        />
      ) : (
        <ul className="space-y-3.5" aria-label={volume?.axisLabel}>
          {bars.map((bar) => (
            <li key={bar.label} className="min-w-0">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-[13px] text-foreground" title={bar.label}>
                  {bar.label}
                </span>
                <span className="shrink-0 font-mono text-[13px] font-bold text-foreground tabular-nums">
                  {bar.value.toLocaleString()}
                  {unit}
                </span>
              </div>
              <div className="mt-1.5">
                <ProgressMeter value={bar.value} max={max} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {volume && <Note>{volume.note}</Note>}
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */
/* Cockpit                                                                    */
/* -------------------------------------------------------------------------- */

export function CapabilityIntelligenceCockpit() {
  const { data, loading, error } = useLive<{ data: Payload }>("/api/v1/cockpits/capability-intelligence");
  const payload = data?.data;

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px]">
      <PageIntro
        eyebrow="S9 · CAPABILITY INTELLIGENCE"
        title="Capability Intelligence"
        description="Capability movement, learning programme conversion and learning volume by function — read from recorded courses, enrolments, completions and capability index runs."
      />

      {error ? (
        <Surface>
          <StateBlock tone="error" icon={AlertCircle} title="This cockpit could not be loaded" description={error} />
        </Surface>
      ) : loading || !payload ? (
        <Surface>
          <StateBlock tone="loading" title="Loading capability intelligence…" description="Reading learning and capability records." />
        </Surface>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Courses in catalogue" entry={payload.kpis.courses} icon={BookOpen} />
            <Kpi label="Enrolments recorded" entry={payload.kpis.enrolments} icon={GraduationCap} tone="info" />
            <Kpi label="Completion rate" entry={payload.kpis.completionPct} icon={Layers} suffix="%" tone="success" />
            <Kpi
              label="Average capability index"
              entry={payload.kpis.averageCapabilityIndex}
              icon={Target}
              tone="neutral"
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CapabilityMovementPanel entry={payload.capabilityMovement} />
            <LearningFunnelPanel entry={payload.learningFunnel} />
          </div>

          <div className="mt-6">
            <LearningVolumePanel entry={payload.learningVolume} />
          </div>

          {payload.unavailableSources.length > 0 && (
            <Surface className="mt-6">
              <SectionHeading
                title="Sources this account could not read"
                description="Listed so an empty panel is never mistaken for a zero measurement."
              />
              <ul className="space-y-2">
                {payload.unavailableSources.map((entry) => (
                  <li key={entry.name} className="min-w-0">
                    <span className="font-mono text-[12px] font-semibold text-foreground">{entry.name}</span>
                    <p className="text-[12px] leading-[18px] text-muted-foreground">{entry.message}</p>
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
