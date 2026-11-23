"use client";

import PlayArrowOutlined from "@mui/icons-material/PlayArrowOutlined";
import { useTranslation } from "@/context/I18nContext";
import type { LearningItem } from "./types";
import styles from "../LearningView.module.css";

export const NS = "learningView";

type Props = { item: LearningItem; pending: boolean; onComplete: (item: LearningItem) => void };

export default function CourseCard({ item, pending, onComplete }: Props) {
  const { t, locale } = useTranslation();
  const pct = item.progress.tracked ? item.progress.percentComplete : null;
  return (
    <article className={styles.courseCard}>
      <div>
        <div className={styles.cardMeta}>
          <span className={styles.category}>{item.learningPathLabel}</span>
          <span className={styles.badge}>{item.stateLabel}</span>
        </div>
        <strong className={styles.courseTitle}>{item.courseTitle}</strong>
        {item.certification && (
          <div className={styles.muted}>{t(`${NS}.certification`, "Certification: {name}", { name: item.certification.name })}</div>
        )}
      </div>
      <div className={styles.cardFoot}>
        <div className={styles.progressRow}>
          <span>{t(`${NS}.progress`, "Progress")}</span>
          <span>{pct === null ? t(`${NS}.progress_untracked`, "Not tracked") : new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(pct / 100)}</span>
        </div>
        {pct !== null && (
          <div className={styles.progressBarTrack} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className={styles.progressBarFill} style={{ width: `${pct}%` }} />
          </div>
        )}
        <button
          type="button"
          className={styles.btnPrimary}
          disabled={!item.complete.allowed || pending}
          title={item.complete.reason ?? undefined}
          onClick={() => onComplete(item)}
        >
          <PlayArrowOutlined sx={{ fontSize: 14 }} />
          {item.complete.allowed ? t(`${NS}.mark_complete`, "Record completion") : t(`${NS}.completed`, "Completed")}
        </button>
      </div>
    </article>
  );
}
