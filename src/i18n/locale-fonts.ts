/**
 * Locale fonts, loaded per locale only. The root layout preloads only Inter's Latin subset (next/font, ~48 KB); the
 * full unicode-range sliced Inter (latin-ext, Vietnamese, Cyrillic) and every script font are separate chunks +
 * stylesheets fetched only when a locale that needs them is active, so none of them is in the English first load.
 * Each @fontsource face is unicode-range sliced, so the browser downloads only the glyph ranges a page shows.
 * Fonts are self-hosted (no runtime Google Fonts calls: privacy and data residency).
 */
import { getLocale, type ScriptCode } from './locales';

type FontLoader = () => Promise<unknown>;

/** Script → stylesheet loader. Scripts covered by Inter have no entry. */
const SCRIPT_FONT_LOADERS: Readonly<Partial<Record<ScriptCode, FontLoader>>> = {
  Arab: () => import('@fontsource-variable/noto-sans-arabic/wght.css'),
  Deva: () => import('@fontsource-variable/noto-sans-devanagari/wght.css'),
  Beng: () => import('@fontsource-variable/noto-sans-bengali/wght.css'),
  Telu: () => import('@fontsource-variable/noto-sans-telugu/wght.css'),
  Taml: () => import('@fontsource-variable/noto-sans-tamil/wght.css'),
  Gujr: () => import('@fontsource-variable/noto-sans-gujarati/wght.css'),
  Guru: () => import('@fontsource-variable/noto-sans-gurmukhi/wght.css'),
  Knda: () => import('@fontsource-variable/noto-sans-kannada/wght.css'),
  Orya: () => import('@fontsource-variable/noto-sans-oriya/wght.css'),
  Mlym: () => import('@fontsource-variable/noto-sans-malayalam/wght.css'),
  Olck: () => import('@fontsource-variable/noto-sans-ol-chiki/wght.css'),
  Hans: () => import('@fontsource-variable/noto-sans-sc/wght.css'),
  Jpan: () => import('@fontsource-variable/noto-sans-jp/wght.css'),
  Kore: () => import('@fontsource-variable/noto-sans-kr/wght.css'),
  Thai: () => import('@fontsource-variable/noto-sans-thai/wght.css'),
};

const loadExtendedInter: FontLoader = () => import('@fontsource-variable/inter/wght.css');

const pending = new Map<string, Promise<void>>();

function loadOnce(key: string, load: FontLoader): Promise<void> {
  const existing = pending.get(key);
  if (existing) return existing;
  const promise = load().then(
    () => undefined,
    () => {
      pending.delete(key);
    },
  );
  pending.set(key, promise);
  return promise;
}

/**
 * Load the fonts a locale needs (once per face). Resolves when the stylesheet is in; a failed load never
 * breaks the page (the system fallbacks in --font-sans remain) and is retried on the next call.
 */
export function loadLocaleFonts(code: string): Promise<void> {
  const { script, uiFace } = getLocale(code);
  const loads: Promise<void>[] = [];
  if (uiFace === 'extended') loads.push(loadOnce('inter-extended', loadExtendedInter));
  const loadScript = SCRIPT_FONT_LOADERS[script];
  if (loadScript) loads.push(loadOnce(script, loadScript));
  return Promise.all(loads).then(() => undefined);
}
