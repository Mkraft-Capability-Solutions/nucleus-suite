"use client";

import { useEffect, useState } from "react";
import { Lightbulb, ChevronRight } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import styles from "./NucleusInsightCard.module.css";

/**
 * Nucleus AI insight beside the greeting (mockup `.insight`). The headline is the strongest live signal from the
 * `focus_areas` analysis, run under the viewer's own access; nothing here is written by hand. When no signal can be
 * measured the card says so instead of inventing one.
 */

type FocusItem = { area: string; observation: string; measure: number; records: number; origin: string };
type FocusGap = { area: string; reason: string };
type FocusResult = { items: FocusItem[]; gaps: FocusGap[] };
type State = { status: "loading" } | { status: "ready"; result: FocusResult } | { status: "error"; message: string };

export function NucleusInsightCard() {
  const { t } = useTranslation() as { t: (key: string, fallback: string) => string };
  const [state, setState] = useState<State>({ status: "loading" });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v1/ai/nucleus/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tool: "focus_areas", args: { months: 3 } }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as { data?: { result?: FocusResult }; error?: { message?: string } } | null;
        if (!response.ok || !payload?.data?.result) throw new Error(payload?.error?.message || "unavailable");
        setState({ status: "ready", result: payload.data.result });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: "error", message: error instanceof Error ? error.message : "unavailable" });
      });
    return () => controller.abort();
  }, []);

  if (dismissed) return null;
  const top = state.status === "ready" ? state.result.items[0] : undefined;
  const second = state.status === "ready" ? state.result.items[1] : undefined;
  const explore = () => window.dispatchEvent(new CustomEvent("nucleus:open_copilot"));

  return (
    <section className={styles.insight} aria-live="polite" aria-busy={state.status === "loading"}>
      <div className={styles.head}>
        <span className={styles.tagHot}>{t("components.Dashboard.NucleusInsightCard.text_kicker", "Nucleus AI insight")}</span>
        {top && <span className={styles.tag}>{top.area}</span>}
      </div>
      <span className={styles.ico} aria-hidden="true"><Lightbulb size={20} /></span>
      {state.status === "loading" && (
        <>
          <h3 className={styles.title}>{t("components.Dashboard.NucleusInsightCard.text_default_title", "Nucleus AI is scanning attendance, attrition, leave and payroll for the strongest signal.")}</h3>
          <p className={styles.sub}>{t("components.Dashboard.NucleusInsightCard.text_default_sub", "The top signal from your live data appears here in a moment. Open the assistant to ask about any of them.")}</p>
        </>
      )}
      {state.status === "error" && <p className={styles.sub}>{t("components.Dashboard.NucleusInsightCard.text_error", "Insights are unavailable for your role right now.")}</p>}
      {state.status === "ready" && !top && (
        <p className={styles.sub}>{t("components.Dashboard.NucleusInsightCard.text_none", "No signal stands out in the last three months.")}</p>
      )}
      {top && (
        <>
          <h3 className={styles.title}>{top.observation}.</h3>
          <p className={styles.sub}>{second ? `${second.observation}.` : top.origin}</p>
        </>
      )}
      <div className={styles.acts}>
        <button type="button" className={styles.primary} onClick={explore}>
          {t("components.Dashboard.NucleusInsightCard.text_explore", "Explore signal")}<ChevronRight size={16} />
        </button>
        <button type="button" className={styles.btn} onClick={() => setDismissed(true)}>
          {t("components.Dashboard.NucleusInsightCard.text_dismiss", "Dismiss")}
        </button>
      </div>
    </section>
  );
}

export default NucleusInsightCard;
