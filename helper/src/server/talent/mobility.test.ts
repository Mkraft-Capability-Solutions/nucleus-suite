import { describe, expect, it } from "vitest";

import {
  COMPLETION_EFFECT,
  IJP_POSTING_LINK,
  MOBILITY_ACTIONS,
  MOBILITY_EDITABLE_STATUSES,
  MOBILITY_INITIAL_STATUS,
  MOBILITY_PERMISSION,
  MOBILITY_STATUSES,
  MOBILITY_TRANSITIONS,
  mobilityActionGates,
  mobilityScope,
  mobilityTimeline,
  projectMobilityRow,
  type MobilityAction,
  type MobilityRegisterRaw,
  type MobilityRequestState,
  type MobilityViewer,
} from "./mobility";

const REQUESTER_MEMBERSHIP = "11111111-1111-4111-8111-111111111111";
const APPROVER_MEMBERSHIP = "22222222-2222-4222-8222-222222222222";
const SUBJECT_EMPLOYEE = "33333333-3333-4333-8333-333333333333";
const APPROVER_EMPLOYEE = "44444444-4444-4444-8444-444444444444";

const ALL_PERMISSIONS = [`${MOBILITY_PERMISSION}.read`, `${MOBILITY_PERMISSION}.write`, `${MOBILITY_PERMISSION}.approve`];

function request(overrides: Partial<MobilityRequestState> = {}): MobilityRequestState {
  return {
    status: "submitted",
    employeeId: SUBJECT_EMPLOYEE,
    createdByMembershipId: REQUESTER_MEMBERSHIP,
    reportsToViewer: false,
    ...overrides,
  };
}

function viewer(overrides: Partial<MobilityViewer> = {}): MobilityViewer {
  return {
    employeeId: APPROVER_EMPLOYEE,
    membershipId: APPROVER_MEMBERSHIP,
    permissions: ALL_PERMISSIONS,
    ...overrides,
  };
}

function gate(action: MobilityAction, record: MobilityRequestState, who: MobilityViewer) {
  const found = mobilityActionGates(record, who).find((entry) => entry.action === action);
  if (!found) throw new Error(`no gate produced for ${action}`);
  return found;
}

describe("workflow states (mobility)", () => {
  it("derives its state machine from the operational catalog rather than a second copy", () => {
    expect(MOBILITY_INITIAL_STATUS).toBe("draft");
    expect(MOBILITY_EDITABLE_STATUSES).toEqual(["draft", "returned"]);
    expect(MOBILITY_STATUSES).toEqual(["draft", "submitted", "approved", "returned", "rejected", "cancelled", "completed"]);
    expect(Object.keys(MOBILITY_TRANSITIONS).sort()).toEqual(["approve", "cancel", "complete", "reject", "return", "submit"]);
  });

  it("marks exactly the decision transitions as approval transitions", () => {
    const approvals = MOBILITY_ACTIONS.filter((entry) => MOBILITY_TRANSITIONS[entry.action]?.approval === true).map((entry) => entry.action);
    expect(approvals.sort()).toEqual(["approve", "complete", "reject", "return"]);
    // submit and cancel are requester acts, not decisions.
    expect(MOBILITY_TRANSITIONS.submit.approval).toBeUndefined();
    expect(MOBILITY_TRANSITIONS.cancel.approval).toBeUndefined();
  });
});

describe("legal transitions (mobility)", () => {
  const legal: Array<[MobilityAction, string, string]> = [
    ["submit", "draft", "submitted"],
    ["submit", "returned", "submitted"],
    ["approve", "submitted", "approved"],
    ["return", "submitted", "returned"],
    ["reject", "submitted", "rejected"],
    ["cancel", "draft", "cancelled"],
    ["cancel", "returned", "cancelled"],
    ["cancel", "submitted", "cancelled"],
    ["complete", "approved", "completed"],
  ];

  it.each(legal)("allows %s from %s and lands on %s", (action, from, to) => {
    expect(MOBILITY_TRANSITIONS[action].to).toBe(to);
    expect(gate(action, request({ status: from, reportsToViewer: true }), viewer()).allowed).toBe(true);
  });

  it("offers nothing at all from a terminal state", () => {
    for (const terminal of ["rejected", "cancelled", "completed"]) {
      const gates = mobilityActionGates(request({ status: terminal, reportsToViewer: true }), viewer());
      expect(gates.every((entry) => entry.allowed)).toBe(false);
      expect(gates.some((entry) => entry.allowed)).toBe(false);
    }
  });
});

