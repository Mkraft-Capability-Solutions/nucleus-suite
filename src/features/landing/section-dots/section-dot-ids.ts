/** Every landing section reachable from the dot rail, in page order (ids are the sections' in-page anchors). */
export const SECTION_DOTS = [
  'top',
  'story',
  'flow',
  'ba',
  'platform',
  'roles',
  'ai',
  'volt',
  'roi',
  'security',
  'implementation',
  'faq',
  'demo',
] as const;
export type SectionDot = (typeof SECTION_DOTS)[number];
