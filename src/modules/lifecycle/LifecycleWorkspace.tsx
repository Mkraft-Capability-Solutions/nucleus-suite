"use client";

import { useMemo, useState } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { ArrowUpRight, DoorOpen, LayoutGrid, ListChecks, UserPlus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Alert, Button, MenuButton, PageHeader, Panel, Scope, SkeletonRows, cx, ui, type MenuAction } from "@/design/redesign/ui";
import { monthOf, monthRange } from "@/modules/attendance/format";
import { useTeam, useViewer, viewerAccess } from "@/modules/attendance/data";
import { usePeople } from "@/modules/core-hr/data";
import { useClearance, useJoiners, useTemplates, groupCases } from "./data";
import Exits from "./Exits";
import { joinerState } from "./format";
import { StartExitForm, StartOnboardingForm, type PersonOption } from "./forms";
import Joiners from "./Joiners";
import Templates from "./Templates";
import styles from "./Lifecycle.module.css";

/**
 * Onboarding & exit (redesigned): joiners and their checklists, exits with no-dues clearance and
 * full & final, and the onboarding checklists themselves, on the existing lifecycle APIs. Letters,
 * assets, probation, recognition and workflows have screens of their own; the Related section links there.
 */

type SectionId = "joiners" | "exits" | "templates" | "related";

const SUB_FEATURE_SECTION: Record<string, SectionId> = {
  joining_chain: "joiners", milestones: "joiners", induction_tasks: "joiners", chains: "joiners", core_onboarding: "joiners",
  clearance_board: "exits", resignation_exit: "exits",
  studio: "templates",
  asset_register: "related", assets: "related", letters_register: "related", letters: "related", recognition: "related", platform_workflows: "related",
};

/** Screens that used to be tabs of the classic onboarding page, now reached from here. */
const RELATED: Array<{ nav: string; label: string; description: string }> = [
  { nav: "letters_register", label: "Letters", description: "Offer, appointment, confirmation and relieving letters, generated from templates." },
  { nav: "asset_register", label: "Assets", description: "Laptops, access cards and other equipment issued to and returned by employees." },
  { nav: "probation_confirmation", label: "Probation confirmation", description: "Confirmation reviews at the end of probation." },
  { nav: "recognition_register", label: "Recognition", description: "Awards and milestone recognition, such as work anniversaries." },
  { nav: "platform_workflows", label: "Workflow studio", description: "Approval workflows for joining and exit steps." },
];

type AuthShape = { isEntitled: (key: string) => boolean; isNavItemEnabled: (id: string) => boolean; tenantAccess?: { tenant?: { name?: string } } | null };

