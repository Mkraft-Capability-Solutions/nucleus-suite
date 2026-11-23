"use client";

import type { ReactNode } from "react";
import { AlertCircle, RefreshCcw } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import type { Source } from "@/lib/cockpits/source-types";
import shared from "../DashboardShared.module.css";
import styles from "./CockpitParts.module.css";

/** Shared building blocks for every cockpit screen: KPI tile, chart card and honest loading / error states. */

type Translate = (key: string, fallback: string, params?: Record<string, unknown>) => string;
export function useT(): Translate {
  const { t } = useTranslation();
  return t as Translate;
}

const NS = "components.Dashboard.cockpit";

export function formatNumber(value: number, locale: string | undefined, digits = 0): string {
  return new Intl.NumberFormat(locale || undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value);
}

export function KpiTile({ icon, label, source, unit, digits = 0, tone = "default" }: {
  icon: ReactNode; label: string; source: Source<number | null>; unit?: string; digits?: number; tone?: "default" | "sky";
}) {
  const t = useT();
  const { locale } = useTranslation();
  const value = source.available && typeof source.value === "number" ? source.value : null;
  return (
    <div className={shared.kpiTile}>
      <div className={shared.kpiTopRow}>
        <div className={`${shared.kpiIconSquircle} ${tone === "sky" ? shared.kpiIconSky : ""}`}>{icon}</div>
      </div>
      <div className={shared.kpiValueRow}>
        {value === null ? (
          <span className={styles.unavailableValue} title={source.message}>{t(`${NS}.text_not_available`, "Not available")}</span>
        ) : (
          <span className={shared.kpiValue}>{formatNumber(value, locale, digits)}{unit && <small>{unit}</small>}</span>
        )}
      </div>
      <span className={shared.kpiLabel}>{label}</span>
      <span className={styles.origin}>{value === null ? source.message : source.origin}</span>
    </div>
  );
}

export function ChartCard({ title, subtitle, tools, span, source, children, minHeight = 260 }: {
  title: string; subtitle?: string; tools?: ReactNode; span: 4 | 5 | 6 | 7 | 8 | 12;
  source: Source<unknown>; children: ReactNode; minHeight?: number;
}) {
  const t = useT();
  const spanClass = ({ 4: shared.col4, 5: shared.col5, 6: shared.col6, 7: shared.col7, 8: shared.col8, 12: shared.col12 } as Record<number, string | undefined>)[span] ?? "";
  return (
    <section className={`${shared.widgetCard} ${spanClass}`} aria-label={title}>
      <div className={shared.cardTitleRow}>
        <div className={shared.cardTitleLeft}>
          <h3 className={shared.cardTitle}>{title}</h3>
          {subtitle && <span className={shared.cardSublabel}>{subtitle}</span>}
        </div>
        {tools && <div className={shared.cardTools}>{tools}</div>}
      </div>
      <div className={shared.cardBody} style={{ minHeight }}>
        {source.available ? children : (
          <div className={styles.unavailable} role="note">
            <AlertCircle size={18} aria-hidden="true" />
            <p>{source.message || t(`${NS}.text_feed_unavailable`, "This data is not available yet.")}</p>
          </div>
        )}
      </div>
      {source.available && source.origin && <p className={styles.cardOrigin}>{source.origin}</p>}
    </section>
  );
}

export function CockpitLoading({ label }: { label: string }) {
  return (
    <div className={styles.loading} role="status" aria-live="polite" aria-label={label}>
      {Array.from({ length: 4 }, (_, i) => <span key={`k${i}`} className={styles.skeletonKpi} />)}
      {Array.from({ length: 4 }, (_, i) => <span key={`c${i}`} className={styles.skeletonCard} />)}
    </div>
  );
}

export function CockpitError({ message, forbidden, onRetry }: { message: string; forbidden: boolean; onRetry: () => void }) {
  const t = useT();
  return (
    <div className={styles.errorBox} role="alert">
      <AlertCircle size={20} aria-hidden="true" />
      <div>
        <h3>{forbidden ? t(`${NS}.text_forbidden_title`, "You do not have access to this console") : t(`${NS}.text_error_title`, "This console could not be loaded")}</h3>
        <p>{message || t(`${NS}.text_error_body`, "Check your connection and try again.")}</p>
      </div>
      {!forbidden && (
        <button type="button" className={styles.retry} onClick={onRetry}><RefreshCcw size={16} aria-hidden="true" />{t(`${NS}.text_retry`, "Try again")}</button>
      )}
    </div>
  );
}

export function PartialNotice({ sources }: { sources: Array<{ name: string; message: string }> }) {
  const t = useT();
  if (sources.length === 0) return null;
  return (
    <p className={styles.partial} role="note">
      {t(`${NS}.text_partial`, "Some figures are not available: {names}.", { names: sources.map((s) => s.name).join(", ") })}
    </p>
  );
}
