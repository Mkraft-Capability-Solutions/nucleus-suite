"use client";

import { Fragment, useCallback, useEffect, useId, useState } from "react";
import { useHRMS } from "@/context/HRMSContext";
import type { Source } from "@/lib/cockpits/source-types";
import { ChartCard, useT } from "../cockpit/CockpitParts";
import shared from "../DashboardShared.module.css";
import styles from "./HROpsConsole.module.css";

/**
 * "Approvals waiting on you" for the HR Operations Console. The queue is read from GET /api/v1/workspace/approvals
 * (items the caller may decide, never their own); a decision is POSTed with an Idempotency-Key (reused when the same
 * decision is retried) and If-Match on the item's version. A row leaves the list only after the server accepts it.
 */

const NS = "components.Dashboard.Views.HROpsConsole";
const ENDPOINT = "/api/v1/workspace/approvals";
const MIN_REASON = 3;

type QueueItem = { id: string; version: number; resource: string; title: string; status: string; feature: string; actions: string[] };
type QueueState = { status: "loading" } | { status: "ready"; items: QueueItem[] } | { status: "error"; message: string };
type Draft = { itemId: string; action: string; reason: string; key: string; keyFor: string; submitting: boolean; error: string | null };
type ErrorEnvelope = { error?: { message?: string } };

const POSITIVE = new Set(["approve", "resolve", "assign", "activate", "publish", "finalize", "reimburse", "complete", "allocate", "restore"]);
const NEGATIVE = new Set(["reject", "retire", "withdraw"]);

/** English fallback for an action key the locale file does not name ("awaitEmployee" → "Await employee"). */
function humanise(key: string): string {
  const spaced = key.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function asQueueItems(value: unknown): QueueItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw: unknown) => {
    if (typeof raw !== "object" || raw === null) return [];
    const row = raw as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.resource !== "string") return [];
    return [{
      id: row.id,
      version: Number(row.version) || 1,
      resource: row.resource,
      title: typeof row.title === "string" ? row.title : row.id,
      status: typeof row.status === "string" ? row.status : "",
      feature: typeof row.feature === "string" ? row.feature : row.resource,
      actions: Array.isArray(row.actions) ? row.actions.filter((a): a is string => typeof a === "string") : [],
    }];
  });
}

function useApprovalQueue(): { state: QueueState; remove: (id: string) => void; reload: () => void } {
  const [state, setState] = useState<QueueState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(ENDPOINT, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as ({ data?: unknown } & ErrorEnvelope) | null;
        if (!response.ok || !body) {
          setState({ status: "error", message: body?.error?.message ?? "" });
          return;
        }
        setState({ status: "ready", items: asQueueItems(body.data) });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: "error", message: "" });
      });
    return () => controller.abort();
  }, [attempt]);
  const remove = useCallback((id: string) => {
    setState((current) => (current.status === "ready" ? { status: "ready", items: current.items.filter((item) => item.id !== id) } : current));
  }, []);
  const reload = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);
  return { state, remove, reload };
}

