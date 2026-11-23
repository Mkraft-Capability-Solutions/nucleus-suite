"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Award, ClipboardCheck, Layers, ShieldCheck } from "lucide-react";
import NucleusChart from "@/components/Charts/NucleusChart";
import { NUCLEUS_COLORS, chartTokenColors } from "@/components/Charts/theme";
import { useHRMS } from "@/context/HRMSContext";
import { useTranslation } from "@/context/I18nContext";
import type { CockpitState } from "@/lib/cockpits/use-cockpit";
import type { Source } from "@/lib/cockpits/source-types";
import type { CompetencyView, DistributionView, NineBoxCellView, PerformanceCalibrationView, PersonRef } from "@/lib/cockpits/performance-calibration-types";
import { ChartCard, CockpitError, CockpitLoading, KpiTile, PartialNotice, formatNumber, useT } from "../cockpit/CockpitParts";
import shared from "../DashboardShared.module.css";
import styles from "./PerformanceTalent.module.css";

/**
 * S6 Performance & Calibration. Every figure comes from GET /api/v1/cockpits/performance-calibration for the selected
 * review cycle and calibration session; a feed that did not resolve shows its reason instead of a number. Writes go to
 * POST /api/v1/calibration-sessions and POST /api/v1/talent-placements with an Idempotency-Key.
 */

type Palette = Record<"teal" | "sky", string>;
type TokenColors = { textPrimary: string; textMuted: string; lineMuted: string };
type Translate = ReturnType<typeof useT>;
type Band = "low" | "medium" | "high";
type Tone = "toneStrong" | "toneSteady" | "toneWatch" | "toneRisk";

const NS = "components.Dashboard.Views.PerformanceTalent";
const COCKPIT_URL = "/api/v1/cockpits/performance-calibration";
const BANDS: readonly Band[] = ["low", "medium", "high"];
const BAND_AT: Record<1 | 2 | 3, Band> = { 1: "low", 2: "medium", 3: "high" };

/** Stable box codes (performance-potential) with their existing names and accent tones. */
const BOXES: Record<string, { name: string; tone: Tone }> = {
  "low-high": { name: "Enigma", tone: "toneWatch" },
  "medium-high": { name: "Growth", tone: "toneStrong" },
  "high-high": { name: "Star", tone: "toneStrong" },
  "low-medium": { name: "Dilemma", tone: "toneWatch" },
  "medium-medium": { name: "Core", tone: "toneSteady" },
  "high-medium": { name: "High impact", tone: "toneStrong" },
  "low-low": { name: "Risk", tone: "toneRisk" },
  "medium-low": { name: "Effective", tone: "toneSteady" },
  "high-low": { name: "Trusted pro", tone: "toneSteady" },
};
const boxCode = (performance: Band, potential: Band) => `${performance}-${potential}`;
const boxName = (t: Translate, code: string) => t(`${NS}.text_box_${code.replace("-", "_")}`, BOXES[code]?.name ?? code);
const bandName = (t: Translate, band: Band) => t(`${NS}.text_band_${band}`, { low: "Low", medium: "Medium", high: "High" }[band]);

type Envelope = { data?: PerformanceCalibrationView; meta?: { completeness?: "complete" | "partial"; generatedAt?: string }; error?: { message?: string } };

/** Same contract as useCockpit, plus the cycle / session selection the S6 route accepts. */
function useCalibration(cycleId: string, sessionId: string) {
  const [state, setState] = useState<CockpitState<PerformanceCalibrationView>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams();
    if (cycleId) query.set("cycleId", cycleId);
    if (sessionId) query.set("sessionId", sessionId);
    const suffix = query.toString();
    fetch(suffix ? `${COCKPIT_URL}?${suffix}` : COCKPIT_URL, { signal: controller.signal, cache: "no-store" })
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
  }, [cycleId, sessionId, attempt]);
  const reload = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);
  return { state, reload };
}

