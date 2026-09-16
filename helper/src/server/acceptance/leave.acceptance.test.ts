import { afterAll, describe, expect, it } from "vitest";

import { ingestPunches, recomputeDay } from "@/server/attendance/service";
import { runLeaveAccrual, type LeaveAccrualResult } from "@/server/leave/accrual";
import { runCoffLapse } from "@/server/leave/coff";
import { loadLeaveScheme } from "@/server/leave/configuration";
import { decideLeave, ensureLeaveType, getBalances, grantCoff, recordEarlyReturn, requestLeave } from "@/server/leave/service";
import { runLeaveYearEnd, type YearEndResult } from "@/server/leave/year-end";
import type { Access } from "@/server/platform/access";

import { accessFor, at, createScenarioEmployee, db, DESIGNATIONS, LIVE, removeScenarioRows, SHIFTS, tenantId } from "./fixture";

/**
 * Live acceptance scenarios T-08 … T-17 (leave), driven through the leave engine's
 * service functions exactly as the API routes call them — never through HTTP and
 * never through the database for anything the engine itself decides.
 *
 * Every scenario creates its own employees under its `T-nn` code prefix and the
 * `afterAll` removes them, so the suite is re-runnable against the seeded `mkraft`
 * tenant. Run with MKRAFT_LIVE_VERIFY=1 after `npx tsx scripts/seed-acceptance-demo.ts`.
 *
 * Three scheme values are open questions the workbook never answers (Q-06 senior
 * grade rank, Q-07 COFF day basis, Q-02 joiners after 4 December). Where the seed
 * leaves one unset, the scenario asserts the engine's named refusal — the figure is
 * never assumed.
 */

const TESTS = ["T-08", "T-09", "T-10", "T-11", "T-12", "T-13", "T-14", "T-15", "T-16", "T-17"] as const;
const TIMEOUT = { timeout: 120_000 };

const rid = () => crypto.randomUUID();

type LedgerRow = {
  id: string;
  leave_request_id: string | null;
  comp_off_grant_id: string | null;
  reverses_entry_id: string | null;
  attributes: Record<string, unknown>;
};

async function ledgerRows(employeeId: string): Promise<LedgerRow[]> {
  const tenant = await tenantId();
  return (await db()`
    select id, leave_request_id, comp_off_grant_id, reverses_entry_id, attributes
    from leave_ledger_entries where tenant_id = ${tenant} and employee_id = ${employeeId}
    order by created_at asc
  `) as LedgerRow[];
}

type ApprovalRow = { level: string; status: string; approver_user_id: string | null; decided_at: string | null };

async function approvalRows(requestId: string): Promise<ApprovalRow[]> {
  const tenant = await tenantId();
  return (await db()`
    select level, status, approver_user_id, decided_at::text as decided_at
    from leave_approvals where tenant_id = ${tenant} and leave_request_id = ${requestId}
    order by created_at asc
  `) as ApprovalRow[];
}

/** The three W-01 actors plus the HR Manager, who submits on the employee's behalf. */
async function actors() {
  const [requester, supervisor, hod, hrHead] = await Promise.all([
    accessFor("hrManager"),
    accessFor("supervisor"),
    accessFor("hod"),
    accessFor("hrHead"),
  ]);
  return { requester, supervisor, hod, hrHead };
}

/** Walks Supervisor → HOD → HR Head to final approval, asserting each hand-off. */
async function approveThroughChain(chain: Awaited<ReturnType<typeof actors>>, requestId: string) {
  const first = await decideLeave(chain.supervisor, requestId, true, "Supervisor approves", rid());
  expect(first.status).toBe("pending_hod");
  const second = await decideLeave(chain.hod, requestId, true, "HOD approves", rid());
  expect(second.status).toBe("pending_hr");
  const third = await decideLeave(chain.hrHead, requestId, true, "HR Head approves", rid());
  expect(third.status).toBe("approved");
}

/**
 * The open-question answers the seed has (or has not) configured, read from the
 * same scheme the engine calculates against so the test and the engine can never
 * disagree about what is configured.
 */