describe("illegal transitions (mobility)", () => {
  const actions: MobilityAction[] = ["submit", "approve", "return", "reject", "cancel", "complete"];
  const statuses = MOBILITY_STATUSES;

  it("refuses every state and action pair the catalog does not permit, and says which states would", () => {
    const refusals: string[] = [];
    for (const status of statuses) {
      for (const action of actions) {
        const legal = MOBILITY_TRANSITIONS[action].from.includes(status);
        const decision = gate(action, request({ status, reportsToViewer: true }), viewer());
        if (legal) continue;
        refusals.push(`${action}:${status}`);
        expect(decision.allowed).toBe(false);
        expect(decision.reason).toContain("This request is");
        for (const from of MOBILITY_TRANSITIONS[action].from) expect(decision.reason).toContain(from);
      }
    }
    // 7 statuses x 6 actions = 42 pairs, of which 9 are legal.
    expect(refusals).toHaveLength(42 - 9);
  });

  it("cannot approve a draft, complete a submitted request, or submit an approved one", () => {
    expect(gate("approve", request({ status: "draft", reportsToViewer: true }), viewer()).reason).toBe(
      "Approve is only possible from submitted. This request is draft.",
    );
    expect(gate("complete", request({ status: "submitted", reportsToViewer: true }), viewer()).reason).toBe(
      "Complete is only possible from approved. This request is submitted.",
    );
    expect(gate("submit", request({ status: "approved", reportsToViewer: true }), viewer()).reason).toBe(
      "Submit is only possible from draft or returned. This request is approved.",
    );
  });
});

describe("self-approval refusal (mobility)", () => {
  it("refuses the subject employee deciding their own request", () => {
    const subject = viewer({ employeeId: SUBJECT_EMPLOYEE, membershipId: APPROVER_MEMBERSHIP });
    for (const action of ["approve", "return", "reject"] as MobilityAction[]) {
      const decision = gate(action, request({ status: "submitted", reportsToViewer: false }), subject);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe("Nobody may decide their own mobility request. Another approver has to act on it.");
    }
    const completion = gate("complete", request({ status: "approved" }), subject);
    expect(completion.allowed).toBe(false);
    expect(completion.reason).toBe("Nobody may decide their own mobility request. Another approver has to act on it.");
  });

  it("refuses the person who raised the request deciding it, even for somebody else", () => {
    const raiser = viewer({ membershipId: REQUESTER_MEMBERSHIP, employeeId: APPROVER_EMPLOYEE });
    const decision = gate("approve", request({ status: "submitted", reportsToViewer: true }), raiser);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("You raised this request, so you cannot also decide it. Another approver has to act on it.");
  });

  it("still lets the subject employee submit and cancel their own request", () => {
    const subject = viewer({ employeeId: SUBJECT_EMPLOYEE, permissions: [`${MOBILITY_PERMISSION}.self.write`, `${MOBILITY_PERMISSION}.self.read`] });
    expect(gate("submit", request({ status: "draft" }), subject).allowed).toBe(true);
    expect(gate("cancel", request({ status: "submitted" }), subject).allowed).toBe(true);
    expect(gate("approve", request({ status: "submitted" }), subject).allowed).toBe(false);
  });

  it("lets an independent approver who is neither the subject nor the requester decide", () => {
    const decision = gate("approve", request({ status: "submitted" }), viewer());
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toContain("does NOT move the employee");
  });
});

