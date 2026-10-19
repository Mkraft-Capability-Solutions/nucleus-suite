/**
 * Nucleus AI review checker (React-free): language rules built per locale from the "nucleus" catalog
 * (ai.review.rules.<id>.terms, pipe-separated words; a trailing * matches inflected forms), and the checker that
 * highlights flagged words and scores the draft's clarity.
 */
import type { LandingText } from '../i18n/landing-text';

export const REVIEW_RULE_IDS = ['abrasive', 'aggressive', 'bossy', 'emotional', 'teamPlayer', 'cultureFit', 'attitude', 'personal', 'hardworking', 'absolutes', 'softeners'] as const;
export type ReviewRuleId = (typeof REVIEW_RULE_IDS)[number];

/** Languages written without spaces between words (terms match anywhere, no word boundaries). */
const UNSPACED = new Set(['zh', 'ja']);

export interface ReviewRule {
  readonly id: ReviewRuleId;
  readonly name: string;
  readonly tip: string;
  readonly pattern: RegExp;
}

export interface ReviewFlag {
  readonly id: ReviewRuleId;
  readonly name: string;
  readonly tip: string;
  readonly count: number;
}

export interface ReviewSegment {
  readonly text: string;
  readonly mark: boolean;
}

export interface ReviewResult {
  readonly segments: readonly ReviewSegment[];
  readonly flags: readonly ReviewFlag[];
  readonly score: number;
  readonly hasEvidence: boolean;
}

export function termPattern(terms: string, code = 'en'): RegExp {
  const alternatives = terms
    .split('|')
    .map((term) => term.trim())
    .filter(Boolean)
    .map((term) => {
      const stem = term.endsWith('*');
      const body = (stem ? term.slice(0, -1) : term).replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`).replaceAll(/\s+/g, String.raw`\s+`);
      return stem ? `${body}[\\p{L}\\p{M}]*` : body;
    });
  const group = `(?:${alternatives.join('|') || '(?!)'})`;
  return new RegExp(UNSPACED.has(code) ? group : `(?<![\\p{L}\\p{M}\\p{N}_])${group}(?![\\p{L}\\p{M}\\p{N}_])`, 'giu');
}

export function buildReviewRules(t: LandingText): readonly ReviewRule[] {
  return REVIEW_RULE_IDS.map((id) => ({
    id,
    name: t(`ai.review.rules.${id}.name`),
    tip: t(`ai.review.rules.${id}.tip`),
    pattern: termPattern(t(`ai.review.rules.${id}.terms`), t.locale),
  }));
}

export function checkReview(text: string, rules: readonly ReviewRule[]): ReviewResult {
  const flags: ReviewFlag[] = [];
  const ranges: [number, number][] = [];
  for (const rule of rules) {
    const matches = [...text.matchAll(rule.pattern)];
    if (matches.length === 0) continue;
    flags.push({ id: rule.id, name: rule.name, tip: rule.tip, count: matches.length });
    for (const match of matches) ranges.push([match.index, match.index + match[0].length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const segments: ReviewSegment[] = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start < cursor) continue;
    if (start > cursor) segments.push({ text: text.slice(cursor, start), mark: false });
    segments.push({ text: text.slice(start, end), mark: true });
    cursor = end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), mark: false });
  const hasEvidence = /\p{N}/u.test(text);
  const penalty = flags.reduce((total, flag) => total + (flag.id === 'softeners' ? 6 : 16) * flag.count, 0);
  const score = text.trim() ? Math.max(5, 100 - penalty - (hasEvidence ? 0 : 10)) : 0;
  return { segments, flags, score, hasEvidence };
}

/** Band a clarity score for its meter and number colours. */
export function scoreTone(score: number): 'good' | 'mid' | 'low' {
  if (score > 75) return 'good';
  if (score > 45) return 'mid';
  return 'low';
}
