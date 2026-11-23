"use client";

import { useState, type FormEvent } from "react";
import type { ReviewItem } from "@/lib/cockpits/nucleus-intelligence-types";
import { useT } from "../cockpit/CockpitParts";
import shared from "../DashboardShared.module.css";
import styles from "./NucleusIntelligence.module.css";
import { NS, humanise, toneBadge, useStamp } from "./nucleus-intelligence-format";

/**
 * Human-review queue for the AI governance console. A pending review is decided through
 * POST /api/v1/ai/reviews/{id}/decide (decision + required reason); the row changes only after the server accepts.
 */

/** Mirrors decideReviewSchema on the server: comment is trimmed, 1–1000 characters. */
const COMMENT_MAX = 1000;

type ErrorEnvelope = { error?: { message?: string } };

function newKey(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function DecisionForm({ item, decisions, onDecided }: {
  item: ReviewItem; decisions: readonly string[]; onDecided: (decision: string, comment: string) => void;
}) {
  const t = useT();
  const [decision, setDecision] = useState(decisions[0] ?? "accepted");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  /** One key per logical submit: reused when the same decision is retried, renewed when the input changes. */
  const [idempotencyKey, setIdempotencyKey] = useState(newKey);
  const trimmed = comment.trim();
  const errorId = `ni-review-error-${item.id}`;

  const changeInput = (apply: () => void) => {
    apply();
    setIdempotencyKey(newKey());
    setError("");
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || trimmed.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(item.decideEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ decision, comment: trimmed }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ErrorEnvelope | null;
        setError(body?.error?.message || t(`${NS}.text_decide_failed`, "The decision could not be recorded."));
        return;
      }
      onDecided(decision, trimmed);
    } catch {
      setError(t(`${NS}.text_decide_offline`, "The decision could not be sent. Check the connection and try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.decisionForm} onSubmit={submit} noValidate>
      <label className={styles.srOnly} htmlFor={`ni-decision-${item.id}`}>{t(`${NS}.text_decision_label`, "Decision for this review")}</label>
      <select
        id={`ni-decision-${item.id}`}
        className={styles.field}
        value={decision}
        disabled={busy}
        onChange={(event) => changeInput(() => setDecision(event.target.value))}
      >
        {decisions.map((option) => (
          <option key={option} value={option}>{t(`${NS}.decision_${option}`, humanise(option))}</option>
        ))}
      </select>
      <label className={styles.srOnly} htmlFor={`ni-comment-${item.id}`}>{t(`${NS}.text_reason_label`, "Reason for this decision (required)")}</label>
      <input
        id={`ni-comment-${item.id}`}
        className={`${styles.field} ${styles.fieldGrow}`}
        value={comment}
        maxLength={COMMENT_MAX}
        required
        aria-required="true"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        disabled={busy}
        placeholder={t(`${NS}.text_reason_placeholder`, "Reason (required)")}
        onChange={(event) => changeInput(() => setComment(event.target.value))}
      />
      <button type="submit" className={shared.primaryBtn} disabled={busy || trimmed.length === 0}>
        {busy ? t(`${NS}.text_recording`, "Recording…") : t(`${NS}.text_record_decision`, "Record decision")}
      </button>
      {error && <p id={errorId} role="alert" className={styles.formError}>{error}</p>}
    </form>
  );
}

export default function ReviewQueue({ items, decisions, canDecide, canDecideNote }: {
  items: ReviewItem[]; decisions: readonly string[]; canDecide: boolean; canDecideNote: string;
}) {
  const t = useT();
  const stamp = useStamp();
  /** Decisions the server has accepted in this session, applied over the loaded rows. */
  const [decided, setDecided] = useState<Record<string, Pick<ReviewItem, "decision" | "comment" | "decidedAt">>>({});
  const [announcement, setAnnouncement] = useState("");

  const rows = items.map((item) => {
    const local = decided[item.id];
    return local ? { ...item, ...local, status: "decided", decidable: false, tone: "neutral" as const } : item;
  });

  if (rows.length === 0) {
    return <p className={styles.empty}>{t(`${NS}.text_reviews_empty`, "No AI run has been sent for human review in this tenant.")}</p>;
  }

  return (
    <>
      <p className={styles.srOnly} role="status" aria-live="polite">{announcement}</p>
      <ul className={styles.list}>
        {rows.slice(0, 10).map((item) => (
          <li key={item.id} className={styles.listItem}>
            <div className={styles.rowMeta}>
              <span className={`${shared.badge} ${toneBadge(item.tone)}`}>
                {item.decision ? t(`${NS}.decision_${item.decision}`, humanise(item.decision)) : humanise(item.status)}
              </span>
              <span className={styles.mono}>{item.runId ? t(`${NS}.text_run_ref`, "run {id}…", { id: item.runId.slice(0, 8) }) : t(`${NS}.text_no_run`, "No run linked")}</span>
              <span className={styles.mono}>{stamp(item.requestedAt)}</span>
            </div>
            <p className={styles.rowText}>{item.summary}</p>
            {item.comment && (
              <p className={styles.rowNote}>{t(`${NS}.text_decision_note`, "Decision note: {comment} · {when}", { comment: item.comment, when: stamp(item.decidedAt) })}</p>
            )}
            {item.decidable && canDecide && (
              <DecisionForm
                item={item}
                decisions={decisions}
                onDecided={(decision, comment) => {
                  setDecided((current) => ({ ...current, [item.id]: { decision, comment, decidedAt: new Date().toISOString() } }));
                  setAnnouncement(t(`${NS}.text_decision_recorded`, "Decision recorded."));
                }}
              />
            )}
            {!item.decidable && (
              <p className={styles.rowNote}>{t(`${NS}.text_already_decided`, "Already decided. The decision endpoint rejects a second decision on the same request.")}</p>
            )}
          </li>
        ))}
      </ul>
      {!canDecide && <p className={styles.note} role="note">{canDecideNote}</p>}
    </>
  );
}
