"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertOctagon, Calculator, CheckCircle2, FileCheck, IndianRupee, Landmark, Lock, ShieldCheck } from "lucide-react";
import NucleusChart from "@/components/Charts/NucleusChart";
import { NUCLEUS_COLORS, chartTokenColors } from "@/components/Charts/theme";
import { useHRMS } from "@/context/HRMSContext";
import { useTranslation } from "@/context/I18nContext";
import type { CockpitState } from "@/lib/cockpits/use-cockpit";
import type { Source } from "@/lib/cockpits/source-types";
import type {
  CompositionView,
  DepartmentCost,
  ExceptionRow,
  PayrollControlRoomView,
  PeriodOption,
  VarianceView,
} from "@/lib/cockpits/payroll-control-room-types";
import { ChartCard, CockpitError, CockpitLoading, PartialNotice, formatNumber, useT } from "../cockpit/CockpitParts";
import shared from "../DashboardShared.module.css";
import styles from "./PayrollControlRoom.module.css";

/**
 * Payroll Control Room (S5). Every figure comes from GET /api/v1/cockpits/payroll-control-room for the selected run;
 * a feed that did not resolve shows its reason instead of a number. Actions post to the payroll-run and
 * payroll-anomaly routes and refresh the console. Chart styles are the console's existing ones.
 */

type Palette = Record<"teal" | "sky" | "amber" | "coral" | "violet" | "slate", string>;
type TokenColors = { textPrimary: string; textMuted: string; lineMuted: string };
type Translate = ReturnType<typeof useT>;
type Money = { exact: (minor: number) => string; compact: (minor: number) => string; compactMajor: (major: number) => string; major: (minor: number) => number };
type ChartParam = { name?: string; seriesIndex?: number; percent?: number; data?: { minor?: number; employees?: number; total?: number } };

const NS = "components.Dashboard.Views.PayrollControlRoom";
const ENDPOINT = "/api/v1/cockpits/payroll-control-room";
const RESOLVABLE_DISPOSITIONS = ["resolve", "assign", "escalate", "waive"] as const;
type Disposition = (typeof RESOLVABLE_DISPOSITIONS)[number];
/** Mirrors resolveAnomalySchema: 5–500 characters, 20 for a waiver. */
const REASON_MIN = 5;
const WAIVER_MIN = 20;
const REASON_MAX = 500;

/** Amounts are integer minor units; the minor-unit exponent comes from the payload's ISO currency, never assumed. */
function moneyFormatter(currency: string, locale: string | undefined): Money | null {
  let exact: Intl.NumberFormat;
  try {
    exact = new Intl.NumberFormat(locale || undefined, { style: "currency", currency });
  } catch (error) {
    if (error instanceof RangeError) return null; // Not a valid ISO 4217 code: render "not available", never a guess.
    throw error;
  }
  const digits = exact.resolvedOptions().maximumFractionDigits;
  if (typeof digits !== "number") return null;
  const compact = new Intl.NumberFormat(locale || undefined, { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 });
  const scale = 10 ** digits;
  return { exact: (m) => exact.format(m / scale), compact: (m) => compact.format(m / scale), compactMajor: (v) => compact.format(v), major: (m) => m / scale };
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const newKey = () => crypto.randomUUID();

function useControlRoom(): { state: CockpitState<PayrollControlRoomView>; select: (runId: string | null) => void; reload: () => void } {
  const [state, setState] = useState<CockpitState<PayrollControlRoomView>>({ status: "loading" });
  const [request, setRequest] = useState<{ runId: string | null; attempt: number }>({ runId: null, attempt: 0 });

  useEffect(() => {
    const controller = new AbortController();
    const url = request.runId ? `${ENDPOINT}?runId=${encodeURIComponent(request.runId)}` : ENDPOINT;
    type Envelope = { data?: PayrollControlRoomView; meta?: { completeness?: "complete" | "partial"; generatedAt?: string }; error?: { message?: string } };
    fetch(url, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as Envelope | null;
        if (!response.ok || !payload?.data) {
          setState({ status: "error", message: payload?.error?.message ?? "", forbidden: response.status === 403 });
          return;
        }
        setState({ status: "ready", data: payload.data, completeness: payload.meta?.completeness ?? "complete", generatedAt: payload.meta?.generatedAt ?? null });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: "error", message: "", forbidden: false });
      });
    return () => controller.abort();
  }, [request]);

  const select = useCallback((runId: string | null) => {
    setState({ status: "loading" });
    setRequest((current) => ({ runId, attempt: current.attempt + 1 }));
  }, []);
  const reload = useCallback(() => {
    setState({ status: "loading" });
    setRequest((current) => ({ ...current, attempt: current.attempt + 1 }));
  }, []);
  return { state, select, reload };
}

