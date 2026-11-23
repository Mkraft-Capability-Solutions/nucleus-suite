"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { Tabs } from "@base-ui/react/tabs";
import { BookOpen, CalendarPlus, CalendarRange, Gift, Inbox, ListChecks, ScrollText, Upload, UserRound } from "lucide-react";
import PolicyHandbookModal from "@/components/Policies/PolicyHandbookModal";
import { useAuth } from "@/context/AuthContext";
import { Alert, Button, PageHeader, Panel, Scope, SkeletonRows, cx, ui } from "@/design/redesign/ui";
import { monthOf, monthRange } from "@/modules/attendance/format";
import { useTeam, useViewer, viewerAccess } from "@/modules/attendance/data";
import { usePeople } from "@/modules/core-hr/data";
import ApplyForm, { type PersonOption } from "./ApplyForm";
import CompOff from "./CompOff";
import { useBalanceSummary, useLeaveTypes, useRegister, type LeaveCode } from "./data";
import { isPending } from "./format";
import LeaveRules from "./LeaveRules";
import MyLeave from "./MyLeave";
import Register from "./Register";
import WhosAway from "./WhosAway";
import styles from "./Leave.module.css";

/**
 * Leave (redesigned): one's own balances and requests, approvals, who is away, the organisation's
 * register, compensatory off and the rules, on the existing leave APIs. Sections follow the person's
 * permissions (GET /api/v1/identity/context) and the organisation's plan; the APIs check both again.
 */

type SectionId = "mine" | "approvals" | "away" | "all" | "compoff" | "rules";

const SUB_FEATURE_SECTION: Record<string, SectionId> = {
  leave_requests: "mine", leave_ledger: "mine", balances_apply: "mine",
  approval_inbox: "approvals", leave_approval: "approvals", approval_pipeline: "approvals",
  early_return: "all", early_return_recredit: "all",
  comp_off: "compoff", coff_lapse: "compoff", compensatory_off: "compoff", comp_off_clock: "compoff",
  leave_policy_admin: "rules", leave_types: "rules", policy_matrix: "rules",
};

const API_CODES: LeaveCode[] = ["EL", "CL", "SL", "COFF", "BIRTHDAY"];
type AuthShape = { isEntitled: (key: string) => boolean; tenantAccess?: { tenant?: { name?: string } } | null };

