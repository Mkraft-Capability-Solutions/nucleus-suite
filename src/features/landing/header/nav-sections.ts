/** In-page sections linked from the header, in page order (shared by the server header and the SectionNav island). */
export const NAV_SECTIONS = ['platform', 'ai', 'volt', 'roi', 'security', 'faq'] as const;
export type NavSection = (typeof NAV_SECTIONS)[number];
