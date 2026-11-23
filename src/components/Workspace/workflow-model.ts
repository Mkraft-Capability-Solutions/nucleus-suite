import { Send, Sparkles, SlidersHorizontal, Users, Workflow, type LucideIcon } from "lucide-react";
import type { Translate } from "./engagement-client";

/** Client-side shapes for /api/v1/workflows (mirrors WorkflowView in src/server/workflows). */

export const WF_NS = "components.Workspace.WorkflowBuilderModal";
export const WORKFLOWS_PATH = "/api/v1/workflows";

export type StepType = "trigger" | "condition" | "approval" | "action" | "integration";
export type Step = { id?: string; key?: string; type: StepType; title: string; description: string; slaHours: number | null; operator: string | null };
export type Workflow = {
  id: string;
  code: string;
  name: string;
  subjectType: string;
  description: string;
  status: "draft" | "active" | "retired";
  latestVersion: number;
  publishedVersion: number | null;
  hasUnpublishedChanges: boolean;
  steps: Step[];
  updatedAt: string;
};
export type Catalogue = { stepTypes: StepType[]; operators: string[]; subjectTypes: string[]; maxSteps: number };
export type TraceIssue = { stepKey: string | null; code: string };
export type Trace = { version: number; runnable: boolean; issues: TraceIssue[]; path: Array<{ order: number; key: string; type: StepType; title: string; slaHours: number | null; next: string | null }> };

export const STEP_ICONS: Record<StepType, LucideIcon> = {
  trigger: Sparkles,
  condition: SlidersHorizontal,
  approval: Users,
  action: Workflow,
  integration: Send,
};

export function stepTypeLabel(type: string, t: Translate): string {
  const fallback: Record<string, string> = { trigger: "Trigger", condition: "Condition", approval: "Approval", action: "Action", integration: "Integration" };
  return t(`${WF_NS}.step_${type}`, fallback[type] ?? type);
}

export function issueLabel(code: string, t: Translate): string {
  const fallback: Record<string, string> = {
    first_not_trigger: "The first step must be a trigger.",
    extra_trigger: "Only the first step can be a trigger.",
    approval_without_sla: "Approval steps need an SLA in hours.",
    condition_without_operator: "Condition steps need an operator.",
    no_terminal_action: "End the workflow with an action or integration step.",
    too_short: "Add at least one step after the trigger.",
  };
  return t(`${WF_NS}.issue_${code}`, fallback[code] ?? code);
}

/** Only the fields the PUT body accepts. */
export function toStepInput(step: Step) {
  return { key: step.key, type: step.type, title: step.title.trim(), description: step.description.trim(), slaHours: step.slaHours, operator: step.operator };
}
