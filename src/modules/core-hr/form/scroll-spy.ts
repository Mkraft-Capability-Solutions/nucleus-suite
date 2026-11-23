/**
 * Scroll spy for the employee form: which section the person is reading. A section becomes current
 * once its top passes a reading line a little below the top of the scroll area; at the very bottom
 * the last section is current even if it is too short to reach that line.
 */
export type SectionOffset = { id: string; top: number };

export function currentSection(
  sections: readonly SectionOffset[],
  view: { scrollTop: number; clientHeight: number; scrollHeight: number },
  readingLine = Math.min(120, view.clientHeight * 0.25),
): string | null {
  if (sections.length === 0) return null;
  if (view.scrollTop + view.clientHeight >= view.scrollHeight - 2) return sections[sections.length - 1]!.id;
  let current = sections[0]!.id;
  for (const section of sections) {
    if (section.top <= view.scrollTop + readingLine) current = section.id;
    else break;
  }
  return current;
}
