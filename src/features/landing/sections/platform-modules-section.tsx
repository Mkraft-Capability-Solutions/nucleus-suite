'use client';

/**
 * "Eight modules. One brain. Zero re-entry." (pinned). Eight scroll steps: each step selects the next module tab (a
 * sliding indicator moves under it), the module's copy and product screen cross-fade in, and the progress rail
 * (1–8) fills continuously with the scroll. A tab click or the arrow keys scroll to that module's step.
 *
 * The hero's orbit nodes target a module through scrollToPlatformModule(id) (platform-modules/scroll-to-platform-
 * module.ts), which also records the request in the shared module selection; a request made with the older
 * selectModule() alone is honoured here too (once per request, also when this section loads after the click).
 */
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Briefcase, Check, Clock, HeartHandshake, LifeBuoy, Target, TrendingUp, UserPlus, Wallet, type LucideIcon } from 'lucide-react';
import { formatNumber } from '../i18n/format.js';
import { useLandingText } from '../i18n/use-landing-text';
import { getModuleSelection, getServerModuleSelection, MODULE_IDS, subscribeModuleSelection, type ModuleId } from '../motion/module-selection';
import { clamp, scrollToTarget } from '../motion/scroll-engine';
import { useSectionMotion } from '../motion/use-section-motion';
import { ModuleScreen } from '../platform-modules/module-screens';
import { platformModuleY } from '../platform-modules/scroll-to-platform-module';
import { handleTabKeys } from '../section-kit/roving-tabs';
import { SectionHeader } from '../section-kit/section-header';
import { usePinnedSteps } from '../section-kit/use-pinned-steps';
import { useSlidingIndicator } from '../section-kit/use-sliding-indicator';

export { scrollToPlatformModule } from '../platform-modules/scroll-to-platform-module';

const ICONS: Readonly<Record<ModuleId, LucideIcon>> = {
  hire: Briefcase,
  onboard: UserPlus,
  manage: Clock,
  pay: Wallet,
  perform: Target,
  grow: TrendingUp,
  engage: HeartHandshake,
  support: LifeBuoy,
};
const POINTS = ['a', 'b', 'c'] as const;
const COUNT = MODULE_IDS.length;
const two = (value: number): string => formatNumber(value, { minimumIntegerDigits: 2 });

/** Last module request applied (module scope: survives the section loading after the request). */
let appliedSerial = 0;

export function PlatformModulesSection(): ReactNode {
  const t = useLandingText();
  const sectionRef = useRef<HTMLElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLOListElement>(null);
  const stepRef = useRef(0);
  useSectionMotion(sectionRef);
  const [screenProgress, setScreenProgress] = useState(1);
  const { step, pinned, goTo } = usePinnedSteps(sectionRef, COUNT, ({ progress, local, pinned: isPinned }) => {
    // Quantised (1/48) so the screens re-render only when their detail changes.
    const quantised = Math.round(local * 48) / 48;
    setScreenProgress((previous) => (previous === quantised ? previous : quantised));
    const rail = railRef.current;
    if (!rail) return;
    rail.querySelectorAll<HTMLElement>('[data-rail-fill]').forEach((fill, index) => {
      const value = isPinned ? clamp(progress * COUNT - index) : Number(index <= stepRef.current);
      fill.style.transform = `scaleX(${String(value)})`;
    });
  });
  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  useSlidingIndicator(tabsRef, step);

  const selection = useSyncExternalStore(subscribeModuleSelection, getModuleSelection, getServerModuleSelection);
  useEffect(() => {
    if (!selection || selection.serial === appliedSerial) return undefined;
    appliedSerial = selection.serial;
    const index = MODULE_IDS.indexOf(selection.id);
    if (!pinned) {
      goTo(index);
      return undefined;
    }
    // Next task: a caller that also started its own scroll to the section top is overridden by the module step.
    const timer = window.setTimeout(() => {
      scrollToTarget(() => platformModuleY(index));
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [selection, pinned, goTo]);

  return (
    <section ref={sectionRef} className="lp-section mods lp-pin lp-pin-mods lp-motion-root" id="platform" aria-labelledby="platform-title">
      <div className="lp-pin-stage" data-pin-stage="">
        <div className="lp-glow lp-glow-end" data-parallax-glow="0.3" aria-hidden="true" />
        <div className="lp-wrap">
          <div className="lp-grid">
            <SectionHeader kicker={t('platform.pill')} title={t('platform.title')} titleId="platform-title" lead={t('platform.lead')} className="head head-split" />
            <div
              ref={tabsRef}
              className="mod-tabs"
              role="tablist"
              aria-label={t('platform.tabs')}
              data-reveal-item=""
              onKeyDown={(event) => {
                handleTabKeys(event, step, COUNT, goTo);
              }}
            >
              <span className="lp-indicator" data-indicator="" aria-hidden="true" />
              {MODULE_IDS.map((id, index) => {
                const Icon = ICONS[id];
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    id={`platform-tab-${id}`}
                    aria-selected={index === step}
                    aria-controls={`platform-panel-${id}`}
                    tabIndex={index === step ? 0 : -1}
                    onClick={() => {
                      goTo(index);
                    }}
                  >
                    <Icon aria-hidden="true" />
                    {t(`modules.${id}.name`)}
                  </button>
                );
              })}
            </div>
            <ol ref={railRef} className="mod-rail" aria-hidden="true">
              {MODULE_IDS.map((id, index) => (
                <li key={id} data-done={index <= step ? '' : undefined}>
                  <span className="mod-rail-n">{formatNumber(index + 1)}</span>
                  <span className="mod-rail-track">
                    <i data-rail-fill="" />
                  </span>
                </li>
              ))}
            </ol>
            <div className="mod-panel lp-lift" data-reveal-item="">
              {MODULE_IDS.map((id, index) => {
                const current = index === step;
                return (
                  <div
                    key={id}
                    className="mod-slide"
                    id={`platform-panel-${id}`}
                    role="tabpanel"
                    aria-labelledby={`platform-tab-${id}`}
                    data-active={current ? '' : undefined}
                    inert={!current}
                  >
                    <div className="mod-txt">
                      <span className="num">
                        {two(index + 1)} / {two(COUNT)}
                      </span>
                      <h3>{t(`modules.${id}.title`)}</h3>
                      <p>{t(`modules.${id}.body`)}</p>
                      <ul>
                        {POINTS.map((point) => (
                          <li key={point}>
                            <i>
                              <Check aria-hidden="true" />
                            </i>
                            {t(`modules.${id}.points.${point}`)}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="mod-ui">
                      <ModuleScreen id={id} progress={current ? screenProgress : 1} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