export default function LifecycleWorkspace({ activeSubFeature, onOpenNav }: { activeSubFeature?: string | null; onOpenNav?: (navId: string) => void }) {
  const { isEntitled, isNavItemEnabled, tenantAccess } = useAuth() as unknown as AuthShape;
  const viewer = useViewer();
  const access = viewerAccess(viewer.data);
  const permissions = viewer.data?.permissions ?? [];
  const canManage = permissions.includes("employee.write");
  const canSettle = permissions.includes("payroll.run") && isEntitled("payroll.full_and_final");
  const selfId = viewer.data?.employeeId ?? null;
  const ready = Boolean(viewer.data);
  const tenantWide = access.tenantWide;

  const [chosen, setSection] = useState<SectionId | null>(activeSubFeature ? SUB_FEATURE_SECTION[activeSubFeature] ?? null : null);
  const [lastSubFeature, setLastSubFeature] = useState(activeSubFeature);
  const [form, setForm] = useState<"onboarding" | "exit" | null>(null);
  if (activeSubFeature !== lastSubFeature) {
    setLastSubFeature(activeSubFeature);
    const next = activeSubFeature ? SUB_FEATURE_SECTION[activeSubFeature] : undefined;
    if (next) setSection(next);
  }

  const related = RELATED.filter((entry) => onOpenNav && isNavItemEnabled(entry.nav));
  const visible: Record<SectionId, boolean> = {
    joiners: isEntitled("lifecycle.onboarding"),
    exits: isEntitled("lifecycle.exit") && (canManage || access.seesTeam),
    templates: isEntitled("lifecycle.onboarding") && canManage,
    related: related.length > 0,
  };
  const order: SectionId[] = ["joiners", "exits", "templates", "related"];
  const section: SectionId = chosen && visible[chosen] ? chosen : order.find((id) => visible[id]) ?? "joiners";

  // HR sees everyone; a manager their reporting line; anyone else only their own onboarding.
  const month = monthRange(monthOf(new Date()));
  const team = useTeam(month.from, month.to, ready && !canManage && access.seesTeam);
  const scope = (() => {
    if (canManage || tenantWide) return null;
    const ids = new Set([...(team.data?.employees ?? []).map((member) => member.id), ...(selfId ? [selfId] : [])]);
    return (employeeId: string) => ids.has(employeeId);
  })();

  const joiners = useJoiners(ready && visible.joiners);
  const clearance = useClearance(ready && visible.exits);
  const templates = useTemplates(ready && canManage);
  const people = usePeople();
  const options = useMemo<PersonOption[]>(() => (people.data?.directory ?? [])
    .filter((row) => row.status === "active")
    .sort((a, b) => (b.joining_date ?? "").localeCompare(a.joining_date ?? ""))
    .map((row) => ({ id: row.id, label: `${`${row.first_name} ${row.last_name}`.trim()} (${row.employee_code})${row.joining_date ? ` · joined ${row.joining_date}` : ""}`, joiningDate: row.joining_date })), [people.data]);

  const openJoiners = (joiners.data ?? []).filter((row) => (!scope || scope(row.employeeId)) && joinerState(row).key !== "ready").length;
  const openExits = groupCases(clearance.data ?? []).filter((entry) => !entry.settledCase).length;
  const organisation = tenantAccess?.tenant?.name ?? "";
  const actions: MenuAction[] = [
    ...(visible.joiners ? [{ label: "Onboarding", icon: UserPlus, onSelect: () => setForm("onboarding") }] : []),
    ...(isEntitled("lifecycle.exit") ? [{ label: "Exit", icon: DoorOpen, onSelect: () => setForm("exit") }] : []),
  ];
  const sections: Array<{ id: SectionId; label: string; icon: typeof UserPlus; count?: number }> = [
    { id: "joiners", label: "Joiners", icon: UserPlus, count: openJoiners || undefined },
    { id: "exits", label: "Exits", icon: DoorOpen, count: openExits || undefined },
    { id: "templates", label: "Checklists", icon: ListChecks },
    { id: "related", label: "Related", icon: LayoutGrid },
  ];
  const refresh = () => { void joiners.mutate(); void clearance.mutate(); };

  return (
    <Scope module="lifecycle" className={ui.fit}>
      <div className={cx(ui.page, ui.fit)}>
        <PageHeader
          eyebrow={organisation ? `${organisation} · Core HR` : "Core HR"}
          title="Onboarding & exit"
          description="New joiners' first days, and leavers' clearance and settlement."
          actions={canManage && actions.length > 0 ? <MenuButton label="Start" variant="primary" icon={UserPlus} actions={actions} /> : undefined}
        />

        {viewer.error ? <Alert tone="danger">{viewer.error.message}</Alert> : !viewer.data ? <Panel><SkeletonRows rows={6} columns={5} /></Panel> : (
          <Tabs.Root className={ui.fit} value={section} onValueChange={(value) => setSection(value as SectionId)}>
            <Tabs.List className={ui.tabsList} aria-label="Onboarding and exit sections">
              {sections.filter(({ id }) => visible[id]).map(({ id, label, icon: Icon, count }) => (
                <Tabs.Tab key={id} value={id} className={ui.tab}><Icon aria-hidden="true" />{label}{count !== undefined && <span className={ui.tabCount}>{count}</span>}</Tabs.Tab>
              ))}
              <Tabs.Indicator className={ui.tabIndicator} />
            </Tabs.List>
            <div className={ui.fit} style={{ marginTop: 16 }}>
              {visible.joiners && <Tabs.Panel className={ui.fitPane} value="joiners"><Joiners canManage={canManage} scope={scope} onStart={() => setForm("onboarding")} /></Tabs.Panel>}
              {visible.exits && <Tabs.Panel className={ui.fitPane} value="exits"><Exits canManage={canManage} canSettle={canSettle} onStart={() => setForm("exit")} /></Tabs.Panel>}
              {visible.templates && <Tabs.Panel className={ui.fitPane} value="templates"><Templates canManage={canManage} /></Tabs.Panel>}
              {visible.related && (
                <Tabs.Panel className={ui.fitPane} value="related">
                  <Panel title="Related screens" subtitle="Joining and exit work that has a screen of its own" flush>
                    <ul className={styles.related}>
                      {related.map((entry) => (
                        <li key={entry.nav}>
                          <button type="button" className={styles.relatedLink} onClick={() => onOpenNav?.(entry.nav)}>
                            <span className={styles.person}><span className={styles.personName}>{entry.label}</span><span className={styles.sub}>{entry.description}</span></span>
                            <ArrowUpRight aria-hidden="true" className={styles.relatedIcon} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </Panel>
                </Tabs.Panel>
              )}
            </div>
          </Tabs.Root>
        )}
      </div>

      {form === "onboarding" && <StartOnboardingForm people={options} templates={templates.data ?? []} onClose={() => setForm(null)} onSaved={() => { setForm(null); refresh(); setSection("joiners"); }} />}
      {form === "exit" && <StartExitForm people={options} onClose={() => setForm(null)} onSaved={() => { setForm(null); refresh(); setSection("exits"); }} />}
    </Scope>
  );
}
