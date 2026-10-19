'use client';

/**
 * Log in form: work email + password with show/hide, client validation on submit (fields marked aria-invalid and
 * described by their error), a submit button with a loading state, and an aria-live error region that shows the
 * API's RFC 9457 problem title and detail (or the real HTTP status) when log in fails.
 *
 * `onBusyChange` drives the Nucleus scene: true on submit; it stays true after success while the workspace loads
 * (the scene hands its phase to the workspace loading state), and turns false on failure so the scene eases back.
 */
import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import authCatalog from '@/i18n/catalogs/auth';
import type { MessageKey } from '@/i18n/catalog';
import type { AuthMessages } from '@/i18n/catalogs/auth/en';
import { DEFAULT_LOCALE } from '@/i18n/locales';
import { useTranslations } from '@/i18n/use-translations';
import { logIn } from './log-in-request';
import { ProblemAlert, alertOf, type AlertMessage } from './problem-alert';
import styles from './log-in.module.css';

type AuthKey = MessageKey<AuthMessages>;

/** Pragmatic address check (one @, a dot in the domain, no spaces); the API is the authority. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Where a successful log in lands. */
const AFTER_LOG_IN_PATH = '/workspace';

interface FieldErrors {
  readonly email?: AuthKey;
  readonly password?: AuthKey;
}

function validate(email: string, password: string): FieldErrors {
  const trimmed = email.trim();
  return {
    ...(trimmed === '' ? { email: 'errors.emailRequired' } : EMAIL_PATTERN.test(trimmed) ? {} : { email: 'errors.emailInvalid' }),
    ...(password === '' ? { password: 'errors.passwordRequired' } : {}),
  };
}

export interface LogInFormProps {
  readonly onBusyChange: (busy: boolean) => void;
}

export function LogInForm({ onBusyChange }: LogInFormProps): ReactNode {
  const t = useTranslations(authCatalog);
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();
  const emailErrorId = useId();
  const passwordErrorId = useId();
  const formErrorId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<AlertMessage | null>(null);
  const [status, setStatus] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    const errors = validate(email, password);
    setFieldErrors(errors);
    setFormError(null);
    if (errors.email) {
      emailRef.current?.focus();
      return;
    }
    if (errors.password) {
      passwordRef.current?.focus();
      return;
    }
    setSubmitting(true);
    setStatus('');
    onBusyChange(true);
    const outcome = await logIn(email.trim(), password, document.documentElement.lang || DEFAULT_LOCALE);
    if (outcome.kind === 'success') {
      // Stay busy: the scene keeps revolving through the workspace loading state until the page has loaded.
      setStatus(t('status.signedIn'));
      router.push(AFTER_LOG_IN_PATH);
      return;
    }
    setSubmitting(false);
    onBusyChange(false);
    setFormError(alertOf(outcome, { network: t('errors.network'), unexpected: (code) => t('errors.unexpected', { status: code }) }));
    passwordRef.current?.focus();
    passwordRef.current?.select();
  }

  return (
    <form className={styles.form} noValidate onSubmit={(event) => {
        void onSubmit(event);
      }} aria-describedby={formError ? formErrorId : undefined}>
      <ProblemAlert id={formErrorId} message={formError} />
      <p className={styles.visuallyHidden} role="status" aria-live="polite">
        {status}
      </p>

      <div className={styles.field}>
        <label htmlFor={emailId} className={styles.label}>
          {t('email.label')}
        </label>
        <input
          ref={emailRef}
          id={emailId}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          spellCheck={false}
          required
          className={styles.input}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={fieldErrors.email ? emailErrorId : undefined}
        />
        {fieldErrors.email ? (
          <p id={emailErrorId} className={styles.fieldError}>
            {t(fieldErrors.email)}
          </p>
        ) : null}
      </div>

      <div className={styles.field}>
        <div className={styles.labelRow}>
          <label htmlFor={passwordId} className={styles.label}>
            {t('password.label')}
          </label>
          <Link href="/login/forgot-password" prefetch={false} className={styles.link}>
            {t('forgot')}
          </Link>
        </div>
        <div className={styles.passwordWrap}>
          <input
            ref={passwordRef}
            id={passwordId}
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            className={styles.input}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby={fieldErrors.password ? passwordErrorId : undefined}
          />
          <button
            type="button"
            className={styles.reveal}
            onClick={() => {
              setShowPassword((value) => !value);
            }}
            aria-pressed={showPassword}
            aria-label={showPassword ? t('password.hide') : t('password.show')}
            aria-controls={passwordId}
          >
            {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </button>
        </div>
        {fieldErrors.password ? (
          <p id={passwordErrorId} className={styles.fieldError}>
            {t(fieldErrors.password)}
          </p>
        ) : null}
      </div>

      <button type="submit" className={styles.submit} aria-busy={submitting || undefined} disabled={submitting}>
        {submitting ? <LoaderCircle aria-hidden="true" className={styles.spinner} /> : null}
        <span>{submitting ? t('submitting') : t('submit')}</span>
      </button>
    </form>
  );
}
