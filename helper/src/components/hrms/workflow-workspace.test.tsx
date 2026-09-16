// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkflowWorkspace } from "./workflow-workspace";
import { invalidateGetRequests } from "@/lib/client-api";

vi.mock("next/link", () => ({ default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...props}>{children}</a> }));
vi.mock("./workspace-provider", () => ({ useWorkspace: () => ({ loading: false, workspace: { context: { tenantId: "tenant-a", permissions: ["employee.read", "employee.write"] } } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const request = vi.fn();
beforeEach(() => { invalidateGetRequests(); vi.stubGlobal("fetch", request); request.mockReset(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("workflow forms", () => {
  it("submits typed course inputs and shows success after server acceptance", async () => {
    request.mockImplementation(async (_path: string, init?: RequestInit) => ({ ok: true, json: async () => init?.method === "POST" ? { data: { id: "course-1", title: "Safety" } } : { data: [] } }));
    render(<WorkflowWorkspace module="learning" section="courses"><p>Overview</p></WorkflowWorkspace>);
    fireEvent.click(screen.getByRole("button", { name: /create.*submit|create course/i }));
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: "SAFE" } });
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: "Safety" } });
    fireEvent.change(screen.getByLabelText(/^Duration minutes/i), { target: { value: "45" } });
    fireEvent.click(screen.getAllByRole("button", { name: /create.*submit|create course/i }).at(-1)!);
    await screen.findByText("Saved successfully.");
    const call = request.mock.calls.find(([, init]) => init?.method === "POST");
    expect(call?.[0]).toBe("/api/v1/courses");
    expect(JSON.parse(call?.[1].body)).toEqual({ code: "SAFE", title: "Safety", mandatory: false, durationMinutes: 45 });
    expect(call?.[1].headers["Idempotency-Key"]).toBeTruthy();
  });
  it("preserves rejected input and does not report success", async () => {
    request.mockImplementation(async (_path: string, init?: RequestInit) => init?.method === "POST" ? { ok: false, status: 422, json: async () => ({ error: { message: "Course code already exists." } }) } : { ok: true, json: async () => ({ data: [] }) });
    render(<WorkflowWorkspace module="learning" section="courses"><p>Overview</p></WorkflowWorkspace>);
    fireEvent.click(screen.getByRole("button", { name: /create.*submit|create course/i }));
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: "SAFE" } });
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: "Safety" } });
    fireEvent.click(screen.getAllByRole("button", { name: /create.*submit|create course/i }).at(-1)!);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Course code already exists."));
    expect(screen.getByLabelText(/^Title/)).toHaveValue("Safety");
    expect(screen.queryByText("Saved successfully.")).toBeNull();
  });
  it("keeps record actions beside a selected employee and prefills its reference and version", async () => {
    request.mockResolvedValue({ ok: true, json: async () => ({ data: [{ id: "employee-1", version: 3, attributes: { firstName: "Asha", lastName: "Singh" } }] }) });
    render(<WorkflowWorkspace module="people" section="directory"><p>Overview</p></WorkflowWorkspace>);
    expect(screen.queryByRole("button", { name: /update employee/i })).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: "Select / view" }));
    fireEvent.click(screen.getByRole("button", { name: /update employee/i }));
    expect(screen.getByLabelText(/^Record/)).toHaveValue("employee-1");
    expect(screen.getByLabelText(/^Current record version/)).toHaveValue(3);
  });

});
