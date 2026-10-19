/**
 * SectionHeader: the kicker, heading and optional intro shared by the landing sections. One heading block
 * ([data-heading-block], gentle parallax); kicker, heading lines, gradient shimmer and intro follow the shared heading
 * timeline (motion/heading-timeline.ts, driven by useSectionMotion) exactly once, then stay visible.
 */
import type { ReactNode } from 'react';
import { SectionHeading } from '../components/section-heading';

export interface SectionHeaderProps {
  readonly kicker: string;
  /** Translated title; everything after its first sentence renders in the gradient emphasis (SectionHeading). */
  readonly title: string;
  readonly titleId: string;
  readonly lead?: string;
  readonly className?: string;
}

export function SectionHeader({ kicker, title, titleId, lead, className = 'head' }: SectionHeaderProps): ReactNode {
  return (
    <header className={className} data-heading-block="">
      <span className="lp-kicker" data-heading-kicker="">
        {kicker}
      </span>
      <SectionHeading text={title} id={titleId} />
      {lead ? (
        <p className="lp-lead" data-heading-intro="">
          {lead}
        </p>
      ) : null}
    </header>
  );
}