async function postJson(url: string, body: unknown, idempotencyKey: string): Promise<{ ok: boolean; message: string }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (response.ok) return { ok: true, message: "" };
  const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  return { ok: false, message: payload?.error?.message ?? "" };
}

/* ------------------------------------------------------------------ chart builders (existing styles) */

function waterfallOption(v: VarianceView, money: Money, C: TokenColors, P: Palette, label: (bar: VarianceView["bars"][number]) => string) {
  let running = 0;
  const placeholder: number[] = [];
  const visible = v.bars.map((bar) => {
    if (bar.kind !== "delta") {
      placeholder.push(0);
      running = bar.amountMinor;
      return { value: money.major(bar.amountMinor), minor: bar.amountMinor, itemStyle: { color: P.sky } };
    }
    const end = running + bar.amountMinor;
    placeholder.push(money.major(Math.min(running, end)));
    running = end;
    // A cost increase is drawn coral and a decrease teal, as this console always has.
    return { value: money.major(Math.abs(bar.amountMinor)), minor: bar.amountMinor, itemStyle: { color: bar.amountMinor >= 0 ? P.coral : P.teal } };
  });
  const floors = v.bars.map((bar, i) => (bar.kind === "delta" ? placeholder[i] ?? 0 : money.major(bar.amountMinor)));
  const lowest = Math.min(...floors);
  return {
    tooltip: {
      trigger: "axis", axisPointer: { type: "shadow" },
      formatter: (params: ChartParam[]) => {
        const p = params.find((item) => item.seriesIndex === 1) ?? params[0];
        return p?.data?.minor === undefined ? "" : `${escapeHtml(p.name ?? "")}: <strong>${escapeHtml(money.exact(p.data.minor))}</strong>`;
      },
    },
    grid: { left: 64, right: 15, top: 20, bottom: 25, containLabel: false },
    xAxis: { type: "category", data: v.bars.map(label), axisLabel: { color: C.textMuted, fontSize: 12.5, rotate: 10 } },
    yAxis: {
      type: "value", min: lowest > 0 ? Math.floor(lowest * 0.9) : undefined,
      axisLabel: { color: C.textMuted, formatter: (value: number) => money.compactMajor(value) },
      splitLine: { lineStyle: { color: C.lineMuted } },
    },
    series: [
      { type: "bar", stack: "bridge", silent: true, itemStyle: { opacity: 0 }, emphasis: { itemStyle: { opacity: 0 } }, data: placeholder },
      {
        type: "bar", stack: "bridge", barWidth: 20, data: visible,
        label: { show: true, position: "top", color: C.textPrimary, fontSize: 12.5, formatter: (p: ChartParam) => (p.data?.minor === undefined ? "" : money.compact(p.data.minor)) },
      },
    ],
  };
}

function donutOption(view: CompositionView, money: Money, C: TokenColors, P: Palette, centre: string, border: string) {
  const colors = [P.teal, P.sky, P.amber, P.violet, P.coral, P.slate];
  return {
    tooltip: { trigger: "item", formatter: (p: ChartParam) => (p.data?.minor === undefined ? "" : `${escapeHtml(p.name ?? "")}: <strong>${escapeHtml(money.exact(p.data.minor))}</strong> (${p.percent ?? 0}%)`) },
    legend: { orient: "vertical", right: 10, top: "center", textStyle: { color: C.textMuted, fontSize: 12.5 } },
    series: [{
      type: "pie", radius: ["55%", "80%"], center: ["35%", "50%"], avoidLabelOverlap: false,
      itemStyle: { borderRadius: 4, borderColor: border, borderWidth: 2 },
      label: { show: true, position: "center", formatter: `${money.compact(view.componentTotalMinor)}\n${centre}`, fontSize: 13, fontWeight: 700, color: C.textPrimary },
      data: view.slices.map((slice, i) => ({ name: slice.label, value: money.major(slice.amountMinor), minor: slice.amountMinor, itemStyle: { color: colors[i % colors.length] } })),
    }],
  };
}

