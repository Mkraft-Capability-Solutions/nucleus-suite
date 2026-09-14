import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * Announcements register — SCR-066 / FRM-EXP-03.
 *
 * WHERE AN ANNOUNCEMENT ACTUALLY LIVES
 * ------------------------------------
 * There is no `announcements` table. `publishAnnouncement` in
 * `src/server/engagement/service.ts` inserts one `feed_posts` row whose
 * `attributes` jsonb carries the keys named in `PERSISTED_FIELDS`, plus
 * `published_by` and `published_version`. The same table also holds the
 * social feed (`createFeedPost` in `experience.ts`), so the two are separated
 * here by the one key only announcements carry: `attributes->>'audience'`.
 *
 * This module never writes. The single supported write is
 * `POST /api/v1/announcements`, and its zod schema strips every key it does not
 * name — so any field outside `PERSISTED_FIELDS` sent to it is silently
 * discarded. `UNPERSISTED_FIELDS` records what the product still cannot do with
 * a field it now stores, and the screen states it rather than pretending otherwise.
 *
 * Everything above `listAnnouncementRegister` is pure and directly unit-tested.
 */

/* ------------------------------------------------------------------ */
/* Workbook vocabularies                                               */
/* ------------------------------------------------------------------ */

/**
 * PL_ANNOUNCEMENT_TYPE (FRM-EXP-03). The picklist is NOT present anywhere in
 * this repository — no seed, no migration, no constant — so it is carried here
 * from the workbook and must be reconciled against it before release. The
 * stored `kind` enum on `publishAnnouncementSchema` is a DIFFERENT six-value
 * list (birthday, joiner, star, referral, project, management) and does not
 * overlap with this one, which is why `typeStored` is false everywhere.
 */
export const ANNOUNCEMENT_TYPES = [
  { code: "general", label: "General" },
  { code: "policy", label: "Policy" },
  { code: "emergency", label: "Emergency" },
  { code: "celebration", label: "Celebration" },
  { code: "statutory_notice", label: "Statutory notice" },
] as const;

export type AnnouncementTypeCode = (typeof ANNOUNCEMENT_TYPES)[number]["code"];

/** PL_ANNOUNCEMENT_CHANNEL (FRM-EXP-03). Multiple channels are allowed. */
export const ANNOUNCEMENT_CHANNELS = [
  { code: "employee_portal", label: "Employee portal" },
  { code: "mobile_push", label: "Mobile push" },
  { code: "email", label: "Email" },
  { code: "whatsapp", label: "WhatsApp" },
  { code: "notice_board", label: "Notice board display" },
] as const;

export type AnnouncementChannelCode = (typeof ANNOUNCEMENT_CHANNELS)[number]["code"];

/**
 * PL_LANGUAGE (14 values, FRM-EXP-03). Like PL_ANNOUNCEMENT_TYPE this picklist
 * does not exist in the repository; the count is the workbook's and the codes
 * below are this screen's declaration of it, pending reconciliation. It is
 * moot for storage either way: see `UNPERSISTED_FIELDS`.
 */
export const ANNOUNCEMENT_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "bn", label: "Bengali" },
  { code: "mr", label: "Marathi" },
  { code: "te", label: "Telugu" },
  { code: "ta", label: "Tamil" },
  { code: "gu", label: "Gujarati" },
  { code: "ur", label: "Urdu" },
  { code: "kn", label: "Kannada" },
  { code: "or", label: "Odia" },
  { code: "ml", label: "Malayalam" },
  { code: "pa", label: "Punjabi" },
  { code: "as", label: "Assamese" },
  { code: "ne", label: "Nepali" },
] as const;

/* ------------------------------------------------------------------ */
/* What the write path can and cannot keep                             */
/* ------------------------------------------------------------------ */

/** The only keys `publishAnnouncementSchema` accepts, and therefore stores. */
export const PERSISTED_FIELDS = [
  "title",
  "body",
  "audience",
  "attachmentDocumentId",
  "expiresAt",
  "kind",
  "announcementType",
  "channels",
  "publishAt",
  "acknowledgementRequired",
  "languageVariants",
] as const;

