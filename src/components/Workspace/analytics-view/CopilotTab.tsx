"use client";

import { useState, type FormEvent } from "react";
import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import SendOutlined from "@mui/icons-material/SendOutlined";
import { useTranslation } from "@/context/I18nContext";
import { Badge, CardHeader, NS, Notice, useFormat } from "./AnalyticsParts";
import styles from "../AnalyticsView.module.css";

type Turn = { query: string; answer: string; sources: string[]; model: string; at: Date };
type ChatEnvelope = {
  data?: { attributes?: { answer?: string; data?: Array<{ tool?: string }>; model?: string } };
  error?: { message?: string };
};

const MAX_QUESTION = 2000;

/**
 * AI Copilot Studio: each question is a real turn on POST /api/v1/ai/nucleus/chat, which runs its data tools
 * under the caller's own permissions. Sources are the tools the answer was grounded on, as returned by the server.
 */
export default function CopilotTab() {
  const { t, locale } = useTranslation();
  const f = useFormat();
  const [query, setQuery] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooLong = query.trim().length > MAX_QUESTION;

  const ask = async (event: FormEvent) => {
    event.preventDefault();
    const message = query.trim();
    if (!message || tooLong || pending) return;
    setPending(true);
    setError(null);
    try {
      const history = turns.slice(0, 10).reverse().flatMap((turn) => [
        { role: "user" as const, text: turn.query },
        { role: "assistant" as const, text: turn.answer.slice(0, 4000) },
      ]);
      const response = await fetch("/api/v1/ai/nucleus/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, history, context: { activeTab: "analytics", activeDomain: "analytics_copilot", locale } }),
      });
      const body = (await response.json().catch(() => null)) as ChatEnvelope | null;
      const reply = body?.data?.attributes;
      if (!response.ok || !reply) {
        setError(body?.error?.message || t(`${NS}.error_ai_unavailable`, "Nucleus AI could not answer right now. Please try again."));
        return;
      }
      const sources = [...new Set((reply.data ?? []).map((block) => block.tool ?? "").filter(Boolean))];
      setTurns((prev) => [{ query: message, answer: reply.answer ?? "", sources, model: reply.model ?? "", at: new Date() }, ...prev]);
      setQuery("");
    } catch {
      setError(t(`${NS}.error_network`, "Could not reach the server. Please try again."));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={styles.panel}>
      <section className={styles.card}>
        <CardHeader icon={<AutoAwesomeOutlined sx={{ fontSize: 18, color: "var(--signal)" }} />}
          title={t(`${NS}.text_autonomous_reasoning_hr_agent_policy_gro`, "Autonomous Reasoning HR Agent & Policy Grounding")}
          badge={<Badge tone="signal">{t(`${NS}.text_runs_under_your_permissions`, "Live data · your permissions")}</Badge>} />

        <form onSubmit={ask} className={styles.askForm} noValidate>
          <label htmlFor="analytics-ai-question" className={styles.srOnly}>{t(`${NS}.label_ai_question`, "Question for Nucleus AI")}</label>
          <input id="analytics-ai-question" type="text" className={styles.input} value={query} maxLength={MAX_QUESTION + 1}
            aria-invalid={tooLong} aria-describedby={tooLong ? "analytics-ai-question-error" : undefined}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(`${NS}.placeholder_ask_any_enterprise_question_eg_summarize`, "Ask any enterprise question (e.g. 'Summarize engineering retention risks', 'Check 2026 wage bill impact')...")} />
          <button type="submit" disabled={pending || !query.trim() || tooLong} className={styles.btnPrimary}>
            <SendOutlined sx={{ fontSize: 16 }} />
            {pending ? t(`${NS}.text_reasoning`, "Reasoning...") : t(`${NS}.text_ask_ai`, "Ask AI")}
          </button>
        </form>
        {tooLong && <p id="analytics-ai-question-error" className={styles.fieldError}>{t(`${NS}.error_question_too_long`, "Enter a question of at most 2,000 characters.")}</p>}
        {error && <Notice error>{error}</Notice>}

        <div className={styles.list} aria-live="polite">
          {turns.length === 0 && !error && (
            <Notice>{t(`${NS}.text_ai_empty`, "Ask a question to get an answer grounded in your organisation's live records.")}</Notice>
          )}
          {turns.map((turn) => (
            <article key={turn.at.getTime()} className={styles.answer}>
              <div className={styles.answerQuestion}>{t(`${NS}.text_q`, "Q:")} {turn.query}</div>
              <div className={styles.answerText}>{turn.answer || t(`${NS}.text_ai_no_answer`, "Nucleus AI returned no answer text for this question.")}</div>
              <div className={styles.answerMeta}>
                <div className={styles.chips}>
                  {turn.sources.length === 0
                    ? <span className={styles.chip}>{t(`${NS}.text_no_data_sources`, "No live data was used")}</span>
                    : turn.sources.map((source) => <span key={source} className={styles.chip}>{source}</span>)}
                </div>
                <span>{t(`${NS}.text_model_time`, "Model: {model} · {time}", { model: turn.model || "—", time: f.time(turn.at) })}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