function departmentOption(rows: DepartmentCost[], money: Money, C: TokenColors, P: Palette, tip: (p: { name: string; perHead: string; total: string; employees: number }) => string) {
  const colors = [P.teal, P.sky, P.amber, P.sky, P.slate, P.teal];
  const data = rows.filter((r) => r.employees > 0).map((r, i) => {
    const perHead = Math.round(r.amountMinor / r.employees);
    return { name: r.department, value: money.major(perHead), minor: perHead, total: r.amountMinor, employees: r.employees, itemStyle: { color: colors[i % colors.length] } };
  });
  return {
    tooltip: {
      trigger: "item",
      formatter: (p: ChartParam) => (p.data?.minor === undefined ? "" : tip({ name: escapeHtml(p.name ?? ""), perHead: escapeHtml(money.exact(p.data.minor)), total: escapeHtml(money.exact(p.data.total ?? 0)), employees: p.data.employees ?? 0 })),
    },
    grid: { left: 64, right: 15, top: 15, bottom: 25 },
    xAxis: { type: "category", data: data.map((d) => d.name), axisLabel: { color: C.textPrimary, fontSize: 12.5 } },
    yAxis: { type: "value", axisLabel: { color: C.textMuted, formatter: (value: number) => money.compactMajor(value) }, splitLine: { lineStyle: { color: C.lineMuted } } },
    series: [{ type: "bar", barWidth: 16, data, label: { show: true, position: "top", color: C.textMuted, fontSize: 12.5, formatter: (p: ChartParam) => (p.data?.minor === undefined ? "" : money.compact(p.data.minor)) } }],
  };
}

/* ------------------------------------------------------------------ small parts */

function MoneyKpi({ icon, label, minor, money, caption, missing }: { icon: ReactNode; label: string; minor: number | null; money: Money | null; caption: string; missing: string }) {
  return (
    <div className={shared.kpiTile}>
      <div className={shared.kpiTopRow}><div className={shared.kpiIconSquircle}>{icon}</div></div>
      <div className={shared.kpiValueRow}>
        {minor === null || money === null ? <span className={styles.kpiValueMuted}>{missing}</span> : <span className={shared.kpiValue}>{money.compact(minor)}</span>}
      </div>
      <span className={shared.kpiLabel}>{label}</span>
      <span className={styles.kpiCaption} title={minor !== null && money ? money.exact(minor) : undefined}>{caption}</span>
    </div>
  );
}

const severityPill = (severity: string) => {
  const key = severity.toLowerCase();
  if (key === "critical" || key === "high" || key === "blocking" || key === "error") return shared.pillCoral;
  if (key === "medium" || key === "warning" || key === "review") return shared.pillAmber;
  if (key === "low" || key === "info") return shared.pillSky;
  return shared.pillSlate;
};
const statusPill = (status: string) => ({ open: shared.pillCoral, acknowledged: shared.pillAmber, escalated: shared.pillAmber, resolved: shared.pillTeal, overridden: shared.pillViolet, ignored: shared.pillViolet } as Record<string, string | undefined>)[status] ?? shared.pillSlate;