/** POSTs one write with its Idempotency-Key; resolves to the server's error message on failure. */
async function postWrite(url: string, body: unknown, idempotencyKey: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body),
    });
    if (response.ok) return null;
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    return payload?.error?.message ?? "";
  } catch {
    return "";
  }
}

function distributionOption(d: DistributionView, C: TokenColors, P: Palette, labels: { actual: string; guided: string; point: (n: string) => string }) {
  const series: unknown[] = [{ name: labels.actual, type: "bar", data: d.buckets.map((b) => b.actual), itemStyle: { color: P.teal }, barWidth: 20 }];
  if (d.guidedConfigured) series.push({ name: labels.guided, type: "line", smooth: true, data: d.buckets.map((b) => b.guided), itemStyle: { color: P.sky }, lineStyle: { width: 2, type: "dashed" } });
  return {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { bottom: 0, data: d.guidedConfigured ? [labels.actual, labels.guided] : [labels.actual], textStyle: { color: C.textMuted, fontSize: 12.5 } },
    grid: { left: 40, right: 16, top: 16, bottom: 48 },
    xAxis: { type: "category", data: d.buckets.map((b) => labels.point(b.bucket)), axisLabel: { color: C.textMuted } },
    yAxis: { type: "value", minInterval: 1, splitLine: { lineStyle: { color: C.lineMuted } } },
    series,
  };
}

function radarOption(c: CompetencyView, fn: string, C: TokenColors, P: Palette, benchmark: string) {
  const axes = c.axes.filter((axis) => axis.byFunction[fn] !== undefined);
  if (axes.length === 0) return null;
  return {
    legend: { bottom: 0, data: [fn, benchmark], textStyle: { color: C.textMuted, fontSize: 12.5 } },
    radar: { indicator: axes.map((a) => ({ name: a.competency, max: c.scaleMax })), center: ["50%", "46%"], radius: "65%", axisName: { color: C.textMuted }, splitLine: { lineStyle: { color: C.lineMuted } } },
    series: [{
      type: "radar",
      data: [
        { value: axes.map((a) => a.byFunction[fn]?.average ?? 0), name: fn, itemStyle: { color: P.teal }, areaStyle: { color: P.teal, opacity: 0.2 } },
        { value: axes.map((a) => a.target), name: benchmark, itemStyle: { color: P.sky }, lineStyle: { type: "dashed" } },
      ],
    }],
  };
}

/** Population standard deviation of the submitted ratings, from the exact per-point counts. */
function ratingSpread(d: DistributionView): number | null {
  const n = d.buckets.reduce((sum, b) => sum + b.actual, 0);
  if (n === 0) return null;
  const mean = d.buckets.reduce((sum, b, i) => sum + (i + 1) * b.actual, 0) / n;
  return Math.sqrt(d.buckets.reduce((sum, b, i) => sum + b.actual * (i + 1 - mean) ** 2, 0) / n);
}

const unavailable = (message: string): Source<number | null> => ({ value: null, available: false, message });

