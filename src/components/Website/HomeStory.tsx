'use client';
import { useTranslation } from '@/context/I18nContext';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import RemoveCircleOutline from '@mui/icons-material/RemoveCircleOutline';
import ArrowForward from '@mui/icons-material/ArrowForward';
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined';
import ShieldOutlined from '@mui/icons-material/ShieldOutlined';
import HomePreview from './HomePreview';
import type content from '@/config/public-site.json';
import styles from './HomeStory.module.css';

export type HomeStoryCopy = typeof content.homeStory;

export default function HomeStory({
  copy,
  preview,
}: {
  copy: HomeStoryCopy;
  preview: typeof content.homeExperience;
}) {
  const { t } = useTranslation();

  return (
    <div className={styles.story}>
      <section data-reveal="slide" className={styles.problem}>
        <div className={styles.heading}>
          <span>{t(copy.problem.eyebrow)}</span>
          <h2>{t(copy.problem.title)}</h2>
          <p>{t(copy.problem.description)}</p>
        </div>
        <div className={styles.comparison}>
          <article>
            <h3>{t(copy.problem.beforeTitle)}</h3>
            {copy.problem.before.map((text) => (
              <p key={text}>
                <RemoveCircleOutline />
                {t(text)}
              </p>
            ))}
          </article>
          <div className={styles.bridge} aria-hidden="true">
            <ArrowForward />
          </div>
          <article>
            <h3>{t(copy.problem.afterTitle)}</h3>
            {copy.problem.after.map((text) => (
              <p key={text}>
                <CheckCircleOutline />
                {t(text)}
              </p>
            ))}
          </article>
        </div>
      </section>
      <section data-reveal="perspective" className={styles.platform} id="platform">
        <div className={styles.heading}>
          <span>{t(copy.platform.eyebrow)}</span>
          <h2>{t(copy.platform.title)}</h2>
          <p>{t(copy.platform.description)}</p>
          <div className={styles.flow} aria-hidden="true">
            {copy.stages.map((stage) => (
              <span key={stage.id}>
                {t(stage.label)}
                <ArrowForward />
              </span>
            ))}
          </div>
        </div>
        <HomePreview copy={preview} />
      </section>
      <section data-reveal="scale" className={styles.intelligence}>
        <div className={styles.intelligenceArt} aria-hidden="true">
          <div className={styles.brainRing} />
          <div className={styles.brainRing} />
          <div className={styles.brainCore}>
            <AutoAwesomeOutlined />
          </div>
        </div>
        <div>
          <div className={styles.heading}>
            <span>{t(copy.intelligence.eyebrow)}</span>
            <h2>{t(copy.intelligence.title)}</h2>
            <p>{t(copy.intelligence.description)}</p>
          </div>
          <div data-reveal="rise" data-stagger className={styles.insights}>
            {copy.intelligence.cards.map((card) => (
              <article data-pointer="glow" key={card.title}>
                <h3>{t(card.title)}</h3>
                <p>{t(card.description)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section data-reveal="rise" className={styles.journey}>
        <div className={styles.heading}>
          <span>{t(preview.workflowEyebrow)}</span>
          <h2>{t(preview.workflowTitle)}</h2>
          <p>{t(preview.workflowDescription)}</p>
        </div>
        <div data-reveal="rise" data-stagger className={styles.trustGrid}>
          {preview.steps.map((step) => (
            <article data-pointer="glow" key={step.number}>
              <span className={styles.stepNumber}>{step.number}</span>
              <h3>{t(step.title)}</h3>
              <p>{t(step.description)}</p>
            </article>
          ))}
        </div>
      </section>
      <section data-reveal="slide" className={styles.delivery}>
        <div className={styles.heading}>
          <span>{t(copy.delivery.eyebrow)}</span>
          <h2>{t(copy.delivery.title)}</h2>
          <p>{t(copy.delivery.description)}</p>
        </div>
        <ol data-reveal="rise" data-stagger className={styles.timeline}>
          {copy.delivery.steps.map((step) => (
            <li key={step.title}>
              <h3>{t(step.title)}</h3>
              <p>{t(step.description)}</p>
            </li>
          ))}
        </ol>
      </section>
      <section data-reveal="scale" className={styles.trust}>
        <div className={styles.heading}>
          <span>{t(copy.trust.eyebrow)}</span>
          <h2>{t(copy.trust.title)}</h2>
        </div>
        <div data-reveal="rise" data-stagger className={styles.trustGrid}>
          {copy.trust.items.map((item) => (
            <article data-pointer="glow" key={item.title}>
              <ShieldOutlined />
              <h3>{t(item.title)}</h3>
              <p>{t(item.description)}</p>
            </article>
          ))}
        </div>
      </section>
      <section data-reveal="rise" className={styles.faq} id="faq">
        <div className={styles.heading}>
          <span>{t(copy.faq.eyebrow)}</span>
          <h2>{t(copy.faq.title)}</h2>
        </div>
        <div>
          {copy.faq.items.map((item) => (
            <details key={item.question}>
              <summary>
                {t(item.question)}
                <span aria-hidden="true" />
              </summary>
              <p>{t(item.answer)}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