export type StorageGap = { field: string; workbook: string; reason: string };

/**
 * Workbook fields with nowhere to go. Each entry is a fact about
 * `publishAnnouncementSchema` and the `feed_posts` row it writes, not an
 * opinion: a zod object strips unknown keys, so posting these is a silent
 * no-op. They are shown on screen so nobody builds a process on a field that
 * is dropped in transit.
 */
export const UNPERSISTED_FIELDS: readonly StorageGap[] = [
  {
    field: "Delivery on the selected channels",
    workbook: "PL_ANNOUNCEMENT_CHANNEL — portal, push, email, WhatsApp, notice board",
    reason:
      "The chosen channels are stored on the announcement, but nothing in this system transmits on any of them. The selection records an intent, and `DELIVERY_POSTURE` states that intent is all it is.",
  },
  {
    field: "Scheduled publishing",
    workbook: "Publish-at datetime (SCR-066 required field)",
    reason:
      "The publish-at instant is stored, but no scheduler reads it: there is no job in this repository that holds a future announcement back and releases it. Every announcement is visible from insert, whatever the stored instant says.",
  },
  {
    field: "The acknowledged version",
    workbook: "A policy announcement retains the version that was acknowledged",
    reason:
      "`published_version` is stamped at publish, and an acknowledgement is a `consent_records` row (see `policy-acknowledgements.ts`), but the two are joined through the policy document rather than through this announcement, so an acknowledgement cannot be tied to this announcement's own version.",
  },
  {
    field: "Attachment contents",
    workbook: "Attachment, PDF or JPG up to 10 MB",
    reason:
      "The attachment is stored as the id of an already-uploaded document. This endpoint accepts no file body of its own, so the document must exist before the announcement references it.",
  },
];

/**
 * Delivery posture. Nothing in `src/` transmits: the only fan-out is
 * `fanOutEvent` in `src/server/notifications/service.ts`, which inserts rows
 * into `notifications` for in-app reading. There is no mail transport, no push
 * sender, no WhatsApp client and no notice-board driver in the dependency tree
 * or the source. The same posture the statutory register takes about filings.
 */
export const DELIVERY_POSTURE = {
  transmits: false,
  summary: "Selecting a channel records an intended channel. It does not send.",
  detail:
    "No component of this system transmits to email, mobile push, WhatsApp or a notice board. The only notification path writes rows into the in-app `notifications` table for a person to read when they next open the workspace. External providers must be configured and validated before any external delivery can be claimed. The selected channel is retained on the announcement, so the intent survives — the delivery does not.",
} as const;

/**
 * Quiet hours. The workbook says an Emergency announcement bypasses the
 * quiet-hours rule. The rule itself is defined nowhere — not in the workbook,
 * not in tenant settings, not in any table or constant in this repository. The
 * bypass is therefore carried as a real property of the announcement, and the
 * window is reported as unconfigured rather than invented. Applying no window
 * while implying one exists would be the worse failure.
 */
export const QUIET_HOURS = {
  configured: false,
  window: null,
  detail:
    "No quiet-hours window is defined in this system. There is no tenant setting, no table and no constant that states one, and the workbook does not supply the hours. Until a window is configured, no announcement is held back by quiet hours — including the ones that would be.",
} as const;

export type QuietHoursDecision = {
  /** True when this type carries the workbook's explicit bypass. */
  bypass: boolean;
  /** Whether a window exists to bypass or to be held by. */
  windowConfigured: boolean;
  /** Whether quiet hours would delay this announcement right now. */
  held: boolean;
  reason: string;
};

/** The bypass is a property of the announcement, recorded whether or not a window exists. */
export function quietHoursDecision(type: AnnouncementTypeCode): QuietHoursDecision {
  const bypass = type === "emergency";
  if (bypass) {
    return {
      bypass: true,
      windowConfigured: QUIET_HOURS.configured,
      held: false,
      reason:
        "Emergency announcements carry the quiet-hours bypass. It is recorded on this announcement and holds whenever a window is configured. No window is configured today, so the bypass changes nothing yet.",
    };
  }
  return {
    bypass: false,
    windowConfigured: QUIET_HOURS.configured,
    held: false,
    reason:
      "This type carries no quiet-hours bypass. It is not being held either: no quiet-hours window is configured in this system, so nothing is deferred. Do not read this as the announcement having passed a quiet-hours check.",
  };
}