async function openQuestions(access: Access) {
  const scheme = await loadLeaveScheme(access);
  return {
    seniorGradeRank: scheme.seniorGradeRank,
    coffLapseDayBasis: scheme.coffLapseDayBasis,
    joiningAfterCutoffDays: { CL: scheme.types.CL?.joiningAfterCutoffDays ?? null, SL: scheme.types.SL?.joiningAfterCutoffDays ?? null },
  };
}

/** A ledger credit written straight to the ledger, for scenarios whose SETUP is a stated balance. */
async function creditLedger(access: Access, employeeId: string, leaveType: string, days: number, effectiveDate: string) {
  const tenant = await tenantId();
  const leaveTypeId = await ensureLeaveType(access, leaveType);
  await db()`
    insert into leave_ledger_entries (tenant_id, employee_id, leave_type_id, attributes)
    values (${tenant}, ${employeeId}, ${leaveTypeId},
      ${JSON.stringify({ kind: "credit", days, leave_type: leaveType, effective_date: effectiveDate, source: "acceptance.setup", note: "Opening balance for the acceptance scenario" })}::jsonb)
  `;
}

function expectQ06Refusal(result: LeaveAccrualResult, employeeId: string) {
  expect(result.lines).toBe(0);
  const blocked = result.blocked.find((entry) => entry.employeeId === employeeId);
  expect(blocked?.code).toBe("LEAVE_SCHEME_INCOMPLETE");
  expect(blocked?.message).toMatch(/Q-06/);
  expect(blocked?.message).toMatch(/senior_grade_rank/);
}

