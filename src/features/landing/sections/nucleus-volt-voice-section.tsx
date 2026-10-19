'use client';

/**
 * "Don't click. Just say it." Nucleus Volt (pinned). Three scroll steps select the three Volt screens in sequence;
 * within a screen's scroll window its scenario plays (command spoken word by word, steps tick, result), scroll-
 * scrubbed and reversible. The mic button replays the scenario in real time. The command chips scroll to their screen.
 * "Expand" opens the same screen larger in an accessible modal dialog that scales up from the phone (ExpandDialog).
 */
import { useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Maximize2 } from 'lucide-react';
import { useLandingText } from '../i18n/use-landing-text';
import { clamp } from '../motion/scroll-engine';
import { useSectionMotion } from '../motion/use-section-motion';
import { ExpandDialog, type ExpandDialogHandle } from '../nucleus-volt-voice/expand-dialog';
import { beatTimes, VOLT_SCENARIOS, VoltPhone } from '../nucleus-volt-voice/volt-phone';
import { handleTabKeys } from '../section-kit/roving-tabs';
import { SectionHeader } from '../section-kit/section-header';
import { usePinnedSteps } from '../section-kit/use-pinned-steps';
import { useSlidingIndicator } from '../section-kit/use-sliding-indicator';

const POINTS = ['zero', 'whole', 'phone', 'shows'] as const;

export function NucleusVoltVoiceSection(): ReactNode {
  const t = useLandingText();
  const sectionRef = useRef<HTMLElement>(null);
  const commandsRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<ExpandDialogHandle>(null);
  /** Mic replay: engine time the replay started and the step it belongs to (null: scroll drives the screen). */
  const replayRef = useRef<{ start: number | null; step: number; requested: boolean }>({ start: null, step: -1, requested: false });
  const beatRef = useRef(0);
  const [beat, setBeat] = useState(0);
  const [expanded, setExpanded] = useState(false);
  useSectionMotion(sectionRef);

  // Scroll-scrubbed playback: the position inside the screen's scroll window (first 90%) maps onto the scenario's beat
  // timeline (words, step ticks, result), so scrolling up plays it backwards. Un-pinned: the finished screen. The mic
  // button replays the scenario in real time until it ends or the step changes, then scroll takes over again.
  const { step, goTo } = usePinnedSteps(sectionRef, VOLT_SCENARIOS.length, ({ local, step: current, frame }) => {
    const scenario = VOLT_SCENARIOS[current] ?? VOLT_SCENARIOS[0];
    const times = beatTimes(t(`volt.scenarios.${scenario.id}.said`));
    const total = times.at(-1) ?? 1;
    const replay = replayRef.current;
    if (replay.requested) {
      replay.requested = false;
      replay.start = frame.time;
      replay.step = current;
    }
    if (replay.start !== null && replay.step !== current) replay.start = null;
    const at = replay.start === null ? clamp(local / 0.9) * total : frame.time - replay.start;
    if (replay.start !== null && at > total) replay.start = null;
    const next = times.filter((time) => time <= at).length;
    if (next !== beatRef.current) {
      beatRef.current = next;
      setBeat(next);
    }
  }, () => replayRef.current.requested || replayRef.current.start !== null);
  /** Mic button (inline phone and dialog): replay the current scenario from its first word. */
  const replay = (): void => {
    replayRef.current.requested = true;
    beatRef.current = 0;
    setBeat(0);
  };
  useSlidingIndicator(commandsRef, step);
  const scenario = VOLT_SCENARIOS[step] ?? VOLT_SCENARIOS[0];

  return (
    <section ref={sectionRef} className="lp-section volt lp-pin lp-pin-volt lp-motion-root" id="volt" aria-labelledby="volt-title">
      <div className="lp-pin-stage" data-pin-stage="">
        <div className="lp-glow lp-glow-start" data-parallax-glow="0.3" aria-hidden="true" />
        <div className="lp-wrap">
          <div className="lp-grid">
            <div className="volt-txt">
              <SectionHeader kicker={t('volt.pill')} title={t('volt.title')} titleId="volt-title" lead={t('volt.lead')} className="volt-head" />
              <div className="vpoints">
                {POINTS.map((id) => (
                  <div className="vp lp-lift" key={id} data-reveal-item="">
                    <h3>{t(`volt.points.${id}.title`)}</h3>
                    <p>{t(`volt.points.${id}.text`)}</p>
                  </div>
                ))}
              </div>
              <div className="vcta" data-reveal-item="">
                <a href="#demo" className="lp-btn lp-btn-primary">
                  {t('volt.cta')}
                  <ArrowRight aria-hidden="true" className="lp-flip-rtl" />
                </a>
                <small>{t('volt.ctaNote')}</small>
              </div>
            </div>
            <div className="volt-demo" data-reveal-item="">
              <div className="phone-wrap" ref={phoneRef} id="volt-panel" role="tabpanel" aria-labelledby={`volt-tab-${scenario.id}`}>
                <div aria-hidden={expanded || undefined} key={scenario.id} className="volt-screen">
                  <VoltPhone t={t} scenario={scenario} beat={beat} onReplay={replay} />
                </div>
                <button
                  type="button"
                  className="volt-expand"
                  aria-haspopup="dialog"
                  onClick={(event) => {
                    if (phoneRef.current) dialogRef.current?.open(phoneRef.current, event.currentTarget);
                  }}
                >
                  <Maximize2 aria-hidden="true" />
                  {t('volt.expand')}
                </button>
              </div>
              <div
                ref={commandsRef}
                className="cmds"
                role="tablist"
                aria-label={t('volt.run')}
                onKeyDown={(event) => {
                  handleTabKeys(event, step, VOLT_SCENARIOS.length, goTo);
                }}
              >
                <span className="lp-indicator" data-indicator="" aria-hidden="true" />
                {VOLT_SCENARIOS.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    id={`volt-tab-${item.id}`}
                    aria-selected={index === step}
                    aria-controls="volt-panel"
                    tabIndex={index === step ? 0 : -1}
                    onClick={() => {
                      goTo(index);
                    }}
                  >
                    <q>{t(`volt.scenarios.${item.id}.command`)}</q>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <ExpandDialog ref={dialogRef} title={t('volt.dialogTitle')} closeLabel={t('volt.close')} onOpenChange={setExpanded}>
        <VoltPhone t={t} scenario={scenario} beat={beat} large onReplay={replay} />
        <p className="lp-expand-caption">
          <q>{t(`volt.scenarios.${scenario.id}.command`)}</q>
        </p>
      </ExpandDialog>
    </section>
  );
}
