"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, Plus, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiErrorMessage, getJson, invalidateGetRequests } from "@/lib/client-api";
import { picklistLabel, picklists } from "@/lib/picklists";
import { PageIntro, SectionHeading, StatusPill, Surface } from "./page-primitives";

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

function nullableInt(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function timeLabel(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

/** The five SCR-090 states. Blocked is the one the screen exists to surface. */
function statusTone(state: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (state === "filled") return "success";
  if (state === "approved") return "info";
  if (state === "blocked") return "danger";
  if (state === "submitted") return "warning";
  return "neutral";
}

function timelineTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "done") return "success";
  if (status === "current") return "info";
  if (status === "blocked") return "danger";
  if (status === "cleared") return "neutral";
  return "neutral";
}

type Headroom = {
  kind: string;
  label: string;
  detail: string;
  counts: { sanctioned: number; filled: number; open: number } | null;
  headroom: number | null;
  utilisationPercent: number | null;
  state: string | null;
};

type Gate = {
  allowed: boolean;
  code: string | null;
  message: string | null;
  checked: boolean;
  uncheckedReason: string | null;
  warnings: string[];
  overridable: boolean;
};

type TimelineStep = { state: string; label: string; status: string; at: string | null; note: string };

type AuditEntry = { action: string; label: string; reason: string | null; actor: string | null; at: string | null };

type Conversion = { employeeId: string; employeeCode: string | null; name: string | null; joiningDate: string | null; linkedAt: string | null };

type RegisterRow = {
  id: string;
  code: string;
  title: string | null;
  position: string;
  positionCode: string | null;
  designation: string | null;
  departmentId: string;
  department: string | null;
  hiringManager: string | null;
  requisitionType: string;
  requisitionTypeLabel: string;
  positions: number;
  againstPositionCode: string | null;
  replacingEmployee: string | null;
  terms: {
    locationCode: string | null;
    workerClass: string | null;
    employmentType: string | null;
    requiredBy: string | null;
    ctcMinMinor: number | null;
    ctcMaxMinor: number | null;
    qualificationRequired: string | null;
    experienceMinYears: number | null;
    experienceMaxYears: number | null;
    skills: string[];
    justification: string | null;
  };
  headroom: Headroom;
  displayState: string;
  displayStateLabel: string;
  displayStateReason: string;
  storedStatus: string;
  gate: Gate;
  overridable: boolean;
  approvalSnapshot: {
    headroomAfter: number | null;
    override: boolean;
    overrideReason: string | null;
    establishmentChecked: boolean;
    establishmentNote: string | null;
    recruiterEmployeeId: string | null;
    approvedAt: string | null;
  };
  conversions: Conversion[];
  timeline: TimelineStep[];
  auditTrail: AuditEntry[];
  createdAt: string | null;
};

type Screen = {
  planYear: number;
  controlConfigured: boolean;
  controlNote: string | null;
  overrideReasonMinLength: number;
  overrideRequiredPermission: string;
  overriderAuthorised: boolean;
  notes: string[];
  counts: Record<string, number>;
  departments: Array<{ id: string; name: string }>;
  rows: RegisterRow[];
};

type Preview = { controlConfigured: boolean; headroom: Headroom; gate: Gate; overriderAuthorised: boolean; overrideReasonMinLength: number };

type ManagerRow = { id: string; label: string; department: string; designation: string };

function readHeadroom(value: unknown): Headroom {
  const record = asRecord(value);
  const counts = record.counts === null || record.counts === undefined ? null : asRecord(record.counts);
  return {
    kind: str(record.kind, "not_configured"),
    label: str(record.label, "Unknown"),
    detail: str(record.detail, ""),
    counts: counts ? { sanctioned: int(counts.sanctioned), filled: int(counts.filled), open: int(counts.open) } : null,
    headroom: nullableInt(record.headroom),
    utilisationPercent: nullableInt(record.utilisationPercent),
    state: nullableStr(record.state),
  };
}

function readGate(value: unknown): Gate {
  const record = asRecord(value);
  return {
    allowed: record.allowed === true,
    code: nullableStr(record.code),
    message: nullableStr(record.message),
    checked: record.checked === true,
    uncheckedReason: nullableStr(record.uncheckedReason),
    warnings: Array.isArray(record.warnings) ? (record.warnings as unknown[]).map((entry) => String(entry)) : [],
    overridable: record.overridable === true,
  };
}