function ExceptionDecision({ row, busy, onSubmit, onCancel }: { row: ExceptionRow; busy: boolean; onSubmit: (disposition: Disposition, reason: string) => void; onCancel: () => void }) {
  const t = useT();
  const [disposition, setDisposition] = useState<Disposition>("resolve");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const min = disposition === "waive" ? WAIVER_MIN : REASON_MIN;
  const length = reason.trim().length;
  const error = length < min
    ? t(`${NS}.text_reason_short`, "Give a reason of at least {min} characters.", { min })
    : length > REASON_MAX ? t(`${NS}.text_reason_long`, "Keep the reason under {max} characters.", { max: REASON_MAX }) : null;
  const ids = { disposition: `pcr-disp-${row.id}`, reason: `pcr-reason-${row.id}`, error: `pcr-err-${row.id}` };
  return (
    <form className={styles.decision} onSubmit={(event) => { event.preventDefault(); setTouched(true); if (!error) onSubmit(disposition, reason.trim()); }}>
      <div className={styles.decisionRow}>
        <label htmlFor={ids.disposition} className={styles.subText}>{t(`${NS}.text_decision`, "Decision")}</label>
        <select id={ids.disposition} className={styles.field} value={disposition} onChange={(event) => setDisposition(event.target.value as Disposition)}>
          {RESOLVABLE_DISPOSITIONS.map((d) => <option key={d} value={d}>{t(`${NS}.disposition_${d}`, { resolve: "Resolve — the data was corrected", assign: "Assign — owner will correct it", escalate: "Escalate — keep open under a new owner", waive: "Waive — accept with a recorded reason" }[d])}</option>)}
        </select>
      </div>
      <label htmlFor={ids.reason} className={styles.subText}>{t(`${NS}.text_reason`, "Reason (required)")} *</label>
      <textarea id={ids.reason} className={`${styles.field} ${styles.textarea}`} value={reason} maxLength={REASON_MAX} aria-required="true"
        aria-invalid={touched && error !== null} aria-describedby={touched && error ? ids.error : undefined}
        onChange={(event) => setReason(event.target.value)} onBlur={() => setTouched(true)} />
      {touched && error && <p id={ids.error} className={styles.fieldError} role="alert">{error}</p>}
      <div className={styles.decisionRow}>
        <button type="submit" className={`${shared.btnRowAction} ${styles.button}`} disabled={busy || (touched && error !== null)}>
          {busy ? t(`${NS}.text_saving`, "Saving…") : t(`${NS}.text_record_decision`, "Record decision")}
        </button>
        <button type="button" className={`${shared.btnRowAction} ${styles.button}`} onClick={onCancel} disabled={busy}>{t(`${NS}.text_cancel`, "Cancel")}</button>
      </div>
    </form>
  );
}

