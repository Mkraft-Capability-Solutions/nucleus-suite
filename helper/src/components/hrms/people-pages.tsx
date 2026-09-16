"use client";

import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Gift,
  Inbox,
  Loader2,
  Mail,
  MapPin,
  Medal,
  Plus,
  Search,
  Trophy,
  UserCheck,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getJson, invalidateGetRequest } from "@/lib/client-api";
import { picklistLabel, picklists, type PicklistCode } from "@/lib/picklists";
import Link from "next/link";
import { LetterStudioTab } from "./onboarding/letter-studio-tab";
import { LifecycleTriggerChainsTab } from "./onboarding/lifecycle-trigger-chains-tab";
import { RecognitionEventsTab } from "./onboarding/recognition-events-tab";
import { WorkflowPipelinesTab } from "./onboarding/workflow-pipelines-tab";
import {
  AiLabel,
  AvatarMark,
  PageIntro,
  SectionHeading,
  StatusPill,
  Surface,
} from "./page-primitives";
import {
  ModuleStat,
  ModuleTabs,
  ReferencePicker,
  RegisterNotice,
  RegisterStates,
  TabPanel,
  downloadCsv,
  listOf,
  recordFromEnvelope,
  shortTimestamp,
  stateLabel,
  toCsv,
  useRegisterResource,
  type Notice,
} from "./register-primitives";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function useLive(path: string): { data: unknown; loading: boolean; error: string; refresh: () => void } {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    getJson(path)
      .then((value) => {
        if (!cancelled) {
          setData(value);
          setError("");
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("This data could not be loaded. Please try again.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [path, tick]);
  return {
    data,
    loading,
    error,
    refresh: () => {
      invalidateGetRequest(path);
      setLoading(true);
      setTick((current) => current + 1);
    },
  };
}

type FieldErrors = Record<string, string>;

function errorEnvelope(payload: unknown): {
  code: string;
  message: string;
  details: Array<{ field: string; issue: string }>;
} {
  const err = asRecord(asRecord(payload).error);
  const raw = err.details;
  const details = (Array.isArray(raw) ? raw : []).map((entry) => {
    const record = asRecord(entry);
    return { field: str(record.field), issue: str(record.issue) };
  });
  return { code: str(err.code), message: str(err.message), details };
}

function fieldErrorsFrom(payload: unknown): FieldErrors {
  const errors: FieldErrors = {};
  for (const detail of errorEnvelope(payload).details) {
    if (detail.field && !errors[detail.field]) {
      errors[detail.field] = detail.issue || "Invalid value.";
    }
  }
  return errors;
}

type PostOutcome =
  | { ok: true; status: number; payload: UnknownRecord }
  | { ok: false; status: number; payload: UnknownRecord; code: string; message: string; fieldErrors: FieldErrors };

async function postJson(path: string, body: UnknownRecord, headers?: Record<string, string>): Promise<PostOutcome> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = asRecord(await response.json().catch(() => null));
  if (response.ok) return { ok: true, status: response.status, payload };
  const envelope = errorEnvelope(payload);
  return {
    ok: false,
    status: response.status,
    payload,
    code: envelope.code,
    message: envelope.message || `Request failed (${response.status}).`,
    fieldErrors: fieldErrorsFrom(payload),
  };
}

function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

function createdAttributes(payload: UnknownRecord): UnknownRecord {
  return asRecord(asRecord(payload).data);
}

/** The workbook's own label for a stored picklist value; blank when nothing is recorded. */
function labelFor(code: PicklistCode, value: unknown): string {
  return typeof value === "string" && value !== "" ? picklistLabel(code, value) : "";
}

function FormAlert({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex gap-2 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-xs text-destructive">
      <CircleAlert className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function FormNotice({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="rounded-xl border border-primary/35 bg-primary/10 px-4 py-3 text-xs leading-5 text-foreground">
      {message}
    </div>
  );
}

function CreateModal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    // Full-screen sheet on a phone, centred dialog from `sm`. The scrim keeps
    // its own padding only once there is room for a floating card.
    <div
      className="fixed inset-0 z-50 grid place-items-start overflow-y-auto bg-[var(--scrim)] p-0 sm:place-items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-full sm:max-w-lg" onClick={(event) => event.stopPropagation()}>
        <Surface className="min-h-dvh rounded-none p-5 sm:min-h-0 sm:rounded-lg sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-tight text-foreground">{title}</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={`Close ${title}`}
              className="grid size-10 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground sm:size-8"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-5">{children}</div>
        </Surface>
      </div>
    </div>
  );
}

function ModalField({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
  error,
  disabled,
  min,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  type?: string;
  error?: string;
  disabled?: boolean;
  min?: number;
  step?: number | string;
}) {
  return (
    <label className="block text-[11px] font-medium text-foreground">
      <span className="mb-1.5 block">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        min={min}
        step={step}
        aria-invalid={Boolean(error)}
        className="h-10 w-full rounded-lg border border-border bg-secondary px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary disabled:opacity-60"
      />
      {error && <span className="mt-1 block text-[11px] font-medium text-destructive">{error}</span>}
    </label>
  );
}

function ModalSelect({
  label,
  value,
  onChange,
  error,
  disabled,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block text-[11px] font-medium text-foreground">
      <span className="mb-1.5 block">{label}</span>
      <span className="relative block">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="h-11 w-full appearance-none rounded-xl border border-border/80 bg-popover px-3 pr-10 text-xs font-medium text-popover-foreground shadow-sm outline-none transition hover:border-primary/40 focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {children}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground">
          <ChevronDown className="size-4" />
        </span>
      </span>
      {error && <span className="mt-1 block text-[11px] font-medium text-destructive">{error}</span>}
    </label>
  );
}

function ModalTextarea({
  label,
  value,
  onChange,
  placeholder,
  required,
  error,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block text-[11px] font-medium text-foreground">
      <span className="mb-1.5 block">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        rows={4}
        className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-xs leading-5 text-foreground placeholder:text-muted-foreground focus:border-primary disabled:opacity-60"
      />
      {error && <span className="mt-1 block text-[11px] font-medium text-destructive">{error}</span>}
    </label>
  );
}

function SubmitButton({ busy, busyLabel, children }: { busy: boolean; busyLabel: string; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
    >
      {busy ? (
        <>
          <Loader2 className="size-4 animate-spin" /> {busyLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

function listFromEnvelope(payload: unknown): UnknownRecord[] {
  const data = asRecord(payload).data;
  return Array.isArray(data) ? (data as UnknownRecord[]) : [];
}

type Person = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  designation: string;
  department: string;
  location: string;
  category: string;
  status: string;
  joiningDate: string;
};

function toPerson(row: UnknownRecord): Person {
  return {
    id: str(row.id),
    employeeCode: str(row.employeeCode),
    firstName: str(row.firstName),
    lastName: str(row.lastName),
    workEmail: str(row.workEmail),
    designation: str(row.designation),
    department: str(row.department),
    location: str(row.location),
    category: str(row.category),
    status: str(row.status),
    joiningDate: str(row.joiningDate),
  };
}

function fullName(person: Person): string {
  const name = `${person.firstName} ${person.lastName}`.trim();
  return name || person.employeeCode || "Unnamed";
}

function initialsFor(person: Person): string {
  const initials = `${person.firstName.slice(0, 1)}${person.lastName.slice(0, 1)}`.toUpperCase();
  return initials || "··";
}

// Theme-aware avatar accents: every entry is a token defined for both themes,
// mixed to a faint wash by AvatarMark so the initials stay legible either way.
const ACCENT_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--accent-coral)",
];

function accentFor(id: string): string {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 997;
  }
  return ACCENT_PALETTE[hash % ACCENT_PALETTE.length];
}

function toneForStatus(status: string): "success" | "warning" | "info" | "neutral" {
  const normalized = status.toLowerCase();
  if (normalized.includes("leave")) return "warning";
  if (normalized.includes("probation") || normalized.includes("notice") || normalized.includes("exit")) {
    return "warning";
  }
  if (normalized === "active") return "success";
  if (normalized.includes("join") || normalized.includes("onboard") || normalized.includes("preboard")) {
    return "info";
  }
  return "neutral";
}


function deptInitials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const initials = `${words[0]?.slice(0, 1) ?? ""}${words[1]?.slice(0, 1) ?? ""}`.toUpperCase();
  return initials || "··";
}

const ADD_PERSON_INITIAL = {
  firstName: "",
  lastName: "",
  employeeCode: "",
  workEmail: "",
  designation: "",
  department: "",
  location: "",
  joiningDate: "",
  basicSalary: "",
  // FRM-PPL-01 identity, family and control. Defaults are the workbook's own.
  salutation: "",
  middleName: "",
  gender: "",
  dateOfBirth: "",
  bloodGroup: "",
  maritalStatus: "single",
  marriageDate: "",
  spouseName: "",
  nationality: "indian",
  socialCategory: "general",
  religion: "",
  motherTongue: "",
  placeOfBirth: "",
  fatherName: "",
  motherName: "",
  identificationMark: "",
  effectiveFrom: "",
};

/** The FRM-PPL-01 selects, in the order the workbook lists them. */
const PERSON_CHOICES = [
  { key: "salutation", label: "Salutation", code: "PL_SALUTATION", required: false },
  { key: "gender", label: "Gender", code: "PL_GENDER", required: true },
  { key: "bloodGroup", label: "Blood group", code: "PL_BLOOD_GROUP", required: true },
  { key: "maritalStatus", label: "Marital status", code: "PL_MARITAL_STATUS", required: true },
  { key: "nationality", label: "Nationality", code: "PL_NATIONALITY", required: true },
  { key: "socialCategory", label: "Social category", code: "PL_SOCIAL_CATEGORY", required: true },
  { key: "motherTongue", label: "Mother tongue", code: "PL_LANGUAGE", required: false },
  { key: "religion", label: "Religion", code: "PL_RELIGION", required: false },
] as const;

function AddPersonModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState(ADD_PERSON_INITIAL);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ id: string; employeeCode: string } | null>(null);
  const [differentlyAbled, setDifferentlyAbled] = useState(false);
  const [disabilityType, setDisabilityType] = useState("");
  const [disabilityPercent, setDisabilityPercent] = useState("");
  const [exServiceman, setExServiceman] = useState(false);
  const [inviteRoleCodes, setInviteRoleCodes] = useState("employee");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteNotice, setInviteNotice] = useState("");

  function set<K extends keyof typeof ADD_PERSON_INITIAL>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setFormError("");
    setFieldErrors({});
    try {
      const firstName = form.firstName.trim();
      const lastName = form.lastName.trim();
      const employeeCode = form.employeeCode.trim();
      const workEmail = form.workEmail.trim();
      const designation = form.designation.trim();
      const department = form.department.trim();
      const location = form.location.trim();
      const joiningDate = form.joiningDate.trim();
      const basicSalary = form.basicSalary.trim();
      const localErrors: FieldErrors = {};
      if (!firstName) localErrors.firstName = "First name is required.";
      if (!lastName) localErrors.lastName = "Last name is required.";
      if (joiningDate && !/^\d{4}-\d{2}-\d{2}$/.test(joiningDate)) {
        localErrors.joiningDate = "Use YYYY-MM-DD.";
      }
      for (const choice of PERSON_CHOICES) {
        if (choice.required && !form[choice.key]) localErrors[choice.key] = `${choice.label} is required.`;
      }
      if (!form.dateOfBirth) localErrors.dateOfBirth = "A date of birth is required.";
      if (!form.fatherName.trim()) localErrors.fatherName = "Father's name prints on the PF and gratuity nomination.";
      if (!form.motherName.trim()) localErrors.motherName = "Mother's name is used for background verification.";
      if (form.maritalStatus === "married") {
        if (!form.marriageDate) localErrors.marriageDate = "A marriage date is required once marital status is married.";
        if (!form.spouseName.trim()) localErrors.spouseName = "A spouse name is required once marital status is married.";
      }
      if (differentlyAbled) {
        if (!disabilityType) localErrors.disabilityType = "Record the disability type.";
        if (!/^\d{1,3}$/.test(disabilityPercent) || Number(disabilityPercent) < 1 || Number(disabilityPercent) > 100) {
          localErrors.disabilityPercent = "Enter a percentage between 1 and 100.";
        }
      }
      let basicSalaryMinor: number | undefined;
      if (basicSalary) {
        const amount = Number(basicSalary);
        if (!Number.isFinite(amount) || amount < 0) {
          localErrors.basicSalaryMinor = "Enter a non-negative amount.";
        } else {
          basicSalaryMinor = Math.round(amount * 100);
        }
      }
      if (Object.keys(localErrors).length > 0) {
        setFieldErrors(localErrors);
        setFormError("Fix the highlighted fields and try again.");
        return;
      }
      const body: UnknownRecord = {
        firstName,
        lastName,
        dateOfBirth: form.dateOfBirth,
        fatherName: form.fatherName.trim(),
        motherName: form.motherName.trim(),
        isDifferentlyAbled: differentlyAbled,
        isExServiceman: exServiceman,
      };
      for (const choice of PERSON_CHOICES) {
        if (form[choice.key]) body[choice.key] = form[choice.key];
      }
      for (const key of ["middleName", "placeOfBirth", "identificationMark", "spouseName", "marriageDate", "effectiveFrom"] as const) {
        if (form[key].trim()) body[key] = form[key].trim();
      }
      if (differentlyAbled) {
        body.disabilityType = disabilityType;
        body.disabilityPercent = Number(disabilityPercent);
      }
      if (employeeCode) body.employeeCode = employeeCode;
      if (workEmail) body.workEmail = workEmail;
      if (designation) body.designation = designation;
      if (department) body.department = department;
      if (location) body.location = location;
      if (joiningDate) body.joiningDate = joiningDate;
      if (basicSalaryMinor !== undefined) body.basicSalaryMinor = basicSalaryMinor;
      const outcome = await postJson("/api/v1/people", body, { "Idempotency-Key": newIdempotencyKey() });
      if (!outcome.ok) {
        if (outcome.status === 409) {
          setFieldErrors({
            ...outcome.fieldErrors,
            employeeCode: outcome.fieldErrors.employeeCode || "This code exists already.",
          });
          setFormError("An employee with this code already exists.");
        } else {
          setFieldErrors(outcome.fieldErrors);
          setFormError(outcome.message);
        }
        return;
      }
      const attributes = createdAttributes(outcome.payload);
      setCreated({ id: str(attributes.id), employeeCode: str(attributes.employeeCode) });
      onCreated();
    } finally {
      setCreating(false);
    }
  }

  async function sendInvite() {
    const email = form.workEmail.trim();
    if (!email) {
      setInviteError("Enter a work email on the person form to create a login.");
      return;
    }
    const roleCodes = inviteRoleCodes
      .split(",")
      .map((role) => role.trim())
      .filter(Boolean);
    if (roleCodes.length === 0) {
      setInviteError("Enter at least one role code (e.g. employee).");
      return;
    }
    setInviting(true);
    setInviteError("");
    setInviteNotice("");
    try {
      const outcome = await postJson("/api/v1/invitations", { email, roleCodes });
      if (!outcome.ok) {
        setInviteError(outcome.message);
        return;
      }
      setInviteNotice(`Login invitation created for ${email}. Save the invitation token now; it is shown only once.`);
    } finally {
      setInviting(false);
    }
  }

  return (
    <CreateModal title="Add Person" description="Create a governed employee record and optionally invite the employee to sign in." onClose={onClose}>
      {created ? (
        <div className="space-y-4">
          <FormNotice message={`Created ${form.firstName} ${form.lastName} with employee code ${created.employeeCode || created.id}.`} />
          <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
            <p className="text-xs font-bold text-foreground">Create login (optional)</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Send a login invitation to the work email above.
            </p>
            <div className="mt-3 space-y-3">
              <ModalField
                label="Role codes (comma separated)"
                value={inviteRoleCodes}
                onChange={setInviteRoleCodes}
                placeholder="employee"
                disabled={inviting}
              />
              <FormAlert message={inviteError} />
              <FormNotice message={inviteNotice} />
              <button
                type="button"
                onClick={() => void sendInvite()}
                disabled={inviting}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-secondary/50 px-4 text-xs font-bold text-foreground hover:text-primary disabled:opacity-60"
              >
                {inviting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Sending invite…
                  </>
                ) : (
                  "Send login invite"
                )}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
          >
            Done
          </button>
        </div>
      ) : (
        <form className="space-y-3" onSubmit={(event) => void submit(event)}>
          <FormAlert message={formError} />
          <div className="grid gap-3 sm:grid-cols-2">
            <ModalField label="First name" value={form.firstName} onChange={(value) => set("firstName", value)} placeholder="Asha" required error={fieldErrors.firstName} disabled={creating} />
            <ModalField label="Last name" value={form.lastName} onChange={(value) => set("lastName", value)} placeholder="Nair" required error={fieldErrors.lastName} disabled={creating} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ModalField label="Employee code (optional)" value={form.employeeCode} onChange={(value) => set("employeeCode", value)} placeholder="Auto-generated when blank" error={fieldErrors.employeeCode} disabled={creating} />
            <ModalField label="Work email (optional)" value={form.workEmail} onChange={(value) => set("workEmail", value)} placeholder="asha@company.com" type="email" error={fieldErrors.workEmail} disabled={creating} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ModalField label="Designation (optional)" value={form.designation} onChange={(value) => set("designation", value)} placeholder="Associate" error={fieldErrors.designation} disabled={creating} />
            <ModalField label="Department (optional)" value={form.department} onChange={(value) => set("department", value)} placeholder="General" error={fieldErrors.department} disabled={creating} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ModalField label="Location (optional)" value={form.location} onChange={(value) => set("location", value)} placeholder="Head Office" error={fieldErrors.location} disabled={creating} />
            <ModalField label="Joining date (optional)" value={form.joiningDate} onChange={(value) => set("joiningDate", value)} placeholder="YYYY-MM-DD" type="date" error={fieldErrors.joiningDate} disabled={creating} />
          </div>
          <ModalField label="Basic salary INR (optional)" value={form.basicSalary} onChange={(value) => set("basicSalary", value)} placeholder="e.g. 45000" type="number" min={0} error={fieldErrors.basicSalaryMinor} disabled={creating} />
          <div className="grid gap-3 sm:grid-cols-2">
            <ModalField label="Middle name (optional)" value={form.middleName} onChange={(value) => set("middleName", value)} placeholder="Ramesh" error={fieldErrors.middleName} disabled={creating} />
            <ModalField label="Date of birth" value={form.dateOfBirth} onChange={(value) => set("dateOfBirth", value)} placeholder="YYYY-MM-DD" type="date" required error={fieldErrors.dateOfBirth} disabled={creating} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {PERSON_CHOICES.map((choice) => (
              <ModalSelect
                key={choice.key}
                label={choice.required ? choice.label : `${choice.label} (optional)`}
                value={form[choice.key]}
                onChange={(value) => set(choice.key, value)}
                error={fieldErrors[choice.key]}
                disabled={creating}
              >
                <option value="">Select…</option>
                {picklists[choice.code].values.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </ModalSelect>
            ))}
          </div>
          {form.maritalStatus === "married" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <ModalField label="Date of marriage" value={form.marriageDate} onChange={(value) => set("marriageDate", value)} placeholder="YYYY-MM-DD" type="date" required error={fieldErrors.marriageDate} disabled={creating} />
              <ModalField label="Spouse name" value={form.spouseName} onChange={(value) => set("spouseName", value)} placeholder="Full name" required error={fieldErrors.spouseName} disabled={creating} />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <ModalField label="Father's name" value={form.fatherName} onChange={(value) => set("fatherName", value)} placeholder="Prints on PF and gratuity nomination" required error={fieldErrors.fatherName} disabled={creating} />
            <ModalField label="Mother's name" value={form.motherName} onChange={(value) => set("motherName", value)} placeholder="Used for background verification" required error={fieldErrors.motherName} disabled={creating} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ModalField label="Place of birth (optional)" value={form.placeOfBirth} onChange={(value) => set("placeOfBirth", value)} placeholder="Needed for passport and visa letters" error={fieldErrors.placeOfBirth} disabled={creating} />
            <ModalField label="Identification mark (optional)" value={form.identificationMark} onChange={(value) => set("identificationMark", value)} placeholder="Required on some factory registers" error={fieldErrors.identificationMark} disabled={creating} />
          </div>
          <label className="flex items-center gap-2 text-[11px] font-medium text-foreground">
            <input type="checkbox" checked={differentlyAbled} onChange={(event) => setDifferentlyAbled(event.target.checked)} disabled={creating} className="size-4" />
            Differently abled
          </label>
          {differentlyAbled && (
            <div className="grid gap-3 sm:grid-cols-2">
              <ModalSelect label="Disability type" value={disabilityType} onChange={setDisabilityType} error={fieldErrors.disabilityType} disabled={creating}>
                <option value="">Select…</option>
                {picklists.PL_DISABILITY_TYPE.values.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </ModalSelect>
              <ModalField label="Disability percentage" value={disabilityPercent} onChange={setDisabilityPercent} placeholder="40 and above drives the higher 80U deduction" type="number" min={1} required error={fieldErrors.disabilityPercent} disabled={creating} />
            </div>
          )}
          <label className="flex items-center gap-2 text-[11px] font-medium text-foreground">
            <input type="checkbox" checked={exServiceman} onChange={(event) => setExServiceman(event.target.checked)} disabled={creating} className="size-4" />
            Ex-serviceman (statutory reporting)
          </label>
          <ModalField label="Effective from (optional)" value={form.effectiveFrom} onChange={(value) => set("effectiveFrom", value)} placeholder="Backdating past a closed payroll creates arrears" type="date" error={fieldErrors.effectiveFrom} disabled={creating} />
          <p className="text-[11px] leading-5 text-muted-foreground">
            Contact, address, bank, statutory identifier, dependant and nominee details are recorded on the employee dossier once this record exists.
          </p>
          <SubmitButton busy={creating} busyLabel="Creating…">Add Person</SubmitButton>
        </form>
      )}
    </CreateModal>
  );
}

function formatSalary(amount: unknown, currency: unknown): string {
  const value = Number(amount);
  const code = str(currency, "INR");
  if (!Number.isFinite(value)) return "Unavailable";
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: code }).format(value);
  } catch {
    return `${code} ${value.toFixed(2)}`;
  }
}