function readRow(value: unknown): RegisterRow {
  const record = asRecord(value);
  const snapshot = asRecord(record.approvalSnapshot);
  return {
    id: str(record.id),
    code: str(record.code, "—"),
    title: nullableStr(record.title),
    position: str(record.position, "—"),
    positionCode: nullableStr(record.positionCode),
    designation: nullableStr(record.designation),
    departmentId: str(record.departmentId),
    department: nullableStr(record.department),
    hiringManager: nullableStr(record.hiringManager),
    requisitionType: str(record.requisitionType, "addition"),
    requisitionTypeLabel: str(record.requisitionTypeLabel, "Addition"),
    positions: int(record.positions),
    againstPositionCode: nullableStr(record.againstPositionCode),
    replacingEmployee: nullableStr(record.replacingEmployee),
    terms: readTerms(record.terms),
    headroom: readHeadroom(record.headroom),
    displayState: str(record.displayState, "draft"),
    displayStateLabel: str(record.displayStateLabel, "Draft"),
    displayStateReason: str(record.displayStateReason, ""),
    storedStatus: str(record.storedStatus, "draft"),
    gate: readGate(record.gate),
    overridable: record.overridable === true,
    approvalSnapshot: {
      headroomAfter: nullableInt(snapshot.headroomAfter),
      override: snapshot.override === true,
      overrideReason: nullableStr(snapshot.overrideReason),
      establishmentChecked: snapshot.establishmentChecked === true,
      establishmentNote: nullableStr(snapshot.establishmentNote),
      recruiterEmployeeId: nullableStr(snapshot.recruiterEmployeeId),
      approvedAt: nullableStr(snapshot.approvedAt),
    },
    conversions: (Array.isArray(record.conversions) ? (record.conversions as UnknownRecord[]) : []).map((entry) => ({
      employeeId: str(entry.employeeId),
      employeeCode: nullableStr(entry.employeeCode),
      name: nullableStr(entry.name),
      joiningDate: nullableStr(entry.joiningDate),
      linkedAt: nullableStr(entry.linkedAt),
    })),
    timeline: (Array.isArray(record.timeline) ? (record.timeline as UnknownRecord[]) : []).map((entry) => ({
      state: str(entry.state),
      label: str(entry.label),
      status: str(entry.status, "todo"),
      at: nullableStr(entry.at),
      note: str(entry.note),
    })),
    auditTrail: (Array.isArray(record.auditTrail) ? (record.auditTrail as UnknownRecord[]) : []).map((entry) => ({
      action: str(entry.action),
      label: str(entry.label, str(entry.action)),
      reason: nullableStr(entry.reason),
      actor: nullableStr(entry.actor),
      at: nullableStr(entry.at),
    })),
    createdAt: nullableStr(record.createdAt),
  };
}

const STATE_ORDER = ["draft", "blocked", "submitted", "approved", "filled"] as const;

const selectClass = "h-10 w-full min-w-0 max-w-full rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground";
/** The TAL-01 terms as the register reports them, with anything missing left null. */
function readTerms(value: unknown): RegisterRow["terms"] {
  const terms = asRecord(value);
  return {
    locationCode: nullableStr(terms.locationCode),
    workerClass: nullableStr(terms.workerClass),
    employmentType: nullableStr(terms.employmentType),
    requiredBy: nullableStr(terms.requiredBy),
    ctcMinMinor: nullableInt(terms.ctcMinMinor),
    ctcMaxMinor: nullableInt(terms.ctcMaxMinor),
    qualificationRequired: nullableStr(terms.qualificationRequired),
    experienceMinYears: typeof terms.experienceMinYears === "number" ? terms.experienceMinYears : null,
    experienceMaxYears: typeof terms.experienceMaxYears === "number" ? terms.experienceMaxYears : null,
    skills: Array.isArray(terms.skills) ? terms.skills.filter((skill): skill is string => typeof skill === "string") : [],
    justification: nullableStr(terms.justification),
  };
}

