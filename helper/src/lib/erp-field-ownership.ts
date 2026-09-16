import { z } from "zod";
import { picklistValues, type PicklistValue } from "@/lib/picklists";

/**
 * FRM-FIN-02 — ERP Integration and Field Ownership. The rules only; no I/O.
 *
 * This is the mechanism that answers Q-15 ("which system owns which employee
 * field"). Nothing here decides an answer: the form records one per ERP
 * connection, and `planErpFieldWrites` applies whatever was recorded. Until a
 * connection has a saved map the inbound sync refuses to write anything, which
 * is the point — a sync that overwrote every field would be asserting an
 * ownership nobody agreed.
 *
 * Shared between the server (`src/server/integrations/erp-settings.ts`,
 * `erp-sync.ts`) and the form (`src/components/hrms/erp-integration-page.tsx`),
 * so it must stay free of `server-only` imports.
 */

/**
 * The field catalogue the ownership grid is drawn from: exactly the employee
 * fields an inbound ERP record can carry (`erpEmployeePayloadSchema`). The
 * match key is not in it — it is how a record is found, not a value anyone owns.
 */
export const ERP_SYNC_FIELDS = [
  "firstName",
  "lastName",
  "workEmail",
  "department",
  "location",
  "designation",
  "joiningDate",
  "basicSalaryMinor",
] as const;
export type ErpSyncField = (typeof ERP_SYNC_FIELDS)[number];

/** The catalogue entries the workbook calls mandatory: the ones an employee row cannot exist without. */
export const ERP_MANDATORY_SYNC_FIELDS: readonly ErpSyncField[] = ["firstName", "lastName", "department", "location", "designation", "joiningDate"];

export const ERP_SYNC_FIELD_LABELS: Record<ErpSyncField, string> = {
  firstName: "First name",
  lastName: "Last name",
  workEmail: "Work email",
  department: "Department",
  location: "Location",
  designation: "Designation",
  joiningDate: "Joining date",
  basicSalaryMinor: "Basic salary",
};

/**
 * How an inbound record is matched to a Nucleus employee. The workbook names
 * no picklist for this field and lists only its default ("External employee
 * code"); the three keys are the identifiers an employee row actually carries.
 */
export const ERP_MATCH_KEYS = ["employee_code", "external_id", "work_email"] as const;
export type ErpMatchKey = (typeof ERP_MATCH_KEYS)[number];

export const ERP_MATCH_KEY_LABELS: Record<ErpMatchKey, string> = {
  employee_code: "External employee code (equals the Nucleus employee code)",
  external_id: "ERP external id (stored on the employee, Nucleus code may differ)",
  work_email: "Work email",
};

export type ErpMasterMode = PicklistValue<"PL_MASTER_MODE">;
export type ErpFieldOwner = PicklistValue<"PL_FIELD_OWNER">;
export type ErpConflictPolicy = PicklistValue<"PL_CONFLICT_POLICY">;
export type ErpUnmatchedAction = PicklistValue<"PL_UNMATCHED_ACTION">;

const ownerSchema = z.enum(picklistValues("PL_FIELD_OWNER"));

/** The nine workbook fields. `coverage_panel` is derived (`erpOwnershipCoverage`), not stored. */
export const erpSettingsSchema = z
  .object({
    connectionId: z.string().uuid(),
    masterMode: z.enum(picklistValues("PL_MASTER_MODE")),
    erpSystem: z.enum(picklistValues("PL_ERP_SYSTEM")),
    syncFrequency: z.enum(picklistValues("PL_SYNC_FREQUENCY")),
    // One owner per field: a map cannot hold two owners for one key, which is
    // the workbook's "no field may be owned by both systems" rule by construction.
    fieldOwners: z.partialRecord(z.enum(ERP_SYNC_FIELDS), ownerSchema),
    conflictPolicy: z.enum(picklistValues("PL_CONFLICT_POLICY")),
    matchKey: z.enum(ERP_MATCH_KEYS),
    unmatchedAction: z.enum(picklistValues("PL_UNMATCHED_ACTION")),
  })
  .superRefine((value, ctx) => {
    const coverage = erpOwnershipCoverage(value.fieldOwners);
    if (!coverage.complete) {
      ctx.addIssue({
        code: "custom",
        path: ["fieldOwners"],
        message: `Save blocked: every mandatory field needs an owner (${coverage.unowned.map((field) => ERP_SYNC_FIELD_LABELS[field]).join(", ")}).`,
      });
    }
  });