/* ------------------------------------------------------------------ */
/* Audience rule                                                       */
/* ------------------------------------------------------------------ */

/**
 * The dimensions an audience rule can name, and whether real data backs them.
 * `employees` carries `department`, `location` and `designation` as text, and
 * `employee_code` identifies an individual. Entity comes from the employee's
 * latest `employments` row. Band and class are listed because the workbook
 * names them and they are NOT available: nothing joins an employee to
 * `compensation_bands` or `grades`, and the only class-like link is
 * `employments.worker_category_id`, which carries no resolvable label here.
 */
export const AUDIENCE_DIMENSIONS = [
  { key: "department", label: "Org unit / department", available: true, note: "Matches `employees.department`." },
  { key: "location", label: "Location", available: true, note: "Matches `employees.location`." },
  { key: "designation", label: "Designation", available: true, note: "Matches `employees.designation`." },
  { key: "entity", label: "Legal entity", available: true, note: "Matches the legal entity on the employee's latest `employments` row." },
  { key: "employee", label: "Individual list", available: true, note: "Matches `employees.employee_code`, comma-separated." },
  { key: "band", label: "Band", available: false, note: "No employee-to-band relationship exists in the schema; `compensation_bands` is not joined to an employee." },
  { key: "class", label: "Class", available: false, note: "`employments.worker_category_id` is the only class-like link and carries no resolvable label, so it cannot be offered as a rule." },
] as const;

export const AVAILABLE_AUDIENCE_KEYS: readonly string[] = AUDIENCE_DIMENSIONS.filter((entry) => entry.available).map((entry) => entry.key);

export const AUDIENCE_RULE_MAX_LENGTH = 120;

export type AudienceClause = { key: string; values: string[] };

export type ParsedAudienceRule =
  | { ok: true; everyone: boolean; clauses: AudienceClause[]; canonical: string }
  | { ok: false; error: string };

/**
 * Parse an audience rule.
 *
 * Grammar: `all`, or one or more `key:value[,value]` clauses joined by `;`.
 * An employee is in the audience when they satisfy EVERY clause; within a
 * clause any one value is enough. The 120-character ceiling is not a style
 * choice — it is `publishAnnouncementSchema`'s `max(120)` on `audience`, and a
 * rule longer than that is rejected by the endpoint, not by this screen.
 */
export function parseAudienceRule(raw: string): ParsedAudienceRule {
  const rule = raw.trim();
  if (rule.length === 0) return { ok: false, error: "An audience rule is required. Use `all`, or clauses such as `department:Engineering`." };
  if (rule.length > AUDIENCE_RULE_MAX_LENGTH) {
    return { ok: false, error: `The audience rule is ${rule.length} characters. The write endpoint stores at most ${AUDIENCE_RULE_MAX_LENGTH} and refuses anything longer.` };
  }
  if (rule.toLowerCase() === "all") return { ok: true, everyone: true, clauses: [], canonical: "all" };

  const clauses: AudienceClause[] = [];
  for (const segment of rule.split(";")) {
    const part = segment.trim();
    if (part.length === 0) continue;
    const separator = part.indexOf(":");
    if (separator < 0) {
      return { ok: false, error: `\`${part}\` is not a clause. Write \`dimension:value\`, for example \`location:Pune\`.` };
    }
    const key = part.slice(0, separator).trim().toLowerCase();
    if (!AVAILABLE_AUDIENCE_KEYS.includes(key)) {
      const unavailable = AUDIENCE_DIMENSIONS.find((entry) => entry.key === key);
      if (unavailable) return { ok: false, error: `\`${key}\` cannot be resolved. ${unavailable.note}` };
      return { ok: false, error: `\`${key}\` is not an audience dimension. Use one of ${AVAILABLE_AUDIENCE_KEYS.join(", ")}.` };
    }
    const values = part
      .slice(separator + 1)
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    if (values.length === 0) return { ok: false, error: `\`${key}\` has no value. Write \`${key}:<value>\`.` };
    clauses.push({ key, values });
  }
  if (clauses.length === 0) return { ok: false, error: "An audience rule is required. Use `all`, or clauses such as `department:Engineering`." };
  return { ok: true, everyone: false, clauses, canonical: clauses.map((clause) => `${clause.key}:${clause.values.join(",")}`).join(";") };
}

