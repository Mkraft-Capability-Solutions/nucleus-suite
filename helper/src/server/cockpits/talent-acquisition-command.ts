import "server-only";

import { listApplications } from "@/server/talent/service";
import { loadPipelineBoard, loadRequisitionRegister, PIPELINE_STAGE_FLOW, STAGE_LABELS } from "@/server/talent/pipeline";
import { listPostings } from "@/server/interviews/service";
import type { Access } from "@/server/platform/access";
import { derived, ratio, source, unsupported, type Source } from "./source";

/**
 * S4 — Talent Acquisition Command.
 *
 * The funnel and the offer bridge are counted from the recorded stage on each
 * application. Two limitations are carried through to the screen rather than
 * papered over:
 *
 *  1. An application that ended (withdrawn / rejected / declined / closed) no
 *     longer carries the furthest stage it reached, and the per-application
 *     stage history is not readable in bulk. Such applications are therefore
 *     counted at "Applied" only.
 *  2. `offers.attributes` records status, amount, currency and joining date —
 *     and nothing else. There is no decline reason anywhere in the schema, so
 *     the bridge decomposes by recorded stage, not by reason. No "counter
 *     offer" style bucket is invented (DESIGN_SYSTEM.md section 9).
 */

/* -------------------------------------------------------------------------- */
/* Pure helpers (unit-tested in ./talent-acquisition-command.test.ts)         */
/* -------------------------------------------------------------------------- */

const FLOW: readonly string[] = PIPELINE_STAGE_FLOW;

/** The funnel milestones, each pinned to its index in the contract's stage flow. */
export const FUNNEL_MILESTONES = [
  { key: "applied", label: "Applied", stage: "applied" },
  { key: "screened", label: "Screened", stage: "screening" },
  { key: "interviewed", label: "Interviewed", stage: "interview" },
  { key: "offered", label: "Offered", stage: "offered" },
  { key: "joined", label: "Joined", stage: "converted" },
] as const;

export type FunnelStage = { label: string; value: number };

export type HiringFunnel = {
  stages: FunnelStage[];
  /** Applications whose recorded stage is terminal, counted at "Applied" only. */
  terminal: number;
  total: number;
};

/**
 * Cumulative funnel counts from the recorded stage of each application.
 *
 * An application sitting at "offered" necessarily passed screening and
 * interview, so each milestone counts every application at or beyond it. A
 * terminal application contributes to "Applied" and to nothing further, because
 * the row does not record how far it got before it ended.
 */
export function buildHiringFunnel(stages: readonly string[]): HiringFunnel {
  const indices = stages.map((stage) => FLOW.indexOf(stage));
  const terminal = indices.filter((index) => index === -1).length;
  return {
    stages: FUNNEL_MILESTONES.map((milestone) => {
      const threshold = FLOW.indexOf(milestone.stage);
      return {
        label: milestone.label,
        value: threshold <= 0 ? stages.length : indices.filter((index) => index >= threshold).length,
      };
    }),
    terminal,
    total: stages.length,
  };
}

export type BridgeItem = { label: string; value: number; kind: "base" | "delta" | "total" };

export type OfferBridge = { items: BridgeItem[]; reachedOffer: number; joined: number };

/**
 * Offer-to-joining bridge, decomposed by recorded stage.
 *
 * The base is every application that reached an offer stage, plus the ones
 * recorded as declined. Each subtraction is a real count of applications in a
 * recorded stage, and the arithmetic closes exactly on the converted total —
 * there is no balancing figure.
 */
export function buildOfferBridge(stages: readonly string[]): OfferBridge {
  const count = (stage: string) => stages.filter((value) => value === stage).length;
  const declined = count("declined");
  const awaiting = count("offer_review") + count("offered");
  const acceptedPending = count("accepted");
  const joined = count("converted");
  const reachedOffer = declined + awaiting + acceptedPending + joined;
  if (reachedOffer === 0) return { items: [], reachedOffer, joined };
  const items: BridgeItem[] = [{ label: "Reached offer", value: reachedOffer, kind: "base" }];
  if (declined > 0) items.push({ label: "Declined", value: -declined, kind: "delta" });
  if (awaiting > 0) items.push({ label: "Awaiting decision", value: -awaiting, kind: "delta" });
  if (acceptedPending > 0) items.push({ label: "Accepted, not joined", value: -acceptedPending, kind: "delta" });
  items.push({ label: "Joined", value: joined, kind: "total" });
  return { items, reachedOffer, joined };
}