export default function LeaveWorkspace({ activeSubFeature }: { activeSubFeature?: string | null }) {
  const { isEntitled, tenantAccess } = useAuth() as unknown as AuthShape;
  const viewer = useViewer();
  const { mutate: mutateCache } = useSWRConfig();
  const access = viewerAccess(viewer.data);
  const selfId = viewer.data?.employeeId ?? null;
  const canApprove = Boolean(viewer.data?.permissions.includes("leave.approve"));
  const tenantWide = access.tenantWide;
  const compOffOn = isEntitled("leave.comp_off");
  const ready = Boolean(viewer.data);

  const [chosen, setSection] = useState<SectionId | null>(activeSubFeature ? SUB_FEATURE_SECTION[activeSubFeature] ?? null : null);
  const [lastSubFeature, setLastSubFeature] = useState(activeSubFeature);
  const [applying, setApplying] = useState(false);
  const [handbook, setHandbook] = useState(false);
  if (activeSubFeature !== lastSubFeature) {
    setLastSubFeature(activeSubFeature);
    const next = activeSubFeature ? SUB_FEATURE_SECTION[activeSubFeature] : undefined;
    if (next) setSection(next);
  }

  const visible: Record<SectionId, boolean> = {
    mine: Boolean(selfId),
    approvals: canApprove,
    away: access.seesTeam,
    all: access.tenantWide,
    compoff: isEntitled("leave.comp_off"),
    rules: isEntitled("leave.policies"),
  };
  const order: SectionId[] = ["mine", "approvals", "away", "all", "compoff", "rules"];
  const section: SectionId = chosen && visible[chosen] ? chosen : order.find((id) => visible[id]) ?? "rules";

  // A manager sees their reporting line (the attendance scope); HR the whole organisation.
  const month = monthRange(monthOf(new Date()));
  const team = useTeam(month.from, month.to, ready && access.seesTeam && !access.tenantWide);
  // (No manual memoisation here: the React Compiler memoises these derived values.)
  const scope: Set<string> | null = tenantWide ? null : new Set([...(team.data?.employees ?? []).map((member) => member.id), ...(selfId ? [selfId] : [])]);

  const people = usePeople();
  const directory = people.data?.directory ?? [];
  const selfCode = directory.find((row) => row.id === selfId)?.employee_code ?? null;
  const options: PersonOption[] = (() => {
    const rows = directory.filter((row) => row.status === "active" && (tenantWide || row.id === selfId || Boolean(scope?.has(row.id))));
    const list = rows.map((row) => ({ id: row.id, label: `${`${row.first_name} ${row.last_name}`.trim()} (${row.employee_code})` }));
    return list.sort((a, b) => (a.id === selfId ? -1 : b.id === selfId ? 1 : a.label.localeCompare(b.label)));
  })();
  // Applying on someone's behalf is for approvers and HR; everyone else applies for themselves.
  const applyFor = canApprove || access.tenantWide ? options : options.filter((option) => option.id === selfId);

  const leaveTypes = useLeaveTypes();
  const offered: LeaveCode[] = (() => {
    const stored = (leaveTypes.data ?? []).map((row) => String(row.attributes.code ?? "").toUpperCase()).filter((code): code is LeaveCode => (API_CODES as string[]).includes(code));
    const base = stored.length ? stored : (["EL", "CL", "SL"] as LeaveCode[]);
    return [...new Set<LeaveCode>([...base, ...(compOffOn ? (["COFF"] as LeaveCode[]) : [])])];
  })();

  const register = useRegister(ready && (canApprove || access.seesTeam));
  const awaiting = (register.data ?? []).filter((row) => isPending(row.raw_status) && row.employee_id !== selfId && (!scope || scope.has(row.employee_id))).length;
  const balances = useBalanceSummary(selfId);
  const organisation = tenantAccess?.tenant?.name ?? "";

  const sections: Array<{ id: SectionId; label: string; icon: typeof Inbox }> = [
    { id: "mine", label: "My leave", icon: UserRound },
    { id: "approvals", label: "Approvals", icon: Inbox },
    { id: "away", label: "Who's away", icon: CalendarRange },
    { id: "all", label: "All requests", icon: ListChecks },
    { id: "compoff", label: "Comp-off", icon: Gift },
    { id: "rules", label: "Policies", icon: ScrollText },
  ];

  return (
    <Scope module="leave" className={ui.fit}>
      <div className={cx(ui.page, ui.fit)}>
        <PageHeader
          eyebrow={organisation ? `${organisation} · Leave` : "Leave"}
          title="Leave"
          description="Balances, requests and approvals."
          actions={
            <>
              <Button variant="ghost" icon={BookOpen} onClick={() => setHandbook(true)}>Policy handbook</Button>
              {access.tenantWide && isEntitled("leave.balances") && (
                <Button icon={Upload} onClick={() => window.dispatchEvent(new CustomEvent("nucleus:open_bulk_upload"))}>Upload balances</Button>
              )}
              {applyFor.length > 0 && <Button variant="primary" icon={CalendarPlus} onClick={() => setApplying(true)}>Apply for leave</Button>}
            </>
          }
        />

        {viewer.error ? <Alert tone="danger">{viewer.error.message}</Alert> : !viewer.data ? <Panel><SkeletonRows rows={6} columns={5} /></Panel> : (
          <Tabs.Root className={ui.fit} value={section} onValueChange={(value) => setSection(value as SectionId)}>
            <Tabs.List className={ui.tabsList} aria-label="Leave sections">
              {sections.filter(({ id }) => visible[id]).map(({ id, label, icon: Icon }) => (
                <Tabs.Tab key={id} value={id} className={ui.tab}>
                  <Icon aria-hidden="true" />{label}
                  {id === "approvals" && awaiting > 0 && <span className={styles.tabBadge} aria-label={`${awaiting} waiting`}>{awaiting}</span>}
                </Tabs.Tab>
              ))}
              <Tabs.Indicator className={ui.tabIndicator} />
            </Tabs.List>
            <div className={ui.fit} style={{ marginTop: 16 }}>
              {visible.mine && selfId && <Tabs.Panel className={ui.fitPane} value="mine"><MyLeave employeeId={selfId} onApply={() => setApplying(true)} /></Tabs.Panel>}
              {visible.approvals && <Tabs.Panel className={ui.fitPane} value="approvals"><Register mode="approvals" canApprove={canApprove} canRecordReturn={access.tenantWide} selfId={selfId} scope={scope} /></Tabs.Panel>}
              {visible.away && <Tabs.Panel className={ui.fitPane} value="away"><WhosAway scope={scope} /></Tabs.Panel>}
              {visible.all && <Tabs.Panel className={ui.fitPane} value="all"><Register mode="all" canApprove={canApprove} canRecordReturn={access.tenantWide} selfId={selfId} scope={null} /></Tabs.Panel>}
              {visible.compoff && <Tabs.Panel className={ui.fitPane} value="compoff"><CompOff selfCode={selfCode} canGrant={access.canDecide} people={options} /></Tabs.Panel>}
              {visible.rules && <Tabs.Panel className={ui.fitPane} value="rules"><LeaveRules /></Tabs.Panel>}
            </div>
          </Tabs.Root>
        )}
      </div>

      {applying && (
        <ApplyForm onClose={() => setApplying(false)} selfId={selfId} people={applyFor} balances={balances.data} types={offered}
          onSaved={() => { setApplying(false); void mutateCache((key) => typeof key === "string" && key.startsWith("/api/v1/leave")); }} />
      )}
      <PolicyHandbookModal isOpen={handbook} onClose={() => setHandbook(false)} />
    </Scope>
  );
}
