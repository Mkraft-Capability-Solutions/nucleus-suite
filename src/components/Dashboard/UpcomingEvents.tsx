"use client";

import { useT } from "@/hooks/useT";
import styles from "./UpcomingEvents.module.css";

/** Upcoming meetings need a calendar connection; none exists, so the card states that instead of showing samples. */
const NS = "components.Dashboard.UpcomingEvents";

export default function UpcomingEvents() {
  const { t } = useT();
  return (
    <div className={`${styles.card} glass-card`}>
      <h3 className={styles.title}>{t(`${NS}.UpcomingEvents_text_1`, "Upcoming events")}</h3>
      <p className={styles.time} role="note">{t(`${NS}.text_unavailable`, "Events are not available: no calendar service is connected to this workspace.")}</p>
    </div>
  );
}
