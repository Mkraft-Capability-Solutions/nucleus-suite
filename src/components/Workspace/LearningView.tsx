"use client";

import { useRef, useState } from "react";
import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import WorkspacePremiumOutlined from "@mui/icons-material/WorkspacePremiumOutlined";
import { useHRMS } from "@/context/HRMSContext";
import { useTranslation } from "@/context/I18nContext";
import { launchAction } from "@/lib/action-launcher";
import { newIdempotencyKey, sendJson } from "@/lib/api-mutation";
import { useApiResource } from "./workspace-views/api";
import CourseCard, { NS } from "./learning-view/CourseCard";
import type { LearningItem, LearningQueue } from "./learning-view/types";
import styles from "./LearningView.module.css";

type Props = { onNavigate?: (tab: string, sub?: string, consoleId?: string) => void; onSelectConsole?: (id: string) => void };
type Toast = (title: string, message: string, type?: string) => void;

const PATH = "/api/v1/my-learning";

export default function LearningView({ onNavigate, onSelectConsole }: Props) {
  const { t } = useTranslation();
  const { showToast } = (useHRMS() ?? {}) as { showToast?: Toast };
  const { state, reload } = useApiResource<LearningQueue>(PATH);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const keys = useRef(new Map<string, string>());

  async function complete(item: LearningItem) {
    const key = keys.current.get(item.id) ?? newIdempotencyKey();
    keys.current.set(item.id, key);
    setPendingId(item.id);
    const result = await sendJson(`/api/v1/enrollments/${encodeURIComponent(item.id)}/complete`, { body: {}, idempotencyKey: key });
    setPendingId(null);
    if (result.ok) {
      keys.current.delete(item.id);
      showToast?.(t(`${NS}.complete_ok_title`, "Completion recorded"), item.courseTitle, "success");
      reload();
    } else {
      showToast?.(t(`${NS}.complete_fail_title`, "Could not record completion"), result.message ?? t(`${NS}.error_generic`, "Please try again."), "error");
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div className={styles.titleBlock}>
          <h2>{t(`${NS}.title`, "Learning & Development (L&D)")}</h2>
          <p>{t(`${NS}.subtitle`, "Your assigned courses, learning paths, completions and certifications.")}</p>
        </div>
        <div className={styles.actions}>
          {(onNavigate || onSelectConsole) && (
            <button
              type="button"
              className={styles.btnAccent}
              onClick={() => {
                onSelectConsole?.("S9");
                onNavigate?.("dashboard", "dashboard", "s9");
              }}
            >
              <AutoAwesomeOutlined sx={{ fontSize: 15 }} />
              {t(`${NS}.capability_console`, "Capability console")}
            </button>
          )}
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => showToast?.(t(`${NS}.marketplace_title`, "Content marketplace"), t(`${NS}.marketplace_unavailable`, "No external content provider is connected for this tenant."), "info")}
          >
            <OpenInNewOutlined sx={{ fontSize: 16 }} />
            {t(`${NS}.marketplace`, "Content marketplace")}
          </button>
          <button type="button" className={styles.btnPrimary} onClick={() => launchAction("learningPath")}>
            <AutoAwesomeOutlined sx={{ fontSize: 16 }} />
            {t(`${NS}.assign_path`, "Assign learning path")}
          </button>
        </div>
      </div>

      {state.status === "loading" && <p className={styles.muted} aria-live="polite">{t(`${NS}.loading`, "Loading learning queue…")}</p>}
      {state.status === "error" && (
        <div className={styles.card} role="alert">
          <p>{t(`${NS}.error`, "The learning queue could not be loaded.")}</p>
          <button type="button" className={styles.btnSecondary} onClick={reload}>{t(`${NS}.retry`, "Retry")}</button>
        </div>
      )}
      {state.status === "ready" && (
        <>
          {state.data.items.length === 0 ? (
            <p className={styles.muted}>{t(`${NS}.empty`, "No courses are assigned to you yet.")}</p>
          ) : (
            <div className={styles.courseGrid}>
              {state.data.items.map((item) => (
                <CourseCard key={item.id} item={item} pending={pendingId === item.id} onComplete={complete} />
              ))}
            </div>
          )}
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>
              <WorkspacePremiumOutlined sx={{ fontSize: 20 }} />
              {t(`${NS}.impact_title`, "L&D impact")}
            </h3>
            <p className={styles.muted}>
              {t(`${NS}.impact_summary`, "{done} of {total} assignments completed.", {
                done: state.data.states.filter((s) => s.key === "verified" || s.key === "certified").reduce((sum, s) => sum + s.count, 0),
                total: state.data.total,
              })}
            </p>
            <p className={styles.muted}>{t(`${NS}.roi_unavailable`, "Training ROI is not available: no outcome data is linked to course completions.")}</p>
          </div>
        </>
      )}
    </div>
  );
}