export default function HROpsApprovalQueue({ span }: { span: 4 | 5 | 6 | 7 | 8 | 12 }) {
  const t = useT();
  const { showToast } = useHRMS() as { showToast?: (title: string, message: string, type?: string) => void };
  const { state, remove, reload } = useApprovalQueue();
  const [draft, setDraft] = useState<Draft | null>(null);
  const reasonId = useId();

  const actionLabel = (action: string) => t(`${NS}.text_action_${action}`, humanise(action));

  const open = (item: QueueItem, action: string) => {
    setDraft((current) => (current && current.itemId === item.id && current.action === action
      ? current
      : { itemId: item.id, action, reason: "", key: crypto.randomUUID(), keyFor: "", submitting: false, error: null }));
  };

  const submit = async (item: QueueItem, current: Draft) => {
    const reason = current.reason.trim();
    if (reason.length < MIN_REASON) {
      setDraft({ ...current, error: t(`${NS}.text_reason_required`, "Give a reason of at least {min} characters.", { min: MIN_REASON }) });
      return;
    }
    // The same decision and reason reuse the key, so a retry after a network failure cannot decide twice.
    const signature = `${current.action}\n${reason}`;
    const key = current.keyFor === "" || current.keyFor === signature ? current.key : crypto.randomUUID();
    setDraft({ ...current, key, keyFor: signature, submitting: true, error: null });
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key, "If-Match": String(item.version) },
        body: JSON.stringify({ resource: item.resource, id: item.id, decision: current.action, reason }),
      });
      const body = (await response.json().catch(() => null)) as ErrorEnvelope | null;
      if (!response.ok) {
        setDraft((d) => (d && d.itemId === item.id ? { ...d, submitting: false, error: body?.error?.message || t(`${NS}.text_decision_failed`, "The decision could not be recorded.") } : d));
        return;
      }
      remove(item.id);
      setDraft(null);
      showToast?.(t(`${NS}.text_decision_recorded`, "Decision recorded"), t(`${NS}.text_decision_recorded_body`, "{action}: {title}", { action: actionLabel(current.action), title: item.title }), "success");
    } catch {
      setDraft((d) => (d && d.itemId === item.id ? { ...d, submitting: false, error: t(`${NS}.text_decision_network`, "The server could not be reached. Try again; the same request will not be applied twice.") } : d));
    }
  };

  const feed: Source<null> = state.status === "error"
    ? { value: null, available: false, message: state.message || t(`${NS}.text_queue_error`, "Your approval queue could not be loaded.") }
    : { value: null, available: true };
  const count = state.status === "ready" ? state.items.length : 0;

  return (
    <ChartCard
      span={span}
      title={t(`${NS}.text_card_approvals`, "Approvals waiting on you")}
      subtitle={state.status === "ready" ? t(`${NS}.text_card_approvals_sub`, "{count, plural, one {# item} other {# items}} you may decide", { count }) : undefined}
      tools={state.status === "error" ? <button type="button" className={styles.actionBtn} onClick={reload}>{t(`${NS}.text_retry`, "Try again")}</button> : undefined}
      source={feed}
    >
      {state.status === "loading" && <div className={styles.empty} role="status">{t(`${NS}.text_queue_loading`, "Loading your approval queue…")}</div>}
      {state.status === "ready" && state.items.length === 0 && <div className={styles.empty}>{t(`${NS}.text_queue_empty`, "Nothing is waiting on you.")}</div>}
      {state.status === "ready" && state.items.length > 0 && (
        <div className={styles.scroll}>
          <table className={shared.dataTable}>
            <tbody>
              {state.items.map((item) => {
                const active = draft?.itemId === item.id ? draft : null;
                return (
                  <Fragment key={item.id}>
                    <tr>
                      <td>
                        <div className={styles.primaryText}>{item.title}</div>
                        <div className={styles.secondaryText}>{item.feature}</div>
                      </td>
                      <td className={styles.endCell}>
                        <div className={styles.actions}>
                          <span className={`${shared.pillBadge} ${shared.pillSlate}`}>{t(`${NS}.text_status_${item.status}`, humanise(item.status))}</span>
                          {item.actions.length === 0 && <span className={styles.secondaryText}>{t(`${NS}.text_no_actions`, "No decision available")}</span>}
                          {item.actions.map((action) => (
                            <button
                              key={action}
                              type="button"
                              className={`${styles.actionBtn} ${POSITIVE.has(action) ? styles.actionPositive : NEGATIVE.has(action) ? styles.actionNegative : ""} ${active?.action === action ? styles.actionActive : ""}`}
                              aria-pressed={active?.action === action}
                              disabled={active?.submitting === true}
                              onClick={() => open(item, action)}
                            >
                              {actionLabel(action)}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                    {active && (
                      <tr className={styles.decisionRow}>
                        <td colSpan={2}>
                          <form className={styles.decision} onSubmit={(event) => { event.preventDefault(); void submit(item, active); }}>
                            <label className={styles.decisionLabel} htmlFor={`${reasonId}-${item.id}`}>
                              {t(`${NS}.text_reason_label`, "Reason for “{action}” *", { action: actionLabel(active.action) })}
                            </label>
                            <div className={styles.decisionControls}>
                              <input
                                id={`${reasonId}-${item.id}`}
                                className={styles.reasonInput}
                                value={active.reason}
                                minLength={MIN_REASON}
                                maxLength={1000}
                                required
                                aria-required="true"
                                aria-invalid={active.error !== null}
                                aria-describedby={active.error ? `${reasonId}-${item.id}-error` : undefined}
                                disabled={active.submitting}
                                onChange={(event) => { const reason = event.target.value; setDraft((d) => (d ? { ...d, reason, error: null } : d)); }}
                                autoFocus
                              />
                              <button type="submit" className={styles.confirmBtn} disabled={active.submitting || active.reason.trim().length < MIN_REASON}>
                                {active.submitting ? t(`${NS}.text_submitting`, "Recording…") : t(`${NS}.text_confirm`, "Confirm")}
                              </button>
                              <button type="button" className={styles.actionBtn} disabled={active.submitting} onClick={() => setDraft(null)}>
                                {t(`${NS}.text_cancel`, "Cancel")}
                              </button>
                            </div>
                            {active.error && <p id={`${reasonId}-${item.id}-error`} className={styles.decisionError} role="alert">{active.error}</p>}
                          </form>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </ChartCard>
  );
}
