'use client';

/**
 * "Your always-on HR copilot" (pinned). Three scroll steps select the three scenarios in sequence (review checker,
 * pulse themes, weekly digest; a sliding indicator follows the tab). Within a scenario's scroll window the visitor's
 * message types itself out (the review draft after it), a short "thinking" beat follows, then the copilot's answer
 * rows stagger in: all scroll-scrubbed, so scrolling up plays it backwards. Once the review draft has played, it becomes
 * an editable field and the reading updates live ("Try it right here"). Tabs and arrow keys scroll to a scenario.
 * Un-pinned (narrow or short viewports) each scenario shows its finished conversation.
 */
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ShieldCheck, Sparkles } from 'lucide-react';
import type { TagRenderer } from '../i18n/landing-text';
import { useLandingText } from '../i18n/use-landing-text';
import { clamp, easeOut } from '../motion/scroll-engine';
import { useSectionMotion } from '../motion/use-section-motion';
import { PulseAnswer, ReviewReading, WeeklyAnswer } from '../ai-copilot/copilot-results';
import { buildReviewRules, checkReview } from '../ai-copilot/review-rules';
import { handleTabKeys } from '../section-kit/roving-tabs';
import { SectionHeader } from '../section-kit/section-header';
import { usePinnedSteps } from '../section-kit/use-pinned-steps';
import { useSlidingIndicator } from '../section-kit/use-sliding-indicator';

const SCENARIOS = ['review', 'pulse', 'digest'] as const;
type Phase = 'typing' | 'thinking' | 'answer';
const TRIES = ['vague', 'loaded', 'strong'] as const;
const BOLD: Readonly<Record<string, TagRenderer>> = { b: (children, key) => <b key={key}>{children}</b> };

/** Share of a scenario's scroll window: the prompt types over the first 30% (15% when a draft follows, which types
 * until 40%), a short "thinking" beat, then the answer rows stagger in. */
const PROMPT_ONLY = 0.3;
const PROMPT_WITH_DRAFT = 0.15;
const DRAFT_END = 0.4;
const THINK = 0.08;
const ROW_STEP = 0.04;
const ROW_WINDOW = 0.15;

function typedEnd(hasDraft: boolean): number {
  return hasDraft ? DRAFT_END : PROMPT_ONLY;
}

function writeText(element: HTMLElement | null, text: string): void {
  if (element && element.textContent !== text) element.textContent = text;
}

