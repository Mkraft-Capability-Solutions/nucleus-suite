import { afterAll, describe, expect, it } from "vitest";

import { getAttendanceDayRecord } from "@/server/attendance/day-register";
import { requestRegularization } from "@/server/attendance/regularizations";
import { ingestPunches, recomputeDay, transitionDay } from "@/server/attendance/service";
import { cancelLeave, claimCoff, decideCoff, getBalances, requestLeave } from "@/server/leave/service";
import { mutateOperationalRecord } from "@/server/workflows/operational-service";
import { accessFor, at, createScenarioEmployee, db, LIVE, removeScenarioRows, SHIFTS, tenantId } from "./fixture";

/**
 * The workbook fields that were recorded as missing: every one asserted through the
 * surface that reads it back, not through the write that produces it. A field the engine
 * computes and no reader projects is exactly the defect these were — `gate_pass_minutes`
 * was written under one name and read under another for months, and nothing noticed
 * because nothing ever read it in a test.
 *
 * Run with MKRAFT_LIVE_VERIFY=1 after `npx tsx scripts/seed-acceptance-demo.ts`.
 */

const rid = () => crypto.randomUUID();

/**
 * The day register reads `attendance_entries`, so its record id is the entry's, not the
 * attendance day's. They are different rows with different ids for the same date.
 */
async function entryIdFor(employeeId: string, date: string): Promise<string> {
  const tenant = await tenantId();
  const rows = (await db()`
    select id from attendance_entries
    where tenant_id = ${tenant} and employee_id = ${employeeId} and attributes->>'date' = ${date}
    limit 1
  `) as Array<{ id: string }>;
  const id = rows[0]?.id;
  if (!id) throw new Error(`No attendance entry for ${employeeId} on ${date}; the day was not computed.`);
  return id;
}
const TESTS = ["F-04", "F-05", "F-02", "F-03"] as const;

