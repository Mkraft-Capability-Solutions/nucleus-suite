/**
 * The one place the demo seeders translate the client workbook's wording into the
 * vocabulary the application actually reads.
 *
 * The workbook states a stage as "Interview complete" and a course as a title with no
 * code. `src/server/talent/service.ts` reads `attributes->>'stage'` against STAGE_FLOW and
 * every course by `attributes->>'code'`. A seeder that writes the workbook's words leaves
 * rows the endpoints refuse: Advance answers "Stages advance one step at a time by human
 * decision", Enroll is disabled on every course, and a referral is refused because its
 * requisition is not "approved". Translating once, here, keeps the demo reading in the
 * client's language while the records stay operable.
 *
 * Every function below derives its answer from a value already in the row and returns null
 * when it cannot. A caller that gets null must leave the field unset and say so rather
 * than substitute a value nobody chose.
 *
 * `scripts/repair-talent-vocabulary.ts` imports these same maps to repair rows that were
 * already seeded, so the repair and the seed can never drift apart.
 */

/** STAGE_FLOW and TERMINAL_STAGES exactly as src/server/talent/service.ts declares them. */
export const STAGE_FLOW = ["applied", "screening", "shortlisted", "interview", "background", "offer_review", "offered", "accepted", "converted"] as const;
export const TERMINAL_STAGES = ["withdrawn", "rejected", "declined", "closed"] as const;
export const KNOWN_STAGES: ReadonlySet<string> = new Set<string>([...STAGE_FLOW, ...TERMINAL_STAGES]);

/**
 * Workbook stage wording (sheet 59) to the flow's own vocabulary.
 *
 * "Interview scheduled" and "Interview complete" both land on `interview`: the flow has no
 * finer grain, and minting one to preserve the distinction would put a stage in the column
 * that nothing could advance from. Callers keep the original wording alongside it.
 */
const STAGE_TEXT: Record<string, string> = {
  "joined": "converted",
  "hired": "converted",
  "offered": "offered",
  "offer released": "offered",
  "offer extended": "offered",
  "offer_extended": "offered",
  "interview complete": "interview",
  "interview scheduled": "interview",
  "interview_scheduled": "interview",
  "screened": "screening",
  "rejected": "rejected",
  "withdrawn": "withdrawn",
};

/** The stage this text names, or null when the text names none. */
export function stageFromText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (KNOWN_STAGES.has(trimmed)) return trimmed;
  return STAGE_TEXT[trimmed.toLowerCase()] ?? null;
}

export const REQUISITION_STATUSES = ["draft", "submitted", "approved", "rejected", "blocked", "filled", "closed"] as const;

/**
 * Workbook requisition status wording (sheet 37) to the approval vocabulary.
 *
 * An opening the workbook calls "Open — screening" is one that cleared approval and is
 * being worked: `approved` is the state referCandidate requires and the register renders.
 * "Blocked at approval" is a submitted requisition that has not cleared the establishment
 * gate; its reason already lives in the row's own `blocker`.
 */
export function requisitionStatusFromText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if ((REQUISITION_STATUSES as readonly string[]).includes(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("open")) return "approved";
  if (lower.startsWith("closed")) return "filled";
  if (lower.includes("blocked")) return "submitted";
  return null;
}

const ENROLLMENT_STATUS: Record<string, string> = {
  "completed": "completed",
  "in progress": "in_progress",
  "not started": "assigned",
  // "Overdue" is a comparison against the due date, not a state the application stores. The
  // enrollment is still an assigned one, and its own `due_on` already says it has passed.
  "overdue": "assigned",
};

/** Workbook learning status wording (sheet 34) to the status enrollEmployee writes. */
export function enrollmentStatusFromText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (["assigned", "in_progress", "completed"].includes(trimmed)) return trimmed;
  return ENROLLMENT_STATUS[trimmed.toLowerCase()] ?? null;
}

/**
 * A course code derived from the course's own title.
 *
 * The workbook names induction items by title alone, and every part of the product
 * references a course by code. The derivation is deterministic and reversible by eye, so
 * the code reads as the course it belongs to rather than as an identifier nobody can place.
 */
export function courseCodeFromTitle(title: string): string {
  const code = title
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase()
    .slice(0, 40)
    .replace(/-+$/g, "");
  return code || "COURSE";
}

/** True when the text is shaped like a reference rather than a sentence of demo narrative. */
export function looksLikeCode(value: unknown): boolean {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._/-]{0,39}$/.test(value.trim());
}
