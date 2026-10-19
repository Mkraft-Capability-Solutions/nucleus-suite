/**
 * splitAtFirstBreak: where a section heading's gradient emphasis starts (pure, unit-tested in heading-split.test.ts).
 * The title splits after the FIRST break, whichever comes first:
 *   - a comma: "," and Arabic "،" followed by a space; CJK "、" "，" "﹐" with or without one;
 *   - a sentence end: Latin, Cyrillic and Greek ". ! ? …", Devanagari / Bengali "।" "॥", Arabic "؟" ".", Urdu "۔",
 *     Armenian "։", Ethiopic "።" followed by a space; CJK "。" "！" "？" "｡" with or without one.
 * Closing quotes and brackets right after the mark stay with the first part. A title without a break (or with nothing
 * after it) has no emphasis part.
 */

/** Marks that end a part only when a space follows. */
const SPACED = new Set([',', '،', '.', '!', '?', '…', '।', '॥', '؟', '۔', '։', '።']);
/** Marks that end a part with or without a following space (Chinese, Japanese, full-width forms). */
const UNSPACED = new Set(['、', '，', '﹐', '。', '！', '？', '｡']);
const CLOSERS = new Set(['"', '\'', '”', '“', '’', '‘', '»', ')', '」', '』', '）']);

export interface HeadingParts {
  readonly lead: string;
  readonly emphasis: string;
}

export function splitAtFirstBreak(text: string): HeadingParts {
  const chars = Array.from(text.trim());
  for (let index = 0; index < chars.length - 1; index++) {
    const char = chars[index] ?? '';
    if (!SPACED.has(char) && !UNSPACED.has(char)) continue;
    let end = index + 1;
    while (end < chars.length && CLOSERS.has(chars[end] ?? '')) end++;
    if (UNSPACED.has(char) || /\s/u.test(chars[end] ?? '')) {
      const lead = chars.slice(0, end).join('');
      const emphasis = chars.slice(end).join('').trim();
      if (emphasis) return { lead, emphasis };
    }
  }
  return { lead: text.trim(), emphasis: '' };
}
