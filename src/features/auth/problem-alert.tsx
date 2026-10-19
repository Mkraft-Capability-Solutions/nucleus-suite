/**
 * Live error region for API failures: always rendered (so screen readers register it before it fills), hidden while
 * empty. Shows the problem's localised `title` and `detail` from the API, or one client message (network, HTTP status).
 */
import type { ReactNode } from 'react';
import type { ApiFailure } from './api-problem';
import styles from './problem-alert.module.css';

export interface AlertMessage {
  readonly title?: string;
  readonly detail?: string;
}

/** Client-side texts for failures that carry no problem body. */
export interface FailureTexts {
  readonly network: string;
  readonly unexpected: (status: number) => string;
}

export function alertOf(failure: ApiFailure, texts: FailureTexts): AlertMessage {
  if (failure.kind === 'network-error') return { detail: texts.network };
  if (failure.kind === 'http-error') return { detail: texts.unexpected(failure.status) };
  const { title, detail } = failure.problem;
  return { ...(title ? { title } : {}), ...(detail ? { detail } : {}) };
}

export interface ProblemAlertProps {
  readonly id: string;
  readonly message: AlertMessage | null;
}

export function ProblemAlert({ id, message }: ProblemAlertProps): ReactNode {
  return (
    <div id={id} className={styles.alert} role="alert" aria-live="assertive" aria-atomic="true">
      {message?.title ? <strong className={styles.title}>{message.title}</strong> : null}
      {message?.detail ? <span className={styles.detail}>{message.detail}</span> : null}
    </div>
  );
}
