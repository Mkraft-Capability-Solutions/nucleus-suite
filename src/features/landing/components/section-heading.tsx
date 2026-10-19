/**
 * SectionHeading: the one heading style for every landing section. The translated title is split at its FIRST break,
 * a comma or a sentence end, whichever comes first (splitAtFirstBreak, locale-aware): the first part renders plain,
 * everything after it in the gradient italic emphasis ("Eight modules. *One brain. Zero re-entry.*", "Questions,
 * *answered.*"). A title without a break has no emphasis part; no word is ever dropped or reworded. Words sit in masks
 * so each line rises into place as the heading scrolls in, then a light band crosses the gradient words
 * ([data-em-shimmer], clipped to each word's mask). Scroll-scrubbed and reversible (motion/scroll-reveal.ts, driven by
 * useSectionMotion). Server-safe (no hooks); fonts and sizes come from .lp-h2 (display face, shared scale).
 */
import { createElement, Fragment, type ReactNode } from 'react';
import { splitAtFirstBreak } from './heading-split';

export interface SectionHeadingProps {
  /** The translated title (plain text). */
  readonly text: string;
  readonly as?: 'h1' | 'h2' | 'h3' | 'p';
  readonly id?: string;
  readonly className?: string;
}

function words(text: string, emphasis: boolean, start: number): ReactNode[] {
  const out: ReactNode[] = [];
  let key = start;
  for (const part of text.split(/(\s+)/u)) {
    if (part === '') continue;
    if (/^\s+$/u.test(part)) {
      out.push(<Fragment key={key++}> </Fragment>);
      continue;
    }
    out.push(
      <span key={key++} className={emphasis ? 'lp-split-mask lp-split-mask-em' : 'lp-split-mask'}>
        <span className={emphasis ? 'lp-split-word lp-grad' : 'lp-split-word'}>{part}</span>
        {emphasis ? <span className="lp-em-shimmer" data-em-shimmer="" aria-hidden="true" /> : null}
      </span>,
    );
  }
  return out;
}

export function SectionHeading({ text, as = 'h2', id, className = 'lp-h2' }: SectionHeadingProps): ReactNode {
  const { lead, emphasis } = splitAtFirstBreak(text);
  const leadWords = words(lead, false, 0);
  const children = emphasis ? [...leadWords, <Fragment key="gap"> </Fragment>, ...words(emphasis, true, leadWords.length + 1)] : leadWords;
  return createElement(as, { id, className: `${className} lp-split`, 'data-split-heading': '' }, children);
}
