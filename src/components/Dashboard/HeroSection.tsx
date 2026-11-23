"use client";

import { useEffect, useState } from "react";
import { Camera, Cloud, Mic } from "lucide-react";
import { useT } from "@/hooks/useT";
import { useOwnProfile } from "@/hooks/useOwnProfile";
import { launchAction } from "@/lib/action-launcher";
import styles from "./HeroSection.module.css";

/**
 * Greeting hero: name and location from the own-profile API, a live clock via Intl, a default insight line
 * (no fabricated statistic). Weather has no data source, so it says so. Camera opens the real photo action.
 */
const NS = "components.Dashboard.HeroSection";

export default function HeroSection() {
  const { t, locale } = useT();
  const { state } = useOwnProfile();
  const me = state.status === "ready" ? state.data : null;
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 30_000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, []);
  const hour = now?.getHours() ?? 12;
  const greeting = hour < 12 ? t(`${NS}.text_morning`, "Good morning, {name}", { name: me?.firstName || "" }) : hour < 17 ? t(`${NS}.text_afternoon`, "Good afternoon, {name}", { name: me?.firstName || "" }) : t(`${NS}.text_evening`, "Good evening, {name}", { name: me?.firstName || "" });

  return (
    <section className={styles.hero}>
      <div className={styles.content}>
        <div className={styles.greetingGroup}>
          <div className={styles.avatarWrapper}>
            <button type="button" className={styles.cameraBtn} aria-label={t(`${NS}.text_change_photo`, "Change profile photo")} onClick={() => launchAction("photo")}><Camera size={16} aria-hidden="true" /></button>
          </div>
          <div className={styles.greetingText}>
            <h1>{state.status === "loading" ? t(`${NS}.text_loading`, "Loading…") : greeting}</h1>
            <p>{t(`${NS}.HeroSection_text_3`, "Ready to make today productive?")}</p>
            <div className={`${styles.aiInsight} glass-card`}>
              <p>{t(`${NS}.text_insight_default`, "Nucleus AI will surface insights here as your workspace signals arrive.")}</p>
            </div>
          </div>
        </div>
        <div className={styles.infoGroup}>
          <div className={`${styles.dateCard} glass-card`}>
            <h2>{now ? new Intl.DateTimeFormat(locale, { weekday: "long" }).format(now) : ""}</h2>
            <p>{now ? new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(now) : ""}</p>
            <div className={styles.timeLocation}>
              <span>{now ? new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(now) : ""}</span>
              {me?.location && <><span className={styles.separator} aria-hidden="true">•</span><span>{me.location}</span></>}
            </div>
            <div className={styles.weather}><Cloud size={20} aria-hidden="true" /><span>{t(`${NS}.text_weather_unavailable`, "Weather is not available: no weather service is connected.")}</span></div>
          </div>
        </div>
      </div>
      <button type="button" className={styles.voiceBtn} aria-label={t(`${NS}.text_voice`, "Open voice assistant")} onClick={() => window.dispatchEvent(new CustomEvent("nucleus:open_copilot"))}><Mic size={32} aria-hidden="true" /></button>
    </section>
  );
}
