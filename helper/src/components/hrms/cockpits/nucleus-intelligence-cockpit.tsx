"use client";

import { useState } from "react";
import { AlertCircle, Bot, Boxes, ClipboardCheck, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AiLabel,
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

/**
 * S10 Nucleus Intelligence — the AI governance console.
 *
 * This page is a security and compliance surface, so it is written to a
 * stricter rule than the other cockpits: a row here reads as an assurance that
 * a control exists, so nothing on it is illustrative. Every guardrail row is a
 * recorded `agent_actions` row, every model is a recorded `model_configs` row
 * and every review is a recorded `human_review_requests` row.
 *
 * The page also prints what the platform does NOT record — the bias audit, the
 * DPDP assessment, the model owner, the provider version pin, the drift
 * monitor — because an absent control must read as absent rather than as a
 * column nobody filled in. It does not render the specification's
 * natural-language query console: no endpoint backs one, and its absence is
 * stated instead.
 */

/* -------------------------------------------------------------------------- */
/* Payload shape. Declared locally: the server module is `server-only`.        */
/* -------------------------------------------------------------------------- */

type Tone = "success" | "warning" | "danger" | "info" | "violet" | "neutral";

type Source<T> = { value: T; available: boolean; message?: string; origin?: string };

type Detection = {
  id: string;
  feed: string;
  subject: string;
  detail: string;
  severity: string;
  tone: Tone;
  recordedAt: string | null;
  reference: string | null;
  open: boolean;
};

type GuardrailRow = {
  id: string;
  agent: string;
  tool: string;
  status: string;
  tone: Tone;
  autonomyCeiling: string;
  dryRunRecorded: boolean;
  outcomeRecorded: boolean;
  reversed: boolean;
  kind: string | null;
  proposedAt: string | null;
  lastChangeAt: string | null;
};

type RegisteredModel = {
  id: string;
  model: string;
  runs: number;
  registeredAt: string | null;
  lastRunAt: string | null;
};

type EvalSuiteSummary = {
  suite: string;
  description: string | null;
  passed: number;
  total: number;
  passRatePct: number | null;
  lastRunAt: string | null;
  everRun: boolean;
};

type ReviewItem = {
  id: string;
  runId: string | null;
  summary: string;
  status: string;
  tone: Tone;
  decision: string | null;
  comment: string | null;
  requestedAt: string | null;
  decidedAt: string | null;
  assignedMembershipId: string | null;
  decidable: boolean;
  decideEndpoint: string;
};

type Payload = {
  kpis: {
    openDetections: Source<number>;
    governedActions: Source<number>;
    pendingReviews: Source<number>;
    evaluationPassRatePct: Source<number | null>;
  };
  detections: Source<Detection[]>;
  detectionSeverityNote: string;
  guardrails: Source<GuardrailRow[]>;
  guardrailNotes: { blockedNotRecorded: string; allowlistedTools: string[]; allowlistNote: string };
  modelRegister: Source<RegisteredModel[]>;
  evaluationSuites: Source<EvalSuiteSummary[]>;
  governanceFieldsNotRecorded: Array<{ field: string; detail: string }>;
  reviewQueue: Source<ReviewItem[]>;
  reviewDecisions: string[];
  canDecideReviews: boolean;
  canDecideNote: string;
  naturalLanguageQueryConsole: Source<null>;
  unavailableSources: Array<{ name: string; message: string }>;
  generatedAt: string;
};

/* -------------------------------------------------------------------------- */
/* Small shared pieces                                                        */
/* -------------------------------------------------------------------------- */

const NOT_RECORDED = "Not recorded";

function stamp(value: string | null): string {
  if (!value) return NOT_RECORDED;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function humanise(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/^./, (character) => character.toUpperCase());
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[12px] leading-[18px] text-muted-foreground">{children}</p>;
}

function Kpi({
  label,
  entry,
  icon,
  suffix,
  tone,
}: {
  label: string;
  entry?: Source<number | null>;
  icon: typeof Bot;
  suffix?: string;
  tone?: "primary" | "success" | "warning" | "danger" | "info" | "neutral";
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
          <span className="text-base font-semibold text-muted-foreground">Not available</span>
        )
      }
      hint={known ? entry?.origin : (entry?.message ?? "No reading is recorded for this measure yet.")}
    />
  );
}

