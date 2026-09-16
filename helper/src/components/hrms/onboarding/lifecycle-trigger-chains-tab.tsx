"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, GitBranch, Timer } from "lucide-react";
import { StateBlock, StatusPill, Surface } from "../page-primitives";
import { statusTone } from "../workforce/records";
import {
  ExecutionNotice,
  humanToken,
  slaLabel,
  usePipelines,
  type PipelineStepView,
  type PipelineView,
} from "./workflow-pipelines-tab";

/**
 * Lifecycle Trigger Chains — the ordered consequence chain a lifecycle event
 * is recorded as starting.
 *
 * Every chain on this tab is a stored `workflow_definitions` row whose subject
 * type names a lifecycle stage, rendered with its own stored steps. The four
 * example chains in the specification document (New hire -> People core record
 * -> Payroll setup…, Promotion -> Grade change…) are illustrations in a
 * document, not tenant configuration, and are deliberately absent: a tenant
 * that has configured nothing sees the empty state below, not a picture of an
 * automation it does not have.
 *
 * DATA HONESTY: a left-to-right chain of step pills is the most convincing
 * possible picture of a running automation. Nucleus records these chains and
 * does not execute them, so nothing here re-provisions access or updates a
 * reporting line on its own. That statement sits above the chains and on each
 * chain. See `src/server/lifecycle/pipelines.ts`.
 */

function ChainStep({ step, index }: { step: PipelineStepView; index: number }) {
  return (
    <div className="flex min-w-0 max-w-full flex-col gap-1 rounded-lg border border-border bg-secondary/40 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-md border border-border bg-card font-mono text-[11px] font-bold text-foreground tabular-nums">
          {step.order ?? index + 1}
        </span>
        <span className="min-w-0 break-words text-[13px] font-semibold text-foreground">
          {step.title}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="break-all font-mono text-[11px] text-muted-foreground">{step.stepKey}</span>
        {step.slaMinutes !== null && (
          <StatusPill tone="info">
            <Timer className="size-3 shrink-0" aria-hidden="true" />
            {slaLabel(step.slaMinutes)}
          </StatusPill>
        )}
      </div>
    </div>
  );
}

/**
 * The chain itself. A flex row that wraps: at 375px each step takes its own
 * line and the connector wraps with it, so the page never scrolls sideways.
 */
function ChainSequence({ steps }: { steps: PipelineStepView[] }) {
  if (steps.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground">
        This chain records no steps, so the trigger has no stored consequences.
      </p>
    );
  }
  return (
    <ol className="flex min-w-0 flex-wrap items-center gap-2">
      {steps.map((step, index) => (
        <li key={step.id} className="flex min-w-0 max-w-full items-center gap-2">
          <ChainStep step={step} index={index} />
          {index < steps.length - 1 && (
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
        </li>
      ))}
    </ol>
  );
}

function ChainCard({ chain }: { chain: PipelineView }) {
  return (
    <Surface className="min-w-0 p-5">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-muted-foreground">
            {chain.lifecycleEventLabel ?? "Lifecycle event"}
          </p>
          <h3 className="mt-0.5 break-words font-heading text-[15px] font-semibold text-foreground">
            {chain.name}
          </h3>
          <p className="mt-0.5 break-all font-mono text-[11px] text-muted-foreground">
            {chain.code === "" ? "No code recorded" : chain.code}
          </p>
        </div>
        <StatusPill tone={statusTone(chain.status)} dot>
          {chain.statusLabel}
        </StatusPill>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold text-muted-foreground">Trigger</span>
        <StatusPill tone={chain.triggerEvent === null ? "neutral" : "info"}>
          {chain.triggerEvent === null
            ? "No trigger event recorded"
            : `${humanToken(chain.triggerEvent)} on ${chain.categoryLabel.toLowerCase()}`}
        </StatusPill>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="text-[12px] text-muted-foreground">
          {chain.stepCount} recorded {chain.stepCount === 1 ? "consequence" : "consequences"}
        </span>
      </div>

      <div className="mt-4">
        <ChainSequence steps={chain.steps} />
      </div>

      <p className="mt-4 rounded-lg border border-border bg-secondary/40 p-3 text-[12px] leading-5 text-muted-foreground">
        <span className="font-semibold text-foreground">{chain.executionLabel}.</span>{" "}
        {chain.executionSummary} The steps above are what the definition says should happen, not a
        record of anything that did.
      </p>
    </Surface>
  );
}

export function LifecycleTriggerChainsTab() {
  const { pipelines, loading, error, refresh } = usePipelines();
  const chains = useMemo(
    () => pipelines.filter((pipeline) => pipeline.lifecycleEvent !== null),
    [pipelines],
  );

  if (loading) {
    return <StateBlock tone="loading" icon={GitBranch} title="Loading the stored trigger chains…" />;
  }

  if (error !== "") {
    return (
      <StateBlock
        tone="error"
        icon={GitBranch}
        title="Trigger chains unavailable"
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

  if (chains.length === 0) {
    return (
      <Surface className="p-0">
        <StateBlock
          icon={GitBranch}
          title="No lifecycle trigger chains are configured"
          description="This tenant has no stored workflow definition whose subject is a lifecycle stage, so there is no new hire, promotion, transfer or exit chain to show. Nucleus ships no screen that creates one; definitions are loaded straight into the workflow definition tables."
          action={
            <Link
              href="/joining-chain-console"
              className="inline-flex min-h-10 items-center rounded-lg border border-border px-3 text-[13px] font-semibold text-primary transition-colors duration-150 hover:border-primary/50"
            >
              Open the joining chain console
            </Link>
          }
        />
        <p className="px-8 pb-8 text-center text-[12px] leading-5 text-muted-foreground">
          The joining chain console is the one ordered lifecycle chain this product actually runs:
          its tasks are created, owned and completed by people through the onboarding screens.
        </p>
      </Surface>
    );
  }

  return (
    <>
      <ExecutionNotice summary={chains[0].executionSummary} />
      <div className="grid grid-cols-1 gap-4">
        {chains.map((chain) => (
          <ChainCard key={chain.id} chain={chain} />
        ))}
      </div>
      <p className="mt-4 text-[12px] leading-5 text-muted-foreground">
        Only lifecycle stages with a stored definition appear here. A stage that is missing is
        missing because nothing has been configured for it, not because it is hidden.
      </p>
    </>
  );
}
