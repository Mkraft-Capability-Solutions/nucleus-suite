import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/components/hrms/people-pages.tsx"), "utf8");
const primitives = readFileSync(resolve(process.cwd(), "src/components/hrms/register-primitives.tsx"), "utf8");

const organization = source.slice(source.indexOf("const ORGANIZATION_TABS"), source.indexOf("type LaunchedOnboarding"));
const onboarding = source.slice(source.indexOf("const ONBOARDING_TABS"), source.indexOf("type Announcement = {"));

describe("My Team & Pod Directory", () => {
  it("names the console and its purpose", () => {
    expect(organization).toContain("My Team & Pod Directory");
    expect(organization).toContain(
      "Connect with colleagues across teams, view availability from live attendance, and the reporting structure.",
    );
  });

  it("renders the three reference tabs in a module shell", () => {
    for (const label of ["Team Directory", "Department Hierarchy", "Manpower Control"]) {
      expect(organization, `missing the ${label} tab`).toContain(label);
    }
    expect(organization).toContain("<ModuleTabs");
    expect(organization).toContain("<TabPanel");
  });

  it("renders the four headline stats without inventing figures", () => {
    for (const label of ["Total teammates", "Active in shift", "On leave", "Locations covered"]) {
      expect(organization, `missing the ${label} stat`).toContain(label);
    }
    // ModuleStat renders an em dash rather than a zero when a source is unavailable.
    expect(primitives).toContain('{value === null ? "—" : value}');
    expect(organization).toContain("attendanceUnavailable ? null : num(attendance.present)");
  });

  it("drives only governed endpoints", () => {
    for (const endpoint of [
      "/api/v1/people/directory?search=",
      "/api/v1/attendance/team-summary?from=",
      "/api/v1/organization/tree",
      "/api/v1/invitations",
    ]) {
      expect(organization, `does not call ${endpoint}`).toContain(endpoint);
    }
  });

  it("filters the directory by search text and department chips", () => {
    expect(organization).toContain("Search the team directory");
    expect(organization).toContain("Search name, designation, department, location or code…");
    expect(organization).toContain('aria-label="Filter by department"');
    expect(organization).toContain('["All", ...directoryDepartments]');
    expect(organization).toContain("aria-pressed={selected}");
  });

  it("shows a teammate card with real contact and reporting fields", () => {
    for (const field of ["row.designation", "row.department", "row.location", "row.work_email", "row.manager_name", "row.band", "row.worker_class"]) {
      expect(organization, `missing the ${field} field`).toContain(field);
    }
    expect(organization).toContain("<AvatarMark initials={directoryInitials(row)} color={accentFor(row.id)}");
    expect(organization).toContain("href={`mailto:${email}`}");
    expect(organization).toContain('href="/employee-record"');
    // Email is disabled rather than hidden when there is no work email on record.
    expect(organization).toContain('aria-disabled="true"');
    expect(organization).toContain("No work email on record");
  });

  it("invents no presence signal and no direct-message backend", () => {
    expect(organization).not.toMatch(/In Meetings|Focus Time|Presence/i);
    expect(organization).not.toMatch(/\bDM\b|Direct Message|1-on-1|1:1/i);
  });

  it("covers loading, error and empty states for the directory", () => {
    expect(organization).toContain("<RegisterStates");
    expect(organization).toContain("Loading your team directory…");
    expect(organization).toContain("Team directory unavailable");
    expect(organization).toContain("No teammates yet");
    expect(organization).toContain("No teammates found");
  });

  it("keeps the governed creation modals", () => {
    expect(organization).toContain("<CreateDepartmentModal");
    expect(organization).toContain("<CreatePositionModal");
    expect(organization).toContain("New Department");
    expect(organization).toContain("Create Position");
    expect(organization).toContain("Invite Teammate");
  });

  it("fabricates nothing", () => {
    expect(organization).not.toMatch(/Math\.random|faker|placeholder data/i);
  });
});

