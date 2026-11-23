"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquare, Sparkles, Sun } from "lucide-react";
import styles from "./ExperienceView.module.css";
import { useHRMS } from "@/context/HRMSContext";
import { failureMessage, readJson, useT, type ApiResult } from "./engagement-client";
import { EXP_NS, type CapabilityView, type FeedPost, type Loadable, type Recognition, type WellbeingView } from "./experience-model";
import ExperienceCapabilityTab from "./ExperienceCapabilityTab";
import ExperienceWellbeingTab from "./ExperienceWellbeingTab";
import ExperienceSocialTab from "./ExperienceSocialTab";

/** Employee experience: capability index, wellbeing and the social/recognition wall, all from the API. */

const NS = EXP_NS;
type Tab = "capability" | "wellbeing" | "social";
type Data = { capability: Loadable<CapabilityView>; wellbeing: Loadable<WellbeingView>; feed: Loadable<FeedPost[]>; recognitions: Loadable<Recognition[]> };
const LOADING: Data = { capability: { status: "loading" }, wellbeing: { status: "loading" }, feed: { status: "loading" }, recognitions: { status: "loading" } };

export default function ExperienceView() {
  const { t } = useT();
  const { showToast } = (useHRMS() ?? {}) as { showToast?: (title: string, message: string, tone: string) => void };
  const [tab, setTab] = useState<Tab>("capability");
  const [data, setData] = useState<Data>(LOADING);

  const fetchAll = useCallback(async (signal?: AbortSignal): Promise<Data> => {
    const fallback = t(`${NS}.text_load_failed`, "This section could not be loaded.");
    const wrap = <T,>(result: ApiResult<{ data: T }>): Loadable<T> =>
      result.ok ? { status: "ready", data: result.body.data } : { status: "error", message: failureMessage(result, t, fallback) };
    const [capability, wellbeing, feed, recognitions] = await Promise.all([
      readJson<{ data: CapabilityView }>("/api/v1/social-feed?view=capability-index", signal),
      readJson<{ data: WellbeingView }>("/api/v1/social-feed?view=wellbeing", signal),
      readJson<{ data: FeedPost[] }>("/api/v1/social-feed?pageSize=20", signal),
      readJson<{ data: Recognition[] }>("/api/v1/recognition-events?pageSize=20", signal),
    ]);
    return { capability: wrap(capability), wellbeing: wrap(wellbeing), feed: wrap(feed), recognitions: wrap(recognitions) };
  }, [t]);

  useEffect(() => {
    const controller = new AbortController();
    fetchAll(controller.signal).then(setData).catch(() => undefined);
    return () => controller.abort();
  }, [fetchAll]);

  const refresh = useCallback(async () => setData(await fetchAll()), [fetchAll]);
  const onToast = (title: string, message: string, tone: "success" | "error") => showToast?.(title, message, tone);

  const tabs: Array<{ id: Tab; icon: typeof Sun; label: string }> = [
    { id: "capability", icon: Sparkles, label: t(`${NS}.ExperienceView_text_4`, "Capability index") },
    { id: "wellbeing", icon: Sun, label: t(`${NS}.ExperienceView_text_5`, "Wellbeing") },
    { id: "social", icon: MessageSquare, label: t(`${NS}.ExperienceView_text_6`, "Social wall") },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h2>{t(`${NS}.ExperienceView_text_1`, "Employee experience")}</h2>
          <p>{t(`${NS}.ExperienceView_text_2`, "Growth, wellbeing and recognition in one place")}</p>
        </div>
      </div>
      <div className={styles.tabNav} role="tablist">
        {tabs.map(({ id, icon: Icon, label }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`${styles.tabBtn} ${tab === id ? styles.activeTab : ""}`} onClick={() => setTab(id)}>
            <Icon size={16} aria-hidden="true" />{label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === "capability" && <ExperienceCapabilityTab state={data.capability} />}
        {tab === "wellbeing" && <ExperienceWellbeingTab state={data.wellbeing} onChanged={refresh} onToast={onToast} />}
        {tab === "social" && <ExperienceSocialTab feed={data.feed} recognitions={data.recognitions} onChanged={refresh} onToast={onToast} />}
      </div>
    </div>
  );
}
