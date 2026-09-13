import { NextResponse } from "next/server";
import { listAnnouncements } from "@/server/engagement/service";
import { listApplications } from "@/server/talent/service";
import { listPostings } from "@/server/interviews/service";
import { listLeaveRequests } from "@/server/leave/service";
import { listNotifications } from "@/server/notifications/service";
import { getWorkforceOverview } from "@/server/organization/service";
import { listLatestRunAnomalies, listRuns } from "@/server/payroll/service";
import { listObligations } from "@/server/compliance/service";
import { summarizeToday } from "@/server/attendance/service";
import { capabilityByDepartment } from "@/server/skills/service";
import { requireAccess } from "@/server/platform/access";
import { fail, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

type Source<T> = { value: T; available: boolean; message?: string };

async function source<T>(operation: () => Promise<T>, fallback: T): Promise<Source<T>> {
  try {
    return { value: await operation(), available: true };
  } catch {
    return { value: fallback, available: false, message: "Source unavailable for this role or tenant." };
  }
}

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const [workforce, leave, payroll, anomalies, applications, postings, compliance, notifications, announcements, attendance, capability] = await Promise.all([
      source(() => getWorkforceOverview(access), { total: 0, joinerCounts: [], headcount: [], openPositions: 0 }),
      source(() => listLeaveRequests(access, { status: null, page: 1, pageSize: 100 }), { items: [], total: 0 }),
      source(() => listRuns(access, { period: null, page: 1, pageSize: 12 }), { items: [], total: 0 }),
      source(() => listLatestRunAnomalies(access), []),
      source(() => listApplications(access, { page: 1, pageSize: 100 }), { items: [], total: 0 }),
      source(() => listPostings(access, null), []),
      source(() => listObligations(access, null), []),
      source(() => listNotifications(access, true), { items: [], unread: 0 }),
      source(() => listAnnouncements(access, null), []),
      source(() => summarizeToday(access), { date: "", present: 0, halfDay: 0, onLeave: 0, absent: 0, notRecorded: 0, total: 0, percentPresent: null }),
      source(() => capabilityByDepartment(access), []),
    ]);

    const runs = payroll.value.items as Array<Record<string, unknown>>;
    const latestRun = runs[0];
    const leaveItems = leave.value.items as Array<Record<string, unknown>>;
    const applicationItems = applications.value.items as Array<Record<string, unknown>>;
    const postingItems = postings.value as Array<Record<string, unknown>>;
    const complianceItems = compliance.value as Array<Record<string, unknown>>;
    const anomalyItems = anomalies.value as Array<Record<string, unknown>>;
    const pendingLeave = leaveItems.filter((item) => {
      const status = String(item.status).toLowerCase();
      return status.startsWith("pending") || ["submitted", "requested"].includes(status);
    });
    const openAnomalies = anomalyItems.filter((item) => String(item.status).toLowerCase() === "open");
    const dueCompliance = complianceItems.filter((item) => {
      const attributes = typeof item.attributes === "object" && item.attributes ? item.attributes as Record<string, unknown> : {};
      return !["filed", "complete", "completed"].includes(String(attributes.status ?? "").toLowerCase());
    });
    const openPositions = workforce.value.openPositions;

    const attention = [
      ...pendingLeave.slice(0, 4).map((item) => ({ id: String(item.id), domain: "leave", title: "Leave request awaiting decision", detail: `${item.requested_days ?? ""} day(s) · ${item.starts_on ?? ""}`, href: "/leave", status: String(item.status ?? "pending") })),
      ...openAnomalies.slice(0, 4).map((item) => ({ id: String(item.id), domain: "payroll", title: `Payroll anomaly · ${item.rule_code ?? "review"}`, detail: String(item.severity ?? "Review required"), href: "/payroll", status: String(item.status ?? "open") })),
      ...dueCompliance.slice(0, 4).map((item) => { const attributes = typeof item.attributes === "object" && item.attributes ? item.attributes as Record<string, unknown> : {}; return { id: String(item.id), domain: "compliance", title: String(attributes.title ?? attributes.code ?? "Compliance obligation"), detail: String(attributes.due_date ?? attributes.due_on ?? attributes.dueDate ?? "Evidence required"), href: "/compliance", status: String(attributes.status ?? "scheduled") }; }),
    ].slice(0, 8);

    const sources = { workforce, leave, payroll, applications, postings, compliance, notifications, announcements, anomalies, attendance, capability };
    const unavailable = Object.entries(sources).filter(([, value]) => !value.available).map(([name, value]) => ({ name, message: value.message ?? "Permission or source unavailable" }));

    return NextResponse.json({
      data: {
        summary: {
          headcount: workforce.value.total,
          openPositions,
          pendingLeave: pendingLeave.length,
          payrollNetMinor: Number(latestRun?.net_minor ?? 0),
          payrollCurrency: String(latestRun?.currency ?? "INR"),
          payrollPeriod: latestRun?.period ? String(latestRun.period) : null,
          applications: applications.value.total,
          activePostings: postingItems.length,
          unreadNotifications: notifications.value.unread,
          announcements: (announcements.value as unknown[]).length,
          attendanceToday: attendance.value,
        },
        headcountByDepartment: workforce.value.headcount,
        capabilityByDepartment: capability.value,
        commandCentre: {
          joinerCounts: workforce.value.joinerCounts,
          leaveCalendar: leaveItems.map((item) => ({
            startsOn: String(item.starts_on ?? ""),
            endsOn: String(item.ends_on ?? item.starts_on ?? ""),
            status: String(item.status ?? ""),
          })),
          obligations: complianceItems.map((item) => {
            const attributes = typeof item.attributes === "object" && item.attributes ? item.attributes as Record<string, unknown> : {};
            return {
              id: String(item.id ?? ""),
              title: String(attributes.title ?? attributes.code ?? "Obligation"),
              dueDate: String(attributes.due_date ?? attributes.due_on ?? attributes.dueDate ?? ""),
              status: String(attributes.status ?? ""),
            };
          }),
        },
        attention,
        hiringStages: applicationItems.reduce<Record<string, number>>((totals, item) => {
          const attributes = typeof item.attributes === "object" && item.attributes ? item.attributes as Record<string, unknown> : {};
          const stage = String(attributes.stage ?? "applied");
          totals[stage] = (totals[stage] ?? 0) + 1;
          return totals;
        }, {}),
        compliance: { total: complianceItems.length, requiringAttention: dueCompliance.length },
        latestPayroll: latestRun ?? null,
        unavailableSources: unavailable,
      },
      meta: { requestId, tenantId: access.tenantId, generatedAt: new Date().toISOString(), completeness: unavailable.length ? "partial" : "complete" },
      links: { self: "/api/v1/home" },
    }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}
