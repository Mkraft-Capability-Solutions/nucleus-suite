"use client";

import { useTranslation } from "@/context/I18nContext";
import { useApiResource } from "../workspace-views/api";
import type { OkrTree } from "./types";
import { NS, Status } from "./parts";
import styles from "../PerformanceView.module.css";

function pctOf(current: number, target: number): number | null {
  return target > 0 ? Math.max(0, Math.min(100, (current / target) * 100)) : null;
}

export default function OkrSection() {
  const { t, locale } = useTranslation();
  const percent = (value: number) => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(value / 100);
  const { state, reload } = useApiResource<OkrTree>("/api/v1/okr-tree");
  const fmt = (pct: number | null) =>
    pct === null ? t(`${NS}.not_determined`, "Not determined") : percent(pct);

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <h3>{t(`${NS}.okr_title`, "Cascading OKRs")}</h3>
      </div>
      <Status state={state} reload={reload} empty={state.status === "ready" && state.data.nodes.length === 0} emptyText={t(`${NS}.okr_empty`, "No objectives have been set yet.")} />
      {state.status === "ready" &&
        state.data.nodes.map((node) => (
          <div key={node.id} className={styles.okrItem} style={{ marginInlineStart: `${node.depth * 1.25}rem` }}>
            <div className={styles.okrHead}>
              <strong>{node.title}</strong>
              <div className={styles.okrScore}>
                <div className={styles.okrPct}>{fmt(node.derivedProgressPct)}</div>
                <span className={styles.muted}>
                  {node.weightPct === null
                    ? t(`${NS}.weight_none`, "No declared weight")
                    : t(`${NS}.weight`, "Weight {value}", { value: percent(node.weightPct) })}
                </span>
              </div>
            </div>
            {state.data.keyResults
              .filter((kr) => kr.objectiveId === node.id)
              .map((kr) => {
                const pct = pctOf(kr.current, kr.target);
                return (
                  <div key={kr.id} className={styles.krRow}>
                    <span className={styles.krLabel}>{kr.title}</span>
                    <div className={styles.progressTrack}>
                      <div className={styles.progressBar} style={{ width: `${pct ?? 0}%` }} />
                    </div>
                    <strong className={styles.krPct}>{fmt(pct)}</strong>
                  </div>
                );
              })}
          </div>
        ))}
    </section>
  );
}