function EmployeeDossierSheet({ person, onOpenChange }: { person: Person; onOpenChange: (open: boolean) => void }) {
  const detailState = useLive(`/api/v1/people/${encodeURIComponent(person.id)}`);
  const record = asRecord(asRecord(detailState.data).data);
  const detail = record.id ? toPerson(record) : person;
  const salary = asRecord(record.basicSalary);
  const salaryMasked = record.salaryMasked === true;
  // RL-05/RL-26: the rest-day and wage rules the employment category actually resolves to,
  // with the level each value came from, so "why does this person get no rest day" is
  // answerable from the record.
  const workRules = asRecord(record.workRules);
  const workRuleSource = asRecord(workRules.source);
  const employmentFields = [
    { label: "Employee code", value: detail.employeeCode || "Unavailable" },
    { label: "Designation", value: detail.designation || "Unavailable" },
    { label: "Department", value: detail.department || "Unavailable" },
    { label: "Attendance location", value: detail.location || "Unavailable" },
    { label: "Payroll processing location", value: str(record.payrollOwner, detail.location) || "Unavailable" },
    { label: "Category", value: detail.category || "Unavailable" },
    { label: "Joining date", value: detail.joiningDate || "Unavailable" },
  ];
  const workRuleFields = [
    {
      label: "Rest day",
      value: workRules.hasRestDays === true ? `Yes · ${str(workRules.restDayPattern, "pattern not stated")}`
        : workRules.hasRestDays === false ? "No rest day" : "",
      source: str(workRuleSource.hasRestDays),
    },
    {
      label: "Wage basis",
      value: workRules.paysOnDaysPresent === true ? `${str(workRules.wageType)} · paid on days present`
        : str(workRules.wageType),
      source: str(workRuleSource.wageType),
    },
    { label: "OT eligibility", value: str(workRules.otEligibility), source: str(workRuleSource.otEligibility) },
  ].filter((field) => field.value !== "");
  // FRM-PPL-01 identity and family, read back from the record's metadata envelope.
  // Age is derived by the server, never stored.
  const personalFields = [
    { label: "Full name", value: str(record.fullName) },
    { label: "Name as per bank", value: str(record.nameAsPerBank) },
    { label: "Date of birth", value: str(record.dateOfBirth) },
    { label: "Age", value: record.ageYears === null || record.ageYears === undefined ? "" : `${num(record.ageYears)} years` },
    { label: "Gender", value: labelFor("PL_GENDER", record.gender) },
    { label: "Blood group", value: labelFor("PL_BLOOD_GROUP", record.bloodGroup) },
    { label: "Marital status", value: labelFor("PL_MARITAL_STATUS", record.maritalStatus) },
    { label: "Nationality", value: labelFor("PL_NATIONALITY", record.nationality) },
    { label: "Social category", value: labelFor("PL_SOCIAL_CATEGORY", record.socialCategory) },
    { label: "Father's name", value: str(record.fatherName) },
    { label: "Mother's name", value: str(record.motherName) },
    { label: "Spouse name", value: str(record.spouseName) },
    { label: "Differently abled", value: record.isDifferentlyAbled === true ? `${labelFor("PL_DISABILITY_TYPE", record.disabilityType)} · ${num(record.disabilityPercent)}%` : record.isDifferentlyAbled === false ? "No" : "" },
    { label: "Ex-serviceman", value: record.isExServiceman === true ? "Yes" : record.isExServiceman === false ? "No" : "" },
    { label: "Medical fitness", value: labelFor("PL_FITNESS_STATUS", record.fitnessStatus) },
    { label: "Access card", value: str(record.accessCardNumber) },
    { label: "Locker", value: str(record.lockerNumber) },
  ].filter((field) => field.value !== "");

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent className="w-[min(560px,96vw)] gap-0 overflow-hidden border-border bg-card p-0 sm:max-w-[560px]">
        <SheetHeader className="shrink-0 border-b border-border px-5 py-5 pr-14 sm:px-6 sm:py-6 sm:pr-14">
          <div className="flex items-center gap-3">
            <AvatarMark initials={initialsFor(detail)} color={accentFor(detail.id)} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="truncate text-lg font-bold">{fullName(detail)}</SheetTitle>
                <StatusPill tone={toneForStatus(detail.status)} dot>{detail.status || "Unknown"}</StatusPill>
              </div>
              <SheetDescription className="mt-1 text-xs">
                {detail.designation || "No designation"} · {detail.employeeCode || "No employee code"}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          {detailState.loading && (
            <div role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" /> Loading the governed employee record…
            </div>
          )}
          {detailState.error && (
            <div role="alert" className="mb-4 rounded-xl border border-destructive/25 bg-destructive/10 p-4">
              <p className="text-xs font-semibold text-foreground">The full employee record could not be loaded.</p>
              <p className="mt-1 text-xs text-muted-foreground">{detailState.error}</p>
              <button type="button" onClick={detailState.refresh} className="mt-3 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:border-primary/50">
                Try again
              </button>
            </div>
          )}

          <section aria-label="Employment">
            <SectionHeading title="Employment" description="Current governed employment record" />
            <dl className="grid gap-2 sm:grid-cols-2">
              {employmentFields.map((field) => (
                <div key={field.label} className="rounded-xl border border-border/70 bg-secondary/30 p-3.5">
                  <dt className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{field.label}</dt>
                  <dd className="mt-1.5 break-words text-sm font-semibold text-foreground">{field.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {personalFields.length > 0 && (
            <section className="mt-6 border-t border-border pt-5" aria-label="Identity and personal">
              <SectionHeading title="Identity and personal" description="Recorded on the employee record" />
              <dl className="grid gap-2 sm:grid-cols-2">
                {personalFields.map((field) => (
                  <div key={field.label} className="rounded-xl border border-border/70 bg-secondary/30 p-3.5">
                    <dt className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{field.label}</dt>
                    <dd className="mt-1.5 break-words text-sm font-semibold text-foreground">{field.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section className="mt-6 border-t border-border pt-5" aria-label="Contact">
            <SectionHeading title="Contact" description="Work contact held on the employee record" />
            <div className="rounded-xl border border-border/70 bg-secondary/30 p-3.5">
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Work email</p>
              <p className="mt-1.5 break-all text-sm font-semibold text-foreground">{detail.workEmail || "Unavailable"}</p>
            </div>
          </section>

          <section className="mt-6 border-t border-border pt-5" aria-label="Work rules">
            <SectionHeading
              title="Rest day and wage basis"
              description="Resolved from the employee record, then the sub-category, then the employment category"
            />
            {workRuleFields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No worker category states a rest-day pattern or wage basis for this employee yet, so neither is
                assumed. Configure the worker category before running attendance or payroll for them.
              </p>
            ) : (
              <dl className="grid gap-2 sm:grid-cols-2">
                {workRuleFields.map((field) => (
                  <div key={field.label} className="rounded-xl border border-border/70 bg-secondary/30 p-3.5">
                    <dt className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{field.label}</dt>
                    <dd className="mt-1.5 break-words text-sm font-semibold text-foreground">{field.value}</dd>
                    <dd className="mt-0.5 text-[11px] text-muted-foreground">from the {field.source.replace("_", " ")} level</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section className="mt-6 border-t border-border pt-5" aria-label="Compensation">
            <SectionHeading title="Compensation" description="Permission-filtered salary information" />
            <div className="rounded-xl border border-border/70 bg-secondary/30 p-3.5">
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Basic salary</p>
              <p className="mt-1.5 text-sm font-semibold text-foreground">
                {salaryMasked ? "Restricted for your role" : formatSalary(salary.amount, salary.currency)}
              </p>
            </div>
          </section>

          <p className="mt-6 rounded-xl border border-border/70 bg-secondary/20 px-4 py-3 text-[11px] leading-5 text-muted-foreground">
            This dossier is loaded from the permission-filtered employee endpoint. Sensitive compensation access remains audited by the server.
            {record.version ? ` Record version ${num(record.version)}.` : ""}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DirectoryFilter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="relative block min-w-0 flex-1 sm:flex-none">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full appearance-none rounded-xl border border-border bg-card pl-3 pr-8 text-xs font-semibold text-muted-foreground outline-none transition hover:border-primary/40 hover:text-foreground focus:border-primary focus:ring-4 focus:ring-primary/10 sm:max-w-[150px]"
      >
        <option value="">All {label.toLowerCase()}s</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </label>
  );
}

type DirectoryRow = {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  designation: string;
  department: string;
  location: string;
  band: string | null;
  worker_class: string | null;
  manager_code: string | null;
  manager_name: string | null;
  joining_date: string | null;
  work_email: string | null;
  record_status: string;
  status: "active" | "on_leave" | "separated" | "archived";
};

const PEOPLE_CORE_TABS = [
  { id: "directory", label: "Employee Directory" },
  { id: "entities", label: "Legal Entities (SCR-001)" },
  { id: "locations", label: "Locations (SCR-002)" },
  { id: "org-chart", label: "Org Chart" },
  { id: "positions", label: "Positions (SCR-012)" },
  { id: "vault", label: "Document Vault (SCR-014)" },
  { id: "audit", label: "Audit Trail" },
] as const;

function directoryTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "active") return "success";
  if (status === "on_leave") return "warning";
  if (status === "separated") return "danger";
  return "neutral";
}

function directoryName(row: DirectoryRow): string {
  return `${row.first_name} ${row.last_name}`.trim() || row.employee_code || "Unnamed";
}

/** One node of the reporting line, as the chart endpoint returns it. */
type ReportingNode = {
  id: string;
  employeeCode: string;
  name: string;
  designation: string;
  department: string;
  reportCount: number;
  reports: ReportingNode[];
};

function toReportingNodes(value: unknown): ReportingNode[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const record = asRecord(entry);
    return {
      id: str(record.id),
      employeeCode: str(record.employeeCode),
      name: str(record.name, "Unnamed"),
      designation: str(record.designation),
      department: str(record.department),
      reportCount: num(record.reportCount),
      reports: toReportingNodes(record.reports),
    };
  });
}

/** Indentation carries the reporting depth; the list nests so screen readers follow it too. */
function ReportingBranch({ node, depth }: { node: ReportingNode; depth: number }) {
  return (
    <li>
      <div
        className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-xl border border-border/70 px-3 py-2"
        style={{ marginLeft: `${Math.min(depth, 8) * 14}px` }}
      >
        <span className="text-xs font-semibold text-foreground">{node.name}</span>
        <span className="font-mono text-[11px] text-muted-foreground">{node.employeeCode}</span>
        <span className="text-[11px] text-muted-foreground">
          {node.designation || "No designation"} · {node.department || "Unassigned"}
        </span>
        {node.reportCount > 0 && (
          <span className="text-[11px] font-semibold text-primary">{node.reportCount} report(s)</span>
        )}
      </div>
      {node.reports.length > 0 && (
        <ul className="mt-1.5 space-y-1.5">
          {node.reports.map((report) => <ReportingBranch key={report.id} node={report} depth={depth + 1} />)}
        </ul>
      )}
    </li>
  );
}

function directoryInitials(row: DirectoryRow): string {
  const first = row.first_name.trim()[0] ?? "";
  const last = row.last_name.trim()[0] ?? "";
  return `${first}${last}`.toUpperCase() || "··";
}

export function PeoplePage() {
  const [query, setQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [selectedId, setSelectedId] = useState("");
  // Phones show the directory or the selected profile, never both at once.
  // From `md` the two panes stack and this flag is ignored.
  const [mobileProfile, setMobileProfile] = useState(false);
  const [personOpen, setPersonOpen] = useState(false);
  const [dossierOpen, setDossierOpen] = useState(false);
  const [tab, setTab] = useState<string>("directory");
  const [notice, setNotice] = useState<Notice | null>(null);

  const coreState = useRegisterResource("/api/v1/people/directory?search=");
  const positionsState = useRegisterResource("/api/v1/organization/positions/register?search=");
  const vaultState = useRegisterResource("/api/v1/documents/vault?search=");
  // R-23: the chart comes from the reporting line on the employee record, not from the
  // position graph the organization tree carries, so the tree is no longer read here.
  const chartState = useRegisterResource("/api/v1/organization/reporting-chart");

  const core = useMemo(() => recordFromEnvelope(coreState.data), [coreState.data]);
  const directory = useMemo(() => listOf(core.directory) as unknown as DirectoryRow[], [core]);
  const summary = useMemo(() => asRecord(core.summary), [core]);
  const legalEntities = useMemo(() => listOf(core.legalEntities), [core]);
  const locations = useMemo(() => listOf(core.locations), [core]);
  const auditTrail = useMemo(() => listOf(core.auditTrail), [core]);
  const positions = useMemo(() => listFromEnvelope(positionsState.data), [positionsState.data]);
  const vault = useMemo(() => listFromEnvelope(vaultState.data), [vaultState.data]);
  const chart = useMemo(() => recordFromEnvelope(chartState.data), [chartState.data]);
  const chartRoots = useMemo(() => toReportingNodes(chart.roots), [chart]);
  const chartDepartments = useMemo(() => listOf(chart.departments), [chart]);

  const departmentOptions = useMemo(
    () => [...new Set(directory.map((row) => row.department).filter((value) => value && value !== "—"))].sort(),
    [directory],
  );
  const locationOptions = useMemo(
    () => [...new Set(directory.map((row) => row.location).filter((value) => value && value !== "—"))].sort(),
    [directory],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return directory.filter((row) => {
      if (departmentFilter && row.department !== departmentFilter) return false;
      if (locationFilter && row.location !== locationFilter) return false;
      if (!needle) return true;
      return [directoryName(row), row.designation, row.department, row.location, row.employee_code, row.work_email ?? "", row.band ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [departmentFilter, directory, locationFilter, query]);

  const selectedRow = (selectedId ? filtered.find((row) => row.id === selectedId) : undefined) ?? filtered[0] ?? null;
  // The dossier sheet and right rail take the shared Person shape.
  const selected = useMemo<Person | null>(() => {
    if (!selectedRow) return null;
    return toPerson({
      id: selectedRow.id,
      employeeCode: selectedRow.employee_code,
      firstName: selectedRow.first_name,
      lastName: selectedRow.last_name,
      designation: selectedRow.designation,
      department: selectedRow.department,
      location: selectedRow.location,
      category: selectedRow.worker_class ?? "",
      status: selectedRow.record_status,
      joiningDate: selectedRow.joining_date ?? "",
      workEmail: selectedRow.work_email ?? "",
    });
  }, [selectedRow]);

  function exportDirectory() {
    if (filtered.length === 0) {
      setNotice({ text: "There is nothing in the current view to export.", tone: "error" });
      return;
    }
    const csv = toCsv(
      ["Employee code", "Name", "Designation", "Band", "Worker class", "Department", "Reporting manager", "Location", "Status", "Joined", "Work email"],
      filtered.map((row) => [
        row.employee_code, directoryName(row), row.designation, row.band, row.worker_class,
        row.department, row.manager_name ?? row.manager_code, row.location, row.status, row.joining_date, row.work_email,
      ]),
    );
    setNotice(
      downloadCsv(`people-directory-${new Date().toISOString().slice(0, 10)}.csv`, csv)
        ? { text: `Exported ${filtered.length} record(s) from the current view.`, tone: "success" }
        : { text: "This directory could not be exported in your browser.", tone: "error" },
    );
  }

  const stats = [
    {
      label: "Active employees",
      value: coreState.loading ? null : num(summary.activeEmployees),
      note: coreState.loading ? "Loading…" : `${departmentOptions.length} departments · ${locationOptions.length} locations`,
    },
    {
      label: "Open headcount budget",
      value: coreState.loading || summary.sanctionedOpen === null ? null : `${num(summary.sanctionedOpen)} slots`,
      note: summary.sanctionedOpen === null ? "No approved manpower plan" : "open requisitions on the approved plan",
    },
    {
      label: "Document verification",
      value: coreState.loading || summary.verifiedPercent === null ? null : `${num(summary.verifiedPercent)}%`,
      note: summary.documentsTotal === null
        ? "Vault unavailable for this role"
        : `${num(summary.documentsVerified)} of ${num(summary.documentsTotal)} verified`,
    },
    {
      label: "Audit event stream",
      value: coreState.loading || summary.auditEvents === null ? null : num(summary.auditEvents),
      note: "append-only, immutable events",
    },
  ];

  const tabs = PEOPLE_CORE_TABS.map((entry) => ({
    ...entry,
    count:
      entry.id === "directory" ? directory.length
      : entry.id === "entities" ? legalEntities.length
      : entry.id === "locations" ? locations.length
      : entry.id === "positions" ? positions.length
      : entry.id === "vault" ? vault.length
      : entry.id === "audit" ? auditTrail.length
      : entry.id === "org-chart" ? num(chart.total)
      : null,
  }));

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageIntro
        eyebrow="People Core · System of Record"
        title="People Core (System of Record)"
        description="Single source of truth for organizational records, graph hierarchy, positions and the compliance vault."
        action={
          <span className="flex flex-wrap gap-2">
            <Link
              href="/people?section=import"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-xs font-semibold hover:border-primary/50"
            >
              Bulk Onboarding
            </Link>
            <button
              type="button"
              onClick={exportDirectory}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-xs font-semibold hover:border-primary/50"
            >
              Export CSV
            </button>
            <Button
              onClick={() => setPersonOpen(true)}
              className="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20"
            >
              <Plus className="size-4 mr-1.5" /> Add Employee
            </Button>
          </span>
        }
      />
      <RegisterNotice notice={notice} />
      {personOpen && <AddPersonModal onClose={() => setPersonOpen(false)} onCreated={() => coreState.refresh()} />}
      {dossierOpen && selected && <EmployeeDossierSheet person={selected} onOpenChange={setDossierOpen} />}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((item) => (
          <ModuleStat key={item.label} label={item.label} value={item.value} note={item.note} />
        ))}
      </div>

      <ModuleTabs tabs={tabs} active={tab} onSelect={setTab} label="People Core sections" />

      <TabPanel id="directory" active={tab}>
        <RegisterStates
          loading={coreState.loading}
          error={coreState.error}
          empty={!coreState.loading && !coreState.error && directory.length === 0}
          onRetry={coreState.refresh}
          loadingLabel="Loading the people directory…"
          errorTitle="People directory unavailable"
          emptyTitle="No employees yet"
          emptyHint="Add the first employee, or import a roster through bulk onboarding."
        />
        {!coreState.loading && !coreState.error && directory.length > 0 && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.6fr)]">
            <Surface className={`overflow-hidden p-0 ${mobileProfile ? "hidden md:block" : ""}`}>
              <div className="flex flex-col gap-3 border-b border-border/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by name, department, role…"
                    aria-label="Search the people directory"
                    className="h-10 rounded-xl border-border bg-secondary/50 pl-9 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <DirectoryFilter label="Department" value={departmentFilter} onChange={setDepartmentFilter} options={departmentOptions} />
                  <DirectoryFilter label="Location" value={locationFilter} onChange={setLocationFilter} options={locationOptions} />
                </div>
              </div>
              <p className="border-b border-border px-4 py-2 text-[11px] text-muted-foreground">
                {filtered.length} of {directory.length} record(s) in the current scope
              </p>
              <div className="max-h-[620px] overflow-auto">
                <table className="w-full min-w-[900px] text-left">
                  <thead>
                    <tr className="border-b border-border/80 bg-secondary/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      <th className="px-5 py-3">Employee</th>
                      <th className="px-3 py-3">ID / Band</th>
                      <th className="px-3 py-3">Department</th>
                      <th className="px-3 py-3">Reporting manager</th>
                      <th className="px-3 py-3">Location</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filtered.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => { setSelectedId(row.id); setMobileProfile(true); }}
                        className={`cursor-pointer transition hover:bg-secondary/40 ${selectedRow?.id === row.id ? "bg-primary/5" : ""}`}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <AvatarMark initials={directoryInitials(row)} color={accentFor(row.id)} />
                            <div>
                              <p className="text-sm font-semibold text-foreground">{directoryName(row)}</p>
                              <p className="text-xs text-muted-foreground">{row.designation}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <p className="font-mono text-xs font-semibold text-foreground">{row.employee_code}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {row.worker_class ?? "—"}{row.band ? ` · ${row.band}` : ""}
                          </p>
                        </td>
                        <td className="px-3 py-3.5 text-xs font-medium text-foreground">{row.department}</td>
                        <td className="px-3 py-3.5">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-muted-foreground">{row.manager_name ?? "Not assigned"}</span>
                            <Link
                              href="/assignment-policy-attributes"
                              onClick={(event) => event.stopPropagation()}
                              className="rounded-md border border-primary/25 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/10"
                            >
                              Change
                            </Link>
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-xs text-muted-foreground">{row.location}</td>
                        <td className="px-3 py-3.5">
                          <StatusPill tone={directoryTone(row.status)} dot>{stateLabel(row.status)}</StatusPill>
                        </td>
                        <td className="px-4 py-3.5">
                          <button
                            type="button"
                            onClick={(event) => { event.stopPropagation(); setSelectedId(row.id); setDossierOpen(true); }}
                            className="min-h-10 rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold hover:border-primary/50 sm:min-h-0"
                          >
                            View Dossier
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <div className="grid min-h-40 place-items-center px-6 text-center">
                    <div>
                      <Search className="mx-auto size-8 text-muted-foreground/60" />
                      <p className="mt-3 text-sm font-semibold text-foreground">No people found</p>
                      <p className="mt-1 text-xs text-muted-foreground">Try a name, department, role or employee code.</p>
                    </div>
                  </div>
                )}
              </div>
            </Surface>

            {selected && selectedRow ? (
              <Surface className={`overflow-hidden p-0 ${mobileProfile ? "" : "hidden md:block"}`}>
                <div className="p-5 sm:p-6">
                  <button
                    type="button"
                    onClick={() => setMobileProfile(false)}
                    className="mb-4 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold hover:border-primary/50 md:hidden"
                  >
                    <ArrowLeft className="size-4" /> Back to the directory
                  </button>
                  <AvatarMark initials={directoryInitials(selectedRow)} color={accentFor(selectedRow.id)} size="lg" />
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold tracking-tight text-foreground">{directoryName(selectedRow)}</h2>
                    <StatusPill tone={directoryTone(selectedRow.status)} dot>{stateLabel(selectedRow.status)}</StatusPill>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedRow.designation} · {selectedRow.employee_code}
                    {selectedRow.band ? ` · ${selectedRow.band}` : ""}
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-2.5">
                    {[
                      { icon: Building2, label: selectedRow.department },
                      { icon: MapPin, label: selectedRow.location },
                      { icon: CalendarDays, label: selectedRow.joining_date ? `Joined ${selectedRow.joining_date}` : "Joining date unavailable" },
                      { icon: UserCheck, label: selectedRow.manager_name ? `Reports to ${selectedRow.manager_name}` : "No reporting manager" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-secondary/40 p-2.5">
                        <item.icon className="size-4 text-primary" />
                        <span className="truncate text-xs font-medium text-foreground">{item.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link href="/employee-record" className="inline-flex min-h-10 items-center rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary/50 sm:min-h-0">Employee record</Link>
                    <Link href="/document-vault" className="inline-flex min-h-10 items-center rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary/50 sm:min-h-0">Documents</Link>
                  </div>
                  <Button onClick={() => setDossierOpen(true)} className="mt-5 h-11 w-full justify-between rounded-xl bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90">
                    Open Full Employee Dossier <ArrowRight className="size-4" />
                  </Button>
                </div>
              </Surface>
            ) : (
              <Surface className={`min-h-56 p-6 text-center ${mobileProfile ? "grid place-items-center" : "hidden md:grid md:place-items-center"}`}>
                <div>
                  <UsersRound className="mx-auto size-8 text-muted-foreground/60" />
                  <p className="mt-3 text-sm font-semibold text-foreground">No person selected</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Pick a row to see their profile and dossier.</p>
                </div>
              </Surface>
            )}
          </div>
        )}
      </TabPanel>

      <TabPanel id="entities" active={tab}>
        <Surface className="p-0">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-semibold">Legal entities</h2>
            <p className="mt-1 text-xs text-muted-foreground">Registered employers in this tenant, with the headcount employed by each.</p>
          </div>
          {legalEntities.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">No legal entities are registered for this tenant.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border/80 bg-secondary/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3">Code</th><th className="px-3 py-3">Legal name</th>
                    <th className="px-3 py-3">Currency</th><th className="px-3 py-3">Headcount</th><th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {legalEntities.map((row) => (
                    <tr key={str(row.id)}>
                      <td className="px-5 py-3 font-mono text-xs font-semibold">{str(row.code)}</td>
                      <td className="px-3 py-3 text-xs">{str(row.legal_name)}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{str(row.currency_code, "—")}</td>
                      <td className="px-3 py-3 text-xs tabular-nums">{num(row.headcount)}</td>
                      <td className="px-5 py-3"><StatusPill tone={str(row.status) === "active" ? "success" : "neutral"}>{str(row.status)}</StatusPill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Surface>
      </TabPanel>

      <TabPanel id="locations" active={tab}>
        <Surface className="p-0">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-semibold">Locations</h2>
            <p className="mt-1 text-xs text-muted-foreground">Establishments with the headcount currently deployed at each.</p>
          </div>
          {locations.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">No locations are registered for this tenant.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border/80 bg-secondary/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3">Code</th><th className="px-3 py-3">Location</th><th className="px-3 py-3">City</th>
                    <th className="px-3 py-3">State</th><th className="px-3 py-3">Establishment</th><th className="px-5 py-3">Headcount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {locations.map((row) => (
                    <tr key={str(row.id)}>
                      <td className="px-5 py-3 font-mono text-xs font-semibold">{str(row.code)}</td>
                      <td className="px-3 py-3 text-xs">{str(row.name)}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{str(row.city, "—")}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{str(row.state, "—")}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{str(row.establishment_type, "—")}</td>
                      <td className="px-5 py-3 text-xs tabular-nums">{num(row.headcount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Surface>
      </TabPanel>

      <TabPanel id="org-chart" active={tab}>
        <Surface>
          <SectionHeading
            title="Org chart"
            description={
              chartState.loading
                ? "Loading the reporting line…"
                : `${chartRoots.length} top-level reporting line(s) across ${num(chart.total)} active people`
            }
            action={<Link href="/organization" className="text-xs font-semibold text-primary hover:underline">Open organization</Link>}
          />
          <p className="mb-4 rounded-xl border border-border/70 bg-secondary/20 px-4 py-3 text-[11px] leading-5 text-muted-foreground">
            This chart is derived from the reporting manager on each employee record. Change an
            employee&apos;s reporting manager and it moves here — there is no separate hierarchy to maintain.
            {num(chart.orphans) > 0
              ? ` ${num(chart.orphans)} person(s) report to someone who is no longer active, so they appear at the top.`
              : ""}
          </p>
          {chartState.error ? (
            <p role="alert" className="text-sm text-muted-foreground">{chartState.error}</p>
          ) : chartRoots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active employees have a reporting line yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {chartRoots.map((node) => <ReportingBranch key={node.id} node={node} depth={0} />)}
            </ul>
          )}

          <div className="mt-6 border-t border-border pt-5">
            <SectionHeading title="Department-wise view" description="The same people grouped by department" />
            {chartDepartments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No departments are represented yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {chartDepartments.map((department) => (
                  <div key={str(department.department)} className="rounded-xl border border-border/70 px-3 py-2.5">
                    <p className="text-xs font-semibold text-foreground">{str(department.department)}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {num(department.headcount)} person(s) · {num(department.managers)} with reports
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Surface>
      </TabPanel>

      <TabPanel id="positions" active={tab}>
        <Surface className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <h2 className="font-semibold">Positions</h2>
              <p className="mt-1 text-xs text-muted-foreground">Sanctioned posts with their incumbent and vacancy, from the position register.</p>
            </div>
            <Link href="/position-register" className="text-xs font-semibold text-primary hover:underline">Open position register</Link>
          </div>
          {positionsState.loading ? (
            <p role="status" className="p-5 text-sm text-muted-foreground">Loading positions…</p>
          ) : positionsState.error ? (
            <p role="alert" className="p-5 text-sm text-muted-foreground">{positionsState.error}</p>
          ) : positions.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">No sanctioned posts yet.</p>
          ) : (
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border/80 bg-secondary/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3">Position</th><th className="px-3 py-3">Incumbent</th>
                    <th className="px-3 py-3">Location</th><th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {positions.map((row) => (
                    <tr key={str(row.id)}>
                      <td className="px-5 py-3 text-xs font-semibold">{str(row.code)} · {str(row.title)}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{str(row.incumbent_code, "Vacant")}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{str(row.location, "—")}</td>
                      <td className="px-5 py-3"><StatusPill tone={str(row.status) === "filled" ? "success" : str(row.status) === "frozen" ? "warning" : "info"}>{stateLabel(str(row.status))}</StatusPill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Surface>
      </TabPanel>

      <TabPanel id="vault" active={tab}>
        <Surface className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <h2 className="font-semibold">Document vault</h2>
              <p className="mt-1 text-xs text-muted-foreground">Compliance documents with their verification state and expiry.</p>
            </div>
            <Link href="/document-vault" className="text-xs font-semibold text-primary hover:underline">Open document vault</Link>
          </div>
          {vaultState.loading ? (
            <p role="status" className="p-5 text-sm text-muted-foreground">Loading documents…</p>
          ) : vaultState.error ? (
            <p role="alert" className="p-5 text-sm text-muted-foreground">{vaultState.error}</p>
          ) : vault.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">No documents in the vault yet.</p>
          ) : (
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border/80 bg-secondary/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3">Document</th><th className="px-3 py-3">Employee</th>
                    <th className="px-3 py-3">Expiry</th><th className="px-5 py-3">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {vault.map((row) => (
                    <tr key={str(row.id)}>
                      <td className="px-5 py-3 text-xs font-semibold">{str(row.title)}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{str(row.employee_code, "Template library")}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{str(row.expires_on, "—")}</td>
                      <td className="px-5 py-3"><StatusPill tone={str(row.status) === "verified" ? "success" : str(row.status) === "expired" ? "danger" : "warning"}>{stateLabel(str(row.status))}</StatusPill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Surface>
      </TabPanel>

      <TabPanel id="audit" active={tab}>
        <Surface className="p-0">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-semibold">Audit trail</h2>
            <p className="mt-1 text-xs text-muted-foreground">Append-only events for this tenant. Entries are never edited or removed.</p>
          </div>
          {auditTrail.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">No audited events recorded yet.</p>
          ) : (
            <ul className="max-h-[560px] divide-y divide-border/50 overflow-auto">
              {auditTrail.map((event) => (
                <li key={str(event.id)} className="px-5 py-3">
                  <p className="text-xs font-semibold text-foreground">
                    {str(event.action).replace(/\./g, " · ").replace(/_/g, " ")}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {str(event.entity_type, "record")} · {str(event.reason, "No reason recorded")} · {shortTimestamp(event.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Surface>
      </TabPanel>
    </div>
  );
}

type DepartmentOption = { id: string; name: string; code: string };

/** A lookup row from the organization tree, reduced to what a select needs. */
type ReferenceOption = { id: string; name: string };

/** Envelope lookup rows carry their display name in `attributes`; the code is the fallback. */
function referenceOptions(rows: unknown, fallback: string): ReferenceOption[] {
  if (!Array.isArray(rows)) return [];
  return (rows as UnknownRecord[])
    .map((row) => {
      const attributes = asRecord(row.attributes);
      return { id: str(row.id), name: str(attributes.name, str(attributes.code, fallback)) };
    })
    .filter((option) => option.id);
}
type OrganizationPosition = { id: string; departmentId: string; name: string; code: string; status: string };
type DepartmentSummary = DepartmentOption & { filled: number; positions: OrganizationPosition[] };

function CreateDepartmentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ id: string; name: string; code: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setFormError("");
    setFieldErrors({});
    try {
      const trimmedName = name.trim();
      const trimmedCode = code.trim();
      if (!trimmedName) {
        setFieldErrors({ name: "Department name is required." });
        setFormError("Fix the highlighted fields and try again.");
        return;
      }
      // businessUnitId is intentionally omitted: the server reuses the tenant's business unit.
      const body: UnknownRecord = { name: trimmedName };
      if (trimmedCode) body.code = trimmedCode;
      const outcome = await postJson("/api/v1/organization/departments", body, {
        "Idempotency-Key": newIdempotencyKey(),
      });
      if (!outcome.ok) {
        setFieldErrors(outcome.fieldErrors);
        setFormError(outcome.message);
        return;
      }
      const attributes = createdAttributes(outcome.payload);
      setCreated({ id: str(attributes.id), name: str(attributes.name, trimmedName), code: str(attributes.code) });
      onCreated();
    } finally {
      setCreating(false);
    }
  }

  return (
    <CreateModal
      title="New Department"
      description="Add a department to the current business unit."
      onClose={onClose}
    >
      {created ? (
        <div className="space-y-4">
          <FormNotice message={`Created department ${created.name}${created.code ? ` (${created.code})` : ""}.`} />
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
          >
            Done
          </button>
        </div>
      ) : (
        <form className="space-y-3" onSubmit={(event) => void submit(event)}>
          <FormAlert message={formError} />
          <ModalField label="Department name" value={name} onChange={setName} placeholder="Engineering" required error={fieldErrors.name} disabled={creating} />
          <ModalField label="Code (optional)" value={code} onChange={setCode} placeholder="Auto-generated when blank" error={fieldErrors.code} disabled={creating} />
          <SubmitButton busy={creating} busyLabel="Creating…">Create Department</SubmitButton>
        </form>
      )}
    </CreateModal>
  );
}

function CreatePositionModal({
  departments,
  locations,
  costCentres,
  positions,
  onClose,
  onCreated,
}: {
  departments: DepartmentOption[];
  locations: ReferenceOption[];
  costCentres: ReferenceOption[];
  positions: OrganizationPosition[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "");
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [costCenterId, setCostCenterId] = useState(costCentres[0]?.id ?? "");
  const [workerClass, setWorkerClass] = useState("");
  const [reportsToPositionId, setReportsToPositionId] = useState("");
  const [fte, setFte] = useState("1.00");
  const [availableFrom, setAvailableFrom] = useState(today);
  const [budgetCost, setBudgetCost] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ id: string; name: string; code: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setFormError("");
    setFieldErrors({});
    try {
      const trimmedName = name.trim();
      const trimmedCode = code.trim();
      const fteValue = Number(fte);
      const budget = budgetCost.trim();
      const localErrors: FieldErrors = {};
      if (!trimmedName) localErrors.name = "Position name is required.";
      if (!departmentId) localErrors.departmentId = "Pick a department from the live organization tree.";
      if (!locationId) localErrors.locationId = "Pick the location this post is sanctioned at.";
      if (!costCenterId) localErrors.costCenterId = "Pick the cost centre that carries this post.";
      if (!workerClass) localErrors.workerClass = "Pick the worker class.";
      if (!Number.isFinite(fteValue) || fteValue < 0.25 || fteValue > 1) localErrors.fte = "Full time equivalent must be between 0.25 and 1.00.";
      if (!availableFrom) localErrors.availableFrom = "A requisition cannot precede this date.";
      if (!effectiveFrom) localErrors.effectiveFrom = "An effective date is required.";
      if (budget && !/^\d+(\.\d{1,2})?$/.test(budget)) localErrors.budgetCostMinor = "Enter the annual budget as an amount, for example 1250000.00.";
      if (Object.keys(localErrors).length > 0) {
        setFieldErrors(localErrors);
        setFormError("Fix the highlighted fields and try again.");
        return;
      }
      // gradeId / jobProfileId are omitted: the server reuses the tenant's first grade/profile.
      const body: UnknownRecord = {
        name: trimmedName,
        departmentId,
        locationId,
        costCenterId,
        workerClass,
        fte: fteValue,
        availableFrom,
        effectiveFrom,
      };
      if (trimmedCode) body.code = trimmedCode;
      if (reportsToPositionId) body.reportsToPositionId = reportsToPositionId;
      // Money crosses the wire in minor units, so the typed major amount is converted once, here.
      if (budget) body.budgetCostMinor = Math.round(Number(budget) * 100);
      const outcome = await postJson("/api/v1/organization/positions", body, {
        "Idempotency-Key": newIdempotencyKey(),
      });
      if (!outcome.ok) {
        setFieldErrors(outcome.fieldErrors);
        setFormError(outcome.message);
        return;
      }
      const attributes = createdAttributes(outcome.payload);
      setCreated({ id: str(attributes.id), name: str(attributes.name, trimmedName), code: str(attributes.code) });
      onCreated();
    } finally {
      setCreating(false);
    }
  }

  return (
    <CreateModal
      title="Create Position"
      description="Add a position within the selected department."
      onClose={onClose}
    >
      {created ? (
        <div className="space-y-4">
          <FormNotice message={`Created position ${created.name}${created.code ? ` (${created.code})` : ""}.`} />
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
          >
            Done
          </button>
        </div>
      ) : (
        <form className="space-y-3" onSubmit={(event) => void submit(event)}>
          <FormAlert message={formError} />
          <ModalField label="Position name" value={name} onChange={setName} placeholder="Senior Press Operator" required error={fieldErrors.name} disabled={creating} />
          <ModalSelect label="Department (live organization tree)" value={departmentId} onChange={setDepartmentId} error={fieldErrors.departmentId} disabled={creating || departments.length === 0}>
            {departments.length === 0 ? (
              <option value="">No departments yet — create one first</option>
            ) : (
              departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))
            )}
          </ModalSelect>
          <ModalField label="Code (optional)" value={code} onChange={setCode} placeholder="Auto-generated when blank" error={fieldErrors.code} disabled={creating} />
          <ModalSelect label="Location" value={locationId} onChange={setLocationId} error={fieldErrors.locationId} disabled={creating || locations.length === 0}>
            {locations.length === 0 ? (
              <option value="">No locations are registered for this tenant</option>
            ) : (
              locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))
            )}
          </ModalSelect>
          <ModalSelect label="Cost centre" value={costCenterId} onChange={setCostCenterId} error={fieldErrors.costCenterId} disabled={creating || costCentres.length === 0}>
            {costCentres.length === 0 ? (
              <option value="">No cost centres are registered for this tenant</option>
            ) : (
              costCentres.map((centre) => (
                <option key={centre.id} value={centre.id}>
                  {centre.name}
                </option>
              ))
            )}
          </ModalSelect>
          <ModalSelect label="Worker class" value={workerClass} onChange={setWorkerClass} error={fieldErrors.workerClass} disabled={creating}>
            <option value="">Select…</option>
            {picklists.PL_WORKER_CLASS.values.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </ModalSelect>
          <ModalSelect label="Reports to position (optional)" value={reportsToPositionId} onChange={setReportsToPositionId} error={fieldErrors.reportsToPositionId} disabled={creating}>
            <option value="">No reporting position</option>
            {positions.map((position) => (
              <option key={position.id} value={position.id}>
                {position.code ? `${position.code} · ${position.name}` : position.name}
              </option>
            ))}
          </ModalSelect>
          <ModalField label="Full time equivalent" value={fte} onChange={setFte} placeholder="1.00" type="number" min={0.25} step="0.01" required error={fieldErrors.fte} disabled={creating} />
          <ModalField label="Available for hire from" value={availableFrom} onChange={setAvailableFrom} placeholder="" type="date" required error={fieldErrors.availableFrom} disabled={creating} />
          <ModalField label="Budgeted annual cost (optional)" value={budgetCost} onChange={setBudgetCost} placeholder="1250000.00" error={fieldErrors.budgetCostMinor} disabled={creating} />
          <ModalField label="Effective from" value={effectiveFrom} onChange={setEffectiveFrom} placeholder="" type="date" required error={fieldErrors.effectiveFrom} disabled={creating} />
          <SubmitButton busy={creating} busyLabel="Creating…">Create Position</SubmitButton>
        </form>
      )}
    </CreateModal>
  );
}

const ORGANIZATION_TABS = [
  { id: "directory", label: "Team Directory" },
  { id: "hierarchy", label: "Department Hierarchy" },
  { id: "manpower", label: "Manpower Control" },
] as const;

/**
 * Invitations are governed by membership.manage. The role list comes from the
 * live role register, so no role code is ever typed in or guessed here.
 */
function InviteTeammateModal({ onClose, onInvited }: { onClose: () => void; onInvited: (email: string) => void }) {
  const rolesState = useRegisterResource("/api/v1/roles");
  const roles = useMemo(
    () =>
      listFromEnvelope(rolesState.data)
        .map((row) => ({ code: str(row.code), name: str(row.name, str(row.code)) }))
        .filter((role) => role.code),
    [rolesState.data],
  );
  const [email, setEmail] = useState("");
  const [roleCode, setRoleCode] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [sending, setSending] = useState(false);

  // The first live role is the default until the user picks one, derived rather
  // than written back into state so the effect cannot cascade a render.
  const effectiveRole = roleCode || roles[0]?.code || "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setFormError("");
    setFieldErrors({});
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const localErrors: FieldErrors = {};
      if (!trimmedEmail) localErrors.email = "A work email address is required.";
      if (!effectiveRole) localErrors.roleCodes = "Pick a role from the live role register.";
      if (Object.keys(localErrors).length > 0) {
        setFieldErrors(localErrors);
        setFormError("Fix the highlighted fields and try again.");
        return;
      }
      // POST /api/v1/invitations schema: { email, roleCodes: string[], expiresInHours? }.
      const outcome = await postJson("/api/v1/invitations", { email: trimmedEmail, roleCodes: [effectiveRole] });
      if (!outcome.ok) {
        setFieldErrors(outcome.fieldErrors);
        setFormError(outcome.message);
        return;
      }
      onInvited(trimmedEmail);
      onClose();
    } finally {
      setSending(false);
    }
  }

  return (
    <CreateModal
      title="Invite Teammate"
      description="Send a workspace invitation against a governed role."
      onClose={onClose}
    >
      <form className="space-y-3" onSubmit={(event) => void submit(event)}>
        <FormAlert message={formError} />
        {rolesState.error && !rolesState.loading ? <FormAlert message={rolesState.error} /> : null}
        <ModalField
          label="Work email"
          value={email}
          onChange={setEmail}
          placeholder="name@company.com"
          type="email"
          required
          error={fieldErrors.email}
          disabled={sending}
        />
        <ModalSelect
          label="Role (live role register)"
          value={effectiveRole}
          onChange={setRoleCode}
          error={fieldErrors.roleCodes}
          disabled={sending || rolesState.loading || roles.length === 0}
        >
          {roles.length === 0 ? (
            <option value="">{rolesState.loading ? "Loading roles…" : "No roles available to you"}</option>
          ) : (
            roles.map((role) => (
              <option key={role.code} value={role.code}>
                {role.name} · {role.code}
              </option>
            ))
          )}
        </ModalSelect>
        <SubmitButton busy={sending} busyLabel="Inviting…">Send Invitation</SubmitButton>
      </form>
    </CreateModal>
  );
}

export function OrganizationPage() {
  const [tab, setTab] = useState<string>("directory");
  const [query, setQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [positionOpen, setPositionOpen] = useState(false);
  const [departmentOpen, setDepartmentOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Today's window for the attendance roll-up. Held in state so the resource
  // path stays stable for the lifetime of the page rather than refetching.
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  const directoryState = useRegisterResource("/api/v1/people/directory?search=");
  const attendanceState = useRegisterResource(`/api/v1/attendance/team-summary?from=${today}&to=${today}`);
  const treeState = useRegisterResource("/api/v1/organization/tree");

  const core = useMemo(() => recordFromEnvelope(directoryState.data), [directoryState.data]);
  const directory = useMemo(() => listOf(core.directory) as unknown as DirectoryRow[], [core]);
  const attendance = useMemo(() => asRecord(recordFromEnvelope(attendanceState.data).summary), [attendanceState.data]);

  const tree = useMemo(() => recordFromEnvelope(treeState.data), [treeState.data]);
  const departmentOptions = useMemo<DepartmentOption[]>(() => {
    const rows = asRecord(tree).departments;
    if (!Array.isArray(rows)) return [];
    return (rows as UnknownRecord[])
      .map((row) => {
        const attributes = asRecord(row.attributes);
        return { id: str(row.id), name: str(attributes.name, "Unnamed department"), code: str(attributes.code) };
      })
      .filter((department) => department.id);
  }, [tree]);
  const positions = useMemo<OrganizationPosition[]>(() => {
    const rows = asRecord(tree).positions;
    if (!Array.isArray(rows)) return [];
    return (rows as UnknownRecord[])
      .map((row) => {
        const attributes = asRecord(row.attributes);
        return {
          id: str(row.id),
          departmentId: str(row.department_id),
          name: str(attributes.name, "Unnamed position"),
          code: str(attributes.code),
          status: str(row.record_status, "active"),
        };
      })
      .filter((position) => position.id);
  }, [tree]);
  const locationOptions = useMemo<ReferenceOption[]>(() => referenceOptions(tree.locations, "Unnamed location"), [tree]);
  const costCentreOptions = useMemo<ReferenceOption[]>(() => referenceOptions(tree.costCentres, "Unnamed cost centre"), [tree]);
  const departments = useMemo<DepartmentSummary[]>(() => {
    const headcountRows = Array.isArray(tree.headcount) ? tree.headcount as UnknownRecord[] : [];
    const headcountByName = new Map(
      headcountRows.map((row) => [str(row.name).trim().toLowerCase(), num(row.headcount)]),
    );
    const positionsByDepartment = new Map<string, OrganizationPosition[]>();
    for (const position of positions) {
      const current = positionsByDepartment.get(position.departmentId) ?? [];
      current.push(position);
      positionsByDepartment.set(position.departmentId, current);
    }
    const knownNames = new Set(departmentOptions.map((department) => department.name.trim().toLowerCase()));
    const structured = departmentOptions.map((department) => ({
      ...department,
      filled: headcountByName.get(department.name.trim().toLowerCase()) ?? 0,
      positions: positionsByDepartment.get(department.id) ?? [],
    }));
    const legacy = headcountRows
      .map((row) => ({ name: str(row.name, "Unnamed department"), filled: num(row.headcount) }))
      .filter((row) => !knownNames.has(row.name.trim().toLowerCase()))
      .map((row) => ({ id: `legacy:${row.name}`, name: row.name, code: "", filled: row.filled, positions: [] }));
    return [...structured, ...legacy];
  }, [departmentOptions, positions, tree.headcount]);
  const totalFilled = departments.reduce((total, department) => total + department.filled, 0);
  const openPositions = positions.filter((position) => !["filled", "archived", "inactive"].includes(position.status)).length;
  const maxFilled = Math.max(1, ...departments.map((department) => department.filled));

  const directoryDepartments = useMemo(
    () => [...new Set(directory.map((row) => row.department).filter((value) => value && value !== "—"))].sort(),
    [directory],
  );
  const directoryLocations = useMemo(
    () => [...new Set(directory.map((row) => row.location).filter((value) => value && value !== "—"))].sort(),
    [directory],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return directory.filter((row) => {
      if (departmentFilter && row.department !== departmentFilter) return false;
      if (!needle) return true;
      return [directoryName(row), row.designation, row.department, row.location, row.employee_code]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [departmentFilter, directory, query]);

  // Attendance is scoped to the viewer's own team, so it can legitimately be
  // absent. It reads as "—" rather than a zero that would look like a fact.
  const attendanceUnavailable = attendanceState.loading || Boolean(attendanceState.error) || attendanceState.data === null;
  const onLeaveCount = directory.filter((row) => row.status === "on_leave").length;

  const stats = [
    {
      label: "Total teammates",
      value: directoryState.loading || directoryState.error ? null : directory.length,
      note: directoryState.loading ? "Loading the directory…" : `${directoryDepartments.length} departments in view`,
    },
    {
      label: "Active in shift",
      value: attendanceUnavailable ? null : num(attendance.present),
      note: attendanceState.loading
        ? "Loading today's attendance…"
        : attendanceState.error
          ? "Team attendance summary unavailable"
          : `present on ${today} · ${num(attendance.absent)} absent`,
    },
    {
      label: "On leave",
      value: directoryState.loading || directoryState.error ? null : onLeaveCount,
      note: "flagged on leave in the people record — attendance reports no separate leave count",
    },
    {
      label: "Locations covered",
      value: directoryState.loading || directoryState.error ? null : directoryLocations.length,
      note: directoryLocations.length > 0 ? directoryLocations.slice(0, 3).join(" · ") : "No location recorded yet",
    },
  ];

  const tabs = ORGANIZATION_TABS.map((entry) => ({
    ...entry,
    count:
      entry.id === "directory" ? directory.length
      : entry.id === "hierarchy" ? departments.length
      : entry.id === "manpower" ? positions.length
      : null,
  }));

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageIntro
        eyebrow={treeState.loading ? "Organization" : `Organization · ${departments.length} departments · ${positions.length} positions`}
        title="My Team & Pod Directory"
        description="Connect with colleagues across teams, view availability from live attendance, and the reporting structure."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setInviteOpen(true)}
              className="h-10 rounded-xl px-4 text-xs font-bold"
            >
              <UserPlus className="size-4 mr-1.5" /> Invite Teammate
            </Button>
            <Button
              variant="outline"
              onClick={() => setDepartmentOpen(true)}
              className="h-10 rounded-xl px-4 text-xs font-bold"
            >
              <Plus className="size-4 mr-1.5" /> New Department
            </Button>
            <Button
              onClick={() => setPositionOpen(true)}
              className="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="size-4 mr-1.5" /> Create Position
            </Button>
          </div>
        }
      />
      <RegisterNotice notice={notice} />
      {inviteOpen && (
        <InviteTeammateModal
          onClose={() => setInviteOpen(false)}
          onInvited={(email) => setNotice({ text: `Invitation created for ${email}.`, tone: "success" })}
        />
      )}
      {departmentOpen && (
        <CreateDepartmentModal onClose={() => setDepartmentOpen(false)} onCreated={() => treeState.refresh()} />
      )}
      {positionOpen && (
        <CreatePositionModal
          departments={departmentOptions}
          locations={locationOptions}
          costCentres={costCentreOptions}
          positions={positions}
          onClose={() => setPositionOpen(false)}
          onCreated={() => treeState.refresh()}
        />
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((item) => (
          <ModuleStat key={item.label} label={item.label} value={item.value} note={item.note} />
        ))}
      </div>

      <ModuleTabs tabs={tabs} active={tab} onSelect={setTab} label="Team and organization sections" />

      <TabPanel id="directory" active={tab}>
        <RegisterStates
          loading={directoryState.loading}
          error={directoryState.error}
          empty={!directoryState.loading && !directoryState.error && directory.length === 0}
          onRetry={directoryState.refresh}
          loadingLabel="Loading your team directory…"
          errorTitle="Team directory unavailable"
          emptyTitle="No teammates yet"
          emptyHint="Add an employee, or invite a teammate to the workspace, to populate this directory."
        />
        {!directoryState.loading && !directoryState.error && directory.length > 0 && (
          <Surface className="p-0">
            <div className="flex flex-col gap-3 border-b border-border/80 p-4">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name, designation, department, location or code…"
                  aria-label="Search the team directory"
                  className="h-10 rounded-xl border-border bg-secondary/50 pl-9 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary"
                />
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by department">
                {["All", ...directoryDepartments].map((option) => {
                  const selected = option === "All" ? departmentFilter === "" : departmentFilter === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setDepartmentFilter(option === "All" ? "" : option)}
                      className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                        selected
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {filtered.length} of {directory.length} teammate(s) in the current scope
              </p>
            </div>
            {filtered.length === 0 ? (
              <div className="grid min-h-40 place-items-center px-6 py-10 text-center">
                <div>
                  <Search className="mx-auto size-8 text-muted-foreground/60" />
                  <p className="mt-3 text-sm font-semibold text-foreground">No teammates found</p>
                  <p className="mt-1 text-xs text-muted-foreground">Try a name, designation, department, location or employee code.</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((row) => {
                  const email = row.work_email ?? "";
                  const manager = row.manager_name ?? row.manager_code ?? "";
                  const grade = [row.band, row.worker_class].filter(Boolean).join(" · ");
                  return (
                    <article key={row.id} className="rounded-2xl border border-border/80 bg-card p-4">
                      <div className="flex items-start gap-3">
                        <AvatarMark initials={directoryInitials(row)} color={accentFor(row.id)} size="lg" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-foreground">{directoryName(row)}</p>
                          <p className="truncate text-xs text-muted-foreground">{row.designation}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className="rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold text-primary">
                              {row.department}
                            </span>
                            <StatusPill tone={directoryTone(row.status)} dot>{stateLabel(row.status)}</StatusPill>
                          </div>
                        </div>
                      </div>
                      <dl className="mt-4 space-y-2 border-t border-border/60 pt-3">
                        <div className="flex items-center gap-2">
                          <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                          <dt className="sr-only">Location</dt>
                          <dd className="truncate text-[11px] text-muted-foreground">{row.location}</dd>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="size-3.5 shrink-0 text-muted-foreground" />
                          <dt className="sr-only">Work email</dt>
                          <dd className="truncate text-[11px] text-muted-foreground">{email || "No work email on record"}</dd>
                        </div>
                        <div className="flex items-center gap-2">
                          <UserCheck className="size-3.5 shrink-0 text-muted-foreground" />
                          <dt className="sr-only">Reporting manager</dt>
                          <dd className="truncate text-[11px] text-muted-foreground">
                            {manager ? `Reports to ${manager}` : "No reporting manager"}
                          </dd>
                        </div>
                        <div className="flex items-center gap-2">
                          <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                          <dt className="sr-only">Band and worker class</dt>
                          <dd className="truncate font-mono text-[11px] text-muted-foreground">
                            {row.employee_code}{grade ? ` · ${grade}` : ""}
                          </dd>
                        </div>
                      </dl>
                      <div className="mt-4 flex gap-2">
                        {email ? (
                          <a
                            href={`mailto:${email}`}
                            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border text-[11px] font-semibold hover:border-primary/50 sm:h-9"
                          >
                            <Mail className="size-3.5" /> Email
                          </a>
                        ) : (
                          <span
                            aria-disabled="true"
                            title="No work email on record"
                            className="inline-flex h-10 flex-1 cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-border text-[11px] font-semibold text-muted-foreground opacity-60 sm:h-9"
                          >
                            <Mail className="size-3.5" /> Email
                          </span>
                        )}
                        <Link
                          href="/employee-record"
                          className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-border text-[11px] font-semibold hover:border-primary/50 sm:h-9"
                        >
                          View record
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </Surface>
        )}
      </TabPanel>

      <TabPanel id="hierarchy" active={tab}>
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          {treeState.loading && (
            <Surface className="p-5 md:col-span-4">
              <p role="status" className="text-sm font-semibold text-foreground">Loading…</p>
              <p className="mt-1 text-xs text-muted-foreground">Fetching the organization tree.</p>
            </Surface>
          )}
          {!treeState.loading && treeState.error && departments.length === 0 && (
            <Surface className="p-5 md:col-span-4">
              <p role="alert" className="text-sm font-semibold text-foreground">Organization tree unavailable</p>
              <p className="mt-1 text-xs text-muted-foreground">{treeState.error}</p>
            </Surface>
          )}
          {!treeState.loading && !treeState.error && departments.length === 0 && (
            <Surface className="p-5 md:col-span-4">
              <p className="text-sm font-semibold text-foreground">No departments yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Create a department to begin building the organization structure.</p>
            </Surface>
          )}
          {departments.map((department) => (
            <Surface key={department.id} className="p-5">
              <div className="flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <Building2 className="size-5" />
                </span>
                <span className="font-mono text-xs font-bold text-muted-foreground">
                  {department.positions.length} {department.positions.length === 1 ? "position" : "positions"}
                </span>
              </div>
              <p className="mt-4 text-sm font-bold text-foreground">{department.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{department.filled} people currently assigned</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(department.filled / maxFilled) * 100}%` }}
                />
              </div>
              {department.positions.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border/60 pt-3">
                  {department.positions.slice(0, 4).map((position) => (
                    <span key={position.id} className="rounded-md border border-primary/20 bg-primary/8 px-2 py-1 text-[11px] font-semibold text-foreground">
                      {position.name}
                    </span>
                  ))}
                  {department.positions.length > 4 && (
                    <span className="px-1 py-1 text-[11px] font-medium text-muted-foreground">+{department.positions.length - 4} more</span>
                  )}
                </div>
              )}
            </Surface>
          ))}
        </div>

        <Surface>
          <SectionHeading
            title="Department Hierarchy"
            description="Departments with live headcount and approved positions"
            action={
              <StatusPill tone="info">
                {treeState.loading ? "Loading…" : `${departments.length} departments · ${positions.length} positions`}
              </StatusPill>
            }
          />
          {treeState.loading ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Loading…</p>
          ) : departments.length === 0 ? (
            <div className="grid min-h-56 place-items-center px-6 text-center">
              <div>
                <Inbox className="mx-auto size-8 text-muted-foreground/60" />
                <p className="mt-3 text-sm font-semibold text-foreground">No departments yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Create a department to begin building the organization structure.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto pb-4">
              <div className="min-w-[680px]">
                <div className="mx-auto w-56 rounded-2xl border border-primary/30 bg-primary/10 p-5 text-center shadow-lg">
                  <AvatarMark initials="··" size="lg" />
                  <p className="mt-2 text-sm font-bold text-foreground">Organization</p>
                  <p className="font-mono text-xs text-muted-foreground">{totalFilled} people · {positions.length} positions</p>
                </div>
                <div className="mx-auto h-7 w-px bg-border" />
                <div className="mx-auto h-px w-[72%] bg-border" />
                <div className="grid grid-cols-4 gap-4">
                  {departments.map((department) => (
                    <div key={department.id} className="relative pt-7">
                      <span className="absolute left-1/2 top-0 h-7 w-px bg-border" />
                      <motion.div
                        whileHover={{ y: -3 }}
                        className="rounded-2xl border border-border/80 bg-secondary/30 p-4 text-center"
                      >
                        <AvatarMark initials={deptInitials(department.name)} />
                        <p className="mt-2 text-xs font-bold text-foreground">{department.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{department.filled} people · {department.positions.length} positions</p>
                        {department.positions.length > 0 ? (
                          <div className="mt-3 space-y-1.5">
                            {department.positions.slice(0, 3).map((position) => (
                              <p key={position.id} className="truncate rounded-lg border border-border bg-card px-2 py-1.5 text-[11px] font-semibold text-foreground" title={position.name}>
                                {position.name}
                              </p>
                            ))}
                            {department.positions.length > 3 && <p className="text-[11px] text-muted-foreground">+{department.positions.length - 3} more positions</p>}
                          </div>
                        ) : (
                          <p className="mt-3 rounded-lg border border-dashed border-border px-2 py-1.5 text-[11px] text-muted-foreground">No positions yet</p>
                        )}
                      </motion.div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Surface>
      </TabPanel>

      <TabPanel id="manpower" active={tab}>
        <Surface>
          <SectionHeading title="Manpower Control" description="Filled headcount vs open positions" />
          <div className="rounded-2xl border border-border/80 bg-secondary/30 p-5">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Filled Workforce</p>
            <p className="mt-2 font-mono text-4xl font-bold text-foreground">
              {treeState.loading ? "…" : totalFilled}
            </p>
            <div className="mt-3 flex items-center gap-3 font-mono text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-success" /> {totalFilled} filled</span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-warning" />{" "}
                {treeState.loading ? "Loading…" : `${openPositions} open`}
              </span>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-border/60 bg-card/60 p-4 text-left">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <Inbox className="size-4" />
              </span>
              <p className="text-xs font-bold text-foreground">No open requisitions listed</p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Approved open roles will appear here when requisition data is available.
            </p>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/80 bg-secondary/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Department</th>
                  <th className="px-3 py-3">Filled</th>
                  <th className="px-3 py-3">Positions</th>
                  <th className="px-4 py-3">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {departments.map((department) => {
                  const open = department.positions.filter((position) => !["filled", "archived", "inactive"].includes(position.status)).length;
                  return (
                    <tr key={department.id}>
                      <td className="px-4 py-3 text-xs font-semibold text-foreground">{department.name}</td>
                      <td className="px-3 py-3 text-xs tabular-nums text-muted-foreground">{department.filled}</td>
                      <td className="px-3 py-3 text-xs tabular-nums text-muted-foreground">{department.positions.length}</td>
                      <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">{open}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {departments.length === 0 && (
              <p className="px-4 py-5 text-xs text-muted-foreground">No departments to control yet.</p>
            )}
          </div>
        </Surface>
      </TabPanel>
    </div>
  );
}

type LaunchedOnboarding = { id: string; tasks: number; status: string };
type OnboardingTask = { id: string; key: string; title: string; owner: string; required: boolean; status: string };
type OnboardingCase = {
  id: string;
  status: string;
  createdAt: string;
  templateName: string;
  employee: { code: string; firstName: string; lastName: string; department: string; designation: string; joiningDate: string };
  tasks: OnboardingTask[];
  total: number;
  done: number;
  day1Ready: boolean;
};

function toOnboardingCase(row: UnknownRecord): OnboardingCase {
  const employee = asRecord(row.employee);
  const tasks = (Array.isArray(row.tasks) ? row.tasks as UnknownRecord[] : []).map((task) => ({
    id: str(task.id), key: str(task.key), title: str(task.title, "Onboarding task"),
    owner: str(task.owner, "People Ops"), required: task.required === true, status: str(task.status, "pending"),
  }));
  return {
    id: str(row.id), status: str(row.status, "active"), createdAt: str(row.createdAt),
    templateName: str(row.templateName, "Onboarding"),
    employee: {
      code: str(employee.code), firstName: str(employee.firstName), lastName: str(employee.lastName),
      department: str(employee.department), designation: str(employee.designation), joiningDate: str(employee.joiningDate),
    },
    tasks, total: num(row.total, tasks.length), done: num(row.done), day1Ready: row.day1Ready === true,
  };
}

function StartOnboardingModal({
  people,
  directoryLoading,
  directoryError,
  onClose,
  onCreated,
}: {
  people: Person[];
  directoryLoading: boolean;
  directoryError: string;
  onClose: () => void;
  onCreated: (result: LaunchedOnboarding) => void;
}) {
  const [employeeId, setEmployeeId] = useState(people[0]?.id ?? "");
  const [templateCode, setTemplateCode] = useState("DAY1-STD");
  const [candidateId, setCandidateId] = useState("");
  const [offerId, setOfferId] = useState("");
  const [actualJoiningDate, setActualJoiningDate] = useState("");
  const [deviationReason, setDeviationReason] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [launching, setLaunching] = useState(false);
  // The joining date the offer proposed; a different actual date is a decision that
  // needs a reason, so the deviation field only appears once the two disagree.
  const proposedJoining = people.find((person) => person.id === employeeId)?.joiningDate ?? "";
  const deviating = Boolean(actualJoiningDate) && Boolean(proposedJoining) && actualJoiningDate !== proposedJoining;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLaunching(true);
    setFormError("");
    setFieldErrors({});
    try {
      const trimmedTemplate = templateCode.trim() || "DAY1-STD";
      const localErrors: FieldErrors = {};
      if (!employeeId) localErrors.employeeId = "Pick an employee from the live directory.";
      if (deviating && deviationReason.trim().length < 10) {
        localErrors.joiningDeviationReason = "A joining date that differs from the offer needs a reason of at least 10 characters.";
      }
      if (Object.keys(localErrors).length > 0) {
        setFieldErrors(localErrors);
        setFormError("Fix the highlighted fields and try again.");
        return;
      }
      const outcome = await postJson("/api/v1/onboarding/instances", {
        employeeId,
        templateCode: trimmedTemplate,
        ...(candidateId.trim() ? { candidateId: candidateId.trim() } : {}),
        ...(offerId.trim() ? { offerId: offerId.trim() } : {}),
        ...(actualJoiningDate ? { actualJoiningDate } : {}),
        ...(deviating ? { joiningDeviationReason: deviationReason.trim() } : {}),
      });
      if (!outcome.ok) {
        setFieldErrors(outcome.fieldErrors);
        setFormError(
          outcome.status === 409
            ? "Onboarding already started for this employee and template."
            : outcome.message,
        );
        return;
      }
      const attributes = createdAttributes(outcome.payload);
      onCreated({ id: str(attributes.id), tasks: num(attributes.tasks), status: str(attributes.status, "active") });
      onClose();
    } finally {
      setLaunching(false);
    }
  }

  return (
    <CreateModal
      title="Start Onboarding"
      description="Create a coordinated onboarding plan for the selected employee."
      onClose={onClose}
    >
      <form className="space-y-3" onSubmit={(event) => void submit(event)}>
        <FormAlert message={formError} />
        {directoryError && !directoryLoading && people.length === 0 ? (
          <FormAlert message={directoryError} />
        ) : null}
        <ModalSelect
          label="Employee (live directory)"
          value={employeeId}
          onChange={setEmployeeId}
          error={fieldErrors.employeeId}
          disabled={launching || directoryLoading || people.length === 0}
        >
          {people.length === 0 ? (
            <option value="">{directoryLoading ? "Loading directory…" : "No employees in the directory"}</option>
          ) : (
            people.map((person) => (
              <option key={person.id} value={person.id}>
                {fullName(person)} · {person.employeeCode || "No code"}
              </option>
            ))
          )}
        </ModalSelect>
        <ModalField
          label="Template code"
          value={templateCode}
          onChange={setTemplateCode}
          placeholder="DAY1-STD"
          error={fieldErrors.templateCode}
          disabled={launching}
        />
        <ModalField
          label="Actual joining date"
          value={actualJoiningDate}
          onChange={setActualJoiningDate}
          placeholder={proposedJoining || "YYYY-MM-DD"}
          type="date"
          error={fieldErrors.actualJoiningDate}
          disabled={launching}
        />
        {deviating && (
          <ModalTextarea
            label={`Joining deviation reason (proposed ${proposedJoining})`}
            value={deviationReason}
            onChange={setDeviationReason}
            placeholder="Why is the joining date moving?"
            required
            error={fieldErrors.joiningDeviationReason}
            disabled={launching}
          />
        )}
        <label className="block text-[11px] font-medium text-foreground">
          <span className="mb-1.5 block">Candidate reference (optional)</span>
          <ReferencePicker
            endpoint="/api/v1/candidates"
            value={candidateId}
            onChange={setCandidateId}
            placeholder="Search the accepted candidate…"
            className="h-10 w-full rounded-lg border border-border bg-secondary px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary disabled:opacity-60"
          />
          {fieldErrors.candidateId && <span className="mt-1 block text-[11px] font-medium text-destructive">{fieldErrors.candidateId}</span>}
        </label>
        <label className="block text-[11px] font-medium text-foreground">
          <span className="mb-1.5 block">Offer reference (optional)</span>
          <ReferencePicker
            endpoint="/api/v1/offers"
            value={offerId}
            onChange={setOfferId}
            placeholder="Search the accepted offer…"
            className="h-10 w-full rounded-lg border border-border bg-secondary px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary disabled:opacity-60"
          />
          {fieldErrors.offerId && <span className="mt-1 block text-[11px] font-medium text-destructive">{fieldErrors.offerId}</span>}
        </label>
        <SubmitButton busy={launching} busyLabel="Launching…">Start Onboarding</SubmitButton>
      </form>
    </CreateModal>
  );
}

const ONBOARDING_TABS = [
  { id: "assets", label: "Hardware Assets & Serials" },
  { id: "letters", label: "HR Letter Studio" },
  { id: "recognition", label: "Recognition & Events" },
  { id: "chains", label: "Joining Chains" },
  { id: "milestones", label: "30-60-90 Milestones" },
  { id: "pipelines", label: "Workflow Pipelines" },
  { id: "trigger-chains", label: "Lifecycle Trigger Chains" },
] as const;

type AssetRow = {
  id: string;
  assetCode: string;
  assetType: string;
  description: string;
  serial: string;
  holderCode: string;
  holderName: string;
  condition: string;
  issuedOn: string;
  returnedOn: string;
  clearanceItem: boolean;
  status: string;
};

function toAssetRow(row: UnknownRecord): AssetRow {
  return {
    id: str(row.id),
    assetCode: str(row.asset_code),
    assetType: str(row.asset_type),
    description: str(row.description),
    serial: str(row.serial),
    holderCode: str(row.holder_code),
    holderName: str(row.holder_name),
    condition: str(row.condition),
    issuedOn: str(row.issued_on),
    returnedOn: str(row.returned_on),
    clearanceItem: row.clearance_item === true,
    status: str(row.status, "available"),
  };
}

function assetTone(status: string): "success" | "warning" | "info" | "danger" | "neutral" {
  if (status === "allocated") return "info";
  if (status === "available") return "success";
  if (status === "written_off") return "danger";
  return "neutral";
}

/** Day 30 / 60 / 90 dates computed from a recorded joining date. Nothing else is implied. */
function derivedMilestones(joiningDate: string, todayIso: string): Array<{ day: number; date: string; passed: boolean }> {
  const base = Date.parse(`${joiningDate}T00:00:00Z`);
  if (Number.isNaN(base)) return [];
  return [30, 60, 90].map((day) => {
    const date = new Date(base + day * 86_400_000).toISOString().slice(0, 10);
    return { day, date, passed: date <= todayIso };
  });
}

function ReturnAssetModal({
  asset,
  onClose,
  onReturned,
}: {
  asset: AssetRow;
  onClose: () => void;
  onReturned: (message: string) => void;
}) {
  const [condition, setCondition] = useState("good");
  const [returnedOn, setReturnedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [recoveryAmount, setRecoveryAmount] = useState("");
  const [reason, setReason] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  // Damaged and lost returns raise a recovery line on full and final; the workbook makes
  // the amount and fuller remarks mandatory for exactly those two conditions.
  const recoverable = condition === "damaged" || condition === "lost";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    setFieldErrors({});
    try {
      const localErrors: FieldErrors = {};
      const amount = recoveryAmount.trim();
      if (!condition) localErrors.condition = "Record the condition the asset came back in.";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(returnedOn)) localErrors.returnedOn = "A return date (YYYY-MM-DD) is required.";
      if (asset.issuedOn && returnedOn < asset.issuedOn) localErrors.returnedOn = `The return cannot precede the issue date (${asset.issuedOn}).`;
      if (reason.trim().length < (recoverable ? 10 : 3)) localErrors.reason = `Remarks of at least ${recoverable ? 10 : 3} characters are required.`;
      if (recoverable && !/^\d+(\.\d{1,2})?$/.test(amount)) localErrors.recoveryAmountMinor = "Enter the recovery amount; enter 0 if nothing is recovered.";
      if (Object.keys(localErrors).length > 0) {
        setFieldErrors(localErrors);
        setFormError("Fix the highlighted fields and try again.");
        return;
      }
      const outcome = await postJson(`/api/v1/assets/register/${encodeURIComponent(asset.id)}/return`, {
        condition: condition.trim(),
        returnedOn,
        ...(amount ? { recoveryAmountMinor: Math.round(Number(amount) * 100) } : {}),
        reason: reason.trim(),
      });
      if (!outcome.ok) {
        setFieldErrors(outcome.fieldErrors);
        setFormError(outcome.message);
        return;
      }
      onReturned(`${asset.assetCode || "Asset"} marked returned on ${returnedOn}.`);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <CreateModal
      title="Mark Returned"
      description={`Close custody for ${asset.assetCode || "this asset"}${asset.serial ? ` (serial ${asset.serial})` : ""}.`}
      onClose={onClose}
    >
      <form className="space-y-3" onSubmit={(event) => void submit(event)}>
        <FormAlert message={formError} />
        <ModalSelect label="Condition on return" value={condition} onChange={setCondition} error={fieldErrors.condition} disabled={saving}>
          {picklists.PL_ASSET_RETURN_CONDITION.values.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {entry.label}
            </option>
          ))}
        </ModalSelect>
        <ModalField
          label="Returned on"
          value={returnedOn}
          onChange={setReturnedOn}
          placeholder="YYYY-MM-DD"
          type="date"
          required
          error={fieldErrors.returnedOn}
          disabled={saving}
        />
        {recoverable && (
          <ModalField
            label="Recovery amount"
            value={recoveryAmount}
            onChange={setRecoveryAmount}
            placeholder="0.00"
            required
            error={fieldErrors.recoveryAmountMinor}
            disabled={saving}
          />
        )}
        <ModalTextarea
          label={recoverable ? "Remarks (min 10 characters)" : "Remarks"}
          value={reason}
          onChange={setReason}
          placeholder="Why is this asset coming back?"
          required
          error={fieldErrors.reason}
          disabled={saving}
        />
        <SubmitButton busy={saving} busyLabel="Recording…">Record Return</SubmitButton>
      </form>
    </CreateModal>
  );
}

function AllocateAssetModal({
  assets,
  people,
  directoryLoading,
  onClose,
  onAllocated,
}: {
  assets: AssetRow[];
  people: Person[];
  directoryLoading: boolean;
  onClose: () => void;
  onAllocated: (message: string) => void;
}) {
  const allocatable = assets.filter((asset) => asset.status !== "allocated");
  const [assetId, setAssetId] = useState(allocatable[0]?.id ?? "");
  const [employeeId, setEmployeeId] = useState(people[0]?.id ?? "");
  const [issuedOn, setIssuedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [conditionAtIssue, setConditionAtIssue] = useState("new");
  const [expectedReturn, setExpectedReturn] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [reason, setReason] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    setFieldErrors({});
    try {
      const localErrors: FieldErrors = {};
      if (!assetId) localErrors.assetId = "Pick an asset that is not already allocated.";
      if (!employeeId) localErrors.employeeId = "Pick an employee from the live directory.";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(issuedOn)) localErrors.issuedOn = "An issue date (YYYY-MM-DD) is required.";
      if (expectedReturn && expectedReturn < issuedOn) localErrors.expectedReturn = "The expected return cannot precede the issue date.";
      if (reason.trim().length < 3) localErrors.reason = "A reason of at least 3 characters is required.";
      if (Object.keys(localErrors).length > 0) {
        setFieldErrors(localErrors);
        setFormError("Fix the highlighted fields and try again.");
        return;
      }
      const outcome = await postJson(`/api/v1/assets/register/${encodeURIComponent(assetId)}/allocate`, {
        employeeId,
        issuedOn,
        conditionAtIssue,
        acknowledgedByEmployee: acknowledged,
        ...(expectedReturn ? { expectedReturn } : {}),
        reason: reason.trim(),
      });
      if (!outcome.ok) {
        setFieldErrors(outcome.fieldErrors);
        setFormError(outcome.message);
        return;
      }
      const asset = allocatable.find((row) => row.id === assetId);
      onAllocated(`${asset?.assetCode || "Asset"} allocated on ${issuedOn}.`);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <CreateModal
      title="Allocate Hardware Asset"
      description="Issue a serialised asset from the register and open a custody row."
      onClose={onClose}
    >
      <form className="space-y-3" onSubmit={(event) => void submit(event)}>
        <FormAlert message={formError} />
        <ModalSelect
          label="Asset (available in the register)"
          value={assetId}
          onChange={setAssetId}
          error={fieldErrors.assetId}
          disabled={saving || allocatable.length === 0}
        >
          {allocatable.length === 0 ? (
            <option value="">No unallocated assets in the register</option>
          ) : (
            allocatable.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.assetCode || "No tag"} · {asset.assetType || "Asset"}{asset.serial ? ` · ${asset.serial}` : ""}
              </option>
            ))
          )}
        </ModalSelect>
        <ModalSelect
          label="Employee (live directory)"
          value={employeeId}
          onChange={setEmployeeId}
          error={fieldErrors.employeeId}
          disabled={saving || directoryLoading || people.length === 0}
        >
          {people.length === 0 ? (
            <option value="">{directoryLoading ? "Loading directory…" : "No employees in the directory"}</option>
          ) : (
            people.map((person) => (
              <option key={person.id} value={person.id}>
                {fullName(person)} · {person.employeeCode || "No code"}
              </option>
            ))
          )}
        </ModalSelect>
        <ModalField
          label="Issued on"
          value={issuedOn}
          onChange={setIssuedOn}
          placeholder="YYYY-MM-DD"
          type="date"
          required
          error={fieldErrors.issuedOn}
          disabled={saving}
        />
        <ModalSelect label="Condition at issue" value={conditionAtIssue} onChange={setConditionAtIssue} error={fieldErrors.conditionAtIssue} disabled={saving}>
          {picklists.PL_ASSET_CONDITION.values.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {entry.label}
            </option>
          ))}
        </ModalSelect>
        <ModalField
          label="Expected return date (optional)"
          value={expectedReturn}
          onChange={setExpectedReturn}
          placeholder="YYYY-MM-DD"
          type="date"
          error={fieldErrors.expectedReturn}
          disabled={saving}
        />
        <label className="flex items-center gap-2 text-[11px] font-medium text-foreground">
          <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} disabled={saving} className="size-4" />
          Employee has acknowledged receipt (otherwise it stays on the chase list)
        </label>
        <ModalTextarea
          label="Reason"
          value={reason}
          onChange={setReason}
          placeholder="Why is this asset being issued?"
          required
          error={fieldErrors.reason}
          disabled={saving}
        />
        <SubmitButton busy={saving} busyLabel="Allocating…">Allocate Asset</SubmitButton>
      </form>
    </CreateModal>
  );
}

export function OnboardingPage() {
  const [tab, setTab] = useState<string>("assets");
  const [launchOpen, setLaunchOpen] = useState(false);
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [returnAsset, setReturnAsset] = useState<AssetRow | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [completingId, setCompletingId] = useState("");
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  const peopleState = useRegisterResource("/api/v1/people?search=&page=1&pageSize=100");
  const casesState = useRegisterResource("/api/v1/onboarding/instances");
  const assetsState = useRegisterResource("/api/v1/assets/register?search=");
  const lettersState = useRegisterResource("/api/v1/letters/register?search=");
  const recognitionState = useRegisterResource("/api/v1/recognition-events");
  const chainState = useRegisterResource("/api/v1/onboarding/joining-chain?search=");

  const people = useMemo(
    () => listFromEnvelope(peopleState.data).map(toPerson).filter((person) => person.id),
    [peopleState.data],
  );
  const cases = useMemo(
    () => listFromEnvelope(casesState.data).map(toOnboardingCase).filter((item) => item.id),
    [casesState.data],
  );
  const assets = useMemo(
    () => listFromEnvelope(assetsState.data).map(toAssetRow).filter((asset) => asset.id),
    [assetsState.data],
  );
  // Templates lead the letter studio, then issued letters, each newest first.
  const letters = useMemo(() => {
    const rows = listFromEnvelope(lettersState.data);
    return [...rows].sort((left, right) => {
      const leftTemplate = str(left.kind) === "template" ? 0 : 1;
      const rightTemplate = str(right.kind) === "template" ? 0 : 1;
      if (leftTemplate !== rightTemplate) return leftTemplate - rightTemplate;
      return str(left.letter).localeCompare(str(right.letter));
    });
  }, [lettersState.data]);
  const recognition = useMemo(() => listFromEnvelope(recognitionState.data), [recognitionState.data]);
  const chains = useMemo(() => listFromEnvelope(chainState.data), [chainState.data]);

  const selected = cases.find((item) => item.id === selectedId) ?? cases[0] ?? null;
  const readiness = selected && selected.total > 0 ? Math.round((selected.done / selected.total) * 100) : 0;
  const requiredRemaining = selected?.tasks.filter((task) => task.required && task.status !== "done").length ?? 0;
  const selectedName = selected
    ? `${selected.employee.firstName} ${selected.employee.lastName}`.trim() || "New joiner"
    : "";

  const joiners = useMemo(
    () =>
      chains
        .map((row) => ({
          id: str(row.id),
          name: str(row.employee_name, str(row.employee_code, "Joiner")),
          code: str(row.employee_code),
          department: str(row.department, "—"),
          joiningDate: str(row.joining_date),
          milestones: derivedMilestones(str(row.joining_date), today),
        }))
        .filter((joiner) => joiner.milestones.length > 0),
    [chains, today],
  );

  async function completeTask(taskId: string) {
    setCompletingId(taskId);
    try {
      const outcome = await postJson(`/api/v1/onboarding/tasks/${encodeURIComponent(taskId)}/complete`, {});
      if (!outcome.ok) {
        setNotice({ text: outcome.message, tone: "error" });
        return;
      }
      setNotice({ text: "Task completed. Onboarding readiness has been updated.", tone: "success" });
      casesState.refresh();
      chainState.refresh();
    } finally {
      setCompletingId("");
    }
  }

  const allocatedCount = assets.filter((asset) => asset.status === "allocated").length;
  const tabs = ONBOARDING_TABS.map((entry) => ({
    ...entry,
    count:
      entry.id === "assets" ? assets.length
      : entry.id === "letters" ? letters.length
      : entry.id === "recognition" ? recognition.length
      : entry.id === "chains" ? chains.length
      : entry.id === "milestones" ? joiners.length
      : null,
  }));

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageIntro
        eyebrow="Lifecycle"
        title="Onboarding, Assets, Letters & Recognition"
        description="Hardware serial asset tracking, HR letter merge studio, and employee recognition awards."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setAllocateOpen(true)}
              className="h-10 rounded-xl px-4 text-xs font-bold"
            >
              <Plus className="size-4 mr-1.5" /> Allocate Hardware Asset
            </Button>
            <Button
              onClick={() => setLaunchOpen(true)}
              className="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            >
              <UserPlus className="size-4 mr-1.5" /> Start Onboarding
            </Button>
          </div>
        }
      />
      <RegisterNotice notice={notice} />
      {launchOpen && (
        <StartOnboardingModal
          people={people}
          directoryLoading={peopleState.loading}
          directoryError={peopleState.error}
          onClose={() => setLaunchOpen(false)}
          onCreated={(result) => {
            setSelectedId(result.id);
            setTab("chains");
            setNotice({ text: `Onboarding started with ${result.tasks} tasks.`, tone: "success" });
            casesState.refresh();
            chainState.refresh();
          }}
        />
      )}
      {allocateOpen && (
        <AllocateAssetModal
          assets={assets}
          people={people}
          directoryLoading={peopleState.loading}
          onClose={() => setAllocateOpen(false)}
          onAllocated={(message) => {
            setNotice({ text: message, tone: "success" });
            assetsState.refresh();
          }}
        />
      )}
      {returnAsset && (
        <ReturnAssetModal
          asset={returnAsset}
          onClose={() => setReturnAsset(null)}
          onReturned={(message) => {
            setNotice({ text: message, tone: "success" });
            assetsState.refresh();
          }}
        />
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <ModuleStat
          label="Assets on the register"
          value={assetsState.loading || assetsState.error ? null : assets.length}
          note={`${allocatedCount} currently allocated`}
        />
        <ModuleStat
          label="Letters and templates"
          value={lettersState.loading || lettersState.error ? null : letters.length}
          note="templates and issued letters"
        />
        <ModuleStat
          label="Joining chains"
          value={chainState.loading || chainState.error ? null : chains.length}
          note="joiners with a Day-1 chain"
        />
        <ModuleStat
          label="Recognition events"
          value={recognitionState.loading || recognitionState.error ? null : recognition.length}
          note="recorded awards"
        />
      </div>

      <ModuleTabs tabs={tabs} active={tab} onSelect={setTab} label="Onboarding and lifecycle sections" />

      <TabPanel id="assets" active={tab}>
        <RegisterStates
          loading={assetsState.loading}
          error={assetsState.error}
          empty={!assetsState.loading && !assetsState.error && assets.length === 0}
          onRetry={assetsState.refresh}
          loadingLabel="Loading the asset register…"
          errorTitle="Asset register unavailable"
          emptyTitle="No assets on the register"
          emptyHint="Assets appear here once hardware is catalogued with a serial number."
        />
        {!assetsState.loading && !assetsState.error && assets.length > 0 && (
          <Surface className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h2 className="font-semibold">Hardware assets &amp; serials</h2>
                <p className="mt-1 text-xs text-muted-foreground">Serial-tracked equipment with its current holder and custody dates.</p>
              </div>
              <Link href="/asset-register" className="text-xs font-semibold text-primary hover:underline">Open asset register</Link>
            </div>
            <div className="max-h-[620px] overflow-auto">
              <table className="w-full min-w-[980px] text-left">
                <thead>
                  <tr className="border-b border-border/80 bg-secondary/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3">Asset Tag</th>
                    <th className="px-3 py-3">Equipment &amp; Model</th>
                    <th className="px-3 py-3">Serial Number</th>
                    <th className="px-3 py-3">Assigned To</th>
                    <th className="px-3 py-3">Handover Date</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {assets.map((asset) => (
                    <tr key={asset.id} className="transition hover:bg-secondary/40">
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-foreground">{asset.assetCode || "—"}</td>
                      <td className="px-3 py-3.5">
                        <p className="text-xs font-semibold text-foreground">{asset.assetType || "—"}</p>
                        <p className="text-[11px] text-muted-foreground">{asset.description || "No model recorded"}</p>
                      </td>
                      <td className="px-3 py-3.5 font-mono text-[11px] text-muted-foreground">{asset.serial || "—"}</td>
                      <td className="px-3 py-3.5">
                        <p className="text-xs text-foreground">{asset.holderName || "Unassigned"}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">{asset.holderCode || "—"}</p>
                      </td>
                      <td className="px-3 py-3.5 text-xs text-muted-foreground">
                        {asset.issuedOn || "—"}
                        {asset.returnedOn ? <span className="block text-[10px]">returned {asset.returnedOn}</span> : null}
                      </td>
                      <td className="px-3 py-3.5">
                        <StatusPill tone={assetTone(asset.status)} dot>{stateLabel(asset.status)}</StatusPill>
                      </td>
                      <td className="px-4 py-3.5">
                        {asset.status === "allocated" ? (
                          <button
                            type="button"
                            onClick={() => setReturnAsset(asset)}
                            className="min-h-10 rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold hover:border-primary/50 sm:min-h-0"
                          >
                            Mark Returned
                          </button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">No custody open</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Surface>
        )}
      </TabPanel>

      <TabPanel id="letters" active={tab}>
        <LetterStudioTab />

        <SectionHeading
          title="Issued letters"
          description="The register behind the studio: every template on file and every letter already issued from one."
        />
        <RegisterStates
          loading={lettersState.loading}
          error={lettersState.error}
          empty={!lettersState.loading && !lettersState.error && letters.length === 0}
          onRetry={lettersState.refresh}
          loadingLabel="Loading the letter register…"
          errorTitle="Letter register unavailable"
          emptyTitle="No letter templates yet"
          emptyHint="Templates and issued letters appear here once the letter register is populated."
        />
        {!lettersState.loading && !lettersState.error && letters.length > 0 && (
          <Surface className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h2 className="font-semibold">HR letter studio</h2>
                <p className="mt-1 text-xs text-muted-foreground">Approved templates and the letters issued from them, with version and approver.</p>
              </div>
              <Link href="/letters-issue-register" className="text-xs font-semibold text-primary hover:underline">Open letters and issue register</Link>
            </div>
            <div className="max-h-[620px] overflow-auto">
              <table className="w-full min-w-[880px] text-left">
                <thead>
                  <tr className="border-b border-border/80 bg-secondary/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3">Letter</th>
                    <th className="px-3 py-3">Kind</th>
                    <th className="px-3 py-3">Reference</th>
                    <th className="px-3 py-3">Employee</th>
                    <th className="px-3 py-3">Version</th>
                    <th className="px-3 py-3">Effective</th>
                    <th className="px-3 py-3">Approver</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {letters.map((row) => {
                    const template = str(row.kind) === "template";
                    return (
                      <tr key={str(row.id)} className="transition hover:bg-secondary/40">
                        <td className="px-5 py-3.5 text-xs font-semibold text-foreground">{str(row.letter, "Untitled letter")}</td>
                        <td className="px-3 py-3.5">
                          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${template ? "border-primary/25 bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}>
                            {template ? "Template" : "Issued"}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 font-mono text-[11px] text-muted-foreground">{str(row.reference, "—")}</td>
                        <td className="px-3 py-3.5 text-xs text-muted-foreground">
                          {str(row.employee_name) || str(row.employee_code) || "Template library"}
                        </td>
                        <td className="px-3 py-3.5 font-mono text-[11px] text-muted-foreground">{str(row.version, "—")}</td>
                        <td className="px-3 py-3.5 text-xs text-muted-foreground">{str(row.effective_date, "—")}</td>
                        <td className="px-3 py-3.5 text-xs text-muted-foreground">{str(row.approver, "—")}</td>
                        <td className="px-5 py-3.5">
                          <StatusPill tone={str(row.status) === "active" || str(row.status) === "issued" ? "success" : str(row.status) === "draft" ? "warning" : "neutral"}>
                            {stateLabel(str(row.status))}
                          </StatusPill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Surface>
        )}
      </TabPanel>

      <TabPanel id="recognition" active={tab}>
        <RecognitionEventsTab />

        <SectionHeading
          title="Recognition register"
          description="The awards already recorded on the recognition feed, newest first."
        />
        <RegisterStates
          loading={recognitionState.loading}
          error={recognitionState.error}
          empty={!recognitionState.loading && !recognitionState.error && recognition.length === 0}
          onRetry={recognitionState.refresh}
          loadingLabel="Loading recognition events…"
          errorTitle="Recognition events unavailable"
          emptyTitle="No recognition recorded yet"
          emptyHint="Awards appear here once a teammate is recognised. Nothing is shown until then."
        />
        {!recognitionState.loading && !recognitionState.error && recognition.length > 0 && (
          <Surface className="p-0">
            <div className="border-b border-border px-5 py-4">
              <h2 className="font-semibold">Recognition &amp; events</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Recorded awards with their citation and points. The recognition feed stores the citation and points only, so no
                recipient name is shown.
              </p>
            </div>
            <ul className="max-h-[620px] divide-y divide-border/50 overflow-auto">
              {recognition.map((row) => {
                const attributes = asRecord(row.attributes);
                return (
                  <li key={str(row.id)} className="flex items-start gap-3 px-5 py-4">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                      <Medal className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">{str(attributes.message, "Recognition recorded")}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {num(attributes.points)} points · {shortTimestamp(row.created_at)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Surface>
        )}
      </TabPanel>

      <TabPanel id="chains" active={tab}>
        <RegisterStates
          loading={chainState.loading}
          error={chainState.error}
          empty={!chainState.loading && !chainState.error && chains.length === 0 && cases.length === 0}
          onRetry={chainState.refresh}
          loadingLabel="Loading joining chains…"
          errorTitle="Joining chain queue unavailable"
          emptyTitle="No joining chains yet"
          emptyHint="Start onboarding for a joiner to open their Day-1 chain."
        />

        {chains.length > 0 && (
          <Surface className="mb-6 p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h2 className="font-semibold">Joining chain queue</h2>
                <p className="mt-1 text-xs text-muted-foreground">Every joiner with their owner, required pending steps and readiness.</p>
              </div>
              <Link href="/joining-chain-console" className="text-xs font-semibold text-primary hover:underline">Open joining chain console</Link>
            </div>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead>
                  <tr className="border-b border-border/80 bg-secondary/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3">Joiner</th>
                    <th className="px-3 py-3">Department</th>
                    <th className="px-3 py-3">Template</th>
                    <th className="px-3 py-3">Joining date</th>
                    <th className="px-3 py-3">Owner</th>
                    <th className="px-3 py-3">Progress</th>
                    <th className="px-5 py-3">Readiness</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {chains.map((row) => (
                    <tr key={str(row.id)} className="transition hover:bg-secondary/40">
                      <td className="px-5 py-3.5">
                        <p className="text-xs font-semibold text-foreground">{str(row.employee_name, "Joiner")}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">{str(row.employee_code, "—")}</p>
                      </td>
                      <td className="px-3 py-3.5 text-xs text-muted-foreground">{str(row.department, "—")}</td>
                      <td className="px-3 py-3.5 text-xs text-muted-foreground">{str(row.template_name, "—")}</td>
                      <td className="px-3 py-3.5 text-xs text-muted-foreground">{str(row.joining_date, "Not recorded")}</td>
                      <td className="px-3 py-3.5 text-xs text-muted-foreground">{str(row.owner, "—")}</td>
                      <td className="px-3 py-3.5 text-xs tabular-nums text-muted-foreground">
                        {num(row.done)}/{num(row.total)}
                        {num(row.required_pending) > 0 ? (
                          <span className="ml-1.5 text-warning">{num(row.required_pending)} required pending</span>
                        ) : null}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusPill tone={str(row.readiness) === "ready" ? "success" : "warning"} dot>
                          {stateLabel(str(row.readiness, str(row.status, "pending")))}
                        </StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Surface>
        )}

        <section className="relative mb-6 overflow-hidden rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-surface)] sm:p-7">
          <div className="pointer-events-none absolute -right-24 -top-28 size-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <AiLabel>Lifecycle Orchestration</AiLabel>
              <h2 className="mt-4 text-2xl font-bold tracking-[-0.03em] text-foreground sm:text-3xl">
                {casesState.loading ? "Loading onboarding cases…" : selected ? `${selectedName}'s onboarding` : "No active onboarding cases"}
              </h2>
              <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
                {selected
                  ? selected.day1Ready
                    ? "All required Day-1 work is complete. This joiner is ready to begin."
                    : `${requiredRemaining} required ${requiredRemaining === 1 ? "task" : "tasks"} remaining before Day-1 readiness.`
                  : "Start onboarding to coordinate the joiner profile, owners, and Day-1 checklist."}
              </p>
              {cases.length > 0 && (
                <label className="mt-5 block max-w-md">
                  <span className="mb-2 block font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Onboarding case
                  </span>
                  <span className="relative block">
                    <select
                      value={selected?.id ?? ""}
                      onChange={(event) => setSelectedId(event.target.value)}
                      aria-label="Select onboarding case"
                      className="h-12 w-full appearance-none rounded-xl border border-border/80 bg-background/70 py-0 pl-4 pr-11 text-sm font-semibold text-foreground shadow-sm outline-none transition hover:border-primary/40 focus:border-primary focus:ring-4 focus:ring-primary/10"
                    >
                      {cases.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.employee.firstName} {item.employee.lastName} · {item.done}/{item.total} complete
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground">
                      <ChevronDown className="size-4" />
                    </span>
                  </span>
                  {cases.length > 1 && (
                    <span className="mt-1.5 block text-[11px] text-muted-foreground">
                      {cases.length} active cases available
                    </span>
                  )}
                </label>
              )}

              {selected && (
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <StatusPill tone={selected.day1Ready ? "success" : "info"} dot>
                    {selected.day1Ready ? "Day-1 ready" : selected.status}
                  </StatusPill>
                  <span className="rounded-md border border-border/70 bg-background/45 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    {selected.templateName}
                  </span>
                  <span className="rounded-md border border-border/70 bg-background/45 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    {selected.done}/{selected.total} tasks complete
                  </span>
                </div>
              )}
            </div>
            <div
              role="progressbar"
              aria-label="Day-1 readiness"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={selected ? readiness : 0}
              className="mx-auto grid size-32 place-items-center rounded-full p-[7px] shadow-[var(--shadow-raise)] lg:mx-2"
              style={{ background: `conic-gradient(var(--primary) ${readiness}%, var(--border) ${readiness}% 100%)` }}
            >
              <div className="grid size-full place-items-center rounded-full border border-border/70 bg-card text-center">
                <div>
                  <span className="font-mono text-3xl font-bold tabular-nums text-foreground">{selected ? `${readiness}%` : "—"}</span>
                  <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Day-1 ready</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid items-start gap-6 xl:grid-cols-[0.72fr_1.28fr]">
          <Surface className="overflow-hidden p-0">
            <div className="border-b border-border/70 px-5 pt-5">
              <SectionHeading title="New Joiner Profile" description={selected?.templateName ?? "Select an onboarding case"} />
            </div>
            {selected ? (
              <div>
                <div className="flex items-center gap-4 bg-gradient-to-br from-primary/10 via-transparent to-transparent px-5 py-5">
                  <AvatarMark initials={`${selected.employee.firstName[0] ?? ""}${selected.employee.lastName[0] ?? ""}`} size="lg" />
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-foreground">{selectedName}</p>
                    <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                      {selected.employee.code || "Employee code pending"}
                    </p>
                  </div>
                </div>
                <dl className="grid divide-y divide-border/70 border-t border-border/70 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-1 xl:divide-x-0 xl:divide-y">
                  {[
                    ["Role", selected.employee.designation || "Not assigned"],
                    ["Department", selected.employee.department || "Not assigned"],
                    ["Joining date", selected.employee.joiningDate || "Not recorded"],
                  ].map(([label, value]) => (
                    <div key={label} className="px-5 py-4">
                      <dt className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
                      <dd className="mt-1.5 text-xs font-semibold text-foreground">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : (
              <div className="grid min-h-60 place-items-center px-6 py-8 text-center">
                <div><Inbox className="mx-auto size-8 text-muted-foreground/60" /><p className="mt-3 text-sm font-semibold text-foreground">No new joiners yet</p><p className="mt-1 text-xs text-muted-foreground">Start onboarding to create the first joiner plan.</p></div>
              </div>
            )}
          </Surface>

          <Surface>
            <SectionHeading
              title="Cross-Team Launch Plan"
              description={selected ? `${selected.total - selected.done} remaining · ${selected.done} complete` : "No tasks to show"}
              action={selected ? <span className="font-mono text-xs font-semibold tabular-nums text-primary">{readiness}%</span> : undefined}
            />
            {selected ? (
              <div>
                <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${readiness}%` }} />
                </div>
                <div className="space-y-2.5">
                  {selected.tasks.map((task, index) => {
                    const done = task.status === "done";
                    return (
                      <div key={task.id} className={`group flex flex-col gap-3 rounded-xl border p-3.5 transition sm:flex-row sm:items-center ${done ? "border-border/60 bg-secondary/20" : "border-border/80 bg-background/35 hover:border-primary/30 hover:bg-primary/[0.03]"}`}>
                        <span className={`grid size-9 shrink-0 place-items-center rounded-xl border ${done ? "border-primary/20 bg-primary/10 text-primary" : "border-border bg-secondary/60 text-muted-foreground"}`}>
                          {done ? <CheckCircle2 className="size-4" /> : <span className="font-mono text-[11px] font-bold tabular-nums">{String(index + 1).padStart(2, "0")}</span>}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className={`text-xs font-semibold ${done ? "text-muted-foreground" : "text-foreground"}`}>{task.title}</p>
                            {task.required && <span className="rounded bg-warning/10 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-warning">Required</span>}
                          </div>
                          <p className="mt-1 text-[11px] capitalize text-muted-foreground">Owned by {task.owner}</p>
                        </div>
                        <div className="flex items-center justify-between gap-2 sm:justify-end">
                          <StatusPill tone={done ? "success" : "warning"} dot>{done ? "Complete" : "Pending"}</StatusPill>
                          {!done && (
                            <Button size="sm" variant="outline" disabled={completingId === task.id} onClick={() => { void completeTask(task.id); }} className="h-8 rounded-lg border-primary/25 bg-primary/5 px-3 text-[11px] font-semibold text-primary hover:bg-primary/10">
                              {completingId === task.id ? <><Loader2 className="mr-1.5 size-3 animate-spin" />Saving…</> : "Mark complete"}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {selected.tasks.length > 0 && selected.done === selected.total && (
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-xs font-semibold text-primary">
                    <UserCheck className="size-4" /> All onboarding tasks are complete.
                  </div>
                )}
              </div>
            ) : (
              <div className="grid min-h-60 place-items-center px-6 py-8 text-center"><div><Inbox className="mx-auto size-8 text-muted-foreground/60" /><p className="mt-3 text-sm font-semibold text-foreground">No launch plan yet</p><p className="mt-1 text-xs text-muted-foreground">Tasks will appear when onboarding starts.</p></div></div>
            )}
          </Surface>
        </div>
      </TabPanel>

      <TabPanel id="milestones" active={tab}>
        <RegisterStates
          loading={chainState.loading}
          error={chainState.error}
          empty={!chainState.loading && !chainState.error && joiners.length === 0}
          onRetry={chainState.refresh}
          loadingLabel="Loading joiners…"
          errorTitle="Joining chain queue unavailable"
          emptyTitle="No joining dates to derive milestones from"
          emptyHint="Day 30, 60 and 90 are calculated from a recorded joining date. None of the current joiners has one."
        />
        {!chainState.loading && !chainState.error && joiners.length > 0 && (
          <Surface className="p-0">
            <div className="border-b border-border px-5 py-4">
              <h2 className="font-semibold">30-60-90 milestones</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Derived from each joiner&apos;s recorded joining date. There is no milestone register, so only the dates and whether
                they have passed are shown — no check-in content or completion state is implied.
              </p>
            </div>
            <div className="max-h-[620px] overflow-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-border/80 bg-secondary/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3">Joiner</th>
                    <th className="px-3 py-3">Department</th>
                    <th className="px-3 py-3">Joining date</th>
                    <th className="px-5 py-3">Derived milestones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {joiners.map((joiner) => (
                    <tr key={joiner.id}>
                      <td className="px-5 py-3.5">
                        <p className="text-xs font-semibold text-foreground">{joiner.name}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">{joiner.code || "—"}</p>
                      </td>
                      <td className="px-3 py-3.5 text-xs text-muted-foreground">{joiner.department}</td>
                      <td className="px-3 py-3.5 text-xs text-muted-foreground">{joiner.joiningDate}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          {joiner.milestones.map((milestone) => (
                            <span
                              key={milestone.day}
                              className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${
                                milestone.passed
                                  ? "border-primary/25 bg-primary/5 text-primary"
                                  : "border-border text-muted-foreground"
                              }`}
                            >
                              Day {milestone.day} · {milestone.date} · {milestone.passed ? "date passed" : "upcoming"}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Surface>
        )}
      </TabPanel>

      <TabPanel id="pipelines" active={tab}>
        <WorkflowPipelinesTab />
      </TabPanel>

      <TabPanel id="trigger-chains" active={tab}>
        <LifecycleTriggerChainsTab />
      </TabPanel>
    </div>
  );
}

type Announcement = {
  id: string;
  title: string;
  body: string;
  tag: string;
  createdAt: string;
};

function toAnnouncement(row: UnknownRecord): Announcement {
  const attributes = asRecord(row.attributes);
  return {
    id: str(row.id),
    title: str(attributes.title, "Untitled announcement"),
    body: str(attributes.body),
    tag: str(attributes.kind) || str(attributes.audience) || "Announcement",
    createdAt: str(row.created_at),
  };
}

const ANNOUNCEMENT_KINDS = ["birthday", "joiner", "star", "referral", "project", "management"] as const;

function NewAnnouncementModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("all");
  const [kind, setKind] = useState<string>("management");
  const [expiresAt, setExpiresAt] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPublishing(true);
    setFormError("");
    setFieldErrors({});
    try {
      const trimmedTitle = title.trim();
      const trimmedBody = body.trim();
      const trimmedAudience = audience.trim() || "all";
      const trimmedExpiresAt = expiresAt.trim();
      const localErrors: FieldErrors = {};
      if (!trimmedTitle) localErrors.title = "Title is required.";
      if (!trimmedBody) localErrors.body = "Body is required.";
      if (trimmedExpiresAt && !/^\d{4}-\d{2}-\d{2}$/.test(trimmedExpiresAt)) {
        localErrors.expiresAt = "Use YYYY-MM-DD.";
      }
      if (Object.keys(localErrors).length > 0) {
        setFieldErrors(localErrors);
        setFormError("Fix the highlighted fields and try again.");
        return;
      }
      // POST /api/v1/announcements schema: { title, body, audience (default all), kind, expiresAt? }.
      const payloadBody: UnknownRecord = { title: trimmedTitle, body: trimmedBody, audience: trimmedAudience, kind };
      if (trimmedExpiresAt) payloadBody.expiresAt = trimmedExpiresAt;
      const outcome = await postJson("/api/v1/announcements", payloadBody);
      if (!outcome.ok) {
        setFieldErrors(outcome.fieldErrors);
        setFormError(outcome.message);
        return;
      }
      setPublished(true);
      onCreated();
    } finally {
      setPublishing(false);
    }
  }

  return (
    <CreateModal
      title="New Announcement"
      description="Publish an update to the company feed."
      onClose={onClose}
    >
      {published ? (
        <div className="space-y-4">
          <FormNotice message="Announcement published to the feed." />
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
          >
            Done
          </button>
        </div>
      ) : (
        <form className="space-y-3" onSubmit={(event) => void submit(event)}>
          <FormAlert message={formError} />
          <ModalField label="Title" value={title} onChange={setTitle} placeholder="Diwali holiday schedule" required error={fieldErrors.title} disabled={publishing} />
          <ModalTextarea label="Body" value={body} onChange={setBody} placeholder="Plants close early on…" required error={fieldErrors.body} disabled={publishing} />
          <div className="grid gap-3 sm:grid-cols-2">
            <ModalField label="Audience" value={audience} onChange={setAudience} placeholder="all" error={fieldErrors.audience} disabled={publishing} />
            <ModalSelect label="Kind" value={kind} onChange={setKind} error={fieldErrors.kind} disabled={publishing}>
              {ANNOUNCEMENT_KINDS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </ModalSelect>
          </div>
          <ModalField label="Expires on (optional)" value={expiresAt} onChange={setExpiresAt} placeholder="YYYY-MM-DD" type="date" error={fieldErrors.expiresAt} disabled={publishing} />
          <SubmitButton busy={publishing} busyLabel="Publishing…">Publish Announcement</SubmitButton>
        </form>
      )}
    </CreateModal>
  );
}

export function EngagementPage() {
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const announcementsState = useLive("/api/v1/announcements");
  const announcements = useMemo(
    () => listFromEnvelope(announcementsState.data).map(toAnnouncement).filter((item) => item.id),
    [announcementsState.data],
  );

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageIntro
        eyebrow="Experience · Company Pulse"
        title="Culture, made visible."
        description="Celebrate contribution, listen safely, and connect everyday work to company outcomes."
        action={
          <Button
            onClick={() => setAnnouncementOpen(true)}
            className="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4 mr-1.5" /> New Announcement
          </Button>
        }
      />
      {announcementOpen && (
        <NewAnnouncementModal
          onClose={() => setAnnouncementOpen(false)}
          onCreated={() => announcementsState.refresh()}
        />
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {announcementsState.loading && (
          <Surface className="p-5 md:col-span-3">
            <p className="text-sm font-semibold text-foreground">Loading…</p>
            <p className="mt-1 text-xs text-muted-foreground">Fetching announcements.</p>
          </Surface>
        )}
        {!announcementsState.loading && announcementsState.error && announcements.length === 0 && (
          <Surface className="p-5 md:col-span-3">
            <p className="text-sm font-semibold text-foreground">Announcements unavailable</p>
            <p className="mt-1 text-xs text-muted-foreground">{announcementsState.error}</p>
          </Surface>
        )}
        {!announcementsState.loading && !announcementsState.error && announcements.length === 0 && (
          <Surface className="p-5 md:col-span-3">
            <div className="grid place-items-center px-6 py-6 text-center">
              <div>
                <Inbox className="mx-auto size-8 text-muted-foreground/60" />
                <p className="mt-3 text-sm font-semibold text-foreground">No announcements</p>
                <p className="mt-1 text-xs text-muted-foreground">Nothing has been published to the feed yet.</p>
              </div>
            </div>
          </Surface>
        )}
        {announcements.map((item, index) => {
          const icons = [Trophy, UserPlus, Gift];
          const Icon = icons[index % icons.length];
          return (
            <motion.article
              key={item.id}
              whileHover={{ y: -4 }}
              className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase tracking-widest text-primary">
                  {item.tag}
                </span>
                <Icon className="size-4 text-muted-foreground" />
              </div>
              <h2 className="mt-4 text-base font-bold tracking-tight text-foreground">{item.title}</h2>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {item.body || "No body provided."}
              </p>
              {item.createdAt && (
                <p className="mt-3 font-mono text-[11px] text-muted-foreground">{item.createdAt.slice(0, 10)}</p>
              )}
            </motion.article>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Surface>
          <SectionHeading
            title="Wellbeing Pulse"
            description="Latest aggregate wellbeing results"
          />
          <div className="grid place-items-center px-6 py-10 text-center">
            <div>
              <Inbox className="mx-auto size-8 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-semibold text-foreground">No pulse results</p>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
                No completed pulse survey results are available yet.
              </p>
            </div>
          </div>
        </Surface>

        <Surface>
          <SectionHeading title="Referral Momentum" description="Employee-led talent acquisition" />
          <div className="rounded-2xl border border-border/80 bg-secondary/30 p-5">
            <div className="flex items-center justify-between">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <Medal className="size-5" />
              </span>
              <StatusPill tone="neutral">No awards yet</StatusPill>
            </div>
            <p className="mt-4 font-mono text-3xl font-bold text-foreground">No referrals yet</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Referral activity and awards will appear here once recorded.
            </p>
          </div>
        </Surface>
      </div>
    </div>
  );
}
