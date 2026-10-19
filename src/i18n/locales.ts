/**
 * The locale registry: the ONLY place the list of supported languages exists. Everything else (html lang/dir, script
 * fonts, Intl formatting, catalog loading, the i18n checker, the landing page's URL prefixes) derives from it.
 *
 * Owner decision 2026-10-19: 30 locales, the 15 most used Indian languages and the 15 most used international ones.
 * English is the source language; every other catalog is produced by a scripted translation pipeline and MUST be
 * reviewed by a native speaker before release. Missing keys fall back to English at runtime and are reported by
 * `pnpm --filter @nucleus/web check:i18n`.
 *
 * Codes are ISO 639-1 where one exists, ISO 639-2/3 otherwise (mai, kok, sat). `intl` is the preferred Intl locale;
 * when the runtime has no data for it (e.g. sat-IN) `intlFallback` is used instead (see resolveIntlLocale).
 */

/** ISO 15924 script codes used by the supported locales. */
export type ScriptCode =
  | 'Latn'
  | 'Cyrl'
  | 'Arab'
  | 'Deva'
  | 'Beng'
  | 'Telu'
  | 'Taml'
  | 'Gujr'
  | 'Guru'
  | 'Knda'
  | 'Orya'
  | 'Mlym'
  | 'Olck'
  | 'Hans'
  | 'Jpan'
  | 'Kore'
  | 'Thai';

export type TextDirection = 'ltr' | 'rtl';
export type LocaleRegion = 'india' | 'international';

export interface LocaleDefinition {
  /** Catalog code and URL prefix (lowercase ISO 639). */
  readonly code: string;
  /** BCP 47 tag for <html lang>, hreflang and Intl. */
  readonly tag: string;
  readonly englishName: string;
  /** Endonym, shown in the language switcher. Not translated (a language is always shown in its own name). */
  readonly nativeName: string;
  readonly dir: TextDirection;
  readonly script: ScriptCode;
  /**
   * CSS family of the script font that must precede the system fallbacks (value of `--font-script` on <html>), or null
   * when Inter covers the script (Latin incl. Vietnamese and latin-ext, Cyrillic).
   */
  readonly fontFamily: string | null;
  readonly intl: string;
  readonly intlFallback: string;
  /** Open Graph locale. */
  readonly og: string;
  /**
   * Which Inter face renders the UI text. `preloaded`: the preloaded Latin subset (next/font, metric-matched Arial
   * fallback) is enough. `extended`: the language needs glyphs outside that subset that Arial would otherwise render
   * (latin-ext, Vietnamese, Cyrillic, Arabic), so the full unicode-range sliced Inter is loaded for this locale and used
   * instead (see locale-fonts.ts and localeFontStyle).
   */
  readonly uiFace: 'preloaded' | 'extended';
  readonly region: LocaleRegion;
}

const DEVANAGARI = 'Noto Sans Devanagari Variable';
const BENGALI = 'Noto Sans Bengali Variable';

