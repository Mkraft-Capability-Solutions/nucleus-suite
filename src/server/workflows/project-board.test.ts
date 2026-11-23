import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Access } from "@/server/platform/access";

const mocks = vi.hoisted(() => ({ enforce: vi.fn(), tenantTx: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ sqlClient: (strings: TemplateStringsArray, ...values: unknown[]) => ({ text: strings.join("?"), values }) }));
vi.mock("@/server/platform/access", () => ({
  enforce: mocks.enforce,
  tenantTx: mocks.tenantTx,
  uuidOrNull: (value: string | null | undefined) => (value && /^[0-9a-f-]{36}$/i.test(value) ? value : null),
}));

const { createProject, createProjectSchema, createTask, createTaskSchema, loadProjectBoard, moveTask, moveTaskSchema } = await import("./project-board");

const EMP = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const PROJECT = "33333333-3333-4333-8333-333333333333";
const TASK = "44444444-4444-4444-8444-444444444444";

function accessWith(permissions: string[], employeeId: string | null = EMP): Access {
  return { tenantId: "t-1", context: { actorUserId: "u-1", membershipId: "m-1", tenantId: "t-1", employeeId, permissions, roles: [] } } as unknown as Access;
}

describe("project board schemas", () => {
  it("validates projects, tasks and one-column moves", () => {
    expect(createProjectSchema.safeParse({ title: "Payroll revamp" }).success).toBe(true);
    expect(createProjectSchema.safeParse({ title: "x" }).success).toBe(false);
    expect(createProjectSchema.safeParse({ title: "Payroll revamp", dueDate: "next week" }).success).toBe(false);
    expect(createTaskSchema.safeParse({ projectId: PROJECT, title: "Audit tokens", tag: "design" }).success).toBe(true);
    expect(createTaskSchema.safeParse({ projectId: "Website Redesign", title: "Audit tokens", tag: "design" }).success).toBe(false);
    expect(moveTaskSchema.safeParse({ from: "todo", to: "inprogress" }).success).toBe(true);
    expect(moveTaskSchema.safeParse({ from: "review", to: "inprogress" }).success).toBe(true);
    expect(moveTaskSchema.safeParse({ from: "todo", to: "done" }).success).toBe(false);
  });
});

describe("loadProjectBoard", () => {
  beforeEach(() => {
    mocks.enforce.mockReset();
    mocks.tenantTx.mockReset();
  });

  it("hides private and unrelated team projects from a self-scoped employee and derives progress", async () => {
    mocks.tenantTx
      .mockResolvedValueOnce([
        [
          { id: PROJECT, status: "active", attributes: { kind: "project", title: "Mine", visibility: "team", member_employee_ids: [EMP] }, created_at: "2026-11-01T00:00:00Z" },
          { id: "p-private", status: "active", attributes: { kind: "project", title: "Secret", visibility: "private", member_employee_ids: [EMP] }, created_at: null },
          { id: "p-other", status: "active", attributes: { kind: "project", title: "Theirs", visibility: "team", member_employee_ids: [OTHER] }, created_at: null },
        ],
        [
          { id: TASK, status: "active", attributes: { kind: "task", project_id: PROJECT, title: "A", column: "done", assignee_employee_id: EMP }, created_at: null },
          { id: "t-2", status: "active", attributes: { kind: "task", project_id: PROJECT, title: "B", column: "todo" }, created_at: null },
          { id: "t-3", status: "active", attributes: { kind: "task", project_id: "p-other", title: "C", column: "todo" }, created_at: null },
        ],
      ])
      .mockResolvedValueOnce([[{ id: EMP, first_name: "Asha", last_name: "Rao", employee_code: "E-1" }]]);

    const board = await loadProjectBoard(accessWith(["workforce.projects.self.read"]));
    expect(mocks.enforce).toHaveBeenCalledWith(expect.anything(), "workforce.projects.self.read", { tenantId: "t-1" });
    expect(board.projects.map((project) => project.id)).toEqual([PROJECT]);
    expect(board.projects[0]).toMatchObject({ progressPercent: 50, viewerTaskCount: 1, members: [{ employeeId: EMP, name: "Asha Rao" }] });
    expect(board.tasks.map((task) => task.id)).toEqual([TASK, "t-2"]);
    expect(board.tasks[0]).toMatchObject({ assignedToViewer: true, assigneeName: "Asha Rao" });
  });

  it("reports null progress, not zero, for a project without tasks", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[{ id: PROJECT, status: "active", attributes: { kind: "project", title: "Empty", visibility: "all" }, created_at: null }], []]);
    const board = await loadProjectBoard(accessWith(["workforce.projects.read"]));
    expect(board.projects[0]?.progressPercent).toBeNull();
    expect(board.viewer.scope).toBe("all");
  });
});

describe("project writes", () => {
  beforeEach(() => {
    mocks.enforce.mockReset();
    mocks.tenantTx.mockReset();
  });

  it("refuses unknown pod members", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[]]);
    const input = createProjectSchema.parse({ title: "Payroll revamp", memberEmployeeIds: [OTHER] });
    await expect(createProject(accessWith(["workforce.projects.write"]), input, "req-1")).rejects.toMatchObject({ status: 422 });
  });

  it("creates a project with an audit row", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[], []]);
    const input = createProjectSchema.parse({ title: "Payroll revamp" });
    const result = await createProject(accessWith(["workforce.projects.write"]), input, "req-1");
    expect(result.title).toBe("Payroll revamp");
    const statements = mocks.tenantTx.mock.calls[1]?.[1] as Array<{ text: string }>;
    expect(statements.some((statement) => statement.text.includes("audit_events"))).toBe(true);
  });

  it("returns 404 for a task in a project the caller cannot see", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[{ id: PROJECT, status: "active", attributes: { kind: "project", visibility: "private", created_by_membership_id: "someone" } }], []]);
    const input = createTaskSchema.parse({ projectId: PROJECT, title: "Audit tokens", tag: "dev" });
    await expect(createTask(accessWith(["workforce.projects.self.write"]), input, "req-1")).rejects.toMatchObject({ status: 404 });
  });

  it("rejects a stale move with 409 and an unknown task with 404", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[{ attributes: { kind: "task", column: "review" } }]]);
    await expect(moveTask(accessWith(["workforce.projects.write"]), TASK, { from: "todo", to: "inprogress" }, "req-1")).rejects.toMatchObject({ status: 409 });
    mocks.tenantTx.mockResolvedValueOnce([[]]);
    await expect(moveTask(accessWith(["workforce.projects.write"]), TASK, { from: "todo", to: "inprogress" }, "req-1")).rejects.toMatchObject({ status: 404 });
  });

  it("only lets a self-scoped employee move their own tasks", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[{ attributes: { kind: "task", column: "todo", assignee_employee_id: OTHER, created_by_membership_id: "m-9" } }]]);
    await expect(moveTask(accessWith(["workforce.projects.self.write"]), TASK, { from: "todo", to: "inprogress" }, "req-1")).rejects.toMatchObject({ status: 403 });
  });

  it("moves a task when the column still matches", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[{ attributes: { kind: "task", column: "todo", assignee_employee_id: EMP } }]]).mockResolvedValueOnce([[{ entity_id: TASK }]]);
    await expect(moveTask(accessWith(["workforce.projects.self.write"]), TASK, { from: "todo", to: "inprogress" }, "req-1")).resolves.toEqual({ id: TASK, column: "inprogress" });
  });
});
