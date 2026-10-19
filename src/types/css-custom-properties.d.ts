/**
 * The CSS custom properties components may set inline (style={{ ... }}). Declaring them here keeps inline styles fully
 * typed (no casts) and makes every inline custom property reviewable in one place. Values are always token references
 * or registry font names, never colour literals.
 */
import 'react';

declare module 'react' {
  interface CSSProperties {
    /** Script face of the active locale (src/i18n/locales.ts). */
    '--font-script'?: string;
    /** UI face override for locales that need full Inter (src/i18n/locales.ts). */
    '--font-ui-face'?: string;
    /** Landing hero chaos label anchor: −1…1 of the stage's free half-width (src/features/landing/hero/hero-geometry.ts). */
    '--lp-chaos-x'?: string;
    /** Landing hero chaos label anchor: −1…1 of the stage's free half-height. */
    '--lp-chaos-y'?: string;
  }
}