/** Requisition statuses that mean the requisition is no longer being worked. */
const CLOSED_REQUISITION_STATUSES = new Set(["filled", "closed", "cancelled", "withdrawn", "rejected"]);

export function isOpenRequisition(status: string): boolean {
  return !CLOSED_REQUISITION_STATUSES.has(status.trim().toLowerCase());
}

/** Stage-over-stage conversion, printed beside the funnel. Null where the prior stage is empty. */
export function stageConversions(stages: readonly FunnelStage[]): Array<{ label: string; percent: number | null }> {
  return stages.map((stage, index) => ({
    label: stage.label,
    percent: index === 0 ? null : ratio(stage.value, stages[index - 1]!.value),
  }));
}

/* -------------------------------------------------------------------------- */
/* Feed assembly                                                              */
/* -------------------------------------------------------------------------- */

type UnknownRecord = Record<string, unknown>;

function attributesOf(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

export type StageBreakdownRow = { stage: string; label: string; count: number; terminal: boolean };

export type TalentAcquisitionData = {
  kpis: {
    openRequisitions: number | null;
    openRequisitionsNote: string;
    activeCandidates: number | null;
    activeCandidatesNote: string;
    offersOutstanding: number | null;
    offersOutstandingNote: string;
    timeToHireDays: number | null;
    timeToHireNote: string;
    activePostings: number | null;
  };
  funnel: {
    stages: FunnelStage[];
    conversions: Array<{ label: string; percent: number | null }>;
    terminal: number;
    total: number;
    available: boolean;
    message?: string;
    origin: string;
    note: string;
  };
  bridge: {
    items: BridgeItem[];
    available: boolean;
    message?: string;
    origin: string;
    note: string;
  };
  candidateExperience: {
    available: false;
    message: string;
    detail: string;
  };
  stageBreakdown: { rows: StageBreakdownRow[]; available: boolean; message?: string; origin: string };
  unavailableSources: Array<{ name: string; message: string }>;
};

/**
 * Candidate-experience CSAT has no instrument in this platform.
 *
 * `surveys` / `survey_runs` / `survey_responses` are an employee instrument:
 * `answerSurvey` resolves the respondent from an active membership, and a
 * candidate has no membership until conversion. No candidate survey, NPS or
 * CSAT field exists on `candidates`, `applications` or `offers`, and there is
 * no listing endpoint for survey runs. So the panel says so rather than
 * plotting a score.
 */
const CANDIDATE_CSAT_MESSAGE = "Candidate experience is not surveyed";
const CANDIDATE_CSAT_DETAIL =
  "No candidate-facing survey exists. The survey tables resolve a respondent from an active membership, which a candidate does not have until conversion, and neither the candidate, application nor offer record carries a CSAT, NPS or feedback field. Nothing here can be scored without first capturing candidate responses.";

export async function loadTalentAcquisitionCommand(access: Access): Promise<TalentAcquisitionData> {
  const emptyBoard = {
    columns: [],
    closed: [],
    unmapped: [],
    totals: { active: 0, closed: 0, scored: 0, unscored: 0 },
  } as unknown as Awaited<ReturnType<typeof loadPipelineBoard>>;

  const [applicationsSource, boardSource, requisitionsSource, postingsSource] = await Promise.all([
    source(
      () => listApplications(access, { page: 1, pageSize: 100 }),
      { items: [] as unknown[], total: 0 },
      "applications register",
    ),
    source(() => loadPipelineBoard(access), emptyBoard, "pipeline board (applications joined to candidates)"),
    source(() => loadRequisitionRegister(access), [], "requisitions register"),
    source(async () => (await listPostings(access, null)) as unknown[], [] as unknown[], "job postings"),
  ]);

  const applicationRows = applicationsSource.value.items as UnknownRecord[];
  const stages = applicationRows.map((row) => String(attributesOf(row.attributes).stage ?? "applied"));

  const funnel = buildHiringFunnel(stages);
  const bridge = buildOfferBridge(stages);

  const stageCounts = new Map<string, number>();
  for (const stage of stages) stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + 1);
  const stageBreakdown: StageBreakdownRow[] = [...stageCounts.entries()]
    .map(([stage, count]) => ({
      stage,
      label: STAGE_LABELS[stage] ?? stage,
      count,
      terminal: FLOW.indexOf(stage) === -1,
    }))
    .sort((a, b) => b.count - a.count);

  const requisitions = requisitionsSource.value;
  const openRequisitions = requisitions.filter((row) => isOpenRequisition(row.status)).length;
  const offersOutstanding = stages.filter((stage) => stage === "offer_review" || stage === "offered").length;
  const activeCandidates = boardSource.available
    ? boardSource.value.totals.active
    : stages.filter((stage) => FLOW.indexOf(stage) !== -1 && stage !== "converted").length;

  const applicationsTotal = applicationsSource.value.total;
  const truncated = applicationsTotal > applicationRows.length;

  const funnelFeed = applicationsSource.available
    ? derived(funnel.stages, applicationsSource.origin ?? "applications")
    : unsupported<FunnelStage[]>([], applicationsSource.message ?? "Applications could not be read.");
  const bridgeFeed = applicationsSource.available
    ? derived(bridge.items, applicationsSource.origin ?? "applications")
    : unsupported<BridgeItem[]>([], applicationsSource.message ?? "Applications could not be read.");

  const feeds: Record<string, Source<unknown>> = {
    applications: applicationsSource,
    pipelineBoard: boardSource,
    requisitions: requisitionsSource,
    postings: postingsSource,
  };
  const unavailableSources = Object.entries(feeds)
    .filter(([, feed]) => !feed.available)
    .map(([name, feed]) => ({ name, message: feed.message ?? "This source is unavailable for your role." }));

  const scopeNote = truncated
    ? `Counted from the ${applicationRows.length} most recent of ${applicationsTotal} applications; the register is read one page at a time.`
    : `Counted from all ${applicationRows.length} recorded application(s).`;

  return {
    kpis: {
      openRequisitions: requisitionsSource.available ? openRequisitions : null,
      openRequisitionsNote: requisitionsSource.available
        ? `Requisitions whose recorded status is not filled, closed, cancelled, withdrawn or rejected, out of ${requisitions.length} on the register.`
        : (requisitionsSource.message ?? "The requisition register is unavailable for your role."),
      activeCandidates: applicationsSource.available || boardSource.available ? activeCandidates : null,
      activeCandidatesNote: boardSource.available
        ? "Applications on the pipeline board that are in a live stage, excluding ended applications."
        : `Derived from application stages: ${scopeNote}`,
      offersOutstanding: applicationsSource.available ? offersOutstanding : null,
      offersOutstandingNote: applicationsSource.available
        ? "Applications recorded at offer review or offered — an offer put to the candidate with no decision recorded yet."
        : (applicationsSource.message ?? "Applications are unavailable for your role."),
      timeToHireDays: null,
      timeToHireNote:
        "Time-to-hire is not derivable. The application records an applied date, but no hire or joining date is carried on the application, and offers have no listable feed from which a joining date could be read.",
      activePostings: postingsSource.available ? postingsSource.value.length : null,
    },
    funnel: {
      stages: funnelFeed.value,
      conversions: stageConversions(funnel.stages),
      terminal: funnel.terminal,
      total: funnel.total,
      available: funnelFeed.available,
      message: funnelFeed.message,
      origin: "applications.attributes.stage",
      note: `${scopeNote} Each milestone counts every application at or beyond that stage. ${funnel.terminal} ended application(s) are counted at Applied only, because the row does not record the furthest stage they reached.`,
    },
    bridge: {
      items: bridgeFeed.value,
      available: bridgeFeed.available,
      message: bridgeFeed.message,
      origin: "applications.attributes.stage",
      note: "Offer records carry no decline reason — offers store status, amount, currency and joining date only — so this bridge decomposes by recorded application stage rather than by reason. Applications recorded as declined are included in the offer base; the platform does not record which stage a declined application left from.",
    },
    candidateExperience: {
      available: false,
      message: CANDIDATE_CSAT_MESSAGE,
      detail: CANDIDATE_CSAT_DETAIL,
    },
    stageBreakdown: {
      rows: stageBreakdown,
      available: applicationsSource.available,
      message: applicationsSource.message,
      origin: "applications.attributes.stage",
    },
    unavailableSources,
  };
}
