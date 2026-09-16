// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invalidateGetRequests } from "@/lib/client-api";
import { OperationalOverview } from "./operational-overview";

vi.mock("next/link", () => ({ default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...props}>{children}</a> }));
vi.mock("./workspace-provider", () => ({ useWorkspace: () => ({ workspace: { context: { permissions: ["workforce.rosters.read", "workforce.rosters.write", "workforce.rosters.approve"] } } }) }));

const request = vi.fn();
beforeEach(() => {
  invalidateGetRequests();
  request.mockReset();
  request.mockImplementation(async (url: string) => ({ ok: true, json: async () => ({ data: url.includes("/operations/rosters") ? [
    { id: "roster-1", version: 1, employeeId: "employee-1", shiftCode: "A", status: "submitted", updatedAt: "2026-09-13T10:00:00Z" },
    { id: "roster-2", version: 2, employeeId: "employee-2", shiftCode: "B", status: "published", updatedAt: "2026-09-12T10:00:00Z" },
  ] : [] }) }));
  vi.stubGlobal("fetch", request);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("operational overview", () => {
  it("shows a working roster dashboard with metrics, work areas and record links", async () => {
    render(<OperationalOverview module="rosters" />);

    expect(screen.getByRole("heading", { name: "Shift Planning & Rosters" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /plan roster/i }).getAttribute("href")).toContain("operations%2Frosters");
    expect(await screen.findByText("2", {}, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByText("Waiting for action")).toBeTruthy();
    expect(screen.getByText("1 Submitted")).toBeTruthy();
    expect(screen.getByText("1 Published")).toBeTruthy();
    expect(screen.getByRole("link", { name: "A shift · Dates pending" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "A shift · Dates pending" }).getAttribute("href")).toContain("record=roster-1");
    // The rosters module carries several configuration resources (shift master, the night
    // extension rule and the grace/late policy), so "No records yet" is no longer unique to
    // one tile. The assertion names the tile it means instead of relying on there being
    // only one empty card on the dashboard.
    const shiftMaster = screen.getByRole("heading", { name: "Shift master" }).closest("[data-resource]") ?? screen.getByRole("heading", { name: "Shift master" }).parentElement;
    expect(shiftMaster).toBeTruthy();
    expect(within(shiftMaster as HTMLElement).getByText("No records yet")).toBeTruthy();
    expect(request.mock.calls.map(call => call[0])).toContain("/api/v1/operations/rosters?pageSize=100");
    expect(request.mock.calls.map(call => call[0])).toContain("/api/v1/operations/shifts?pageSize=100");
    expect(screen.queryByText(/Open a workflow tab above/)).toBeNull();
  });
});
