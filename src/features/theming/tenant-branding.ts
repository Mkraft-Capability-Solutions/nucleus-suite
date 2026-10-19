/**
 * Tenant branding: what a tenant admin may customise after sign-in (theme, default mode, display name, logo for light
 * and dark backgrounds) and the validation applied before it is saved. Fonts, colours outside the seven themes and
 * contrast are not customisable: the design system guarantees them.
 *
 * Validation returns stable UPPER_SNAKE error codes plus the theming catalog key that explains each one, so the API
 * and the UI agree on codes while the text stays translatable.
 */
import { isModePreference, isThemeId, type ModePreference, type ThemeId } from '@nucleus/design-tokens';
import type { MessageKey, MessageValues } from '@/i18n/catalog';
import type { ThemingMessages } from '@/i18n/catalogs/theming/en';

export const LOGO_MIME_TYPES = ['image/svg+xml', 'image/png'] as const;
export type LogoMimeType = (typeof LOGO_MIME_TYPES)[number];

/** Logo limits (see docs/guidelines/design-system.md, "Tenant branding"). */
export const LOGO_RULES = {
  /** SVG is preferred; after SVGO it must stay small (performance budget). */
  maxSvgBytes: 20 * 1024,
  maxPngBytes: 200 * 1024,
  /** PNG must be at least 2× the 24px minimum rendered height for sharp display on high-density screens. */
  minPngHeightPx: 48,
  /** Width ÷ height. Square marks up to wide wordmarks. */
  minAspectRatio: 1,
  maxAspectRatio: 6,
} as const;

export const DISPLAY_NAME_MAX_LENGTH = 60;

export interface LogoAsset {
  readonly url: string;
  readonly mimeType: LogoMimeType;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly bytes: number;
}

export interface TenantBranding {
  readonly themeId: ThemeId;
  readonly defaultMode: ModePreference;
  readonly displayName: string;
  /** Logo for light backgrounds; the Nucleus logo is shown when absent. */
  readonly logoLight?: LogoAsset;
  /** Logo for dark backgrounds; falls back to logoLight, then the Nucleus logo. */
  readonly logoDark?: LogoAsset;
}

export type BrandingErrorCode =
  | 'THEME_ID_INVALID'
  | 'DEFAULT_MODE_INVALID'
  | 'DISPLAY_NAME_INVALID'
  | 'LOGO_TYPE_INVALID'
  | 'LOGO_TOO_LARGE'
  | 'LOGO_TOO_SMALL'
  | 'LOGO_ASPECT_INVALID'
  | 'LOGO_UNSAFE';

export interface BrandingError {
  readonly field: keyof TenantBranding;
  readonly code: BrandingErrorCode;
  readonly messageKey: MessageKey<ThemingMessages>;
  readonly values?: MessageValues;
}

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly BrandingError[] };

function isLogoMimeType(value: unknown): value is LogoMimeType {
  return typeof value === 'string' && (LOGO_MIME_TYPES as readonly string[]).includes(value);
}

/** Script, event handlers, foreign objects and external references are not allowed in tenant SVGs. */
const UNSAFE_SVG = /<script|<foreignObject|\son[a-z]+\s*=|(?:href|src)\s*=\s*["']\s*(?:https?:|\/\/|javascript:|data:text)/i;

/** Validate one logo's metadata (and, for SVG, its markup when available). */
export function validateLogo(field: 'logoLight' | 'logoDark', logo: LogoAsset, svgMarkup?: string): BrandingError[] {
  const errors: BrandingError[] = [];
  if (!isLogoMimeType(logo.mimeType)) {
    return [{ field, code: 'LOGO_TYPE_INVALID', messageKey: 'branding.errors.logoType' }];
  }
  const isSvg = logo.mimeType === 'image/svg+xml';
  const maxBytes = isSvg ? LOGO_RULES.maxSvgBytes : LOGO_RULES.maxPngBytes;
  if (logo.bytes > maxBytes) {
    errors.push({ field, code: 'LOGO_TOO_LARGE', messageKey: 'branding.errors.logoSize', values: { max: maxBytes / 1024 } });
  }
  if (!isSvg && logo.heightPx < LOGO_RULES.minPngHeightPx) {
    errors.push({ field, code: 'LOGO_TOO_SMALL', messageKey: 'branding.errors.logoHeight', values: { min: LOGO_RULES.minPngHeightPx } });
  }
  const ratio = logo.heightPx > 0 ? logo.widthPx / logo.heightPx : 0;
  if (ratio < LOGO_RULES.minAspectRatio || ratio > LOGO_RULES.maxAspectRatio) {
    errors.push({ field, code: 'LOGO_ASPECT_INVALID', messageKey: 'branding.errors.logoAspect', values: { max: LOGO_RULES.maxAspectRatio } });
  }
  if (isSvg && svgMarkup !== undefined && UNSAFE_SVG.test(svgMarkup)) {
    errors.push({ field, code: 'LOGO_UNSAFE', messageKey: 'branding.errors.logoUnsafe' });
  }
  return errors;
}

/** Validate a complete branding record before it is saved. */
export function validateTenantBranding(input: TenantBranding): ValidationResult<TenantBranding> {
  const errors: BrandingError[] = [];
  if (!isThemeId(input.themeId)) errors.push({ field: 'themeId', code: 'THEME_ID_INVALID', messageKey: 'branding.errors.themeId' });
  if (!isModePreference(input.defaultMode)) {
    errors.push({ field: 'defaultMode', code: 'DEFAULT_MODE_INVALID', messageKey: 'branding.errors.defaultMode' });
  }
  const name = input.displayName.trim();
  if (name.length === 0 || name.length > DISPLAY_NAME_MAX_LENGTH) {
    errors.push({
      field: 'displayName',
      code: 'DISPLAY_NAME_INVALID',
      messageKey: 'branding.errors.displayName',
      values: { max: DISPLAY_NAME_MAX_LENGTH },
    });
  }
  if (input.logoLight) errors.push(...validateLogo('logoLight', input.logoLight));
  if (input.logoDark) errors.push(...validateLogo('logoDark', input.logoDark));
  return errors.length === 0 ? { ok: true, value: { ...input, displayName: name } } : { ok: false, errors };
}