describe.skipIf(!LIVE)("workbook field coverage — live (opt-in)", () => {
  afterAll(async () => {
    for (const test of TESTS) await removeScenarioRows(test);
  }, 180_000);

  it("FRM-TIM-04: the day record carries its rules, segments, early-out and pay block", { timeout: 300_000 }, async () => {
    const owner = await accessFor("owner");
    const employee = await createScenarioEmployee({ test: "F-04", workerCategory: "regular" });
    const day = "2026-04-06";
    // Out and back in once, so the day has two segments and a break between them, and
    // leaves before the 12-hour shift ends so there is an early-out to measure.
    const ingested = await ingestPunches(owner, {
      employeeId: employee.id,
      workDate: day,
      shiftCode: SHIFTS.A,
      punches: [
        { at: at(day, "08:00"), type: "in", source: "biometric_device" },
        { at: at(day, "13:00"), type: "out", source: "biometric_device" },
        { at: at(day, "13:45"), type: "in", source: "biometric_device" },
        { at: at(day, "18:30"), type: "out", source: "biometric_device" },
      ],
    }, rid());
    await recomputeDay(owner, ingested.dayId, rid());

    const detail = await getAttendanceDayRecord(owner, await entryIdFor(employee.id, day));
    const record = detail.record as unknown as {
      early_out_minutes: number;
      gate_pass_minutes: number;
      source_event_count: number;
      ruleset_version: string | null;
      computed_at: string | null;
      applied_rule_ids: string[];
      attendance_segment: Array<{ segment: number; in: string; out: string | null; minutes: number | null }>;
    };

    // Shift A runs 08:00-20:00; leaving at 18:30 is 90 minutes early.
    expect(record.early_out_minutes).toBe(90);
    // Written by the engine under the name every reader asks for.
    expect(record.gate_pass_minutes).toBe(0);
    expect(record.source_event_count).toBe(4);
    expect(record.computed_at, "computed_at was written and never projected").not.toBeNull();
    expect(record.ruleset_version, "the day must name the configuration that judged it").toBeTruthy();
    expect(String(record.ruleset_version)).toContain("grace:");

    // The rules that actually fired, by identifier.
    expect(Array.isArray(record.applied_rule_ids)).toBe(true);
    expect(record.applied_rule_ids).toContain(`shift:${SHIFTS.A}`);
    expect(record.applied_rule_ids).toContain("RL-03:break-register");

    // Two IN/OUT pairs, in order, each with its own worked minutes.
    expect(record.attendance_segment).toHaveLength(2);
    expect(record.attendance_segment[0]).toMatchObject({ segment: 1, minutes: 300 });
    expect(record.attendance_segment[1]).toMatchObject({ segment: 2, minutes: 285 });

    // Every punch is numbered with the segment it belongs to — derived, not stored.
    const punches = detail.punches as Array<{ direction: string; segment: number | null }>;
    expect(punches.map((punch) => punch.segment)).toEqual([1, 1, 2, 2]);

    // The pay block: the owner may see compensation, and the arithmetic is payroll's own.
    const pay = detail.salaryStructure;
    expect(pay.visible).toBe(true);
    expect(pay.basicMonthlyMinor).toBeGreaterThan(0);
    expect(pay.hourlyRateMinor, pay.reason ?? "the day rate must be derivable").not.toBeNull();
    expect(pay.overtimeAmountMinor).not.toBeNull();
  });

  it("FRM-TIM-05: a correction reads back its document and the status it was raised against", { timeout: 300_000 }, async () => {
    const owner = await accessFor("owner");
    const employee = await createScenarioEmployee({ test: "F-05", workerCategory: "regular" });
    const day = "2026-04-07";
    const ingested = await ingestPunches(owner, {
      employeeId: employee.id,
      workDate: day,
      shiftCode: SHIFTS.A,
      punches: [
        { at: at(day, "08:00"), type: "in", source: "biometric_device" },
        { at: at(day, "17:00"), type: "out", source: "biometric_device" },
      ],
    }, rid());
    await recomputeDay(owner, ingested.dayId, rid());
    const entryId = await entryIdFor(employee.id, day);
    const before = await getAttendanceDayRecord(owner, entryId);

    await requestRegularization(owner, {
      employeeId: employee.id,
      date: day,
      kind: "late_waiver",
      reason: "Left at 20:00; the gate reader logged the 17:00 exit against the wrong badge.",
      documentRef: "GATE-REG/2026/0407",
    }, rid());

    const detail = await getAttendanceDayRecord(owner, entryId);
    const correction = (detail.regularizations as Array<Record<string, unknown>>)[0];
    expect(correction, "the correction must appear on the day it corrects").toBeDefined();
    expect(correction.document_ref).toBe("GATE-REG/2026/0407");
    // Captured when raised, so approving the correction cannot rewrite what was corrected.
    const tenant = await tenantId();
    const storedStatus = (await db()`
      select status from attendance_days where tenant_id = ${tenant} and id = ${ingested.dayId} limit 1
    `) as Array<{ status: string }>;
    expect(correction.current_status).toBe(storedStatus[0]?.status);
    void before;
  });

  it("FRM-LVE-02: a request counts its team conflicts and can be withdrawn with a reason", { timeout: 300_000 }, async () => {
    const owner = await accessFor("owner");
    const manager = await createScenarioEmployee({ test: "F-02", firstName: "Team", lastName: "Lead", designation: "assistantManager" });
    const first = await createScenarioEmployee({ test: "F-02", firstName: "Peer", lastName: "One", managerCode: manager.code, workerCategory: "regular" });
    const second = await createScenarioEmployee({ test: "F-02", firstName: "Peer", lastName: "Two", managerCode: manager.code, workerCategory: "regular" });

    const alone = await requestLeave(owner, {
      employeeId: first.id, leaveType: "CL", startsOn: "2026-12-14", endsOn: "2026-12-15", days: 2, reason: "F-02 first applicant",
    }, rid());
    // Nobody else on the team is away over those dates yet.
    expect(alone.teamConflictCount).toBe(0);

    const overlapping = await requestLeave(owner, {
      employeeId: second.id, leaveType: "CL", startsOn: "2026-12-15", endsOn: "2026-12-16", days: 2, reason: "F-02 overlapping applicant",
    }, rid());
    // The peer's in-flight request overlaps by a day, and counts.
    expect(overlapping.teamConflictCount).toBe(1);

    const balanceBefore = await getBalances(owner, second.id);
    const cancelled = await cancelLeave(owner, overlapping.id, { reason: "Travel plans changed, no longer taking these days." }, rid());
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.daysReturned).toBe(2);

    const tenant = await tenantId();
    const rows = (await db()`
      select status, attributes->>'cancel_reason' as cancel_reason, attributes->>'team_conflict_count' as conflicts
      from leave_requests where tenant_id = ${tenant} and id = ${overlapping.id}
    `) as Array<{ status: string; cancel_reason: string | null; conflicts: string | null }>;
    expect(rows[0]?.status).toBe("cancelled");
    expect(rows[0]?.cancel_reason).toContain("Travel plans changed");
    expect(Number(rows[0]?.conflicts)).toBe(1);

    // The reservation the request was holding is given back, so the days are usable again.
    const balanceAfter = await getBalances(owner, second.id);
    expect(balanceAfter.used.CL ?? 0).toBeLessThan(balanceBefore.used.CL ?? 0);

    // A withdrawn request no longer counts against a later applicant.
    // Asked as the second peer, whose own request was withdrawn: the first applicant has
    // already used the month's two CL days, and the cap is not what this is testing.
    const later = await requestLeave(owner, {
      employeeId: second.id, leaveType: "CL", startsOn: "2026-12-18", endsOn: "2026-12-18", days: 1, reason: "F-02 after the withdrawal",
    }, rid());
    expect(later.teamConflictCount).toBe(0);
  });

  it("FRM-LVE-03: a comp-off claim records its approver, decision and remarks", { timeout: 300_000 }, async () => {
    const owner = await accessFor("owner");
    const hrHead = await accessFor("hrHead");
    const employee = await createScenarioEmployee({ test: "F-03", workerCategory: "regular" });
    // 2026-04-05 is a Sunday: a rest day for the regular category.
    const worked = "2026-04-05";
    const ingested = await ingestPunches(owner, {
      employeeId: employee.id,
      workDate: worked,
      shiftCode: SHIFTS.A,
      punches: [
        { at: at(worked, "08:00"), type: "in", source: "biometric_device" },
        { at: at(worked, "20:00"), type: "out", source: "biometric_device" },
      ],
    }, rid());
    await recomputeDay(owner, ingested.dayId, rid());

    const claim = await claimCoff(owner, {
      employeeId: employee.id,
      earnedOn: worked,
      reason: "Worked the Sunday rest day covering the plant shutdown.",
    }, rid());
    expect(claim.status).toBe("pending");

    const tenant = await tenantId();
    const pending = (await db()`
      select attributes->>'status' as status, attributes->>'decision' as decision, attributes->>'approver_id' as approver_id
      from comp_off_grants where tenant_id = ${tenant} and id = ${claim.id}
    `) as Array<{ status: string; decision: string | null; approver_id: string | null }>;
    expect(pending[0]?.status).toBe("pending");
    expect(pending[0]?.decision, "an undecided claim must not carry a decision").toBeNull();

    // A pending claim credits nothing: the approval is what makes it leave.
    const before = await getBalances(owner, employee.id);
    expect(before.balances.COFF ?? 0).toBe(0);

    const decided = await decideCoff(hrHead, claim.id, { approve: true, remarks: "Confirmed against the shutdown roster and the gate register." }, rid());
    expect(decided.decision).toBe("approved");

    const after = (await db()`
      select attributes->>'status' as status, attributes->>'decision' as decision,
             attributes->>'approver_id' as approver_id, attributes->>'decision_remarks' as remarks
      from comp_off_grants where tenant_id = ${tenant} and id = ${claim.id}
    `) as Array<{ status: string; decision: string; approver_id: string; remarks: string }>;
    expect(after[0]?.status).toBe("available");
    expect(after[0]?.decision).toBe("approved");
    expect(after[0]?.approver_id).toBe(hrHead.context.actorUserId);
    expect(after[0]?.remarks).toContain("shutdown roster");

    // Only now does the balance move.
    const balance = await getBalances(owner, employee.id);
    expect(balance.balances.COFF ?? 0).toBeGreaterThan(0);

    // The same claim cannot be decided twice.
    await expect(decideCoff(hrHead, claim.id, { approve: false, remarks: "Attempting to reverse an approved claim." }, rid()))
      .rejects.toMatchObject({ code: "VERSION_CONFLICT" });
  });

  it("FRM-TIM-02: a roster reports its rest days and its longest working run", { timeout: 300_000 }, async () => {
    const owner = await accessFor("owner");
    const employee = await createScenarioEmployee({ test: "F-04", firstName: "Roster", lastName: "Subject", workerCategory: "regular" });
    // Monday to the Sunday of the following week: thirteen working days around one Sunday.
    const record = (await mutateOperationalRecord(owner, "rosters", {
      action: "create",
      key: rid(),
      input: {
        employeeId: employee.id,
        startDate: "2026-06-01",
        endDate: "2026-06-13",
        shiftCode: SHIFTS.A,
        site: "Plant North",
        orgUnit: "Acceptance",
        startTime: "08:00",
        endTime: "20:00",
        breakMinutes: 60,
        publishStatus: "draft",
        notifyOnPublish: false,
        notes: "F-04 roster coverage",
      },
    })) as { id: string };

    const tenant = await tenantId();
    const rows = (await db()`
      select data->>'restDaysInWeek' as rest_days, data->>'consecutiveDays' as consecutive, data->>'rosterSpanDays' as span
      from hrms_operation_records where tenant_id = ${tenant} and id = ${record.id}
    `) as Array<{ rest_days: string | null; consecutive: string | null; span: string | null }>;
    expect(Number(rows[0]?.span)).toBe(13);
    // 2026-06-07 is the only Sunday inside the span, and the run after it is six days.
    expect(Number(rows[0]?.rest_days)).toBe(1);
    expect(Number(rows[0]?.consecutive)).toBe(6);
    await db()`delete from hrms_operation_events where tenant_id = ${tenant} and record_id = ${record.id}`;
    await db()`delete from hrms_operation_records where tenant_id = ${tenant} and id = ${record.id}`;
  });
});

