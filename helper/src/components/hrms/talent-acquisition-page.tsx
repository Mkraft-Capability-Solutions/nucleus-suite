"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  ChevronRight,
  RefreshCcw,
  ScaleIcon,
  Sparkles,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import SpotlightCard from "@/components/SpotlightCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiErrorMessage, getJson, invalidateGetRequests } from "@/lib/client-api";
import { picklistLabel } from "@/lib/picklists";
import { MetricCard, PageIntro, SectionHeading, StatusPill, Surface } from "./page-primitives";
import { ReferencePicker } from "./register-primitives";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function arr(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? (value as UnknownRecord[]) : [];
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function strOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function num(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function int(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? (value as unknown[]).map((entry) => String(entry)) : [];
}

/** Integer minor units rendered exactly, never through floating point. */
function money(amountMinor: number, currency: string | null): string {
  const sign = amountMinor < 0 ? "-" : "";
  const absolute = Math.abs(amountMinor);
  const whole = Math.trunc(absolute / 100).toLocaleString("en-IN");
  return `${currency ? `${currency} ` : ""}${sign}${whole}.${String(absolute % 100).padStart(2, "0")}`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
}

const selectClass = "h-10 w-full min-w-0 max-w-full rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground";
const inputClass = "h-10 w-full min-w-0 max-w-full rounded-xl border border-border bg-card px-3 text-xs text-foreground";

type Tone = "success" | "warning" | "danger" | "info" | "violet" | "neutral";

function requisitionTone(status: string): Tone {
  if (status === "approved") return "success";
  if (status === "blocked" || status === "rejected") return "danger";
  if (status === "submitted") return "warning";
  if (status === "filled") return "info";
  return "neutral";
}

function establishmentTone(state: string): Tone {
  if (state === "over_plan") return "danger";
  if (state === "at_limit") return "warning";
  return "success";
}

function judgmentTone(judgment: string): Tone {
  if (judgment === "strong") return "success";
  if (judgment === "partial") return "warning";
  if (judgment === "conflicting") return "danger";
  return "neutral";
}

function milestoneTone(state: string): Tone {
  if (state === "disbursed") return "success";
  if (state === "earned") return "info";
  if (state === "not_configured") return "danger";
  return "neutral";
}

/**
 * Value-unknown sibling of MetricCard, mirroring the pattern in dashboard.tsx.
 * MetricCard requires a number and animates it, so a genuinely unknown value can
 * only be told the truth by a tile that never prints a figure at all.
 */
function UnknownMetricCard({ label, hint, icon: Icon }: { label: string; hint: string; icon: LucideIcon }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
      <SpotlightCard className="nucleus-panel rounded-lg p-4" spotlightColor="color-mix(in srgb, var(--primary) 8%, transparent)">
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-primary/15 bg-primary/8 text-primary">
              <Icon className="size-4 text-primary" strokeWidth={2} />
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[11px] font-bold text-muted-foreground">{hint}</span>
          </div>
          <div className="mt-5 flex items-baseline gap-1">
            <span className="text-[28px] font-bold leading-[34px] text-muted-foreground tabular-nums">—</span>
          </div>
          <p className="mt-1.5 text-[12px] text-muted-foreground">{label}</p>
        </div>
      </SpotlightCard>
    </motion.div>
  );
}

function LoadState({ loading, error, onRetry, empty, emptyText, children }: {
  loading: boolean;
  error: string;
  onRetry: () => void;
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  if (loading) return <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>;
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <p className="text-xs leading-relaxed text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" className="h-10 sm:h-8 rounded-lg text-xs" onClick={onRetry}>
          <RefreshCcw className="mr-1.5 size-3.5" /> Retry
        </Button>
      </div>
    );
  }
  if (empty) return <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">{emptyText}</p>;
  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// Read models
// ---------------------------------------------------------------------------

type Finding = { requirementRef: string; judgment: string; provenance: string; evidence: Array<{ locator: string; excerptHash: string }> };

type ScoreBasis = {
  resultId: string;
  jdVersion: string | null;
  rubricVersion: string | null;
  promptVersion: string | null;
  modelVersion: string | null;
  extractionChecksum: string | null;
  findings: Finding[];
};

type Card = {
  applicationId: string;
  candidateName: string;
  requisitionCode: string | null;
  roleTitle: string | null;
  department: string | null;
  stage: string;
  stageLabel: string;
  nextStage: string | null;
  nextStageLabel: string | null;
  terminal: boolean;
  matchScore: number | null;
  scoreBasis: ScoreBasis | null;
  skills: string[];
  experienceYears: number | null;
  source: string | null;
};

type Column = { id: string; label: string; caption: string; cards: Card[] };

type Board = { columns: Column[]; closed: Card[]; unmapped: Card[]; totals: { active: number; closed: number; scored: number; unscored: number }; advisory: string };

function readCard(raw: UnknownRecord): Card {
  const basis = asRecord(raw.scoreBasis);
  return {
    applicationId: str(raw.applicationId),
    candidateName: str(raw.candidateName, "Unnamed candidate"),
    requisitionCode: strOrNull(raw.requisitionCode),
    roleTitle: strOrNull(raw.roleTitle),
    department: strOrNull(raw.department),
    stage: str(raw.stage, "applied"),
    stageLabel: str(raw.stageLabel, str(raw.stage, "applied")),
    nextStage: strOrNull(raw.nextStage),
    nextStageLabel: strOrNull(raw.nextStageLabel),
    terminal: raw.terminal === true,
    matchScore: num(raw.matchScore),
    scoreBasis: raw.scoreBasis
      ? {
          resultId: str(basis.resultId),
          jdVersion: strOrNull(basis.jdVersion),
          rubricVersion: strOrNull(basis.rubricVersion),
          promptVersion: strOrNull(basis.promptVersion),
          modelVersion: strOrNull(basis.modelVersion),
          extractionChecksum: strOrNull(basis.extractionChecksum),
          findings: arr(basis.findings).map((finding) => ({
            requirementRef: str(finding.requirementRef, "—"),
            judgment: str(finding.judgment, "not_evidenced"),
            provenance: str(finding.provenance, "unrecorded"),
            evidence: arr(finding.evidence).map((item) => ({ locator: str(item.locator), excerptHash: str(item.excerptHash) })),
          })),
        }
      : null,
    skills: strings(raw.skills),
    experienceYears: num(raw.experienceYears),
    source: strOrNull(raw.source),
  };
}

function readBoard(payload: unknown): Board {
  const data = asRecord(asRecord(payload).data);
  return {
    columns: arr(data.columns).map((column) => ({
      id: str(column.id),
      label: str(column.label),
      caption: str(column.caption),
      cards: arr(column.cards).map(readCard),
    })),
    closed: arr(data.closed).map(readCard),
    unmapped: arr(data.unmapped).map(readCard),
    totals: {
      active: int(asRecord(data.totals).active),
      closed: int(asRecord(data.totals).closed),
      scored: int(asRecord(data.totals).scored),
      unscored: int(asRecord(data.totals).unscored),
    },
    advisory: str(data.advisory),
  };
}

type EstablishmentLine = {
  key: string;
  departmentId: string;
  departmentName: string;
  designation: string;
  sanctioned: number;
  filled: number;
  open: number;
  headroom: number;
  utilisationPercent: number | null;
  state: string;
};

type RequisitionRow = {
  id: string;
  code: string | null;
  title: string | null;
  department: string | null;
  positionCode: string | null;
  requisitionType: string;
  designation: string | null;
  positions: number;
  againstPositionCode: string | null;
  incumbent: string | null;
  status: string;
  budgetMinor: number | null;
  override: boolean;
  establishmentChecked: boolean;
  establishmentNote: string | null;
};

type Decision =
  | { allowed: true; consumesSanction: boolean; headroomAfter: number; overridden: boolean; warnings: string[] }
  | { allowed: false; code: string; message: string };

type Preview = {
  controlActive: boolean;
  controlNote: string | null;
  line: EstablishmentLine | null;
  decision: Decision | null;
  overriderAuthorised: boolean;
  overriderDistinctFromApprover: boolean;
};

type Establishment = {
  planYear: number;
  configured: boolean;
  overrideReasonMinLength: number;
  overrideRequiredPermission: string;
  stateLabels: Record<string, string>;
  lines: EstablishmentLine[];
  requisitions: RequisitionRow[];
  preview: Preview | null;
};

function readLine(raw: UnknownRecord, index: number): EstablishmentLine {
  return {
    key: `${str(raw.departmentId, String(index))}-${str(raw.designation, String(index))}`,
    departmentId: str(raw.departmentId),
    departmentName: str(raw.departmentName, "Unnamed department"),
    designation: str(raw.designation, "—"),
    sanctioned: int(raw.sanctioned),
    filled: int(raw.filled),
    open: int(raw.open),
    headroom: int(raw.headroom),
    utilisationPercent: num(raw.utilisationPercent),
    state: str(raw.state, "within_headroom"),
  };
}

function readDecision(raw: unknown): Decision | null {
  if (!raw) return null;
  const record = asRecord(raw);
  if (record.allowed === true) {
    return {
      allowed: true,
      consumesSanction: record.consumesSanction === true,
      headroomAfter: int(record.headroomAfter),
      overridden: record.overridden === true,
      warnings: strings(record.warnings),
    };
  }
  return { allowed: false, code: str(record.code, "BLOCKED"), message: str(record.message, "This requisition cannot be approved.") };
}

function readEstablishment(payload: unknown): Establishment {
  const data = asRecord(asRecord(payload).data);
  const preview = data.preview ? asRecord(data.preview) : null;
  return {
    planYear: int(data.planYear),
    configured: data.configured === true,
    overrideReasonMinLength: int(data.overrideReasonMinLength) || 20,
    overrideRequiredPermission: str(data.overrideRequiredPermission, "workforce.manpower.approve"),
    stateLabels: Object.fromEntries(
      Object.entries(asRecord(data.stateLabels)).map(([key, value]) => [key, String(value)]),
    ),
    lines: arr(data.lines).map(readLine),
    requisitions: arr(data.requisitions).map((raw) => ({
      id: str(raw.id),
      code: strOrNull(raw.code),
      title: strOrNull(raw.title),
      department: strOrNull(raw.department),
      positionCode: strOrNull(raw.positionCode),
      requisitionType: str(raw.requisitionType, "addition"),
      designation: strOrNull(raw.designation),
      positions: int(raw.positions) || 1,
      againstPositionCode: strOrNull(raw.againstPositionCode),
      incumbent: strOrNull(raw.incumbent),
      status: str(raw.status, "draft"),
      budgetMinor: num(raw.budgetMinor),
      override: raw.override === true,
      establishmentChecked: raw.establishmentChecked === true,
      establishmentNote: strOrNull(raw.establishmentNote),
    })),
    preview: preview
      ? {
          controlActive: preview.controlActive === true,
          controlNote: strOrNull(preview.controlNote),
          line: preview.line ? readLine(asRecord(preview.line), 0) : null,
          decision: readDecision(preview.decision),
          overriderAuthorised: preview.overriderAuthorised === true,
          overriderDistinctFromApprover: preview.overriderDistinctFromApprover === true,
        }
      : null,
  };
}

type Milestone = { key: string; label: string; amountMinor: number | null; state: string; blockedBy: string | null };

type ReferralRow = {
  referralId: string;
  reference: string;
  candidateName: string;
  roleTitle: string | null;
  department: string | null;
  referredBy: string | null;
  referredOn: string | null;
  pipelineStageLabel: string | null;
  status: string;
  award: {
    configured: boolean;
    currency: string | null;
    milestones: Milestone[];
    eligibleMinor: number | null;
    disbursedMinor: number | null;
    nextMilestone: { key: string; label: string; requirement: string } | null;
  };
};

type ReferralLedger = { schemeConfigured: boolean; schemeCode: string | null; currency: string | null; configurationGaps: string[]; rows: ReferralRow[] };

function readReferrals(payload: unknown): ReferralLedger {
  const data = asRecord(asRecord(payload).data);
  return {
    schemeConfigured: data.schemeConfigured === true,
    schemeCode: strOrNull(data.schemeCode),
    currency: strOrNull(data.currency),
    configurationGaps: strings(data.configurationGaps),
    rows: arr(data.rows).map((raw) => {
      const award = asRecord(raw.award);
      const next = award.nextMilestone ? asRecord(award.nextMilestone) : null;
      return {
        referralId: str(raw.referralId),
        reference: str(raw.reference, "—"),
        candidateName: str(raw.candidateName, "Unnamed candidate"),
        roleTitle: strOrNull(raw.roleTitle),
        department: strOrNull(raw.department),
        referredBy: strOrNull(raw.referredBy),
        referredOn: strOrNull(raw.referredOn),
        pipelineStageLabel: strOrNull(raw.pipelineStageLabel),
        status: str(raw.status, "referred"),
        award: {
          configured: award.configured === true,
          currency: strOrNull(award.currency),
          milestones: arr(award.milestones).map((milestone) => ({
            key: str(milestone.key),
            label: str(milestone.label),
            amountMinor: num(milestone.amountMinor),
            state: str(milestone.state, "pending"),
            blockedBy: strOrNull(milestone.blockedBy),
          })),
          eligibleMinor: num(award.eligibleMinor),
          disbursedMinor: num(award.disbursedMinor),
          nextMilestone: next ? { key: str(next.key), label: str(next.label), requirement: str(next.requirement) } : null,
        },
      };
    }),
  };
}

type InterviewSession = {
  sessionId: string;
  candidateName: string | null;
  planTitle: string | null;
  round: string | null;
  mode: string | null;
  scheduledAt: string | null;
  durationMinutes: number | null;
  status: string;
  debriefed: boolean;
  competencies: string[];
  panel: Array<{ membershipId: string; name: string | null; submitted: boolean }>;
  cardsSubmitted: number;
  cards: Array<{
    panelMemberId: string;
    own: boolean;
    competencyRatings: Array<{ competency: string; rating: number; remark: string | null }>;
    overallRating: string | null;
    strengths: string | null;
    concerns: string | null;
    recommendedBand: string | null;
  }>;
};

type InterviewPlan = {
  planId: string;
  title: string | null;
  status: string;
  rounds: string[];
  competencies: string[];
  requisitionTitle: string | null;
  sessionCount: number;
};

type Interviews = { plans: InterviewPlan[]; sessions: InterviewSession[] };

function readInterviews(payload: unknown): Interviews {
  const data = asRecord(asRecord(payload).data);
  return {
    plans: arr(data.plans).map((raw) => ({
      planId: str(raw.planId),
      title: strOrNull(raw.title),
      status: str(raw.status, "active"),
      rounds: strings(raw.rounds),
      competencies: strings(raw.competencies),
      requisitionTitle: strOrNull(raw.requisitionTitle),
      sessionCount: int(raw.sessionCount),
    })),
    sessions: arr(data.sessions).map((raw) => ({
      sessionId: str(raw.sessionId),
      candidateName: strOrNull(raw.candidateName),
      planTitle: strOrNull(raw.planTitle),
      round: strOrNull(raw.round),
      mode: strOrNull(raw.mode),
      scheduledAt: strOrNull(raw.scheduledAt),
      durationMinutes: num(raw.durationMinutes),
      status: str(raw.status, "scheduled"),
      debriefed: raw.debriefed === true,
      competencies: strings(raw.competencies),
      panel: arr(raw.panel).map((seat) => ({
        membershipId: str(seat.membershipId),
        name: strOrNull(seat.name),
        submitted: seat.submitted === true,
      })),
      cardsSubmitted: int(raw.cardsSubmitted),
      cards: arr(raw.cards).map((entry) => ({
        panelMemberId: str(entry.panelMemberId),
        own: entry.own === true,
        competencyRatings: arr(entry.competencyRatings).map((rating) => ({
          competency: str(rating.competency),
          rating: int(rating.rating),
          remark: strOrNull(rating.remark),
        })),
        overallRating: strOrNull(entry.overallRating),
        strengths: strOrNull(entry.strengths),
        concerns: strOrNull(entry.concerns),
        recommendedBand: strOrNull(entry.recommendedBand),
      })),
    })),
  };
}

type Fairness = {
  requirements: Array<{ key: string; label: string; requirement: string }>;
  readiness: { computable: boolean; missing: Array<{ key: string; label: string; requirement: string }>; statement: string };
  existingStance: string;
};

function readFairness(payload: unknown): Fairness {
  const data = asRecord(asRecord(payload).data);
  const readiness = asRecord(data.readiness);
  const mapEntry = (raw: UnknownRecord) => ({ key: str(raw.key), label: str(raw.label), requirement: str(raw.requirement) });
  return {
    requirements: arr(data.requirements).map(mapEntry),
    readiness: {
      computable: readiness.computable === true,
      missing: arr(readiness.missing).map(mapEntry),
      statement: str(readiness.statement),
    },
    existingStance: str(data.existingStance),
  };
}

// ---------------------------------------------------------------------------

const TABS = [
  { value: "pipeline", label: "Candidate pipeline" },
  { value: "establishment", label: "Approved manpower" },
  { value: "referrals", label: "Referral portal" },
  { value: "interviews", label: "Interview engine" },
  { value: "fairness", label: "Bias and DEI analytics" },
] as const;

export function TalentAcquisitionPage() {
  // Deep-link preselect (?record=<requisitionId>); lazy initializer keeps SSR stable.
  const [requisitionFilter, setRequisitionFilter] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("record") ?? "";
  });
  const [tab, setTab] = useState<string>("pipeline");
  const [revision, setRevision] = useState(0);

  const [board, setBoard] = useState<Board | null>(null);
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [referrals, setReferrals] = useState<ReferralLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [interviews, setInterviews] = useState<Interviews | null>(null);
  const [interviewsLoading, setInterviewsLoading] = useState(false);
  const [interviewsError, setInterviewsError] = useState("");

  const [fairness, setFairness] = useState<Fairness | null>(null);
  const [fairnessError, setFairnessError] = useState("");

  const [openFindingsFor, setOpenFindingsFor] = useState("");
  const [advanceBusy, setAdvanceBusy] = useState("");
  const [advanceError, setAdvanceError] = useState("");

  const refresh = useCallback(() => {
    invalidateGetRequests();
    setRevision((n) => n + 1);
  }, []);

  useEffect(() => {
    let live = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const query = requisitionFilter ? `&requisitionId=${encodeURIComponent(requisitionFilter)}` : "";
        const [boardPayload, establishmentPayload, referralPayload] = await Promise.all([
          getJson(`/api/v1/talent-pipeline?view=board${query}`),
          getJson("/api/v1/establishment"),
          getJson("/api/v1/talent-pipeline?view=referrals"),
        ]);
        if (!live) return;
        setBoard(readBoard(boardPayload));
        setEstablishment(readEstablishment(establishmentPayload));
        setReferrals(readReferrals(referralPayload));
      } catch (caught) {
        if (live) setError(caught instanceof Error ? caught.message : "The talent acquisition workspace could not be loaded.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [revision, requisitionFilter]);

  useEffect(() => {
    if (tab !== "interviews" || interviews) return;
    let live = true;
    void (async () => {
      setInterviewsLoading(true);
      setInterviewsError("");
      try {
        const payload = await getJson("/api/v1/talent-pipeline?view=interviews");
        if (live) setInterviews(readInterviews(payload));
      } catch (caught) {
        if (live) setInterviewsError(caught instanceof Error ? caught.message : "Interview plans could not be loaded.");
      } finally {
        if (live) setInterviewsLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [tab, interviews]);

  useEffect(() => {
    if (tab !== "fairness" || fairness) return;
    let live = true;
    void (async () => {
      try {
        const payload = await getJson("/api/v1/talent-pipeline?view=fairness");
        if (live) setFairness(readFairness(payload));
      } catch (caught) {
        if (live) setFairnessError(caught instanceof Error ? caught.message : "The fairness statement could not be loaded.");
      }
    })();
    return () => {
      live = false;
    };
  }, [tab, fairness]);

  /** One step forward, exactly as advanceApplication permits. Never a free drop. */
  const advance = useCallback(async (applicationId: string, to: string) => {
    setAdvanceBusy(applicationId);
    setAdvanceError("");
    try {
      const response = await fetch(`/api/v1/applications/${encodeURIComponent(applicationId)}/advance`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to }),
        cache: "no-store",
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        throw new Error(apiErrorMessage(body, response.status, `The stage could not be advanced (${response.status}).`));
      }
      invalidateGetRequests();
      setRevision((n) => n + 1);
    } catch (caught) {
      setAdvanceError(caught instanceof Error ? caught.message : "The stage could not be advanced.");
    } finally {
      setAdvanceBusy("");
    }
  }, []);

  const activePositions = useMemo(() => {
    const rows = establishment?.requisitions ?? [];
    return rows
      .filter((row) => row.status === "draft" || row.status === "submitted" || row.status === "approved")
      .reduce((total, row) => total + row.positions, 0);
  }, [establishment]);

  const utilisation = useMemo(() => {
    const lines = establishment?.lines ?? [];
    if (lines.length === 0) return null;
    const sanctioned = lines.reduce((total, line) => total + line.sanctioned, 0);
    if (sanctioned <= 0) return null;
    const committed = lines.reduce((total, line) => total + line.filled + line.open, 0);
    return Math.round((committed / sanctioned) * 100);
  }, [establishment]);

  const activeReferrals = useMemo(
    () => (referrals?.rows ?? []).filter((row) => row.status !== "closed" && row.status !== "rejected").length,
    [referrals],
  );

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px]">
      <PageIntro
        eyebrow="TALENT · SCR-090"
        title="Talent acquisition, establishment and referrals"
        description="Raise requisitions against approved manpower, move candidates one stage at a time, run structured panels, and settle referral awards. The match score is advisory: it rejects nobody and orders nobody."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold" onClick={refresh}>
              <RefreshCcw className="mr-1.5 size-4" /> Refresh
            </Button>
            <Link
              href="/talent?section=talent/requisitions"
              className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            >
              Raise a requisition
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active positions on live requisitions" value={activePositions} delta="Live" icon={Briefcase} />
        {utilisation === null ? (
          <UnknownMetricCard
            label="Sanctioned manpower utilisation"
            hint="Not configured"
            icon={ScaleIcon}
          />
        ) : (
          <MetricCard
            label="Sanctioned manpower utilisation"
            value={utilisation}
            suffix="%"
            delta={utilisation > 100 ? "Over plan" : "Within plan"}
            deltaDirection={utilisation > 100 ? "down" : "up"}
            icon={ScaleIcon}
          />
        )}
        <MetricCard label="Active referrals in the pipeline" value={activeReferrals} delta="Open" icon={UserPlus} />
        {/*
          The reference screen shows a "100% Fair / Zero Bias Classifier" tile.
          Nothing in this product can produce that figure, so the tile reports the
          gap instead of a number. See the DEI tab.
        */}
        <UnknownMetricCard
          label="Adverse impact ratio — no protected attribute is collected"
          hint="Not computable"
          icon={AlertTriangle}
        />
      </div>

      <Tabs value={tab} onValueChange={(value: unknown) => setTab(String(value))}>
        <TabsList aria-label="Talent acquisition views" className="mb-4 h-auto w-full max-w-full flex-wrap justify-start gap-1 p-1 group-data-horizontal/tabs:h-auto">
          {TABS.map((entry) => (
            <TabsTrigger key={entry.value} value={entry.value} className="h-10 flex-none px-3">
              {entry.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="pipeline">
          <Surface>
            <SectionHeading
              title="Candidate pipeline"
              description={
                board
                  ? `${board.totals.active} active · ${board.totals.scored} assessed · ${board.totals.unscored} not yet assessed · ${board.totals.closed} closed`
                  : "Loading the board…"
              }
              action={
                <div className="flex flex-wrap gap-2">
                  <input
                    aria-label="Filter by requisition id"
                    className={inputClass}
                    placeholder="Requisition id"
                    value={requisitionFilter}
                    onChange={(event) => setRequisitionFilter(event.target.value.trim())}
                  />
                </div>
              }
            />
            <p className="mb-4 flex items-start gap-2 rounded-xl border border-ai/30 bg-ai/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              <Sparkles className="mt-0.5 size-3.5 shrink-0 text-ai" />
              {board?.advisory ||
                "The match score is assistive. It rejects nobody, it is never used to order candidates against one another, and every score can show the findings and evidence it rests on."}
            </p>
            {advanceError ? <p role="alert" className="mb-3 text-xs text-destructive">{advanceError}</p> : null}
            <LoadState
              loading={loading}
              error={error}
              onRetry={refresh}
              empty={(board?.columns ?? []).every((column) => column.cards.length === 0) && (board?.closed.length ?? 0) === 0}
              emptyText="No applications exist yet. Raise a requisition, approve a job description, then submit a candidate against it."
            >
              <div className="grid gap-4 xl:grid-cols-4">
                {(board?.columns ?? []).map((column) => (
                  <section key={column.id} aria-label={column.label} className="min-w-0">
                    <div className="mb-3 rounded-xl border border-border bg-secondary/30 px-3 py-2">
                      <p className="text-xs font-bold text-foreground">
                        {column.label} <span className="font-normal text-muted-foreground">({column.cards.length})</span>
                      </p>
                      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{column.caption}</p>
                    </div>
                    <div className="space-y-3">
                      {column.cards.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted-foreground">
                          Nothing at this stage.
                        </p>
                      ) : (
                        column.cards.map((card) => {
                          const open = openFindingsFor === card.applicationId;
                          return (
                            <article key={card.applicationId} className="rounded-xl border border-border bg-card p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-bold text-foreground">{card.candidateName}</p>
                                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                    {card.roleTitle ?? "Role not named"}
                                    {card.requisitionCode ? ` · ${card.requisitionCode}` : ""}
                                  </p>
                                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                    {card.department ?? "No department"} · {card.stageLabel}
                                  </p>
                                </div>
                                {card.matchScore === null ? (
                                  <StatusPill tone="neutral">Not assessed</StatusPill>
                                ) : (
                                  <button
                                    type="button"
                                    aria-expanded={open}
                                    onClick={() => setOpenFindingsFor(open ? "" : card.applicationId)}
                                    className="shrink-0 rounded-md border border-ai/25 bg-ai/10 px-2 py-1 text-[11px] font-bold text-ai hover:bg-ai/20"
                                  >
                                    {card.matchScore}/100 · basis
                                  </button>
                                )}
                              </div>

                              <p className="mt-2 text-[11px] text-muted-foreground">
                                Experience: <span className="italic">not captured on the candidate record</span>
                                {card.source ? ` · Source: ${card.source}` : ""}
                              </p>

                              <div className="mt-2 flex flex-wrap gap-1">
                                {card.skills.length === 0 ? (
                                  <span className="text-[11px] italic text-muted-foreground">No extracted skills</span>
                                ) : (
                                  card.skills.slice(0, 6).map((skill) => (
                                    <span key={skill} className="rounded-lg border border-border/70 bg-secondary/40 px-2 py-0.5 text-[10px] text-foreground">
                                      {skill}
                                    </span>
                                  ))
                                )}
                              </div>

                              {open && card.scoreBasis ? (
                                <div className="mt-3 rounded-lg border border-border bg-secondary/20 p-2">
                                  <p className="text-[11px] font-bold text-foreground">Why this score</p>
                                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                                    JD {card.scoreBasis.jdVersion ?? "—"} · rubric {card.scoreBasis.rubricVersion ?? "—"} · prompt{" "}
                                    {card.scoreBasis.promptVersion ?? "—"} · model {card.scoreBasis.modelVersion ?? "—"} · extraction{" "}
                                    {card.scoreBasis.extractionChecksum ? card.scoreBasis.extractionChecksum.slice(0, 12) : "—"}
                                  </p>
                                  {card.scoreBasis.findings.length === 0 ? (
                                    <p className="mt-2 text-[10px] text-muted-foreground">
                                      No findings were recorded against this score, so it cannot show its basis. Re-run scoring on the frozen extraction.
                                    </p>
                                  ) : (
                                    <ul className="mt-2 space-y-2">
                                      {card.scoreBasis.findings.map((finding, index) => (
                                        <li key={`${finding.requirementRef}-${index}`} className="border-t border-border/50 pt-1.5 first:border-0 first:pt-0">
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="text-[10px] font-semibold text-foreground">{finding.requirementRef}</span>
                                            <StatusPill tone={judgmentTone(finding.judgment)}>{finding.judgment.replace(/_/g, " ")}</StatusPill>
                                          </div>
                                          <p className="mt-1 text-[10px] text-muted-foreground">Provenance: {finding.provenance}</p>
                                          {finding.evidence.length === 0 ? (
                                            <p className="text-[10px] italic text-muted-foreground">No evidence locator recorded.</p>
                                          ) : (
                                            finding.evidence.map((item, evidenceIndex) => (
                                              <p key={`${item.locator}-${evidenceIndex}`} className="text-[10px] text-muted-foreground">
                                                Evidence at {item.locator || "—"} · excerpt {item.excerptHash ? item.excerptHash.slice(0, 10) : "—"}
                                              </p>
                                            ))
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                  <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                                    Advisory only. No automatic rejection; the score assists, humans decide.
                                  </p>
                                </div>
                              ) : null}

                              {card.nextStage ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="mt-3 h-10 sm:h-8 w-full rounded-lg text-[11px]"
                                  disabled={advanceBusy === card.applicationId}
                                  onClick={() => void advance(card.applicationId, card.nextStage!)}
                                >
                                  {advanceBusy === card.applicationId ? "Moving…" : `Move to ${card.nextStageLabel}`}
                                  <ArrowRight className="ml-1.5 size-3.5" />
                                </Button>
                              ) : (
                                <p className="mt-3 text-[10px] text-muted-foreground">
                                  No forward move: this stage ends the flow or the application is closed.
                                </p>
                              )}
                            </article>
                          );
                        })
                      )}
                    </div>
                  </section>
                ))}
              </div>

              {(board?.closed.length ?? 0) > 0 ? (
                <div className="mt-6">
                  <SectionHeading
                    title="Closed applications"
                    description="Withdrawn, rejected, declined or closed. Shown because an ended application is a fact, not a gap — but it is not a column of work and cannot be moved."
                  />
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead>
                        <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          <th className="px-3 py-2 font-bold">Candidate</th>
                          <th className="px-3 py-2 font-bold">Role</th>
                          <th className="px-3 py-2 font-bold">Outcome</th>
                          <th className="px-3 py-2 font-bold">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(board?.closed ?? []).map((card) => (
                          <tr key={card.applicationId} className="border-t border-border/60">
                            <td className="px-3 py-2 text-xs font-semibold text-foreground">{card.candidateName}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{card.roleTitle ?? "—"}</td>
                            <td className="px-3 py-2 text-xs"><StatusPill tone="neutral">{card.stageLabel}</StatusPill></td>
                            <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">
                              {card.matchScore === null ? "Not assessed" : `${card.matchScore}/100`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {(board?.unmapped.length ?? 0) > 0 ? (
                <p className="mt-4 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                  {board?.unmapped.length} application(s) hold a stage that is neither in the hiring flow nor a recognised ending. They are shown here rather than hidden, and need a data fix.
                </p>
              ) : null}
            </LoadState>
          </Surface>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="establishment">
          <EstablishmentTab
            data={establishment}
            loading={loading}
            error={error}
            onRetry={refresh}
          />
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="referrals">
          <Surface>
            <SectionHeading
              title="Employee referral portal"
              description="Referrals raised by employees, their pipeline position, and what each award has actually matured into."
              action={
                referrals?.schemeConfigured ? (
                  <StatusPill tone="success">Scheme {referrals.schemeCode}</StatusPill>
                ) : (
                  <StatusPill tone="danger">No award scheme configured</StatusPill>
                )
              }
            />
            {(referrals?.configurationGaps.length ?? 0) > 0 ? (
              <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2">
                <p className="text-xs font-bold text-foreground">Amounts cannot be stated</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-muted-foreground">
                  {(referrals?.configurationGaps ?? []).map((gap) => (
                    <li key={gap}>{gap}</li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  RL-470 makes the award amount and its split per-programme configuration, and RL-471 requires it to mature in two parts:
                  a part on joining and the balance on confirmation. No scheme master exists in this product, so no figure is shown here.
                  A default would be a number paid to a real person that nobody approved.
                </p>
              </div>
            ) : null}
            <LoadState
              loading={loading}
              error={error}
              onRetry={refresh}
              empty={(referrals?.rows.length ?? 0) === 0}
              emptyText="No referrals have been raised. An employee refers a candidate from the engagement workspace."
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2 font-bold">Ref</th>
                      <th className="px-3 py-2 font-bold">Candidate</th>
                      <th className="px-3 py-2 font-bold">Role / department</th>
                      <th className="px-3 py-2 font-bold">Referred by</th>
                      <th className="px-3 py-2 font-bold">Pipeline status</th>
                      <th className="px-3 py-2 font-bold">Bonus disbursed / eligible</th>
                      <th className="px-3 py-2 font-bold">Next payout milestone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(referrals?.rows ?? []).map((row) => (
                      <tr key={row.referralId} className="border-t border-border/60 align-top">
                        <td className="px-3 py-2 text-xs font-semibold text-foreground">
                          {row.reference}
                          <span className="block font-normal text-muted-foreground">{formatDate(row.referredOn)}</span>
                        </td>
                        <td className="px-3 py-2 text-xs text-foreground">{row.candidateName}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {row.roleTitle ?? "Role not named"}
                          <span className="block">{row.department ?? "No department"}</span>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{row.referredBy ?? "Referrer not linked"}</td>
                        <td className="px-3 py-2 text-xs">
                          <StatusPill tone="info">{row.pipelineStageLabel ?? "No application"}</StatusPill>
                        </td>
                        <td className="px-3 py-2 text-xs tabular-nums text-foreground">
                          {row.award.configured && row.award.disbursedMinor !== null && row.award.eligibleMinor !== null ? (
                            <>
                              {money(row.award.disbursedMinor, row.award.currency)} / {money(row.award.eligibleMinor, row.award.currency)}
                            </>
                          ) : (
                            <span className="italic text-muted-foreground">Not configured</span>
                          )}
                          <span className="mt-1 flex flex-wrap gap-1">
                            {row.award.milestones.map((milestone) => (
                              <StatusPill key={milestone.key} tone={milestoneTone(milestone.state)}>
                                {milestone.label}: {milestone.amountMinor === null ? "no amount" : money(milestone.amountMinor, row.award.currency)}
                              </StatusPill>
                            ))}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                          {row.award.nextMilestone
                            ? `${row.award.nextMilestone.label} — ${row.award.nextMilestone.requirement}`
                            : "Both legs settled."}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </LoadState>
            <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
              The two-part maturation shown above is computed by this screen&apos;s own read model. The referral award endpoint that actually
              pays (<code>POST /api/v1/referrals/:id/award</code>) is still the original single tenure gate and settles the whole award once;
              it has not been changed.
            </p>
          </Surface>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="interviews">
          <InterviewsTab
            data={interviews}
            loading={interviewsLoading}
            error={interviewsError}
            onRetry={() => {
              setInterviews(null);
              refresh();
            }}
          />
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="fairness">
          <FairnessTab data={fairness} error={fairnessError} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------

function EstablishmentTab({ data, loading, error, onRetry }: {
  data: Establishment | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  const [form, setForm] = useState({
    requisitionType: "addition",
    departmentId: "",
    designation: "",
    positions: "1",
    againstPositionCode: "",
    override: false,
    overrideReason: "",
  });
  /** Keyed by the query it was resolved for, so a stale panel is never shown. */
  const [resolved, setResolved] = useState<{ query: string; preview: Preview | null; error: string } | null>(null);

  const ready =
    form.requisitionType === "replacement"
      ? form.againstPositionCode.trim().length > 0
      : form.departmentId.trim().length > 0 && form.designation.trim().length > 0;

  const query = useMemo(() => {
    if (!ready) return "";
    const params = new URLSearchParams({
      previewRequisitionType: form.requisitionType,
      previewPositions: form.positions || "1",
    });
    if (form.departmentId) params.set("previewDepartmentId", form.departmentId);
    if (form.designation) params.set("previewDesignation", form.designation);
    if (form.againstPositionCode) params.set("previewAgainstPositionCode", form.againstPositionCode);
    if (form.override) params.set("previewOverride", "true");
    if (form.overrideReason) params.set("previewOverrideReason", form.overrideReason);
    return params.toString();
  }, [ready, form]);

  // The block reason is resolved server-side by the same decideRequisition the
  // approval path calls, so the rule is never restated here.
  useEffect(() => {
    if (!query) return;
    let live = true;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const payload = await getJson(`/api/v1/establishment?${query}`);
          if (live) setResolved({ query, preview: readEstablishment(payload).preview, error: "" });
        } catch (caught) {
          if (live) {
            setResolved({
              query,
              preview: null,
              error: caught instanceof Error ? caught.message : "The headroom preview could not be resolved.",
            });
          }
        }
      })();
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);

  const current = resolved && resolved.query === query ? resolved : null;
  const preview = current?.preview ?? null;
  const previewError = current?.error ?? "";
  const blocked = preview?.decision?.allowed === false;
  const minLength = data?.overrideReasonMinLength ?? 20;

  return (
    <div className="space-y-6">
      <Surface>
        <SectionHeading
          title="Approved manpower and establishment"
          description={
            data
              ? `Plan year ${data.planYear}. Filled and open are derived from assignments and live requisitions; neither is stored (RL-056). Headroom is sanctioned minus filled minus open (RL-057).`
              : "Loading sanctioned strength…"
          }
        />
        <LoadState
          loading={loading}
          error={error}
          onRetry={onRetry}
          empty={(data?.lines.length ?? 0) === 0}
          emptyText="Establishment control is not configured. No approved manpower line exists for this plan year, so there is no ceiling to measure against and no headroom to show — this is not a utilisation of zero. Approve sanctioned strength on the sanctioned strength board to turn the control on."
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(data?.lines ?? []).map((line) => {
              const percent = line.utilisationPercent;
              return (
                <article key={line.key} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-foreground">{line.designation}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{line.departmentName}</p>
                    </div>
                    <StatusPill tone={establishmentTone(line.state)}>
                      {data?.stateLabels[line.state] ?? line.state}
                    </StatusPill>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span>Utilisation</span>
                      <span className="font-bold tabular-nums text-foreground">
                        {percent === null ? "Nothing sanctioned" : `${percent}%`}
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className={`h-full rounded-full ${
                          line.state === "over_plan" ? "bg-destructive" : line.state === "at_limit" ? "bg-warning" : "bg-success"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, percent ?? 0))}%` }}
                      />
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                    {[
                      ["Sanctioned", line.sanctioned],
                      ["Filled", line.filled],
                      ["Open", line.open],
                      ["Headroom", line.headroom],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-lg border border-border/60 bg-secondary/20 py-1.5">
                        <dt className="text-[10px] text-muted-foreground">{label}</dt>
                        <dd className="text-xs font-bold tabular-nums text-foreground">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </article>
              );
            })}
          </div>
        </LoadState>
      </Surface>

      <Surface>
        <SectionHeading
          title="Requisition register"
          description="Every requisition with the classification that decides whether it consumes fresh sanctioned strength."
        />
        <LoadState
          loading={loading}
          error={error}
          onRetry={onRetry}
          empty={(data?.requisitions.length ?? 0) === 0}
          emptyText="No requisitions have been raised yet."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 font-bold">Position code</th>
                  <th className="px-3 py-2 font-bold">Job title</th>
                  <th className="px-3 py-2 font-bold">Department</th>
                  <th className="px-3 py-2 font-bold">Type</th>
                  <th className="px-3 py-2 font-bold">Vacated code / incumbent</th>
                  <th className="px-3 py-2 font-bold">Budget</th>
                  <th className="px-3 py-2 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {(data?.requisitions ?? []).map((row) => (
                  <tr key={row.id} className="border-t border-border/60 align-top">
                    <td className="px-3 py-2 text-xs font-semibold text-foreground">
                      {row.positionCode ?? "—"}
                      <span className="block font-normal text-muted-foreground">{row.code ?? row.id.slice(0, 8)}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-foreground">
                      {row.title ?? "Untitled"}
                      {row.positions > 1 ? <span className="block text-[11px] text-muted-foreground">{row.positions} positions</span> : null}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {row.department ?? "—"}
                      {row.designation ? <span className="block">{row.designation}</span> : null}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <StatusPill tone={row.requisitionType === "replacement" ? "info" : "violet"}>
                        {row.requisitionType === "replacement" ? "REPLACEMENT" : "NEW ADDITION"}
                      </StatusPill>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {row.requisitionType === "replacement"
                        ? `${row.againstPositionCode ?? "No vacated code"}${row.incumbent ? ` · ${row.incumbent}` : ""}`
                        : "Not applicable"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {row.budgetMinor === null ? <span className="italic">Not captured</span> : money(row.budgetMinor, null)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <StatusPill tone={requisitionTone(row.status)}>{row.status}</StatusPill>
                      {row.override ? <span className="mt-1 block"><StatusPill tone="warning">Overridden</StatusPill></span> : null}
                      {!row.establishmentChecked && row.status === "approved" ? (
                        <span className="mt-1 block text-[10px] leading-snug text-muted-foreground">
                          {row.establishmentNote ?? "Approved without an establishment check."}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            No budget figure is held against a requisition anywhere in this product, so the Budget column reports the field as not captured
            rather than printing an amount.
          </p>
        </LoadState>
      </Surface>

      <Surface>
        <SectionHeading
          title="Raise a requisition"
          description="The headroom consequence is resolved before you submit. The rule runs on the server — this panel calls the same decision the approval path applies."
        />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="flex w-full min-w-0 flex-col gap-1 text-[11px] font-bold text-muted-foreground sm:w-auto">
            Requisition type
            <select
              className={selectClass}
              value={form.requisitionType}
              onChange={(event) => setForm((current) => ({ ...current, requisitionType: event.target.value }))}
            >
              <option value="addition">New addition</option>
              <option value="replacement">Replacement</option>
            </select>
          </label>
          <label className="flex w-full min-w-0 flex-col gap-1 text-[11px] font-bold text-muted-foreground sm:w-auto">
            Department
            <ReferencePicker
              endpoint="/api/v1/organization/departments"
              className={inputClass}
              value={form.departmentId}
              placeholder="Search a department…"
              onChange={(value) => setForm((current) => ({ ...current, departmentId: value.trim() }))}
            />
          </label>
          <label className="flex w-full min-w-0 flex-col gap-1 text-[11px] font-bold text-muted-foreground sm:w-auto">
            Designation
            <input
              className={inputClass}
              value={form.designation}
              placeholder="Spinning Operator"
              onChange={(event) => setForm((current) => ({ ...current, designation: event.target.value }))}
            />
          </label>
          <label className="flex w-full min-w-0 flex-col gap-1 text-[11px] font-bold text-muted-foreground sm:w-auto">
            Positions
            <input
              className={inputClass}
              inputMode="numeric"
              value={form.positions}
              onChange={(event) => setForm((current) => ({ ...current, positions: event.target.value.replace(/\D/g, "") }))}
            />
          </label>
          {form.requisitionType === "replacement" ? (
            <label className="flex w-full min-w-0 flex-col gap-1 text-[11px] font-bold text-muted-foreground sm:w-auto">
              Vacated position code
              <input
                className={inputClass}
                value={form.againstPositionCode}
                placeholder="SPN-OP-03"
                onChange={(event) => setForm((current) => ({ ...current, againstPositionCode: event.target.value.trim() }))}
              />
            </label>
          ) : null}
        </div>

        <div className="mt-4 rounded-xl border border-border bg-secondary/20 p-3">
          <p className="text-xs font-bold text-foreground">Headroom preview</p>
          {previewError ? (
            <p role="alert" className="mt-1 text-[11px] text-destructive">{previewError}</p>
          ) : !ready ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {form.requisitionType === "replacement"
                ? "Enter the vacated position code to check whether it can be backfilled."
                : "Enter a department and designation to resolve the sanction key."}
            </p>
          ) : !preview ? (
            <p className="mt-1 text-[11px] text-muted-foreground">Resolving…</p>
          ) : !preview.controlActive ? (
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{preview.controlNote}</p>
          ) : preview.decision === null ? (
            <p className="mt-1 text-[11px] leading-relaxed text-warning">{preview.controlNote}</p>
          ) : preview.decision.allowed ? (
            <div className="mt-1 space-y-1">
              <StatusPill tone={preview.decision.overridden ? "warning" : "success"}>
                {preview.decision.overridden ? "Allowed under a recorded override" : "Within approved manpower"}
              </StatusPill>
              <p className="text-[11px] text-muted-foreground">
                Headroom after approval: <span className="font-bold tabular-nums text-foreground">{preview.decision.headroomAfter}</span>
                {preview.decision.consumesSanction ? " · consumes fresh sanctioned strength" : " · consumes no fresh sanctioned strength"}
              </p>
              {preview.decision.warnings.map((warning) => (
                <p key={warning} className="text-[11px] text-warning">{warning}</p>
              ))}
            </div>
          ) : (
            <div className="mt-1 space-y-1">
              <StatusPill tone="danger">Blocked · {preview.decision.code}</StatusPill>
              <p className="text-[11px] leading-relaxed text-muted-foreground">{preview.decision.message}</p>
            </div>
          )}
          {preview?.line ? (
            <p className="mt-2 text-[10px] text-muted-foreground">
              Sanctioned {preview.line.sanctioned} · filled {preview.line.filled} · open {preview.line.open} · headroom {preview.line.headroom}
            </p>
          ) : null}
        </div>

        {blocked ? (
          <div className="mt-4 rounded-xl border border-warning/40 bg-warning/5 p-3">
            <p className="text-xs font-bold text-foreground">Override (RL-463)</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Exceeding approved manpower requires the <code>{data?.overrideRequiredPermission ?? "workforce.manpower.approve"}</code>{" "}
              permission and a recorded justification of at least {minLength} characters. The person who approved the ceiling may not also
              waive it.
            </p>
            <label className="mt-2 flex w-full min-w-0 items-center gap-2 text-[11px] font-bold text-muted-foreground sm:w-auto">
              <input
                type="checkbox"
                className="size-4"
                checked={form.override}
                onChange={(event) => setForm((current) => ({ ...current, override: event.target.checked }))}
              />
              Request an override
            </label>
            {form.override ? (
              <>
                <textarea
                  aria-label="Override reason"
                  className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground"
                  rows={3}
                  value={form.overrideReason}
                  onChange={(event) => setForm((current) => ({ ...current, overrideReason: event.target.value }))}
                  placeholder="Why this addition must exceed approved manpower"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {form.overrideReason.trim().length}/{minLength} characters.
                  {preview && !preview.overriderAuthorised
                    ? " Your role does not hold the manpower approval permission, so this override will be refused."
                    : ""}
                  {preview && preview.overriderAuthorised && !preview.overriderDistinctFromApprover
                    ? " You approved this ceiling, so you may not waive it."
                    : ""}
                </p>
              </>
            ) : null}
          </div>
        ) : null}

        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
          Submitting a requisition and approving it remain separate, guarded actions. Raise the draft on the requisition workflow, then
          approve it — the establishment gate is applied at approval, which is where RL-462 puts it.
        </p>
        <Link
          href="/talent?section=talent/requisitions"
          className="mt-2 inline-flex h-10 sm:h-9 items-center rounded-lg border border-border px-3 text-xs font-bold hover:bg-secondary"
        >
          Open the requisition workflow <ChevronRight className="ml-1 size-3.5" />
        </Link>
      </Surface>
    </div>
  );
}

// ---------------------------------------------------------------------------

function InterviewsTab({ data, loading, error, onRetry }: {
  data: Interviews | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-6">
      <Surface>
        <SectionHeading
          title="Interview plans"
          description="A plan names its rounds and the competencies its scorecard rates. Sessions are scheduled against a plan and an application."
        />
        <LoadState
          loading={loading}
          error={error}
          onRetry={onRetry}
          empty={(data?.plans.length ?? 0) === 0}
          emptyText="No interview plan exists yet. Create one against a requisition to define its rounds and scorecard competencies."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 font-bold">Plan</th>
                  <th className="px-3 py-2 font-bold">Requisition</th>
                  <th className="px-3 py-2 font-bold">Rounds</th>
                  <th className="px-3 py-2 font-bold">Competencies rated</th>
                  <th className="px-3 py-2 font-bold">Sessions</th>
                </tr>
              </thead>
              <tbody>
                {(data?.plans ?? []).map((plan) => (
                  <tr key={plan.planId} className="border-t border-border/60 align-top">
                    <td className="px-3 py-2 text-xs font-semibold text-foreground">
                      {plan.title ?? "Untitled plan"}
                      <span className="mt-1 block"><StatusPill tone="neutral">{plan.status}</StatusPill></span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{plan.requisitionTitle ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{plan.rounds.join(" → ") || "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{plan.competencies.join(", ") || "No scorecard competencies"}</td>
                    <td className="px-3 py-2 text-xs tabular-nums text-foreground">{plan.sessionCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </LoadState>
      </Surface>

      <Surface>
        <SectionHeading
          title="Sessions, panels and the debrief seal"
          description="Every panel member files one card. Cards stay sealed until the session is debriefed, so nobody's rating can anchor anybody else's."
        />
        <LoadState
          loading={loading}
          error={error}
          onRetry={onRetry}
          empty={(data?.sessions.length ?? 0) === 0}
          emptyText="No interview session has been scheduled."
        >
          <div className="space-y-4">
            {(data?.sessions ?? []).map((session) => (
              <article key={session.sessionId} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground">
                      {session.candidateName ?? "Candidate not linked"} ·{" "}
                      {session.round ? picklistLabel("PL_INTERVIEW_ROUND", session.round) : "round not named"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {session.planTitle ?? "No plan"} · scheduled {formatDate(session.scheduledAt)}
                      {session.durationMinutes === null ? "" : ` · ${session.durationMinutes} min`}
                      {session.mode ? ` · ${picklistLabel("PL_INTERVIEW_MODE", session.mode)}` : ""}
                    </p>
                  </div>
                  <StatusPill tone={session.debriefed ? "success" : "warning"}>
                    {session.debriefed ? "Debriefed · cards released" : `Sealed · ${session.cardsSubmitted} card(s) filed`}
                  </StatusPill>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Panel</p>
                    <ul className="mt-1 space-y-1">
                      {session.panel.length === 0 ? (
                        <li className="text-[11px] italic text-muted-foreground">No panel seated.</li>
                      ) : (
                        session.panel.map((seat) => (
                          <li key={seat.membershipId} className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="text-foreground">{seat.name ?? "Panel member not linked to an employee"}</span>
                            <StatusPill tone={seat.submitted ? "success" : "neutral"}>
                              {seat.submitted ? "Card filed" : "Awaiting card"}
                            </StatusPill>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Competencies and ratings</p>
                    {session.competencies.length === 0 ? (
                      <p className="mt-1 text-[11px] italic text-muted-foreground">This plan&apos;s scorecard names no competencies.</p>
                    ) : (
                      <p className="mt-1 text-[11px] text-muted-foreground">{session.competencies.join(", ")}</p>
                    )}
                    {session.cards.length === 0 ? (
                      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                        {session.debriefed
                          ? "No card has been filed for this session."
                          : "Cards are sealed until the debrief. Only your own card is visible before then, and you have not filed one."}
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {session.cards.map((card) => (
                          <li key={card.panelMemberId} className="rounded-lg border border-border/60 bg-secondary/20 p-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold text-foreground">
                                {card.own ? "Your card" : "Panel card"}
                              </span>
                              {card.overallRating ? <StatusPill tone="info">{picklistLabel("PL_INTERVIEW_VERDICT", card.overallRating)}</StatusPill> : null}
                            </div>
                            <dl className="mt-1 space-y-0.5">
                              {card.competencyRatings.map((rating) => (
                                <div key={rating.competency} className="text-[10px]">
                                  <div className="flex justify-between gap-2">
                                    <dt className="text-muted-foreground">{rating.competency}</dt>
                                    <dd className="font-bold tabular-nums text-foreground">{rating.rating}/5</dd>
                                  </div>
                                  {rating.remark ? <p className="mt-0.5 leading-relaxed text-muted-foreground">{rating.remark}</p> : null}
                                </div>
                              ))}
                            </dl>
                            {card.strengths ? (
                              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                                <span className="font-semibold text-foreground">Strengths: </span>{card.strengths}
                              </p>
                            ) : null}
                            {card.concerns ? (
                              <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                                <span className="font-semibold text-foreground">Concerns: </span>{card.concerns}
                              </p>
                            ) : null}
                            {card.recommendedBand ? (
                              <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                                <span className="font-semibold text-foreground">Recommended band: </span>{card.recommendedBand}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </LoadState>
        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
          Scheduling a session, filing a card and releasing the debrief are writes and stay on their own guarded endpoints
          (<code>POST /api/v1/interview-sessions</code>, <code>POST /api/v1/interview-scores</code>,
          {" "}<code>POST /api/v1/interview-sessions/:id/debrief</code>). This screen reads them; it does not bypass the seal.
        </p>
      </Surface>
    </div>
  );
}

// ---------------------------------------------------------------------------

function FairnessTab({ data, error }: { data: Fairness | null; error: string }) {
  return (
    <div className="space-y-6">
      <Surface className="border-warning/40">
        <SectionHeading
          title="Adverse impact ratio: not computable"
          description="No figure is shown here, because none can be derived from anything this product holds."
          action={<StatusPill tone="warning">No number</StatusPill>}
        />
        {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
        <p className="text-xs leading-relaxed text-muted-foreground">
          {data?.readiness.statement ??
            "An adverse impact ratio cannot be computed. No protected attribute is captured anywhere in this product, so no per-group selection rate exists and no ratio has any inputs."}
        </p>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          The <code>employees</code> table carries employee code, names, work email, designation, designation level, department, location,
          category, payroll owner, manager, joining date, status, salary and currency. It carries no sex, no age, no disability status and no
          other protected characteristic, and nor does any candidate table. Adding such columns is a data-protection decision with a lawful
          basis behind it, not a screen change, so this tab asks for it rather than doing it.
        </p>
      </Surface>

      <Surface>
        <SectionHeading
          title="What an adverse impact ratio actually requires"
          description="Each row below is a precondition. The ratio may be published only once every one of them is satisfied."
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-bold">Required input</th>
                <th className="px-3 py-2 font-bold">What it means</th>
                <th className="px-3 py-2 font-bold">Present here</th>
              </tr>
            </thead>
            <tbody>
              {(data?.requirements ?? DEFAULT_REQUIREMENTS).map((requirement) => (
                <tr key={requirement.key} className="border-t border-border/60 align-top">
                  <td className="px-3 py-2 text-xs font-semibold text-foreground">{requirement.label}</td>
                  <td className="px-3 py-2 text-xs leading-relaxed text-muted-foreground">{requirement.requirement}</td>
                  <td className="px-3 py-2 text-xs">
                    <StatusPill tone="danger">Absent</StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Surface>

      <Surface>
        <SectionHeading title="The stance this repository already takes" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          {data?.existingStance ??
            "The only existing position this repository takes on adverse impact is a test named “forbids adverse automated use”. No metric, threshold or report exists behind it."}
        </p>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          That is consistent with the hiring policy elsewhere on this screen: exactly one advisory score per application, carrying its
          findings and evidence, never used to reject automatically and never used to order candidates against one another. A fairness
          percentage printed without inputs would be the opposite of that discipline — a number that looks like assurance and measures
          nothing.
        </p>
      </Surface>
    </div>
  );
}

const DEFAULT_REQUIREMENTS: Fairness["requirements"] = [
  {
    key: "protected_attribute_set",
    label: "A defined protected-attribute set",
    requirement: "The attributes the ratio is measured across must be named and version-controlled before any rate can be grouped.",
  },
  {
    key: "consent_bound_capture",
    label: "Consent-bound collection under the DPDP Act",
    requirement: "Each attribute must be collected with specific, informed, purpose-bound notice and consent, held apart from selection decisions, and withdrawable.",
  },
  {
    key: "stage_selection_rates",
    label: "Per-stage selection rates by group",
    requirement: "For every stage transition, the count entering and the count selected, split by group.",
  },
  {
    key: "reference_group",
    label: "A declared reference group and minimum cohort size",
    requirement: "The group the ratio is taken against, plus a floor below which no rate is published.",
  },
];
