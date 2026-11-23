"use client";

import { useMemo, type CSSProperties } from "react";
import { CalendarCheck, Clock, Inbox, LogOut, ShieldAlert, UserCheck, UserPlus, UserX, Users, Database } from "lucide-react";
import NucleusChart from "@/components/Charts/NucleusChart";
import { NUCLEUS_COLORS, chartTokenColors } from "@/components/Charts/theme";
import { useHRMS } from "@/context/HRMSContext";
import { useTranslation } from "@/context/I18nContext";
import { launchAction } from "@/lib/action-launcher";
import { useCockpit } from "@/lib/cockpits/use-cockpit";
import type { HrOperationsConsolePayload, SlaState } from "@/lib/cockpits/hr-operations-console-types";
import type { Source } from "@/lib/cockpits/source-types";
import { ChartCard, CockpitError, CockpitLoading, KpiTile, PartialNotice, formatNumber, useT } from "../cockpit/CockpitParts";
import shared from "../DashboardShared.module.css";
import HROpsApprovalQueue from "./HROpsApprovalQueue";
import styles from "./HROpsConsole.module.css";

/**
 * HR Operations Console (S2). Every figure comes from GET /api/v1/cockpits/hr-operations-console and the approval
 * queue from GET /api/v1/workspace/approvals. A card whose data the platform does not hold says so instead of
 * showing a number. Chart styles are the console's existing ones.
 */

type Palette = Record<"teal" | "sky" | "amber" | "coral" | "violet" | "slate", string>;
type TokenColors = { textPrimary: string; textMuted: string; lineMuted: string; surface: string };
type Payload = HrOperationsConsolePayload & { cockpit?: { label: string } };
type Translate = ReturnType<typeof useT>;

const NS = "components.Dashboard.Views.HROpsConsole";
/** Existing absence heat ramp of this console (cool → hot), kept as the default chart style. */
const HEAT_RAMP = ["#0E1D30", "#1A4D4A", "#2E9C84", "#F2A93B", "#F2647E"];
/** Monday 1 Jan 2024, used only to ask Intl for localized weekday names Monday → Sunday. */
const MONDAY_UTC = Date.UTC(2024, 0, 1);

const SLA_PILL: Record<SlaState, string | undefined> = { breached: shared.pillCoral, due_today: shared.pillAmber, within: shared.pillTeal, unknown: shared.pillSlate };

function unavailable(message: string): Source<null> {
  return { value: null, available: false, message };
}

function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function funnelOption(stages: Array<{ name: string; value: number; color: string }>, C: TokenColors, tooltip: (name: string, value: number, index: number) => string) {
  return {
    tooltip: { trigger: "item", confine: true, formatter: (p: { name: string; value: number; dataIndex: number }) => tooltip(p.name, p.value, p.dataIndex) },
    series: [{
      name: "pipeline", type: "funnel", left: "4%", top: 10, bottom: 10, width: "92%", min: 0, max: Math.max(1, ...stages.map((s) => s.value)),
      minSize: "36%", maxSize: "100%", sort: "descending", gap: 4,
      label: { show: true, position: "inside", formatter: "{c}", color: C.surface, fontWeight: 800, fontSize: 12 },
      itemStyle: { borderColor: C.surface, borderWidth: 2 },
      emphasis: { label: { fontSize: 13, fontWeight: 900 } },
      data: stages.map((s) => ({ value: s.value, name: s.name, itemStyle: { color: s.color } })),
    }],
  };
}