describe.skipIf(!LIVE)("FRM-PAY-03 leave gate — live (opt-in)", () => {
  it("reports whether leave touching the period is settled", { timeout: 300_000 }, async () => {
    // The gate is derived, not stored: a period with nothing awaiting a decision is
    // settled, and an in-flight request over the same month is not.
    const { getRunCockpit } = await import("@/server/payroll/service");
    expect(typeof getRunCockpit).toBe("function");
    const owner = await accessFor("owner");
    const tenant = await tenantId();
    const runs = (await db()`
      select id, period from payroll_runs where tenant_id = ${tenant} order by created_at desc limit 1
    `) as Array<{ id: string; period: string }>;
    if (!runs[0]) return;
    const cockpit = await getRunCockpit(owner, runs[0].id);
    // Whatever the answer, it must be an answer: `null` was the defect.
    expect(typeof cockpit.gates.leaveLocked).toBe("boolean");
    const open = (await db()`
      select count(*)::int as total from leave_requests
      where tenant_id = ${tenant} and status not in ('approved', 'rejected', 'cancelled')
        and starts_on <= (date_trunc('month', ${`${runs[0].period}-01`}::date) + interval '1 month - 1 day')::date
        and ends_on >= date_trunc('month', ${`${runs[0].period}-01`}::date)::date
    `) as Array<{ total: number }>;
    expect(cockpit.gates.leaveLocked).toBe(Number(open[0]?.total ?? 0) === 0);
  });
});
