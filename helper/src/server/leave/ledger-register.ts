import "server-only";

import { sqlClient } from "@/lib/db";
import { tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { leaveEmployeeFilter, resolveLeaveReadScope } from "./leave-scope";

export type LeaveLedgerState = "projected" | "expired" | "encashed" | "reversed";

/**
 * Every movement kind this application writes, and which column it belongs in.
 *
 * The register used to recognise five names while the application wrote eight,
 * so grants, accruals, encashments and lapses scored zero and never moved the
 * running balance. One table now governs the register, the balance cards and
 * `getBalances`, which is why a year-end encashment finally reduces a balance.
 *
 * `reserve` holds days on submit and `release` gives them back — on rejection,
 * and on final approval, where the release pairs with the `debit` that replaces
 * it so an approved request nets exactly one deduction.
 */
export const LEDGER_CREDIT_KINDS = ["credit", "accrual", "grant", "release", "carry_forward"] as const;
export const LEDGER_DEBIT_KINDS = [
  "debit",
  "reserve",
  "reversal",
  "encash",
  "encashment",
  "encashed",
  "lapse",
  "lapsed",
] as const;

export type LedgerDirection = "credit" | "debit" | "none";

/** Which column one movement kind belongs in (unit-tested). */
export function movementDirection(transactionType: string | null | undefined): LedgerDirection {
  const normalized = (transactionType ?? "").trim().toLowerCase();
  if ((LEDGER_CREDIT_KINDS as readonly string[]).includes(normalized)) return "credit";
  if ((LEDGER_DEBIT_KINDS as readonly string[]).includes(normalized)) return "debit";
  return "none";
}

/**
 * Pure state mapping for one ledger movement (unit-tested). A movement that a
 * later entry reverses reads as reversed; a lapse or a dated credit whose expiry
 * has passed reads as expired; an encashment reads as encashed; everything else
 * is a projected balance movement.
 */
export function deriveLedgerState(
  transactionType: string | null | undefined,
  expiresOn: string | null | undefined,
  reversed: boolean,
  today = new Date().toISOString().slice(0, 10),
): LeaveLedgerState {
  if (reversed) return "reversed";
  const normalized = (transactionType ?? "").trim().toLowerCase();
  if (normalized === "reversal") return "reversed";
  if (["encashment", "encashed", "encash"].includes(normalized)) return "encashed";
  if (["lapse", "lapsed"].includes(normalized)) return "expired";
  const expiry = (expiresOn ?? "").slice(0, 10);
  if (expiry !== "" && expiry < today) return "expired";
  return "projected";
}

/**
 * Splits one movement into its credit and debit columns. Entries arrive in two
 * shapes: the imported ledger uses `transaction_type` (Credit/Debit/Reversal)
 * and the application's own writes use `kind` (credit/accrual/grant/reserve/
 * release/debit/encash/lapse). A reversal, a lapse and an encashment all
 * withdraw days, so they land in the debit column.
 */
export function splitMovement(
  transactionType: string | null | undefined,
  days: number,
): { credit: number; debit: number } {
  const magnitude = Number.isFinite(days) ? Math.abs(days) : 0;
  const direction = movementDirection(transactionType);
  if (direction === "credit") return { credit: magnitude, debit: 0 };
  if (direction === "debit") return { credit: 0, debit: magnitude };
  return { credit: 0, debit: 0 };
}

export type LeaveLedgerRow = {
  id: string;
  ledger_reference: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  leave_type: string;
  leave_type_name: string | null;
  transaction_type: string;
  credit: number;
  debit: number;
  balance: number;
  effective_date: string | null;
  expires_on: string | null;
  narration: string | null;
  source_reference: string | null;
  status: LeaveLedgerState;
};

type LedgerQueryRow = Omit<LeaveLedgerRow, "credit" | "debit" | "balance" | "status"> & {
  days: number;
  reversed: boolean;
};

const LEDGER_SELECT = `select l.id,
    coalesce(l.attributes->>'ledger_id', left(l.id::text, 8)) as ledger_reference,
    l.employee_id,
    emp.employee_code,
    case when emp.id is null then null
         else trim(coalesce(emp.first_name, '') || ' ' || coalesce(emp.last_name, '')) end as employee_name,
    coalesce(lt.attributes->>'code', l.attributes->>'leave_type', '') as leave_type,
    lt.attributes->>'name' as leave_type_name,
    coalesce(l.attributes->>'transaction_type', initcap(coalesce(l.attributes->>'kind', ''))) as transaction_type,
    coalesce((l.attributes->>'days')::float, 0) as days,
    l.attributes->>'effective_date' as effective_date,
    l.attributes->>'expires_on' as expires_on,
    l.attributes->>'narration' as narration,
    l.attributes->>'source_reference' as source_reference,
    exists (select 1 from leave_ledger_entries rev
            where rev.tenant_id = l.tenant_id and rev.reverses_entry_id = l.id) as reversed
  from leave_ledger_entries l
  left join employees emp on emp.tenant_id = l.tenant_id and emp.id = l.employee_id
  left join leave_types lt on lt.tenant_id = l.tenant_id and lt.id = l.leave_type_id`;

/**
 * Projects raw movements into the register, carrying a running balance per
 * employee and leave type in the order the movements take effect.
 */
export function projectLedger(rows: LedgerQueryRow[]): LeaveLedgerRow[] {
  const running = new Map<string, number>();
  return rows.map((row) => {
    const { credit, debit } = splitMovement(row.transaction_type, row.days);
    const key = `${row.employee_id}:${row.leave_type}`;
    const balance = (running.get(key) ?? 0) + credit - debit;
    running.set(key, balance);
    return {
      ...row,
      credit,
      debit,
      balance: Math.round(balance * 100) / 100,
      status: deriveLedgerState(row.transaction_type, row.expires_on, row.reversed),
    };
  });
}

/**
 * Leave balance and ledger queue: every movement with its running balance.
 *
 * `$3` is the employee filter, and for a self-scoped caller it is their own id
 * taken from the session — the `employeeId` the request supplied is discarded,
 * so the accrual, encashment and lapse history of another employee cannot be
 * requested. The running balance is then projected over exactly the movements
 * that were served, so a narrowed reader's balance is their own, never a
 * fragment of somebody else's account.
 */
export async function listLeaveLedger(
  access: Access,
  args: { search: string; employeeId: string | null },
): Promise<LeaveLedgerRow[]> {
  const resolved = resolveLeaveReadScope(access);
  const like = `%${args.search.replace(/[%_]/g, "").slice(0, 80)}%`;
  const employeeId = leaveEmployeeFilter(resolved, args.employeeId);
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `${LEDGER_SELECT}
       where l.tenant_id = $1
         and ($3::uuid is null or l.employee_id = $3::uuid)
         and ($2 = '%%' or (coalesce(emp.employee_code, '') || ' ' || coalesce(emp.first_name, '') || ' '
              || coalesce(emp.last_name, '') || ' ' || coalesce(lt.attributes->>'code', '') || ' '
              || coalesce(l.attributes->>'ledger_id', '')) ilike $2)
       order by l.employee_id, coalesce(lt.attributes->>'code', ''), coalesce(l.attributes->>'effective_date', ''),
         coalesce(l.attributes->>'ledger_id', ''), l.created_at
       limit 200`,
      [access.tenantId, like, employeeId],
    ),
  ]);
  return projectLedger(rows as LedgerQueryRow[]);
}

