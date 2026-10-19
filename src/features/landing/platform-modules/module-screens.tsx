'use client';

/**
 * Illustrative product screens shown beside each platform module (sample data, marked CONFIRM in the reference build).
 * Two screens scrub a small detail with the scroll position inside their module's step: the onboarding checklist
 * ticks itself off and the review bars fill (reversible).
 */
import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { formatCurrency, formatNumber } from '../i18n/format.js';
import type { LandingText } from '../i18n/landing-text';
import { useLandingText } from '../i18n/use-landing-text';
import { clamp, easeOut } from '../motion/scroll-engine';
import type { ModuleId } from '../motion/module-selection';
import { MeterFill } from '../section-kit/meter-fill';

const inr = (value: number): string => formatCurrency(value, 'INR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const percent = (value: number): string => formatNumber(value / 100, { style: 'percent' });

function AppWindow({ title, children }: { readonly title: string; readonly children: ReactNode }): ReactNode {
  return (
    <div className="win">
      <div className="win-bar" aria-hidden="true">
        <i />
        <i />
        <i />
        <span>{title}</span>
      </div>
      <div className="win-body">{children}</div>
    </div>
  );
}

function StatusRow({ tag, tone, children, className = '' }: { readonly tag: string; readonly tone: string; readonly children: ReactNode; readonly className?: string }): ReactNode {
  return (
    <div className={`row ${className}`.trim()}>
      <span className={`tagx ${tone}`}>{tag}</span>
      <span className="grow">{children}</span>
    </div>
  );
}

function HireScreen({ t }: { readonly t: LandingText }): ReactNode {
  const columns = [
    { id: 'applied', count: 12, cards: [{ name: 'Rohan M.', note: t('screens.hire.referral'), hot: false }, { name: 'Isha K.', note: t('screens.hire.careers'), hot: false }] },
    { id: 'interview', count: 4, cards: [{ name: 'Vikram S.', note: t('screens.hire.panel'), hot: false }] },
    { id: 'offer', count: 1, cards: [{ name: 'Ananya R.', note: t('screens.hire.offerSent'), hot: true }] },
    { id: 'joined', count: 2, cards: [{ name: 'Kabir N.', note: t('screens.hire.started'), hot: false }] },
  ] as const;
  return (
    <AppWindow title={t('screens.hire.window')}>
      <div className="k-cols">
        {columns.map((column) => (
          <div className="k-col" key={column.id}>
            <p className="k-h">
              {t(`screens.hire.${column.id}`)}
              <span>{formatNumber(column.count)}</span>
            </p>
            {column.cards.map((card) => (
              <div key={card.name} className={card.hot ? 'k-card hot' : 'k-card'}>
                <b>{card.name}</b>
                <span>{card.note}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <StatusRow tag={t('screens.hire.auto')} tone="t-ok" className="gap-s">
        {t('screens.hire.reminders')}
      </StatusRow>
    </AppWindow>
  );
}

const ONBOARD_STEPS = ['accepted', 'documents', 'laptop', 'intro', 'policies', 'plan'] as const;

function OnboardScreen({ t, progress }: { readonly t: LandingText; readonly progress: number }): ReactNode {
  // The checklist ticks itself off over the first 70% of the module's scroll window.
  const ticked = Math.min(ONBOARD_STEPS.length, Math.floor(clamp(progress / 0.7) * ONBOARD_STEPS.length + 1e-6));
  const ready = Math.round((ticked / ONBOARD_STEPS.length) * 100);
  return (
    <AppWindow title={t('screens.onboard.window')}>
      <div className="mini-h">
        <b>{t('screens.hire.offerSent')}</b>
        <span className="tagx t-b">{t('screens.onboard.ready', { pct: percent(ready) })}</span>
      </div>
      <div className="pbar">
        <MeterFill value={ready} />
      </div>
      <div className="gap-m">
        {ONBOARD_STEPS.map((step, index) => (
          <div className="row" key={step}>
            <span className={index < ticked ? 'ck on' : 'ck'}>
              <Check aria-hidden="true" />
            </span>
            <span className="grow">{t(`screens.onboard.steps.${step}`)}</span>
          </div>
        ))}
      </div>
    </AppWindow>
  );
}

const ATTENDANCE = 'ppppplppppmpppllpppppppppmppp';

function ManageScreen({ t }: { readonly t: LandingText }): ReactNode {
  const days = Array.from({ length: 28 }, (entry, day) => {
    if (day % 7 > 4) return '';
    const mark = ATTENDANCE[day];
    if (mark === 'l' || mark === 'm') return mark;
    return day % 3 ? 'p2' : 'p';
  });
  const balances = [
    { id: 'earned', value: 14 },
    { id: 'sick', value: 6 },
    { id: 'compOff', value: 2 },
  ] as const;
  return (
    <AppWindow title={t('screens.manage.window')}>
      <div className="bal">
        {balances.map((balance) => (
          <div key={balance.id}>
            <b>{formatNumber(balance.value)}</b>
            <span>{t(`screens.manage.${balance.id}`)}</span>
          </div>
        ))}
      </div>
      <div className="cal" aria-hidden="true">
        {days.map((kind, index) => (
          <i key={index} className={kind || undefined} />
        ))}
      </div>
      <div className="legend">
        <span>
          <i className="lg-p" />
          {t('screens.manage.present')}
        </span>
        <span>
          <i className="lg-l" />
          {t('screens.manage.leave')}
        </span>
        <span>
          <i className="lg-m" />
          {t('screens.manage.missed')}
        </span>
      </div>
    </AppWindow>
  );
}

function PayScreen({ t }: { readonly t: LandingText }): ReactNode {
  const earnings = [
    { id: 'basic', value: 48000 },
    { id: 'hra', value: 19200 },
    { id: 'special', value: 14800 },
  ] as const;
  const deductions = [
    { id: 'pf', value: 5760 },
    { id: 'professionalTax', value: 200 },
    { id: 'incomeTax', value: 6140 },
  ] as const;
  return (
    <AppWindow title={t('screens.pay.window')}>
      <div className="mini-h">
        <b>{t('screens.pay.employee')}</b>
        <span className="tagx t-ok">{t('screens.pay.synced')}</span>
      </div>
      <div className="slip">
        <div>
          <p className="slip-h">{t('screens.pay.earnings')}</p>
          {earnings.map((line) => (
            <div className="ln" key={line.id}>
              <span>{t(`screens.pay.${line.id}`)}</span>
              <span>{inr(line.value)}</span>
            </div>
          ))}
        </div>
        <div>
          <p className="slip-h">{t('screens.pay.deductions')}</p>
          {deductions.map((line) => (
            <div className="ln" key={line.id}>
              <span>{t(`screens.pay.${line.id}`)}</span>
              <span>{inr(line.value)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="net">
        <span>{t('screens.pay.net')}</span>
        <b>{inr(69900)}</b>
      </div>
      <p className="fine">{t('screens.pay.fine')}</p>
    </AppWindow>
  );
}

const REVIEW_PROGRESS = [
  { id: 'self', value: 96 },
  { id: 'manager', value: 88 },
  { id: 'peer', value: 74 },
  { id: 'calibration', value: 40 },
] as const;

function PerformScreen({ t, progress }: { readonly t: LandingText; readonly progress: number }): ReactNode {
  // Review bars fill with the first 60% of the module's scroll window.
  const fill = easeOut(clamp(progress / 0.6));
  return (
    <AppWindow title={t('screens.perform.window')}>
      <div className="mini-h">
        <b>{t('screens.perform.title')}</b>
        <span className="tagx t-ok">{t('screens.perform.closes')}</span>
      </div>
      {REVIEW_PROGRESS.map((item) => (
        <div key={item.id} className="pb-row">
          <div className="pb-h">
            <span>{t(`screens.perform.${item.id}`)}</span>
            <span>{percent(item.value)}</span>
          </div>
          <div className="pbar">
            <MeterFill value={item.value * fill} />
          </div>
        </div>
      ))}
      <StatusRow tag={t('screens.perform.needsYou')} tone="t-w" className="gap-l">
        {t('screens.perform.pending')}
      </StatusRow>
    </AppWindow>
  );
}

function GrowScreen({ t }: { readonly t: LandingText }): ReactNode {
  const courses = [
    { tone: 1, kind: t('screens.grow.leadership'), title: t('screens.grow.feedback'), note: t('screens.grow.complete') },
    { tone: 2, kind: t('screens.grow.roleSkill'), title: t('screens.grow.data'), note: t('screens.grow.new') },
    { tone: 3, kind: t('screens.grow.wellbeing'), title: t('screens.grow.workload'), note: t('screens.grow.assigned') },
  ] as const;
  return (
    <AppWindow title={t('screens.grow.window')}>
      <div className="mini-h">
        <b>{t('screens.grow.title')}</b>
        <span className="tagx t-b">{t('screens.grow.brand')}</span>
      </div>
      <div className="course">
        {courses.map((course) => (
          <div key={course.tone} className={`course-${String(course.tone)}`}>
            <span>{course.kind}</span>
            <b>{course.title}</b>
            <span>{course.note}</span>
          </div>
        ))}
      </div>
      <StatusRow tag={t('screens.grow.linked')} tone="t-ok" className="gap-m">
        {t('screens.grow.goal')}
      </StatusRow>
    </AppWindow>
  );
}

function EngageScreen({ t }: { readonly t: LandingText }): ReactNode {
  return (
    <AppWindow title={t('screens.engage.window')}>
      <div className="gauge">
        <div className="ring">
          <svg viewBox="0 0 36 36" className="gauge-ring" aria-hidden="true">
            <circle cx="18" cy="18" r="15" fill="none" className="gauge-track" strokeWidth="4" />
            <circle cx="18" cy="18" r="15" fill="none" className="gauge-value" strokeWidth="4" strokeLinecap="round" strokeDasharray="94.2" strokeDashoffset="22" />
          </svg>
        </div>
        <div>
          <b className="gauge-n">{formatNumber(77)}</b>
          <div className="gauge-t">{t('screens.engage.score')}</div>
        </div>
      </div>
      <div className="row gap-m">
        <span className="avatar" aria-hidden="true">
          {t('screens.engage.initials')}
        </span>
        <span className="grow">
          {t.rich('screens.engage.recognised', { b: (children, key) => <b key={key}>{children}</b> })}
          <small>{t('screens.engage.quote')}</small>
        </span>
        <span className="tagx t-b">{formatNumber(12, { signDisplay: 'always' })}</span>
      </div>
      <StatusRow tag={t('screens.engage.watch')} tone="t-w">
        {t('screens.engage.rising')}
      </StatusRow>
    </AppWindow>
  );
}

function SupportScreen({ t }: { readonly t: LandingText }): ReactNode {
  return (
    <AppWindow title={t('screens.support.window')}>
      <div className="chat">
        <div className="msg u">{t('screens.support.ask')}</div>
        <div className="msg b">
          <small>{t('screens.support.source')}</small>
          {t('screens.support.answer')}
        </div>
        <div className="msg u">{t('screens.support.reply')}</div>
        <div className="msg b">
          <small>Nucleus</small>
          <span className="typing" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </div>
      </div>
    </AppWindow>
  );
}

/** The screen for one module; `progress` (0…1, scroll position inside the module's step) drives its small detail. */
export function ModuleScreen({ id, progress }: { readonly id: ModuleId; readonly progress: number }): ReactNode {
  const t = useLandingText();
  switch (id) {
    case 'hire':
      return <HireScreen t={t} />;
    case 'onboard':
      return <OnboardScreen t={t} progress={progress} />;
    case 'manage':
      return <ManageScreen t={t} />;
    case 'pay':
      return <PayScreen t={t} />;
    case 'perform':
      return <PerformScreen t={t} progress={progress} />;
    case 'grow':
      return <GrowScreen t={t} />;
    case 'engage':
      return <EngageScreen t={t} />;
    case 'support':
      return <SupportScreen t={t} />;
  }
}
