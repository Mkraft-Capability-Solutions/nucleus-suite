"use client";

import { useTranslation } from "@/context/I18nContext";
import type { LoadState } from "../workspace-views/api";
import styles from "../PerformanceView.module.css";

export const NS = "performanceView";

type Props<T> = { state: LoadState<T>; reload: () => void; empty: boolean; emptyText: string };

/** Loading, error and empty states shared by the performance sections. */
export function Status<T>({ state, reload, empty, emptyText }: Props<T>) {
  const { t } = useTranslation();
  if (state.status === "loading") return <p className={styles.muted} aria-live="polite">{t(`${NS}.loading`, "Loading…")}</p>;
  if (state.status === "error")
    return (
      <div role="alert">
        <p>{t(`${NS}.error`, "This data could not be loaded.")}</p>
        <button type="button" className={styles.btnSecondary} onClick={reload}>{t(`${NS}.retry`, "Retry")}</button>
      </div>
    );
  return empty ? <p className={styles.muted}>{emptyText}</p> : null;
}