/** A yes/no governance fact: word first, tone second. Never colour alone. */
function Marker({ on, yes, no }: { on: boolean; yes: string; no: string }) {
  return (
    <StatusPill tone={on ? "success" : "neutral"}>{on ? yes : no}</StatusPill>
  );
}

/* -------------------------------------------------------------------------- */
/* Panels                                                                     */
/* -------------------------------------------------------------------------- */

function DetectionsPanel({ entry, note }: { entry?: Source<Detection[]>; note: string }) {
  const detections = entry?.value ?? [];

  return (
    <Surface>
      <SectionHeading
        title="Model detections"
        description="Recorded AI safety evaluation results and payroll anomalies, still-open items first."
        action={<AiLabel>Recorded results</AiLabel>}
      />
      {!entry?.available ? (
        <StateBlock
          tone="error"
          icon={AlertCircle}
          title="Detections unavailable"
          description={entry?.message ?? "This source could not be read for your role."}
        />
      ) : detections.length === 0 ? (
        <StateBlock
          tone="empty"
          icon={ShieldCheck}
          title="No detection recorded"
          description="No safety evaluation has been run and no payroll anomaly is open on the latest run. This is the absence of a record, not a clean bill of health."
        />
      ) : (
        <ul className="divide-y divide-border">
          {detections.slice(0, 12).map((detection) => (
            <li key={detection.id} className="flex min-w-0 flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="min-w-0 truncate text-[13px] font-semibold text-foreground">{detection.subject}</span>
                  <StatusPill tone="neutral">{detection.feed}</StatusPill>
                </div>
                <p className="mt-1 text-[12px] leading-[18px] text-muted-foreground">{detection.detail}</p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {stamp(detection.recordedAt)}
                  {detection.reference ? ` · ${detection.reference.slice(0, 8)}…` : ""}
                </p>
              </div>
              <div className="shrink-0">
                <StatusPill tone={detection.tone} dot>
                  {detection.severity}
                </StatusPill>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Note>{note}</Note>
    </Surface>
  );
}

function GuardrailsPanel({
  entry,
  notes,
}: {
  entry?: Source<GuardrailRow[]>;
  notes: Payload["guardrailNotes"];
}) {
  const rows = entry?.value ?? [];

  const columns: Column<GuardrailRow>[] = [
    {
      key: "agent",
      header: "Agent",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{row.agent}</p>
          <p className="truncate font-mono text-[11px] text-muted-foreground">{row.id.slice(0, 8)}…</p>
        </div>
      ),
    },
    { key: "tool", header: "Tool", render: (row) => <span className="font-mono text-[12px]">{row.tool}</span> },
    {
      key: "status",
      header: "Recorded state",
      render: (row) => (
        <div className="flex min-w-0 flex-wrap gap-1.5">
          <StatusPill tone={row.tone} dot>
            {humanise(row.status)}
          </StatusPill>
          {row.reversed && <StatusPill tone="danger">Reversed</StatusPill>}
          {row.kind && <StatusPill tone="neutral">{humanise(row.kind)}</StatusPill>}
        </div>
      ),
    },
    {
      key: "ceiling",
      header: "Autonomy ceiling",
      render: (row) => <span className="text-[12px] text-muted-foreground">{row.autonomyCeiling}</span>,
    },
    {
      key: "dryRun",
      header: "Dry run",
      render: (row) => <Marker on={row.dryRunRecorded} yes="Simulated" no="No simulation" />,
    },
    {
      key: "outcome",
      header: "Execution",
      render: (row) => <Marker on={row.outcomeRecorded} yes="Outcome recorded" no="Not executed" />,
    },
    {
      key: "proposed",
      header: "Proposed",
      render: (row) => <span className="whitespace-nowrap text-[12px] text-muted-foreground">{stamp(row.proposedAt)}</span>,
    },
  ];

  return (
    <Surface className="p-0">
      <div className="border-b border-border p-5 pb-4">
        <SectionHeading
          title="Autonomous agent guardrails"
          description="The recorded governance state of every agent action in this tenant."
        />
      </div>
      {!entry?.available ? (
        <StateBlock
          tone="error"
          icon={AlertCircle}
          title="Agent actions unavailable"
          description={entry?.message ?? "This source could not be read for your role."}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          minWidth={920}
          caption="Agent actions with their recorded governance state"
          empty={
            <StateBlock
              tone="empty"
              icon={Bot}
              title="No agent action recorded"
              description="No governed agent action has been proposed in this tenant. Read the note below before treating that as evidence that none was attempted."
            />
          }
        />
      )}
      <div className="border-t border-border p-5">
        <div className="rounded-lg border border-warning/25 bg-warning/10 p-3">
          <p className="flex items-center gap-2 text-[12px] font-semibold text-warning">
            <ShieldAlert className="size-4 shrink-0" />
            Blocked attempts are not recorded
          </p>
          <p className="mt-1.5 text-[12px] leading-[18px] text-foreground">{notes.blockedNotRecorded}</p>
        </div>
        <p className="mt-4 text-[12px] font-semibold text-foreground">Tool allowlist enforced at proposal</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {notes.allowlistedTools.map((tool) => (
            <StatusPill key={tool} tone="info">
              {tool}
            </StatusPill>
          ))}
        </div>
        <Note>{notes.allowlistNote}</Note>
      </div>
    </Surface>
  );
}

function ModelRegisterPanel({
  models,
  suites,
  gaps,
}: {
  models?: Source<RegisteredModel[]>;
  suites?: Source<EvalSuiteSummary[]>;
  gaps: Array<{ field: string; detail: string }>;
}) {
  const modelColumns: Column<RegisteredModel>[] = [
    { key: "model", header: "Model", render: (row) => <span className="font-mono text-[12px] font-semibold">{row.model}</span> },
    { key: "runs", header: "Runs", align: "right", render: (row) => <span className="font-mono tabular-nums">{row.runs.toLocaleString()}</span> },
    { key: "lastRun", header: "Last run", render: (row) => <span className="whitespace-nowrap text-[12px] text-muted-foreground">{stamp(row.lastRunAt)}</span> },
    { key: "registered", header: "Registered", render: (row) => <span className="whitespace-nowrap text-[12px] text-muted-foreground">{stamp(row.registeredAt)}</span> },
  ];

  const suiteColumns: Column<EvalSuiteSummary>[] = [
    {
      key: "suite",
      header: "Evaluation suite",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{humanise(row.suite)}</p>
          {row.description && <p className="text-[11px] leading-[16px] text-muted-foreground">{row.description}</p>}
        </div>
      ),
    },
    {
      key: "score",
      header: "Score",
      render: (row) =>
        row.everRun ? (
          <StatusPill tone={row.passRatePct !== null && row.passRatePct >= 100 ? "success" : "warning"}>
            {row.passed}/{row.total} passed
          </StatusPill>
        ) : (
          <StatusPill tone="neutral">Never run</StatusPill>
        ),
    },
    {
      key: "lastRun",
      header: "Last run",
      render: (row) => <span className="whitespace-nowrap text-[12px] text-muted-foreground">{stamp(row.lastRunAt)}</span>,
    },
  ];

  return (
    <Surface className="p-0">
      <div className="border-b border-border p-5 pb-4">
        <SectionHeading
          title="Model register"
          description="Models registered in this tenant and the evaluation suites scored against them."
        />
      </div>
      {!models?.available ? (
        <StateBlock
          tone="error"
          icon={AlertCircle}
          title="Model register unavailable"
          description={models?.message ?? "This source could not be read for your role."}
        />
      ) : (
        <DataTable
          columns={modelColumns}
          rows={models.value}
          rowKey={(row) => row.id}
          minWidth={640}
          caption="Registered model configurations"
          empty={
            <StateBlock
              tone="empty"
              icon={Boxes}
              title="No model registered"
              description="model_configs carries no row for this tenant. A model is registered the first time an AI run is started."
            />
          }
        />
      )}

      <div className="border-t border-border p-5 pb-4">
        <SectionHeading title="Evaluation suites" description="Scored from the safety evaluation rows each run wrote." />
      </div>
      {!suites?.available ? (
        <StateBlock
          tone="error"
          icon={AlertCircle}
          title="Evaluation results unavailable"
          description={suites?.message ?? "This source could not be read for your role."}
        />
      ) : (
        <DataTable
          columns={suiteColumns}
          rows={suites.value}
          rowKey={(row) => row.suite}
          minWidth={620}
          caption="Evaluation suites and their recorded scores"
          empty={
            <StateBlock
              tone="empty"
              icon={ShieldCheck}
              title="No evaluation suite defined"
              description="No suite is declared in the server contract and none has been run."
            />
          }
        />
      )}

      <div className="border-t border-border p-5">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
          <ShieldAlert className="size-4 shrink-0 text-warning" />
          Governance fields this platform does not record
        </p>
        <p className="mt-1.5 text-[12px] leading-[18px] text-muted-foreground">
          These columns are absent from the register above because nothing in the platform stores them. Treat each one as
          a control that has never been recorded, not as a field left blank.
        </p>
        <dl className="mt-3 space-y-2.5">
          {gaps.map((gap) => (
            <div key={gap.field} className="min-w-0">
              <dt className="text-[12px] font-semibold text-foreground">{gap.field}</dt>
              <dd className="text-[12px] leading-[18px] text-muted-foreground">{gap.detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Surface>
  );
}

function ReviewDecisionForm({
  item,
  decisions,
  enabled,
  onDecided,
}: {
  item: ReviewItem;
  decisions: string[];
  enabled: boolean;
  onDecided: () => void;
}) {
  const [decision, setDecision] = useState(decisions[0] ?? "accepted");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(item.decideEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, comment: comment.trim() }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        setMessage(body?.error?.message ?? "The decision could not be recorded.");
        return;
      }
      setComment("");
      onDecided();
    } catch {
      setMessage("The decision could not be sent. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
      <label className="sr-only" htmlFor={`decision-${item.id}`}>
        Decision for this review
      </label>
      <select
        id={`decision-${item.id}`}
        value={decision}
        disabled={!enabled || busy}
        onChange={(event) => setDecision(event.target.value)}
        className="h-10 min-w-0 rounded-lg border border-border bg-background px-3 text-[13px] text-foreground disabled:opacity-50 sm:w-48"
      >
        {decisions.map((option) => (
          <option key={option} value={option}>
            {humanise(option)}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor={`comment-${item.id}`}>
        Reason for this decision
      </label>
      <input
        id={`comment-${item.id}`}
        value={comment}
        disabled={!enabled || busy}
        onChange={(event) => setComment(event.target.value)}
        placeholder="Reason (required)"
        className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-[13px] text-foreground placeholder:text-muted-foreground disabled:opacity-50"
      />
      <Button type="submit" disabled={!enabled || busy || comment.trim().length === 0} className="h-10 shrink-0">
        {busy ? "Recording…" : "Record decision"}
      </Button>
      {message && (
        <p role="alert" className="text-[12px] text-destructive sm:basis-full">
          {message}
        </p>
      )}
    </form>
  );
}

function ReviewQueuePanel({
  entry,
  decisions,
  canDecide,
  canDecideNote,
  onDecided,
}: {
  entry?: Source<ReviewItem[]>;
  decisions: string[];
  canDecide: boolean;
  canDecideNote: string;
  onDecided: () => void;
}) {
  const items = entry?.value ?? [];

  return (
    <Surface>
      <SectionHeading
        title="Human-review queue"
        description="Review requests raised against AI runs, with the decision recorded against each."
      />
      {!entry?.available ? (
        <StateBlock
          tone="error"
          icon={AlertCircle}
          title="Review queue unavailable"
          description={entry?.message ?? "This source could not be read for your role."}
        />
      ) : items.length === 0 ? (
        <StateBlock
          tone="empty"
          icon={ClipboardCheck}
          title="No review requested"
          description="No AI run has been sent for human review in this tenant."
        />
      ) : (
        <ul className="divide-y divide-border">
          {items.slice(0, 10).map((item) => (
            <li key={item.id} className="min-w-0 py-4 first:pt-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <StatusPill tone={item.tone} dot>
                  {item.decision ? humanise(item.decision) : humanise(item.status)}
                </StatusPill>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {item.runId ? `run ${item.runId.slice(0, 8)}…` : "No run linked"}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">{stamp(item.requestedAt)}</span>
              </div>
              <p className="mt-1.5 text-[13px] leading-[19px] text-foreground">{item.summary}</p>
              {item.comment && (
                <p className="mt-1 text-[12px] leading-[18px] text-muted-foreground">
                  Decision note: {item.comment} · {stamp(item.decidedAt)}
                </p>
              )}
              {item.decidable ? (
                <ReviewDecisionForm item={item} decisions={decisions} enabled={canDecide} onDecided={onDecided} />
              ) : (
                <p className="mt-2 text-[12px] text-muted-foreground">
                  Already decided. The decision endpoint rejects a second decision on the same request.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <Note>{canDecideNote}</Note>
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */
/* Cockpit                                                                    */
/* -------------------------------------------------------------------------- */

export function NucleusIntelligenceCockpit() {
  const { data, loading, error, refresh } = useLive<{ data: Payload }>("/api/v1/cockpits/nucleus-intelligence");
  const payload = data?.data;

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px]">
      <PageIntro
        eyebrow="S10 · NUCLEUS INTELLIGENCE"
        title="Nucleus Intelligence"
        description="AI governance: recorded model detections, the real state of every governed agent action, the model register and the human-review queue. Fields the platform does not record are named rather than implied."
      />

      {error ? (
        <Surface>
          <StateBlock tone="error" icon={AlertCircle} title="This cockpit could not be loaded" description={error} />
        </Surface>
      ) : loading || !payload ? (
        <Surface>
          <StateBlock tone="loading" title="Loading AI governance records…" description="Reading evaluations, agent actions, models and reviews." />
        </Surface>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Open detections" entry={payload.kpis.openDetections} icon={ShieldAlert} tone="danger" />
            <Kpi label="Governed agent actions" entry={payload.kpis.governedActions} icon={Bot} tone="info" />
            <Kpi label="Reviews awaiting a decision" entry={payload.kpis.pendingReviews} icon={ClipboardCheck} tone="warning" />
            <Kpi
              label="Evaluation pass rate"
              entry={payload.kpis.evaluationPassRatePct}
              icon={ShieldCheck}
              suffix="%"
              tone="success"
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <DetectionsPanel entry={payload.detections} note={payload.detectionSeverityNote} />
            <ReviewQueuePanel
              entry={payload.reviewQueue}
              decisions={payload.reviewDecisions}
              canDecide={payload.canDecideReviews}
              canDecideNote={payload.canDecideNote}
              onDecided={refresh}
            />
          </div>

          <div className="mt-6">
            <GuardrailsPanel entry={payload.guardrails} notes={payload.guardrailNotes} />
          </div>

          <div className="mt-6">
            <ModelRegisterPanel
              models={payload.modelRegister}
              suites={payload.evaluationSuites}
              gaps={payload.governanceFieldsNotRecorded}
            />
          </div>

          <Surface className="mt-6">
            <SectionHeading
              title="Natural-language query console"
              description="Described in the specification and deliberately not built."
              action={<StatusPill tone="neutral">Not available</StatusPill>}
            />
            <div className="flex min-w-0 items-start gap-3">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="min-w-0 text-[12px] leading-[18px] text-muted-foreground">
                {payload.naturalLanguageQueryConsole.message}
              </p>
            </div>
          </Surface>

          {payload.unavailableSources.length > 0 && (
            <Surface className="mt-6">
              <SectionHeading
                title="Sources this account could not read"
                description="Listed so an empty governance panel is never mistaken for a clean result."
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
