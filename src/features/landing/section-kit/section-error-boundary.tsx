'use client';

/**
 * SectionErrorBoundary: if a landing section throws while rendering, show its heading and intro (from the catalog)
 * instead of a blank band, and report the error through reportLandingError (no console). The rest of the page keeps
 * working.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import type { LandingKey } from '../i18n/landing-text';
import { useLandingText } from '../i18n/use-landing-text';
import { SectionHeading } from '../components/section-heading';
import { reportLandingError } from './report-error';

export interface SectionFallbackCopy {
  readonly id?: string;
  readonly title: LandingKey;
  readonly lead?: LandingKey;
}

function SectionFallback({ copy }: { readonly copy: SectionFallbackCopy }): ReactNode {
  const t = useLandingText();
  return (
    <section className="lp-section lp-section-fallback" id={copy.id}>
      <div className="lp-wrap">
        <SectionHeading text={t(copy.title)} />
        {copy.lead ? <p className="lp-lead">{t(copy.lead)}</p> : null}
      </div>
    </section>
  );
}

interface Props {
  readonly name: string;
  readonly copy: SectionFallbackCopy;
  readonly children: ReactNode;
}

interface State {
  readonly failed: boolean;
}

export class SectionErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    reportLandingError(`section:${this.props.name}`, { error, componentStack: info.componentStack });
  }

  override render(): ReactNode {
    return this.state.failed ? <SectionFallback copy={this.props.copy} /> : this.props.children;
  }
}