function ExceptionsTable({ source, busyId, onDecide }: { source: Source<ExceptionRow[]>; busyId: string | null; onDecide: (row: ExceptionRow, disposition: Disposition, reason: string) => Promise<boolean> }) {
  const t = useT();
  const [open, setOpen] = useState<string | null>(null);
  if (source.value.length === 0) return <p className={styles.empty}>{t(`${NS}.text_no_exceptions`, "No exceptions were raised on this run.")}</p>;
  return (
    <div className={styles.tableWrap}>
      <table className={shared.dataTable}>
        <thead>
          <tr>
            <th scope="col">{t(`${NS}.content_text_95`, "Exception")}</th>
            <th scope="col">{t(`${NS}.text_col_employee`, "Employee")}</th>
            <th scope="col">{t(`${NS}.content_text_99`, "Type")}</th>
            <th scope="col">{t(`${NS}.text_col_status`, "Status")}</th>
            <th scope="col"><span className={styles.visuallyHidden}>{t(`${NS}.text_col_action`, "Action")}</span></th>
          </tr>
        </thead>
        <tbody>
          {source.value.map((row) => (
            <tr key={row.id}>
              <td>
                <strong className={styles.code}>{row.ruleCode}</strong>
                <div className={styles.subText}>{row.reason || t(`${NS}.text_no_reason`, "The rule recorded no detail.")}</div>
                {row.resolution && <div className={styles.subText}>{t(`${NS}.text_resolution`, "Decision: {resolution}", { resolution: row.resolution })}</div>}
                {open === row.id && (
                  <ExceptionDecision row={row} busy={busyId === row.id} onCancel={() => setOpen(null)}
                    onSubmit={(disposition, reason) => { void onDecide(row, disposition, reason).then((ok) => { if (ok) setOpen(null); }); }} />
                )}
              </td>
              <td>{row.employeeName}<div className={`${styles.subText} ${styles.code}`}>{row.employeeCode}</div></td>
              <td><span className={`${shared.pillBadge} ${severityPill(row.severity)}`}>{t(`${NS}.severity_${slug(row.severity)}`, row.severity)}</span></td>
              <td><span className={`${shared.pillBadge} ${statusPill(row.status)}`}>{t(`${NS}.status_${slug(row.status)}`, row.status)}</span></td>
              <td>
                <button type="button" className={`${shared.btnRowAction} ${styles.button}`} disabled={!row.resolvable || open === row.id}
                  title={row.resolvable ? undefined : t(`${NS}.text_already_decided`, "Only an open exception can be decided.")} onClick={() => setOpen(row.id)}>
                  {t(`${NS}.text_decide`, "Decide")}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const STEP_STATE: Record<"done" | "current" | "todo", string | undefined> = { done: styles.stepDone, current: styles.stepCurrent, todo: undefined };

/* ------------------------------------------------------------------ screen */

export default function PayrollControlRoom() {
  const t: Translate = useT();
  const { locale } = useTranslation();
  const { theme } = useHRMS() as { theme: string };
  const C = useMemo(() => chartTokenColors(theme) as TokenColors, [theme]);
  // `C` is re-read per theme, so keying on it re-reads the card token when the theme changes.
  const cardBorder = useMemo(() => {
    if (typeof window === "undefined") return C.lineMuted;
    return getComputedStyle(document.documentElement).getPropertyValue("--card").trim() || C.lineMuted;
  }, [C]);
  const P = NUCLEUS_COLORS as Palette;
  const { state, select, reload } = useControlRoom();
  const keys = useRef(new Map<string, string>());
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const act = useCallback(async (id: string, url: string, body: unknown, success: string): Promise<boolean> => {
    // One Idempotency-Key per logical submit, reused if the same action is retried after a failure.
    const key = keys.current.get(id) ?? newKey();
    keys.current.set(id, key);
    setBusy(id);
    setNotice(null);
    try {
      const result = await postJson(url, body, key);
      if (result.ok) {
        keys.current.delete(id);
        setNotice({ tone: "ok", text: success });
        reload();
        return true;
      }
      setNotice({ tone: "error", text: result.message || t(`${NS}.text_action_failed`, "The server did not accept this action. Refresh and try again.") });
      return false;
    } catch {
      setNotice({ tone: "error", text: t(`${NS}.text_network`, "Could not reach the server. Check your connection and try again.") });
      return false;
    } finally {
      setBusy(null);
    }
  }, [reload, t]);

  const view = state.status === "ready" ? state.data : null;
  const selected: PeriodOption | null = view?.selected ?? null;
  const money = useMemo(() => (selected ? moneyFormatter(selected.currency, locale) : null), [selected, locale]);

  const options = useMemo(() => {
    if (!view || !money) return null;
    const bridgeLabel = (bar: VarianceView["bars"][number]) => {
      if (bar.kind === "base" && view.variance.value) return t(`${NS}.text_period_gross`, "{period} gross", { period: view.variance.value.priorPeriodLabel });
      if (bar.kind === "total" && view.variance.value) return t(`${NS}.text_period_gross`, "{period} gross", { period: view.variance.value.currentPeriodLabel });
      return t(`${NS}.bridge_${slug(bar.label)}`, bar.label);
    };
    return {
      bridge: view.variance.value ? waterfallOption(view.variance.value, money, C, P, bridgeLabel) : null,
      donut: view.composition.value ? donutOption(view.composition.value, money, C, P, t(`${NS}.text_period_gross`, "{period} gross", { period: selected?.periodLabel ?? "" }), cardBorder) : null,
      departments: departmentOption(view.departments.value, money, C, P, (p) => `${p.name}<br/>${t(`${NS}.text_department_tip_head`, "{amount} per employee", { amount: p.perHead })}<br/>${t(`${NS}.text_department_tip_total`, "{total} across {employees} employees", { total: p.total, employees: formatNumber(p.employees, locale) })}`),
    };
  }, [view, money, C, P, t, selected, cardBorder, locale]);

  if (state.status === "loading") return <CockpitLoading label={t(`${NS}.text_loading`, "Loading the Payroll Control Room…")} />;
  if (state.status === "error") return <CockpitError message={state.message} forbidden={state.forbidden} onRetry={reload} />;
  const d = state.data;
  const counts = d.counts.available ? d.counts.value : null;
  const status = selected?.status.toLowerCase() ?? "";
  const released = status === "finalized" || status === "paid" || status === "closed";
  const missing = t(`${NS}.text_not_calculated`, "Not calculated");

  const calcBlocked = !selected ? t(`${NS}.text_no_run`, "There is no payroll run to act on.")
    : status !== "draft" && status !== "calculated" ? t(`${NS}.text_calc_blocked`, "Only a draft or calculated run can be calculated.") : null;
  const approveBlocked = !selected ? t(`${NS}.text_no_run`, "There is no payroll run to act on.")
    : status !== "calculated" ? t(`${NS}.text_approve_blocked`, "Only a calculated run can be approved.")
      : !counts ? t(`${NS}.text_approve_unknown`, "The open exception count could not be read, so approval stays locked.")
        : counts.anomaliesOpen > 0 ? t(`${NS}.text_approve_exceptions`, "Open exceptions to decide before approval: {count}.", { count: counts.anomaliesOpen }) : null;
  const severities = d.severityCounts.available && d.severityCounts.value.length > 0
    ? new Intl.ListFormat(locale || undefined, { style: "narrow", type: "unit" }).format(
      d.severityCounts.value.map((s) => t(`${NS}.text_severity_count`, "{severity}: {count}", { severity: t(`${NS}.severity_${slug(s.label)}`, s.label), count: formatNumber(s.value, locale) })),
    )
    : t(`${NS}.content_text_88`, "Mandatory pre-lock gate");

  return (
    <div className={shared.dashboardCanvas}>
      <div className={shared.scopeBar}>
        <div className={shared.scopeLeft}>
          <h2 className={shared.screenTitle}>{t(`${NS}.content_text_68`, "Payroll Control Room")}</h2>
          {selected && (
            <span className={shared.scopeMetadata}>
              {selected.employeeCount === null
                ? selected.periodLabel
                : t(`${NS}.text_scope_meta`, "{period} • {count} employees", { period: selected.periodLabel, count: selected.employeeCount })}
            </span>
          )}
          {selected && <span className={shared.scopePill}>{t(`${NS}.text_scope`, "Scope: {scope}", { scope: selected.scopeLabel })}</span>}
          {selected && <span className={shared.scopePill}>{t(`${NS}.text_run_status`, "{code} · {status}", { code: selected.displayCode, status: t(`${NS}.status_${slug(selected.status)}`, selected.status) })}</span>}
          {d.periods.length > 0 && (
            <>
              <label htmlFor="pcr-period" className={styles.visuallyHidden}>{t(`${NS}.text_period`, "Payroll run")}</label>
              <select id="pcr-period" className={shared.periodSelect} value={d.selectedRunId ?? ""} onChange={(event) => select(event.target.value || null)}>
                {d.periods.map((p) => <option key={p.runId} value={p.runId}>{t(`${NS}.text_period_option`, "{period} · {scope} · {code}", { period: p.periodLabel, scope: p.scopeLabel, code: p.displayCode })}</option>)}
              </select>
            </>
          )}
        </div>
        <div className={shared.scopeRight}>
          <button type="button" className={`${shared.scopeBtn} ${styles.button}`} disabled title={t(`${NS}.text_preview_unavailable`, "A payroll register preview is not available from the payroll service yet.")}>
            <FileCheck size={14} aria-hidden="true" />{t(`${NS}.text_preview`, "Preview register")}
          </button>
          <button type="button" className={`${shared.scopeBtn} ${styles.button}`} disabled={calcBlocked !== null || busy !== null} title={calcBlocked ?? undefined}
            onClick={() => selected && void act(`calc:${selected.runId}`, `/api/v1/payroll-runs/${encodeURIComponent(selected.runId)}/calculate`, {}, t(`${NS}.text_calc_done`, "The run was calculated."))}>
            <Calculator size={14} aria-hidden="true" />{busy?.startsWith("calc:") ? t(`${NS}.text_working`, "Working…") : t(`${NS}.text_calculate`, "Calculate run")}
          </button>
          <button type="button" className={`${shared.scopeBtn} ${styles.button}`} disabled={approveBlocked !== null || busy !== null} title={approveBlocked ?? undefined}
            onClick={() => selected && void act(`approve:${selected.runId}`, `/api/v1/payroll-runs/${encodeURIComponent(selected.runId)}/approve`, {}, t(`${NS}.text_approve_done`, "The run was approved."))}>
            <CheckCircle2 size={14} aria-hidden="true" />{busy?.startsWith("approve:") ? t(`${NS}.text_working`, "Working…") : t(`${NS}.text_approve`, "Approve run")}
          </button>
          <button type="button" className={`${shared.scopeBtn} ${shared.scopeBtnPrimary} ${styles.button}`} disabled
            title={released ? undefined : t(`${NS}.text_release_unavailable`, "Finalizing requires the run's version as an If-Match precondition, and this console does not receive it. Finalize from the payroll run screen.")}>
            <Lock size={14} aria-hidden="true" />{released ? t(`${NS}.display_3`, "Release authorized") : t(`${NS}.display_4`, "Lock and release")}
          </button>
        </div>
      </div>

      <div aria-live="polite">
        {notice && <p className={`${styles.notice} ${notice.tone === "ok" ? styles.noticeOk : styles.noticeError}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p>}
      </div>

      {d.stepper.available ? (
        <ol className={styles.stepper} aria-label={t(`${NS}.text_stepper`, "Run timeline")}>
          {d.stepper.value.map((step, index) => (
            <li key={step.key} className={`${styles.step} ${STEP_STATE[step.state] ?? ""}`} aria-current={step.state === "current" ? "step" : undefined}>
              <span className={styles.stepDot} aria-hidden="true">{step.state === "done" ? <CheckCircle2 size={14} /> : index + 1}</span>
              <div>
                <div className={styles.stepLabel}>{t(`${NS}.step_${step.key}`, step.label)}</div>
                <div className={styles.stepState}>{t(`${NS}.step_state_${step.state}`, { done: "Done", current: "In progress", todo: "Upcoming" }[step.state])}</div>
              </div>
            </li>
          ))}
        </ol>
      ) : <p className={styles.note} role="note">{d.stepper.message}</p>}

      <div className={shared.kpiRow}>
        <MoneyKpi icon={<IndianRupee size={18} aria-hidden="true" />} label={t(`${NS}.content_text_75`, "Gross payroll")} minor={selected?.grossMinor ?? null} money={money} missing={missing}
          caption={selected ? t(`${NS}.text_gross_caption`, "Stored on run {code}", { code: selected.displayCode }) : (d.counts.message ?? "")} />
        <MoneyKpi icon={<Landmark size={18} aria-hidden="true" />} label={t(`${NS}.content_text_79`, "Net disbursement")} minor={selected?.netMinor ?? null} money={money} missing={missing}
          caption={counts ? t(`${NS}.text_net_caption`, "Payslips: {payslips} · approvals: {approvals}", { payslips: counts.payslips, approvals: counts.approvals }) : (d.counts.message ?? "")} />
        <div className={shared.kpiTile}>
          <div className={shared.kpiTopRow}><div className={`${shared.kpiIconSquircle} ${shared.kpiIconSky}`}><ShieldCheck size={18} aria-hidden="true" /></div></div>
          <div className={shared.kpiValueRow}><span className={styles.kpiValueMuted}>{t(`${NS}.text_not_available`, "Not available")}</span></div>
          <span className={shared.kpiLabel}>{t(`${NS}.content_text_83`, "Statutory liability")}</span>
          <span className={styles.kpiCaption}>{t(`${NS}.text_statutory_unavailable`, "This console does not receive the run's statutory deduction totals yet.")}</span>
        </div>
        <div className={shared.kpiTile}>
          <div className={shared.kpiTopRow}><div className={`${shared.kpiIconSquircle} ${counts && counts.anomaliesOpen > 0 ? shared.kpiIconCoral : ""}`}><AlertOctagon size={18} aria-hidden="true" /></div></div>
          <div className={shared.kpiValueRow}>
            {counts ? <span className={shared.kpiValue}>{formatNumber(counts.anomaliesOpen, locale)}</span> : <span className={styles.kpiValueMuted}>{t(`${NS}.text_not_available`, "Not available")}</span>}
            {counts && <span className={`${shared.kpiDelta} ${counts.anomaliesOpen > 0 ? shared.deltaRisk : shared.deltaPositive}`}>{t(`${NS}.text_of_total`, "of {total}", { total: formatNumber(counts.anomaliesTotal, locale) })}</span>}
          </div>
          <span className={shared.kpiLabel}>{t(`${NS}.content_text_87`, "Open exceptions")}</span>
          <span className={styles.kpiCaption}>{counts ? severities : d.counts.message}</span>
        </div>
      </div>
      <PartialNotice sources={d.unavailableSources} />
      {selected && !money && <p className={styles.warn} role="note">{t(`${NS}.text_bad_currency`, "The run's currency {currency} is not recognised, so amounts are not shown.", { currency: selected.currency })}</p>}

      <div className={shared.grid12}>
        <ChartCard span={8} title={t(`${NS}.content_text_89`, "Why the cost moved")} source={d.variance}
          subtitle={d.variance.value ? t(`${NS}.text_bridge_sub`, "{prior} to {current} gross bridge", { prior: d.variance.value.priorPeriodLabel, current: d.variance.value.currentPeriodLabel }) : undefined}>
          {options?.bridge && <NucleusChart option={options.bridge} style={{ height: 260, width: "100%" }} />}
          {d.variance.value && d.variance.value.omitted.length > 0 && (
            <ul className={styles.omittedList} aria-label={t(`${NS}.text_not_drawn`, "Not drawn separately")}>
              {d.variance.value.omitted.map((o) => <li key={o.category}><strong>{t(`${NS}.bridge_${slug(o.category)}`, o.category)}</strong>: {o.reason}</li>)}
            </ul>
          )}
        </ChartCard>
        <ChartCard span={4} title={t(`${NS}.content_text_91`, "Cost composition")} source={d.composition}
          subtitle={selected ? t(`${NS}.text_composition_sub`, "{period} gross by component", { period: selected.periodLabel }) : undefined}>
          {options?.donut && <NucleusChart option={options.donut} style={{ height: 260, width: "100%" }} />}
          {d.composition.value && !d.composition.value.tiesToRunGross && money && (
            <p className={styles.warn} role="note">{t(`${NS}.text_composition_mismatch`, "Components sum to {lines}; the run stores {gross}. Recalculate the run before relying on this split.", { lines: money.exact(d.composition.value.componentTotalMinor), gross: d.composition.value.runGrossMinor === null ? missing : money.exact(d.composition.value.runGrossMinor) })}</p>
          )}
        </ChartCard>
      </div>

      <div className={shared.grid12}>
        <ChartCard span={7} title={t(`${NS}.content_text_93`, "Exceptions to clear before lock")} subtitle={t(`${NS}.text_exceptions_sub`, "Raised by the payroll rules on this run")} source={d.exceptions} minHeight={200}>
          <ExceptionsTable source={d.exceptions} busyId={busy}
            onDecide={(row, disposition, reason) => act(row.id, `/api/v1/payroll-anomalies/${encodeURIComponent(row.id)}/resolve`, { disposition, resolution: reason }, t(`${NS}.text_decision_done`, "The decision was recorded against this run."))} />
        </ChartCard>
        <ChartCard span={5} title={t(`${NS}.content_text_126`, "Statutory calendar")} subtitle={t(`${NS}.content_text_127`, "PF, ESI, multi-state PT, TDS 24Q")} minHeight={200}
          source={{ value: null, available: false, message: t(`${NS}.text_calendar_unavailable`, "Statutory due dates and filing status are not served to this console yet.") }}>
          {null}
        </ChartCard>
      </div>

      <div className={shared.grid12}>
        <ChartCard span={6} title={t(`${NS}.content_text_152`, "Cost per employee by function")} subtitle={t(`${NS}.text_department_sub`, "Earnings per employee in this run, by department")} source={d.departments} minHeight={220}>
          {d.departments.value.length === 0
            ? <p className={styles.empty}>{t(`${NS}.text_no_departments`, "This run has posted no earning lines yet.")}</p>
            : options && <NucleusChart option={options.departments} style={{ height: 220, width: "100%" }} />}
        </ChartCard>
        <ChartCard span={6} title={t(`${NS}.content_text_154`, "Payroll accuracy trend")} subtitle={t(`${NS}.content_text_155`, "Off-cycle corrections per 1,000 payslips")} minHeight={220}
          source={{ value: null, available: false, message: t(`${NS}.text_accuracy_unavailable`, "Correction runs are not linked to the payslips they correct, so an accuracy rate cannot be computed yet.") }}>
          {null}
        </ChartCard>
      </div>
    </div>
  );
}
