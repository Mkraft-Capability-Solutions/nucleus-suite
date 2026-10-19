'use client';

/**
 * The footer's newsletter sign-up (same fields and states as the MultipliersKraft footer): email field with the
 * subscribe button inside, a hint, and a status line (role="status") for success or a localized error.
 */
import { useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, Mail } from 'lucide-react';
import { useLandingText } from '../i18n/use-landing-text';
import { subscribeNewsletter } from './subscribe-newsletter';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Status = 'idle' | 'busy' | 'done' | 'error';

export function NewsletterForm(): ReactNode {
  const t = useLandingText();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!EMAIL.test(email.trim())) {
      setStatus('error');
      return;
    }
    setStatus('busy');
    try {
      await subscribeNewsletter(email.trim());
      setStatus('done');
      setEmail('');
    } catch {
      setStatus('error');
    }
  };

  const invalidEmail = status === 'error' && !EMAIL.test(email.trim());
  const message = status === 'done' ? t('footer.news.done') : status === 'error' ? t(invalidEmail ? 'footer.news.invalid' : 'footer.news.failed') : '';

  return (
    <form className="ft-news" onSubmit={(event) => void submit(event)} noValidate>
      <label htmlFor="ft-news-email" className="ft-news-label">
        <Mail aria-hidden="true" />
        {t('footer.news.label')}
      </label>
      <div className="ft-news-field" data-error={status === 'error' ? '' : undefined}>
        <input
          id="ft-news-email"
          type="email"
          dir="ltr"
          autoComplete="email"
          placeholder={t('footer.news.placeholder')}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
          aria-invalid={status === 'error'}
          aria-describedby="ft-news-hint ft-news-status"
          maxLength={254}
        />
        <button type="submit" className="ft-news-go" disabled={status === 'busy'}>
          {status === 'busy' ? t('footer.news.sending') : t('footer.news.subscribe')}
          <ArrowRight aria-hidden="true" className="lp-flip-rtl" />
        </button>
      </div>
      <p id="ft-news-hint" className="ft-news-hint">
        {t('footer.news.hint')}
      </p>
      <p id="ft-news-status" className="ft-news-status" role="status" data-error={status === 'error' ? '' : undefined}>
        {message}
      </p>
    </form>
  );
}