export default function PerformanceTalent({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const t = useT();
  const { locale } = useTranslation();
  const { theme } = useHRMS() as { theme: string };
  const C = useMemo(() => chartTokenColors(theme) as TokenColors, [theme]);
  const P = NUCLEUS_COLORS as Palette;
  const [cycleId, setCycleId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [fn, setFn] = useState("");
  const [cellId, setCellId] = useState("");
  const { state, reload } = useCalibration(cycleId, sessionId);
  const [opening, setOpening] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const openKey = useRef<string | null>(null);

  const view = state.status === "ready" ? state.data : null;
  const competency = view?.competency.available ? view.competency.value : null;
  const selectedFn = competency && competency.functions.length > 0 ? (competency.functions.includes(fn) ? fn : competency.functions[0]) : "";

  const options = useMemo(() => {
    if (!view) return null;
    const d = view.distribution.available ? view.distribution.value : null;
    return {
      distribution: d ? distributionOption(d, C, P, { actual: t(`${NS}.text_series_actual`, "Ratings submitted"), guided: t(`${NS}.text_series_guided`, "Guided curve"), point: (n) => t(`${NS}.text_rating_point`, "Rating {point}", { point: n }) }) : null,
      radar: competency && selectedFn ? radarOption(competency, selectedFn, C, P, t(`${NS}.text_series_benchmark`, "Role benchmark")) : null,
    };
  }, [view, competency, selectedFn, C, P, t]);

  if (state.status === "loading") return <CockpitLoading label={t(`${NS}.text_loading`, "Loading Performance & Calibration…")} />;
  if (state.status === "error") return <CockpitError message={state.message} forbidden={state.forbidden} onRetry={reload} />;
  const d = state.data;
  const dist = d.distribution.available ? d.distribution.value : null;
  const nineBox = d.nineBox.available ? d.nineBox.value : null;
  const session = d.sessions.find((s) => s.id === d.selectedSessionId) ?? null;
  const focused = nineBox?.cells.find((cell) => cell.id === cellId) ?? null;
  const spread = dist ? ratingSpread(dist) : null;

  const completion: Source<number | null> = d.participation.available && d.participation.value?.completionPct !== null && d.participation.value
    ? { value: d.participation.value.completionPct, available: true, origin: t(`${NS}.text_completion_origin`, "{done} of {total} participants have a submitted review", { done: d.participation.value.participantsWithSubmissions, total: d.participation.value.participants }) }
    : unavailable(d.participation.message ?? t(`${NS}.text_no_participants`, "No participant is enrolled in this cycle yet."));
  const spreadSource: Source<number | null> = dist && spread !== null
    ? { value: spread, available: true, origin: t(`${NS}.text_spread_origin`, "Standard deviation of {count} submitted ratings", { count: dist.ratingsCounted }) }
    : unavailable(d.distribution.message ?? t(`${NS}.text_no_ratings`, "No ratings have been submitted for this cycle."));

  const openSession = async () => {
    if (!d.cycle || opening) return;
    setOpening(true);
    setActionError(null);
    openKey.current ??= crypto.randomUUID();
    const error = await postWrite("/api/v1/calibration-sessions", { reviewCycleCode: d.cycle.code }, openKey.current);
    setOpening(false);
    if (error !== null) {
      setActionError(error || t(`${NS}.text_open_failed`, "The calibration session could not be opened. Try again."));
      return;
    }
    openKey.current = null;
    setSessionId("");
    reload();
  };

  return (
    <div className={shared.dashboardCanvas}>
      <div className={styles.toolbar}>
        <label>
          {t(`${NS}.text_cycle`, "Review cycle")}
          <select className={shared.periodSelect} value={d.selectedCycleId ?? ""} disabled={d.cycles.length === 0} onChange={(e) => { setCycleId(e.target.value); setSessionId(""); setCellId(""); }}>
            {d.cycles.length === 0 && <option value="">{t(`${NS}.text_no_cycle`, "No review cycle")}</option>}
            {d.cycles.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.status}</option>)}
          </select>
        </label>
        <label>
          {t(`${NS}.text_session`, "Calibration session")}
          <select className={shared.periodSelect} value={d.selectedSessionId ?? ""} disabled={d.sessions.length === 0} onChange={(e) => { setSessionId(e.target.value); setCellId(""); }}>
            {d.sessions.length === 0 && <option value="">{t(`${NS}.text_no_session`, "No calibration session")}</option>}
            {d.sessions.map((s) => <option key={s.id} value={s.id}>{s.department ?? t(`${NS}.text_all_functions`, "All functions")} · {s.status}</option>)}
          </select>
        </label>
        <span className={styles.toolbarSpacer} />
        <button type="button" className={styles.secondaryBtn} onClick={openSession} disabled={!d.cycle || opening} title={d.cycle ? undefined : t(`${NS}.text_open_needs_cycle`, "Create a review cycle before opening a calibration session.")}>
          {opening ? t(`${NS}.text_opening`, "Opening…") : t(`${NS}.text_open_session`, "Open calibration session")}
        </button>
        <button type="button" className={styles.secondaryBtn} onClick={() => onNavigate?.("performance")} disabled={!onNavigate}>
          {t(`${NS}.text_go_reviews`, "Go to performance reviews")}
        </button>
        <button type="button" className={`${shared.primaryBtn} ${styles.primaryDisabled}`} disabled title={t(`${NS}.text_publish_unavailable`, "Releasing calibrated ratings has no endpoint yet, so ratings cannot be published from this console.")}>
          {t(`${NS}.text_publish`, "Publish ratings")}
        </button>
      </div>
      {actionError !== null && <p className={styles.actionError} role="alert">{actionError}</p>}

      <div className={shared.kpiRow}>
        <KpiTile icon={<ClipboardCheck size={18} />} label={t(`${NS}.text_kpi_reviews`, "Reviews complete")} source={completion} unit="%" digits={1} />
        <KpiTile icon={<ShieldCheck size={18} />} tone="sky" label={t(`${NS}.text_kpi_goals`, "Goals with evidence")} source={unavailable(t(`${NS}.text_goals_unavailable`, "Goal evidence is not linked to review submissions, so no share can be stated."))} />
        <KpiTile icon={<Layers size={18} />} label={t(`${NS}.text_kpi_spread`, "Rating spread (σ)")} source={spreadSource} digits={2} />
        <KpiTile icon={<Award size={18} />} tone="sky" label={t(`${NS}.text_kpi_succession`, "Succession cover")} source={unavailable(t(`${NS}.text_succession_kpi_unavailable`, "No succession-cover measure is defined for this console."))} />
      </div>
      <PartialNotice sources={d.unavailableSources} />

      <div className={shared.grid12}>
        <ChartCard span={5} title={t(`${NS}.text_card_ninebox`, "Nine-box talent grid")} subtitle={nineBox ? t(`${NS}.text_card_ninebox_sub`, "Performance × potential · {placed} placed", { placed: nineBox.placed }) : t(`${NS}.text_card_ninebox_sub_empty`, "Performance × potential")} source={d.nineBox} minHeight={300}>
          {nineBox && <NineBoxGrid cells={nineBox.cells} selected={cellId} onSelect={(id) => setCellId(id === cellId ? "" : id)} note={[nineBox.bandingNote, nineBox.unplacedNote]} />}
        </ChartCard>
        <ChartCard span={7} title={t(`${NS}.text_card_distribution`, "Rating distribution")} subtitle={dist?.guidedConfigured ? t(`${NS}.text_card_distribution_sub`, "Submitted ratings against the guided curve") : t(`${NS}.text_card_distribution_sub_plain`, "Submitted ratings, counted at the point given")} source={d.distribution} minHeight={300}>
          {dist && options?.distribution && (
            <>
              <div role="img" aria-label={t(`${NS}.text_distribution_aria`, "Rating distribution: {values}", { values: dist.buckets.map((b) => `${b.bucket}: ${formatNumber(b.actual, locale)}`).join(", ") })}>
                <NucleusChart option={options.distribution} style={{ height: 260, width: "100%" }} />
              </div>
              <p className={styles.note}>{dist.guidedNote}</p>
              {(dist.ignoredRatings > 0 || dist.truncated) && <p className={styles.note}>{t(`${NS}.text_distribution_partial`, "{ignored} off-scale values were not counted; partial read: {truncated}.", { ignored: dist.ignoredRatings, truncated: dist.truncated ? t(`${NS}.text_yes`, "yes") : t(`${NS}.text_no`, "no") })}</p>}
            </>
          )}
        </ChartCard>
        <ChartCard span={6} title={t(`${NS}.text_card_competency`, "Competency profile")} subtitle={t(`${NS}.text_card_competency_sub`, "Function average against the role benchmark")} source={d.competency} minHeight={300}
          tools={competency && competency.functions.length > 0 ? (
            <select className={shared.periodSelect} aria-label={t(`${NS}.text_function`, "Function")} value={selectedFn} onChange={(e) => setFn(e.target.value)}>
              {competency.functions.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          ) : undefined}>
          {options?.radar
            ? <NucleusChart option={options.radar} style={{ height: 280, width: "100%" }} />
            : <p className={styles.empty}>{t(`${NS}.text_no_benchmarked`, "Nobody in this function has been assessed on a benchmarked competency.")}</p>}
        </ChartCard>
        <ChartCard span={6} title={focused ? boxName(t, boxCode(BAND_AT[focused.performance], BAND_AT[focused.potential])) : t(`${NS}.text_card_box`, "Box detail")} subtitle={focused ? t(`${NS}.text_card_box_sub`, "{count} placed in this box", { count: focused.count }) : t(`${NS}.text_card_box_hint`, "Select a box to list the people placed in it")} source={d.nineBox} minHeight={300}>
          {focused
            ? <BoxPeople key={focused.id} cell={focused} sessionId={session?.id ?? null} sessionOpen={session?.status === "open"} onSaved={reload} />
            : <p className={styles.empty}>{t(`${NS}.text_no_box`, "No box selected.")}</p>}
        </ChartCard>
        <ChartCard span={6} title={t(`${NS}.text_card_bias`, "Calibration checks: pattern & bias flags")} subtitle={t(`${NS}.text_card_bias_sub`, "Review of rating distributions")} source={{ value: null, available: false, message: t(`${NS}.text_bias_unavailable`, "No bias or pattern check runs on this cycle's ratings yet, so no flag is raised. Read the distribution and nine-box above directly.") }}>
          {null}
        </ChartCard>
        <ChartCard span={6} title={t(`${NS}.text_card_succession`, "Succession cover for critical roles")} subtitle={t(`${NS}.text_card_succession_sub`, "Bench strength and single-point risks")} source={{ value: null, available: false, message: t(`${NS}.text_succession_unavailable`, "Succession plans are not part of this console's feed, so no bench strength is shown here.") }}>
          {null}
        </ChartCard>
      </div>
    </div>
  );
}

function NineBoxGrid({ cells, selected, onSelect, note }: { cells: NineBoxCellView[]; selected: string; onSelect: (id: string) => void; note: string[] }) {
  const t = useT();
  const { locale } = useTranslation();
  const rows: Array<1 | 2 | 3> = [3, 2, 1];
  const columns: Array<1 | 2 | 3> = [1, 2, 3];
  return (
    <>
      <div className={styles.nineBox} role="group" aria-label={t(`${NS}.text_ninebox_aria`, "Nine-box grid: performance across, potential up")}>
        {rows.flatMap((potential) => columns.map((performance) => {
          const code = boxCode(BAND_AT[performance], BAND_AT[potential]);
          const cell = cells.find((c) => c.performance === performance && c.potential === potential);
          const count = cell?.count ?? 0;
          return (
            <button key={code} type="button" disabled={!cell} aria-pressed={cell ? selected === cell.id : undefined}
              className={`${styles.cell} ${styles[BOXES[code]?.tone ?? "toneSteady"]} ${cell && selected === cell.id ? styles.cellSelected : ""}`}
              onClick={() => cell && onSelect(cell.id)}>
              <span className={styles.cellCount}>{formatNumber(count, locale)}</span>
              <span className={styles.cellName}>{boxName(t, code)}</span>
              <span className={styles.cellBands}>{t(`${NS}.text_cell_bands`, "{performance} / {potential}", { performance: bandName(t, BAND_AT[performance]), potential: bandName(t, BAND_AT[potential]) })}</span>
            </button>
          );
        }))}
      </div>
      <div className={styles.axisRow}>
        <span>{t(`${NS}.text_axis_performance`, "← Low performance · High →")}</span>
        <span>{t(`${NS}.text_axis_potential`, "↑ High potential")}</span>
      </div>
      {note.filter(Boolean).map((line) => <p key={line} className={styles.note}>{line}</p>)}
    </>
  );
}

/** Lists the people in one box and records a reasoned move to another box (POST /api/v1/talent-placements). */
function BoxPeople({ cell, sessionId, sessionOpen, onSaved }: { cell: NineBoxCellView; sessionId: string | null; sessionOpen: boolean; onSaved: () => void }) {
  const t = useT();
  const [moving, setMoving] = useState<PersonRef | null>(null);
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef<string | null>(null);
  const current = boxCode(BAND_AT[cell.performance], BAND_AT[cell.potential]);
  const blocked = !sessionId ? t(`${NS}.text_move_no_session`, "Open a calibration session first.") : !sessionOpen ? t(`${NS}.text_move_closed`, "This calibration session is closed, so placements cannot change.") : undefined;

  if (cell.employees.length === 0) return <p className={styles.empty}>{t(`${NS}.text_box_empty`, "Nobody is placed in this box in the selected session.")}</p>;

  const start = (person: PersonRef) => { setMoving(person); setTarget(""); setReason(""); setError(null); key.current = crypto.randomUUID(); };
  const submit = async () => {
    if (!moving || !sessionId || !target || reason.trim().length === 0 || saving) return;
    const [performanceBand, potentialBand] = target.split("-") as [Band, Band];
    setSaving(true);
    setError(null);
    const body = { calibrationSessionId: sessionId, employeeId: moving.id, performanceBand, potentialBand, rationale: reason.trim(), adjustmentReason: reason.trim() };
    const failure = await postWrite("/api/v1/talent-placements", body, key.current ?? crypto.randomUUID());
    setSaving(false);
    if (failure !== null) {
      setError(failure || t(`${NS}.text_move_failed`, "The placement could not be recorded. Try again."));
      return;
    }
    setMoving(null);
    onSaved();
  };

  return (
    <ul className={styles.people}>
      {cell.employees.map((person) => (
        <li key={person.id}>
          <div className={styles.person}>
            <span className={styles.personName}>{person.name} <span className={styles.personCode}>{person.code}</span></span>
            <button type="button" className={styles.linkBtn} disabled={Boolean(blocked) || saving} title={blocked} onClick={() => start(person)}>{t(`${NS}.text_move`, "Move")}</button>
          </div>
          {moving?.id === person.id && (
            <form className={styles.moveForm} onSubmit={(e) => { e.preventDefault(); void submit(); }}>
              <label>
                {t(`${NS}.text_move_to`, "Move to box")} *
                <select required aria-required="true" value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value="">{t(`${NS}.text_choose_box`, "Choose a box")}</option>
                  {BANDS.flatMap((perf) => BANDS.map((pot) => boxCode(perf, pot))).filter((code) => code !== current).map((code) => <option key={code} value={code}>{boxName(t, code)}</option>)}
                </select>
              </label>
              <label>
                {t(`${NS}.text_move_reason`, "Reason for the change")} *
                <textarea required aria-required="true" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
              </label>
              {error !== null && <p className={styles.actionError} role="alert">{error}</p>}
              <div className={styles.formActions}>
                <button type="button" className={styles.secondaryBtn} onClick={() => setMoving(null)}>{t(`${NS}.text_cancel`, "Cancel")}</button>
                <button type="submit" className={shared.primaryBtn} disabled={!target || reason.trim().length === 0 || saving}>{saving ? t(`${NS}.text_saving`, "Saving…") : t(`${NS}.text_record_move`, "Record placement")}</button>
              </div>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}
