"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, CalendarDays, LayoutGrid, MapPin, RotateCcw } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import styles from "./ScopeFilters.module.css";

/**
 * Organisation-wide scope filters for the cockpit header (super admin only — the caller decides).
 * Options are the tenant's real master data from GET /api/v1/organization/tree. The chosen scope is announced
 * with the `nucleus:dashboard-scope` window event and held by the caller; nothing here is hardcoded.
 */

export type DashboardScope = { locationId: string | null; departmentId: string | null; legalEntityId: string | null; months: 1 | 3 | 6 | 12 };
export const DEFAULT_SCOPE: DashboardScope = { locationId: null, departmentId: null, legalEntityId: null, months: 3 };

type Option = { id: string; label: string };
type Tree = {
  entities?: Array<{ id: string; code: string; legal_name: string }>;
  departments?: Array<{ id: string; attributes?: { name?: string; code?: string } }>;
  locations?: Array<{ id: string; attributes?: { name?: string; code?: string } }>;
};
type Translate = (key: string, fallback: string, params?: Record<string, unknown>) => string;
const NS = "components.Dashboard.ScopeFilters";
const PERIODS: DashboardScope["months"][] = [1, 3, 6, 12];

export default function ScopeFilters({ value, onChange }: { value: DashboardScope; onChange: (scope: DashboardScope) => void }) {
  const { t: rawT } = useTranslation();
  const t = rawT as Translate;
  const [tree, setTree] = useState<Tree | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v1/organization/tree", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as { data?: Tree } | null;
        if (!response.ok || !payload?.data) throw new Error("unavailable");
        setTree(payload.data);
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, []);

  const options = useMemo(() => {
    const named = (rows: Array<{ id: string; attributes?: { name?: string; code?: string } }> = []): Option[] =>
      rows.map((row) => ({ id: row.id, label: row.attributes?.name || row.attributes?.code || "" })).filter((o) => o.label).sort((a, b) => a.label.localeCompare(b.label));
    return {
      locations: named(tree?.locations),
      departments: named(tree?.departments),
      entities: (tree?.entities ?? []).map((e) => ({ id: e.id, label: e.legal_name || e.code })),
    };
  }, [tree]);

  const set = (patch: Partial<DashboardScope>) => onChange({ ...value, ...patch });
  const changed = value.locationId || value.departmentId || value.legalEntityId || value.months !== DEFAULT_SCOPE.months;
  const all = t(`${NS}.text_all`, "All");

  const chip = (icon: React.ReactNode, label: string, current: string | null, list: Option[], key: "locationId" | "departmentId" | "legalEntityId") => (
    <label className={styles.chip}>
      <span className={styles.icon} aria-hidden="true">{icon}</span>
      <span className={styles.label}>{label}</span>
      <select className={styles.select} value={current ?? ""} onChange={(event) => set({ [key]: event.target.value || null } as Partial<DashboardScope>)} disabled={!tree} aria-label={label}>
        <option value="">{all}</option>
        {list.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </label>
  );

  return (
    <div className={styles.row} role="group" aria-label={t(`${NS}.text_group`, "Workforce scope")}>
      {chip(<MapPin size={16} />, t(`${NS}.text_location`, "Location"), value.locationId, options.locations, "locationId")}
      {chip(<LayoutGrid size={16} />, t(`${NS}.text_department`, "Department"), value.departmentId, options.departments, "departmentId")}
      {chip(<Building2 size={16} />, t(`${NS}.text_entity`, "Entity"), value.legalEntityId, options.entities, "legalEntityId")}
      <div className={styles.seg} role="radiogroup" aria-label={t(`${NS}.text_timeframe`, "Timeframe")}>
        <CalendarDays size={16} className={styles.icon} aria-hidden="true" />
        {PERIODS.map((months) => (
          <button key={months} type="button" role="radio" aria-checked={value.months === months} className={value.months === months ? styles.on : ""} onClick={() => set({ months })}>
            {months === 12 ? t(`${NS}.text_1y`, "1Y") : t(`${NS}.text_months`, "{n}M", { n: months })}
          </button>
        ))}
      </div>
      {changed && (
        <button type="button" className={styles.reset} onClick={() => onChange(DEFAULT_SCOPE)}>
          <RotateCcw size={14} aria-hidden="true" />{t(`${NS}.text_reset`, "Reset")}
        </button>
      )}
      {failed && <span className={styles.note} role="note">{t(`${NS}.text_failed`, "Filter options could not be loaded.")}</span>}
    </div>
  );
}
