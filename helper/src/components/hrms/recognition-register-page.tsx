"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Award, Megaphone, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiErrorMessage, getJson, invalidateGetRequests } from "@/lib/client-api";
import { picklists } from "@/lib/picklists";
import { PageIntro, SectionHeading, StatusPill, Surface } from "./page-primitives";
import { ReferencePicker } from "./register-primitives";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableStr(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function int(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

/**
 * The stamped certificate. A certificate without its period or its criteria is not a
 * certificate the workbook would accept, so a partial payload reads as none at all
 * rather than rendering a document with a hole where the period should be.
 */
function readCertificate(value: unknown): Certificate | null {
  const raw = asRecord(value);
  const period = asRecord(raw.period);
  const criteria = asRecord(raw.criteria);
  const reference = nullableStr(raw.reference);
  const start = nullableStr(period.start);
  const end = nullableStr(period.end);
  const code = nullableStr(criteria.code);
  if (reference === null || start === null || end === null || code === null) return null;
  return {
    reference,
    issuedOn: str(raw.issuedOn),
    period: { start, end },
    criteria: { code, label: str(criteria.label, code) },
    lines: Array.isArray(raw.lines) ? raw.lines.filter((line): line is string => typeof line === "string") : [],
  };
}

function nullableMinor(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

/** Integer minor units rendered exactly, never through floating point. */
function money(amountMinor: number): string {
  const sign = amountMinor < 0 ? "-" : "";
  const absolute = Math.abs(amountMinor);
  const whole = Math.trunc(absolute / 100).toLocaleString("en-IN");
  return `${sign}${whole}.${String(absolute % 100).padStart(2, "0")}`;
}

function amountToMinor(raw: string): number | null {
  const text = raw.trim();
  if (text === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return NaN;
  const [whole, fraction = ""] = text.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

function dateOnly(value: string | null): string {
  if (value === null || value === "") return "—";
  return value.length >= 10 ? value.slice(0, 10) : value;
}

/** The award's real workflow state, as the register records it. */
function statusTone(state: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (state === "paid") return "success";
  if (state === "published") return "info";
  if (state === "approved") return "warning";
  if (state === "rejected") return "danger";
  return "neutral";
}

function stateLabel(state: string): string {
  if (state === "nominated") return "Nominated";
  if (state === "approved") return "Approved";
  if (state === "published") return "Published";
  if (state === "paid") return "Paid";
  if (state === "rejected") return "Rejected";
  return state || "—";
}

type Programme = {
  id: string;
  code: string | null;
  name: string;
  currency: string;
  awardCeilingMinor: number | null;
  ceilingConfigured: boolean;
  defaultAwardMinor: number | null;
  defaultConfigured: boolean;
  nominationOpensOn: string | null;
  nominationClosesOn: string | null;
  windowConfigured: boolean;
};

type TimelineStage = { id: string; label: string; detail: string; state: string };
type AuditEntry = { action: string; reason: string | null; at: string };
type ActionGate = { action: string; label: string; requiresReason: boolean; allowed: boolean; reason: string };

type AwardRow = {
  id: string;
  state: string;
  createdAt: string;
  nomineeEmployeeId: string | null;
  nomineeName: string | null;
  nomineeCode: string | null;
  nomineeDesignation: string | null;
  nomineeDepartment: string | null;
  nomineeEmploymentStatus: string | null;
  nomineeHasAssignmentRecord: boolean;
  nominatorName: string | null;
  programme: Programme | null;
  programmeName: string;
  citation: string;
  citationLength: number;
  citationMeetsMinimum: boolean;
  awardMinor: number | null;
  currency: string;
  periodStart: string | null;
  periodEnd: string | null;
  awardCategory: string | null;
  awardCategoryLabel: string | null;
  certificate: Certificate | null;
  decision: { outcome: string; at: string | null; reason: string | null } | null;
  announcement: { id: string; title: string; body: string; audience: string; publishedAt: string | null } | null;
  payment: { id: string; amountMinor: number | null; currency: string; reference: string | null; paidOn: string | null } | null;
  legacyKudos: boolean;
  timeline: TimelineStage[];
  audit: AuditEntry[];
  actions: ActionGate[];
};

/** The award certificate, exactly as it was stamped when the award was published. */
type Certificate = {
  reference: string;
  issuedOn: string;
  period: { start: string; end: string };
  criteria: { code: string; label: string };
  lines: string[];
};

type Register = {
  items: AwardRow[];
  programmes: Programme[];
  count: number;
  viewerEmployeeId: string | null;
  canWrite: boolean;
  today: string;
  citationMinimum: number;
  anyCeilingConfigured: boolean;
  payrollPathAvailable: boolean;
  programmeNote: { summary: string; detail: string };
  paymentEffect: { does: string; doesNot: string };
  announcementEffect: { does: string; editorialOverride: string };
};

type Person = { id: string; name: string; code: string; status: string };

function readProgramme(value: unknown): Programme {
  const record = asRecord(value);
  return {
    id: str(record.id),
    code: nullableStr(record.code),
    name: str(record.name, "Recognition programme"),
    currency: str(record.currency, "INR"),
    awardCeilingMinor: nullableMinor(record.awardCeilingMinor),
    ceilingConfigured: record.ceilingConfigured === true,
    defaultAwardMinor: nullableMinor(record.defaultAwardMinor),
    defaultConfigured: record.defaultConfigured === true,
    nominationOpensOn: nullableStr(record.nominationOpensOn),
    nominationClosesOn: nullableStr(record.nominationClosesOn),
    windowConfigured: record.windowConfigured === true,
  };
}

function readRow(value: unknown): AwardRow {
  const record = asRecord(value);
  const decision = asRecord(record.decision);
  const announcement = asRecord(record.announcement);
  const payment = asRecord(record.payment);
  return {
    id: str(record.id),
    state: str(record.state, "nominated"),
    createdAt: str(record.createdAt),
    nomineeEmployeeId: nullableStr(record.nomineeEmployeeId),
    nomineeName: nullableStr(record.nomineeName),
    nomineeCode: nullableStr(record.nomineeCode),
    nomineeDesignation: nullableStr(record.nomineeDesignation),
    nomineeDepartment: nullableStr(record.nomineeDepartment),
    nomineeEmploymentStatus: nullableStr(record.nomineeEmploymentStatus),
    nomineeHasAssignmentRecord: record.nomineeHasAssignmentRecord === true,
    nominatorName: nullableStr(record.nominatorName),
    programme: record.programme === null || record.programme === undefined ? null : readProgramme(record.programme),
    programmeName: str(record.programmeName, "No programme linked"),
    citation: str(record.citation),
    citationLength: int(record.citationLength),
    citationMeetsMinimum: record.citationMeetsMinimum === true,
    awardMinor: nullableMinor(record.awardMinor),
    currency: str(record.currency, "INR"),
    periodStart: nullableStr(record.periodStart),
    periodEnd: nullableStr(record.periodEnd),
    awardCategory: nullableStr(record.awardCategory),
    awardCategoryLabel: nullableStr(record.awardCategoryLabel),
    certificate: readCertificate(record.certificate),
    decision: typeof decision.outcome === "string"
      ? { outcome: str(decision.outcome), at: nullableStr(decision.at), reason: nullableStr(decision.reason) }
      : null,
    announcement: typeof announcement.id === "string"
      ? {
          id: str(announcement.id),
          title: str(announcement.title),
          body: str(announcement.body),
          audience: str(announcement.audience, "all"),
          publishedAt: nullableStr(announcement.publishedAt),
        }
      : null,
    payment: typeof payment.id === "string"
      ? {
          id: str(payment.id),
          amountMinor: nullableMinor(payment.amountMinor),
          currency: str(payment.currency, "INR"),
          reference: nullableStr(payment.reference),
          paidOn: nullableStr(payment.paidOn),
        }
      : null,
    legacyKudos: record.legacyKudos === true,
    timeline: (Array.isArray(record.timeline) ? (record.timeline as unknown[]) : []).map((stage) => {
      const entry = asRecord(stage);
      return { id: str(entry.id), label: str(entry.label), detail: str(entry.detail), state: str(entry.state, "pending") };
    }),
    audit: (Array.isArray(record.audit) ? (record.audit as unknown[]) : []).map((entry) => {
      const row = asRecord(entry);
      return { action: str(row.action), reason: nullableStr(row.reason), at: str(row.at) };
    }),
    actions: (Array.isArray(record.actions) ? (record.actions as unknown[]) : []).map((entry) => {
      const row = asRecord(entry);
      return {
        action: str(row.action),
        label: str(row.label),
        requiresReason: row.requiresReason === true,
        allowed: row.allowed === true,
        reason: str(row.reason),
      };
    }),
  };
}

function readRegister(payload: unknown): Register {
  const data = asRecord(asRecord(payload).data);
  const note = asRecord(data.programmeNote);
  const payment = asRecord(data.paymentEffect);
  const announcement = asRecord(data.announcementEffect);
  return {
    items: (Array.isArray(data.items) ? (data.items as unknown[]) : []).map(readRow),
    programmes: (Array.isArray(data.programmes) ? (data.programmes as unknown[]) : []).map(readProgramme),
    count: int(data.count),
    viewerEmployeeId: nullableStr(data.viewerEmployeeId),
    canWrite: data.canWrite === true,
    today: str(data.today),
    citationMinimum: int(data.citationMinimum) || 50,
    anyCeilingConfigured: data.anyCeilingConfigured === true,
    payrollPathAvailable: data.payrollPathAvailable === true,
    programmeNote: { summary: str(note.summary), detail: str(note.detail) },
    paymentEffect: { does: str(payment.does), doesNot: str(payment.doesNot) },
    announcementEffect: { does: str(announcement.does), editorialOverride: str(announcement.editorialOverride) },
  };
}

async function send(path: string, body: unknown): Promise<UnknownRecord> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(apiErrorMessage(payload, response.status, `Request failed (${response.status}).`));
  return asRecord(asRecord(payload).data);
}

const selectClass = "h-10 w-full min-w-0 max-w-full rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground";
const inputClass = "h-10 w-full min-w-0 max-w-full rounded-xl border border-border bg-card px-3 text-xs text-foreground";
const AWARD_CATEGORIES = picklists.PL_AWARD_CATEGORY.values;
const labelClass = "flex w-full min-w-0 flex-col gap-1.5";
const legendClass = "text-[11px] font-bold uppercase tracking-wider text-muted-foreground";

const REGISTER_PATH = "/api/v1/recognition-register";

/** The reference screen mixes referral rows in here; this register does not. */
const REFERRAL_SEPARATION_NOTE =
  "Referrals are not recognition. A requisition code is not a programme and a referral bounty is not an award, so nothing from the referral process appears in this register — it lives in Talent Acquisition with its own tenure rule and its own award record.";

function ceilingText(programme: Programme | null): string {
  if (!programme) return "No programme linked, so no ceiling applies.";
  if (!programme.ceilingConfigured) return "No award ceiling is configured for this programme, so no limit is enforced.";
  return `Ceiling ${money(programme.awardCeilingMinor ?? 0)} ${programme.currency}.`;
}

function windowText(programme: Programme | null, today: string): string {
  if (!programme) return "No programme linked.";
  if (!programme.windowConfigured) return "No nomination window is configured for this programme, so no period is refused.";
  const opens = programme.nominationOpensOn;
  const closes = programme.nominationClosesOn;
  if (opens !== null && today < opens) return `Nominations open on ${opens}. Today is ${today}.`;
  if (closes !== null && today > closes) return `Nominations closed on ${closes}. Today is ${today}.`;
  return `Nomination window open${opens ? ` from ${opens}` : ""}${closes ? ` to ${closes}` : ""}.`;
}

export function RecognitionRegisterPage() {
  // Deep-link preselect (?record=<awardId>); lazy initializer keeps SSR stable.
  const [selectedId, setSelectedId] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("record") ?? "";
  });
  const [register, setRegister] = useState<Register | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [stateFilter, setStateFilter] = useState("all");
  const [programmeFilter, setProgrammeFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");

  const [nominateOpen, setNominateOpen] = useState(false);
  const [form, setForm] = useState({
    recipientEmployeeId: "",
    programmeId: "",
    awardCategory: AWARD_CATEGORIES[0].value as string,
    citation: "",
    evidenceDocumentId: "",
    awardValue: "",
    nonMonetaryAward: "",
    periodStart: "",
    periodEnd: "",
  });
  const [decisionReason, setDecisionReason] = useState("");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [holdAnnouncement, setHoldAnnouncement] = useState(false);
  const [payment, setPayment] = useState({ reference: "", paidOn: "" });

  const refresh = useCallback(() => {
    invalidateGetRequests();
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    let live = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams();
        if (stateFilter !== "all") query.set("state", stateFilter);
        if (programmeFilter !== "all") query.set("programmeId", programmeFilter);
        if (search.trim() !== "") query.set("search", search.trim());
        query.set("page", "1");
        query.set("pageSize", "100");
        const [registerPayload, peoplePayload] = await Promise.all([
          getJson(`${REGISTER_PATH}?${query.toString()}`),
          getJson("/api/v1/people?search=&page=1&pageSize=100"),
        ]);
        if (!live) return;
        setRegister(readRegister(registerPayload));
        setPeople(
          (Array.isArray(asRecord(peoplePayload).data) ? (asRecord(peoplePayload).data as UnknownRecord[]) : []).map((item) => ({
            id: str(item.id),
            name: `${str(item.firstName)} ${str(item.lastName)}`.trim() || str(item.employeeCode, "Unnamed"),
            code: str(item.employeeCode),
            status: str(item.status, "unknown"),
          })),
        );
      } catch (caught) {
        if (live) {
          setRegister(null);
          setError(caught instanceof Error ? caught.message : "The recognition register could not be loaded.");
        }
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [revision, stateFilter, programmeFilter, search]);

  const rows = useMemo(() => register?.items ?? [], [register]);
  const active = useMemo(() => rows.find((row) => row.id === selectedId) ?? rows[0] ?? null, [rows, selectedId]);
  const programmes = useMemo(() => register?.programmes ?? [], [register]);
  const selectedProgramme = useMemo(
    () => programmes.find((programme) => programme.id === form.programmeId) ?? null,
    [programmes, form.programmeId],
  );

  /** The programme's default award seeds the field only when one is configured. */
  function chooseProgramme(programmeId: string): void {
    const programme = programmes.find((candidate) => candidate.id === programmeId) ?? null;
    setForm((current) => ({
      ...current,
      programmeId,
      awardValue:
        current.awardValue === "" && programme?.defaultConfigured && programme.defaultAwardMinor !== null
          ? money(programme.defaultAwardMinor).replace(/,/g, "")
          : current.awardValue,
    }));
  }

  const citationLength = form.citation.trim().length;
  const citationMinimum = register?.citationMinimum ?? 50;
  const selfNomination = form.recipientEmployeeId !== "" && form.recipientEmployeeId === register?.viewerEmployeeId;
  const nomineeRecord = people.find((person) => person.id === form.recipientEmployeeId) ?? null;
  const nomineeInactive = nomineeRecord !== null && nomineeRecord.status !== "active";
  const awardMinor = amountToMinor(form.awardValue);
  const awardInvalid = Number.isNaN(awardMinor);
  const overCeiling =
    selectedProgramme?.ceilingConfigured === true &&
    awardMinor !== null &&
    !Number.isNaN(awardMinor) &&
    selectedProgramme.awardCeilingMinor !== null &&
    awardMinor > selectedProgramme.awardCeilingMinor;
  const windowClosed =
    selectedProgramme !== null &&
    selectedProgramme.windowConfigured &&
    windowText(selectedProgramme, register?.today ?? "").includes("Today is");

  const nominationBlockedBecause = !register?.canWrite
    ? "Nominating needs employee.write."
    : register.viewerEmployeeId === null
      ? "Link this account to its employee profile before nominating anybody."
      : form.recipientEmployeeId === ""
        ? "Choose the nominee."
        : selfNomination
          ? "Self-nomination is not allowed. Somebody else has to nominate you."
          : nomineeInactive
            ? "The nominee holds no active assignment. Only an actively assigned employee can be nominated."
            : form.programmeId === ""
              ? "Choose the recognition programme."
              : windowClosed
                ? windowText(selectedProgramme, register.today)
                : citationLength < citationMinimum
                  ? `The citation must be at least ${citationMinimum} characters; it is ${citationLength}.`
                  : awardInvalid
                    ? "Enter the award value as a plain number, for example 2500.00."
                    : overCeiling
                      ? `The award exceeds this programme's ceiling of ${money(selectedProgramme?.awardCeilingMinor ?? 0)}.`
                      : form.periodStart === "" || form.periodEnd === ""
                        ? "A recognition award carries a period. Enter the dates it covers (RL-490)."
                        : form.periodEnd < form.periodStart
                          ? "The period ends before it starts."
                          : "";

  async function run(label: string, work: () => Promise<string>): Promise<void> {
    setBusy(label);
    setActionError("");
    setNotice("");
    try {
      setNotice(await work());
      refresh();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "The action could not be completed.");
    } finally {
      setBusy("");
    }
  }

  function nominate(): void {
    void run("nominate", async () => {
      const body: UnknownRecord = {
        action: "nominate",
        recipientEmployeeId: form.recipientEmployeeId,
        programmeId: form.programmeId,
        awardCategory: form.awardCategory,
        citation: form.citation.trim(),
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
      };
      if (awardMinor !== null && !Number.isNaN(awardMinor)) body.awardMinor = awardMinor;
      if (form.evidenceDocumentId.trim()) body.evidenceDocumentId = form.evidenceDocumentId.trim();
      if (form.nonMonetaryAward.trim()) body.nonMonetaryAward = form.nonMonetaryAward.trim();
      const data = await send(REGISTER_PATH, body);
      setNominateOpen(false);
      setSelectedId(str(data.id));
      setForm({ recipientEmployeeId: "", programmeId: "", awardCategory: AWARD_CATEGORIES[0].value, citation: "", evidenceDocumentId: "", awardValue: "", nonMonetaryAward: "", periodStart: "", periodEnd: "" });
      const notes = (Array.isArray(data.notes) ? (data.notes as unknown[]) : []).map((note) => String(note));
      return `Nomination raised. ${notes.join(" ")}`.trim();
    });
  }

  function decide(row: AwardRow, action: string): void {
    void run(action, async () => {
      const body: UnknownRecord = { action, recognitionEventId: row.id };
      if (action === "reject") {
        if (decisionReason.trim().length < 10) throw new Error("State why the committee rejected this nomination.");
        body.reason = decisionReason.trim();
      }
      if (action === "approve") {
        if (decisionReason.trim() !== "") body.note = decisionReason.trim();
        body.publishAnnouncement = !holdAnnouncement;
      }
      if (action === "approve" || action === "publish") {
        if (announcementTitle.trim() !== "") body.announcementTitle = announcementTitle.trim();
        if (announcementBody.trim() !== "") body.announcementBody = announcementBody.trim();
      }
      if (action === "mark_paid") {
        if (payment.reference.trim() === "" || payment.paidOn === "") {
          throw new Error("Enter the payment reference and the date the payment was made.");
        }
        body.paymentReference = payment.reference.trim();
        body.paidOn = payment.paidOn;
      }
      const data = await send(REGISTER_PATH, body);
      setDecisionReason("");
      setAnnouncementTitle("");
      setAnnouncementBody("");
      setPayment({ reference: "", paidOn: "" });
      const notes = (Array.isArray(data.notes) ? (data.notes as unknown[]) : []).map((note) => String(note));
      if (action === "approve") {
        return holdAnnouncement
          ? "Award approved. The announcement was held back for editing, so the award stays Approved."
          : "Award approved and the announcement referencing it published.";
      }
      if (action === "reject") return "Nomination rejected. The reason is stored on the award and in the audit trail.";
      if (action === "publish") return "Announcement published for this award.";
      return `Recorded a payment that was completed outside this system. ${notes.join(" ")}`.trim();
    });
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px]">
      <PageIntro
        eyebrow="EXPERIENCE · SCR-065"
        title="Recognition register"
        description="Every recognition nomination, its citation, the programme it is made under, its award value and where it stands across Nominated, Approved, Published and Paid."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold" onClick={refresh}>
              <RefreshCcw className="mr-1.5 size-4" /> Refresh
            </Button>
            <Button
              className="h-10 rounded-xl px-4 text-xs font-bold"
              onClick={() => setNominateOpen((open) => !open)}
              disabled={register?.canWrite !== true}
            >
              <Award className="mr-1.5 size-4" /> Nominate employee
            </Button>
          </div>
        }
      />

      <Surface className="mb-6">
        <SectionHeading
          title="Process guide · EXP-01"
          description="Nominate → committee decision → announcement → payment record. A nomination needs an actively assigned nominee who is not the nominator, a citation of at least 50 characters that prints on the certificate, a period, and an award value inside the programme's ceiling where one is configured."
        />
        <div className="grid gap-3 text-xs leading-relaxed text-muted-foreground md:grid-cols-3">
          <p>
            <span className="font-bold text-foreground">Ceilings are configuration. </span>
            {register?.programmeNote.detail ??
              "This system seeds no recognition programme master. Where a programme record carries an award ceiling the register enforces it; where it does not, the ceiling is reported as not configured and no limit is applied."}
            {register && !register.anyCeilingConfigured ? (
              <span className="font-bold text-foreground"> No programme in this tenant configures a ceiling today.</span>
            ) : null}
          </p>
          <p>
            <span className="font-bold text-foreground">Marking an award paid moves no money. </span>
            {register?.paymentEffect.doesNot ??
              "No payroll input is raised and no bank instruction is produced. Nothing in this system pays a recognition award, so this records a payment somebody already completed outside it."}
          </p>
          <p>
            <span className="font-bold text-foreground">RL-492. </span>
            {register?.announcementEffect.does ?? "Approving an award publishes an announcement that references it."}{" "}
            {register?.announcementEffect.editorialOverride ?? ""}
          </p>
        </div>
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-border/70 bg-secondary/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
          {REFERRAL_SEPARATION_NOTE}
        </p>
      </Surface>

      {notice ? <p role="status" className="mb-4 rounded-xl border border-success/30 bg-success/5 px-3 py-2 text-xs text-foreground">{notice}</p> : null}
      {actionError ? <p role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{actionError}</p> : null}

      {nominateOpen ? (
        <Surface className="mb-6">
          <SectionHeading
            title="Nominate an employee"
            description="FRM-EXP-02. Every rule below is enforced again on the server, so nothing here is advisory."
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className={labelClass}>
              <span className={legendClass}>Nominee</span>
              <select
                className={selectClass}
                value={form.recipientEmployeeId}
                onChange={(event) => setForm((current) => ({ ...current, recipientEmployeeId: event.target.value }))}
              >
                <option value="">Choose an employee</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.code ? `${person.code} · ` : ""}{person.name}{person.status === "active" ? "" : ` (${person.status})`}
                  </option>
                ))}
              </select>
              {selfNomination ? (
                <span className="text-[11px] text-destructive">Self-nomination is not allowed. Somebody else has to nominate you.</span>
              ) : nomineeInactive ? (
                <span className="text-[11px] text-destructive">This employee holds no active assignment.</span>
              ) : null}
            </label>

            <label className={labelClass}>
              <span className={legendClass}>Programme</span>
              <select
                className={selectClass}
                value={form.programmeId}
                onChange={(event) => chooseProgramme(event.target.value)}
              >
                <option value="">Choose a programme</option>
                {programmes.map((programme) => (
                  <option key={programme.id} value={programme.id}>
                    {programme.name}{programme.code ? ` (${programme.code})` : ""}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-muted-foreground">{ceilingText(selectedProgramme)}</span>
              <span className="text-[11px] text-muted-foreground">{windowText(selectedProgramme, register?.today ?? "")}</span>
            </label>

            <label className={labelClass}>
              <span className={legendClass}>Category</span>
              <select
                aria-label="Award category"
                className={inputClass}
                value={form.awardCategory}
                onChange={(event) => setForm((current) => ({ ...current, awardCategory: event.target.value }))}
              >
                {AWARD_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>{category.label}</option>
                ))}
              </select>
              <span className="text-[11px] text-muted-foreground">Prints alongside the citation on the certificate.</span>
            </label>

            <label className={labelClass}>
              <span className={legendClass}>Award value ({selectedProgramme?.currency ?? "INR"})</span>
              <input
                className={inputClass}
                inputMode="decimal"
                placeholder="Optional — leave blank for a non-monetary award"
                value={form.awardValue}
                onChange={(event) => setForm((current) => ({ ...current, awardValue: event.target.value }))}
              />
              <span className={overCeiling || awardInvalid ? "text-[11px] text-destructive" : "text-[11px] text-muted-foreground"}>
                {awardInvalid
                  ? "Enter a plain number, for example 2500.00."
                  : overCeiling
                    ? `Above the configured ceiling of ${money(selectedProgramme?.awardCeilingMinor ?? 0)}.`
                    : selectedProgramme?.defaultConfigured
                      ? `Defaulted from the programme (${money(selectedProgramme.defaultAwardMinor ?? 0)}).`
                      : "RL-490 makes the monetary component optional; the programme configures no default."}
              </span>
            </label>

            <label className={labelClass}>
              <span className={legendClass}>Period start</span>
              <input
                type="date"
                className={inputClass}
                value={form.periodStart}
                onChange={(event) => setForm((current) => ({ ...current, periodStart: event.target.value }))}
              />
            </label>

            <label className={labelClass}>
              <span className={legendClass}>Period end</span>
              <input
                type="date"
                className={inputClass}
                value={form.periodEnd}
                onChange={(event) => setForm((current) => ({ ...current, periodEnd: event.target.value }))}
              />
            </label>

            <label className={labelClass}>
              <span className={legendClass}>Non-monetary award (optional)</span>
              <input
                aria-label="Non-monetary award"
                className={inputClass}
                placeholder="Trophy, certificate, day off"
                value={form.nonMonetaryAward}
                onChange={(event) => setForm((current) => ({ ...current, nonMonetaryAward: event.target.value }))}
              />
            </label>

            <label className={labelClass}>
              <span className={legendClass}>Evidence document id (optional)</span>
              <ReferencePicker
                endpoint="/api/v1/documents"
                ariaLabel="Evidence document"
                className={inputClass}
                placeholder="Search an uploaded document…"
                value={form.evidenceDocumentId}
                onChange={(value) => setForm((current) => ({ ...current, evidenceDocumentId: value }))}
              />
            </label>

            <label className={`${labelClass} md:col-span-2 xl:col-span-3`}>
              <span className={legendClass}>Citation — prints on the certificate</span>
              <textarea
                className="min-h-24 rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground"
                value={form.citation}
                onChange={(event) => setForm((current) => ({ ...current, citation: event.target.value }))}
                placeholder="Describe what this person did, in words fit to print on a certificate."
              />
              <span className={citationLength < citationMinimum ? "text-[11px] text-destructive" : "text-[11px] text-muted-foreground"}>
                {citationLength} of a required {citationMinimum} characters.
              </span>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              className="h-10 sm:h-9 rounded-lg text-xs"
              disabled={busy !== "" || nominationBlockedBecause !== ""}
              onClick={nominate}
            >
              {busy === "nominate" ? "Raising…" : "Raise nomination"}
            </Button>
            <Button variant="outline" size="sm" className="h-10 sm:h-9 rounded-lg text-xs" onClick={() => setNominateOpen(false)}>
              Cancel
            </Button>
            {nominationBlockedBecause ? <span className="text-[11px] text-muted-foreground">{nominationBlockedBecause}</span> : null}
          </div>
        </Surface>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <label className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
          <span className="text-xs font-bold text-muted-foreground">State</span>
          <select aria-label="Award state filter" className={selectClass} value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
            <option value="all">All states</option>
            <option value="nominated">Nominated</option>
            <option value="approved">Approved</option>
            <option value="published">Published</option>
            <option value="paid">Paid</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
        <label className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
          <span className="text-xs font-bold text-muted-foreground">Programme</span>
          <select aria-label="Programme filter" className={selectClass} value={programmeFilter} onChange={(event) => setProgrammeFilter(event.target.value)}>
            <option value="all">All programmes</option>
            {programmes.map((programme) => (
              <option key={programme.id} value={programme.id}>{programme.name}</option>
            ))}
          </select>
        </label>
        <input
          aria-label="Search the recognition register"
          className={inputClass}
          placeholder="Nominee or programme"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <Surface>
          <SectionHeading
            title="Recognition awards"
            description={loading ? "Loading…" : `${rows.length} award${rows.length === 1 ? "" : "s"} in the current scope`}
          />
          {loading ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-xs leading-relaxed text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" className="h-10 sm:h-8 rounded-lg text-xs" onClick={refresh}>
                <RefreshCcw className="mr-1.5 size-3.5" /> Retry
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">
              {stateFilter === "all" && programmeFilter === "all" && search.trim() === ""
                ? "No recognition award has been nominated yet. Raise the first nomination against a programme."
                : "No award matches these filters."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-bold">Nominee</th>
                    <th className="px-3 py-2 font-bold">Programme</th>
                    <th className="px-3 py-2 text-right font-bold">Award</th>
                    <th className="px-3 py-2 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const selected = row.id === active?.id;
                    return (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedId(row.id)}
                        aria-selected={selected}
                        className={`cursor-pointer border-t border-border/60 transition-colors ${selected ? "bg-secondary" : "hover:bg-secondary/60"}`}
                      >
                        <td className="px-3 py-3 text-xs font-semibold text-foreground">
                          {row.nomineeName ?? "Unnamed employee"}
                          {row.nomineeCode ? <span className="ml-1 font-normal text-muted-foreground">({row.nomineeCode})</span> : null}
                          {row.nomineeDepartment ? <span className="block font-normal text-muted-foreground">{row.nomineeDepartment}</span> : null}
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">
                          {row.programmeName}
                          {row.legacyKudos ? <span className="block text-[11px] text-warning">Kudos post — no citation or period</span> : null}
                        </td>
                        <td className="px-3 py-3 text-right text-xs tabular-nums text-foreground">
                          {row.awardMinor === null ? <span className="text-muted-foreground">No money</span> : `${money(row.awardMinor)} ${row.currency}`}
                        </td>
                        <td className="px-3 py-3">
                          <StatusPill tone={statusTone(row.state)}>{stateLabel(row.state)}</StatusPill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Surface>

        <Surface>
          <SectionHeading
            title="Award detail"
            description={active ? `${active.nomineeName ?? "Unnamed employee"} · ${active.programmeName}` : "Select an award to inspect it"}
            action={active ? <StatusPill tone={statusTone(active.state)}>{stateLabel(active.state)}</StatusPill> : undefined}
          />
          {!active ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">No award selected.</p>
          ) : (
            <div className="space-y-5">
              <div>
                <h3 className={legendClass}>Citation</h3>
                <p className="mt-2 whitespace-pre-line rounded-xl border border-border/70 bg-secondary/30 px-3 py-2 text-xs leading-relaxed text-foreground">
                  {active.citation || "No citation was recorded."}
                </p>
                <p className={active.citationMeetsMinimum ? "mt-1 text-[11px] text-muted-foreground" : "mt-1 text-[11px] text-destructive"}>
                  {active.citationLength} characters
                  {active.citationMeetsMinimum ? " — fit to print on the certificate." : ` — below the ${citationMinimum}-character minimum, so this award cannot be approved.`}
                </p>
              </div>

              <dl className="space-y-2 text-xs">
                {[
                  ["Nominee", `${active.nomineeName ?? "Unnamed"}${active.nomineeDesignation ? ` · ${active.nomineeDesignation}` : ""}`],
                  ["Employment status", active.nomineeEmploymentStatus ?? "Unknown"],
                  ["Assignment record", active.nomineeHasAssignmentRecord ? "Present" : "None held"],
                  ["Nominated by", active.nominatorName ?? "Unknown"],
                  ["Programme", active.programmeName],
                  ["Programme ceiling", ceilingText(active.programme)],
                  ["Award value", active.awardMinor === null ? "No monetary component" : `${money(active.awardMinor)} ${active.currency}`],
                  ["Period", `${dateOnly(active.periodStart)} → ${dateOnly(active.periodEnd)}`],
                  ["Nomination criteria", active.awardCategoryLabel ?? "Not recorded"],
                  ["Raised", dateOnly(active.createdAt)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3 border-b border-border/50 pb-1.5">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right font-semibold text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>

              <div>
                <h3 className={legendClass}>Committee decision</h3>
                {active.decision === null ? (
                  <p className="mt-2 text-xs text-muted-foreground">No decision has been recorded.</p>
                ) : (
                  <p className="mt-2 text-xs leading-relaxed text-foreground">
                    <span className="font-bold">{active.decision.outcome === "approved" ? "Approved" : "Rejected"}</span>
                    {active.decision.at ? ` on ${dateOnly(active.decision.at)}` : ""}.
                    {active.decision.reason ? <span className="block text-muted-foreground">{active.decision.reason}</span> : null}
                  </p>
                )}
              </div>

              <div>
                <h3 className={legendClass}>Announcement (RL-492)</h3>
                {active.announcement === null ? (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    No announcement references this award. The state never reads Published without a real feed post behind it.
                  </p>
                ) : (
                  <div className="mt-2 rounded-xl border border-info/25 bg-info/5 px-3 py-2">
                    <p className="flex items-center gap-2 text-xs font-bold text-foreground">
                      <Megaphone className="size-3.5 text-info" /> {active.announcement.title}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">{active.announcement.body}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Audience {active.announcement.audience}
                      {active.announcement.publishedAt ? ` · published ${dateOnly(active.announcement.publishedAt)}` : ""}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <h3 className={legendClass}>Certificate</h3>
                {active.certificate === null ? (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    No certificate has been produced. One is stamped when the award is published, and only where the award
                    records both the period and the nomination criteria the certificate has to carry.
                  </p>
                ) : (
                  <div className="mt-2 rounded-xl border border-border bg-muted/30 px-3 py-2">
                    <p className="text-xs font-bold text-foreground">{active.certificate.reference}</p>
                    <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                      {active.certificate.lines.join("\n")}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Award period {active.certificate.period.start} to {active.certificate.period.end} · criteria{" "}
                      {active.certificate.criteria.label} · issued {dateOnly(active.certificate.issuedOn)}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <h3 className={legendClass}>Payment</h3>
                {active.payment === null ? (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    No reward transaction is recorded against this award.
                    {register?.payrollPathAvailable === false
                      ? " Nothing in this system pays a recognition award: marking one paid records a payment completed elsewhere and raises no payroll input."
                      : ""}
                  </p>
                ) : (
                  <p className="mt-2 text-xs leading-relaxed text-foreground">
                    {active.payment.amountMinor === null ? "Amount not stated" : `${money(active.payment.amountMinor)} ${active.payment.currency}`}
                    {active.payment.reference ? ` · reference ${active.payment.reference}` : ""}
                    {active.payment.paidOn ? ` · paid on ${active.payment.paidOn}` : ""}
                    <span className="block text-muted-foreground">
                      This reward transaction records a payment completed outside this system. No money moved from this screen.
                    </span>
                  </p>
                )}
              </div>

              <div>
                <h3 className={legendClass}>State timeline</h3>
                <ol className="mt-2 space-y-1.5">
                  {active.timeline.map((stage) => (
                    <li key={stage.id} className="flex items-start gap-2 text-xs">
                      <span
                        className={`mt-1 size-2 shrink-0 rounded-full ${
                          stage.state === "done"
                            ? "bg-success"
                            : stage.state === "current"
                              ? "bg-primary"
                              : stage.state === "halted"
                                ? "bg-destructive"
                                : "bg-border"
                        }`}
                      />
                      <span>
                        <span className="font-semibold text-foreground">{stage.label}</span>
                        <span className="block leading-relaxed text-muted-foreground">{stage.detail}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                <h3 className={legendClass}>Audit trail</h3>
                {active.audit.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">No audit rows are recorded against this award.</p>
                ) : (
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead>
                        <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          <th className="px-3 py-2 font-bold">Action</th>
                          <th className="px-3 py-2 font-bold">Reason</th>
                          <th className="px-3 py-2 font-bold">When</th>
                        </tr>
                      </thead>
                      <tbody>
                        {active.audit.map((entry, index) => (
                          <tr key={`${entry.action}-${entry.at}-${index}`} className="border-t border-border/60 align-top">
                            <td className="px-3 py-2 text-xs font-semibold text-foreground">{entry.action.replace(/^engage\./, "").replace(/_/g, " ")}</td>
                            <td className="px-3 py-2 text-xs leading-relaxed text-muted-foreground">{entry.reason ?? "—"}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{dateOnly(entry.at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h3 className={legendClass}>Actions</h3>
                {active.actions.some((gate) => gate.allowed && (gate.action === "approve" || gate.action === "reject")) ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      className="min-h-16 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground"
                      placeholder="Decision reason — mandatory to reject, optional to approve"
                      value={decisionReason}
                      onChange={(event) => setDecisionReason(event.target.value)}
                    />
                    <input
                      className={"h-10 w-full min-w-0 max-w-full rounded-xl border border-border bg-card px-3 text-xs text-foreground"}
                      placeholder="Announcement headline — leave blank to use the generated one"
                      value={announcementTitle}
                      onChange={(event) => setAnnouncementTitle(event.target.value)}
                    />
                    <textarea
                      className="min-h-16 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground"
                      placeholder="Announcement body — leave blank to use the citation"
                      value={announcementBody}
                      onChange={(event) => setAnnouncementBody(event.target.value)}
                    />
                    <label className="flex w-full min-w-0 items-center gap-2 text-xs text-muted-foreground sm:w-auto">
                      <input type="checkbox" checked={holdAnnouncement} onChange={(event) => setHoldAnnouncement(event.target.checked)} />
                      Hold the announcement back (editorial override). The award stays Approved until it is published.
                    </label>
                  </div>
                ) : null}

                {active.actions.some((gate) => gate.allowed && gate.action === "mark_paid") ? (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <input
                      className={inputClass}
                      placeholder="Payment reference"
                      value={payment.reference}
                      onChange={(event) => setPayment((current) => ({ ...current, reference: event.target.value }))}
                    />
                    <input
                      type="date"
                      className={inputClass}
                      value={payment.paidOn}
                      onChange={(event) => setPayment((current) => ({ ...current, paidOn: event.target.value }))}
                    />
                  </div>
                ) : null}

                <div className="mt-3 space-y-2">
                  {active.actions.map((gate) => (
                    <div key={gate.action} className="flex items-start gap-3">
                      <Button
                        size="sm"
                        variant={gate.action === "reject" ? "outline" : "default"}
                        className="h-10 sm:h-8 shrink-0 rounded-lg text-xs"
                        disabled={!gate.allowed || busy !== ""}
                        onClick={() => decide(active, gate.action)}
                      >
                        {busy === gate.action ? "Working…" : gate.label}
                      </Button>
                      <span className={gate.allowed ? "text-[11px] leading-relaxed text-muted-foreground" : "text-[11px] leading-relaxed text-warning"}>
                        {gate.reason}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Surface>
      </div>
    </div>
  );
}