/** A money range in minor units, or the reason there is nothing to print. */
function rangeLabel(minMinor: number | null, maxMinor: number | null): string {
  if (minMinor === null || maxMinor === null) return "Not captured";
  const format = (minor: number) => (minor / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  return `${format(minMinor)} – ${format(maxMinor)}`;
}

function experienceLabel(min: number | null, max: number | null): string {
  if (min === null || max === null) return "Not captured";
  return `${min} – ${max} years`;
}

const WORKER_CLASSES = picklists.PL_WORKER_CLASS.values;
const EMPLOYMENT_TYPES = picklists.PL_EMPLOYMENT_TYPE.values;
const inputClass = "h-10 w-full min-w-0 max-w-full rounded-xl border border-border bg-card px-3 text-xs text-foreground";

export function RequisitionsPage() {
  // Deep-link preselect (?record=<requisitionId>); lazy initializer keeps SSR output stable.
  const [selectedId, setSelectedId] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("record") ?? "";
  });
  const [screen, setScreen] = useState<Screen | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [stateFilter, setStateFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Raise form
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [requisitionType, setRequisitionType] = useState("addition");
  const [departmentId, setDepartmentId] = useState("");
  const [designation, setDesignation] = useState("");
  const [positionCode, setPositionCode] = useState("");
  const [positions, setPositions] = useState("1");
  const [againstPositionCode, setAgainstPositionCode] = useState("");
  const [hiringManagerId, setHiringManagerId] = useState("");
  const [locationCode, setLocationCode] = useState("");
  const [workerClass, setWorkerClass] = useState<string>(WORKER_CLASSES[0].value);
  const [employmentType, setEmploymentType] = useState<string>("permanent");
  const [requiredBy, setRequiredBy] = useState("");
  const [ctcMin, setCtcMin] = useState("");
  const [ctcMax, setCtcMax] = useState("");
  const [justification, setJustification] = useState("");
  const [qualificationRequired, setQualificationRequired] = useState("");
  const [experienceMin, setExperienceMin] = useState("");
  const [experienceMax, setExperienceMax] = useState("");
  const [skills, setSkills] = useState("");
  const [recruiterId, setRecruiterId] = useState("");
  const [managers, setManagers] = useState<ManagerRow[]>([]);
  // Keyed by the query it answers, so a stale verdict is never shown against a
  // form the user has since edited.
  const [previewState, setPreviewState] = useState<{ key: string; value: Preview | null; error: string }>({ key: "", value: null, error: "" });
  const [raiseBusy, setRaiseBusy] = useState(false);
  const [raiseError, setRaiseError] = useState("");
  const [raiseOk, setRaiseOk] = useState("");

  // Approve. Keyed by requisition id so selecting another row drops the override
  // draft without an effect that resets state on every selection change.
  const [approveState, setApproveState] = useState<{ id: string; overrideOn: boolean; reason: string; error: string; ok: string }>(
    { id: "", overrideOn: false, reason: "", error: "", ok: "" },
  );
  const [approveBusy, setApproveBusy] = useState(false);

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
        const payload = await getJson("/api/v1/requisition-register");
        const data = asRecord(asRecord(payload).data);
        const next: Screen = {
          planYear: int(data.planYear),
          controlConfigured: data.controlConfigured === true,
          controlNote: nullableStr(data.controlNote),
          overrideReasonMinLength: int(data.overrideReasonMinLength) || 20,
          overrideRequiredPermission: str(data.overrideRequiredPermission, "workforce.manpower.approve"),
          overriderAuthorised: data.overriderAuthorised === true,
          notes: Array.isArray(data.notes) ? (data.notes as unknown[]).map((entry) => String(entry)) : [],
          counts: Object.fromEntries(STATE_ORDER.map((state) => [state, int(asRecord(data.counts)[state])])),
          departments: (Array.isArray(data.departments) ? (data.departments as UnknownRecord[]) : []).map((entry) => ({
            id: str(entry.id),
            name: str(entry.name, "Unnamed department"),
          })),
          rows: (Array.isArray(data.rows) ? (data.rows as unknown[]) : []).map(readRow),
        };
        if (live) setScreen(next);
      } catch (err) {
        if (live) setError(err instanceof Error ? err.message : "The requisition register could not be loaded.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [revision]);

  // The hiring manager is a required field on POST /api/v1/requisitions, so the
  // form offers the directory rather than asking anyone to paste a uuid.
  useEffect(() => {
    if (!raiseOpen || managers.length > 0) return;
    let live = true;
    void (async () => {
      try {
        const payload = await getJson("/api/v1/people?page=1&pageSize=100");
        const rows = (Array.isArray(asRecord(payload).data) ? (asRecord(payload).data as UnknownRecord[]) : []).map((entry) => ({
          id: str(entry.id),
          label: `${str(entry.firstName)} ${str(entry.lastName)}`.trim() || str(entry.employeeCode, "Unnamed"),
          department: str(entry.department),
          designation: str(entry.designation),
        }));
        if (live) setManagers(rows);
      } catch {
        // The picker degrades to empty; the form says the directory is unavailable.
        if (live) setManagers([]);
      }
    })();
    return () => {
      live = false;
    };
  }, [raiseOpen, managers.length]);

  // Live headroom preview. The rule runs on the server: this only sends the
  // fields and renders the verdict that comes back.
  const previewKey = useMemo(() => {
    if (!raiseOpen) return "";
    const params = new URLSearchParams();
    params.set("previewRequisitionType", requisitionType);
    if (requisitionType === "replacement") {
      if (!againstPositionCode.trim()) return "";
      params.set("previewAgainstPositionCode", againstPositionCode.trim());
    } else {
      if (!departmentId) return "";
      params.set("previewDepartmentId", departmentId);
      if (designation.trim()) params.set("previewDesignation", designation.trim());
    }
    params.set("previewPositions", String(Math.max(1, int(positions) || 1)));
    return `/api/v1/requisition-register?${params.toString()}`;
  }, [raiseOpen, requisitionType, departmentId, designation, positions, againstPositionCode]);

  useEffect(() => {
    if (!previewKey) return;
    let live = true;
    const timer = globalThis.setTimeout(() => {
      void (async () => {
        try {
          const payload = await getJson(previewKey);
          const data = asRecord(asRecord(payload).data);
          const raw = data.preview;
          if (!live) return;
          if (raw === null || raw === undefined) {
            setPreviewState({ key: previewKey, value: null, error: "" });
            return;
          }
          const record = asRecord(raw);
          setPreviewState({
            key: previewKey,
            value: {
              controlConfigured: record.controlConfigured === true,
              headroom: readHeadroom(record.headroom),
              gate: readGate(record.gate),
              overriderAuthorised: record.overriderAuthorised === true,
              overrideReasonMinLength: int(record.overrideReasonMinLength) || 20,
            },
            error: "",
          });
        } catch (err) {
          if (live) {
            setPreviewState({
              key: previewKey,
              value: null,
              error: err instanceof Error ? err.message : "The headroom preview could not be loaded.",
            });
          }
        }
      })();
    }, 350);
    return () => {
      live = false;
      globalThis.clearTimeout(timer);
    };
  }, [previewKey, revision]);

  const preview = previewKey && previewState.key === previewKey ? previewState.value : null;
  const previewError = previewKey && previewState.key === previewKey ? previewState.error : "";

  const filtered = useMemo(() => {
    const rows = screen?.rows ?? [];
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (stateFilter !== "all" && row.displayState !== stateFilter) return false;
      if (needle && !`${row.code} ${row.title ?? ""} ${row.position} ${row.department ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [screen, search, stateFilter]);

  const active = useMemo(
    () => (screen?.rows ?? []).find((row) => row.id === selectedId) ?? filtered[0] ?? null,
    [screen, selectedId, filtered],
  );

  // The override draft belongs to one requisition; selecting another simply
  // stops matching, so nothing has to be reset.
  const activeId = active?.id ?? "";
  const approveFor = approveState.id === activeId ? approveState : { id: activeId, overrideOn: false, reason: "", error: "", ok: "" };
  const overrideOn = approveFor.overrideOn;
  const overrideReason = approveFor.reason;
  const approveError = approveFor.error;
  const approveOk = approveFor.ok;

  async function raiseRequisition(): Promise<void> {
    setRaiseError("");
    setRaiseOk("");
    if (!title.trim()) {
      setRaiseError("A requisition title is required.");
      return;
    }
    if (!hiringManagerId) {
      setRaiseError("A hiring manager is required: POST /api/v1/requisitions will not accept the requisition without one.");
      return;
    }
    const department = (screen?.departments ?? []).find((entry) => entry.id === departmentId);
    if (requisitionType === "addition" && !department) {
      setRaiseError("An addition must name the department its sanctioned strength is held against.");
      return;
    }
    if (!designation.trim()) {
      setRaiseError("A designation is required: sanctioned strength is held by org unit, designation and location.");
      return;
    }
    if (!locationCode.trim()) {
      setRaiseError("A location is required: it is part of the sanction key.");
      return;
    }
    if (!requiredBy) {
      setRaiseError("A required-by date is required: it is what the recruiter SLA is measured against.");
      return;
    }
    if (!qualificationRequired.trim()) {
      setRaiseError("The qualification required is mandatory.");
      return;
    }
    // Both rules are enforced by createRequisitionSchema; checking them here keeps the
    // form from reporting them as a rejected payload after a round trip.
    if (requisitionType === "addition" && justification.trim().length < 30) {
      setRaiseError(`An addition must justify the new headcount it asks for, in at least 30 characters. Currently ${justification.trim().length}.`);
      return;
    }
    if (requisitionType === "replacement" && !againstPositionCode.trim()) {
      setRaiseError("A replacement must name the vacated position code it backfills.");
      return;
    }
    setRaiseBusy(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        hiringManagerEmployeeId: hiringManagerId,
        requisitionType,
        positions: Math.max(1, int(positions) || 1),
        designation: designation.trim(),
        locationCode: locationCode.trim(),
        workerClass,
        employmentType,
        requiredBy,
        // Money is carried in minor units end to end; the field is typed in rupees.
        ctcMinMinor: Math.round((Number(ctcMin) || 0) * 100),
        ctcMaxMinor: Math.round((Number(ctcMax) || 0) * 100),
        qualificationRequired: qualificationRequired.trim(),
        experienceMinYears: Number(experienceMin) || 0,
        experienceMaxYears: Number(experienceMax) || 0,
        skills: skills.split(",").map((skill) => skill.trim()).filter(Boolean),
      };
      if (department) body.departmentName = department.name;
      if (positionCode.trim()) body.positionCode = positionCode.trim();
      if (justification.trim()) body.justification = justification.trim();
      if (requisitionType === "replacement" && againstPositionCode.trim()) body.againstPositionCode = againstPositionCode.trim();

      const response = await fetch("/api/v1/requisitions", {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        cache: "no-store",
        body: JSON.stringify(body),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiErrorMessage(payload, response.status, `The requisition could not be raised (${response.status}).`));
      const data = asRecord(asRecord(payload).data);
      const id = str(data.id);
      setRaiseOk(`Requisition ${str(data.code, "")} raised as a draft. Approval still runs the establishment gate.`);
      if (id) setSelectedId(id);
      setRaiseOpen(false);
      refresh();
    } catch (err) {
      setRaiseError(err instanceof Error ? err.message : "The requisition could not be raised.");
    } finally {
      setRaiseBusy(false);
    }
  }

  async function approve(row: RegisterRow): Promise<void> {
    const minLength = screen?.overrideReasonMinLength ?? 20;
    if (overrideOn && overrideReason.trim().length < minLength) {
      setApproveState({
        id: row.id,
        overrideOn,
        reason: overrideReason,
        error: `An establishment override needs a recorded justification of at least ${minLength} characters. Currently ${overrideReason.trim().length}.`,
        ok: "",
      });
      return;
    }
    if (!recruiterId) {
      setApproveState({
        id: row.id,
        overrideOn,
        reason: overrideReason,
        error: "A recruiter must own the opening before it is approved.",
        ok: "",
      });
      return;
    }
    setApproveState({ id: row.id, overrideOn, reason: overrideReason, error: "", ok: "" });
    setApproveBusy(true);
    try {
      const response = await fetch(`/api/v1/requisitions/${encodeURIComponent(row.id)}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          recruiterEmployeeId: recruiterId,
          ...(overrideOn ? { override: true, overrideReason: overrideReason.trim() } : { override: false }),
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiErrorMessage(payload, response.status, `Approval was refused (${response.status}).`));
      setApproveState({ id: row.id, overrideOn: false, reason: "", error: "", ok: `${row.code} approved.` });
      refresh();
    } catch (err) {
      setApproveState({
        id: row.id,
        overrideOn,
        reason: overrideReason,
        error: err instanceof Error ? err.message : "The requisition could not be approved.",
        ok: "",
      });
    } finally {
      setApproveBusy(false);
    }
  }

  const minLength = screen?.overrideReasonMinLength ?? 20;

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px]">
      <PageIntro
        eyebrow="RECRUITMENT · SCR-090"
        title="Recruitment requisitions"
        description="Every requisition with the live headroom of the sanctioned strength it draws on, and the verdict the establishment gate would return right now — before anyone presses approve."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold" onClick={refresh}>
              <RefreshCcw className="mr-1.5 size-4" /> Refresh
            </Button>
            <Button
              className="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                setRaiseError("");
                setRaiseOk("");
                setRaiseOpen((open) => !open);
              }}
            >
              <Plus className="mr-1.5 size-4" /> Raise requisition
            </Button>
          </div>
        }
      />

      <Surface className="mb-6">
        <SectionHeading
          title="Process guide · SCR-090"
          description="Raise a draft → the establishment gate is checked at approval (RL-462) → approve, or record an authorised override (RL-463) → the seat is filled when an offer is accepted and the candidate becomes an employee."
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Headroom is sanctioned minus filled minus open (RL-057). Filled and open are derived on every read and are never stored, so the
          Headroom column shows the live figure rather than the snapshot approval recorded. A replacement backfills a named vacated position
          and consumes no fresh sanctioned strength (RL-461).
        </p>
      </Surface>

      {screen && !screen.controlConfigured ? (
        <Surface className="mb-6 border-warning/40">
          <SectionHeading
            title="Establishment control is not configured"
            description={screen.controlNote ?? ""}
            action={<StatusPill tone="warning">Unchecked</StatusPill>}
          />
          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
            No headroom figure is shown for any requisition, because an unconfigured ceiling is not a ceiling of zero. Approvals will succeed
            and will be recorded as unchecked against an establishment.
          </p>
          <Link href="/organization?section=sanctioned-strength-board" className="mt-4 inline-flex h-10 sm:h-9 items-center rounded-lg border border-border px-3 text-xs font-bold hover:bg-secondary">
            Open sanctioned strength <ChevronRight className="ml-1 size-3.5" />
          </Link>
        </Surface>
      ) : null}

      {raiseOpen ? (
        <Surface className="mb-6">
          <SectionHeading
            title="Raise a requisition"
            description="The headroom and the verdict below are computed on the server by the same rule that runs at approval, so this panel cannot promise an approval the endpoint would refuse."
          />
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Title</span>
                <input aria-label="Requisition title" className={inputClass} placeholder="Spinning operator" value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Replacement or addition</span>
                <select aria-label="Requisition type" className={selectClass} value={requisitionType} onChange={(e) => setRequisitionType(e.target.value)}>
                  <option value="addition">Addition</option>
                  <option value="replacement">Replacement</option>
                </select>
              </label>
              <label className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Organisation unit</span>
                <select aria-label="Organisation unit" className={selectClass} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                  <option value="">Select a department</option>
                  {(screen?.departments ?? []).map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Designation</span>
                <input aria-label="Designation" className={inputClass} placeholder="Operator" value={designation} onChange={(e) => setDesignation(e.target.value)} />
              </label>
              <label className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Position code</span>
                <input aria-label="Position code" className={inputClass} placeholder="SPN-OP-03" value={positionCode} onChange={(e) => setPositionCode(e.target.value)} />
              </label>
              <label className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Positions</span>
                <input aria-label="Positions requested" type="number" min={1} max={99} className={"h-10 w-full min-w-0 max-w-full rounded-xl border border-border bg-card px-3 text-xs text-foreground sm:w-24"} value={positions} onChange={(e) => setPositions(e.target.value)} />
              </label>
              {requisitionType === "replacement" ? (
                <label className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Vacated position code</span>
                  <input aria-label="Vacated position code" className={inputClass} placeholder="SPN-OP-07" value={againstPositionCode} onChange={(e) => setAgainstPositionCode(e.target.value)} />
                </label>
              ) : null}
              <label className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Location</span>
                <input aria-label="Location code" className={inputClass} placeholder="Plant North" value={locationCode} onChange={(e) => setLocationCode(e.target.value)} />
              </label>
              <label className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Worker class</span>
                <select aria-label="Worker class" className={selectClass} value={workerClass} onChange={(e) => setWorkerClass(e.target.value)}>
                  {WORKER_CLASSES.map((entry) => (
                    <option key={entry.value} value={entry.value}>{entry.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Employment type</span>
                <select aria-label="Employment type" className={selectClass} value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}>
                  {EMPLOYMENT_TYPES.map((entry) => (
                    <option key={entry.value} value={entry.value}>{entry.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Required by</span>
                <input aria-label="Required by date" type="date" className={inputClass} value={requiredBy} onChange={(e) => setRequiredBy(e.target.value)} />
              </label>
              <label className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Budgeted CTC min</span>
                <input aria-label="Budgeted CTC minimum" type="number" min={0} className={inputClass} value={ctcMin} onChange={(e) => setCtcMin(e.target.value)} />
              </label>
              <label className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Budgeted CTC max</span>
                <input aria-label="Budgeted CTC maximum" type="number" min={0} className={inputClass} value={ctcMax} onChange={(e) => setCtcMax(e.target.value)} />
              </label>
              <label className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Experience min (years)</span>
                <input aria-label="Experience minimum in years" type="number" min={0} max={50} step={0.5} className={inputClass} value={experienceMin} onChange={(e) => setExperienceMin(e.target.value)} />
              </label>
              <label className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Experience max (years)</span>
                <input aria-label="Experience maximum in years" type="number" min={0} max={50} step={0.5} className={inputClass} value={experienceMax} onChange={(e) => setExperienceMax(e.target.value)} />
              </label>
              <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Qualification required</span>
                <input aria-label="Qualification required" className={inputClass} placeholder="ITI or 10th with mill-floor experience" value={qualificationRequired} onChange={(e) => setQualificationRequired(e.target.value)} />
              </label>
              <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Key skills (comma separated)</span>
                <input aria-label="Key skills" className={inputClass} placeholder="Ring frame, doffing" value={skills} onChange={(e) => setSkills(e.target.value)} />
              </label>
              {requisitionType === "addition" ? (
                <label className="flex w-full min-w-0 flex-col gap-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Justification (min 30 characters)</span>
                  <textarea
                    aria-label="Justification"
                    className="w-full rounded-xl border border-border bg-card p-3 text-xs text-foreground"
                    rows={2}
                    placeholder="Why this addition to approved headcount is needed"
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                  />
                </label>
              ) : null}
              <label className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Hiring manager</span>
                <select aria-label="Hiring manager" className={selectClass} value={hiringManagerId} onChange={(e) => setHiringManagerId(e.target.value)}>
                  <option value="">{managers.length === 0 ? "Directory unavailable" : "Select a hiring manager"}</option>
                  {managers.map((entry) => (
                    <option key={entry.id} value={entry.id}>{`${entry.label}${entry.designation ? ` · ${entry.designation}` : ""}`}</option>
                  ))}
                </select>
              </label>
              <Button className="h-10 rounded-xl px-4 text-xs font-bold" disabled={raiseBusy} onClick={() => void raiseRequisition()}>
                {raiseBusy ? "Raising…" : "Raise requisition"}
              </Button>
            </div>

            <div className="rounded-xl border border-border/80 bg-secondary/20 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Live headroom</h3>
              {previewError ? (
                <p className="mt-2 text-xs leading-relaxed text-destructive">{previewError}</p>
              ) : !preview ? (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {requisitionType === "replacement"
                    ? "Name the vacated position code to see whether the backfill would be accepted."
                    : "Choose an organisation unit and designation to resolve the sanction key."}
                </p>
              ) : (
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold tabular-nums text-foreground">{preview.headroom.label}</span>
                    <StatusPill tone={preview.gate.allowed ? "success" : "danger"}>{preview.gate.allowed ? "Would be approved" : "Would be blocked"}</StatusPill>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{preview.headroom.detail}</p>
                  {preview.gate.message ? <p className="mt-2 text-xs leading-relaxed text-destructive">{preview.gate.message}</p> : null}
                  {!preview.gate.checked && preview.gate.uncheckedReason ? (
                    <p className="mt-2 text-xs leading-relaxed text-warning">{preview.gate.uncheckedReason}</p>
                  ) : null}
                  {preview.gate.warnings.map((warning) => (
                    <p key={warning} className="mt-2 text-xs leading-relaxed text-warning">{warning}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
          {raiseError ? <p role="alert" className="mt-3 text-xs leading-relaxed text-destructive">{raiseError}</p> : null}
          {raiseOk ? <p className="mt-3 text-xs leading-relaxed text-success">{raiseOk}</p> : null}
        </Surface>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-4 py-3">
        <span className="text-xs font-bold text-muted-foreground">States</span>
        {STATE_ORDER.map((state) => {
          const count = screen?.counts[state] ?? 0;
          const unbacked = state === "submitted";
          return (
            <button
              key={state}
              type="button"
              onClick={() => setStateFilter((current) => (current === state ? "all" : state))}
              aria-pressed={stateFilter === state}
              className={`inline-flex min-h-10 items-center rounded-lg border px-2.5 py-1 text-[11px] font-bold capitalize transition-colors sm:min-h-0 ${stateFilter === state ? "border-primary/50 bg-primary/10 text-foreground" : "border-border/70 bg-secondary/30 text-muted-foreground hover:border-primary/40"}`}
              title={unbacked ? "No server path writes this state." : undefined}
            >
              {state} · {count}{unbacked ? " · not recorded" : ""}
            </button>
          );
        })}
        {stateFilter !== "all" ? (
          <button type="button" className="inline-flex min-h-10 items-center text-[11px] font-bold text-primary hover:underline sm:min-h-0" onClick={() => setStateFilter("all")}>
            Clear
          </button>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Surface>
          <SectionHeading
            title="Requisition register"
            description={loading ? "Loading…" : `${filtered.length} requisition${filtered.length === 1 ? "" : "s"} in the current scope`}
            action={<input aria-label="Search requisitions" className={inputClass} placeholder="Code, title or position" value={search} onChange={(e) => setSearch(e.target.value)} />}
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
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">
              {(screen?.rows.length ?? 0) === 0
                ? "No requisitions have been raised yet. Raise the first one; it stays a draft until the establishment gate passes at approval."
                : "No requisitions match these filters."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-bold">Requisition</th>
                    <th className="px-3 py-2 font-bold">Position</th>
                    <th className="px-3 py-2 font-bold">Headroom</th>
                    <th className="px-3 py-2 font-bold">Status</th>
                    <th className="w-10 px-3 py-2"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const selected = row.id === active?.id;
                    return (
                      <tr key={row.id}>
                        <td colSpan={5} className="p-0">
                          <button
                            type="button"
                            onClick={() => setSelectedId(row.id)}
                            aria-current={selected ? "true" : undefined}
                            className={`mb-2 grid w-full grid-cols-[1.1fr_1.2fr_1fr_auto_2rem] items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${selected ? "border-primary/50 bg-primary/5" : "border-border/80 bg-card hover:border-primary/40"}`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-semibold text-foreground">{row.code}</span>
                              <span className="block truncate text-[11px] text-muted-foreground">{row.title ?? "Untitled"}</span>
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-xs text-foreground">{row.position}</span>
                              <span className="block truncate text-[11px] text-muted-foreground">{row.department ?? "No department"} · {row.requisitionTypeLabel} · {row.positions} post{row.positions === 1 ? "" : "s"}</span>
                            </span>
                            <span className="min-w-0" title={row.headroom.detail}>
                              <span className={`block truncate text-xs font-semibold tabular-nums ${row.headroom.kind === "known" ? "text-foreground" : "text-muted-foreground"}`}>{row.headroom.label}</span>
                              <span className="block truncate text-[11px] text-muted-foreground">
                                {row.headroom.counts
                                  ? `${row.headroom.counts.sanctioned} sanctioned · ${row.headroom.counts.filled} filled · ${row.headroom.counts.open} open`
                                  : "Not derived from a ceiling"}
                              </span>
                            </span>
                            <span><StatusPill tone={statusTone(row.displayState)}>{row.displayStateLabel}</StatusPill></span>
                            <ChevronRight className="size-4 justify-self-end text-muted-foreground" />
                          </button>
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
            title="Requisition detail"
            description={active ? `${active.code} · ${active.requisitionTypeLabel}` : "Select a requisition to inspect it"}
            action={active ? <StatusPill tone={statusTone(active.displayState)}>{active.displayStateLabel}</StatusPill> : undefined}
          />
          {!active ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">No requisition selected.</p>
          ) : (
            <div>
              <dl className="space-y-2 text-xs">
                {[
                  ["Title", active.title ?? "Not recorded"],
                  ["Type", `${active.requisitionTypeLabel} · ${active.positions} position${active.positions === 1 ? "" : "s"}`],
                  ["Position", active.position],
                  ["Sanction key", active.requisitionType === "replacement" ? "Not applicable to a replacement" : `${active.department ?? "No department"} · ${active.designation ?? "no designation"}`],
                  ["Hiring manager", active.hiringManager ?? "Not recorded"],
                  ...(active.requisitionType === "replacement"
                    ? [
                        ["Backfills position", active.againstPositionCode ?? "Not named"],
                        ["Replacing", active.replacingEmployee ?? "Not recorded"],
                      ]
                    : []),
                  ["Location", active.terms.locationCode ?? "Not captured"],
                  ["Worker class", active.terms.workerClass ? picklistLabel("PL_WORKER_CLASS", active.terms.workerClass) : "Not captured"],
                  ["Employment type", active.terms.employmentType ? picklistLabel("PL_EMPLOYMENT_TYPE", active.terms.employmentType) : "Not captured"],
                  ["Required by", active.terms.requiredBy ?? "Not captured"],
                  ["Budgeted CTC", rangeLabel(active.terms.ctcMinMinor, active.terms.ctcMaxMinor)],
                  ["Experience", experienceLabel(active.terms.experienceMinYears, active.terms.experienceMaxYears)],
                  ["Qualification", active.terms.qualificationRequired ?? "Not captured"],
                  ["Key skills", active.terms.skills.length > 0 ? active.terms.skills.join(", ") : "None listed"],
                  ...(active.terms.justification ? [["Justification", active.terms.justification]] : []),
                  ["Raised", timeLabel(active.createdAt)],
                  ["Stored status", active.storedStatus],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3 border-b border-border/50 pb-1.5">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right font-semibold text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>

              <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Live headroom</h3>
              <div className="mt-2 rounded-xl border border-border/80 bg-secondary/20 p-3">
                <p className="text-sm font-semibold tabular-nums text-foreground">{active.headroom.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{active.headroom.detail}</p>
                {active.approvalSnapshot.headroomAfter !== null ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    Approval recorded a headroom of {active.approvalSnapshot.headroomAfter} at the time. That is a historic snapshot, not the figure above.
                  </p>
                ) : null}
                {active.approvalSnapshot.establishmentNote ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-warning">{active.approvalSnapshot.establishmentNote}</p>
                ) : null}
              </div>

              <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Decision right now</h3>
              <div className={`mt-2 rounded-xl border p-3 ${active.gate.allowed ? "border-border/80 bg-secondary/20" : "border-destructive/40 bg-destructive/5"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={active.gate.allowed ? "success" : "danger"}>{active.gate.allowed ? "Would be approved" : "Would be refused"}</StatusPill>
                  {active.gate.code ? <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{active.gate.code}</span> : null}
                  {!active.gate.checked ? <StatusPill tone="warning">Unchecked</StatusPill> : null}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{active.displayStateReason}</p>
                {active.gate.message ? <p className="mt-2 text-xs leading-relaxed text-destructive">{active.gate.message}</p> : null}
                {!active.gate.checked && active.gate.uncheckedReason ? (
                  <p className="mt-2 text-xs leading-relaxed text-warning">{active.gate.uncheckedReason}</p>
                ) : null}
                {active.gate.warnings.map((warning) => (
                  <p key={warning} className="mt-2 text-xs leading-relaxed text-warning">{warning}</p>
                ))}
              </div>

              {active.storedStatus === "draft" ? (
                <div className="mt-4">
                  {!active.gate.allowed && active.gate.overridable ? (
                    <div className="rounded-xl border border-border/80 bg-card p-3">
                      <label className="flex w-full min-w-0 items-center gap-2 text-xs font-semibold text-foreground sm:w-auto">
                        <input
                          type="checkbox"
                          checked={overrideOn}
                          onChange={(e) => setApproveState({ id: active.id, overrideOn: e.target.checked, reason: overrideReason, error: "", ok: "" })}
                        />
                        Record an establishment override (RL-463)
                      </label>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                        An override needs the {screen?.overrideRequiredPermission ?? "workforce.manpower.approve"} permission and a recorded
                        justification of at least {minLength} characters. The person who approved the manpower ceiling cannot also waive it.
                      </p>
                      {overrideOn ? (
                        <>
                          <textarea
                            aria-label="Override reason"
                            className="mt-2 w-full rounded-xl border border-border bg-card p-3 text-xs text-foreground"
                            rows={3}
                            placeholder="Why the approved ceiling is being exceeded"
                            value={overrideReason}
                            onChange={(e) => setApproveState({ id: active.id, overrideOn: true, reason: e.target.value, error: "", ok: "" })}
                          />
                          <p className={`mt-1 text-[11px] ${overrideReason.trim().length >= minLength ? "text-muted-foreground" : "text-destructive"}`}>
                            {overrideReason.trim().length} of {minLength} characters.
                          </p>
                        </>
                      ) : null}
                    </div>
                  ) : !active.gate.allowed ? (
                    <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs leading-relaxed text-muted-foreground">
                      {active.gate.code === "SANCTION_EXCEEDED"
                        ? `This refusal can only be waived by a role holding ${screen?.overrideRequiredPermission ?? "workforce.manpower.approve"}, which this session does not hold. No override field is offered.`
                        : "This refusal is not waivable by an override. Correct the requisition or the establishment first."}
                    </p>
                  ) : null}

                  <label className="mt-3 flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Recruiter assigned</span>
                    <select aria-label="Recruiter assigned" className={selectClass} value={recruiterId} onChange={(e) => setRecruiterId(e.target.value)}>
                      <option value="">{managers.length === 0 ? "Directory unavailable" : "Select a recruiter"}</option>
                      {managers.map((entry) => (
                        <option key={entry.id} value={entry.id}>{`${entry.label}${entry.designation ? ` · ${entry.designation}` : ""}`}</option>
                      ))}
                    </select>
                  </label>

                  <Button
                    className="mt-3 h-10 w-full rounded-xl px-4 text-xs font-bold"
                    disabled={approveBusy || !recruiterId || (!active.gate.allowed && !overrideOn)}
                    onClick={() => void approve(active)}
                  >
                    {approveBusy ? "Approving…" : overrideOn ? "Approve under override" : "Approve requisition"}
                  </Button>
                  {approveError ? <p role="alert" className="mt-2 text-xs leading-relaxed text-destructive">{approveError}</p> : null}
                  {approveOk ? <p className="mt-2 text-xs leading-relaxed text-success">{approveOk}</p> : null}
                </div>
              ) : null}

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">State timeline</h3>
              <ol className="mt-2 space-y-2">
                {active.timeline.map((step) => (
                  <li key={step.state} className="rounded-xl border border-border/60 bg-secondary/20 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground">{step.label}</span>
                      <div className="flex items-center gap-2">
                        {step.at ? <span className="text-[11px] tabular-nums text-muted-foreground">{timeLabel(step.at)}</span> : null}
                        <StatusPill tone={timelineTone(step.status)}>{step.status === "not_recorded" ? "not recorded" : step.status}</StatusPill>
                      </div>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{step.note}</p>
                  </li>
                ))}
              </ol>

              {active.conversions.length > 0 ? (
                <>
                  <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Seats filled</h3>
                  <ul className="mt-2 space-y-1.5">
                    {active.conversions.map((entry) => (
                      <li key={entry.employeeId} className="flex justify-between gap-3 rounded-lg border border-border/60 bg-secondary/30 px-2 py-1.5 text-xs">
                        <span className="text-foreground">{entry.name ?? entry.employeeCode ?? entry.employeeId}</span>
                        <span className="text-muted-foreground">{entry.joiningDate ?? timeLabel(entry.linkedAt)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Audit trail</h3>
              {active.auditTrail.length === 0 ? (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">No audit events are recorded against this requisition.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {active.auditTrail.map((entry, index) => (
                    <li key={`${entry.action}-${entry.at ?? index}`} className="rounded-lg border border-border/60 bg-secondary/30 px-2 py-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-foreground">{entry.label}</span>
                        <span className="text-[11px] tabular-nums text-muted-foreground">{timeLabel(entry.at)}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                        {entry.actor ? `${entry.actor} — ` : ""}{entry.reason ?? "No reason recorded."}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Surface>
      </div>

      {screen && screen.notes.length > 0 ? (
        <Surface className="mt-6">
          <SectionHeading title="What this register cannot show" description="Named gaps between the workbook's five states and what the server records." />
          <ul className="space-y-2">
            {screen.notes.map((note) => (
              <li key={note} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                {note}
              </li>
            ))}
          </ul>
        </Surface>
      ) : null}
    </div>
  );
}