describe("permission scope (mobility)", () => {
  it("never widens write to team and never narrows approve to self", () => {
    expect(mobilityScope([`${MOBILITY_PERMISSION}.team.write`], "write")).toBeNull();
    expect(mobilityScope([`${MOBILITY_PERMISSION}.self.approve`], "approve")).toBeNull();
    expect(mobilityScope([`${MOBILITY_PERMISSION}.self.write`], "write")).toBe("self");
    expect(mobilityScope([`${MOBILITY_PERMISSION}.team.approve`], "approve")).toBe("team");
    expect(mobilityScope([`${MOBILITY_PERMISSION}.team.read`], "read")).toBe("team");
    expect(mobilityScope([`${MOBILITY_PERMISSION}.self.read`], "read")).toBe("self");
    expect(mobilityScope([], "read")).toBeNull();
  });

  it("prefers the widest grant when several are held", () => {
    expect(mobilityScope([`${MOBILITY_PERMISSION}.self.read`, `${MOBILITY_PERMISSION}.read`], "read")).toBe("all");
    expect(mobilityScope([`${MOBILITY_PERMISSION}.self.read`, `${MOBILITY_PERMISSION}.team.read`], "read")).toBe("team");
  });

  it("names the missing permission instead of hiding the action", () => {
    const noApprove = viewer({ permissions: [`${MOBILITY_PERMISSION}.read`, `${MOBILITY_PERMISSION}.write`] });
    expect(gate("approve", request({ status: "submitted" }), noApprove).reason).toBe(
      "Deciding a mobility request needs talent.mobility.approve or talent.mobility.team.approve.",
    );
    const readOnly = viewer({ permissions: [`${MOBILITY_PERMISSION}.read`] });
    expect(gate("submit", request({ status: "draft" }), readOnly).reason).toBe(
      "Changing a mobility request needs talent.mobility.write or talent.mobility.self.write.",
    );
  });

  it("holds a team approver to their own reports and a self writer to their own request", () => {
    const manager = viewer({ permissions: [`${MOBILITY_PERMISSION}.team.read`, `${MOBILITY_PERMISSION}.team.approve`] });
    expect(gate("approve", request({ status: "submitted", reportsToViewer: false }), manager).reason).toBe(
      "Your access covers only the requests of people who report to you, and this employee does not.",
    );
    expect(gate("approve", request({ status: "submitted", reportsToViewer: true }), manager).allowed).toBe(true);

    const employee = viewer({ employeeId: APPROVER_EMPLOYEE, permissions: [`${MOBILITY_PERMISSION}.self.write`] });
    expect(gate("submit", request({ status: "draft" }), employee).reason).toBe(
      "Your access covers only your own mobility requests, and this request belongs to another employee.",
    );
  });

  it("refuses scoped access to an account with no employee profile", () => {
    const unlinked = viewer({ employeeId: null, permissions: [`${MOBILITY_PERMISSION}.self.write`] });
    expect(gate("submit", request({ status: "draft" }), unlinked).reason).toBe(
      "Link this account to its employee profile before using self-service or team workflows.",
    );
  });
});

describe("state timeline (mobility)", () => {
  it("walks draft -> submitted -> decision -> completed", () => {
    expect(mobilityTimeline("draft").map((stage) => stage.state)).toEqual(["current", "pending", "pending", "pending"]);
    expect(mobilityTimeline("submitted", ["draft"]).map((stage) => stage.state)).toEqual(["done", "current", "pending", "pending"]);
    expect(mobilityTimeline("approved", ["draft", "submitted"]).map((stage) => stage.state)).toEqual(["done", "done", "current", "pending"]);
    expect(mobilityTimeline("completed", ["draft", "submitted", "approved"]).map((stage) => stage.state)).toEqual(["done", "done", "done", "current"]);
  });

  it("shows a returned request as back in the requester's hands but having reached a decision", () => {
    const stages = mobilityTimeline("returned", ["draft", "submitted", "returned"]);
    expect(stages.map((stage) => stage.state)).toEqual(["current", "done", "done", "pending"]);
  });

  it("halts the remaining stages once a request is rejected or cancelled", () => {
    expect(mobilityTimeline("rejected", ["draft", "submitted"]).map((stage) => stage.state)).toEqual(["done", "done", "current", "halted"]);
    expect(mobilityTimeline("cancelled", ["draft"]).map((stage) => stage.state)).toEqual(["done", "halted", "halted", "halted"]);
  });

  it("says plainly that the completed stage leaves the employee record alone", () => {
    const completed = mobilityTimeline("completed").find((stage) => stage.id === "completed");
    expect(completed?.detail).toContain("employee record is unchanged");
  });
});

describe("completion honesty (mobility)", () => {
  it("states that completion does not move the employee", () => {
    expect(COMPLETION_EFFECT.doesNot).toContain("does NOT move the employee");
    expect(COMPLETION_EFFECT.doesNot).toContain("People Core");
    expect(COMPLETION_EFFECT.does).toContain("audit trail");
  });

  it("carries that statement on the complete action itself, so it cannot be clicked unread", () => {
    const completion = gate("complete", request({ status: "approved" }), viewer());
    expect(completion.allowed).toBe(true);
    expect(completion.reason).toContain(COMPLETION_EFFECT.does);
    expect(completion.reason).toContain(COMPLETION_EFFECT.doesNot);
  });

  it("declares that no internal job posting link exists", () => {
    expect(IJP_POSTING_LINK.available).toBe(false);
    expect(IJP_POSTING_LINK.detail).toContain("nothing links a mobility request to a requisition or a posting");
  });
});

