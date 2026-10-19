/**
 * Section 2 · "The 90-second story" (server-rendered). Video panel on the left (columns 1–8), copy on the right
 * (columns 9–12). StoryMotion drives the tilt, chip and reveal choreography; FilmPlayer plays the real film.
 */
import type { ReactNode } from 'react';
import type { LandingText } from '../i18n/landing-text';
import { FilmPlayer } from '../story/film-player';
import { SectionHeading } from '../components/section-heading';
import { StoryMotion } from '../story/story-motion';

const CHIPS = ['attendance', 'appraisal', 'whatsapp', 'payroll'] as const;
const POINTS = ['queue', 'approvals', 'payroll'] as const;

export function Story({ t }: { readonly t: LandingText }): ReactNode {
  const chips = CHIPS.map((id) => (
    <span key={id} className={`lp-file-chip lp-file-chip-${id}`} data-story-chip="" aria-hidden="true">
      {t(`story.chips.${id}`)}
    </span>
  ));
  return (
    <StoryMotion>
      <div className="lp-glow lp-glow-start" data-parallax-glow="0.3" aria-hidden="true" />
      <div className="lp-wrap lp-grid lp-story-grid">
        <div className="lp-story-media">
          <div className="lp-story-frame" data-story-frame="">
            <FilmPlayer
              chips={chips}
              labels={{
                play: t('film.play'),
                watch: t('film.watch'),
                meta: t('film.meta'),
                frameTitle: t('film.frameTitle'),
                finished: t('film.finished'),
                end: t('film.end'),
                cta: t('hero.cta'),
                again: t('film.again'),
              }}
            />
          </div>
        </div>
        <div className="lp-story-copy">
          <p className="lp-kicker" data-story-reveal="">{t('film.pill')}</p>
          <SectionHeading text={t('film.title')} id="story-title" />
          <p className="lp-story-lead" data-story-reveal="">{t('film.lead')}</p>
          <ul className="lp-story-points">
            {POINTS.map((id) => <li key={id} data-story-reveal="">{t(`story.points.${id}`)}</li>)}
          </ul>
        </div>
      </div>
    </StoryMotion>
  );
}