describe("Onboarding, Assets, Letters & Recognition", () => {
  it("names the console and its purpose", () => {
    expect(onboarding).toContain("Onboarding, Assets, Letters & Recognition");
    expect(onboarding).toContain(
      "Hardware serial asset tracking, HR letter merge studio, and employee recognition awards.",
    );
  });

  it("renders the five reference tabs with live counts", () => {
    for (const label of [
      "Hardware Assets & Serials",
      "HR Letter Studio",
      "Recognition & Events",
      "Joining Chains",
      "30-60-90 Milestones",
    ]) {
      expect(onboarding, `missing the ${label} tab`).toContain(label);
    }
    expect(onboarding).toContain("<ModuleTabs");
    expect(onboarding).toContain("<TabPanel");
    expect(onboarding).toContain("entry.id === \"assets\" ? assets.length");
  });

  it("drives only governed endpoints", () => {
    for (const endpoint of [
      "/api/v1/assets/register?search=",
      "/api/v1/assets/register/${encodeURIComponent(asset.id)}/return",
      "/api/v1/assets/register/${encodeURIComponent(assetId)}/allocate",
      "/api/v1/letters/register?search=",
      "/api/v1/recognition-events",
      "/api/v1/onboarding/joining-chain?search=",
      "/api/v1/onboarding/instances",
      "/api/v1/onboarding/tasks/${encodeURIComponent(taskId)}/complete",
      "/api/v1/people?search=",
    ]) {
      expect(onboarding, `does not call ${endpoint}`).toContain(endpoint);
    }
  });

  it("renders every reference column of the asset register", () => {
    for (const column of [
      "Asset Tag",
      "Equipment &amp; Model",
      "Serial Number",
      "Assigned To",
      "Handover Date",
      "Status",
      "Action",
    ]) {
      expect(onboarding, `missing the ${column} column`).toContain(column);
    }
  });

  it("marks an allocated asset returned through the governed action", () => {
    expect(onboarding).toContain("Mark Returned");
    expect(onboarding).toContain('asset.status === "allocated" ? (');
    expect(onboarding).toContain("onClick={() => setReturnAsset(asset)}");
    // The return prompts for condition and reason before posting, then refreshes.
    expect(onboarding).toContain("Condition on return");
    expect(onboarding).toContain("condition: condition.trim()");
    expect(onboarding).toContain("reason: reason.trim()");
    expect(onboarding).toContain("assetsState.refresh()");
  });

  it("allocates hardware from the header action", () => {
    expect(onboarding).toContain("Allocate Hardware Asset");
    expect(onboarding).toContain("<AllocateAssetModal");
    expect(onboarding).toContain("Employee (live directory)");
    expect(onboarding).toContain("Issued on");
  });

  it("lists letter templates before issued letters and links to the register", () => {
    expect(onboarding).toContain("HR letter studio");
    expect(onboarding).toContain('str(left.kind) === "template" ? 0 : 1');
    expect(onboarding).toContain("row.version");
    expect(onboarding).toContain('href="/letters-issue-register"');
  });

  it("shows only what the recognition feed genuinely stores", () => {
    expect(onboarding).toContain("attributes.message");
    expect(onboarding).toContain("attributes.points");
    expect(onboarding).toContain("No recognition recorded yet");
    expect(onboarding.replace(/\s+/g, " ")).toContain("so no recipient name is shown");
  });

  it("keeps the joining chain queue with the Day-1 checklist", () => {
    expect(onboarding).toContain("Joining chain queue");
    expect(onboarding).toContain("row.readiness");
    expect(onboarding).toContain("row.owner");
    expect(onboarding).toContain('href="/joining-chain-console"');
    expect(onboarding).toContain('aria-label="Day-1 readiness"');
    expect(onboarding).toContain('aria-label="Select onboarding case"');
    expect(onboarding).toContain("Mark complete");
  });

  it("derives 30-60-90 milestones from joining dates only", () => {
    expect(onboarding).toContain("derivedMilestones");
    expect(onboarding).toContain("[30, 60, 90]");
    expect(onboarding).toContain("Derived from each joiner&apos;s recorded joining date");
    expect(onboarding).toContain("date passed");
    expect(onboarding).toContain("upcoming");
  });

  it("covers loading, error and empty states for every register", () => {
    expect(onboarding).toContain("<RegisterStates");
    for (const state of [
      "Loading the asset register…",
      "Asset register unavailable",
      "No assets on the register",
      "Loading the letter register…",
      "Letter register unavailable",
      "No letter templates yet",
      "Loading recognition events…",
      "Recognition events unavailable",
      "Loading joining chains…",
      "Joining chain queue unavailable",
      "No joining chains yet",
      "No joining dates to derive milestones from",
    ]) {
      expect(onboarding, `missing the "${state}" state`).toContain(state);
    }
  });

  it("fabricates nothing", () => {
    expect(onboarding).not.toMatch(/Math\.random|faker|placeholder data/i);
  });
});
