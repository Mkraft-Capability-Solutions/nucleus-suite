"use client";

import { useTranslation } from "@/context/I18nContext";
import { useApiResource } from "../workspace-views/api";
import type { NineBoxGrid } from "./types";
import { NS, Status } from "./parts";
import styles from "../PerformanceView.module.css";

const ROWS = ["high", "medium", "low"] as const;
const COLS = ["low", "medium", "high"] as const;

export default function NineBoxSection() {
  const { t, locale } = useTranslation();
  const { state, reload } = useApiResource<NineBoxGrid>("/api/v1/talent-placements");
  const band = (b: string) => t(`${NS}.band_${b}`, b);

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <h3>{t(`${NS}.ninebox_title`, "9-box calibration")}</h3>
        <span className={styles.muted}>{t(`${NS}.ninebox_axes`, "Performance (across) by potential (down)")}</span>
      </div>
      <Status state={state} reload={reload} empty={false} emptyText="" />
      {state.status === "ready" && (
        <>
          <div className={styles.nineBoxGrid}>
            {ROWS.flatMap((potential) =>
              COLS.map((performance) => {
                const cell = state.data.cells.find(
                  (c) => c.potential.toLowerCase() === potential && c.performance.toLowerCase() === performance,
                );
                const count = cell?.employeeIds.length ?? 0;
                return (
                  <div key={`${potential}-${performance}`} className={styles.nineBoxCell}>
                    <span className={styles.cellTitle}>
                      {t(`${NS}.cell`, "{performance} performance · {potential} potential", { performance: band(performance), potential: band(potential) })}
                    </span>
                    <div className={styles.cellTalent}>
                      <span className={styles.talentChip}>{count === 0 ? t(`${NS}.cell_empty`, "No one placed") : t(`${NS}.cell_count`, "Employees: {count}", { count: new Intl.NumberFormat(locale).format(count) })}</span>
                    </div>
                  </div>
                );
              }),
            )}
          </div>
          {!state.data.bandingConfigured && <p className={styles.muted}>{t(`${NS}.banding_unconfigured`, "Rating bands are not configured for this tenant, so placements cannot be derived.")}</p>}
        </>
      )}
    </section>
  );
}