describe("register projection (mobility)", () => {
  function raw(overrides: Partial<MobilityRegisterRaw> = {}): MobilityRegisterRaw {
    return {
      id: "55555555-5555-4555-8555-555555555555",
      version: "3",
      status: "submitted",
      created_at: new Date("2026-02-01T09:30:00.000Z"),
      updated_at: "2026-02-03T11:00:00.000Z",
      employee_id: SUBJECT_EMPLOYEE,
      created_by_membership_id: REQUESTER_MEMBERSHIP,
      employee_code: "EMP-0042",
      first_name: "Asha",
      last_name: "Rao",
      designation: "Shift Supervisor",
      department: "Weaving",
      location: "Plant 2",
      employee_status: "active",
      reports_to_viewer: true,
      data: {
        targetRole: "Production Planner",
        targetDepartment: "Planning",
        targetLocation: "Plant 1",
        effectiveDate: "2026-04-01",
        motivation: "Wants to move from line supervision into planning.",
        developmentPlan: "Six weeks shadowing the planning desk.",
      },
      ...overrides,
    };
  }

  it("puts the current role beside the requested target and normalises the row", () => {
    const row = projectMobilityRow(raw(), viewer());
    expect(row.employeeName).toBe("Asha Rao");
    expect(row.employeeCode).toBe("EMP-0042");
    expect(row.currentRole).toBe("Shift Supervisor");
    expect(row.currentDepartment).toBe("Weaving");
    expect(row.targetRole).toBe("Production Planner");
    expect(row.targetDepartment).toBe("Planning");
    expect(row.effectiveDate).toBe("2026-04-01");
    expect(row.version).toBe(3);
    expect(row.createdAt).toBe("2026-02-01T09:30:00.000Z");
    expect(row.updatedAt).toBe("2026-02-03T11:00:00.000Z");
    expect(row.alreadyInTargetRole).toBe(false);
  });

  it("flags a request whose target role the employee master already shows", () => {
    expect(projectMobilityRow(raw({ designation: "production planner" }), viewer()).alreadyInTargetRole).toBe(true);
  });

  it("survives an employee row the join could not resolve", () => {
    const row = projectMobilityRow(
      raw({ employee_id: null, employee_code: null, first_name: null, last_name: null, designation: null, department: null, location: null, employee_status: null, reports_to_viewer: null, data: null }),
      viewer(),
    );
    expect(row.employeeName).toBeNull();
    expect(row.currentRole).toBeNull();
    expect(row.targetRole).toBe("");
    expect(row.reportsToViewer).toBe(false);
    // Gating still works off the state machine; a team-scoped approver is now
    // held out because the reporting fact could not be established.
    expect(row.actions.find((action) => action.action === "submit")?.allowed).toBe(false);
    const teamApprover = projectMobilityRow(
      raw({ employee_id: null, reports_to_viewer: null }),
      viewer({ permissions: [`${MOBILITY_PERMISSION}.team.read`, `${MOBILITY_PERMISSION}.team.approve`] }),
    );
    expect(teamApprover.actions.find((action) => action.action === "approve")?.allowed).toBe(false);
  });

  it("gates the row for the viewer who asked, not for everybody", () => {
    const forApprover = projectMobilityRow(raw(), viewer());
    expect(forApprover.isSelf).toBe(false);
    expect(forApprover.raisedByViewer).toBe(false);
    expect(forApprover.actions.find((action) => action.action === "approve")?.allowed).toBe(true);

    const forSubject = projectMobilityRow(raw(), viewer({ employeeId: SUBJECT_EMPLOYEE }));
    expect(forSubject.isSelf).toBe(true);
    expect(forSubject.actions.find((action) => action.action === "approve")?.allowed).toBe(false);
    expect(forSubject.actions.find((action) => action.action === "cancel")?.allowed).toBe(true);
  });

  it("returns one gate per catalog transition, each carrying a reason", () => {
    const row = projectMobilityRow(raw(), viewer());
    expect(row.actions).toHaveLength(Object.keys(MOBILITY_TRANSITIONS).length);
    for (const action of row.actions) expect(action.reason.length).toBeGreaterThan(10);
  });
});