function heatmapOption(d: Payload["absenceDensity"]["value"], days: string[], C: TokenColors, cell: (week: string, day: string, value: number) => string) {
  // Weeks across, weekdays down: the console's existing calendar orientation.
  const cells = d.values.flatMap((row, w) => row.map((value, day) => (value === null ? null : [w, day, value]))).filter((c): c is number[] => c !== null);
  const max = Math.max(1, ...cells.map((c) => c[2] ?? 0));
  return {
    tooltip: { position: "top", formatter: (p: { value: number[] }) => cell(d.rows[p.value[0] ?? 0] ?? "", days[p.value[1] ?? 0] ?? "", p.value[2] ?? 0) },
    grid: { top: 15, bottom: 25, left: 45, right: 15 },
    xAxis: { type: "category", data: d.rows, axisLabel: { color: C.textMuted, fontSize: 12.5 }, splitArea: { show: false } },
    yAxis: { type: "category", data: days, axisLabel: { color: C.textPrimary, fontSize: 12.5 }, splitArea: { show: false } },
    visualMap: { min: 0, max, show: false, inRange: { color: HEAT_RAMP } },
    series: [{ type: "heatmap", data: cells, itemStyle: { borderRadius: 2, borderColor: C.surface, borderWidth: 2 } }],
  };
}

function categoryOption(bars: Array<{ label: string; value: number }>, C: TokenColors, P: Palette, tooltip: (label: string, value: number) => string) {
  const sorted = [...bars].sort((a, b) => a.value - b.value);
  const ramp = [P.slate, P.sky, P.sky, P.amber, P.amber, P.teal];
  const colorAt = (index: number) => ramp[Math.min(ramp.length - 1, Math.max(0, ramp.length - (sorted.length - index)))] ?? P.teal;
  return {
    tooltip: { trigger: "axis", formatter: (p: Array<{ name: string; value: number }>) => tooltip(p[0]?.name ?? "", p[0]?.value ?? 0) },
    grid: { left: "30%", right: "12%", top: 10, bottom: 20 },
    xAxis: { type: "value", axisLabel: { color: C.textMuted }, splitLine: { lineStyle: { color: C.lineMuted } } },
    yAxis: { type: "category", data: sorted.map((b) => b.label), axisLabel: { color: C.textPrimary, fontSize: 12.5 } },
    series: [{
      type: "bar", barWidth: 12,
      data: sorted.map((b, i) => ({ value: b.value, itemStyle: { color: colorAt(i) } })),
      label: { show: true, position: "right", formatter: "{c}", color: C.textPrimary, fontSize: 12.5, fontWeight: 600 },
    }],
  };
}

function UnavailableKpis({ t }: { t: Translate }) {
  const reason = (key: string, fallback: string) => unavailable(t(`${NS}.${key}`, fallback));
  const attendance = reason("text_na_attendance", "Daily attendance is not part of this console's feed yet.");
  return (
    <div className={shared.kpiRow}>
      <KpiTile icon={<UserCheck size={18} />} label={t(`${NS}.text_kpi_present`, "Present today")} source={attendance} />
      <KpiTile icon={<CalendarCheck size={18} />} tone="sky" label={t(`${NS}.text_kpi_on_leave`, "On leave")} source={attendance} />
      <KpiTile icon={<UserX size={18} />} label={t(`${NS}.text_kpi_absent`, "Absent, no record")} source={attendance} />
      <KpiTile icon={<UserPlus size={18} />} tone="sky" label={t(`${NS}.text_kpi_joining`, "Joining this week")} source={reason("text_na_joining", "Joining dates are not projected on the joining chain.")} />
      <KpiTile icon={<LogOut size={18} />} label={t(`${NS}.text_kpi_exits`, "Exits in notice")} source={reason("text_na_exits", "Notice-period exits are not part of this console's feed yet.")} />
      <KpiTile icon={<Database size={18} />} tone="sky" label={t(`${NS}.text_kpi_completeness`, "Data completeness")} source={reason("text_na_completeness", "No record-completeness measure is computed yet.")} />
    </div>
  );
}