/**
 * One movement, the balance it left behind, and its audit trail.
 *
 * The scope is part of the lookup, so a movement belonging to another employee
 * is not found rather than forbidden — the detail cannot be used to confirm that
 * somebody else's ledger entry exists. The account read below is keyed on the
 * employee of the row that was actually served, so it inherits that confinement.
 */
export async function getLeaveLedgerRecord(access: Access, id: string) {
  const { selfEmployeeId } = resolveLeaveReadScope(access);
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `${LEDGER_SELECT} where l.tenant_id = $1 and l.id = $2::uuid
        and ($3::uuid is null or l.employee_id = $3::uuid) limit 1`,
      [access.tenantId, id, selfEmployeeId],
    ),
  ]);
  const found = (rows as LedgerQueryRow[])[0];
  if (!found) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });

  // The whole account this movement belongs to, so the detail can show the
  // balance as at this entry rather than a number with no provenance.
  const [accountRows] = await tenantTx(access, [
    sqlClient.query(
      `${LEDGER_SELECT}
       where l.tenant_id = $1 and l.employee_id = $2::uuid
         and coalesce(lt.attributes->>'code', l.attributes->>'leave_type', '') = $3
       order by coalesce(l.attributes->>'effective_date', ''), coalesce(l.attributes->>'ledger_id', ''), l.created_at
       limit 200`,
      [access.tenantId, found.employee_id, found.leave_type],
    ),
  ]);
  const account = projectLedger(accountRows as LedgerQueryRow[]);
  const record = account.find((row) => row.id === id) ?? projectLedger([found])[0];

  let auditTrail: Array<Record<string, unknown>> = [];
  try {
    const [auditRows] = await tenantTx(access, [
      sqlClient`select id, action, reason, created_at::text as created_at from audit_events
        where tenant_id = ${access.tenantId} and entity_type = 'leave_ledger_entry' and entity_id = ${id}
        order by created_at desc limit 20`,
    ]);
    auditTrail = auditRows as Array<Record<string, unknown>>;
  } catch {
    auditTrail = [];
  }

  return { record, account, auditTrail };
}