export type ErpSettings = z.infer<typeof erpSettingsSchema>;
export type ErpFieldOwners = ErpSettings["fieldOwners"];

/** The workbook's stated defaults. `erp_system` has none ("-"). */
export const ERP_SETTINGS_DEFAULTS = {
  masterMode: "co_owned",
  syncFrequency: "daily",
  conflictPolicy: "hold_for_review",
  matchKey: "employee_code",
  unmatchedAction: "hold",
} as const satisfies Partial<ErpSettings>;

export type ErpOwnershipCoverage = {
  mandatory: readonly ErpSyncField[];
  owned: ErpSyncField[];
  unowned: ErpSyncField[];
  /** True when every mandatory field has exactly one owner; the save gate. */
  complete: boolean;
};

/** The derived "Mandatory field coverage" panel. */
export function erpOwnershipCoverage(owners: Partial<Record<ErpSyncField, ErpFieldOwner | undefined>>): ErpOwnershipCoverage {
  const owned = ERP_MANDATORY_SYNC_FIELDS.filter((field) => owners[field] !== undefined);
  const unowned = ERP_MANDATORY_SYNC_FIELDS.filter((field) => owners[field] === undefined);
  return { mandatory: ERP_MANDATORY_SYNC_FIELDS, owned, unowned, complete: unowned.length === 0 };
}

/**
 * The owner the mode pre-fills for every field. "Co-owned" pre-fills nothing:
 * the workbook says the owner is "per the mode default" and a co-owned mode has
 * no single default, so each field must be chosen explicitly.
 */
export function defaultOwnersForMode(mode: ErpMasterMode): ErpFieldOwners {
  if (mode === "co_owned") return {};
  const owner: ErpFieldOwner = mode === "erp_owns" ? "erp" : "nucleus";
  return Object.fromEntries(ERP_SYNC_FIELDS.map((field) => [field, owner])) as ErpFieldOwners;
}

/** The fields the ERP owns under a saved map — the ones an inbound sync may overwrite. */
export function erpOwnedFields(owners: ErpFieldOwners): ErpSyncField[] {
  return ERP_SYNC_FIELDS.filter((field) => owners[field] === "erp");
}

export type ErpFieldValue = string | number | null | undefined;
export type ErpFieldValues = Partial<Record<ErpSyncField, ErpFieldValue>>;

export type ErpConflict = {
  field: ErpSyncField;
  nucleusValue: ErpFieldValue;
  erpValue: ErpFieldValue;
  resolution: "nucleus_kept" | "erp_applied" | "held";
};

export type ErpWritePlan =
  | { action: "apply"; writes: ErpFieldValues; conflicts: ErpConflict[] }
  | { action: "hold"; writes: ErpFieldValues; conflicts: ErpConflict[]; reason: string };

export class ErpOwnershipError extends Error {
  readonly code: "ERP_FIELD_OWNER_UNSET" | "ERP_CHANGE_TIME_REQUIRED";
  readonly details: Array<{ field: string; issue: string }>;