/** One employee, reduced to the attributes an audience rule can test. */
export type AudienceCandidate = {
  id: string;
  employeeCode: string;
  name: string;
  department: string | null;
  location: string | null;
  designation: string | null;
  legalEntityId: string | null;
};

function sameText(left: string | null, right: string): boolean {
  return left !== null && left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function matchesAudience(candidate: AudienceCandidate, clauses: readonly AudienceClause[]): boolean {
  return clauses.every((clause) =>
    clause.values.some((value) => {
      if (clause.key === "department") return sameText(candidate.department, value);
      if (clause.key === "location") return sameText(candidate.location, value);
      if (clause.key === "designation") return sameText(candidate.designation, value);
      if (clause.key === "entity") return sameText(candidate.legalEntityId, value);
      if (clause.key === "employee") return sameText(candidate.employeeCode, value);
      return false;
    }),
  );
}

export type AudienceBreakdownRow = { key: string; label: string; count: number };

export type AudienceResolution = {
  rule: string;
  valid: boolean;
  /** Why the rule could not be parsed. Empty when it parsed. */
  error: string;
  everyone: boolean;
  /** Head-count the rule resolves to, against real employee rows. Never an estimate. */
  resolvedCount: number;
  /** Active employees the rule was resolved against. */
  populationCount: number;
  matched: AudienceCandidate[];
  byDepartment: AudienceBreakdownRow[];
  byLocation: AudienceBreakdownRow[];
};

function tally(rows: readonly AudienceCandidate[], pick: (row: AudienceCandidate) => string | null): AudienceBreakdownRow[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = (pick(row) ?? "").trim() || "Unassigned";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

/** Resolve a rule over a real population. Pure: the caller supplies the rows. */
export function resolveAudienceOver(rule: string, population: readonly AudienceCandidate[]): AudienceResolution {
  const parsed = parseAudienceRule(rule);
  if (parsed.ok === false) {
    return { rule, valid: false, error: parsed.error, everyone: false, resolvedCount: 0, populationCount: population.length, matched: [], byDepartment: [], byLocation: [] };
  }
  const matched = parsed.everyone ? [...population] : population.filter((candidate) => matchesAudience(candidate, parsed.clauses));
  return {
    rule: parsed.canonical,
    valid: true,
    error: "",
    everyone: parsed.everyone,
    resolvedCount: matched.length,
    populationCount: population.length,
    matched,
    byDepartment: tally(matched, (row) => row.department),
    byLocation: tally(matched, (row) => row.location),
  };
}

/**
 * The refusal the workbook demands: an announcement addressed to nobody is not
 * published. A rule that does not parse is refused for the same reason — an
 * unresolvable rule is an unknown audience, and publishing to an unknown
 * audience is the failure this guard exists to prevent.
 */
export function audienceRefusal(resolution: AudienceResolution): string {
  if (!resolution.valid) return `The audience rule cannot be resolved, so the audience is unknown. ${resolution.error}`;
  if (resolution.resolvedCount === 0) {
    return resolution.populationCount === 0
      ? "This rule resolves to nobody because there are no active employees to resolve it against. An announcement to nobody is refused."
      : `This rule resolves to 0 of ${resolution.populationCount} active employees. An announcement to nobody is refused.`;
  }
  return "";
}

/* ------------------------------------------------------------------ */
/* Expiry and state                                                    */
/* ------------------------------------------------------------------ */

export const DEFAULT_EXPIRY_DAYS = 30;

const DAY_MS = 86_400_000;

/** "Expires on" defaults to publish + 30 days (FRM-EXP-03). Date-granular, to match the stored `expires_at`. */
export function defaultExpiryDate(publishAtIso: string): string {
  const publishAt = Date.parse(publishAtIso);
  if (!Number.isFinite(publishAt)) return "";
  return new Date(publishAt + DEFAULT_EXPIRY_DAYS * DAY_MS).toISOString().slice(0, 10);
}

/**
 * `expires_at` is stored as a `YYYY-MM-DD` date, and `listAnnouncements` keeps
 * a post visible while `expires_at >= today` — so the expiry date is inclusive
 * and the record lapses at the end of it. This converts the stored date into
 * the instant the state flips, so the derivation below can compare instants.
 */
export function expiryInstantFromDate(expiresOn: string | null): string | null {
  if (!expiresOn || !/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) return null;
  return `${expiresOn}T23:59:59.999Z`;
}

export type AnnouncementState = "draft" | "scheduled" | "published" | "archived";

/** Whether the state came from a stored value or was inferred from the clock. */
export type StateBasis = "stored" | "publish_at" | "expiry";

export type StateDerivation = {
  state: AnnouncementState;
  basis: StateBasis;
  reason: string;
};

/**
 * Derive the four SCR-066 states from a stored state plus time.
 *
 * Precedence, in order:
 *   1. A stored `draft` or `archived` is authoritative — a person put it there.
 *   2. Expiry beats everything else: at or past the expiry instant, archived.
 *   3. Publish-at decides the rest. Strictly in the future is Scheduled; at the
 *      publish instant or past it, Published. The boundary belongs to
 *      Published: at exactly publish-at, the announcement is out.
 *
 * `publishAt` must already be defaulted by the caller (to `created_at` when
 * nothing else exists) — see `PUBLISH_AT_FALLBACK`.
 */
export function deriveAnnouncementState(input: {
  storedState: string | null;
  publishAt: string | null;
  expiresAt: string | null;
  now: string;
}): StateDerivation {
  const now = Date.parse(input.now);
  const stored = (input.storedState ?? "").trim().toLowerCase();

  if (stored === "draft") {
    return { state: "draft", basis: "stored", reason: "A stored state of `draft` holds the announcement back regardless of the clock." };
  }
  if (stored === "archived") {
    return { state: "archived", basis: "stored", reason: "A stored state of `archived` was written by a person and is not re-derived from time." };
  }

  const expiresAt = input.expiresAt === null ? null : Date.parse(input.expiresAt);
  if (expiresAt !== null && Number.isFinite(expiresAt) && Number.isFinite(now) && now >= expiresAt) {
    return { state: "archived", basis: "expiry", reason: "The expiry instant has passed, so the announcement is archived. Nothing was written to archive it — the state is read from the clock." };
  }

  const publishAt = input.publishAt === null ? null : Date.parse(input.publishAt);
  if (publishAt !== null && Number.isFinite(publishAt) && Number.isFinite(now) && publishAt > now) {
    return { state: "scheduled", basis: "publish_at", reason: "Publish-at is in the future, so the announcement is scheduled. Nothing was written to schedule it — the state is read from the clock." };
  }
  return { state: "published", basis: "publish_at", reason: "Publish-at is now or in the past and the expiry has not been reached, so the announcement is published." };
}

/**
 * What the stored row can supply for `publishAt`. Since no publish-at key is
 * written, the row's `created_at` is the only candidate, and it is by
 * definition never in the future — which is why no live record ever derives to
 * Scheduled today.
 */
export const PUBLISH_AT_FALLBACK = {
  source: "feed_posts.created_at",
  note: "No publish-at is stored. `created_at` stands in for it, and `created_at` is never in the future, so Scheduled cannot occur on any existing record.",
} as const;

/* ------------------------------------------------------------------ */
/* Action gates                                                        */
/* ------------------------------------------------------------------ */

export type AnnouncementAction = "create" | "schedule" | "publish" | "archive";

export type ActionGate = {
  action: AnnouncementAction;
  label: string;
  allowed: boolean;
  /** What the action does when it is allowed, or precisely why it is not. */
  reason: string;
};

/**
 * The four SCR-066 actions and the truth about each. Only `create` is backed
 * by a write; the other three are stated as unavailable with the reason, so no
 * button on this screen promises something the server will not do.
 */
export function announcementActionGates(input: {
  /** Null on the compose form: there is no record yet. */
  state: AnnouncementState | null;
  audience: AudienceResolution;
  canWrite: boolean;
}): ActionGate[] {
  const refusal = audienceRefusal(input.audience);
  const composing = input.state === null;

  const createReason = !input.canWrite
    ? "Publishing an announcement needs the employee write permission, which this role does not hold."
    : refusal !== ""
      ? refusal
      : `Writes one announcement addressed to ${input.audience.resolvedCount} employee${input.audience.resolvedCount === 1 ? "" : "s"}, and one audit event. It publishes immediately: there is no draft step and no send.`;

  return [
    {
      action: "create",
      label: "Create announcement",
      allowed: composing && input.canWrite && refusal === "",
      reason: composing ? createReason : "This announcement already exists. Use the compose panel to create another.",
    },
    {
      action: "schedule",
      label: "Schedule",
      allowed: false,
      reason:
        "There is no schedule write. `POST /api/v1/announcements` accepts no publish-at, so a future publish time cannot be stored and nothing would fire at it. Scheduled is derivable but unreachable.",
    },
    {
      action: "publish",
      label: "Publish announcement",
      allowed: composing && input.canWrite && refusal === "",
      reason: composing
        ? createReason
        : input.state === "archived"
          ? "This announcement has passed its expiry date. The write path has no re-publish transition, so it cannot be brought back."
          : "This announcement is already published — creating it published it. The write path has no separate publish transition.",
    },
    {
      action: "archive",
      label: "Archive",
      allowed: false,
      reason: composing
        ? "Nothing to archive yet."
        : "Archiving is not a write. An announcement archives itself when its stored expiry date passes; there is no endpoint that archives one early, and no state column to set.",
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Read model                                                          */
/* ------------------------------------------------------------------ */

export const announcementRegisterQuery = z.object({
  view: z.enum(["register", "audience"]).default("register"),
  /** Only read when `view=audience`: the rule to resolve a live count for. */
  rule: z.string().trim().max(400).optional(),
  state: z.enum(["all", "draft", "scheduled", "published", "archived"]).default("all"),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type AnnouncementRegisterQuery = z.infer<typeof announcementRegisterQuery>;

export type AnnouncementRow = {
  id: string;
  version: number;
  title: string;
  body: string;
  /** The stored `kind` enum — NOT the workbook announcement type. */
  kind: string;
  audienceRule: string;
  audience: AudienceResolution;
  channels: string[];
  channelsRecorded: boolean;
  createdAt: string;
  publishAt: string;
  publishAtSource: string;
  expiresOn: string | null;
  expiryInstant: string | null;
  expiryDefaulted: boolean;
  state: AnnouncementState;
  stateBasis: StateBasis;
  stateReason: string;
  acknowledgementRequired: boolean | null;
  acknowledgedVersion: string | null;
  languages: string[];
  /** Real `post_reactions` / `post_comments` rows. Not reads, not acknowledgements. */
  feedReactionCount: number;
  feedCommentCount: number;
  auditTrail: Array<{ action: string; reason: string | null; createdAt: string }>;
};

/**
 * Counts the workbook asks for that no table can answer. Stated per metric so
 * the detail panel can show the absence in place of a number.
 */
export const UNAVAILABLE_METRICS = [
  {
    metric: "Read count",
    reason:
      "No read receipt is recorded against an announcement. `notifications.attributes.read` is a per-membership flag on a different resource and is never written for a `feed_posts` row, so there is no row to count.",
  },
  {
    metric: "Acknowledgement count",
    reason:
      "No table records an acknowledgement of an announcement. There is no acknowledgements table in the schema manifest and the write path stores no flag, so a count would be fabricated.",
  },
  {
    metric: "Acknowledged version",
    reason:
      "A policy announcement is required to retain the version that was acknowledged. Announcements carry no version history — one `feed_posts` row, edited nowhere — so there is no version to retain.",
  },
] as const;

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function strList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

/** Every active employee, reduced to what an audience rule can test. */
async function audiencePopulation(access: Access): Promise<AudienceCandidate[]> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select e.id, e.employee_code, e.first_name, e.last_name, e.department, e.location, e.designation,
             job.legal_entity_id
      from employees e
        left join lateral (
          select em.legal_entity_id from employments em
          where em.tenant_id = e.tenant_id and em.employee_id = e.id
          order by em.created_at desc limit 1
        ) job on true
      where e.tenant_id = ${access.tenantId} and e.status = 'active'
      order by e.employee_code
      limit 5000
    `,
  ]);
  return (
    rows as Array<{
      id: string;
      employee_code: string | null;
      first_name: string | null;
      last_name: string | null;
      department: string | null;
      location: string | null;
      designation: string | null;
      legal_entity_id: string | null;
    }>
  ).map((row) => ({
    id: row.id,
    employeeCode: row.employee_code ?? "",
    name: `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || (row.employee_code ?? row.id),
    department: row.department,
    location: row.location,
    designation: row.designation,
    legalEntityId: row.legal_entity_id,
  }));
}

export type AudiencePreview = AudienceResolution & {
  /** The refusal that would apply on publish, or "" when the rule is publishable. */
  refusal: string;
  /** Distinct values the rule can actually name, taken from the live population. */
  dimensions: {
    departments: string[];
    locations: string[];
    designations: string[];
    legalEntities: string[];
  };
  /** Capped at 50 so a tenant-wide rule does not ship thousands of names. */
  sample: Array<{ id: string; employeeCode: string; name: string; department: string | null; location: string | null }>;
};

/**
 * Resolve an audience rule against real employee rows and return the count the
 * compose form shows before publishing. Never an estimate: the number is the
 * length of the matched set.
 */
export async function resolveAudiencePreview(access: Access, rule: string): Promise<AudiencePreview> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const population = await audiencePopulation(access);
  const resolution = resolveAudienceOver(rule, population);
  const distinct = (pick: (row: AudienceCandidate) => string | null): string[] =>
    [...new Set(population.map((row) => (pick(row) ?? "").trim()).filter((value) => value.length > 0))].sort();
  return {
    ...resolution,
    matched: [],
    refusal: audienceRefusal(resolution),
    dimensions: {
      departments: distinct((row) => row.department),
      locations: distinct((row) => row.location),
      designations: distinct((row) => row.designation),
      legalEntities: distinct((row) => row.legalEntityId),
    },
    sample: resolution.matched.slice(0, 50).map((row) => ({
      id: row.id,
      employeeCode: row.employeeCode,
      name: row.name,
      department: row.department,
      location: row.location,
    })),
  };
}

export type AnnouncementRegister = {
  items: AnnouncementRow[];
  nextCursor: string | null;
  populationCount: number;
  canWrite: boolean;
};

/**
 * The register.
 *
 * `feed_posts` holds announcements and social-feed posts in the same table.
 * They are separated by `attributes->>'audience'`, which only
 * `publishAnnouncement` writes — `createFeedPost` never does. Unlike
 * `listAnnouncements`, expired rows are NOT filtered out here: an archived
 * announcement is one of the four states this screen must show.
 */
export async function listAnnouncementRegister(access: Access, input: AnnouncementRegisterQuery): Promise<AnnouncementRegister> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const canWrite = access.context.permissions.includes("employee.write");
  const population = await audiencePopulation(access);
  const offset = (input.page - 1) * input.pageSize;

  const [postRows, reactionRows, commentRows, auditRows] = await tenantTx(access, [
    sqlClient`
      select id, attributes, created_at
      from feed_posts
      where tenant_id = ${access.tenantId} and record_status = 'active'
        and attributes->>'audience' is not null
      order by created_at desc, id desc
      limit ${input.pageSize + 1} offset ${offset}
    `,
    sqlClient`
      select feed_post_id, count(*)::int as total from post_reactions
      where tenant_id = ${access.tenantId} and record_status = 'active' group by feed_post_id
    `,
    sqlClient`
      select feed_post_id, count(*)::int as total from post_comments
      where tenant_id = ${access.tenantId} and record_status = 'active' group by feed_post_id
    `,
    sqlClient`
      select entity_id, action, reason, created_at from audit_events
      where tenant_id = ${access.tenantId} and entity_type = 'feed_post'
      order by created_at desc
      limit 500
    `,
  ]);

  const reactions = new Map((reactionRows as Array<{ feed_post_id: string; total: number }>).map((row) => [row.feed_post_id, row.total]));
  const comments = new Map((commentRows as Array<{ feed_post_id: string; total: number }>).map((row) => [row.feed_post_id, row.total]));
  const audit = new Map<string, Array<{ action: string; reason: string | null; createdAt: string }>>();
  for (const row of auditRows as Array<{ entity_id: string; action: string; reason: string | null; created_at: string }>) {
    const list = audit.get(row.entity_id) ?? [];
    list.push({ action: row.action, reason: row.reason, createdAt: String(row.created_at) });
    audit.set(row.entity_id, list);
  }

  const rows = postRows as Array<{ id: string; attributes: Record<string, unknown>; created_at: string }>;
  const now = new Date().toISOString();

  const items = rows.slice(0, input.pageSize).map((row) => {
    const attributes = row.attributes ?? {};
    const createdAt = String(row.created_at);
    // Read forward-compatibly: if a future write path ever stores these keys,
    // the screen shows them. Today none of them are written.
    const storedPublishAt = str(attributes.publish_at) || str(attributes.published_at);
    const publishAt = storedPublishAt || createdAt;
    const storedExpiry = str(attributes.expires_at) || null;
    const expiryInstant = expiryInstantFromDate(storedExpiry);
    const derivation = deriveAnnouncementState({
      storedState: str(attributes.state) || null,
      publishAt,
      expiresAt: expiryInstant,
      now,
    });
    const audienceRule = str(attributes.audience, "all");
    const channels = strList(attributes.channels);
    const ackRaw = attributes.acknowledgement_required;
    return {
      id: row.id,
      version: 1,
      title: str(attributes.title, "Untitled announcement"),
      body: str(attributes.body),
      kind: str(attributes.kind, "management"),
      audienceRule,
      audience: { ...resolveAudienceOver(audienceRule, population), matched: [] },
      channels,
      channelsRecorded: channels.length > 0,
      createdAt,
      publishAt,
      publishAtSource: storedPublishAt ? "stored attribute" : PUBLISH_AT_FALLBACK.source,
      expiresOn: storedExpiry,
      expiryInstant,
      expiryDefaulted: false,
      state: derivation.state,
      stateBasis: derivation.basis,
      stateReason: derivation.reason,
      acknowledgementRequired: typeof ackRaw === "boolean" ? ackRaw : null,
      acknowledgedVersion: str(attributes.acknowledged_version) || null,
      languages: strList(attributes.languages),
      feedReactionCount: reactions.get(row.id) ?? 0,
      feedCommentCount: comments.get(row.id) ?? 0,
      auditTrail: audit.get(row.id) ?? [],
    } satisfies AnnouncementRow;
  });

  const needle = (input.search ?? "").trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (input.state !== "all" && item.state !== input.state) return false;
    if (needle && !`${item.title} ${item.audienceRule} ${item.body}`.toLowerCase().includes(needle)) return false;
    return true;
  });

  return {
    items: filtered,
    nextCursor: rows.length > input.pageSize ? String(input.page + 1) : null,
    populationCount: population.length,
    canWrite,
  };
}

/** A rule that resolves to nobody must never reach the write path. */
export function assertPublishable(resolution: AudienceResolution): void {
  const refusal = audienceRefusal(resolution);
  if (refusal !== "") {
    throw new HttpError({
      status: 422,
      code: "POLICY_VIOLATION",
      message: refusal,
      details: [{ field: "audience", issue: refusal }],
    });
  }
}
