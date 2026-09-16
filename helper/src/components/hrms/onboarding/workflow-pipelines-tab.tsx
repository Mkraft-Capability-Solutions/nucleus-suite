"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Info, ListOrdered, Timer, Workflow } from "lucide-react";
import { StateBlock, StatusPill, Surface } from "../page-primitives";
import { asRecord, dateLabel, listFromEnvelope, num, statusTone, str, useLive } from "../workforce/records";

/**
 * Workflow Pipelines — the stored automation definitions.
 *
 * Bound to the field names the entity actually stores. The reference
 * implementation read `wf.title` and `wf.trigger`; the record carries `name`
 * and (derived from its stored transitions) `triggerEvent`, so those cards
 * rendered a blank heading and an empty trigger. Every field read here is
 * checked against the shape `/api/v1/lifecycle/pipelines` returns.
 *
 * DATA HONESTY: a chain of step pills looks exactly like a running automation.
 * Nucleus stores these definitions and does not execute them, so the execution
 * statement is rendered with the same weight as the steps, on the surface and
 * on every card. See `src/server/lifecycle/pipelines.ts`.
 */

export const PIPELINES_PATH = "/api/v1/lifecycle/pipelines";

export type PipelineStepView = {
  id: string;
  stepKey: string;
  title: string;
  order: number | null;
  stepType: string | null;
  slaMinutes: number | null;
  config: Record<string, unknown>;
  outboundEvents: string[];
};

export type PipelineView = {
  id: string;
  code: string;
  name: string;
  category: string;
  categoryLabel: string;
  triggerEvent: string | null;
  entryStepKey: string | null;
  status: string;
  statusLabel: string;
  versionNumber: number | null;
  stepCount: number;
  steps: PipelineStepView[];
  lifecycleEvent: string | null;
  lifecycleEventLabel: string | null;
  recordedRuns: number;
  runsStartedByUser: number;
  lastActivityAt: string | null;
  executionLabel: string;
  executionSummary: string;
};