export function AiCopilotSection(): ReactNode {
  const t = useLandingText();
  const sectionRef = useRef<HTMLElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLSpanElement>(null);
  const draftRef = useRef<HTMLSpanElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<Phase>('typing');
  const localRef = useRef({ local: 0, answerAt: 1 });
  const [phase, setPhase] = useState<Phase>('typing');
  const [draft, setDraft] = useState<string | null>(null);
  useSectionMotion(sectionRef);

  const startDraft = t('ai.review.start');
  const text = draft ?? startDraft;
  const rules = useMemo(() => buildReviewRules(t), [t]);
  const result = useMemo(() => checkReview(text, rules), [text, rules]);

  /** Answer rows: opacity 0 → 1 and 10 px rise, 0.04 of the window apart (scroll-scrubbed, reversible). */
  const applyRows = (): void => {
    const { local, answerAt } = localRef.current;
    const rows = answerRef.current?.querySelectorAll<HTMLElement>('[data-result-item]') ?? [];
    for (const [index, row] of [...rows].entries()) {
      const p = easeOut(clamp((local - answerAt - ROW_STEP * Math.min(index, 8)) / ROW_WINDOW));
      if (p >= 1) {
        row.style.removeProperty('opacity');
        row.style.removeProperty('transform');
        continue;
      }
      row.style.opacity = p.toFixed(3);
      row.style.transform = `translateY(${(10 * (1 - p)).toFixed(2)}px)`;
    }
  };

  // Scroll-scrubbed playback: the position inside the scenario's scroll window decides how much of the message is
  // typed, the thinking beat and the answer rows, so scrolling back up plays it in reverse. Un-pinned: final state.
  const { step, goTo } = usePinnedSteps(sectionRef, SCENARIOS.length, ({ local, step: current }) => {
    const scenario = SCENARIOS[current] ?? 'review';
    const prompt = t(`ai.prompts.${scenario}`);
    const draftText = scenario === 'review' ? text : '';
    const promptShare = draftText ? PROMPT_WITH_DRAFT : PROMPT_ONLY;
    const end = typedEnd(draftText !== '');
    writeText(promptRef.current, prompt.slice(0, Math.round(prompt.length * clamp(local / promptShare))));
    writeText(draftRef.current, draftText.slice(0, Math.round(draftText.length * clamp((local - promptShare) / (end - promptShare)))));
    const next: Phase = local >= end + THINK ? 'answer' : local >= end ? 'thinking' : 'typing';
    localRef.current = { local, answerAt: end + THINK };
    if (next !== phaseRef.current) {
      phaseRef.current = next;
      setPhase(next);
    }
    applyRows();
  });
  // Rows that just mounted get their scroll state before the first paint.
  useLayoutEffect(() => {
    applyRows();
  });
  useSlidingIndicator(tabsRef, step);
  const scenario = SCENARIOS[step] ?? 'review';
  const answered = phase === 'answer';

  return (
    <section ref={sectionRef} className="lp-section ai lp-pin lp-pin-ai lp-motion-root" id="ai" aria-labelledby="ai-title">
      <div className="lp-pin-stage" data-pin-stage="">
        <div className="lp-glow" data-parallax-glow="0.35" aria-hidden="true" />
        <div className="lp-wrap">
          <div className="lp-grid">
            <SectionHeader kicker={t('ai.pill')} title={t('ai.title')} titleId="ai-title" lead={t('ai.lead')} className="head head-split" />
            <div className="sandbox lp-lift" data-reveal-item="">
              <div className="sb-bar">
                <div className="l" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <span>{t('ai.windowTitle')}</span>
                </div>
                <div
                  ref={tabsRef}
                  className="sb-tabs"
                  role="tablist"
                  aria-label={t('ai.tabsLabel')}
                  onKeyDown={(event) => {
                    handleTabKeys(event, step, SCENARIOS.length, goTo);
                  }}
                >
                  <span className="lp-indicator" data-indicator="" aria-hidden="true" />
                  {SCENARIOS.map((id, index) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      id={`ai-tab-${id}`}
                      aria-selected={index === step}
                      aria-controls="ai-panel"
                      tabIndex={index === step ? 0 : -1}
                      onClick={() => {
                        goTo(index);
                      }}
                    >
                      {t(`ai.tabs.${id}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="ai-chat" id="ai-panel" role="tabpanel" aria-labelledby={`ai-tab-${scenario}`} data-phase={phase} key={scenario}>
                <div className="ai-msg ai-msg-user">
                  <small>{t('ai.you')}</small>
                  <p>
                    <span className="visually-hidden">{t(`ai.prompts.${scenario}`)}</span>
                    <span ref={promptRef} aria-hidden="true" />
                    {phase === 'typing' ? <span className="ai-caret" aria-hidden="true" /> : null}
                  </p>
                  {scenario === 'review' ? (
                    answered ? (
                      <div className="ai-draft">
                        <em className="ai-live">{t('ai.review.live')}</em>
                        <label className="visually-hidden" htmlFor="ai-review-draft">
                          {t('ai.review.label')}
                        </label>
                        <textarea id="ai-review-draft" spellCheck={false} value={text} onChange={(event) => {
                          setDraft(event.target.value);
                        }} />
                        <div className="tries">
                          <span>{t('ai.review.tryAnother')}</span>
                          {TRIES.map((id) => (
                            <button key={id} type="button" onClick={() => {
                              setDraft(t(`ai.review.tries.${id}.text`));
                            }}>
                              {t(`ai.review.tries.${id}.label`)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <blockquote className="ai-draft-typed">
                        <span className="visually-hidden">{text}</span>
                        <span ref={draftRef} aria-hidden="true" />
                      </blockquote>
                    )
                  ) : null}
                </div>
                {/* Fixed-height pinned stage: the answer scrolls inside, so the layout never jumps between phases. */}
                <div className="ai-msg ai-msg-bot" aria-live="polite" role="region" aria-labelledby="ai-bot-label" tabIndex={0}>
                  <small id="ai-bot-label">
                    <Sparkles aria-hidden="true" />
                    Nucleus AI
                  </small>
                  {phase === 'thinking' ? (
                    <span className="typing" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : null}
                  {answered ? (
                    <div className="ai-answer" ref={answerRef}>
                      {scenario === 'review' ? <ReviewReading t={t} result={result} text={text} /> : null}
                      {scenario === 'pulse' ? <PulseAnswer t={t} /> : null}
                      {scenario === 'digest' ? <WeeklyAnswer t={t} /> : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="honest" data-reveal-item="">
              <ShieldCheck aria-hidden="true" />
              <p>{t.rich('ai.honest', BOLD)}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