describe.skipIf(!LIVE)("Leave acceptance scenarios T-08 … T-17 (live, opt-in)", () => {
  afterAll(async () => {
    for (const test of TESTS) await removeScenarioRows(test);
  }, 120_000);

  it("T-08 Early return credits the balance and marks present", TIMEOUT, async () => {
    const chain = await actors();
    const employee = await createScenarioEmployee({ test: "T-08", designation: "operator" });

    // The employee has never been processed on a shift. A leave day has no attendance
    // row, so the early return has to create days 7–10 against the employee's shift;
    // one processed day before the leave gives it the shift to create them on.
    await ingestPunches(chain.requester, {
      employeeId: employee.id,
      workDate: "2026-05-25",
      shiftCode: SHIFTS.A,
      punches: [
        { at: at("2026-05-25", "08:00"), type: "in", source: "biometric_device" },
        { at: at("2026-05-25", "17:00"), type: "out", source: "biometric_device" },
      ],
    }, rid());

    // Approve 10 days of EL from 1 to 10.
    const submitted = await requestLeave(chain.requester, {
      employeeId: employee.id, leaveType: "EL", startsOn: "2026-06-01", endsOn: "2026-06-10", days: 10, reason: "T-08 ten days of earned leave",
    }, rid());
    await approveThroughChain(chain, submitted.id);
    const before = await getBalances(chain.requester, employee.id);
    expect(before.used.EL).toBe(10);

    // Record an actual return on day 7.
    const returned = await recordEarlyReturn(chain.hrHead, submitted.id, { actualReturnDate: "2026-06-07" }, rid());
    expect(returned.leaveDaysCreditedBack).toBe(4);
    expect(returned.presentDaysRestored).toBe(4);
    expect(returned.releasedDates).toEqual(["2026-06-07", "2026-06-08", "2026-06-09", "2026-06-10"]);
    expect(returned.attendanceDaysMarkedPresent).toBe(4);

    // 4 days credited back to the EL balance as a reversal of the original debit.
    const after = await getBalances(chain.requester, employee.id);
    expect(after.balances.EL - before.balances.EL).toBe(4);
    const ledger = await ledgerRows(employee.id);
    const debit = ledger.find((row) => row.leave_request_id === submitted.id && row.attributes.kind === "debit");
    expect(debit, "the approved availing must be in the ledger as a debit").toBeDefined();
    expect(Number(debit!.attributes.days)).toBe(10);
    const reversal = ledger.find((row) => row.leave_request_id === submitted.id && row.reverses_entry_id === debit!.id);
    expect(reversal, "the early-return credit must be linked to the debit it reverses").toBeDefined();
    expect(reversal!.attributes).toMatchObject({ kind: "credit", days: 4, leave_type: "EL", effective_date: "2026-06-07", source: "leave.early_return" });
    expect(String(reversal!.attributes.note)).toContain("2026-06-07");
    expect(returned.reversesEntryId).toBe(debit!.id);

    // Days 7 to 10 marked present.
    const tenant = await tenantId();
    const days = (await db()`
      select attendance_date::text as attendance_date, status from attendance_days
      where tenant_id = ${tenant} and employee_id = ${employee.id} and attendance_date between '2026-06-07' and '2026-06-10'
      order by attendance_date asc
    `) as Array<{ attendance_date: string; status: string }>;
    expect(days).toEqual([
      { attendance_date: "2026-06-07", status: "present" },
      { attendance_date: "2026-06-08", status: "present" },
      { attendance_date: "2026-06-09", status: "present" },
      { attendance_date: "2026-06-10", status: "present" },
    ]);
  });

  it("T-09 Three-level approval is enforced", TIMEOUT, async () => {
    const chain = await actors();
    const employee = await createScenarioEmployee({ test: "T-09", designation: "operator" });
    const submitted = await requestLeave(chain.requester, {
      employeeId: employee.id, leaveType: "EL", startsOn: "2026-07-06", endsOn: "2026-07-07", days: 2, reason: "T-09 approval chain",
    }, rid());
    expect(submitted.status).toBe("pending_supervisor");

    // HR Head before the Supervisor acts: blocked, and nothing recorded.
    await expect(decideLeave(chain.hrHead, submitted.id, true, "HR Head jumping the queue", rid())).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await approvalRows(submitted.id)).toEqual([{ level: "supervisor", status: "pending", approver_user_id: null, decided_at: null }]);

    // Each of Supervisor, HOD and HR Head is recorded with actor and timestamp.
    await approveThroughChain(chain, submitted.id);
    const approvals = await approvalRows(submitted.id);
    expect(approvals.map((row) => [row.level, row.status])).toEqual([
      ["supervisor", "approved"],
      ["hod", "approved"],
      ["hr_head", "approved"],
    ]);
    expect(approvals.map((row) => row.approver_user_id)).toEqual([
      chain.supervisor.context.actorUserId,
      chain.hod.context.actorUserId,
      chain.hrHead.context.actorUserId,
    ]);
    for (const row of approvals) expect(Number.isNaN(Date.parse(row.decided_at ?? ""))).toBe(false);
    expect(Date.parse(approvals[0]!.decided_at!)).toBeLessThanOrEqual(Date.parse(approvals[1]!.decided_at!));
    expect(Date.parse(approvals[1]!.decided_at!)).toBeLessThanOrEqual(Date.parse(approvals[2]!.decided_at!));
  });

  it("T-10 COFF lapses on schedule: earned 10 March, lapsed 9 May with a ledger entry naming the run (the Q-07 refusal instead while coff_lapse_day_basis is unset)", TIMEOUT, async () => {
    const chain = await actors();
    const questions = await openQuestions(chain.hrHead);
    // 10 March 2024 is a Sunday: a rest day for the regular worker category, so the
    // worked day qualifies for a comp-off claim.
    const employee = await createScenarioEmployee({ test: "T-10", designation: "operator", workerCategory: "regular" });
    const earnedOn = "2024-03-10";
    const ingested = await ingestPunches(chain.requester, {
      employeeId: employee.id,
      workDate: earnedOn,
      shiftCode: SHIFTS.A,
      punches: [
        { at: at(earnedOn, "08:00"), type: "in", source: "biometric_device" },
        { at: at(earnedOn, "20:00"), type: "out", source: "biometric_device" },
      ],
    }, rid());
    // A comp-off is claimed against a *processed* day: the day type is decided by the
    // attendance engine (holiday calendar, then the category's rest-day pattern) and
    // written onto the day when it is computed. Claiming straight off the raw punches
    // leaves the engine with no recorded day type, which it refuses rather than guesses.
    await recomputeDay(chain.hrHead, ingested.dayId, rid());
    const grantInput = { employeeId: employee.id, earnedOn, reason: "Worked the Sunday rest day on plant cover" };

    if (questions.coffLapseDayBasis === null) {
      await expect(grantCoff(chain.requester, grantInput, rid())).rejects.toMatchObject({ code: "LEAVE_SCHEME_INCOMPLETE" });
      await expect(grantCoff(chain.requester, grantInput, rid())).rejects.toThrow(/Q-07/);
      return;
    }

    // Earn a COFF on 10 March with a 60-day window.
    const grant = await grantCoff(chain.requester, grantInput, rid());
    expect(grant.expiresOn).toBe("2024-05-09");
    const before = await getBalances(chain.requester, employee.id);
    expect(before.balances.COFF).toBe(grant.days);

    // The day before the expiry: nothing lapses.
    const early = await runCoffLapse(chain.hrHead, { asOf: "2024-05-08", mode: "preview" }, rid());
    expect(early.lines.find((line) => line.grantId === grant.id)).toBeUndefined();

    // Advance the system date to 9 May: status moves to Lapsed, a ledger entry names the run, the balance drops.
    const preview = await runCoffLapse(chain.hrHead, { asOf: "2024-05-09", mode: "preview" }, rid());
    expect(preview.lines.find((line) => line.grantId === grant.id)).toMatchObject({ employeeId: employee.id, earnedOn, lapsesOn: "2024-05-09", days: grant.days });
    const commit = await runCoffLapse(chain.hrHead, { asOf: "2024-05-09", mode: "commit" }, rid());
    expect(commit.lines.find((line) => line.grantId === grant.id)).toMatchObject({ lapsesOn: "2024-05-09", days: grant.days });

    const tenant = await tenantId();
    const grants = (await db()`
      select attributes->>'status' as status, attributes->>'lapsed_on' as lapsed_on, attributes->>'lapse_source' as lapse_source
      from comp_off_grants where tenant_id = ${tenant} and id = ${grant.id}
    `) as Array<{ status: string; lapsed_on: string | null; lapse_source: string | null }>;
    expect(grants[0]).toEqual({ status: "lapsed", lapsed_on: "2024-05-09", lapse_source: "leave.coff_lapse:2024-05-09" });

    const lapse = (await ledgerRows(employee.id)).find((row) => row.comp_off_grant_id === grant.id && row.attributes.kind === "lapse");
    expect(lapse, "the lapse must be written to the leave ledger").toBeDefined();
    expect(lapse!.attributes).toMatchObject({ kind: "lapse", days: grant.days, leave_type: "COFF", effective_date: "2024-05-09", source: "leave.coff_lapse:2024-05-09" });
    expect(String(lapse!.attributes.note)).toContain("leave.coff_lapse:2024-05-09");

    const after = await getBalances(chain.requester, employee.id);
    expect(after.balances.COFF).toBe(before.balances.COFF - grant.days);
  });

  it("T-11 Senior grade annual credit: 18 EL, 6 CL and 6 SL in one movement (the Q-06 refusal instead while senior_grade_rank is unset)", TIMEOUT, async () => {
    const chain = await actors();
    const questions = await openQuestions(chain.hrHead);
    const employee = await createScenarioEmployee({ test: "T-11", designation: "agm", joiningDate: "2024-01-15" });
    const run = await runLeaveAccrual(chain.hrHead, { asOf: "2026-01-01", mode: "commit", employeeId: employee.id }, rid());

    if (questions.seniorGradeRank === null) {
      expectQ06Refusal(run, employee.id);
      return;
    }
    expect(DESIGNATIONS.agm.level, "the seeded AGM must sit at or above the configured senior grade rank").toBeGreaterThanOrEqual(questions.seniorGradeRank);

    expect(run.blocked).toEqual([]);
    expect(run.employees).toBe(1);
    expect(run.movements).toBe(1);
    expect(run.lines).toBe(3);
    expect(run.days).toEqual({ EL: 18, CL: 6, SL: 6 });
    const movementIds = new Set(run.credits.map((credit) => credit.movementId));
    expect(movementIds.size).toBe(1);
    expect(run.credits.every((credit) => credit.basis === "annual")).toBe(true);

    const ledger = await ledgerRows(employee.id);
    expect(ledger).toHaveLength(3);
    expect(new Set(ledger.map((row) => row.attributes.movement_id)).size).toBe(1);
    expect(ledger.map((row) => [row.attributes.leave_type, Number(row.attributes.days)]).sort()).toEqual([["CL", 6], ["EL", 18], ["SL", 6]]);
    expect(ledger.every((row) => row.attributes.source === "leave.accrual:2026-01-01")).toBe(true);

    const balances = await getBalances(chain.requester, employee.id);
    expect(balances.balances).toMatchObject({ EL: 18, CL: 6, SL: 6 });
  });

  it("T-12 Monthly EL accrual for other employees: 1.5 EL a month, 18 across the year, CL and SL once in January (the Q-06 refusal instead while senior_grade_rank is unset)", TIMEOUT, async () => {
    const chain = await actors();
    const questions = await openQuestions(chain.hrHead);
    const employee = await createScenarioEmployee({ test: "T-12", designation: "operator", joiningDate: "2024-01-15" });

    if (questions.seniorGradeRank === null) {
      const run = await runLeaveAccrual(chain.hrHead, { period: "2026-01", mode: "commit", employeeId: employee.id }, rid());
      expectQ06Refusal(run, employee.id);
      return;
    }
    expect(DESIGNATIONS.operator.level).toBeLessThan(questions.seniorGradeRank);

    for (let month = 1; month <= 12; month += 1) {
      const period = `2026-${String(month).padStart(2, "0")}`;
      const run = await runLeaveAccrual(chain.hrHead, { period, mode: "commit", employeeId: employee.id }, rid());
      expect(run.blocked, `${period} must not be blocked`).toEqual([]);
      const el = run.credits.filter((credit) => credit.leaveType === "EL");
      expect(el.map((credit) => credit.days), `${period} EL`).toEqual([1.5]);
      expect(el[0]!.basis).toBe("monthly");
      const clsl = run.credits.filter((credit) => credit.leaveType !== "EL").map((credit) => [credit.leaveType, credit.days]).sort();
      expect(clsl, `${period} CL/SL`).toEqual(month === 1 ? [["CL", 6], ["SL", 6]] : []);
    }

    const balances = await getBalances(chain.requester, employee.id);
    expect(balances.balances).toMatchObject({ EL: 18, CL: 6, SL: 6 });
    expect(balances.credited).toMatchObject({ EL: 18, CL: 6, SL: 6 });
    const ledger = await ledgerRows(employee.id);
    expect(ledger.filter((row) => row.attributes.leave_type === "EL")).toHaveLength(12);
    expect(ledger.filter((row) => row.attributes.leave_type === "CL")).toHaveLength(1);
    expect(ledger.filter((row) => row.attributes.leave_type === "SL")).toHaveLength(1);
  });

  it("T-13 New joiner EL hold and catch-up: no EL until 31 August, a single 9 EL on 1 September (the Q-06 refusal instead while senior_grade_rank is unset)", TIMEOUT, async () => {
    const chain = await actors();
    const questions = await openQuestions(chain.hrHead);
    const employee = await createScenarioEmployee({ test: "T-13", designation: "operator", joiningDate: "2026-03-01" });

    if (questions.seniorGradeRank === null) {
      const run = await runLeaveAccrual(chain.hrHead, { period: "2026-03", mode: "commit", employeeId: employee.id }, rid());
      expectQ06Refusal(run, employee.id);
      return;
    }

    for (let month = 3; month <= 8; month += 1) {
      const period = `2026-${String(month).padStart(2, "0")}`;
      const run = await runLeaveAccrual(chain.hrHead, { period, mode: "commit", employeeId: employee.id }, rid());
      expect(run.blocked, `${period} must not be blocked`).toEqual([]);
      expect(run.credits.filter((credit) => credit.leaveType === "EL"), `${period} must credit no EL`).toEqual([]);
    }
    const lastDayHeld = await runLeaveAccrual(chain.hrHead, { asOf: "2026-08-31", mode: "preview", employeeId: employee.id }, rid());
    expect(lastDayHeld.credits.filter((credit) => credit.leaveType === "EL")).toEqual([]);
    expect((await getBalances(chain.requester, employee.id)).balances.EL).toBe(0);

    const september = await runLeaveAccrual(chain.hrHead, { period: "2026-09", mode: "commit", employeeId: employee.id }, rid());
    expect(september.blocked).toEqual([]);
    const el = september.credits.filter((credit) => credit.leaveType === "EL");
    expect(el).toHaveLength(1);
    expect(el[0]).toMatchObject({ days: 9, basis: "catch_up" });
    expect((await getBalances(chain.requester, employee.id)).balances.EL).toBe(9);
    const ledger = await ledgerRows(employee.id);
    expect(ledger.filter((row) => row.attributes.leave_type === "EL").map((row) => Number(row.attributes.days))).toEqual([9]);
  });

  it("T-14 New joiner CL and SL proration: 6, 4 and 1 for 15 January, 20 April and 2 December; a joiner after 4 December yields the Q-02 refusal (the Q-06 refusal instead while senior_grade_rank is unset)", TIMEOUT, async () => {
    const chain = await actors();
    const questions = await openQuestions(chain.hrHead);
    const cases = [
      { joiningDate: "2026-01-15", days: 6 },
      { joiningDate: "2026-04-20", days: 4 },
      { joiningDate: "2026-12-02", days: 1 },
    ];
    const joiners = [];
    for (const scenario of cases) {
      joiners.push({ ...scenario, employee: await createScenarioEmployee({ test: "T-14", designation: "operator", joiningDate: scenario.joiningDate }) });
    }
    const late = await createScenarioEmployee({ test: "T-14", designation: "operator", joiningDate: "2026-12-05" });

    if (questions.seniorGradeRank === null) {
      for (const joiner of joiners) {
        const run = await runLeaveAccrual(chain.hrHead, { asOf: joiner.joiningDate, mode: "commit", employeeId: joiner.employee.id }, rid());
        expectQ06Refusal(run, joiner.employee.id);
      }
      expectQ06Refusal(await runLeaveAccrual(chain.hrHead, { asOf: "2026-12-05", mode: "commit", employeeId: late.id }, rid()), late.id);
      return;
    }

    for (const joiner of joiners) {
      const run = await runLeaveAccrual(chain.hrHead, { asOf: joiner.joiningDate, mode: "commit", employeeId: joiner.employee.id }, rid());
      expect(run.blocked, `${joiner.joiningDate} must not be blocked`).toEqual([]);
      expect(run.days, `${joiner.joiningDate} CL/SL`).toEqual({ CL: joiner.days, SL: joiner.days });
      expect(run.credits.every((credit) => credit.basis === "joining")).toBe(true);
      const balances = await getBalances(chain.requester, joiner.employee.id);
      expect(balances.balances).toMatchObject({ EL: 0, CL: joiner.days, SL: joiner.days });
    }

    // Joining after 4 December follows the answer to the open question, not an assumption.
    const refused = await runLeaveAccrual(chain.hrHead, { asOf: "2026-12-05", mode: "commit", employeeId: late.id }, rid());
    expect(refused.lines).toBe(0);
    const blocked = refused.blocked.find((entry) => entry.employeeId === late.id);
    expect(blocked?.code).toBe("LEAVE_SCHEME_INCOMPLETE");
    expect(blocked?.message).toMatch(/Q-02/);
    expect(await ledgerRows(late.id), "nothing may be credited, not even a zero").toEqual([]);
  });

  it("T-15 CL cannot be combined with EL or SL: 3 EL for 12–14 June is blocked as contiguous with 2 CL on 10–11 June", TIMEOUT, async () => {
    const chain = await actors();
    const employee = await createScenarioEmployee({ test: "T-15", designation: "operator" });
    const casual = await requestLeave(chain.requester, {
      employeeId: employee.id, leaveType: "CL", startsOn: "2026-06-10", endsOn: "2026-06-11", days: 2, reason: "T-15 casual leave",
    }, rid());
    expect(casual.status).toBe("pending_supervisor");

    const earned = () => requestLeave(chain.requester, {
      employeeId: employee.id, leaveType: "EL", startsOn: "2026-06-12", endsOn: "2026-06-14", days: 3, reason: "T-15 earned leave straight after",
    }, rid());
    await expect(earned()).rejects.toMatchObject({ code: "POLICY_VIOLATION" });
    await expect(earned()).rejects.toThrow(/contiguous/);
    await expect(earned()).rejects.toThrow(/EL cannot be combined with CL/);

    const tenant = await tenantId();
    const requests = (await db()`select leave_type from leave_requests where tenant_id = ${tenant} and employee_id = ${employee.id}`) as Array<{ leave_type: string }>;
    expect(requests).toEqual([{ leave_type: "CL" }]);
  });

  it("T-16 Monthly caps hold: blocked at the third CL day and the eleventh EL day", TIMEOUT, async () => {
    const chain = await actors();
    const casualEmployee = await createScenarioEmployee({ test: "T-16", designation: "operator" });
    const earnedEmployee = await createScenarioEmployee({ test: "T-16", designation: "operator" });

    // 2 CL in July are within the cap; the third CL day in July is blocked.
    const twoCl = await requestLeave(chain.requester, {
      employeeId: casualEmployee.id, leaveType: "CL", startsOn: "2026-07-06", endsOn: "2026-07-07", days: 2, reason: "T-16 two casual days",
    }, rid());
    expect(twoCl.status).toBe("pending_supervisor");
    const thirdCl = () => requestLeave(chain.requester, {
      employeeId: casualEmployee.id, leaveType: "CL", startsOn: "2026-07-13", endsOn: "2026-07-13", days: 1, reason: "T-16 third casual day",
    }, rid());
    await expect(thirdCl()).rejects.toMatchObject({ code: "POLICY_VIOLATION" });
    await expect(thirdCl()).rejects.toThrow(/CL is limited to 2 days per month/);
    // A single application for 3 CL in a month is blocked the same way.
    await expect(requestLeave(chain.requester, {
      employeeId: casualEmployee.id, leaveType: "CL", startsOn: "2026-08-03", endsOn: "2026-08-05", days: 3, reason: "T-16 three casual days at once",
    }, rid())).rejects.toThrow(/CL is limited to 2 days per month/);

    // 10 EL in July are within the cap; the eleventh EL day in July is blocked.
    const tenEl = await requestLeave(chain.requester, {
      employeeId: earnedEmployee.id, leaveType: "EL", startsOn: "2026-07-01", endsOn: "2026-07-10", days: 10, reason: "T-16 ten earned days",
    }, rid());
    expect(tenEl.status).toBe("pending_supervisor");
    const eleventhEl = () => requestLeave(chain.requester, {
      employeeId: earnedEmployee.id, leaveType: "EL", startsOn: "2026-07-20", endsOn: "2026-07-20", days: 1, reason: "T-16 eleventh earned day",
    }, rid());
    await expect(eleventhEl()).rejects.toMatchObject({ code: "POLICY_VIOLATION" });
    await expect(eleventhEl()).rejects.toThrow(/EL is limited to 10 days per month/);
    await expect(requestLeave(chain.requester, {
      employeeId: earnedEmployee.id, leaveType: "EL", startsOn: "2026-08-03", endsOn: "2026-08-13", days: 11, reason: "T-16 eleven earned days at once",
    }, rid())).rejects.toThrow(/EL is limited to 10 days per month/);

    const tenant = await tenantId();
    const requests = (await db()`
      select employee_id, leave_type, requested_days::float as days from leave_requests
      where tenant_id = ${tenant} and employee_id = any(${[casualEmployee.id, earnedEmployee.id]}::uuid[]) order by leave_type
    `) as Array<{ employee_id: string; leave_type: string; days: number }>;
    expect(requests).toEqual([
      { employee_id: casualEmployee.id, leave_type: "CL", days: 2 },
      { employee_id: earnedEmployee.id, leave_type: "EL", days: 10 },
    ]);
  });

  it("T-17 Year end encashes EL and lapses CL and SL: preview and commit report identical figures, 7 EL encashed and 5 days lapsed", TIMEOUT, async () => {
    const chain = await actors();
    const employee = await createScenarioEmployee({ test: "T-17", designation: "operator", joiningDate: "2024-01-15" });
    // The scenario's setup is a stated closing balance of 7 EL, 2 CL and 3 SL.
    await creditLedger(chain.hrHead, employee.id, "EL", 7, "2025-06-30");
    await creditLedger(chain.hrHead, employee.id, "CL", 2, "2025-06-30");
    await creditLedger(chain.hrHead, employee.id, "SL", 3, "2025-06-30");
    expect((await getBalances(chain.requester, employee.id, "2025-12-31")).balances).toMatchObject({ EL: 7, CL: 2, SL: 3 });

    const figures = (result: YearEndResult) => ({
      asAt: result.asAt,
      employees: result.employees,
      encashedDays: result.encashedDays,
      lapsedDays: result.lapsedDays,
      carriedForwardDays: result.carriedForwardDays,
      lines: [...result.lines].sort((left, right) => left.leaveType.localeCompare(right.leaveType)),
    });

    const preview = await runLeaveYearEnd(chain.hrHead, { year: 2025, mode: "preview", employeeId: employee.id }, rid());
    expect(preview.mode).toBe("preview");
    expect(preview.unconfigured).toEqual([]);
    // Preview writes nothing.
    expect((await getBalances(chain.requester, employee.id, "2025-12-31")).balances).toMatchObject({ EL: 7, CL: 2, SL: 3 });

    const commit = await runLeaveYearEnd(chain.hrHead, { year: 2025, mode: "commit", employeeId: employee.id }, rid());
    expect(commit.mode).toBe("commit");
    expect(figures(commit)).toEqual(figures(preview));
    expect(commit.employees).toBe(1);
    expect(commit.encashedDays).toBe(7);
    expect(commit.lapsedDays).toBe(5);
    expect(commit.carriedForwardDays).toBe(0);
    expect(figures(commit).lines).toEqual([
      { employeeId: employee.id, employeeCode: employee.code, leaveType: "CL", closingBalance: 2, treatment: "lapse", days: 2 },
      { employeeId: employee.id, employeeCode: employee.code, leaveType: "EL", closingBalance: 7, treatment: "encash", days: 7 },
      { employeeId: employee.id, employeeCode: employee.code, leaveType: "SL", closingBalance: 3, treatment: "lapse", days: 3 },
    ]);

    // The commit posted the movements, and they reduce the balance to nothing.
    const ledger = (await ledgerRows(employee.id)).filter((row) => row.attributes.source === "leave.year_end:2025");
    expect(ledger.map((row) => [row.attributes.leave_type, row.attributes.kind, Number(row.attributes.days)]).sort()).toEqual([
      ["CL", "lapse", 2],
      ["EL", "encash", 7],
      ["SL", "lapse", 3],
    ]);
    expect(ledger.every((row) => row.attributes.effective_date === "2025-12-31")).toBe(true);
    expect((await getBalances(chain.requester, employee.id, "2025-12-31")).balances).toMatchObject({ EL: 0, CL: 0, SL: 0 });

    // A second commit finds the year already processed and encashes nothing again.
    const again = await runLeaveYearEnd(chain.hrHead, { year: 2025, mode: "commit", employeeId: employee.id }, rid());
    expect(again.lines).toEqual([]);
    expect(again.alreadyProcessed).toBe(1);
  });
});