  constructor(code: ErpOwnershipError["code"], message: string, details: Array<{ field: string; issue: string }> = []) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

function sameValue(left: ErpFieldValue, right: ErpFieldValue): boolean {
  // bigint columns come back from Postgres as strings; compare on the printed form.
  const normalise = (value: ErpFieldValue) => (value === null || value === undefined ? "" : String(value).trim());
  return normalise(left) === normalise(right);
}

/**
 * Decide, field by field, what an inbound record may write to a matched employee.
 *
 *  - An ERP-owned field is written as sent.
 *  - A Nucleus-owned field that already agrees is left alone.
 *  - A Nucleus-owned field that disagrees is a conflict, settled by the policy:
 *    `owner_wins` keeps the Nucleus value, `hold_for_review` holds the whole
 *    record for the sync monitor, `latest_wins` compares the two change times.
 *  - A field the ERP sent but nobody owns stops the sync: writing it would
 *    assert an ownership the form never recorded.
 *
 * Pure, so every branch is asserted without a database.
 */
export function planErpFieldWrites(args: {
  owners: ErpFieldOwners;
  conflictPolicy: ErpConflictPolicy;
  incoming: ErpFieldValues;
  current: ErpFieldValues;
  /** When the ERP says its copy changed; required only for `latest_wins`. */
  erpChangedAt?: string | null;
  /** When the Nucleus row last changed (`employees.updated_at`). */
  nucleusChangedAt?: string | null;
}): ErpWritePlan {
  const writes: ErpFieldValues = {};
  const conflicts: ErpConflict[] = [];
  const unowned: ErpSyncField[] = [];
  for (const field of ERP_SYNC_FIELDS) {
    const erpValue = args.incoming[field];
    if (erpValue === undefined) continue;
    const owner = args.owners[field];
    if (owner === undefined) {
      unowned.push(field);
      continue;
    }
    if (owner === "erp") {
      writes[field] = erpValue;
      continue;
    }
    const nucleusValue = args.current[field];
    if (sameValue(nucleusValue, erpValue)) continue;
    if (args.conflictPolicy === "owner_wins") {
      conflicts.push({ field, nucleusValue, erpValue, resolution: "nucleus_kept" });
    } else if (args.conflictPolicy === "hold_for_review") {
      conflicts.push({ field, nucleusValue, erpValue, resolution: "held" });
    } else {
      const erpChanged = args.erpChangedAt ? Date.parse(args.erpChangedAt) : Number.NaN;
      if (Number.isNaN(erpChanged)) {
        throw new ErpOwnershipError(
          "ERP_CHANGE_TIME_REQUIRED",
          `The conflict policy is "Latest wins" but the ERP record carries no change time (erpChangedAt), so "latest" cannot be decided for ${ERP_SYNC_FIELD_LABELS[field]}.`,
          [{ field, issue: "erpChangedAt is required under latest_wins" }],
        );
      }
      const nucleusChanged = args.nucleusChangedAt ? Date.parse(args.nucleusChangedAt) : Number.NaN;
      // A Nucleus row with no known change time cannot claim to be newer.
      const erpIsLater = Number.isNaN(nucleusChanged) || erpChanged > nucleusChanged;
      if (erpIsLater) {
        writes[field] = erpValue;
        conflicts.push({ field, nucleusValue, erpValue, resolution: "erp_applied" });
      } else {
        conflicts.push({ field, nucleusValue, erpValue, resolution: "nucleus_kept" });
      }
    }
  }
  if (unowned.length > 0) {
    throw new ErpOwnershipError(
      "ERP_FIELD_OWNER_UNSET",
      `The ERP sent ${unowned.map((field) => ERP_SYNC_FIELD_LABELS[field]).join(", ")} but no owner is recorded for ${unowned.length === 1 ? "it" : "them"}. Set the owner on the ERP integration form before syncing.`,
      unowned.map((field) => ({ field, issue: "no owner recorded" })),
    );
  }
  const held = conflicts.filter((conflict) => conflict.resolution === "held");
  if (held.length > 0) {
    return {
      action: "hold",
      writes: {},
      conflicts,
      reason: `Held for review: ${held.map((conflict) => `${ERP_SYNC_FIELD_LABELS[conflict.field]} (Nucleus "${conflict.nucleusValue ?? ""}", ERP "${conflict.erpValue ?? ""}")`).join("; ")}.`,
    };
  }
  return { action: "apply", writes, conflicts };
}

/**
 * Which stored identifier an inbound record is matched on, and the value to
 * match. Under `work_email` the record must carry an email, or it cannot be
 * matched at all — that is reported, not silently treated as unmatched.
 */
export function erpMatchTarget(
  matchKey: ErpMatchKey,
  record: { externalCode: string; workEmail?: string | null },
): { key: ErpMatchKey; value: string } | { key: ErpMatchKey; value: null; issue: string } {
  if (matchKey === "work_email") {
    const email = record.workEmail?.trim().toLowerCase() ?? "";
    if (!email) return { key: matchKey, value: null, issue: "The match key is work email but the ERP record carries none." };
    return { key: matchKey, value: email };
  }
  return { key: matchKey, value: record.externalCode.trim() };
}