/** MainWorkspace passes `onNavigate`; this console links nowhere else yet, so it takes no props. */
export default function HROpsConsole() {
  const t = useT();
  const { locale } = useTranslation();
  const { theme } = useHRMS() as { theme: string };
  const P = NUCLEUS_COLORS as Palette;
  const C = useMemo<TokenColors>(() => {
    const base = chartTokenColors(theme) as Omit<TokenColors, "surface">;
    const surface = typeof window === "undefined" ? "" : getComputedStyle(document.documentElement).getPropertyValue("--card").trim();
    return { ...base, surface: surface || base.lineMuted };
  }, [theme]);
  const { state, reload } = useCockpit<Payload>("hr-operations-console");

  const days = useMemo(() => {
    const format = new Intl.DateTimeFormat(locale || undefined, { weekday: "short", timeZone: "UTC" });
    return Array.from({ length: 7 }, (_, i) => format.format(new Date(MONDAY_UTC + i * 86_400_000)));
  }, [locale]);

  const view = useMemo(() => {
    if (state.status !== "ready") return null;
    const d = state.data;
    const colors = [P.teal, P.sky, P.amber, P.violet, P.coral];
    const stages = d.onboardingFunnel.value.stages.map((s, i) => ({ name: t(`${NS}.text_stage_${slug(s.label)}`, s.label), value: s.value, color: colors[i % colors.length] ?? P.teal }));
    const rateAt = (i: number): number | null => {
      if (i === 0) return null;
      const previous = stages[i - 1]?.value ?? 0;
      return previous > 0 ? ((stages[i]?.value ?? 0) / previous) * 100 : null;
    };
    const first = stages[0]?.value ?? 0;
    const last = stages[stages.length - 1]?.value ?? 0;
    return {
      stages,
      rateAt,
      yieldPercent: first > 0 ? (last / first) * 100 : null,
      funnel: funnelOption(stages, C, (name, value, i) => {
        const rate = rateAt(i);
        return rate === null
          ? t(`${NS}.text_funnel_tip_first`, "{name}: {value}", { name, value: formatNumber(value, locale) })
          : t(`${NS}.text_funnel_tip`, "{name}: {value} ({rate}% of the previous stage)", { name, value: formatNumber(value, locale), rate: formatNumber(rate, locale, 1) });
      }),
      heat: heatmapOption(d.absenceDensity.value, days, C, (week, day, value) => t(`${NS}.text_heat_cell`, "{week}, {day}: {value, plural, one {# person-day} other {# person-days}} away", { week, day, value })),
      bars: categoryOption(d.helpdeskByCategory.value, C, P, (label, value) => t(`${NS}.text_bar_tip`, "{label}: {value, plural, one {# ticket} other {# tickets}}", { label, value })),
    };
  }, [state, C, P, t, locale, days]);

  if (state.status === "loading") return <CockpitLoading label={t(`${NS}.text_loading`, "Loading the HR Operations Console…")} />;
  if (state.status === "error") return <CockpitError message={state.message} forbidden={state.forbidden} onRetry={reload} />;
  const d = state.data;
  const kpi = d.kpis;
  const today = new Intl.DateTimeFormat(locale || undefined, { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d.today}T00:00:00.000Z`));
  const countOf = (source: Source<number | null>) => (source.available && typeof source.value === "number" ? formatNumber(source.value, locale) : t(`${NS}.text_dash`, "—"));

  return (
    <div className={shared.dashboardCanvas}>
      <div className={shared.scopeBar}>
        <div className={shared.scopeLeft}>
          <h2 className={shared.screenTitle}>{d.cockpit?.label ?? t(`${NS}.text_title`, "Operations Console")}</h2>
          <span className={shared.scopeMetadata}>{today}</span>
          <span className={`${shared.pillBadge} ${shared.pillAmber}`}>{t(`${NS}.text_pill_queue`, "Awaiting action: {count}", { count: countOf(kpi.pendingApprovals) })}</span>
          <span className={`${shared.pillBadge} ${shared.pillCoral}`}>{t(`${NS}.text_pill_breach`, "Past due: {count}", { count: countOf(kpi.breachedItems) })}</span>
          <span className={`${shared.pillBadge} ${shared.pillTeal}`}>{t(`${NS}.text_pill_ready`, "Day-1 ready: {count}", { count: countOf(kpi.dayOneReady) })}</span>
        </div>
        <div className={shared.scopeRight}>
          <button type="button" className={`${shared.scopeBtn} ${shared.scopeBtnPrimary}`} onClick={() => launchAction("employee")}>
            <UserPlus size={14} aria-hidden="true" />{t(`${NS}.text_new_joiner`, "New joiner")}
          </button>
        </div>
      </div>

      <div className={shared.kpiRow}>
        <KpiTile icon={<Inbox size={18} />} label={t(`${NS}.text_kpi_pending`, "Items awaiting action")} source={kpi.pendingApprovals} />
        <KpiTile icon={<ShieldAlert size={18} />} tone="sky" label={t(`${NS}.text_kpi_breached`, "Past their own due date")} source={kpi.breachedItems} />
        <KpiTile icon={<Clock size={18} />} label={t(`${NS}.text_kpi_oldest`, "Oldest waiting item")} source={kpi.oldestQueueAgeDays} unit={t(`${NS}.text_unit_days`, " d")} digits={1} />
        <KpiTile icon={<Users size={18} />} tone="sky" label={t(`${NS}.text_kpi_ready`, "Day-1 ready joiners")} source={kpi.dayOneReady} />
      </div>
      <UnavailableKpis t={t} />
      <PartialNotice sources={d.unavailableSources} />

      <div className={shared.grid12}>
        <ChartCard span={12} title={t(`${NS}.text_card_anomaly`, "Operational anomalies")} source={unavailable(t(`${NS}.text_na_anomaly`, "Anomaly detection is not connected to this console yet, so no finding is shown."))} minHeight={110}>
          {null}
        </ChartCard>

        <HROpsApprovalQueue span={6} />

        <ChartCard span={6} title={t(`${NS}.text_card_ageing`, "Queue ageing and due dates")} subtitle={d.approvals.value.queues.length > 0 ? t(`${NS}.text_card_ageing_sub`, "Oldest first · {queues}", { queues: d.approvals.value.queues.join(", ") }) : undefined} source={d.approvals}>
          {d.approvals.value.items.length === 0 ? <div className={styles.empty}>{t(`${NS}.text_ageing_empty`, "Nothing is waiting in the queues you can see.")}</div> : (
            <div className={styles.scroll}>
              <table className={shared.dataTable}>
                <thead><tr><th>{t(`${NS}.text_col_request`, "Request")}</th><th>{t(`${NS}.text_col_queue`, "Queue")}</th><th>{t(`${NS}.text_col_age`, "Age")}</th><th>{t(`${NS}.text_col_due`, "Due")}</th></tr></thead>
                <tbody>
                  {d.approvals.value.items.map((item) => (
                    <tr key={item.id}>
                      <td><div className={styles.primaryText}>{item.requester}</div><div className={styles.secondaryText}>{item.type} · {item.reference}</div></td>
                      <td>{item.queue}</td>
                      <td title={item.ageDays === null ? t(`${NS}.text_no_age`, "This source records no submission timestamp.") : undefined}>
                        {item.ageDays === null ? t(`${NS}.text_dash`, "—") : t(`${NS}.text_age_days`, "{days, plural, one {# day} other {# days}}", { days: item.ageDays })}
                      </td>
                      <td title={item.dueBasis}><span className={`${shared.pillBadge} ${SLA_PILL[item.sla] ?? ""}`}>{t(`${NS}.text_sla_${item.sla}`, { breached: "Past due", due_today: "Due today", within: "Within date", unknown: "No due date" }[item.sla])}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className={styles.note}>{d.approvals.value.ageingNote}</p>
        </ChartCard>

        <ChartCard span={4} title={t(`${NS}.text_card_onboarding`, "Onboarding pipeline")} subtitle={t(`${NS}.text_card_onboarding_sub`, "Each stage is a subset of the one above it")} source={d.onboardingFunnel}
          tools={view?.yieldPercent != null ? <span className={`${shared.pillBadge} ${shared.pillTeal}`}>{t(`${NS}.text_yield_pill`, "{rate}% yield", { rate: formatNumber(view.yieldPercent, locale, 1) })}</span> : undefined}>
          {!view || view.stages.length === 0 ? <div className={styles.empty}>{t(`${NS}.text_onboarding_empty`, "No onboarding has been raised yet.")}</div> : (
            <>
              <div className={styles.funnelLayout}>
                <NucleusChart option={view.funnel} style={{ height: 200, width: "100%" }} />
                <ul className={styles.stageList}>
                  {view.stages.map((stage, i) => {
                    const rate = view.rateAt(i);
                    return (
                      <li key={stage.name} className={styles.stage}>
                        <span className={styles.stageName}><span className={styles.dot} style={{ "--dot": stage.color } as CSSProperties} aria-hidden="true" /><span>{stage.name}</span></span>
                        <span className={styles.stageValue}><strong>{formatNumber(stage.value, locale)}</strong>{rate !== null && <span>{t(`${NS}.text_stage_rate`, "({rate}%)", { rate: formatNumber(rate, locale, 1) })}</span>}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className={styles.yield}>
                <span>{t(`${NS}.text_yield_label`, "{from} to {to}", { from: view.stages[0]?.name ?? "", to: view.stages[view.stages.length - 1]?.name ?? "" })}</span>
                <strong>{t(`${NS}.text_yield_value`, "{to} / {from}", { to: formatNumber(view.stages[view.stages.length - 1]?.value ?? 0, locale), from: formatNumber(view.stages[0]?.value ?? 0, locale) })}</strong>
              </div>
            </>
          )}
          <p className={styles.note}>{d.onboardingFunnel.value.note}</p>
        </ChartCard>

        <ChartCard span={4} title={t(`${NS}.text_card_helpdesk_sla`, "Helpdesk SLA performance")} source={unavailable(t(`${NS}.text_na_helpdesk_sla`, "First-response, resolution and reopen times are not recorded on helpdesk tickets, so no SLA rate can be measured."))}>
          {null}
        </ChartCard>

        <ChartCard span={4} title={t(`${NS}.text_card_categories`, "Requests by category")} subtitle={t(`${NS}.text_card_categories_sub`, "Every recorded helpdesk ticket")} source={d.helpdeskByCategory}>
          {!view || d.helpdeskByCategory.value.length === 0 ? <div className={styles.empty}>{t(`${NS}.text_categories_empty`, "No categorised tickets yet.")}</div> : <NucleusChart option={view.bars} style={{ height: 230, width: "100%" }} />}
        </ChartCard>

        <ChartCard span={6} title={t(`${NS}.text_card_absence`, "Absence density calendar")} subtitle={t(`${NS}.text_card_absence_sub`, "Person-days of approved leave by week and weekday")} source={d.absenceDensity}>
          {!view || d.absenceDensity.value.rows.length === 0 ? <div className={styles.empty}>{t(`${NS}.text_absence_empty`, "No approved leave falls in this window.")}</div> : <NucleusChart option={view.heat} style={{ height: 220, width: "100%" }} />}
          <p className={styles.note}>{d.absenceDensity.value.note}</p>
        </ChartCard>

        <ChartCard span={6} title={t(`${NS}.text_card_renewals`, "Documents and statutory renewals")} source={unavailable(t(`${NS}.text_na_renewals`, "Document expiry and statutory renewal dates are not part of this console's feed yet."))}>
          {null}
        </ChartCard>

        <ChartCard span={12} title={t(`${NS}.text_card_moments`, "This week's people moments")} source={unavailable(t(`${NS}.text_na_moments`, "Anniversaries, confirmations, returns and birthdays are not part of this console's feed yet."))} minHeight={140}>
          {null}
        </ChartCard>
      </div>
    </div>
  );
}