export const LOCALES = [
  { code: 'en', tag: 'en', englishName: 'English', nativeName: 'English', dir: 'ltr', script: 'Latn', fontFamily: null, intl: 'en-IN', intlFallback: 'en', og: 'en_IN', uiFace: 'preloaded', region: 'international' },
  { code: 'hi', tag: 'hi', englishName: 'Hindi', nativeName: 'हिन्दी', dir: 'ltr', script: 'Deva', fontFamily: DEVANAGARI, intl: 'hi-IN', intlFallback: 'en-IN', og: 'hi_IN', uiFace: 'preloaded', region: 'india' },
  { code: 'bn', tag: 'bn', englishName: 'Bengali', nativeName: 'বাংলা', dir: 'ltr', script: 'Beng', fontFamily: BENGALI, intl: 'bn-IN', intlFallback: 'en-IN', og: 'bn_IN', uiFace: 'preloaded', region: 'india' },
  { code: 'mr', tag: 'mr', englishName: 'Marathi', nativeName: 'मराठी', dir: 'ltr', script: 'Deva', fontFamily: DEVANAGARI, intl: 'mr-IN', intlFallback: 'en-IN', og: 'mr_IN', uiFace: 'preloaded', region: 'india' },
  { code: 'te', tag: 'te', englishName: 'Telugu', nativeName: 'తెలుగు', dir: 'ltr', script: 'Telu', fontFamily: 'Noto Sans Telugu Variable', intl: 'te-IN', intlFallback: 'en-IN', og: 'te_IN', uiFace: 'preloaded', region: 'india' },
  { code: 'ta', tag: 'ta', englishName: 'Tamil', nativeName: 'தமிழ்', dir: 'ltr', script: 'Taml', fontFamily: 'Noto Sans Tamil Variable', intl: 'ta-IN', intlFallback: 'en-IN', og: 'ta_IN', uiFace: 'preloaded', region: 'india' },
  { code: 'gu', tag: 'gu', englishName: 'Gujarati', nativeName: 'ગુજરાતી', dir: 'ltr', script: 'Gujr', fontFamily: 'Noto Sans Gujarati Variable', intl: 'gu-IN', intlFallback: 'en-IN', og: 'gu_IN', uiFace: 'preloaded', region: 'india' },
  { code: 'pa', tag: 'pa', englishName: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', dir: 'ltr', script: 'Guru', fontFamily: 'Noto Sans Gurmukhi Variable', intl: 'pa-IN', intlFallback: 'en-IN', og: 'pa_IN', uiFace: 'preloaded', region: 'india' },
  { code: 'kn', tag: 'kn', englishName: 'Kannada', nativeName: 'ಕನ್ನಡ', dir: 'ltr', script: 'Knda', fontFamily: 'Noto Sans Kannada Variable', intl: 'kn-IN', intlFallback: 'en-IN', og: 'kn_IN', uiFace: 'preloaded', region: 'india' },
  { code: 'or', tag: 'or', englishName: 'Odia', nativeName: 'ଓଡ଼ିଆ', dir: 'ltr', script: 'Orya', fontFamily: 'Noto Sans Oriya Variable', intl: 'or-IN', intlFallback: 'en-IN', og: 'or_IN', uiFace: 'preloaded', region: 'india' },
  { code: 'ml', tag: 'ml', englishName: 'Malayalam', nativeName: 'മലയാളം', dir: 'ltr', script: 'Mlym', fontFamily: 'Noto Sans Malayalam Variable', intl: 'ml-IN', intlFallback: 'en-IN', og: 'ml_IN', uiFace: 'preloaded', region: 'india' },
  { code: 'as', tag: 'as', englishName: 'Assamese', nativeName: 'অসমীয়া', dir: 'ltr', script: 'Beng', fontFamily: BENGALI, intl: 'as-IN', intlFallback: 'en-IN', og: 'as_IN', uiFace: 'preloaded', region: 'india' },
  { code: 'mai', tag: 'mai', englishName: 'Maithili', nativeName: 'मैथिली', dir: 'ltr', script: 'Deva', fontFamily: DEVANAGARI, intl: 'mai-IN', intlFallback: 'hi-IN', og: 'mai_IN', uiFace: 'preloaded', region: 'india' },
  { code: 'ne', tag: 'ne', englishName: 'Nepali', nativeName: 'नेपाली', dir: 'ltr', script: 'Deva', fontFamily: DEVANAGARI, intl: 'ne-IN', intlFallback: 'en-IN', og: 'ne_IN', uiFace: 'preloaded', region: 'india' },
  { code: 'kok', tag: 'kok', englishName: 'Konkani', nativeName: 'कोंकणी', dir: 'ltr', script: 'Deva', fontFamily: DEVANAGARI, intl: 'kok-IN', intlFallback: 'en-IN', og: 'kok_IN', uiFace: 'preloaded', region: 'india' },
  { code: 'sat', tag: 'sat', englishName: 'Santali', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ', dir: 'ltr', script: 'Olck', fontFamily: 'Noto Sans Ol Chiki Variable', intl: 'sat-IN', intlFallback: 'en-IN', og: 'sat_IN', uiFace: 'preloaded', region: 'india' },
  { code: 'zh', tag: 'zh-CN', englishName: 'Chinese (Simplified)', nativeName: '简体中文', dir: 'ltr', script: 'Hans', fontFamily: 'Noto Sans SC Variable', intl: 'zh-CN', intlFallback: 'en', og: 'zh_CN', uiFace: 'preloaded', region: 'international' },
  { code: 'es', tag: 'es', englishName: 'Spanish', nativeName: 'Español', dir: 'ltr', script: 'Latn', fontFamily: null, intl: 'es', intlFallback: 'en', og: 'es_ES', uiFace: 'preloaded', region: 'international' },
  { code: 'ar', tag: 'ar', englishName: 'Arabic', nativeName: 'العربية', dir: 'rtl', script: 'Arab', fontFamily: 'Noto Sans Arabic Variable', intl: 'ar-u-nu-latn', intlFallback: 'en', og: 'ar_AR', uiFace: 'extended', region: 'international' },
  { code: 'fr', tag: 'fr', englishName: 'French', nativeName: 'Français', dir: 'ltr', script: 'Latn', fontFamily: null, intl: 'fr-FR', intlFallback: 'en', og: 'fr_FR', uiFace: 'preloaded', region: 'international' },
  { code: 'pt', tag: 'pt-BR', englishName: 'Portuguese (Brazil)', nativeName: 'Português', dir: 'ltr', script: 'Latn', fontFamily: null, intl: 'pt-BR', intlFallback: 'en', og: 'pt_BR', uiFace: 'preloaded', region: 'international' },
  { code: 'ru', tag: 'ru', englishName: 'Russian', nativeName: 'Русский', dir: 'ltr', script: 'Cyrl', fontFamily: null, intl: 'ru-RU', intlFallback: 'en', og: 'ru_RU', uiFace: 'extended', region: 'international' },
  { code: 'ja', tag: 'ja', englishName: 'Japanese', nativeName: '日本語', dir: 'ltr', script: 'Jpan', fontFamily: 'Noto Sans JP Variable', intl: 'ja-JP', intlFallback: 'en', og: 'ja_JP', uiFace: 'preloaded', region: 'international' },
  { code: 'de', tag: 'de', englishName: 'German', nativeName: 'Deutsch', dir: 'ltr', script: 'Latn', fontFamily: null, intl: 'de-DE', intlFallback: 'en', og: 'de_DE', uiFace: 'preloaded', region: 'international' },
  { code: 'id', tag: 'id', englishName: 'Indonesian', nativeName: 'Bahasa Indonesia', dir: 'ltr', script: 'Latn', fontFamily: null, intl: 'id-ID', intlFallback: 'en', og: 'id_ID', uiFace: 'preloaded', region: 'international' },
  { code: 'ko', tag: 'ko', englishName: 'Korean', nativeName: '한국어', dir: 'ltr', script: 'Kore', fontFamily: 'Noto Sans KR Variable', intl: 'ko-KR', intlFallback: 'en', og: 'ko_KR', uiFace: 'preloaded', region: 'international' },
  { code: 'it', tag: 'it', englishName: 'Italian', nativeName: 'Italiano', dir: 'ltr', script: 'Latn', fontFamily: null, intl: 'it-IT', intlFallback: 'en', og: 'it_IT', uiFace: 'preloaded', region: 'international' },
  { code: 'tr', tag: 'tr', englishName: 'Turkish', nativeName: 'Türkçe', dir: 'ltr', script: 'Latn', fontFamily: null, intl: 'tr-TR', intlFallback: 'en', og: 'tr_TR', uiFace: 'extended', region: 'international' },
  { code: 'vi', tag: 'vi', englishName: 'Vietnamese', nativeName: 'Tiếng Việt', dir: 'ltr', script: 'Latn', fontFamily: null, intl: 'vi-VN', intlFallback: 'en', og: 'vi_VN', uiFace: 'extended', region: 'international' },
  { code: 'th', tag: 'th', englishName: 'Thai', nativeName: 'ไทย', dir: 'ltr', script: 'Thai', fontFamily: 'Noto Sans Thai Variable', intl: 'th-TH', intlFallback: 'en', og: 'th_TH', uiFace: 'preloaded', region: 'international' },
] as const satisfies readonly LocaleDefinition[];

export type LocaleCode = (typeof LOCALES)[number]['code'];
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE = 'en' satisfies LocaleCode;
export const LOCALE_CODES: readonly LocaleCode[] = LOCALES.map((locale) => locale.code);

const BY_CODE: ReadonlyMap<string, Locale> = new Map(LOCALES.map((locale) => [locale.code, locale]));

export function isLocaleCode(value: unknown): value is LocaleCode {
  return typeof value === 'string' && BY_CODE.has(value);
}

/** Look up a locale by code (case-insensitive). */
export function findLocale(code: string | null | undefined): Locale | undefined {
  return BY_CODE.get(String(code ?? '').toLowerCase());
}

/** The locale, or English when the code is unknown. */
export function getLocale(code: string | null | undefined): Locale {
  return findLocale(code) ?? (BY_CODE.get(DEFAULT_LOCALE) as Locale);
}

const intlCache = new Map<string, string>();

/**
 * The Intl locale to format with: the preferred tag when the runtime has data for it, else the registry fallback
 * (e.g. sat → en-IN). Without this check Intl silently uses the host default locale for unsupported tags.
 */
export function resolveIntlLocale(code: string | null | undefined): string {
  const locale = getLocale(code);
  const cached = intlCache.get(locale.code);
  if (cached) return cached;
  const supported = Intl.NumberFormat.supportedLocalesOf([locale.intl]).length > 0;
  const resolved = supported ? locale.intl : locale.intlFallback;
  intlCache.set(locale.code, resolved);
  return resolved;
}

export type LocaleFontProperty = '--font-script' | '--font-ui-face';

/**
 * Custom properties for <html> that select the fonts of a locale: `--font-script` (the script face, preferred before
 * the system fallbacks) and, for `extended` locales, `--font-ui-face` (full Inter instead of the Latin-only preload).
 */
export function localeFontProperties(code: string | null | undefined): Readonly<Partial<Record<LocaleFontProperty, string>>> {
  const locale = getLocale(code);
  const properties: Partial<Record<LocaleFontProperty, string>> = {};
  if (locale.fontFamily !== null) properties['--font-script'] = `"${locale.fontFamily}"`;
  if (locale.uiFace === 'extended') properties['--font-ui-face'] = '"Inter Variable"';
  return properties;
}

/** Production origin of the public site (canonical, hreflang and og:url). */
export const SITE_ORIGIN = 'https://www.multiplierskraft.com';
/** localStorage key of the visitor's explicit language choice. */
export const LOCALE_KEY = 'nucleus.locale';
/** Paths that never take a locale prefix (signed-in apps, API, owner console). */
export const UNLOCALIZED = /^\/(workspace|login|cpanel|api)(\/|$)/i;

export interface LocalePathParts {
  readonly locale: LocaleCode;
  readonly path: string;
  readonly prefixed: boolean;
}

/**
 * Split a pathname into its locale prefix and the locale-free path (2- and 3-letter codes):
 * "/es/about" → es + "/about"; "/kok" → kok + "/"; "/about" → en + "/about" (not prefixed).
 */
export function splitLocalePath(pathname: string | null | undefined): LocalePathParts {
  const source = pathname || '/';
  const match = /^\/([a-z]{2,3})(\/.*)?$/i.exec(source);
  const locale = match ? findLocale(match[1]) : undefined;
  if (!match || !locale) return { locale: DEFAULT_LOCALE, path: source, prefixed: false };
  return { locale: locale.code, path: match[2] || '/', prefixed: true };
}

/**
 * The URL of an internal path in a locale (English stays unprefixed). Hashes, queries, external URLs and the
 * unlocalized apps pass through unchanged; an already prefixed path is re-prefixed.
 */
export function localizePath(href: string, locale: string): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const cut = href.search(/[?#]/);
  const pathname = cut < 0 ? href : href.slice(0, cut);
  const tail = cut < 0 ? '' : href.slice(cut);
  if (UNLOCALIZED.test(pathname)) return href;
  const { path } = splitLocalePath(pathname);
  const target = findLocale(locale);
  if (!target || target.code === DEFAULT_LOCALE) return path + tail;
  return `/${target.code}${path === '/' ? '' : path}${tail}`;
}

/** The best supported locale for the browser's languages (exact tag, then base language), or null. */
export function matchPreferredLocale(languages: readonly string[]): LocaleCode | null {
  for (const language of languages) {
    const lower = language.toLowerCase();
    const exact = LOCALES.find((locale) => locale.tag.toLowerCase() === lower);
    if (exact) return exact.code;
    const base = findLocale(lower.split('-')[0]);
    if (base) return base.code;
  }
  return null;
}
