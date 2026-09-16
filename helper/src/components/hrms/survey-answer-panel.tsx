"use client";

/* ------------------------------------------------------------------ */
/* Pulse survey — answering surface                                    */
/* GET  /api/v1/survey-runs        → listOpenSurveyRuns (employee.read)*/
/* POST /api/v1/survey-responses   → answerSurvey       (employee.read)*/
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, RefreshCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading, Surface } from "./page-primitives";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" && value !== "" ? value : fallback;
}

export type SurveyQuestion = { key: string; text: string; scale: number };

export type SurveyRun = {
  id: string;
  code: string;
  title: string;
  audience: string;
  questions: SurveyQuestion[];
};

/**
 * `answerSurveySchema` takes `answers` as a record of question key → integer 1..10 and
 * refuses an empty record. Nothing is sent until every question the run asks has been
 * answered, so a half-filled form is stopped here rather than written as a partial response.
 */
export function unansweredQuestions(run: SurveyRun, answers: Record<string, number>): SurveyQuestion[] {
  return run.questions.filter((question) => {
    const value = answers[question.key];
    return typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > question.scale;
  });
}

/** A run with no usable question cannot be answered; the panel says so instead of inventing one. */
export function isAnswerable(run: SurveyRun): boolean {
  return run.questions.length > 0;
}

/** The scale points a question offers, derived from the run — never a hard-coded 1-5. */
export function scalePoints(scale: number): number[] {
  const upper = Number.isFinite(scale) && scale >= 2 && scale <= 10 ? Math.trunc(scale) : 5;
  return Array.from({ length: upper }, (_, index) => index + 1);
}

function parseRuns(payload: unknown): SurveyRun[] {
  const items = asRecord(payload).data;
  return (Array.isArray(items) ? (items as UnknownRecord[]) : []).map((item) => {
    const attributes = asRecord(item.attributes);
    const questions = Array.isArray(attributes.questions) ? (attributes.questions as UnknownRecord[]) : [];
    return {
      id: str(item.id, str(attributes.id)),
      code: str(attributes.code),
      title: str(attributes.title, "Untitled survey"),
      audience: str(attributes.audience, "all"),
      questions: questions.flatMap((question) => {
        const key = str(question.key);
        const text = str(question.text);
        if (!key || !text) return [];
        const scale = Number(question.scale);
        return [{ key, text, scale: Number.isFinite(scale) ? Math.trunc(scale) : 5 }];
      }),
    };
  }).filter((run) => run.id !== "");
}

const selectClass =
  "h-10 w-full min-w-0 max-w-full rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground";

