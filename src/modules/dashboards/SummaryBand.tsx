"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight, ArrowUpRight, CheckCircle2, ChevronDown, ChevronUp, Eye } from "lucide-react";
import type { Insight } from "@/server/dashboards/types";
import { IconButton, cx, ui } from "@/design/redesign/ui";
import styles from "./Dashboards.module.css";

/**
 * The board's findings, placed straight under the key figures: the tiles say *what*, this says
 * *so what*. Ranked findings (act, watch, good) lead as cards with their headline number and a jump
 * to the chart that shows it; plain context follows as one short list. It carries the page's one
 * highlight only when something needs acting on, and can be folded away (remembered per browser).
 */

const TONE = {
  risk: { label: "Act", icon: AlertTriangle, className: styles.signalRisk },
  attention: { label: "Watch", icon: Eye, className: styles.signalAttention },
  positive: { label: "Good", icon: CheckCircle2, className: styles.signalPositive },
} as const;

const MAX_CARDS = 4;
const FOLD_KEY = "nucleus_dashboard_summary_folded";

type Props = {
  insights: Array<string | Insight>;
  evidence?: string[];
  audience: string;
  generatedAt: string;
};

/** Scrolls to a panel and marks it briefly, so the eye lands on the evidence. */
function showPanel(id: string) {
  const section = document.getElementById(`panel-${id}`)?.closest("section");
  if (!section) return;
  section.scrollIntoView({ behavior: "smooth", block: "start" });
  section.setAttribute("tabindex", "-1");
  section.focus({ preventScroll: true });
  section.classList.add(styles.flash);
  window.setTimeout(() => section.classList.remove(styles.flash), 1800);
}

export default function SummaryBand({ insights, evidence, audience, generatedAt }: Props) {
  // The band only renders once the board has loaded in the browser, so the stored choice can be read directly.
  const [folded, setFolded] = useState(() => {
    try { return typeof window !== "undefined" && localStorage.getItem(FOLD_KEY) === "1"; } catch { return false; }
  });
  const [showEvidence, setShowEvidence] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const fold = (next: boolean) => {
    setFolded(next);
    try { localStorage.setItem(FOLD_KEY, next ? "1" : "0"); } catch { /* storage blocked */ }
  };

  const items: Insight[] = insights.map((item) => (typeof item === "string" ? { text: item, tone: "info" } : item));
  const ranked = items.filter((item): item is Insight & { tone: keyof typeof TONE } => item.tone === "risk" || item.tone === "attention" || item.tone === "positive");
  const cards = ranked.slice(0, MAX_CARDS);
  const context = [...ranked.slice(MAX_CARDS), ...items.filter((item) => !item.tone || item.tone === "info")];
  const needsAction = ranked.some((item) => item.tone === "risk" || item.tone === "attention");
  const counts = { act: ranked.filter((item) => item.tone === "risk").length, watch: ranked.filter((item) => item.tone === "attention").length };
  const time = new Date(generatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const title = needsAction ? "What needs attention" : "Summary";
  const tally = [counts.act ? `${counts.act} to act on` : null, counts.watch ? `${counts.watch} to watch` : null].filter(Boolean).join(", ");
  const lead = cards[0] ?? context[0];

  return (
    <section className={cx(ui.panel, needsAction && ui.highlight, styles.summary)} aria-labelledby="board-summary">
      <div className={styles.summaryHead}>
        <div className={styles.summaryHeading}>
          <h2 id="board-summary" className={ui.panelTitle}>{title}</h2>
          <p className={styles.summaryMeta}>
            {tally ? `${tally} · ` : ""}From {audience.toLowerCase()}, computed at {time}
            {evidence?.length ? <> · <button type="button" className={styles.evidenceToggle} aria-expanded={showEvidence} onClick={() => setShowEvidence(!showEvidence)}>{showEvidence ? "Hide method" : "How this was computed"}</button></> : null}
          </p>
        </div>
        <IconButton size="sm" label={folded ? "Show the findings" : "Fold the findings away"} icon={folded ? ChevronDown : ChevronUp} onClick={() => fold(!folded)} aria-expanded={!folded} />
      </div>

      {folded ? (
        lead && (
          <button type="button" className={styles.foldedLine} onClick={() => fold(false)}>
            <span className={cx(styles.foldedDot, lead.tone && lead.tone !== "info" && TONE[lead.tone].className)} aria-hidden="true" />
            <span>{lead.title ? <strong>{lead.title}{lead.figure ? `: ${lead.figure}` : ""}</strong> : lead.text}</span>
            {items.length > 1 && <span className={styles.foldedMore}>+{items.length - 1} more</span>}
          </button>
        )
      ) : (
        <>
          {cards.length > 0 && (
            <ul className={styles.signals}>
              {cards.map((card) => {
                const tone = TONE[card.tone];
                const Icon = tone.icon;
                const body = (
                  <>
                    <span className={styles.signalTop}>
                      <span className={styles.signalBadge}><Icon size={12} aria-hidden="true" />{tone.label}</span>
                      {card.title && <span className={styles.signalTitle}>{card.title}</span>}
                      {card.panel && <ArrowUpRight size={14} className={styles.signalGo} aria-hidden="true" />}
                    </span>
                    <span className={styles.signalBody}>
                      {card.figure && <span className={styles.signalFigure}>{card.figure}</span>}
                      <span className={styles.signalText}>{card.text}</span>
                    </span>
                  </>
                );
                return (
                  <li key={`${card.title}-${card.text}`}>
                    {card.panel
                      ? <button type="button" className={cx(styles.signal, tone.className)} onClick={() => showPanel(card.panel!)} title={`${card.text} Select to see the chart.`}>{body}</button>
                      : <div className={cx(styles.signal, tone.className)}>{body}</div>}
                  </li>
                );
              })}
            </ul>
          )}
          {/* With ranked cards, the remaining context waits behind one line; on its own it is the summary. */}
          {context.length > 0 && cards.length > 0 && (
            <button type="button" className={styles.contextToggle} aria-expanded={showContext} onClick={() => setShowContext(!showContext)}>
              {showContext ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
              {showContext ? "Fewer findings" : `${context.length} more ${context.length === 1 ? "finding" : "findings"}`}
            </button>
          )}
          {context.length > 0 && (cards.length === 0 || showContext) && (
            <ul className={cx(styles.context, cards.length === 0 && styles.contextOnly)}>
              {context.map((item) => (
                <li key={item.text}>
                  <span className={cx(styles.contextDot, item.tone && item.tone !== "info" && TONE[item.tone].className)} aria-hidden="true" />
                  <span>{item.title ? <strong>{item.title}{item.figure ? ` (${item.figure})` : ""}: </strong> : null}{item.text}</span>
                  {item.panel && <button type="button" className={styles.contextLink} onClick={() => showPanel(item.panel!)} aria-label={`See the chart: ${item.text}`}><ArrowRight size={12} aria-hidden="true" /></button>}
                </li>
              ))}
            </ul>
          )}
          {showEvidence && evidence?.length ? <ul className={styles.evidence}>{evidence.map((line) => <li key={line}>{line}</li>)}</ul> : null}
        </>
      )}
    </section>
  );
}
