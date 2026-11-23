"use client";

import { useEffect, useState } from "react";
import styles from "./LiveClock.module.css";

/** The real current time and date for the greeting card, formatted for the page language. Ticks every 15 s. */
export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 15_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);
  if (!now) return <div className={styles.clock} aria-hidden="true" />;
  const locale = document.documentElement.lang || undefined;
  return (
    <div className={styles.clock}>
      <time className={styles.time} dateTime={now.toISOString()}>
        {new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(now)}
      </time>
      <span className={styles.date}>{new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now)}</span>
    </div>
  );
}

export default LiveClock;