export function SurveyAnswerPanel(): React.ReactElement {
  const [runs, setRuns] = useState<SurveyRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [nonce, setNonce] = useState(0);
  const [activeRunId, setActiveRunId] = useState("");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [anonymous, setAnonymous] = useState(true);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitOk, setSubmitOk] = useState("");

  useEffect(() => {
    let live = true;
    void (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const response = await fetch("/api/v1/survey-runs", { cache: "no-store" });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const error = asRecord(asRecord(payload).error);
          throw new Error(str(error.message, `Open surveys could not be loaded (${String(response.status)}).`));
        }
        const parsed = parseRuns(payload);
        if (!live) return;
        setRuns(parsed);
        setActiveRunId((current) => (parsed.some((run) => run.id === current) ? current : (parsed[0]?.id ?? "")));
      } catch (err) {
        if (live) {
          setRuns([]);
          setLoadError(err instanceof Error ? err.message : "Open surveys could not be loaded.");
        }
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [nonce]);

  const activeRun = useMemo(() => runs.find((run) => run.id === activeRunId) ?? null, [runs, activeRunId]);

  /** Answers belong to one run; moving to another must not carry the previous run's keys. */
  const selectRun = useCallback((runId: string) => {
    setActiveRunId(runId);
    setAnswers({});
    setSubmitError("");
    setSubmitOk("");
  }, []);

  const submit = useCallback(() => {
    if (!activeRun) return;
    void (async () => {
      setSubmitError("");
      setSubmitOk("");
      const missing = unansweredQuestions(activeRun, answers);
      if (missing.length > 0) {
        setSubmitError(
          `Answer every question before sending: ${missing.map((question) => question.text).join("; ")}`,
        );
        return;
      }
      setBusy(true);
      try {
        const response = await fetch("/api/v1/survey-responses", {
          method: "POST",
          cache: "no-store",
          headers: { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() },
          body: JSON.stringify({ runId: activeRun.id, answers, anonymous }),
        });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const error = asRecord(asRecord(payload).error);
          // The server's refusal is shown as the server worded it.
          throw new Error(str(error.message, `The response was refused (${String(response.status)}).`));
        }
        setSubmitOk(
          anonymous
            ? "Response recorded without your employee id. It cannot be traced back to you."
            : "Response recorded against your employee record, as you chose.",
        );
        setAnswers({});
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "The response could not be recorded.");
      } finally {
        setBusy(false);
      }
    })();
  }, [activeRun, answers, anonymous]);

  return (
    <Surface>
      <SectionHeading
        title="Answer a pulse survey"
        description="Open survey runs for this tenant, with the questions they actually ask."
      />

      <p className="mt-3 flex items-start gap-2 rounded-xl border border-border bg-secondary/30 px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
        <span>
          <strong className="font-semibold text-foreground">Anonymous by default.</strong> Your answers are stored with no
          employee id attached, so nobody can tell which response is yours. Results are released only once at least five
          people have answered. Tick the box below if you would rather your name be attached.
        </span>
      </p>

      {loading ? (
        <p className="py-6 text-center text-xs text-muted-foreground">Loading open surveys…</p>
      ) : loadError ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center" role="alert">
          <p className="text-xs leading-relaxed text-destructive">{loadError}</p>
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-lg text-xs"
            onClick={() => setNonce((value) => value + 1)}
          >
            <RefreshCcw className="mr-1.5 size-3.5" /> Retry
          </Button>
        </div>
      ) : runs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <ClipboardList className="size-5 text-muted-foreground" aria-hidden="true" />
          <p className="text-xs font-semibold text-foreground">No survey is open right now</p>
          <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
            Nothing is waiting for your answer. When HR opens a pulse survey run, its questions appear here.
          </p>
        </div>
      ) : (
        <>
          {runs.length > 1 ? (
            <label className="mt-4 flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Survey</span>
              <select
                aria-label="Survey run"
                className={selectClass}
                value={activeRunId}
                onChange={(event) => selectRun(event.target.value)}
              >
                {runs.map((run) => (
                  <option key={run.id} value={run.id}>
                    {run.title}
                    {run.code ? ` · ${run.code}` : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {activeRun === null ? null : !isAnswerable(activeRun) ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">
              &ldquo;{activeRun.title}&rdquo; is open but carries no questions, so there is nothing to answer.
            </p>
          ) : (
            <>
              <p className="mt-4 text-xs font-semibold text-foreground">{activeRun.title}</p>
              <div className="mt-3 space-y-3">
                {activeRun.questions.map((question) => (
                  <label key={question.key} className="flex flex-col gap-1.5">
                    <span className="text-xs leading-relaxed text-foreground">{question.text}</span>
                    <select
                      aria-label={question.text}
                      className={selectClass}
                      value={answers[question.key] ?? ""}
                      onChange={(event) =>
                        setAnswers((current) => ({ ...current, [question.key]: Number(event.target.value) }))
                      }
                    >
                      <option value="">Not answered</option>
                      {scalePoints(question.scale).map((point) => (
                        <option key={point} value={point}>
                          {point} of {question.scale}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>

              <label className="mt-4 flex min-h-10 items-center gap-2.5 text-xs leading-relaxed text-muted-foreground">
                <input
                  type="checkbox"
                  className="size-4 shrink-0 rounded border-border"
                  checked={!anonymous}
                  onChange={(event) => setAnonymous(!event.target.checked)}
                />
                <span>Attach my employee record to this response instead of sending it anonymously.</span>
              </label>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button className="h-10 rounded-xl px-4 text-xs font-bold" disabled={busy} onClick={submit}>
                  {busy ? "Sending…" : anonymous ? "Send anonymously" : "Send with my name"}
                </Button>
              </div>
              <p role="alert" className="mt-3 text-xs leading-relaxed text-destructive empty:mt-0">
                {submitError}
              </p>
              <p role="status" className="mt-1 text-xs leading-relaxed text-success empty:mt-0">
                {submitOk}
              </p>
            </>
          )}
        </>
      )}
    </Surface>
  );
}
