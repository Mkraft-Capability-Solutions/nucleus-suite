import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Core HR remaining registers (Org + Attendance + Leave)", () => {
  const org = readFileSync(resolve(process.cwd(), "src/components/hrms/org-registers.tsx"), "utf8");
  const attLeave = readFileSync(resolve(process.cwd(), "src/components/hrms/attendance-leave-registers.tsx"), "utf8");
  const attPunch = readFileSync(resolve(process.cwd(), "src/components/hrms/attendance-punch-registers.tsx"), "utf8");
  const attOps = readFileSync(resolve(process.cwd(), "src/components/hrms/attendance-ops-registers.tsx"), "utf8");
  // SCR-020..027 live in the two attendance register files; SCR-030..032 remain here.
  const attendance = attLeave + attPunch + attOps;
  const moduleView = readFileSync(resolve(process.cwd(), "src/components/hrms/module-view.tsx"), "utf8");
  const guides = readFileSync(resolve(process.cwd(), "src/lib/workflow-catalog.ts"), "utf8");

  it("promotes org granular routes to bespoke pages", () => {
    for (const page of [
      "PositionRegisterPage",
      "SanctionedStrengthBoardPage",
      "AssignmentPolicyAttributesPage",
      "AccessScopeAdministrationPage",
      "StatutoryCompliancePage",
    ]) {
      expect(org).toContain(`export function ${page}`);
      expect(moduleView).toContain(page);
    }
    for (const route of [
      '"position-register": PositionRegisterPage',
      '"sanctioned-strength-board": SanctionedStrengthBoardPage',
      '"assignment-policy-attributes": AssignmentPolicyAttributesPage',
      '"access-scope-administration": AccessScopeAdministrationPage',
    ]) {
      expect(moduleView).toContain(route);
    }
  });

  it("promotes attendance and leave granular routes to bespoke pages", () => {
    for (const page of [
      "CheckInOutPage",
      "MyAttendanceHistoryPage",
      "AttendanceDayDetailPage",
      "GatePassRegisterPage",
      "OvertimeRegisterPage",
      "AttendanceExceptionQueuePage",
      "AttendanceRecomputeMonitorPage",
      "TeamHistoryPage",
      "LeaveRequestsPage",
      "LeaveBalanceLedgerPage",
      "LeavePolicyConfigurationPage",
    ]) {
      expect(attendance).toContain(`export function ${page}`);
      expect(moduleView).toContain(page);
    }
  });

  it("reads only governed endpoints without inventing numbers", () => {
    for (const path of [
      "/api/v1/organization/positions/register",
      "/api/v1/organization/sanctioned-strength",
      "/api/v1/dossier/employments",
      "/api/v1/dossier/assignments",
      "/api/v1/access-scopes",
      "/api/v1/memberships",
      "/api/v1/roles",
      "/api/v1/compliance/obligations",
      "/api/v1/compliance/evidence",
      "/api/v1/compliance/forms",
      "/api/v1/attendance/days",
      "/api/v1/attendance/punches",
      "/api/v1/gate-passes",
      "/api/v1/leave-requests",
      "/api/v1/leave-balances",
      // SCR-030..032 read purpose-built registers; comp-off grants are reported
      // on the leave module's expiry clock, not in the posted ledger.
      "/api/v1/attendance/punches/register",
      "/api/v1/attendance/days/register",
      "/api/v1/gate-passes/register",
      "/api/v1/overtime/register",
      "/api/v1/attendance/exceptions/register",
      "/api/v1/attendance/recompute/register",
      "/api/v1/reports/team-history/register",
      "/api/v1/leave-requests/register",
      "/api/v1/leave-balances/ledger",
      "/api/v1/leave-policies/register",
    ]) {
      expect(org + attendance).toContain(path);
    }
    expect(org + attendance).not.toMatch(/Math\.random|sample|demo/i);
  });

  it("documents guides for the remaining registers", () => {
    for (const id of [
      '"position-register"',
      '"sanctioned-strength-board"',
      '"assignment-policy-attributes"',
      '"access-scope-administration"',
      '"statutory-compliance"',
      '"check-in-out"',
      '"my-attendance-history"',
      '"attendance-day-detail"',
      '"gate-pass-register"',
      '"overtime-register"',
      '"attendance-exception-queue"',
      '"attendance-recompute-monitor"',
      '"team-history"',
      '"leave-requests"',
      '"leave-balance-ledger"',
      '"leave-policy-configuration"',
    ]) {
      expect(guides).toContain(id);
    }
  });
});