function optionalStr(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function optionalInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function readStep(value: unknown): PipelineStepView {
  const raw = asRecord(value);
  return {
    id: str(raw.id),
    stepKey: str(raw.stepKey),
    title: str(raw.title, "Untitled step"),
    order: optionalInt(raw.order),
    stepType: optionalStr(raw.stepType),
    slaMinutes: optionalInt(raw.slaMinutes),
    config: asRecord(raw.config),
    outboundEvents: Array.isArray(raw.outboundEvents)
      ? raw.outboundEvents.filter((event): event is string => typeof event === "string")
      : [],
  };
}

/** Reads one pipeline out of the collection envelope, by its real field names. */
export function readPipeline(value: unknown): PipelineView {
  const raw = asRecord(value);
  const execution = asRecord(raw.execution);
  return {
    id: str(raw.id),
    code: str(raw.code),
    name: str(raw.name, "Unnamed pipeline"),
    category: str(raw.category),
    categoryLabel: str(raw.categoryLabel, "No category recorded"),
    triggerEvent: optionalStr(raw.triggerEvent),
    entryStepKey: optionalStr(raw.entryStepKey),
    status: str(raw.status, "unknown"),
    statusLabel: str(raw.statusLabel, "Status not recorded"),
    versionNumber: optionalInt(raw.versionNumber),
    stepCount: num(raw.stepCount, 0),
    steps: Array.isArray(raw.steps) ? raw.steps.map(readStep).filter((step) => step.id !== "") : [],
    lifecycleEvent: optionalStr(raw.lifecycleEvent),
    lifecycleEventLabel: optionalStr(raw.lifecycleEventLabel),
    recordedRuns: num(raw.recordedRuns, 0),
    runsStartedByUser: num(raw.runsStartedByUser, 0),
    lastActivityAt: optionalStr(raw.lastActivityAt),
    executionLabel: str(execution.label, "Recorded definition — not executed"),
    executionSummary: str(
      execution.summary,
      "Nucleus stores this definition but does not run it.",
    ),
  };
}

export function usePipelines() {
  const state = useLive(PIPELINES_PATH);
  const pipelines = useMemo(
    () => listFromEnvelope(state.data).map(readPipeline).filter((pipeline) => pipeline.id !== ""),
    [state.data],
  );
  return { ...state, pipelines };
}

/** `manager_review` -> `Manager review`. Machine tokens are never shown bare. */
export function humanToken(value: string): string {
  const words = value.replace(/[_\-.]+/g, " ").trim();
  if (words === "") return "";
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}

export function slaLabel(minutes: number | null): string {
  if (minutes === null) return "No SLA recorded";
  if (minutes < 60) return `${minutes} min SLA`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest === 0 ? `${hours} h SLA` : `${hours} h ${rest} m SLA`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours === 0 ? `${days} d SLA` : `${days} d ${restHours} h SLA`;
}

/**
 * The single statement of what the platform does with these definitions.
 * Shown above the cards and repeated per card, because a reader who scrolls
 * straight to a step chain must still meet it.
 */
export function ExecutionNotice({ summary }: { summary: string }) {
  return (
    // A plain element, not `Surface`: `.nucleus-panel` is unlayered CSS and
    // would override the tint utilities a layered Tailwind class applies.
    <div className="mb-5 min-w-0 rounded-lg border border-warning/40 bg-warning/10 p-4">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <Info className="size-5 shrink-0 text-warning" strokeWidth={2} aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Recorded definitions only — Nucleus does not execute these pipelines
          </p>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{summary}</p>
          <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">
            Approvals that do run in this product are the record workflows on each register
            (draft, submitted, approved), which are driven by the operational engine and never
            consult these definitions. Treat this tab as a catalogue of what has been written
            down, not as proof that anything happens automatically.
          </p>
        </div>
      </div>
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-[13px] font-medium text-foreground">{value}</dd>
    </div>
  );
}

function StepConfig({ config }: { config: Record<string, unknown> }) {
  const entries = Object.entries(config).filter(([, value]) => value !== null && value !== undefined);
  if (entries.length === 0) {
    return <p className="mt-1 text-[12px] text-muted-foreground">No further configuration recorded.</p>;
  }
  return (
    <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
      {entries.map(([key, value]) => (
        <div key={key} className="min-w-0">
          <dt className="inline text-[12px] text-muted-foreground">{humanToken(key)}: </dt>
          <dd className="inline break-words font-mono text-[12px] text-foreground">
            {typeof value === "object" ? JSON.stringify(value) : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function PipelineStepList({ steps }: { steps: PipelineStepView[] }) {
  if (steps.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground">
        This definition records no steps. Its latest version has an empty step list.
      </p>
    );
  }
  return (
    <ol className="space-y-2.5">
      {steps.map((step, index) => (
        <li key={step.id} className="flex min-w-0 gap-3 rounded-lg border border-border bg-secondary/40 p-3">
          <span className="grid size-7 shrink-0 place-items-center rounded-md border border-border bg-card font-mono text-[12px] font-bold text-foreground tabular-nums">
            {step.order ?? index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="break-words text-[13px] font-semibold text-foreground">{step.title}</p>
            <p className="mt-0.5 break-all font-mono text-[11px] text-muted-foreground">{step.stepKey}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <StatusPill tone="neutral">
                {step.stepType === null ? "Step type not recorded" : humanToken(step.stepType)}
              </StatusPill>
              <StatusPill tone={step.slaMinutes === null ? "neutral" : "info"}>
                <Timer className="size-3 shrink-0" aria-hidden="true" />
                {slaLabel(step.slaMinutes)}
              </StatusPill>
              {step.outboundEvents.map((event) => (
                <StatusPill key={event} tone="neutral">
                  Leaves on {humanToken(event)}
                </StatusPill>
              ))}
              {step.outboundEvents.length === 0 && (
                <StatusPill tone="neutral">End of chain — no outgoing transition</StatusPill>
              )}
            </div>
            <StepConfig config={step.config} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function PipelineCard({ pipeline }: { pipeline: PipelineView }) {
  const [open, setOpen] = useState(false);
  const panelId = `pipeline-steps-${pipeline.id}`;
  return (
    <div id={`pipeline-${pipeline.id}`} className="min-w-0 scroll-mt-24">
      <Surface className="flex min-w-0 flex-col p-5">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="break-words font-heading text-[15px] font-semibold text-foreground">
              {pipeline.name}
            </h3>
            <p className="mt-0.5 break-all font-mono text-[11px] text-muted-foreground">
              {pipeline.code === "" ? "No code recorded" : pipeline.code}
              {pipeline.versionNumber === null ? "" : ` · version ${pipeline.versionNumber}`}
            </p>
          </div>
          <StatusPill tone={statusTone(pipeline.status)} dot>
            {pipeline.statusLabel}
          </StatusPill>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MetaCell label="Category" value={pipeline.categoryLabel} />
          <MetaCell
            label="Trigger"
            value={
              pipeline.triggerEvent === null ? (
                <span className="text-muted-foreground">No trigger event recorded</span>
              ) : (
                <span className="break-words">
                  {humanToken(pipeline.triggerEvent)}
                  {pipeline.entryStepKey === null ? "" : ` from ${humanToken(pipeline.entryStepKey)}`}
                </span>
              )
            }
          />
          <MetaCell
            label="Steps"
            value={`${pipeline.stepCount} ${pipeline.stepCount === 1 ? "step" : "steps"}`}
          />
          <MetaCell
            label="Recorded runs"
            value={
              pipeline.recordedRuns === 0
                ? "None recorded"
                : `${pipeline.recordedRuns} recorded, ${pipeline.runsStartedByUser} started by a user`
            }
          />
          <MetaCell
            label="Last recorded activity"
            value={dateLabel(pipeline.lastActivityAt, "No activity recorded")}
          />
        </dl>

        <p className="mt-4 rounded-lg border border-border bg-secondary/40 p-3 text-[12px] leading-5 text-muted-foreground">
          <span className="font-semibold text-foreground">{pipeline.executionLabel}.</span>{" "}
          {pipeline.executionSummary}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            aria-controls={panelId}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] font-semibold text-foreground transition-colors duration-150 hover:border-primary/50"
          >
            {open ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}
            {open ? "Hide the ordered steps" : `Show the ${pipeline.stepCount} ordered steps`}
          </button>
          {/*
            The reference control was an "Open in studio" button that dropped the
            pipeline id, and this build ships no studio route at all. The link
            below carries this pipeline id and resolves to its own record on this
            page, so the control goes somewhere real instead of nowhere.
          */}
          <a
            href={`#pipeline-${pipeline.id}`}
            onClick={() => setOpen(true)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold text-primary transition-colors duration-150 hover:underline"
          >
            Open this definition
            <ChevronRight className="size-4" aria-hidden="true" />
          </a>
        </div>
        <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
          Nucleus has no pipeline studio screen, so this opens the stored definition below rather
          than an editor.
        </p>

        <div id={panelId} hidden={!open} className="mt-4 border-t border-border pt-4">
          <p className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
            <ListOrdered className="size-4 shrink-0" aria-hidden="true" />
            Ordered steps as the definition records them
          </p>
          <PipelineStepList steps={pipeline.steps} />
        </div>
      </Surface>
    </div>
  );
}

export function WorkflowPipelinesTab() {
  const { pipelines, loading, error, refresh } = usePipelines();

  if (loading) {
    return <StateBlock tone="loading" icon={Workflow} title="Loading the stored pipeline definitions…" />;
  }

  if (error !== "") {
    return (
      <StateBlock
        tone="error"
        icon={Workflow}
        title="Pipeline definitions unavailable"
        description={error}
        action={
          <button
            type="button"
            onClick={refresh}
            className="inline-flex min-h-10 items-center rounded-lg border border-border px-3 text-[13px] font-semibold hover:border-primary/50"
          >
            Try again
          </button>
        }
      />
    );
  }

  if (pipelines.length === 0) {
    return (
      <>
        <ExecutionNotice summary="Nucleus stores pipeline definitions but does not run them." />
        <Surface className="p-0">
          <StateBlock
            icon={Workflow}
            title="No workflow pipelines are recorded"
            description="This tenant has no rows in the workflow definition tables. Nothing in the product writes them today, so they stay empty until definitions are loaded directly."
          />
        </Surface>
      </>
    );
  }

  return (
    <>
      <ExecutionNotice summary={pipelines[0].executionSummary} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {pipelines.map((pipeline) => (
          <PipelineCard key={pipeline.id} pipeline={pipeline} />
        ))}
      </div>
    </>
  );
}
