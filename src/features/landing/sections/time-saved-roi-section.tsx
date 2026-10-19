'use client';

/**
 * "See how much chasing Nucleus takes off your plate." Two sliders (headcount, hourly cost) drive the yearly hours,
 * their value and the full-time people they equal (roi-model.ts). The three counters and the people bars (one bar per
 * full-time person, the last one partial, staggered) are value · E(p) of the results panel's scroll progress
 * (motion/scroll-reveal.ts): they count up on the way down, back down on the way up, and follow the sliders at once
 * when final. Written by the shared engine straight to the DOM (no re-render per frame).
 */
import { useRef, useState, type ReactNode } from 'react';
import { formatCurrency, formatNumber } from '../i18n/format.js';
import { useLandingText } from '../i18n/use-landing-text';
import { clamp } from '../motion/scroll-engine';
import { easeOutQuart, elementProgress, ITEM_STEP, staggered } from '../motion/scroll-reveal';
import { useScene } from '../motion/use-scene';
import { useSectionMotion } from '../motion/use-section-motion';
import { SectionHeader } from '../section-kit/section-header';
import { formatRupees, ROI_INPUTS, roiFigures } from '../time-saved-roi/roi-model';

const MAX_BARS = 30;

interface SliderProps {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly value: number;
  readonly display: string;
  readonly onChange: (value: number) => void;
}

function Slider({ id, label, hint, min, max, step, value, display, onChange }: SliderProps): ReactNode {
  return (
    <div className="sl" data-reveal-item="">
      <div className="top">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{display}</output>
      </div>
      <input type="range" id={id} min={min} max={max} step={step} value={value} aria-describedby={`${id}-hint`} onChange={(event) => {
        onChange(Number(event.target.value));
        }} />
              <p className="hint" id={`${id}-hint`}>
                {hint}
              </p>
            </div>
          );
      }

export function TimeSavedRoiSection(): ReactNode {
  const t = useLandingText();
  const sectionRef = useRef<HTMLElement>(null);
  const hoursRef = useRef<HTMLElement>(null);
  const valueRef = useRef<HTMLElement>(null);
  const fteRef = useRef<HTMLElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const resultsTop = useRef(0);
  // Server HTML and first paint carry the default figures; afterwards the engine writes the text nodes directly (React
  // never re-renders these strings, they are fixed initial values).
  const [initialTexts] = useState(() => {
    const start = roiFigures(ROI_INPUTS.headcount.initial, ROI_INPUTS.rate.initial);
    return [
      formatNumber(Math.round(start.hours)),
      formatRupees(start.value, t.locale, { crore: t('roi.units.crore'), lakh: t('roi.units.lakh') }),
      formatNumber(start.fte, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    ] as const;
  });
  const textRef = useRef<string[]>([...initialTexts]);
  const [headcount, setHeadcount] = useState<number>(ROI_INPUTS.headcount.initial);
  const [rate, setRate] = useState<number>(ROI_INPUTS.rate.initial);
  const figures = roiFigures(headcount, rate);
  const bars = Math.min(MAX_BARS, Math.max(1, Math.ceil(figures.fte)));
  useSectionMotion(sectionRef);

  useScene(
    sectionRef,
    (frame) => {
      // Counters and bars are value · E(p) of the results panel's own scroll progress: forward on the way down,
      // backwards on the way up, final once the panel's top has risen half a viewport.
      const p = elementProgress(resultsTop.current, frame.scroll, frame.viewportHeight);
      const k = easeOutQuart(p);
      const texts = [
        formatNumber(Math.round(figures.hours * k)),
        formatRupees(figures.value * k, t.locale, { crore: t('roi.units.crore'), lakh: t('roi.units.lakh') }),
        formatNumber(figures.fte * k, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      ];
      [hoursRef, valueRef, fteRef].forEach((ref, index) => {
        const text = texts[index] ?? '';
        if (ref.current && textRef.current[index] !== text) {
          textRef.current[index] = text;
          ref.current.textContent = text;
        }
      });
      barsRef.current?.querySelectorAll<HTMLElement>('i').forEach((bar, index) => {
        bar.style.transform = `scaleY(${(clamp(figures.fte - index) * staggered(p, index, ITEM_STEP)).toFixed(4)})`;
      });
    },
    {
      onMeasure: () => {
        const results = resultsRef.current;
        if (results) resultsTop.current = results.getBoundingClientRect().top + window.scrollY;
      },
    },
  );

  return (
    <section ref={sectionRef} className="lp-section roi lp-motion-root" id="roi" aria-labelledby="roi-title">
      <div className="lp-glow lp-glow-end" data-parallax-glow="0.22" aria-hidden="true" />
      <div className="lp-wrap">
        <div className="lp-grid">
          <SectionHeader kicker={t('roi.pill')} title={t('roi.title')} titleId="roi-title" />
          <div className="roi-box lp-lift" data-reveal-item="">
            <div className="roi-l">
              <Slider
                {...ROI_INPUTS.headcount}
                label={t('roi.headcount.label')}
                hint={t('roi.headcount.hint')}
                value={headcount}
                display={formatNumber(headcount)}
                onChange={setHeadcount}
              />
              <Slider
                {...ROI_INPUTS.rate}
                label={t('roi.rate.label')}
                hint={t('roi.rate.hint')}
                value={rate}
                display={formatCurrency(rate, 'INR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                onChange={setRate}
              />
            </div>
            <div className="roi-r" ref={resultsRef}>
              <div className="roi-big" data-reveal-item="">
                <small>{t('roi.hoursLabel')}</small>
                <b ref={hoursRef}>{initialTexts[0]}</b>
                <span>{t('roi.hoursText')}</span>
              </div>
              <div className="roi-split">
                <div data-reveal-item="">
                  <b ref={valueRef}>{initialTexts[1]}</b>
                  <span>{t('roi.valueLabel')}</span>
                </div>
                <div data-reveal-item="">
                  <b ref={fteRef}>{initialTexts[2]}</b>
                  <span>{t('roi.fteLabel')}</span>
                </div>
              </div>
              <div className="roi-bars" ref={barsRef} aria-hidden="true">
                {Array.from({ length: bars }, (entry, index) => (
                  <span key={index}>
                    <i />
                  </span>
                ))}
              </div>
              <p className="roi-note" data-reveal-item="">
                {t('roi.note')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
