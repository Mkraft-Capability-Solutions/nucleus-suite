'use client';

/**
 * "See Nucleus run your HR." The three-step booking card (date and slot → team details → confirmation) with the real
 * submission to the demo API (demo-booking/submit-demo.ts; failures show the localized error, success only on a real
 * success response). Copy, points and contact links stagger in with the shared section motion.
 */
import { useMemo, useRef, type ReactNode } from 'react';
import { ArrowRight, Check, ChevronLeft, ChevronRight, Mail, Phone } from 'lucide-react';
import { useLandingText } from '../i18n/use-landing-text';
import { useSectionMotion } from '../motion/use-section-motion';
import { CONTACT_EMAIL, CONTACT_PHONE, FOCUS_IDS, slotLabel, TEAM_SIZES, useDemoBooking, weekdayNames } from '../demo-booking/use-demo-booking';
import { SectionHeader } from '../section-kit/section-header';

const POINTS = ['mapped', 'preview', 'plan', 'obligation'] as const;

export function DemoBookingSection(): ReactNode {
  const t = useLandingText();
  const sectionRef = useRef<HTMLElement>(null);
  useSectionMotion(sectionRef);
  const messages = useMemo(() => ({ invalid: t('demo.errors.invalid'), failed: t('demo.errors.failed', { email: CONTACT_EMAIL }) }), [t]);
  const firstField = useRef<HTMLInputElement>(null);
  const booking = useDemoBooking(messages, firstField);
  const { date, slot, step, form, invalid, busy, error } = booking;
  const slotText = slot ? slotLabel(slot) : '';

  return (
    <section ref={sectionRef} className="lp-section demo lp-motion-root" id="demo" aria-labelledby="demo-title">
      <div className="lp-glow lp-glow-start" data-parallax-glow="0.26" aria-hidden="true" />
      <div className="lp-wrap">
        <div className="lp-grid">
          <div className="demo-txt">
            <SectionHeader kicker={t('demo.pill')} title={t('demo.title')} titleId="demo-title" lead={t('demo.lead')} className="demo-head" />
            <ul className="demo-points">
              {POINTS.map((id) => (
                <li key={id} data-reveal-item="">
                  <i>
                    <Check aria-hidden="true" />
                  </i>
                  {t(`demo.points.${id}`)}
                </li>
              ))}
            </ul>
            <div className="contact" data-reveal-item="">
              <p className="contact-label">{t('demo.contactLabel')}</p>
              <div className="contact-links">
                <a className="contact-link lp-lift" href={`mailto:${CONTACT_EMAIL}`}>
                  <span className="ci">
                    <Mail aria-hidden="true" />
                  </span>
                  <span>
                    <small>{t('demo.emailUs')}</small>
                    <b dir="ltr">{CONTACT_EMAIL}</b>
                  </span>
                </a>
                <a className="contact-link lp-lift" href={`tel:${CONTACT_PHONE.tel}`}>
                  <span className="ci">
                    <Phone aria-hidden="true" />
                  </span>
                  <span>
                    <small>{t('demo.callUs')}</small>
                    <b dir="ltr">{CONTACT_PHONE.display}</b>
                  </span>
                </a>
              </div>
            </div>
          </div>

          <div className="book" data-reveal-item="">
            <div className="book-steps" aria-hidden="true">
              {[0, 1, 2].map((index) => (
                <span key={index} className={index <= step ? 'on' : undefined} />
              ))}
            </div>

            {step === 0 ? (
              <div className="bk on">
                <h3>{t('demo.pickTitle')}</h3>
                <p className="muted">{t('demo.pickSub')}</p>
                <div className="calw">
                  <div>
                    <div className="cal-h">
                      <button type="button" aria-label={t('demo.prevMonth')} disabled={booking.atCurrentMonth} onClick={() => {
                        booking.shiftMonth(-1);
                      }}>
                        <ChevronLeft aria-hidden="true" className="lp-flip-rtl" />
                      </button>
                      <span>{booking.monthLabel}</span>
                      <button type="button" aria-label={t('demo.nextMonth')} onClick={() => {
                        booking.shiftMonth(1);
                      }}>
                        <ChevronRight aria-hidden="true" className="lp-flip-rtl" />
                      </button>
                    </div>
                    <div className="cg">
                      {weekdayNames().map((name, index) => (
                        <span key={index} className="dn" aria-hidden="true">
                          {name}
                        </span>
                      ))}
                      {Array.from({ length: booking.firstOfMonth }, (entry, index) => (
                        <span key={`pad-${String(index)}`} />
                      ))}
                      {booking.days.map((cell) => (
                        <button
                          key={cell.day}
                          type="button"
                          disabled={!cell.open}
                          className={`${cell.open ? 'av' : ''}${cell.chosen ? ' sel' : ''}`}
                          aria-label={cell.label}
                          aria-pressed={cell.chosen}
                          onClick={() => {
                            booking.pickDate(cell.date);
                          }}
                        >
                          {cell.day}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="slots">
                    {date ? (
                      <>
                        <p className="sd">{booking.dateLabel}</p>
                        {booking.slots.map((time) => (
                          <button key={time} type="button" className={slot === time ? 'sel' : undefined} aria-pressed={slot === time} onClick={() => {
                            booking.setSlot(time);
                          }}>
                            {slotLabel(time)}
                          </button>
                        ))}
                      </>
                    ) : (
                      <p className="sd">{t('demo.chooseDate')}</p>
                    )}
                  </div>
                </div>
                <div className="bk-actions">
                  <span className="muted">{booking.summary}</span>
                  <button type="button" className="lp-btn lp-btn-primary" disabled={!(date && slot)} onClick={booking.next}>
                    {t('demo.continue')}
                    <ArrowRight aria-hidden="true" className="lp-flip-rtl" />
                  </button>
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <form className="bk on" onSubmit={(event) => void booking.submit(event)} noValidate>
                <h3>{t('demo.detailsTitle')}</h3>
                <p className="muted">{t('demo.slotAt', { date: booking.dateLabel, time: slotText })}</p>
                <div className="fld">
                  <div className="two">
                    <label>
                      {t('demo.name')}
                      <input ref={firstField} autoComplete="name" placeholder={t('demo.namePlaceholder')} value={form.name} onChange={booking.field('name')} aria-invalid={invalid.name ?? undefined} maxLength={120} />
                    </label>
                    <label>
                      {t('demo.email')}
                      <input type="email" dir="ltr" autoComplete="email" placeholder={t('demo.emailPlaceholder')} value={form.email} onChange={booking.field('email')} aria-invalid={invalid.email ?? undefined} maxLength={254} />
                    </label>
                  </div>
                  <div className="two">
                    <label>
                      {t('demo.company')}
                      <input autoComplete="organization" placeholder={t('demo.companyPlaceholder')} value={form.company} onChange={booking.field('company')} aria-invalid={invalid.company ?? undefined} maxLength={160} />
                    </label>
                    <label>
                      {t('demo.employees')}
                      <select value={form.teamSize} onChange={booking.field('teamSize')}>
                        {TEAM_SIZES.map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    {t('demo.focus')}
                    <select value={form.focus} onChange={booking.field('focus')}>
                      {FOCUS_IDS.map((id) => (
                        <option key={id} value={id}>
                          {t(`demo.focusAreas.${id}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {error ? (
                  <p className="book-error" role="alert">
                    {error}
                  </p>
                ) : null}
                <div className="bk-actions">
                  <button type="button" className="back" onClick={booking.back}>
                    {t('demo.back')}
                  </button>
                  <button type="submit" className="lp-btn lp-btn-primary" disabled={busy}>
                    {busy ? t('demo.sending') : t('demo.confirm')}
                    <ArrowRight aria-hidden="true" className="lp-flip-rtl" />
                  </button>
                </div>
              </form>
            ) : null}

            {step === 2 ? (
              <div className="bk on" role="status">
                <div className="okb">
                  <div className="big">
                    <Check aria-hidden="true" />
                  </div>
                  <h3>{t('demo.received')}</h3>
                  <p>
                    {booking.firstName
                      ? t('demo.receivedSlotNamed', { date: booking.dateLabel, time: slotText, name: booking.firstName })
                      : t('demo.receivedSlot', { date: booking.dateLabel, time: slotText })}
                  </p>
                  <p className="okb-note">{t('demo.receivedNote')}</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
