"use client";

import { useState, type FormEvent } from "react";
import styles from "./ExperienceView.module.css";
import { failureMessage, formatDateTime, sendJson, useSubmitKey, useT } from "./engagement-client";
import { EXP_NS, type Loadable, type WellbeingView } from "./experience-model";

const NS = EXP_NS;
type Scores = { energy: number; stress: number; workload: number };
const DIMENSIONS: Array<keyof Scores> = ["energy", "stress", "workload"];

/**
 * Own wellbeing check-ins, the suppressed tenant aggregate, the recognition points balance (null when no
 * scheme is configured), and the purpose-alignment / Dhruva goal cards, which have no backing table and are
 * shown as unavailable rather than with invented content.
 */
export default function ExperienceWellbeingTab({ state, onChanged, onToast }: {
  state: Loadable<WellbeingView>;
  onChanged: () => Promise<void>;
  onToast: (title: string, message: string, tone: "success" | "error") => void;
}) {
  const { t, locale } = useT();
  const [scores, setScores] = useState<Scores>({ energy: 3, stress: 3, workload: 3 });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const { keyFor, reset } = useSubmitKey();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const payload = { ...scores, note: note.trim() || undefined };
    setBusy(true);
    const result = await sendJson("POST", "/api/v1/social-feed?view=wellbeing", payload, { idempotencyKey: keyFor(payload) });
    setBusy(false);
    if (!result.ok) return onToast(t(`${NS}.text_checkin_failed`, "Check-in not saved"), failureMessage(result, t, t(`${NS}.text_try_again`, "Try again.")), "error");
    reset();
    setNote("");
    onToast(t(`${NS}.text_checkin_saved`, "Check-in saved"), t(`${NS}.text_checkin_saved_body`, "Thanks for checking in."), "success");
    await onChanged();
  };

  if (state.status === "loading") return <p className={styles.card} aria-busy="true">{t(`${NS}.text_loading`, "Loading…")}</p>;
  if (state.status === "error") return <p className={styles.card} role="alert">{state.message}</p>;
  const { self, aggregate, points } = state.data;
  const label = (key: keyof Scores) => t(`${NS}.wellbeing_${key}`, { energy: "Energy", stress: "Stress", workload: "Workload" }[key]);

  return (
    <div className={styles.container}>
      <form className={styles.card} onSubmit={submit} aria-labelledby="wb-heading">
        <div className={styles.cardHeader}><h3 id="wb-heading">{t(`${NS}.text_checkin_title`, "Wellbeing check-in")}</h3></div>
        {DIMENSIONS.map((key) => (
          <label key={key} htmlFor={`wb-${key}`}>
            {label(key)} * ({scores[key]}/5)
            <input id={`wb-${key}`} type="range" min={1} max={5} step={1} value={scores[key]} onChange={(event) => setScores({ ...scores, [key]: Number(event.target.value) })} />
          </label>
        ))}
        <label htmlFor="wb-note">{t(`${NS}.text_note_optional`, "Note (optional)")}</label>
        <textarea id="wb-note" value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} />
        <button type="submit" className={styles.btnPrimary} disabled={busy}>{t(`${NS}.text_checkin_submit`, "Save check-in")}</button>
      </form>

      <div className={styles.dimensionGrid}>
        <div className={styles.dimCard}>
          <strong>{t(`${NS}.text_team_pulse`, "Team pulse")}</strong>
          {aggregate.suppressed || !aggregate.averages
            ? <div>{t(`${NS}.text_suppressed`, "Hidden until at least {threshold} people have checked in.", { threshold: aggregate.threshold })}</div>
            : DIMENSIONS.map((key) => <div key={key}>{label(key)}: {aggregate.averages?.[key] ?? "-"}</div>)}
        </div>
        <div className={styles.dimCard}>
          <strong>{t(`${NS}.text_points`, "Recognition points")}</strong>
          <div>{points.configured && points.balance !== null ? new Intl.NumberFormat(locale || undefined).format(points.balance) : t(`${NS}.text_points_unconfigured`, "No points scheme is configured.")}</div>
        </div>
        <div className={styles.dimCard}>
          <strong>{t(`${NS}.text_purpose`, "Purpose alignment")}</strong>
          <div>{t(`${NS}.text_unavailable`, "Not available yet: no data source holds this.")}</div>
        </div>
        <div className={styles.dimCard}>
          <strong>{t(`${NS}.text_dhruva`, "Dhruva goal")}</strong>
          <div>{t(`${NS}.text_unavailable`, "Not available yet: no data source holds this.")}</div>
        </div>
      </div>

      <section className={styles.card} aria-labelledby="wb-history">
        <h3 id="wb-history">{t(`${NS}.text_history`, "Your recent check-ins")}</h3>
        {!self || self.checkins.length === 0 ? <p>{t(`${NS}.text_no_checkins`, "You have not checked in yet.")}</p> : (
          <ul>
            {self.checkins.map((row) => (
              <li key={row.id}>{formatDateTime(row.recordedAt, locale)} · {DIMENSIONS.map((key) => `${label(key)} ${row[key] ?? "-"}`).join(" · ")}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
